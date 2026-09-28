/**
 * SA Start Now / Basic Details — tax-return-type catalogue + apply idempotency.
 * Regression for empty Type of Tax Return dropdown after Smart purchase.
 */
import { randomUUID } from "crypto";
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
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

describe("SA tax-return-type dropdown + apply after Smart purchase", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let admin: Awaited<ReturnType<typeof makeUser>>;

  function webhook(type: string, object: Record<string, unknown>) {
    return request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));
  }

  async function buySmart(client: Awaited<ReturnType<typeof makeClient>>): Promise<string> {
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SMART",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const paid = provider.pay(res.body.session_id);
    await webhook("checkout.session.completed", {
      id: res.body.session_id,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
    return res.body.session_id as string;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    await ensurePhase1bData();
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    admin = await makeUser("ADMIN", "satypedropadmin");
  }, 60000);

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  it("returns a non-empty SA tax-return-type list after Smart entitlement (Bearer auth)", async () => {
    const client = await makeClient("satypeok", { emailVerified: true });
    await buySmart(client);

    const res = await request(app)
      .post("/api/compat/client/tax-return-type")
      .set(bearer(client))
      .send({ limit: 100, page: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
    const types = res.body.data.taxReturnTypes as Array<{
      id: string;
      typeCode: string;
      typeName: string;
      serviceType: string;
    }>;
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(types.every((t) => t.id && t.typeName)).toBe(true);
    expect(types.some((t) => t.typeCode === "SA")).toBe(true);
    // SA-only entitlement must not offer MTD as the only/sole path — SA must remain selectable.
    expect(types.some((t) => t.serviceType === "SELF_ASSESSMENT" || t.typeCode === "SA")).toBe(
      true,
    );
  });

  it("still returns SA types when packages collection is empty (catalogue fallback)", async () => {
    const client = await makeClient("satypeempty", { emailVerified: true });
    await buySmart(client);
    const { col } = await import("../../src/db/mongo");
    // Simulate staging catalogue wipe without reconcile — dropdown must not go blank.
    await col("packages").deleteMany({});

    const res = await request(app)
      .post("/api/compat/client/tax-return-type")
      .set(bearer(client))
      .send({ limit: 100 })
      .expect(200);

    const types = res.body.data.taxReturnTypes as Array<{ typeCode: string; id: string }>;
    expect(types.length).toBeGreaterThanOrEqual(1);
    expect(types.some((t) => t.typeCode === "SA")).toBe(true);

    // Restore catalogue for later tests in this file.
    const { reconcilePackageCatalogue } = await import("../../src/domain/packages");
    await reconcilePackageCatalogue();
  });

  it("rejects tax-return-type without Bearer (explains empty FE dropdown)", async () => {
    const client = await makeClient("satypenobearer", { emailVerified: true });
    await buySmart(client);
    // Raw JWT without Bearer prefix — matches the buggy FE Authorization header.
    const res = await request(app)
      .post("/api/compat/client/tax-return-type")
      .set("Authorization", client.token)
      .send({ limit: 100 });
    expect(res.status).toBe(401);
  });

  it("apply-tax-return creates exactly one SA case; retry is idempotent; admin can see it", async () => {
    const client = await makeClient("saapplycase", { emailVerified: true });
    // Missing UTR must not block.
    const { col } = await import("../../src/db/mongo");
    await col("clients").updateOne({ id: client.clientId }, { $set: { utr: null } });

    await buySmart(client);

    const services = await col("client_services")
      .find({ client_id: client.clientId, service_type: "SELF_ASSESSMENT", status: "ACTIVE" })
      .toArray();
    expect(services).toHaveLength(1);

    const types = (
      await request(app)
        .post("/api/compat/client/tax-return-type")
        .set(bearer(client))
        .send({})
        .expect(200)
    ).body.data.taxReturnTypes as Array<{ id: string; typeCode: string }>;
    const saType = types.find((t) => t.typeCode === "SA");
    expect(saType).toBeTruthy();

    const first = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("taxReturnTypeId", saType!.id)
      .field("financialYear", "2025-2026")
      .field("taxYear", "2025/26")
      .field("serviceType", "SELF_ASSESSMENT")
      .expect(201);

    const caseId = first.body.data.taxReturn.id as string;
    expect(caseId).toBeTruthy();
    expect(first.body.data.createdFromApplication).toBe(true);

    const second = await request(app)
      .post("/api/compat/client/apply-tax-return")
      .set(bearer(client))
      .field("taxReturnTypeId", saType!.id)
      .field("financialYear", "2025-2026")
      .field("taxYear", "2025/26")
      .expect(201);

    expect(second.body.data.taxReturn.id).toBe(caseId);
    expect(second.body.data.preferredExisting).toBe(true);

    expect(await col("cases").countDocuments({ client_user_id: client.id })).toBe(1);
    expect(await col("cases").countDocuments({ client_id: client.clientId })).toBe(1);

    const list = await request(app)
      .post("/api/compat/client/all-tax-returns")
      .set(bearer(client))
      .send({})
      .expect(200);
    const clientCases = Array.isArray(list.body.data) ? list.body.data : [];
    expect(clientCases.some((c: { id: string }) => c.id === caseId)).toBe(true);

    const adminList = await request(app)
      .get("/api/cases")
      .set(bearer(admin))
      .expect(200);
    const rows = Array.isArray(adminList.body) ? adminList.body : adminList.body?.items ?? [];
    expect(rows.some((c: { id: string }) => c.id === caseId)).toBe(true);
  });

  it("webhook fulfil retry does not duplicate SMART entitlement", async () => {
    const client = await makeClient(`saidem${randomUUID().slice(0, 6)}`, { emailVerified: true });
    const checkout = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: "SMART",
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const paid = provider.pay(checkout.body.session_id);
    const payload = {
      id: checkout.body.session_id,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    };
    await webhook("checkout.session.completed", payload).expect(200);
    await webhook("checkout.session.completed", payload).expect(200);

    const { col } = await import("../../src/db/mongo");
    const entitlements = await col("client_services")
      .find({
        client_id: client.clientId,
        service_type: "SELF_ASSESSMENT",
        status: "ACTIVE",
      })
      .toArray();
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].package_code).toBe("SMART");
    expect(await col("cases").countDocuments({ client_user_id: client.id })).toBe(0);
  });
});
