/**
 * Registration / verification regression protection (video-proven happy path).
 */
import { randomUUID } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootTestApp, dropTestDb } from "../helpers/app";
import { FakePaymentProvider } from "../helpers/payments";

describe("Registration / verification regression protection", () => {
  let app: Express;
  let provider: FakePaymentProvider;

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("register → duplicate rejected → verify email → verified login; zero cases; unverified checkout blocked", async () => {
    const email = `reg-regress.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email, password, name: "Regress Client", phone: "07700900111" })
      .expect(200);
    expect(reg.body.user.email_verified_at).toBeNull();
    expect(reg.body.access_token).toBeTypeOf("string");

    await request(app)
      .post("/api/auth/register")
      .send({ email, password, name: "Dup" })
      .expect(400);

    const { col } = await import("../../src/db/mongo");
    const client = await col("clients").findOne({ email });
    expect(client).toBeTruthy();
    expect(await col("cases").countDocuments({ client_id: client!.id })).toBe(0);
    const verifyTok = await col("email_verify_tokens").findOne({ email });
    expect(verifyTok).toBeTruthy();

    const resend = await request(app)
      .post("/api/compat/auth/re-verify-email")
      .send({ email })
      .expect(200);
    expect(resend.body.success).toBe(true);

    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    expect(issued.token).toBeTruthy();

    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);

    const after = await col("users").findOne({ email });
    expect(after?.email_verified_at).toBeTruthy();
    expect(await col("cases").countDocuments({ client_id: client!.id })).toBe(0);

    // Reused / invalid token rejected
    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect((res) => {
        expect([400, 401, 404, 410]).toContain(res.status);
      });
    await request(app)
      .post(`/api/auth/verify-email?token=${encodeURIComponent("not-a-real-token")}`)
      .expect((res) => {
        expect([400, 401, 404, 410]).toContain(res.status);
      });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.access_token).toBeTypeOf("string");
    expect(login.body.user.email_verified_at).toBeTruthy();

    // Unverified checkout rejection
    const uvEmail = `unverified.${randomUUID().slice(0, 8)}@example.com`;
    const uv = await request(app)
      .post("/api/auth/register")
      .send({ email: uvEmail, password, name: "Unverified" })
      .expect(200);
    const beforeCheckouts = provider.checkouts.length;
    await request(app)
      .post("/api/payments/service-checkout")
      .set({ Authorization: `Bearer ${uv.body.access_token}` })
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SIMPLE",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(403);
    expect(provider.checkouts.length).toBe(beforeCheckouts);
    expect(await col("cases").countDocuments({ client_id: uv.body.user.id })).toBe(0);
  });
});
