/**
 * MTD dashboard UX source assertions.
 * Run: node scripts/assert-mtd-dashboard-ux.mjs
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

assert(existsSync(join(root, "src/lib/clientDisplayName.js")), "clientDisplayName helper exists");
const display = readFileSync(join(root, "src/lib/clientDisplayName.js"), "utf8");
assert(display.includes("welcomeGreeting"), "welcomeGreeting exported");
assert(display.includes("serviceWorkspaceFlags"), "serviceWorkspaceFlags exported");
assert(display.includes("mtdChromeOnly"), "mtdChromeOnly flag present");

const dash = readFileSync(join(root, "src/app/mtd-dashboard/page.client.js"), "utf8");
assert(dash.includes("Making Tax Digital for Income Tax"), "MTD dashboard states service title");
assert(dash.includes("welcomeGreeting"), "MTD dashboard uses welcomeGreeting");
assert(dash.includes("mtd-client-display-name"), "MTD display name test id");
assert(!dash.includes('"MTD User"'), "MTD dashboard no MTD User placeholder");
assert(dash.includes("ServiceWorkspaceSwitcher"), "dual-service switcher mounted");

const overview = readFileSync(
  join(root, "src/app/mtd-dashboard/_components/MtdOverview.jsx"),
  "utf8",
);
assert(overview.includes("welcomeGreeting"), "overview uses welcomeGreeting");
assert(!overview.includes('"Client"'), "overview no Client placeholder fallback");
assert(overview.includes("you do not file with HMRC yourself"), "accountant-led copy present");

const sidebar = readFileSync(
  join(root, "src/app/mtd-dashboard/_components/MtdSidebar.jsx"),
  "utf8",
);
assert(sidebar.includes("Current MTD plan"), "sidebar has MTD plan link");
assert(!sidebar.includes("My Tax Return"), "sidebar has no SA My Tax Return");
assert(!sidebar.includes("Tax Tracker"), "sidebar has no Tax Tracker");

const navbar = readFileSync(join(root, "src/components/navbar.js"), "utf8");
assert(navbar.includes("serviceWorkspaceFlags"), "navbar uses ownership flags");
assert(!navbar.includes("userRole === 'MTD'"), "navbar no longer keys off userRole===MTD");

const pricing = readFileSync(join(root, "src/components/MtdPricingSection.jsx"), "utf8");
assert(!pricing.includes("Self-Assessment Tax Return Preparation"), "no SA row in MTD matrix");
assert(pricing.includes("fallbackFeatures = []"), "no invented fallback features");

const switcher = readFileSync(join(root, "src/components/ServiceWorkspaceSwitcher.jsx"), "utf8");
assert(switcher.includes("switch-to-sa"), "switcher has SA control");
assert(switcher.includes("switch-to-mtd"), "switcher has MTD control");

const saDash = readFileSync(join(root, "src/app/dashboard/page.client.js"), "utf8");
assert(saDash.includes("ServiceWorkspaceSwitcher"), "SA dashboard mounts dual switcher");

if (process.exitCode) {
  console.error("MTD dashboard UX assertions failed");
  process.exit(1);
}
console.log("All MTD dashboard UX assertions passed");
