/**
 * Admin assertions: package price parity + plan column wiring.
 * Run: node scripts/assert-package-plan-parity.mjs
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

const pkgPage = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/package-pricing/page.tsx"),
  "utf8",
);
assert(pkgPage.includes("price <= 0") || pkgPage.includes("greater than zero"), "admin rejects £0 price");

const table = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-client/_sections/ClientTable.tsx"),
  "utf8",
);
assert(table.includes("subscription?.plan?.name"), "Plan column reads subscription.plan.name");

const modal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-client/_sections/UserViewModal.tsx"),
  "utf8",
);
assert(modal.includes("subscription?.plan?.name"), "Client Details reads subscription.plan.name");

const native = readFileSync(join(root, "src/lib/nativeApiUrl.ts"), "utf8");
assert(native.includes("/api/packages") || native.includes("api/packages"), "native packages URL helper present");

const cmsList = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/(cms)/subscription-plan/page.client.tsx"),
  "utf8",
);
assert(cmsList.includes("originalPrice"), "CMS subscription list shows originalPrice");

const cmsView = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/(cms)/subscription-plan/_section/SubscriptionPlanViewModal.tsx"),
  "utf8",
);
assert(cmsView.includes("savePercentage"), "CMS plan view shows Save %");

const clientTable = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-client/_sections/ClientTable.tsx"),
  "utf8",
);
assert(clientTable.includes("serviceStateLabel"), "Client table shows serviceStateLabel");
assert(!clientTable.includes("{order.userRole || order.role || \"-\"}"), "Client table does not use RBAC role as platform");

const clientModal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-client/_sections/UserViewModal.tsx"),
  "utf8",
);
assert(clientModal.includes("serviceLabel"), "Client details uses serviceLabel");
assert(clientModal.includes("serviceState"), "Client details aware of serviceState");

if (process.exitCode) {
  console.error("Admin package/plan assertions failed");
  process.exit(1);
}
console.log("All admin package/plan assertions passed");
