/**
 * MTD dashboard UX — personalised name, soft overview, no SA leakage in identity APIs.
 */
import { randomUUID } from "crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("MTD dashboard UX — name + identity APIs", () => {
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

  it("registered first/last name round-trip via login and get-account-details", async () => {
    const email = `mtd-name.${randomUUID().slice(0, 8)}@example.com`;
    const password = "Tr0ubl3-Kettle-Marsh";

    const reg = await request(app)
      .post("/api/compat/auth/register")
      .send({
        email,
        password,
        name: "Amara",
        surname: "Boateng",
        mobile: "07700900111",
        userRole: "MTD",
      })
      .expect(200);

    expect(reg.body.data.user.firstName).toBe("Amara");
    expect(reg.body.data.user.lastName).toBe("Boateng");
    expect(reg.body.data.user.name).toContain("Amara");
    expect(String(reg.body.data.user.firstName).toLowerCase()).not.toBe("client");
    expect(String(reg.body.data.user.firstName).toLowerCase()).not.toBe("mtd user");

    const { col } = await import("../../src/db/mongo");
    const { issueEmailVerification } = await import("../../src/services/emailVerification");
    const user = await col("users").findOne({ email });
    const issued = await issueEmailVerification(user!);
    await request(app)
      .post(`/api/compat/auth/verify-email?token=${encodeURIComponent(issued.token)}`)
      .expect(200);

    const login = await request(app)
      .post("/api/compat/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.data.user.firstName).toBe("Amara");
    expect(login.body.data.user.lastName).toBe("Boateng");
    expect(login.body.data.onboardingIntent).toBe("MTD_INCOME_TAX");

    const details = await request(app)
      .post("/api/compat/auth/get-account-details")
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` })
      .expect(200);
    expect(details.body.data.firstName).toBe("Amara");
    expect(details.body.data.lastName).toBe("Boateng");
    expect(details.body.data.name).toMatch(/Amara/);
  });

  it("ACTIVE MTD without case returns soft dashboard overview with package name", async () => {
    const client = await makeClient("mtd-soft-overview");
    const { activateService } = await import("../../src/domain/packages");
    const { col } = await import("../../src/db/mongo");
    const clientDoc = await col("clients").findOne({ id: client.clientId });
    const userDoc = await col("users").findOne({ id: client.id });
    await activateService(clientDoc!, userDoc!, "MTD_INCOME_TAX", "MTD_GROWTH", {
      reason: "test",
    });

    const overview = await request(app)
      .get("/api/compat/mtd/dashboard-overview")
      .set(bearer(client))
      .expect(200);
    expect(overview.body.data.entitlementOnly).toBe(true);
    expect(overview.body.data.packageCode).toBe("MTD_GROWTH");
    expect(String(overview.body.data.packageName)).toMatch(/Growth/i);
    expect(overview.body.data.taxReturn).toBeNull();
    expect(String(overview.body.data.nextAction)).toMatch(/accountant/i);
  });

  it("MTD catalogue remains Simbian-only; SA catalogue unchanged", async () => {
    const mtd = await request(app)
      .get("/api/compat/subscription-plans?category=mtd")
      .expect(200);
    const mtdRows = mtd.body.data as { code: string; price: number; name: string }[];
    expect(mtdRows.map((p) => p.code)).toEqual(["MTD_COMPLY", "MTD_GROWTH", "MTD_ELITE"]);
    expect(mtdRows.every((p) => !["SIMPLE", "SMART", "ELITE"].includes(p.code))).toBe(true);
    expect(mtdRows.find((p) => p.code === "MTD_COMPLY")!.price).toBe(29.99);
    expect(mtdRows.find((p) => p.code === "MTD_GROWTH")!.price).toBe(59.99);
    expect(mtdRows.find((p) => p.code === "MTD_ELITE")!.price).toBe(89.99);
    expect(mtdRows.every((p) => /Simbian|Comply|Growth|Elite/i.test(p.name))).toBe(true);

    const sa = await request(app)
      .get("/api/compat/subscription-plans?category=taxSimba")
      .expect(200);
    const saRows = sa.body.data as { code: string; price: number }[];
    expect(saRows.map((p) => p.code)).toEqual(["SIMPLE", "SMART", "ELITE"]);
    expect(saRows.find((p) => p.code === "SIMPLE")!.price).toBe(119);
  });
});
