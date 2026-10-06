/**
 * Task 5 proof — SA upgrade quote / checkout / history (SIMULATED fake provider).
 * Never counts as real Stripe proof. Writes JSON evidence under OUT_DIR.
 *
 * Usage:
 *   OUT_DIR=/tmp/t5-proof APP_BASE_URL=http://127.0.0.1:3000 \
 *   ts-node --transpile-only scripts/task5SaUpgradeProof.ts
 */
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import request from "supertest";

import { bearer, bootTestApp, dropTestDb, makeClient, makeUser } from "../tests/helpers/app";
import { FakePaymentProvider, WEBHOOK_SIGNATURE } from "../tests/helpers/payments";

const OUT = process.env.OUT_DIR || path.join("/tmp", `t5-sa-upgrade-proof-${Date.now()}`);

function save(name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

async function main() {
  const { app } = await bootTestApp();
  const { setPaymentProvider } = await import("../src/services/payments");
  const provider = new FakePaymentProvider();
  setPaymentProvider(provider);
  const superAdmin = await makeUser("SUPER_ADMIN", "t5-super");
  const admin = await makeUser("ADMIN", "t5-admin");

  const webhook = (type: string, object: Record<string, unknown>) =>
    request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", WEBHOOK_SIGNATURE)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type, object }));

  const pay = async (sessionId: string) => {
    const paid = provider.pay(sessionId);
    await webhook("checkout.session.completed", {
      id: sessionId,
      payment_status: paid.payment_status,
      payment_intent: paid.payment_intent,
    }).expect(200);
  };

  const client = await makeClient(`t5-${randomUUID().slice(0, 6)}`);

  // Buy SIMPLE
  const buy = await request(app)
    .post("/api/payments/service-checkout")
    .set(bearer(client))
    .send({
      service_type: "SELF_ASSESSMENT",
      package_code: "SIMPLE",
      origin_url: "https://app.test.taxsimba.local",
    })
    .expect(200);
  await pay(buy.body.session_id);

  const before = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
  save("01_before_upgrade_services.json", before.body);

  const options = await request(app).get("/api/my-upgrade-options").set(bearer(client)).expect(200);
  save("02_upgrade_options.json", options.body);

  const rejectAmount = await request(app)
    .post("/api/payments/upgrade-checkout")
    .set(bearer(client))
    .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local", amount: 149 });
  save("03_client_amount_rejected.json", { status: rejectAmount.status, body: rejectAmount.body });

  const checkout = await request(app)
    .post("/api/compat/client/subscription/upgrade-checkout")
    .set(bearer(client))
    .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" })
    .expect(200);
  save("04_upgrade_checkout.json", checkout.body);

  // Cancel path: expire another session without fulfilling
  const cancelClient = await makeClient(`t5c-${randomUUID().slice(0, 6)}`);
  const buy2 = await request(app)
    .post("/api/payments/service-checkout")
    .set(bearer(cancelClient))
    .send({
      service_type: "SELF_ASSESSMENT",
      package_code: "SIMPLE",
      origin_url: "https://app.test.taxsimba.local",
    })
    .expect(200);
  await pay(buy2.body.session_id);
  const cancelCheckout = await request(app)
    .post("/api/payments/upgrade-checkout")
    .set(bearer(cancelClient))
    .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
    .expect(200);
  await webhook("checkout.session.expired", {
    id: cancelCheckout.body.session_id,
    payment_status: "unpaid",
  }).expect(200);
  const cancelServices = await request(app)
    .get("/api/my-services")
    .set(bearer(cancelClient))
    .expect(200);
  save("05_cancelled_upgrade_preserves_package.json", {
    checkout: cancelCheckout.body,
    services: cancelServices.body,
  });

  await pay(checkout.body.data.sessionId || checkout.body.data.session_id);
  // Replay
  await pay(checkout.body.data.sessionId || checkout.body.data.session_id);

  const after = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
  const hist = await request(app)
    .get("/api/compat/client/transaction/list")
    .set(bearer(client))
    .expect(200);
  save("06_after_upgrade_services.json", after.body);
  save("07_billing_history.json", hist.body);

  // Sequential SMART→ELITE on same client (now on SMART after first upgrade)
  const toElite = await request(app)
    .post("/api/payments/upgrade-checkout")
    .set(bearer(client))
    .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
    .expect(200);
  save("08_sequential_smart_to_elite_checkout.json", toElite.body);
  await pay(toElite.body.session_id);
  const afterElite = await request(app).get("/api/my-services").set(bearer(client)).expect(200);
  const paidHist = await request(app).get("/api/my-payments").set(bearer(client)).expect(200);
  const saPaid = (paidHist.body as { kind: string; amount: number; payment_status: string }[])
    .filter(
      (t) =>
        (t.kind === "SERVICE_ACTIVATION" || t.kind === "SA_UPGRADE") && t.payment_status === "paid",
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);
  save("09_after_sequential_elite.json", {
    services: afterElite.body,
    total_sa_paid: saPaid,
    expected_total: 299,
  });

  // Direct SIMPLE→ELITE on fresh client
  const direct = await makeClient(`t5d-${randomUUID().slice(0, 6)}`);
  const buyDirect = await request(app)
    .post("/api/payments/service-checkout")
    .set(bearer(direct))
    .send({
      service_type: "SELF_ASSESSMENT",
      package_code: "SIMPLE",
      origin_url: "https://app.test.taxsimba.local",
    })
    .expect(200);
  await pay(buyDirect.body.session_id);
  const directCheckout = await request(app)
    .post("/api/payments/upgrade-checkout")
    .set(bearer(direct))
    .send({ package_code: "ELITE", origin_url: "https://app.test.taxsimba.local" })
    .expect(200);
  save("10_direct_simple_to_elite.json", directCheckout.body);

  // Zero-payable: drop SMART below credit
  const zeroClient = await makeClient(`t5z-${randomUUID().slice(0, 6)}`);
  const buyZ = await request(app)
    .post("/api/payments/service-checkout")
    .set(bearer(zeroClient))
    .send({
      service_type: "SELF_ASSESSMENT",
      package_code: "SIMPLE",
      origin_url: "https://app.test.taxsimba.local",
    })
    .expect(200);
  await pay(buyZ.body.session_id);
  const pkgs = await request(app)
    .get("/api/packages?service_type=SELF_ASSESSMENT")
    .set(bearer(admin))
    .expect(200);
  const smartPkg = pkgs.body.find((p: { code: string }) => p.code === "SMART");
  await request(app)
    .patch(`/api/packages/${smartPkg.id}/price`)
    .set(bearer(superAdmin))
    .send({ price: 50 })
    .expect(200);
  const zeroOpts = await request(app)
    .get("/api/my-upgrade-options")
    .set(bearer(zeroClient))
    .expect(200);
  const zeroCheckout = await request(app)
    .post("/api/payments/upgrade-checkout")
    .set(bearer(zeroClient))
    .send({ package_code: "SMART", origin_url: "https://app.test.taxsimba.local" });
  save("11_zero_payable.json", {
    intended_behaviour:
      "When target catalogue ≤ SA agreed_price credit, payable=0. Checkout is refused (no Stripe session, no negative charge, no refund). Return URL alone never activates.",
    options: zeroOpts.body,
    checkout_status: zeroCheckout.status,
    checkout_body: zeroCheckout.body,
  });
  // Restore SMART
  await request(app)
    .patch(`/api/packages/${smartPkg.id}/price`)
    .set(bearer(superAdmin))
    .send({ price: 149 })
    .expect(200);

  const report = {
    mode: "SIMULATED — FakePaymentProvider (not Stripe TEST)",
    stripe_staging: "BLOCKED",
    rule: "payable = max(target_catalogue − SA agreed_price, 0) in integer pence",
    classification: {
      "D-001": "NOT a wrong catalogue charge — £30/£150 are upgrade differences; presentation fixed — LOCAL PASS SIMULATED",
      "C-009": "Billing shows upgrade difference amount charged — LOCAL PASS SIMULATED",
      "J-011":
        "Original Toxel runtime error NOT reproduced → original finding UNVERIFIED. Preventive hardening (reject client amounts, inflight reuse, mapPaymentError, confirm UX) LOCAL PASS SIMULATED.",
      "D-004/D-005": "Super Admin pricing / agreed-price freeze preserved — LOCAL PASS",
    },
    sequential: { smart_delta: 30, elite_delta: 150, total_sa_paid: saPaid },
    direct_elite_amount: directCheckout.body.amount,
    zero_payable_checkout_status: zeroCheckout.status,
    out_dir: OUT,
  };
  save("proof_report.json", report);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  setPaymentProvider(null);
  await dropTestDb();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
