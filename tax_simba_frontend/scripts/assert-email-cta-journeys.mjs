/**
 * Email CTA journey + APP_BASE_URL contract assertions (client).
 * Run: node scripts/assert-email-cta-journeys.mjs
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

const mw = readFileSync(join(root, "src/middleware.js"), "utf8");
assert(mw.includes("loginUrl.searchParams.set('next'"), "middleware preserves next for unauthenticated dashboard");
assert(mw.includes("/mtd-dashboard"), "middleware knows MTD dashboard");
assert(mw.includes("/dashboard"), "middleware knows SA dashboard");

const journey = readFileSync(join(root, "src/lib/catalogueJourney.js"), "utf8");
assert(journey.includes('path.startsWith("/mtd-dashboard")'), "safeContinuePath allows MTD dashboard");
assert(journey.includes('path.startsWith("/dashboard")'), "safeContinuePath allows SA dashboard");

const login = readFileSync(join(root, "src/app/(auth)/login/page.client.js"), "utf8");
assert(login.includes("safeContinuePath(nextRaw)"), "login honours next after auth");
assert(login.includes("router.push(nextPath)"), "login resumes next path");
assert(login.includes("pendingPlanlistPath"), "login resumes pending SA/MTD planlist");
assert(login.includes("/mtd-dashboard"), "login can land on MTD dashboard");

const verify = readFileSync(join(root, "src/app/(auth)/verify-email/page.client.js"), "utf8");
assert(verify.includes("safeContinuePath"), "verify-email uses server continuePath");
assert(verify.includes("login?next="), "verify-email continues via login?next=");

const logo = existsSync(join(root, "public/images/logo.png"));
assert(logo, "public email-safe logo.png exists");

if (process.exitCode) {
  console.error("Email CTA journey assertions failed");
  process.exit(1);
}
console.log("All email CTA journey assertions passed");
