/**
 * Toxsl SA journey: Tax Return Certificate upload must advance SUBMITTED → COMPLETED.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
  TestUser,
} from "../helpers/app";

const CHECKLIST = {
  client_information_reviewed: true,
  required_documents_reviewed: true,
  income_checked: true,
  allowable_expenses_checked: true,
  tax_calculation_checked: true,
  supporting_documents_attached: true,
  return_ready: true,
};

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

let app: Express;
let admin: TestUser;
let accountant: TestUser;
let otherAccountant: TestUser;
let client: TestUser & { clientId: string };
let taxYearSeq = 1980;

async function newCase(): Promise<string> {
  while ([2023, 2024, 2025].includes(taxYearSeq)) taxYearSeq++;
  const start = taxYearSeq++;
  const taxYear = `${start}/${String(start + 1).slice(-2)}`;
  const res = await request(app)
    .post("/api/cases")
    .set(bearer(admin))
    .send({
      client_user_id: client.id,
      tax_year: taxYear,
      manual_creation_reason: "SA final certificate regression",
    });
  expect(res.status).toBe(200);
  return res.body.id as string;
}

async function readyForSubmission(): Promise<string> {
  const caseId = await newCase();
  await request(app)
    .post(`/api/cases/${caseId}/assign`)
    .set(bearer(admin))
    .send({ accountant_id: accountant.id })
    .expect(200);
  await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
  const calc = await request(app)
    .post(`/api/cases/${caseId}/calculations`)
    .set(bearer(accountant))
    .send({ total_income: 50000, taxable_income: 37430, tax_due: 7486 })
    .expect(200);
  await request(app)
    .post(`/api/cases/${caseId}/submit-for-admin-review`)
    .set(bearer(accountant))
    .send({ calculation_version_id: calc.body.id, checklist: CHECKLIST })
    .expect(200);
  await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(200);
  await request(app).post(`/api/cases/${caseId}/client-approve`).set(bearer(client)).expect(200);
  return caseId;
}

async function recordExternalSubmission(caseId: string): Promise<void> {
  await request(app)
    .post(`/api/compat/admin/tax-return/${caseId}/record-submission`)
    .set(bearer(admin))
    .send({
      submissionDate: "2025-06-01",
      submissionReference: "HMRC-SA-TEST-001",
      provider: "Commercial SA software",
    })
    .expect(200);
}

describe("SA final certificate journey (Toxsl)", () => {
  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "sa-cert-admin");
    accountant = await makeUser("ACCOUNTANT", "sa-cert-acc");
    otherAccountant = await makeUser("ACCOUNTANT", "sa-cert-other");
    client = await makeClient("sa-cert-client");
    await activateClientService(client, "SELF_ASSESSMENT");
  }, 120000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("uploads final certificate, completes case, persists after reload, idempotent retry", async () => {
    const caseId = await readyForSubmission();
    await recordExternalSubmission(caseId);

    const beforeProgress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(accountant))
      .expect(200);
    expect(beforeProgress.body.data.status).toBe("final_submitted");
    expect(beforeProgress.body.data.nodeStatus).toBe("SUBMITTED");

    const upload = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(accountant))
      .attach("finalCertificateFile", PDF, {
        filename: "sa-final-certificate.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    expect(upload.body.success).toBe(true);
    expect(upload.body.data.toxelStatus).toBe("completed");
    expect(upload.body.data.caseStatus).toBe("COMPLETED");

    const { col } = await import("../../src/db/mongo");
    const doc = await col("documents").findOne({
      case_id: caseId,
      is_final: true,
      is_deleted: { $ne: true },
    });
    expect(doc).toBeTruthy();
    expect(String(doc?.storage_path || "")).toBeTruthy();

    const kase = await col("cases").findOne({ id: caseId });
    expect(kase?.status).toBe("COMPLETED");
    const sub = await col("submission_records").findOne({ case_id: caseId });
    expect(sub?.status).toBe("COMPLETED");

    const clientCert = await request(app)
      .get(`/api/compat/client/tax-returns/${caseId}/final-certificate`)
      .set(bearer(client))
      .expect(200);
    expect((clientCert.body.data?.documents || []).length).toBeGreaterThan(0);

    const afterProgress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(accountant))
      .expect(200);
    expect(afterProgress.body.data.status).toBe("completed");
    expect(afterProgress.body.data.nodeStatus).toBe("COMPLETED");
    expect(afterProgress.body.data.meta?.canUpdate).toBe(false);

    // Fresh login / reload simulation — progress unchanged.
    const reload = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(admin))
      .expect(200);
    expect(reload.body.data.status).toBe("completed");

    const dup = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(accountant))
      .attach("finalCertificateFile", PDF, {
        filename: "sa-final-certificate.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    expect(dup.body.data.duplicate).toBe(true);
    const finalCount = await col("documents").countDocuments({
      case_id: caseId,
      is_final: true,
      is_deleted: { $ne: true },
    });
    expect(finalCount).toBe(1);
  });

  it("rejects certificate before external submission is recorded", async () => {
    const caseId = await readyForSubmission();
    const res = await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(accountant))
      .attach("finalCertificateFile", PDF, {
        filename: "too-early.pdf",
        contentType: "application/pdf",
      })
      .expect(400);
    expect(String(res.body.message || res.body.detail || "")).toMatch(/external submission/i);
  });

  it("rejects invalid file type and unauthorised roles", async () => {
    const caseId = await readyForSubmission();
    await recordExternalSubmission(caseId);

    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(otherAccountant))
      .attach("finalCertificateFile", PDF, {
        filename: "blocked.pdf",
        contentType: "application/pdf",
      })
      .expect(403);

    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(client))
      .attach("finalCertificateFile", PDF, {
        filename: "client.pdf",
        contentType: "application/pdf",
      })
      .expect(403);

    const bad = Buffer.from("not-a-real-pdf");
    await request(app)
      .post(`/api/compat/accountant/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(accountant))
      .attach("finalCertificateFile", bad, {
        filename: "virus.exe",
        contentType: "application/x-msdownload",
      })
      .expect(415);
  });
});
