/**
 * Assert ownership-aware checkout-success + MTD current-plan CTAs (client).
 * Run: node scripts/assert-checkout-success-routing.mjs
 */
import { readFileSync } from "node:fs";
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

const journey = readFileSync(join(root, "src/lib/catalogueJourney.js"), "utf8");
assert(journey.includes("postPurchaseDashboardPath"), "postPurchaseDashboardPath helper exists");
assert(journey.includes("dashboardPathForService"), "dashboardPathForService helper exists");
assert(journey.includes('return "/mtd-dashboard"'), "MTD maps to /mtd-dashboard");
assert(journey.includes("mtdCurrentPlanPath"), "mtdCurrentPlanPath helper exists");
assert(journey.includes("mtdAuthenticatedStartPath"), "mtdAuthenticatedStartPath helper exists");

const success = readFileSync(
  join(root, "src/app/(home)/planlist/checkout-success/page.jsx"),
  "utf8",
);
assert(success.includes("postPurchaseDashboardPath"), "checkout-success uses ownership helper");
assert(!success.includes('"/dashboard/my-subscriptions"'), "checkout-success does not hardcode SA my-subscriptions");
assert(success.includes("nextDashboardPath"), "checkout-success uses computed nextDashboardPath");
assert(success.includes("serviceType"), "checkout-success reads fulfilled serviceType");

const planlist = readFileSync(join(root, "src/app/(home)/planlist/page.jsx"), "utf8");
assert(planlist.includes("mtdCurrentPlanPath"), "planlist MTD current-plan uses helper");
assert(planlist.includes("saCurrentPlanPath"), "planlist SA current-plan uses helper");

const pricing = readFileSync(join(root, "src/app/pricing/page.client.jsx"), "utf8");
assert(pricing.includes("mtdCurrentPlanPath"), "pricing uses mtdCurrentPlanPath");
assert(!/router\.push\("\/dashboard\/my-subscriptions"\)/.test(pricing), "pricing does not hardcode SA path for all journeys");

const mtdInfo = readFileSync(join(root, "src/app/mtd-information/page.client.js"), "utf8");
assert(mtdInfo.includes("mtdAuthenticatedStartPath"), "mtd-information Get Started is journey-aware");
assert(mtdInfo.includes("mtdCurrentPlanPath"), "mtd-information current plan → MTD dashboard");
assert(!mtdInfo.includes('status === "authenticated" ? "/dashboard"'), "mtd-information does not send auth users to SA /dashboard");

const checkMtd = readFileSync(join(root, "src/app/check-mtd/page.client.jsx"), "utf8");
assert(checkMtd.includes("mtdCurrentPlanPath"), "check-mtd current plan → MTD dashboard");
assert(!checkMtd.includes("/dashboard/my-subscriptions"), "check-mtd does not use SA subscriptions path");

const mtdDash = readFileSync(join(root, "src/app/mtd-dashboard/page.client.js"), "utf8");
assert(!mtdDash.includes("getBacklogQuarters"), "MTD dashboard does not invent backlog quarters");
assert(!mtdDash.includes("hasOutstandingMTDSubmissions"), "MTD dashboard does not invent backlog from questionnaire");

const overview = readFileSync(join(root, "src/app/mtd-dashboard/_components/MtdOverview.jsx"), "utf8");
assert(overview.includes("entitlementOnly"), "MtdOverview respects entitlementOnly");
assert(overview.includes("mtd-overview-setup-state"), "MtdOverview shows setup empty state");
assert(overview.includes("!entitlementOnly"), "MtdOverview hides assignment timeline before case");

const subs = readFileSync(
  join(root, "src/app/dashboard/my-subscriptions/_client/MySubscriptionsClient.jsx"),
  "utf8",
);
assert(subs.includes("subscription-plans?category="), "my-subscriptions scopes catalogue by category");
assert(!/subscription-plans`\s*$/m.test(subs) && !subs.includes('subscription-plans`'), "my-subscriptions does not fetch unscoped catalogue");

const mtdPricing = readFileSync(join(root, "src/components/MtdPricingSection.jsx"), "utf8");
assert(mtdPricing.includes("isPlanPurchasable"), "MtdPricingSection guards unpurchasable prices");
assert(mtdPricing.includes("formatPlanPrice"), "MtdPricingSection uses formatPlanPrice for unavailable");

const home = readFileSync(join(root, "src/app/(home)/page.client.jsx"), "utf8");
assert(home.includes("saCurrentPlanPath"), "homepage current-plan uses saCurrentPlanPath");

const engagement = readFileSync(join(root, "src/app/engagement-letter/page.jsx"), "utf8");
assert(engagement.includes("apply-tax-return"), "MTD engagement applies case before submit-tax-info");
assert(engagement.includes("submit-tax-info"), "MTD engagement still submits tax info");

if (process.exitCode) {
  console.error("Checkout-success routing assertions failed");
  process.exit(1);
}
console.log("All checkout-success routing assertions passed");
