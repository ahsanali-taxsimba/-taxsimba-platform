/**
 * P0 UAT correction contracts: public catalogue, staff profile, FAQ status/delete,
 * accountant inactive auth, clients envelope.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  bearer,
  bootTestApp,
  dropTestDb,
  makeClient,
  makeUser,
} from "../helpers/app";

describe("P0 UAT corrections (013–020 contracts)", () => {
  let app: Express;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    admin = await makeUser("ADMIN", "p0admin");
    superAdmin = await makeUser("SUPER_ADMIN", "p0super");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("TS-UAT-013: GET subscription-plans is public (guest) and returns marketing catalogue only", async () => {
    const res = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const row = res.body.data[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("code");
    expect(row).toHaveProperty("name");
    expect(row).toHaveProperty("price");
    expect(row).toHaveProperty("category");
    // No internal mutation/admin-only fields on public catalogue
    expect(row.password_hash).toBeUndefined();
    expect(row.stripe_secret).toBeUndefined();
  });

  it("TS-UAT-015: admin clients list returns data.clients (not data.users)", async () => {
    const client = await makeClient("p0clients");
    const res = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(Array.isArray(res.body.data.clients)).toBe(true);
    expect(res.body.data.users).toBeUndefined();
    expect(res.body.data.clients.some((c: { id: string }) => c.id === client.id)).toBe(true);

    const stats = await request(app)
      .post("/api/compat/admin/dashboard/stats")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(stats.body.data.totalClients).toBe(res.body.data.clients.length);
  });

  it("TS-UAT-014: admin tax-return/files returns { files, taxReturns } object not bare array", async () => {
    const res = await request(app)
      .post("/api/compat/admin/tax-return/files")
      .set(bearer(admin))
      .send({})
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(false);
    expect(Array.isArray(res.body.data.files)).toBe(true);
    expect(Array.isArray(res.body.data.taxReturns)).toBe(true);
  });

  it("TS-UAT-016/020: staff profile persists phone+address; rejects empty body and absurd phone", async () => {
    const accountant = await makeUser("ACCOUNTANT", "p0profile");

    await request(app)
      .put("/api/compat/auth/update-account-settings")
      .set(bearer(accountant))
      .send({})
      .expect(400);

    await request(app)
      .put("/api/compat/auth/update-account-settings")
      .set(bearer(accountant))
      .send({ phone: "1".repeat(40) })
      .expect(400);

    const ok = await request(app)
      .put("/api/compat/auth/update-account-settings")
      .set(bearer(accountant))
      .send({
        name: "P0 Profile Acc",
        mobile: "07700900123",
        address: "1 Audit Street, London",
      })
      .expect(200);
    expect(ok.body.data.phone || ok.body.data.mobile).toMatch(/07700900123/);
    expect(ok.body.data.address).toBe("1 Audit Street, London");

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(accountant))
      .send({})
      .expect(200);
    expect(details.body.data.phone || details.body.data.mobile).toMatch(/07700900123/);
    expect(details.body.data.address).toBe("1 Audit Street, London");
  });

  it("TS-UAT-017: FAQ create is active; toggle isActive works; delete removes row", async () => {
    const created = await request(app)
      .post("/api/compat/admin/faqs/create")
      .set(bearer(admin))
      .send({ question: "P0 FAQ Q?", answer: "P0 FAQ A" })
      .expect(201);
    const faqId = created.body.data.id;
    expect(created.body.data.isActive ?? created.body.data.status).toBeTruthy();

    const toggled = await request(app)
      .put(`/api/compat/admin/faqs/${faqId}/status`)
      .set(bearer(admin))
      .send({ isActive: false, status: "inactive" })
      .expect(200);
    expect(toggled.body.data.isActive).toBe(false);

    const searched = await request(app)
      .post("/api/compat/admin/faqs")
      .set(bearer(admin))
      .send({ search: "P0 FAQ Q", page: 1, limit: 50 })
      .expect(200);
    const found = searched.body.data.faqs.find((f: { id: string }) => f.id === faqId);
    expect(found).toBeTruthy();
    expect(found.isActive === false || found.status === false).toBe(true);

    await request(app)
      .delete(`/api/compat/admin/faqs/delete/${faqId}`)
      .set(bearer(admin))
      .expect(200);

    const after = await request(app)
      .post("/api/compat/admin/faqs")
      .set(bearer(admin))
      .send({ page: 1, limit: 50 })
      .expect(200);
    expect(after.body.data.faqs.some((f: { id: string }) => f.id === faqId)).toBe(false);
  });

  it("TS-UAT-019: SUPER_ADMIN can deactivate accountant; inactive login denied; ADMIN gets 403", async () => {
    const { col } = await import("../../src/db/mongo");
    const { hashPassword } = await import("../../src/services/auth");
    const password = "Acc0untantPass!";
    const accountant = await makeUser("ACCOUNTANT", "p0inactive");
    await col("users").updateOne(
      { id: accountant.id },
      { $set: { password_hash: hashPassword(password) } },
    );

    await request(app)
      .post(`/api/compat/admin/accountants/${accountant.id}/status`)
      .set(bearer(admin))
      .send({ status: "inactive" })
      .expect(403);

    await request(app)
      .post(`/api/compat/admin/accountants/${accountant.id}/status`)
      .set(bearer(superAdmin))
      .send({ status: "inactive" })
      .expect(200);

    const fresh = await col("users").findOne({ id: accountant.id });
    expect(fresh?.is_active).toBe(false);

    await request(app)
      .post("/api/compat/auth/login")
      .send({ email: accountant.email, password })
      .expect(401);

    // Bearer for inactive user must also fail on protected routes
    await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(accountant))
      .send({})
      .expect(401);

    await request(app)
      .post(`/api/compat/admin/accountants/${accountant.id}/status`)
      .set(bearer(superAdmin))
      .send({ status: "active" })
      .expect(200);

    await request(app)
      .post("/api/compat/auth/login")
      .send({ email: accountant.email, password })
      .expect(200);
  });
});
