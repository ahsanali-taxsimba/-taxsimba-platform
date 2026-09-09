/**
 * Pre-Toxel handover — launch-critical compat closes.
 * Admin case detail, client global-fee / tax-return-type, drafts approve, Elements HIDE.
 */
import { randomUUID } from "crypto";

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

describe("Pre-Toxel handover launch-critical compat", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser;
  let caseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "htadmin");
    accountant = await makeUser("ACCOUNTANT", "htacc");
    client = await makeClient("htclient");
    const activated = await activateClientService(client, "SELF_ASSESSMENT");
    caseId = activated.caseId;

    await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({
        taxReturnId: caseId,
        accountantId: accountant.id,
        priority: "MEDIUM",
      })
      .expect(200);
  }, 90000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("POST /admin/tax-return/:id/files returns taxReturn + files shape", async () => {
    const res = await request(app)
      .post(`/api/compat/admin/tax-return/${caseId}/files`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taxReturn).toBeTruthy();
    expect(res.body.data.taxReturn.id).toBe(caseId);
    expect(res.body.data.taxReturn.client).toBeTruthy();
    expect(res.body.data.files).toBeTruthy();
    expect(Array.isArray(res.body.data.files.allFiles)).toBe(true);
  });

  it("GET client/global-fee returns baseFee from packages", async () => {
    const res = await request(app)
      .get("/api/compat/client/global-fee")
      .set(bearer(client))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.globalFee.baseFee)).toBeGreaterThan(0);
  });

  it("POST client/tax-return-type returns SA/MTD options from packages", async () => {
    const res = await request(app)
      .post("/api/compat/client/tax-return-type")
      .set(bearer(client))
      .send({ limit: 100 })
      .expect(200);
    expect(res.body.success).toBe(true);
    const types = res.body.data.taxReturnTypes;
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(types.some((t: { typeCode: string }) => t.typeCode === "SA")).toBe(true);
  });

  it("GET client/drafts/:id returns draftDocuments envelope", async () => {
    const res = await request(app)
      .get(`/api/compat/client/drafts/${caseId}`)
      .set(bearer(client))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taxReturn.id).toBe(caseId);
    expect(Array.isArray(res.body.data.documents.draftDocuments)).toBe(true);
  });

  it("Elements create-payment-intent is HIDE 405", async () => {
    const res = await request(app)
      .post("/api/compat/client/create-payment-intent")
      .set(bearer(client))
      .send({})
      .expect(405);
    expect(res.body.success).toBe(false);
  });

  it("AW admin list respects case_id query filter", async () => {
    const { col } = await import("../../src/db/mongo");
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      kind: "ADDITIONAL_WORK",
      case_id: caseId,
      client_user_id: client.id,
      amount: 50,
      payment_status: "pending",
      request_status: "pending",
      description: "Handover AW",
      fulfilled: false,
      created_at: new Date().toISOString(),
    });
    const res = await request(app)
      .get("/api/compat/admin/payment-requests")
      .query({ case_id: caseId })
      .set(bearer(admin))
      .expect(200);
    expect(res.body.success).toBe(true);
    const rows = res.body.data.paymentRequests;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r: { caseId?: string; case_id?: string }) => (r.caseId || r.case_id) === caseId)).toBe(
      true,
    );
  });
});
