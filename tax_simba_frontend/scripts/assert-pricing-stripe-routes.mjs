/**
 * Client source assertions for UAT pricing + Stripe return routes.
 * Run: node scripts/assert-pricing-stripe-routes.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const home = readFileSync(join(root, "src/app/(home)/page.client.jsx"), "utf8");
const planlist = readFileSync(join(root, "src/app/(home)/planlist/page.jsx"), "utf8");
const pricing = readFileSync(join(root, "src/app/pricing/page.client.jsx"), "utf8");
const hook = readFileSync(join(root, "src/hooks/useCatalogueFromPrice.js"), "utf8");

assert(!home.includes("Perfect for individuals and businesses."), "homepage: no generic repeated description fallback");
assert(!planlist.includes("Perfect for individuals and businesses."), "planlist: no generic repeated description fallback");
assert(!pricing.includes("Perfect for individuals and businesses."), "pricing: no generic repeated description fallback");
assert(hook.includes("n > 0"), "from-price ignores £0");
assert(hook.includes("Unavailable"), "formatPlanPrice never markets £0");
assert(home.includes("n > 0"), "homepage fromPrice ignores £0");
assert(home.includes("formatPlanPrice"), "homepage uses formatPlanPrice");

const routes = [
  "src/app/(home)/planlist/checkout-success/page.jsx",
  "src/app/(home)/planlist/checkout-cancel/page.jsx",
  "src/app/payment/success/page.jsx",
  "src/app/payment/cancel/page.jsx",
  "src/app/payments/success/page.jsx",
  "src/app/payments/cancel/page.jsx",
];
for (const r of routes) {
  assert(existsSync(join(root, r)), `route exists: ${r}`);
}

const success = readFileSync(join(root, "src/app/(home)/planlist/checkout-success/page.jsx"), "utf8");
assert(success.includes("session_id"), "success page reads session_id");
assert(success.includes("Retry") || success.includes("retry"), "success page supports retry");
assert(!success.includes("192.168."), "success page no LAN hardcode");

const cancel = readFileSync(join(root, "src/app/(home)/planlist/checkout-cancel/page.jsx"), "utf8");
assert(cancel.includes("cancelled") || cancel.includes("canceled"), "cancel page messaging");
assert(cancel.includes("No package was activated"), "cancel creates no entitlement copy");

const paymentsSuccess = readFileSync(join(root, "src/app/payments/success/page.jsx"), "utf8");
assert(paymentsSuccess.includes("checkout-success"), "plural /payments/success redirects to canonical");

if (process.exitCode) {
  console.error("Pricing / Stripe route assertions failed");
  process.exit(1);
}
console.log("All pricing / Stripe route assertions passed");
