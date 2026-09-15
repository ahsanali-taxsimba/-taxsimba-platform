/**
 * K.7 — admin/accountant adapters, SUPER_ADMIN role, contact masking preserved.
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

describe("K.7 admin / SUPER_ADMIN adapters", () => {
  let app: Express;
  let superAdmin: TestUser;
  let admin: TestUser;
  let accountant: TestUser;
  let client: TestUser & { clientId: string };
  let caseId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    superAdmin = await makeUser("SUPER_ADMIN", "k7super");
    admin = await makeUser("ADMIN", "k7admin");
    accountant = await makeUser("ACCOUNTANT", "k7acc");
    client = await makeClient("k7client");
    const { col } = await import("../../src/db/mongo");
    await col("users").updateOne(
      { id: client.id },
      { $set: { phone: "07700900999", email: client.email } },
    );
    ({ caseId } = await activateClientService(client, "SELF_ASSESSMENT"));
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it("S2 clients list masks contacts for ADMIN; SUPER_ADMIN sees full; ACCOUNTANT blocked", async () => {
    const asAdmin = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({ search: "" })
      .expect(200);
    const adminRow = asAdmin.body.data.clients.find((c: { id: string }) => c.id === client.id);
    expect(adminRow).toBeTruthy();
    expect(adminRow.contactMasked).toBe(true);
    expect(String(adminRow.email)).toContain("***");
    expect(JSON.stringify(asAdmin.body)).not.toContain(client.email);
    expect(JSON.stringify(asAdmin.body)).not.toContain("07700900999");

    const asSuper = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(superAdmin))
      .send({})
      .expect(200);
    const superRow = asSuper.body.data.clients.find((c: { id: string }) => c.id === client.id);
    expect(superRow.email).toBe(client.email);
    expect(superRow.contactMasked).toBeFalsy();

    await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(accountant))
      .send({})
      .expect(403);
  });

  it("reveal-contact is SUPER_ADMIN only", async () => {
    await request(app)
      .post(`/api/compat/admin/clients/${client.id}/reveal-contact`)
      .set(bearer(admin))
      .send({ reason: "checking" })
      .expect(403);
    await request(app)
      .post(`/api/compat/admin/clients/${client.id}/reveal-contact`)
      .set(bearer(accountant))
      .send({ reason: "checking" })
      .expect(403);
    const revealed = await request(app)
      .post(`/api/compat/admin/clients/${client.id}/reveal-contact`)
      .set(bearer(superAdmin))
      .send({ reason: "compliance review" })
      .expect(200);
    expect(revealed.body.data.email).toBe(client.email);
  });

  it("S2 accountants list works for ADMIN; create/status require SUPER_ADMIN", async () => {
    const list = await request(app)
      .post("/api/compat/admin/accountants")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(list.body.data.accountants.some((a: { id: string }) => a.id === accountant.id)).toBe(
      true,
    );

    await request(app)
      .post("/api/compat/admin/accountants/create")
      .set(bearer(admin))
      .send({ name: "New Acc", email: `newacc.${Date.now()}@example.com` })
      .expect(403);

    const created = await request(app)
      .post("/api/compat/admin/accountants/create")
      .set(bearer(superAdmin))
      .send({ name: "Invited Acc", email: `invite.${Date.now()}@example.com`, role: "ACCOUNTANT" })
      .expect(201);
    expect(created.body.data.inviteId).toBeTruthy();
    expect(created.body.data.userId).toBeTruthy();
  });

  it("S3 dashboard stats for admin and accountant", async () => {
    const adminStats = await request(app)
      .post("/api/compat/admin/dashboard/stats")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(adminStats.body.data.totalClients).toBeGreaterThanOrEqual(1);
    expect(adminStats.body.data.totalAccountants).toBeGreaterThanOrEqual(1);

    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);

    const accStats = await request(app)
      .post("/api/compat/accountant/dashboard/stats")
      .set(bearer(accountant))
      .send({})
      .expect(200);
    expect(accStats.body.data.totalOngoingTaxReturns).toBeGreaterThanOrEqual(1);
  });

  it("S4 payments list includes transactions; stats/export deferred", async () => {
    const { col } = await import("../../src/db/mongo");
    const { randomUUID } = await import("crypto");
    const { nowIso } = await import("../../src/domain/workflow");
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      kind: "ADDITIONAL_WORK",
      payment_status: "paid",
      amount: 50,
      currency: "gbp",
      client_id: client.clientId,
      case_id: caseId,
      created_at: nowIso(),
    });
    await col("payment_transactions").insertOne({
      id: randomUUID(),
      kind: "SERVICE_ACTIVATION",
      payment_status: "paid",
      amount: 119,
      currency: "gbp",
      client_id: client.clientId,
      case_id: caseId,
      created_at: nowIso(),
    });

    const list = await request(app)
      .get("/api/compat/admin/payments")
      .set(bearer(admin))
      .expect(200);
    const kinds = list.body.data.payments.map((p: { kind: string }) => p.kind);
    expect(kinds).toContain("ADDITIONAL_WORK");
    expect(kinds).toContain("SERVICE_ACTIVATION");

    await request(app).get("/api/compat/admin/payments/stats").set(bearer(admin)).expect(405);
    await request(app).get("/api/compat/admin/payments/export").set(bearer(admin)).expect(405);
  });

  it("S5 FAQ create/list/soft-delete", async () => {
    const created = await request(app)
      .post("/api/compat/admin/faqs/create")
      .set(bearer(admin))
      .send({ question: "K7 Q?", answer: "K7 A", category: "General" })
      .expect(201);
    const faqId = created.body.data.id;
    const list = await request(app)
      .post("/api/compat/admin/faqs")
      .set(bearer(admin))
      .send({ page: 1, limit: 50 })
      .expect(200);
    expect(list.body.data.faqs.some((f: { id: string }) => f.id === faqId)).toBe(true);
    await request(app)
      .delete(`/api/compat/admin/faqs/delete/${faqId}`)
      .set(bearer(admin))
      .expect(200);
  });

  it("assign with deadline + tax-return files + review path aliases", async () => {
    const files = await request(app)
      .post("/api/compat/admin/tax-return/files")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(files.body.data.files.some((f: { id: string }) => f.id === caseId)).toBe(true);

    const assigned = await request(app)
      .post("/api/compat/admin/assign")
      .set(bearer(superAdmin))
      .send({
        taxReturnId: caseId,
        accountantId: accountant.id,
        deadline: "2030-01-15T00:00:00.000Z",
        priority: "HIGH",
      })
      .expect(200);
    expect(assigned.body.data.taxReturnId).toBe(caseId);

    const review = await request(app)
      .post(`/api/compat/admin/get-review/${caseId}`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(review.body.data.case.taxReturnId).toBe(caseId);

    await request(app)
      .post(`/api/compat/admin/manage-review/${caseId}`)
      .set(bearer(admin))
      .send({ action: "approve" })
      .expect(400); // not in ADMIN_APPROVED-capable status yet — whitelist rejection
  });

  it("S6 CMS-style paths are HIDE (405); ACCOUNTANT cannot admin-approve", async () => {
    await request(app).get("/api/compat/admin/tax-rates").set(bearer(admin)).expect(405);
    await request(app).get("/api/compat/admin/yearly-metrics").set(bearer(admin)).expect(405);
    await request(app)
      .post("/api/compat/admin/manage-review")
      .set(bearer(accountant))
      .send({ taxReturnId: caseId, action: "approve" })
      .expect(403);
  });
});
