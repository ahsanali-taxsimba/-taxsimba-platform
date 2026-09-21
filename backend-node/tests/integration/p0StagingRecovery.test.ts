/**
 * Staging recovery contracts: public content compat, client lifecycle DTO,
 * founder package catalogue, profile photo upload, accountant status toast.
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

describe("P0 staging recovery (021–028 contracts)", () => {
  let app: Express;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let superAdmin: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    admin = await makeUser("ADMIN", "recadmin");
    superAdmin = await makeUser("SUPER_ADMIN", "recsuper");
  });

  afterAll(async () => {
    await dropTestDb();
  });

  it("TS-UAT-021: public content routes resolve without 404 (empty-safe)", async () => {
    const paths = [
      "/api/compat/faqs",
      "/api/compat/services",
      "/api/compat/categories",
      "/api/compat/blogs",
      "/api/compat/blogs?limit=3&type=TaxSimba",
      "/api/compat/resources/blogs?limit=3&type=TaxSimba",
      "/api/compat/resources/categories",
      "/api/compat/approved",
      "/api/compat/reviews/approved",
      "/api/compat/active",
      "/api/compat/tax-rates/active",
    ];
    for (const path of paths) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.body.success, path).toBe(true);
    }
    const reviewsPost = await request(app)
      .post("/api/compat/reviews/approved")
      .send({ page: 1, limit: 10 })
      .expect(200);
    expect(reviewsPost.body.success).toBe(true);
    expect(Array.isArray(reviewsPost.body.data.reviews)).toBe(true);
  });

  it("TS-UAT-023/025: clients list exposes lifecycle consistent with emailVerified+isActive", async () => {
    const { col } = await import("../../src/db/mongo");
    const verified = await makeClient("recverified");
    await col("users").updateOne(
      { id: verified.id },
      { $set: { email_verified_at: new Date().toISOString(), is_active: true } },
    );
    const pending = await makeClient("recpending");
    await col("users").updateOne(
      { id: pending.id },
      { $set: { email_verified_at: null, is_active: true } },
    );
    const inactive = await makeClient("recinactive");
    await col("users").updateOne(
      { id: inactive.id },
      { $set: { email_verified_at: new Date().toISOString(), is_active: false } },
    );

    const res = await request(app)
      .post("/api/compat/admin/clients")
      .set(bearer(admin))
      .send({})
      .expect(200);

    const byId = Object.fromEntries(
      res.body.data.clients.map((c: { id: string }) => [c.id, c]),
    );
    expect(byId[verified.id].lifecycle).toBe("ACTIVE");
    expect(byId[verified.id].emailVerified).toBe(true);
    expect(byId[pending.id].lifecycle).toBe("PENDING_VERIFICATION");
    expect(byId[pending.id].emailVerified).toBe(false);
    expect(byId[inactive.id].lifecycle).toBe("INACTIVE");
    expect(byId[inactive.id].isActive).toBe(false);
  });

  it("TS-UAT-028: founder-approved catalogue prices on native + compat", async () => {
    const native = await request(app).get("/api/packages").set(bearer(superAdmin)).expect(200);
    const rows = Array.isArray(native.body) ? native.body : native.body.data ?? native.body.packages;
    const list = Array.isArray(rows) ? rows : [];
    const byCode = Object.fromEntries(list.map((p: { code: string }) => [p.code, p]));

    const expected: Record<string, number> = {
      SIMPLE: 119,
      SMART: 149,
      ELITE: 299,
      MTD_COMPLY: 29.99,
      MTD_GROWTH: 59.99,
      MTD_ELITE: 89.99,
    };
    for (const [code, price] of Object.entries(expected)) {
      expect(byCode[code], code).toBeTruthy();
      expect(Number(byCode[code].price)).toBe(price);
      expect(byCode[code].is_active !== false && byCode[code].isActive !== false).toBeTruthy();
    }

    const sa = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const saByCode = Object.fromEntries(sa.body.data.map((p: { code: string }) => [p.code, p]));
    expect(Number(saByCode.SIMPLE.price)).toBe(119);
    expect(Number(saByCode.SMART.price)).toBe(149);
    expect(Number(saByCode.ELITE.price)).toBe(299);

    const mtd = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const mtdByCode = Object.fromEntries(mtd.body.data.map((p: { code: string }) => [p.code, p]));
    expect(Number(mtdByCode.MTD_COMPLY.price)).toBe(29.99);
    expect(Number(mtdByCode.MTD_GROWTH.price)).toBe(59.99);
    expect(Number(mtdByCode.MTD_ELITE.price)).toBe(89.99);
    expect(mtdByCode.MTD_COMPLY.vatPercentage).toBe(20);
  });

  it("TS-UAT-022: profile photo upload stores via storage and is served", async () => {
    const accountant = await makeUser("ACCOUNTANT", "recphoto");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const upload = await request(app)
      .put("/api/compat/auth/update-account-settings")
      .set(bearer(accountant))
      .attach("profilePhoto", png, { filename: "avatar.png", contentType: "image/png" })
      .field("name", "Photo Acc")
      .field("mobile", "07700900999")
      .expect(200);

    expect(upload.body.success).toBe(true);
    expect(upload.body.data.profilePhoto).toBe(`auth/profile-photo/${accountant.id}`);

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set(bearer(accountant))
      .send({})
      .expect(200);
    expect(details.body.data.profilePhoto).toBe(`auth/profile-photo/${accountant.id}`);

    const served = await request(app)
      .get(`/api/compat/auth/profile-photo/${accountant.id}`)
      .set(bearer(accountant))
      .expect(200);
    expect(served.headers["content-type"]).toMatch(/image\/png/);
    expect(Buffer.isBuffer(served.body) || typeof served.body === "object").toBeTruthy();
  });

  it("TS-UAT-027: accountant status success message is meaningful", async () => {
    const accountant = await makeUser("ACCOUNTANT", "rectoast");
    const res = await request(app)
      .post(`/api/compat/admin/accountants/${accountant.id}/status`)
      .set(bearer(superAdmin))
      .send({ status: "inactive" })
      .expect(200);
    expect(String(res.body.message)).toMatch(/Accountant status updated successfully/i);
  });

  it("TS-UAT-018: native /api/packages resolves (not /api/compat/api/packages)", async () => {
    const ok = await request(app).get("/api/packages").set(bearer(superAdmin));
    expect(ok.status).not.toBe(404);
    const bad = await request(app).get("/api/compat/api/packages").set(bearer(superAdmin));
    expect(bad.status).toBe(404);
  });
});
