/**
 * Assert MTD/SA catalogue journey separation on the client.
 * Run: node scripts/assert-mtd-signup-journey.mjs
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

assert(existsSync(join(root, "src/lib/catalogueJourney.js")), "catalogueJourney helper exists");
const journey = readFileSync(join(root, "src/lib/catalogueJourney.js"), "utf8");
assert(journey.includes("onboardingIntent"), "journey uses onboardingIntent");
assert(journey.includes("catalogueCategory"), "journey uses catalogueCategory");
assert(!journey.includes('userRole === "MTD"') && !journey.includes("userRole === 'MTD'"), "journey does not use legacy userRole===MTD as SoT");

const planlist = readFileSync(join(root, "src/app/(home)/planlist/page.jsx"), "utf8");
assert(planlist.includes("resolveCatalogueCategory"), "planlist uses resolveCatalogueCategory");
assert(planlist.includes('category === "mtd"'), "planlist guards MTD catalogue");
assert(planlist.includes("SIMPLE"), "planlist rejects SA codes on MTD");

const middleware = readFileSync(join(root, "src/middleware.js"), "utf8");
assert(middleware.includes("continuePath"), "middleware uses continuePath for pending");
assert(middleware.includes("category=mtd"), "middleware can stamp MTD planlist");

const login = readFileSync(join(root, "src/app/(auth)/login/page.client.js"), "utf8");
assert(login.includes("pendingPlanlistPath"), "login resumes pending journey");

const verify = readFileSync(join(root, "src/app/(auth)/verify-email/page.client.js"), "utf8");
assert(verify.includes("continuePath"), "verify uses server continuePath");
assert(verify.includes("safeContinuePath"), "verify does not trust raw URL journey");

const nextauth = readFileSync(join(root, "src/app/frontend-api/auth/[...nextauth]/route.js"), "utf8");
assert(nextauth.includes("onboardingIntent"), "NextAuth persists onboardingIntent");

if (process.exitCode) {
  console.error("MTD signup journey client assertions failed");
  process.exit(1);
}
console.log("All MTD signup journey client assertions passed");
