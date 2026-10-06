/**
 * Assert C-004 catalogue CTA helpers (no FE test runner required).
 * Run: node --experimental-vm-modules scripts/assertCatalogueJourneyC004.mjs
 * (or via task4 proof).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../tax_simba_frontend/src/lib/catalogueJourney.js");

async function load() {
  // Next client modules are plain ESM/CJS-compatible JS without JSX here.
  return import(pathToFileURL(root).href);
}

const mod = await load();
const {
  addSecondServicePath,
  addSecondServiceLabel,
  upgradeCataloguePath,
  resolveCatalogueCategory,
} = mod;

assert.equal(addSecondServicePath({ hasActiveSa: true, hasActiveMtd: false }), "/planlist?category=mtd");
assert.equal(addSecondServiceLabel({ hasActiveSa: true, hasActiveMtd: false }), "Add Making Tax Digital");
assert.equal(addSecondServicePath({ hasActiveSa: false, hasActiveMtd: true }), "/planlist?category=taxSimba");
assert.equal(addSecondServiceLabel({ hasActiveSa: false, hasActiveMtd: true }), "Add Self Assessment");
assert.equal(addSecondServicePath({ hasActiveSa: true, hasActiveMtd: true }), null);
assert.equal(addSecondServicePath({ hasActiveSa: false, hasActiveMtd: false }), null);

assert.equal(upgradeCataloguePath("/dashboard/my-subscriptions", { hasActiveSa: true }), "/planlist?category=taxSimba");
assert.equal(upgradeCataloguePath("/mtd-dashboard", { hasActiveMtd: true }), "/planlist?category=mtd");

// Explicit category override still wins over locked onboarding intent.
const params = new URLSearchParams("category=mtd");
assert.equal(
  resolveCatalogueCategory({ onboardingIntent: "SELF_ASSESSMENT", catalogueCategory: "taxSimba" }, params),
  "mtd",
);

console.log("assertCatalogueJourneyC004: PASS");
