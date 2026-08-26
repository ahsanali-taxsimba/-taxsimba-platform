/**
 * Pre-merge security gate: privilege escalation, IDOR, document scoping, token handling,
 * injection-shaped payloads, response leakage and protected configuration. Runs against a
 * disposable database like every other suite.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";

const PDF = Buffer.from("%PDF-1.4 security gate\n");

describe("security gate", () => {
  let app: Express;
  let superAdmin: TestUser;
  let admin: TestUser;
  let accountant: TestUser;
  let otherAccountant: TestUser;
  let client: TestUser & { clientId: string };
  let intruder: TestUser & { clientId: string };
  let caseId: string;
  let documentId: string;
  let taskId: string;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    superAdmin = await makeUser("SUPER_ADMIN");
    admin = await makeUser("ADMIN");
    accountant = await makeUser("ACCOUNTANT", "accountant-owner");
    otherAccountant = await makeUser("ACCOUNTANT", "accountant-stranger");
    client = await makeClient("client-owner");
    intruder = await makeClient("client-intruder");

    caseId = (
      await request(app)
        .post("/api/cases")
        .set(bearer(client))
        .send({ tax_year: "2024/25" })
        .expect(200)
    ).body.id;
    await request(app)
      .post(`/api/cases/${caseId}/assign`)
      .set(bearer(admin))
      .send({ accountant_id: accountant.id })
      .expect(200);
    await request(app).post(`/api/cases/${caseId}/start-review`).set(bearer(accountant)).expect(200);
    taskId = (
      await request(app)
        .post(`/api/cases/${caseId}/request-from-client`)
        .set(bearer(accountant))
        .send({ title: "Send your P60", document_type: "P60" })
        .expect(200)
    ).body.task_id;
    documentId = (
      await request(app)
        .post("/api/documents/upload")
        .set(bearer(client))
        .field("case_id", caseId)
        .field("document_type", "P60")
        .attach("file", PDF, { filename: "p60.pdf", contentType: "application/pdf" })
        .expect(200)
    ).body.id;
  });

  afterAll(async () => {
    await dropTestDb();
  });

  // -------------------------------------------------------------- token handling
  it("refuses expired, tampered and unsigned tokens", async () => {
    const { sign } = await import("jsonwebtoken");
    const expired = sign(
      { sub: client.id, email: client.email, type: "access", exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET as string,
    );
    const foreignKey = sign({ sub: client.id, email: client.email, type: "access" }, "not-our-secret");
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: client.id, type: "access" }),
    ).toString("base64url")}.`;

    for (const token of [expired, foreignKey, unsigned, "not-a-token"]) {
      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(String(res.body.detail)).not.toMatch(/jwt|signature|malformed/i);
    }
  });

  it("refuses a deactivated user's still-valid token", async () => {
    const victim = await makeUser("ACCOUNTANT", "deactivated");
    await request(app)
      .patch(`/api/users/${victim.id}/active?is_active=false`)
      .set(bearer(superAdmin))
      .expect(200);
    await request(app).get("/api/auth/me").set(bearer(victim)).expect(401);
  });

  // ------------------------------------------------------- privilege escalation
  it("refuses role escalation and staff-only administration to a client", async () => {
    await request(app)
      .post("/api/users")
      .set(bearer(client))
      .send({ email: "evil@example.com", name: "Evil", role: "SUPER_ADMIN" })
      .expect(403);
    await request(app).get("/api/users").set(bearer(client)).expect(403);
    await request(app).get("/api/users").set(bearer(accountant)).expect(403);
    await request(app).get("/api/audit-log").set(bearer(client)).expect(403);
    await request(app).get("/api/overview").set(bearer(accountant)).expect(403);
    await request(app)
      .post("/api/staff-invites")
      .set(bearer(admin))
      .send({ email: "evil-staff@example.com", name: "Evil", role: "SUPER_ADMIN" })
      .expect(403);
  });

  it("ignores a role field smuggled into registration and profile updates", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `escalate.${Date.now()}@example.com`,
        password: "Tr0ubl3-Kettle-Marsh",
        name: "Escalate",
        phone: "07700900123",
        role: "SUPER_ADMIN",
      })
      .expect(200);
    expect(res.body.user.role).toBe("CLIENT");

    await request(app)
      .patch("/api/my-profile")
      .set(bearer(client))
      .send({ role: "ADMIN", email: "hijack@example.com" })
      .expect((r) => expect([200, 422]).toContain(r.status));
    const me = await request(app).get("/api/auth/me").set(bearer(client)).expect(200);
    expect(me.body.role).toBe("CLIENT");
    expect(me.body.email).toBe(client.email);
  });

  // ------------------------------------------------------------------- IDOR
  it("refuses another client's case, tasks, calculation and submission", async () => {
    await request(app).get(`/api/cases/${caseId}`).set(bearer(intruder)).expect(403);
    await request(app)
      .post(`/api/cases/${caseId}/client-approve`)
      .set(bearer(intruder))
      .send({})
      .expect(403);
    await request(app)
      .post(`/api/tasks/${taskId}/complete`)
      .set(bearer(intruder))
      .send({})
      .expect((r) => expect([403, 404]).toContain(r.status));
    const tasks = await request(app).get("/api/tasks").set(bearer(intruder)).expect(200);
    expect(tasks.body).toEqual([]);
    const cases = await request(app).get("/api/cases").set(bearer(intruder)).expect(200);
    expect(cases.body.map((c: { id: string }) => c.id)).not.toContain(caseId);
  });

  it("refuses an unassigned accountant and keeps client lists owner-scoped", async () => {
    await request(app).get(`/api/cases/${caseId}`).set(bearer(otherAccountant)).expect(403);
    await request(app)
      .post(`/api/cases/${caseId}/calculations`)
      .set(bearer(otherAccountant))
      .send({ total_income: 1000, taxable_income: 500, tax_due: 100, is_refund: false })
      .expect(403);
    const workload = await request(app)
      .get("/api/cases")
      .set(bearer(otherAccountant))
      .expect(200);
    expect(workload.body.map((c: { id: string }) => c.id)).not.toContain(caseId);
  });

  it("refuses another client's MTD period and figures", async () => {
    const mtdCase = (
      await request(app)
        .post("/api/cases")
        .set(bearer(client))
        .send({ tax_year: "2026/27", service_type: "MTD_INCOME_TAX" })
        .expect(200)
    ).body;
    await request(app)
      .post(`/api/mtd/cases/${mtdCase.id}/generate-periods`)
      .set(bearer(admin))
      .send({})
      .expect(200);
    const periods = (
      await request(app).get(`/api/mtd/cases/${mtdCase.id}/periods`).set(bearer(admin)).expect(200)
    ).body;
    expect(periods.length).toBe(5);

    await request(app)
      .get(`/api/mtd/cases/${mtdCase.id}/periods`)
      .set(bearer(intruder))
      .expect(403);
    await request(app)
      .post(`/api/mtd/periods/${periods[0].id}/figures`)
      .set(bearer(intruder))
      .send({ income: 1, expenses: 0 })
      .expect(403);
    await request(app)
      .post(`/api/mtd/periods/${periods[0].id}/figures`)
      .set(bearer(otherAccountant))
      .send({ income: 1, expenses: 0 })
      .expect(403);
    await request(app)
      .get(`/api/mtd/periods/${periods[0].id}/documents`)
      .set(bearer(intruder))
      .expect(403);
  });

  it("refuses reading or writing another client's messages", async () => {
    await request(app)
      .post("/api/messages")
      .set(bearer(client))
      .send({ case_id: caseId, body: "Private message" })
      .expect(200);
    const mine = await request(app)
      .get(`/api/messages?case_id=${caseId}`)
      .set(bearer(client))
      .expect(200);
    expect(mine.body.length).toBeGreaterThan(0);
    await request(app)
      .get(`/api/messages?case_id=${caseId}`)
      .set(bearer(intruder))
      .expect(403);
    await request(app)
      .post("/api/messages")
      .set(bearer(intruder))
      .send({ case_id: caseId, body: "Injected" })
      .expect(403);
  });

  // ------------------------------------------------------------- documents
  it("keeps document listing scoped and refuses unscoped retrieval", async () => {
    await request(app).get("/api/documents").set(bearer(admin)).expect(400);
    await request(app).get("/api/documents").set(bearer(superAdmin)).expect(400);

    const own = await request(app)
      .get("/api/documents?service_type=SELF_ASSESSMENT")
      .set(bearer(client))
      .expect(200);
    expect(own.body.some((d: { id: string }) => d.id === documentId)).toBe(true);

    const foreign = await request(app)
      .get("/api/documents?service_type=SELF_ASSESSMENT")
      .set(bearer(intruder))
      .expect(200);
    expect(foreign.body.some((d: { id: string }) => d.id === documentId)).toBe(false);

    await request(app).get(`/api/documents?case_id=${caseId}`).set(bearer(intruder)).expect(403);
    await request(app)
      .get(`/api/documents?case_id=${caseId}`)
      .set(bearer(otherAccountant))
      .expect(403);
  });

  it("refuses another user's download and status change", async () => {
    await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set(bearer(intruder))
      .expect(403);
    await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set(bearer(otherAccountant))
      .expect(403);
    await request(app)
      .patch(`/api/documents/${documentId}/status`)
      .set(bearer(client))
      .send({ status: "Approved" })
      .expect(403);
    const ok = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set(bearer(accountant))
      .expect(200);
    expect(ok.body.url ?? ok.headers["content-type"]).toBeTruthy();
  });

  it("refuses a client uploading against a case they do not own", async () => {
    await request(app)
      .post("/api/documents/upload")
      .set(bearer(intruder))
      .field("case_id", caseId)
      .field("document_type", "P60")
      .attach("file", PDF, { filename: "evil.pdf", contentType: "application/pdf" })
      .expect(403);
  });

  // ------------------------------------------------------------- injection
  it("treats operator-shaped payloads as data, not query operators", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: { $ne: null }, password: { $ne: null } })
      .expect((r) => expect([401, 422]).toContain(r.status));
    await request(app)
      .post("/api/auth/login")
      .send({ email: client.email, password: { $gt: "" } })
      .expect((r) => expect([401, 422]).toContain(r.status));

    const byOperator = await request(app)
      .get("/api/documents?service_type[$ne]=NOPE")
      .set(bearer(client));
    expect([200, 400, 422]).toContain(byOperator.status);
    if (byOperator.status === 200) expect(Array.isArray(byOperator.body)).toBe(true);

    await request(app).get(`/api/cases/${"../" + caseId}`).set(bearer(client)).expect(404);
    await request(app)
      .get("/api/cases/%7B%22%24ne%22%3Anull%7D")
      .set(bearer(client))
      .expect((r) => expect([403, 404]).toContain(r.status));
  });

  it("rejects malformed bodies without leaking internals", async () => {
    const bad = await request(app)
      .post("/api/cases")
      .set(bearer(client))
      .set("Content-Type", "application/json")
      .send('{"tax_year": ');
    expect([400, 422]).toContain(bad.status);
    expect(JSON.stringify(bad.body)).not.toMatch(/at Object\.|node_modules|\/src\//);

    const huge = await request(app)
      .post("/api/messages")
      .set(bearer(client))
      .send({ case_id: caseId, body: "a".repeat(200000) });
    expect([200, 400, 413, 422]).toContain(huge.status);
  });

  // --------------------------------------------------------------- leakage
  it("never returns credential material or internals", async () => {
    const users = await request(app).get("/api/users").set(bearer(superAdmin)).expect(200);
    const serialised = JSON.stringify(users.body);
    for (const field of ["password_hash", "totp_secret", "mfa_secret", "refresh_token"]) {
      expect(serialised).not.toContain(field);
    }
    const me = await request(app).get("/api/auth/me").set(bearer(client)).expect(200);
    expect(me.body.password_hash).toBeUndefined();

    const notFound = await request(app)
      .get("/api/cases/00000000-0000-0000-0000-000000000000")
      .set(bearer(client));
    expect([403, 404]).toContain(notFound.status);
    expect(Object.keys(notFound.body)).toEqual(["detail"]);
    expect(JSON.stringify(notFound.body)).not.toMatch(/Mongo|stack|\/src\//);
  });

  // ------------------------------------------- protected configuration (RBAC)
  it("lets only a super admin change pricing, schedules and wording", async () => {
    const pkg = (
      await request(app)
        .get("/api/packages?service_type=SELF_ASSESSMENT")
        .set(bearer(admin))
        .expect(200)
    ).body[0];
    const future = new Date(Date.now() + 86400000).toISOString();

    for (const actor of [client, accountant, admin]) {
      await request(app)
        .patch(`/api/packages/${pkg.id}/price`)
        .set(bearer(actor))
        .send({ price: 1 })
        .expect(403);
      await request(app)
        .post(`/api/packages/${pkg.id}/price-schedule`)
        .set(bearer(actor))
        .send({ price: 1, effective_from: future })
        .expect(403);
      await request(app)
        .put("/api/content/client.help.subtitle")
        .set(bearer(actor))
        .send({ value: "Changed by the wrong role" })
        .expect(403);
      await request(app)
        .delete("/api/content/client.help.subtitle")
        .set(bearer(actor))
        .expect(403);
      await request(app).get("/api/content/settings").set(bearer(actor)).expect(403);
    }

    // The read side stays open to authenticated users so the frontend can render wording.
    const effective = await request(app).get("/api/content").set(bearer(client)).expect(200);
    expect(effective.body["client.help.subtitle"]).toBe("How can we help?");
  });

  it("keeps technical and workflow strings outside the editable allow-list", async () => {
    for (const key of [
      "error.invalid_credentials",
      "error.not_authenticated",
      "status.SUBMITTED",
      "permission.admin_only",
      "api.detail",
      "audit.entry",
    ]) {
      await request(app)
        .put(`/api/content/${key}`)
        .set(bearer(superAdmin))
        .send({ value: "anything" })
        .expect(404);
    }
    const map = await request(app).get("/api/content").set(bearer(client)).expect(200);
    expect(Object.keys(map.body).every((k) => k.startsWith("client.") || k.startsWith("package."))).toBe(
      true,
    );
  });
});
