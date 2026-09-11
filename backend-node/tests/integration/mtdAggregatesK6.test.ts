/**
 * K.6 — MTD aggregate adapters + start-next-quarter HIDE + submit-tax-info map.
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

const PDF = Buffer.from("%PDF-1.4 k6 mtd\n");

describe("K.6 MTD aggregate adapters", () => {
  let app: Express;
  let unpaid: TestUser & { clientId: string };
  let saOnly: TestUser & { clientId: string };
  let mtdOnly: TestUser & { clientId: string };
  let dual: TestUser & { clientId: string };
  let mtdCaseId: string;
  let dualMtdCaseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    unpaid = await makeClient("k6unpaid");
    saOnly = await makeClient("k6sa");
    mtdOnly = await makeClient("k6mtd");
    dual = await makeClient("k6dual");
    await activateClientService(saOnly, "SELF_ASSESSMENT");
    ({ caseId: mtdCaseId } = await activateClientService(mtdOnly, "MTD_INCOME_TAX"));
    await activateClientService(dual, "SELF_ASSESSMENT");
    ({ caseId: dualMtdCaseId } = await activateClientService(dual, "MTD_INCOME_TAX"));
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("ACTIVE MTD client gets dashboard-overview with taxReturnId identity and no nextQuarter", async () => {
    const res = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taxReturn.taxReturnId).toBe(mtdCaseId);
    expect(res.body.data.taxReturn.id).toBe(mtdCaseId);
    expect(res.body.data.nextQuarter).toBeNull();
    expect(res.body.data.taxReturnStatus).toBeTruthy();
    expect(Array.isArray(res.body.data.documents)).toBe(true);
    expect(Array.isArray(res.body.data.periods)).toBe(true);
    expect(res.body.data.periods.length).toBeGreaterThanOrEqual(4);
  });

  it("compliance and documents aggregates work for ACTIVE MTD", async () => {
    const compliance = await request(app)
      .get("/api/compat/mtd/compliance")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(Array.isArray(compliance.body.data)).toBe(true);
    expect(compliance.body.data[0].status).toBeTruthy();
    expect(compliance.body.data[0].taxReturnId).toBe(mtdCaseId);

    const docs = await request(app)
      .get("/api/compat/mtd/documents")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(docs.body.data.uploadedDocuments).toBeDefined();
    expect(docs.body.data.requestedDocuments).toBeDefined();
  });

  it("SA-only and unpaid cannot access MTD aggregates or upload", async () => {
    for (const client of [saOnly, unpaid]) {
      await request(app)
        .get("/api/compat/mtd/dashboard-overview")
        .set(bearer(client))
        .expect(403);
      await request(app).get("/api/compat/mtd/compliance").set(bearer(client)).expect(403);
      await request(app).get("/api/compat/mtd/documents").set(bearer(client)).expect(403);
      await request(app)
        .post("/api/compat/mtd/documents/upload")
        .set(bearer(client))
        .field("documentType", "general")
        .attach("documents", PDF, { filename: "x.pdf", contentType: "application/pdf" })
        .expect(403);
    }
  });

  it("dual ACTIVE uses MTD case only for aggregates", async () => {
    const res = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(dual))
      .expect(200);
    expect(res.body.data.taxReturn.taxReturnId).toBe(dualMtdCaseId);
    expect(res.body.data.taxReturn.serviceType).toBe("MTD_INCOME_TAX");
  });

  it("MTD document upload succeeds and lists under documents aggregate", async () => {
    const up = await request(app)
      .post("/api/compat/mtd/documents/upload")
      .set(bearer(mtdOnly))
      .field("documentType", "bank_statement")
      .attach("documents", PDF, { filename: "bank.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(up.body.data.ok).toBe(true);
    expect(up.body.data.taxReturnId).toBe(mtdCaseId);

    const docs = await request(app)
      .get("/api/compat/mtd/documents")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(docs.body.data.uploadedDocuments.some((d: { originalFileName: string }) => d.originalFileName === "bank.pdf")).toBe(
      true,
    );
  });

  it("start-next-quarter is HIDE (405) and does not create periods", async () => {
    const before = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(mtdOnly))
      .expect(200);
    const countBefore = before.body.data.periods.length;

    await request(app)
      .post("/api/compat/mtd/start-next-quarter")
      .set(bearer(mtdOnly))
      .send({})
      .expect(405);

    const after = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(after.body.data.periods.length).toBe(countBefore);
  });

  it("submit-tax-info requires ACTIVE MTD, persists flag, does not activate SA", async () => {
    await request(app)
      .post("/api/compat/client/submit-tax-info")
      .set(bearer(saOnly))
      .field("businessName", "Nope")
      .expect(403);

    const res = await request(app)
      .post("/api/compat/client/submit-tax-info")
      .set(bearer(mtdOnly))
      .field("businessName", "K6 Biz")
      .field("utr", "1234567890")
      .field("submittedQuarters", JSON.stringify([]))
      .attach("documents", PDF, { filename: "id.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(res.body.data.isTaxInfoSubmitted).toBe(true);

    const account = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(account.body.data.isTaxInfoSubmitted).toBe(true);

    const { col } = await import("../../src/db/mongo");
    const sa = await col("client_services").findOne({
      client_id: mtdOnly.clientId,
      service_type: "SELF_ASSESSMENT",
    });
    expect(sa?.status).toBe("NOT_ACTIVE");
  });

  it("ensurePeriods remains idempotent via overview (no duplicate periods)", async () => {
    const a = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(mtdOnly))
      .expect(200);
    const b = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(mtdOnly))
      .expect(200);
    expect(a.body.data.periods.length).toBe(b.body.data.periods.length);
    const { col } = await import("../../src/db/mongo");
    const count = await col("mtd_periods").countDocuments({ case_id: mtdCaseId });
    expect(count).toBe(a.body.data.periods.length);
  });
});
