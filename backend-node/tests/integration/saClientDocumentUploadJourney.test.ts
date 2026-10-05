/**
 * Toxsl F-003/F-004: SA client document request → visible upload → fulfil request.
 */
import { createHash, randomUUID } from "crypto";

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

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("Toxsl F-003/F-004 SA client document upload journey", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "f003-admin");
    accountant = await makeUser("ACCOUNTANT", "f003-acc");
  }, 120000);

  afterAll(async () => {
    await dropTestDb();
  });

  async function seedAssignedCase(tag: string) {
    const client = await makeClient(`f003-${tag}-${randomUUID().slice(0, 5)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "SMART");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    return { client, caseId };
  }

  async function requestP60(caseId: string) {
    const res = await request(app)
      .post(`/api/compat/accountant/tax-returns/${caseId}/request-documents`)
      .set(bearer(accountant))
      .send({
        requiredDocuments: [{ documentType: "P60", description: "Latest P60" }],
        message: "Please upload your P60",
      })
      .expect(200);
    const docId = res.body.data.documentIds[0] as string;
    return docId;
  }

  it("requested upload action is visible to the correct client on all-tax-returns", async () => {
    const { client, caseId } = await seedAssignedCase("vis");
    const other = await makeClient(`f003-other-${randomUUID().slice(0, 5)}`);
    await activateClientService(other, "SELF_ASSESSMENT", "SIMPLE");
    const docId = await requestP60(caseId);

    const mine = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const row = (mine.body.data as { id: string; files: { allFiles: DocFile[] } }[]).find(
      (r) => r.id === caseId,
    );
    expect(row).toBeTruthy();
    const outstanding = row!.files.allFiles.filter((f) => f.uploadStatus !== "completed");
    expect(outstanding.map((f) => f.id)).toContain(docId);
    expect(outstanding[0].documentType || outstanding.find((f) => f.id === docId)?.documentType).toBeTruthy();

    const theirs = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(other))
      .send({})
      .expect(200);
    const foreign = (theirs.body.data as { id: string }[]).find((r) => r.id === caseId);
    expect(foreign).toBeFalsy();
  });

  it("successful client upload stores file, fulfils request, and is visible to staff", async () => {
    const { client, caseId } = await seedAssignedCase("ok");
    const docId = await requestP60(caseId);

    const upload = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .field("documentType", "P60")
      .expect(200);

    expect(upload.body.success).toBe(true);
    expect(upload.body.data.id).toBe(docId);
    expect(upload.body.data.uploadStatus).toBe("completed");
    expect(upload.body.data.requestStatus).toBe("Uploaded");
    expect(String(upload.body.data.downloadUrl)).toContain(`/client/documents/${docId}/download`);

    const { col } = await import("../../src/db/mongo");
    const doc = await col("documents").findOne({ id: docId });
    expect(doc?.status).toBe("Uploaded");
    expect(doc?.case_id).toBe(caseId);
    expect(doc?.client_user_id).toBe(client.id);
    expect(doc?.uploader_id).toBe(client.id);
    expect(doc?.storage_path).toBeTruthy();
    expect(doc?.request_id).toBeTruthy();

    const reqRow = await col("document_requests").findOne({ id: doc!.request_id });
    expect(reqRow?.status).toBe("Uploaded");
    expect(reqRow?.case_id).toBe(caseId);
    expect(reqRow?.client_user_id).toBe(client.id);

    const task = await col("tasks").findOne({ id: doc!.task_id });
    expect(task?.status).toBe("COMPLETED");

    // Persistence after reload (all-tax-returns).
    const reload = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const row = (reload.body.data as { id: string; files: { allFiles: DocFile[] } }[]).find(
      (r) => r.id === caseId,
    );
    const outstanding = row!.files.allFiles.filter((f) => f.uploadStatus !== "completed");
    expect(outstanding).toHaveLength(0);
    const uploaded = row!.files.allFiles.find((f) => f.id === docId);
    expect(uploaded?.uploadStatus).toBe("completed");

    // Accountant can download.
    const accDl = await request(app)
      .get(`/api/documents/${docId}/download`)
      .set(bearer(accountant))
      .expect(200);
    expect(Buffer.isBuffer(accDl.body) ? accDl.body.length : String(accDl.body).length).toBeGreaterThan(
      0,
    );

    // Admin can download.
    await request(app).get(`/api/documents/${docId}/download`).set(bearer(admin)).expect(200);

    // Client can download via compat.
    const clientDl = await request(app)
      .get(`/api/compat/client/documents/${docId}/download`)
      .set(bearer(client))
      .expect(200);
    expect(clientDl.body.length || Buffer.byteLength(clientDl.body)).toBeGreaterThan(0);
  });

  it("duplicate retry with same content is idempotent (no second document)", async () => {
    const { client, caseId } = await seedAssignedCase("dup");
    const docId = await requestP60(caseId);
    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .expect(200);
    const again = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .expect(200);
    expect(again.body.data.duplicate).toBe(true);
    expect(again.body.data.id).toBe(docId);

    const { col } = await import("../../src/db/mongo");
    const count = await col("documents").countDocuments({ case_id: caseId, is_deleted: { $ne: true } });
    expect(count).toBe(1);
  });

  it("rejects invalid type, oversized file, unrelated client, and wrong role", async () => {
    const { client, caseId } = await seedAssignedCase("rej");
    const docId = await requestP60(caseId);

    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", Buffer.from("#!/bin/sh"), {
        filename: "evil.sh",
        contentType: "application/x-sh",
      })
      .field("documentId", docId)
      .expect(415);

    const big = Buffer.alloc(26 * 1024 * 1024, 1);
    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", big, { filename: "huge.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .expect(413);

    const other = await makeClient(`f003-x-${randomUUID().slice(0, 5)}`);
    await activateClientService(other, "SELF_ASSESSMENT", "SIMPLE");
    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(other))
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .expect(403);

    await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(accountant))
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .field("documentId", docId)
      .expect(403);

    // Request must still be open after failed attempts.
    const { col } = await import("../../src/db/mongo");
    const doc = await col("documents").findOne({ id: docId });
    expect(doc?.status).toBe("Requested");
    const reqRow = await col("document_requests").findOne({ id: doc!.request_id });
    expect(reqRow?.status).toBe("Requested");
  });

  it("broken Content-Type without boundary returns 422 and does not complete the request", async () => {
    const { client, caseId } = await seedAssignedCase("ct");
    const docId = await requestP60(caseId);
    const boundary = "----WebKitFormBoundaryBroken";
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="p60.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      PDF,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .set("Content-Type", "multipart/form-data") // missing ; boundary=…
      .send(body);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    const { col } = await import("../../src/db/mongo");
    const doc = await col("documents").findOne({ id: docId });
    expect(doc?.status).toBe("Requested");
  });

  it("upload without documentId still fulfils the open Requested placeholder", async () => {
    const { client, caseId } = await seedAssignedCase("auto");
    const docId = await requestP60(caseId);
    const upload = await request(app)
      .post(`/api/compat/client/tax-returns/${caseId}/upload-documents`)
      .set(bearer(client))
      .attach("file", PDF, { filename: "p60-auto.pdf", contentType: "application/pdf" })
      .field("documentType", "P60")
      .expect(200);
    expect(upload.body.data.id).toBe(docId);
    const { col } = await import("../../src/db/mongo");
    expect((await col("document_requests").findOne({ case_id: caseId }))?.status).toBe("Uploaded");
  });

  it("Task 1 final certificate journey still completes after client upload fix", async () => {
    const client = await makeClient(`f003-cert-${randomUUID().slice(0, 5)}`);
    const { caseId } = await activateClientService(client, "SELF_ASSESSMENT", "ELITE");
    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: caseId, accountantId: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    const calc = await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(accountant))
      .send({ total_income: 40000, taxable_income: 27430, tax_due: 5000 })
      .expect(200);
    const checklist = {
      client_information_reviewed: true,
      required_documents_reviewed: true,
      income_checked: true,
      allowable_expenses_checked: true,
      tax_calculation_checked: true,
      supporting_documents_attached: true,
      return_ready: true,
    };
    await request(app)
      .post(`/api/cases/${caseId}/submit-for-admin-review`)
      .set(bearer(accountant))
      .send({ calculation_version_id: calc.body.id, checklist })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/admin-approve`).set(bearer(admin)).expect(200);
    await request(app).post(`/api/cases/${caseId}/client-approve`).set(bearer(client)).expect(200);
    await request(app)
      .post(`/api/compat/admin/tax-return/${caseId}/record-submission`)
      .set(bearer(admin))
      .send({
        submissionDate: "2025-06-01",
        submissionReference: `HMRC-${randomUUID().slice(0, 6)}`,
        provider: "Test",
      })
      .expect(200);
    const cert = await request(app)
      .post(`/api/compat/admin/assignments/${caseId}/upload-final-certificate`)
      .set(bearer(admin))
      .attach("finalCertificateFile", PDF, {
        filename: "final.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    expect(cert.body.data.toxelStatus).toBe("completed");
    const progress = await request(app)
      .post(`/api/compat/tax-return/${caseId}/progress`)
      .set(bearer(accountant))
      .expect(200);
    expect(progress.body.data.status).toBe("completed");
    void createHash; // keep import used for readability / future hash asserts
  });
});

type DocFile = {
  id: string;
  uploadStatus?: string;
  documentType?: string;
};
