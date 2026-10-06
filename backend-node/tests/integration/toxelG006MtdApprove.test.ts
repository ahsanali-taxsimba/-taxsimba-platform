/**
 * G-006 / G-007 / G-008 — MTD admin approve via manage-tax must move the period
 * (and client overview) to draft_ready; external submission remains recordable.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { col } from "../../src/db/mongo";
import {
  activateClientService,
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
  TestUser,
} from "../helpers/app";

describe("G-006/G-007/G-008 MTD admin approve + external submission", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser & { clientId: string };
  let taxYearSeq = 1880;

  async function mtdCase(): Promise<{ caseId: string; periodId: string }> {
    const start = taxYearSeq++;
    const year = `${start}/${String(start + 1).slice(-2)}`;
    const res = await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({
        client_user_id: client.id,
        tax_year: year,
        service_type: "MTD_INCOME_TAX",
        manual_creation_reason: "Test fixture — G-006 MTD case",
      })
      .expect(200);
    const caseId = res.body.id as string;
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    const periods = await request(app)
      .get(`/api/mtd/cases/${caseId}/periods`)
      .set(bearer(admin))
      .expect(200);
    const q1 = (periods.body as Array<{ id: string; kind: string }>).find(
      (p) => p.kind !== "FINAL_DECLARATION",
    );
    if (!q1) throw new Error("missing Q1");
    return { caseId, periodId: q1.id };
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN");
    accountant = await makeUser("ACCOUNTANT", "g006-accountant");
    client = await makeClient("mtd-g006-client");
    await activateClientService(client, "MTD_INCOME_TAX");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("manage-review approve on MTD publishes period and overview shows draft_ready", async () => {
    const { caseId, periodId } = await mtdCase();
    await request(app)
      .post(`/api/mtd/periods/${periodId}/figures`)
      .set(bearer(accountant))
      .send({ income: 5000, expenses: 500, estimated_income_tax: 400 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);

    // Toxsl manage-tax path — previously left client "Assigned".
    const approved = await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "approve" })
      .expect(200);
    expect(approved.body?.success ?? true).toBeTruthy();

    const period = await request(app)
      .get(`/api/mtd/cases/${caseId}/periods`)
      .set(bearer(client))
      .expect(200);
    const q1 = (period.body as Array<{ id: string; status: string }>).find((p) => p.id === periodId);
    expect(q1?.status).toBe("AWAITING_CLIENT_APPROVAL");

    const overview = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    const status =
      overview.body?.data?.taxReturnStatus || overview.body?.taxReturnStatus;
    expect(status).toBe("draft_ready");

    const kase = await col("cases").findOne({ id: caseId });
    expect(String(kase?.status)).toBe("AWAITING_CLIENT_APPROVAL");
  });

  it("records external MTD submission after client approval (G-008)", async () => {
    const { caseId, periodId } = await mtdCase();
    await request(app)
      .post(`/api/mtd/periods/${periodId}/figures`)
      .set(bearer(accountant))
      .send({ income: 2000, expenses: 100 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/client-approve`)
      .set(bearer(client))
      .send({ version: 1 })
      .expect(200);

    const recorded = await request(app)
      .post(`/api/mtd/periods/${periodId}/record-submission`)
      .set(bearer(admin))
      .send({
        submission_reference: "MTD-EXT-9988",
        submission_date: "2026-08-01",
        provider: "Xero",
      })
      .expect(200);
    expect(recorded.body.status).toBe("SUBMITTED");
    expect(recorded.body.submission_reference).toBe("MTD-EXT-9988");
  });

  it("native admin-approve syncs parent case to AWAITING_CLIENT_APPROVAL", async () => {
    const { caseId, periodId } = await mtdCase();
    await request(app)
      .post(`/api/mtd/periods/${periodId}/figures`)
      .set(bearer(accountant))
      .send({ income: 100, expenses: 0 })
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/submit-for-review`)
      .set(bearer(accountant))
      .expect(200);
    await request(app)
      .post(`/api/mtd/periods/${periodId}/admin-approve`)
      .set(bearer(admin))
      .expect(200);
    const kase = await col("cases").findOne({ id: caseId });
    expect(String(kase?.status)).toBe("AWAITING_CLIENT_APPROVAL");
  });
});
