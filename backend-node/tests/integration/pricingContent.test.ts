/** Date-effective package pricing and the allow-listed customer-facing content layer. */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser, TestUser } from "../helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../helpers/payments";

type Client = TestUser & { clientId: string };

const HOUR = 3600 * 1000;

describe("scheduled pricing and configurable content", () => {
  let app: Express;
  let provider: FakePaymentProvider;
  let superAdmin: TestUser;
  let admin: TestUser;

  async function saPackage(code: string) {
    const res = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    return res.body.find((p: { code: string }) => p.code === code) as { id: string; price: number };
  }

  async function buy(client: Client, packageCode: string): Promise<void> {
    const res = await request(app)
      .post("/api/payments/service-checkout")
      .set(bearer(client))
      .send({
        service_type: "SELF_ASSESSMENT",
        package_code: packageCode,
        origin_url: "https://app.test.taxsimba.local",
      })
      .expect(200);
    const paid = provider.pay(res.body.session_id);
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          type: "checkout.session.completed",
          object: {
            id: res.body.session_id,
            payment_status: paid.payment_status,
            payment_intent: paid.payment_intent,
          },
        }),
      )
      .expect(200);
  }

  async function agreedPrice(client: Client): Promise<number> {
    const res = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
    const sa = (res.body.services as Record<string, unknown>[]).find(
      (s) => s.service_type === "SELF_ASSESSMENT",
    );
    return sa?.agreed_price as number;
  }

  beforeAll(async () => {
    ({ app } = await bootTestApp());
    const { ensurePhase1bData } = await import("../../src/domain/packages");
    const { ensureContentIndexes, ensurePricingIndexes } = {
      ...(await import("../../src/domain/content")),
      ...(await import("../../src/domain/pricing")),
    };
    await ensurePhase1bData();
    await ensurePricingIndexes();
    await ensureContentIndexes();
    const { setPaymentProvider } = await import("../../src/services/payments");
    provider = new FakePaymentProvider();
    setPaymentProvider(provider);
    superAdmin = await makeUser("SUPER_ADMIN", "pricing-superadmin");
    admin = await makeUser("ADMIN", "pricing-admin");
  });

  afterAll(async () => {
    const { setPaymentProvider } = await import("../../src/services/payments");
    setPaymentProvider(null);
    await dropTestDb();
  });

  // ------------------------------------------------------------------ pricing
  it("defers a future-dated price and applies it once the date passes", async () => {
    const pkg = await saPackage("SIMPLE");
    const original = pkg.price;
    const effectiveFrom = new Date(Date.now() + 2 * HOUR).toISOString();

    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(admin))
      .send({ price: 139, effective_from: effectiveFrom })
      .expect(403);

    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 139, effective_from: effectiveFrom })
      .expect(200);

    expect((await saPackage("SIMPLE")).price).toBe(original);
    const pending = await request(app)
      .get(`/api/packages/${pkg.id}/price-schedule`)
      .set(bearer(admin))
      .expect(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({ price: 139, status: "PENDING", previous_price: original });

    const { applyDuePriceSchedules } = await import("../../src/domain/pricing");
    expect(await applyDuePriceSchedules(new Date(Date.now() + HOUR))).toBe(0);
    expect((await saPackage("SIMPLE")).price).toBe(original);

    expect(await applyDuePriceSchedules(new Date(Date.now() + 3 * HOUR))).toBe(1);
    expect((await saPackage("SIMPLE")).price).toBe(139);
    // Re-running must not re-apply or duplicate the audit trail.
    expect(await applyDuePriceSchedules(new Date(Date.now() + 4 * HOUR))).toBe(0);

    const history = await request(app)
      .get(`/api/packages/${pkg.id}/price-history`)
      .set(bearer(admin))
      .expect(200);
    const scheduled = history.body.filter((h: { source?: string }) => h.source === "SCHEDULED");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({
      previous_price: original,
      new_price: 139,
      changed_by: superAdmin.name,
      role: "SUPER_ADMIN",
    });
  });

  it("charges new customers the current price before the date and the new price after", async () => {
    const pkg = await saPackage("SMART");
    const before = await makeClient("before-price");
    await buy(before, "SMART");
    expect(await agreedPrice(before)).toBe(pkg.price);

    await request(app)
      .post(`/api/packages/${pkg.id}/price-schedule`)
      .set(bearer(superAdmin))
      .send({ price: 179, effective_from: new Date(Date.now() + HOUR).toISOString() })
      .expect(200);

    // Still the old price while the change is pending.
    const during = await makeClient("during-price");
    await buy(during, "SMART");
    expect(await agreedPrice(during)).toBe(pkg.price);

    const { applyDuePriceSchedules } = await import("../../src/domain/pricing");
    await applyDuePriceSchedules(new Date(Date.now() + 2 * HOUR));

    const after = await makeClient("after-price");
    await buy(after, "SMART");
    expect(await agreedPrice(after)).toBe(179);

    // Existing customers are never repriced.
    expect(await agreedPrice(before)).toBe(pkg.price);
    expect(await agreedPrice(during)).toBe(pkg.price);
  });

  it("cancels a pending change and rejects invalid or past schedule dates", async () => {
    const pkg = await saPackage("ELITE");
    const created = await request(app)
      .post(`/api/packages/${pkg.id}/price-schedule`)
      .set(bearer(superAdmin))
      .send({ price: 299, effective_from: new Date(Date.now() + HOUR).toISOString() })
      .expect(200);

    await request(app)
      .delete(`/api/packages/${pkg.id}/price-schedule/${created.body.id}`)
      .set(bearer(admin))
      .expect(403);
    await request(app)
      .delete(`/api/packages/${pkg.id}/price-schedule/${created.body.id}`)
      .set(bearer(superAdmin))
      .expect(200);
    await request(app)
      .delete(`/api/packages/${pkg.id}/price-schedule/${created.body.id}`)
      .set(bearer(superAdmin))
      .expect(404);

    const { applyDuePriceSchedules } = await import("../../src/domain/pricing");
    await applyDuePriceSchedules(new Date(Date.now() + 2 * HOUR));
    expect((await saPackage("ELITE")).price).toBe(pkg.price);

    await request(app)
      .post(`/api/packages/${pkg.id}/price-schedule`)
      .set(bearer(superAdmin))
      .send({ price: 299, effective_from: "not-a-date" })
      .expect(400);
    await request(app)
      .post(`/api/packages/${pkg.id}/price-schedule`)
      .set(bearer(superAdmin))
      .send({ price: 299, effective_from: "2020-01-01T00:00:00.000Z" })
      .expect(400);
  });

  it("applies an immediate price change straight away, as before", async () => {
    const pkg = await saPackage("SIMPLE");
    await request(app)
      .patch(`/api/packages/${pkg.id}/price`)
      .set(bearer(superAdmin))
      .send({ price: 129 })
      .expect(200);
    expect((await saPackage("SIMPLE")).price).toBe(129);
  });

  // ------------------------------------------------------------------ content
  it("returns code defaults when nothing is configured", async () => {
    const { CONTENT_DEFAULTS } = await import("../../src/domain/content");
    const client = await makeClient("content-reader");
    const res = await request(app).get("/api/content").set(bearer(client)).expect(200);
    for (const [key, def] of Object.entries(CONTENT_DEFAULTS)) {
      expect(res.body[key]).toBe(def.value);
      // Screen wording always has a default; package marketing copy is opt-in and starts empty
      // so that adopting the keys cannot add text to the current UI.
      if (!key.startsWith("package.")) expect(String(res.body[key]).trim()).not.toBe("");
    }
    expect(res.body["package.SIMPLE.features"]).toBe("");
  });

  it("lets only a super admin edit wording, and audits every change", async () => {
    const key = "client.dashboard.up_to_date.body";
    const { CONTENT_DEFAULTS } = await import("../../src/domain/content");

    await request(app).put(`/api/content/${key}`).set(bearer(admin)).send({ value: "x" }).expect(403);

    await request(app)
      .put(`/api/content/${key}`)
      .set(bearer(superAdmin))
      .send({ value: "Here is everything we need from you this year." })
      .expect(200);

    const all = await request(app).get("/api/content").set(bearer(admin)).expect(200);
    expect(all.body[key]).toBe("Here is everything we need from you this year.");

    const settings = await request(app)
      .get("/api/content/settings")
      .set(bearer(superAdmin))
      .expect(200);
    const entry = settings.body.entries.find((e: { key: string }) => e.key === key);
    expect(entry).toMatchObject({
      is_overridden: true,
      default_value: CONTENT_DEFAULTS[key].value,
      group: "Client dashboard",
    });
    expect(settings.body.groups).toContain("Packages");

    const history = await request(app)
      .get(`/api/content/${key}/history`)
      .set(bearer(admin))
      .expect(200);
    expect(history.body[0]).toMatchObject({
      key,
      previous_value: CONTENT_DEFAULTS[key].value,
      new_value: "Here is everything we need from you this year.",
      changed_by: superAdmin.name,
      role: "SUPER_ADMIN",
    });

    // Resetting restores the default rather than blanking the screen.
    await request(app).delete(`/api/content/${key}`).set(bearer(superAdmin)).expect(200);
    const reset = await request(app).get("/api/content").set(bearer(admin)).expect(200);
    expect(reset.body[key]).toBe(CONTENT_DEFAULTS[key].value);
  });

  it("serves package marketing copy only when asked, and it is editable", async () => {
    const plain = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT")
      .set(bearer(admin))
      .expect(200);
    expect(plain.body[0]).not.toHaveProperty("description");

    await request(app)
      .put("/api/content/package.SIMPLE.features")
      .set(bearer(superAdmin))
      .send({ value: "Prepared by an accountant\nSecure upload" })
      .expect(200);

    const rich = await request(app)
      .get("/api/packages?service_type=SELF_ASSESSMENT&include_content=1")
      .set(bearer(admin))
      .expect(200);
    const simple = rich.body.find((p: { code: string }) => p.code === "SIMPLE");
    expect(simple.features).toEqual(["Prepared by an accountant", "Secure upload"]);
    // Unconfigured marketing copy stays absent rather than introducing new text.
    const elite = rich.body.find((p: { code: string }) => p.code === "ELITE");
    expect(elite.description).toBeNull();
    expect(elite.features).toEqual([]);
  });

  it("refuses unknown keys, technical strings, empty values and markup", async () => {
    for (const key of ["unknown.key", "error.invalid_credentials", "status.SUBMITTED"]) {
      await request(app)
        .put(`/api/content/${key}`)
        .set(bearer(superAdmin))
        .send({ value: "anything" })
        .expect(404);
    }
    await request(app)
      .put("/api/content/client.help.subtitle")
      .set(bearer(superAdmin))
      .send({ value: "   " })
      .expect(400);
    await request(app)
      .put("/api/content/client.help.subtitle")
      .set(bearer(superAdmin))
      .send({ value: "<script>alert(1)</script>" })
      .expect(400);
    await request(app)
      .put("/api/content/client.help.subtitle")
      .set(bearer(superAdmin))
      .send({ value: "a".repeat(4001) })
      .expect(400);
  });

  it("never returns a blank value even if a stored override is emptied directly", async () => {
    const { col } = await import("../../src/db/mongo");
    const { CONTENT_DEFAULTS, contentValue } = await import("../../src/domain/content");
    const key = "client.documents.empty";
    await col("content_strings").insertOne({ key, value: "" });
    expect(await contentValue(key)).toBe(CONTENT_DEFAULTS[key].value);
    const res = await request(app).get("/api/content").set(bearer(admin)).expect(200);
    expect(res.body[key]).toBe(CONTENT_DEFAULTS[key].value);
    await col("content_strings").deleteOne({ key });
  });
});
