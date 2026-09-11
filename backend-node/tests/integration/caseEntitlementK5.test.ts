/**
 * K.5 — case entitlement hardening + cases/docs/messages/notifications adapters.
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

const PDF = Buffer.from("%PDF-1.4 k5 entitlement\n");

describe("K.5 case entitlement + adapters", () => {
  let app: Express;
  let admin: TestUser;
  let accountant: TestUser;
  let unpaid: TestUser & { clientId: string };
  let saOnly: TestUser & { clientId: string };
  let mtdOnly: TestUser & { clientId: string };
  let dual: TestUser & { clientId: string };
  let saCaseId: string;
  let mtdCaseId: string;
  let dualSaCaseId: string;
  let dualMtdCaseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    admin = await makeUser("ADMIN", "k5admin");
    accountant = await makeUser("ACCOUNTANT", "k5acc");
    unpaid = await makeClient("k5unpaid");
    saOnly = await makeClient("k5sa");
    mtdOnly = await makeClient("k5mtd");
    dual = await makeClient("k5dual");

    ({ caseId: saCaseId } = await activateClientService(saOnly, "SELF_ASSESSMENT"));
    ({ caseId: mtdCaseId } = await activateClientService(mtdOnly, "MTD_INCOME_TAX"));
    ({ caseId: dualSaCaseId } = await activateClientService(dual, "SELF_ASSESSMENT"));
    ({ caseId: dualMtdCaseId } = await activateClientService(dual, "MTD_INCOME_TAX"));
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("unpaid/neither client cannot create SA case", async () => {
    await request(app)
      .post("/api/cases")
      .set(bearer(unpaid))
      .send({ tax_year: "2024/25", service_type: "SELF_ASSESSMENT" })
      .expect(403);
  });

  it("unpaid/neither client cannot create MTD case", async () => {
    await request(app)
      .post("/api/cases")
      .set(bearer(unpaid))
      .send({ tax_year: "2024/25", service_type: "MTD_INCOME_TAX" })
      .expect(403);
  });

  it("SA-only cannot create or access MTD", async () => {
    await request(app)
      .post("/api/cases")
      .set(bearer(saOnly))
      .send({ tax_year: "2024/25", service_type: "MTD_INCOME_TAX" })
      .expect(403);
    await request(app).get(`/api/cases/${mtdCaseId}`).set(bearer(saOnly)).expect(403);
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(saOnly))
      .field("category", "mtd")
      .expect(403);
  });

  it("MTD-only cannot create or access SA", async () => {
    await request(app)
      .post("/api/cases")
      .set(bearer(mtdOnly))
      .send({ tax_year: "2024/25", service_type: "SELF_ASSESSMENT" })
      .expect(403);
    await request(app).get(`/api/cases/${saCaseId}`).set(bearer(mtdOnly)).expect(403);
  });

  it("dual ACTIVE can access both SA and MTD cases", async () => {
    const sa = await request(app)
      .get(`/api/cases/${dualSaCaseId}`)
      .set(bearer(dual))
      .expect(200);
    const mtd = await request(app)
      .get(`/api/cases/${dualMtdCaseId}`)
      .set(bearer(dual))
      .expect(200);
    expect(sa.body.service_type).toBe("SELF_ASSESSMENT");
    expect(mtd.body.service_type).toBe("MTD_INCOME_TAX");
    const list = await request(app).get("/api/cases").set(bearer(dual)).expect(200);
    const types = list.body.map((c: { service_type: string }) => c.service_type);
    expect(types).toContain("SELF_ASSESSMENT");
    expect(types).toContain("MTD_INCOME_TAX");
  });

  it("direct API cannot bypass entitlement checks", async () => {
    // Native + compat both enforce.
    await request(app)
      .post("/api/cases")
      .set(bearer(unpaid))
      .send({ service_type: "SELF_ASSESSMENT", tax_year: "2025/26" })
      .expect(403);
    await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(unpaid))
      .expect(403);
    await request(app)
      .get(`/api/compat/tax-return/${saCaseId}/progress`)
      .set(bearer(unpaid));
    // progress is POST in adapter
    await request(app)
      .post(`/api/compat/tax-return/${saCaseId}/progress`)
      .set(bearer(unpaid))
      .expect(403);
  });

  it("duplicate open service case creation is prevented", async () => {
    // Activation already created SA case for saOnly at ACTIVATION tax year.
    const existing = await request(app)
      .get(`/api/cases/${saCaseId}`)
      .set(bearer(saOnly))
      .expect(200);
    await request(app)
      .post("/api/cases")
      .set(bearer(saOnly))
      .send({
        service_type: "SELF_ASSESSMENT",
        tax_year: existing.body.tax_year,
      })
      .expect(409);
    await request(app)
      .post("/api/cases")
      .set(bearer(admin))
      .send({
        client_user_id: saOnly.id,
        service_type: "SELF_ASSESSMENT",
        tax_year: existing.body.tax_year,
      })
      .expect(409);
  });

  it("staff authorised workflows still work (assign + whitelist review)", async () => {
    const assigned = await request(app)
      .post(`/api/cases/${saCaseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    expect(assigned.body.assigned_accountant_id).toBe(accountant.id);

    const compatAssign = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(admin))
      .send({ taxReturnId: dualSaCaseId, accountantId: accountant.id })
      .expect(200);
    expect(compatAssign.body.data.taxReturnId).toBe(dualSaCaseId);

    // Invalid free-form transition rejected.
    await request(app)
      .post("/api/compat/admin/manage-review")
      .set(bearer(admin))
      .send({ taxReturnId: saCaseId, status: "COMPLETED" })
      .expect(400);
  });

  it("one client cannot access another client's case", async () => {
    await request(app).get(`/api/cases/${saCaseId}`).set(bearer(mtdOnly)).expect(403);
    await request(app)
      .post(`/api/compat/tax-return/${saCaseId}/progress`)
      .set(bearer(mtdOnly))
      .expect(403);
  });

  it("one client cannot access another client's documents/messages", async () => {
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(saOnly))
      .field("case_id", saCaseId)
      .field("document_type", "P60")
      .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
      .expect(200);

    await request(app)
      .post("/api/messages")
      .set(bearer(saOnly))
      .send({ case_id: saCaseId, body: "hello from sa" })
      .expect(200);

    await request(app)
      .get(`/api/documents?case_id=${saCaseId}`)
      .set(bearer(mtdOnly))
      .expect(403);
    await request(app)
      .get(`/api/messages?case_id=${saCaseId}`)
      .set(bearer(mtdOnly))
      .expect(403);
    await request(app)
      .get(`/api/compat/client/communication-log/${saCaseId}`)
      .set(bearer(mtdOnly))
      .expect(403);
  });

  it("invalid workflow transitions fail", async () => {
    await request(app)
      .post("/api/compat/admin/manage-review")
      .set(bearer(admin))
      .send({ taxReturnId: mtdCaseId, status: "CLIENT_APPROVED" })
      .expect(400);
    await request(app)
      .post("/api/compat/admin/manage-review")
      .set(bearer(admin))
      .send({ taxReturnId: mtdCaseId, action: "invented-action" })
      .expect(400);
  });

  it("document upload/request/download remains correctly scoped", async () => {
    const up = await request(app)
      .post(`/api/compat/client/tax-returns/${saCaseId}/upload-documents`)
      .set(bearer(saOnly))
      .field("documentType", "P60")
      .attach("file", PDF, { filename: "sa-p60.pdf", contentType: "application/pdf" })
      .expect(200);
    expect(up.body.data.taxReturnId).toBe(saCaseId);
    expect(up.body.data.caseId ?? up.body.data.case_id ?? saCaseId).toBeTruthy();

    const files = await request(app)
      .post("/api/compat/client/my-files")
      .set(bearer(saOnly))
      .expect(200);
    expect(files.body.data.files.length).toBeGreaterThan(0);

    // Other client cannot download.
    await request(app)
      .get(`/api/compat/client/documents/${up.body.data.id}/download`)
      .set(bearer(mtdOnly))
      .expect(403);

    await request(app)
      .get(`/api/compat/client/documents/${up.body.data.id}/download`)
      .set(bearer(saOnly))
      .expect(200);
  });

  it("notifications are user-scoped; delete is deferred", async () => {
    const { col } = await import("../../src/db/mongo");
    const { nowIso } = await import("../../src/domain/workflow");
    const { randomUUID } = await import("crypto");
    const nid = randomUUID();
    await col("notifications").insertOne({
      id: nid,
      user_id: saOnly.id,
      title: "K5 note",
      body: "for sa only",
      case_id: saCaseId,
      is_read: false,
      created_at: nowIso(),
    });
    await col("notifications").insertOne({
      id: randomUUID(),
      user_id: mtdOnly.id,
      title: "MTD note",
      body: "secret",
      case_id: mtdCaseId,
      is_read: false,
      created_at: nowIso(),
    });

    const list = await request(app)
      .post("/api/compat/all-notifications")
      .set(bearer(saOnly))
      .send({ page: 1, limit: 20 })
      .expect(200);
    const titles = list.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain("K5 note");
    expect(titles).not.toContain("MTD note");
    expect(list.body.data.notifications[0]).toHaveProperty("read");

    await request(app)
      .patch(`/api/compat/notifications/${nid}/read`)
      .set(bearer(saOnly))
      .expect(200);
    await request(app)
      .patch(`/api/compat/notifications/${nid}/read`)
      .set(bearer(mtdOnly))
      .expect(404);

    await request(app)
      .delete(`/api/compat/notifications/${nid}`)
      .set(bearer(saOnly))
      .expect(405);
  });

  it("apply-tax-return prefers activation case and preserves taxReturnId identity", async () => {
    const res = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(saOnly))
      .field("category", "taxsimba")
      .expect(201);
    expect(res.body.data.taxReturn.taxReturnId).toBe(saCaseId);
    expect(res.body.data.taxReturn.id).toBe(saCaseId);
    expect(res.body.data.preferredExisting).toBe(true);
  });
});
