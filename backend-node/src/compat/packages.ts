/**
 * Packages / subscription-plans adapter (baseline E2 / E3).
 * Calls existing GET /packages domain data via Mongo — no parallel catalogue.
 */
import { Router } from "express";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import { applyDuePriceSchedules } from "../domain/pricing";
import { contentMap } from "../domain/content";
import { handler, httpError } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { sendCompatSuccess } from "./envelope";
import { categoryToServiceType } from "./ownership";

export const compatPackagesRouter = Router();

function mapPackage(p: Doc, content: Record<string, string>): Doc {
  const price = Number(p.price);
  const priceAvailable = Number.isFinite(price) && price > 0;
  const description = content[`package.${String(p.code)}.description`] || null;
  const features = (content[`package.${String(p.code)}.features`] ?? "")
    .split("\n")
    .filter((line) => line.trim());
  const originalRaw = p.original_price ?? p.originalPrice;
  const originalPrice =
    originalRaw != null && Number(originalRaw) > 0 ? Number(originalRaw) : null;
  const saveRaw = p.save_percentage ?? p.savePercentage;
  const savePercentage =
    saveRaw != null && Number(saveRaw) > 0 ? Number(saveRaw) : null;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    // Never market £0 — callers treat unavailable as an error state.
    price: priceAvailable ? price : null,
    priceAvailable,
    originalPrice,
    savePercentage,
    rank: p.rank,
    serviceType: p.service_type,
    billingFrequency: p.billing_frequency,
    billingType: p.billing_type,
    vatTreatment: p.vat_treatment,
    category: p.service_type === "MTD_INCOME_TAX" ? "mtd" : "taxSimba",
    description,
    features,
    // Marketing aliases Toxel may read
    priceId: p.id,
    stripePriceId: null,
    currency: "GBP",
    vatPercentage: p.vat_treatment === "EXCLUSIVE" ? 20 : 0,
  };
}

compatPackagesRouter.get(
  "/subscription-plans",
  // Public marketing catalogue — active packages only, mapPackage marketing fields.
  // Mutations and native /api/packages* remain Super Admin protected.
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    const category =
      typeof req.query.category === "string"
        ? req.query.category
        : typeof req.query.service_type === "string"
          ? req.query.service_type
          : null;
    const serviceType = categoryToServiceType(category);
    const q: Doc = { is_active: true };
    if (serviceType) q.service_type = serviceType;
    const rows = cleanMany(
      (await col("packages").find(q).sort({ rank: 1 }).limit(100).toArray()) as Doc[],
    );
    const content = (await contentMap()) as Record<string, string>;
    sendCompatSuccess(
      res,
      rows.map((p) => mapPackage(p, content)),
      "OK",
    );
  }),
);

compatPackagesRouter.get(
  "/subscription-plans/:planId",
  auth(),
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    const planId = req.params.planId;
    let pkg = (await col("packages").findOne({ id: planId, is_active: true })) as Doc | null;
    if (!pkg) {
      pkg = (await col("packages").findOne({ code: planId, is_active: true })) as Doc | null;
    }
    if (!pkg) throw httpError(404, "Plan not found");
    const content = (await contentMap()) as Record<string, string>;
    sendCompatSuccess(res, mapPackage(clean(pkg) as Doc, content), "OK");
  }),
);

/**
 * Display-only fee hint for Toxel dashboard / apply form.
 * Reads from existing packages catalogue — not a parallel fee CMS (admin global-fee stays HIDE).
 */
compatPackagesRouter.get(
  "/client/global-fee",
  auth("CLIENT"),
  handler(async (_req, res) => {
    await applyDuePriceSchedules();
    const { SELF_ASSESSMENT } = await import("../domain/packages");
    const pkg = (await col("packages")
      .find({ service_type: SELF_ASSESSMENT, is_active: true })
      .sort({ rank: 1 })
      .limit(1)
      .next()) as Doc | null;
    const baseFee = pkg && Number(pkg.price) > 0 ? Number(pkg.price) : null;
    if (baseFee == null) {
      throw httpError(503, "Package price is unavailable");
    }
    sendCompatSuccess(
      res,
      {
        globalFee: {
          baseFee,
          currency: "GBP",
          packageCode: pkg?.code ?? "SIMPLE",
          packageId: pkg?.id ?? null,
          isActive: true,
        },
      },
      "OK",
    );
  }),
);

/**
 * Service-type options for apply / MTD new-return forms.
 * Derived from active packages (SA + MTD) — no parallel tax_return_types store.
 *
 * Never returns an empty list for an authenticated client: if the catalogue is
 * missing rows (SEED_DEMO_DATA=false without reconcile), fall back to the
 * founder-approved DEFAULT_PACKAGES so Start Now / Basic Details can continue.
 * When the client has ACTIVE entitlements, only those service types are offered.
 */
compatPackagesRouter.post(
  "/client/tax-return-type",
  auth("CLIENT"),
  handler(async (req, res) => {
    await applyDuePriceSchedules();
    const {
      DEFAULT_PACKAGES,
      SELF_ASSESSMENT,
      MTD,
    } = await import("../domain/packages");
    const { activeServiceTypesForClient } = await import("../domain/caseEntitlement");
    const me = authed(req);

    const rows = cleanMany(
      (await col("packages")
        .find({ is_active: true, service_type: { $in: [SELF_ASSESSMENT, MTD] } })
        .sort({ service_type: 1, rank: 1 })
        .limit(50)
        .toArray()) as Doc[],
    );

    // One option per service_type (lowest rank package price).
    const byService = new Map<string, Doc>();
    for (const p of rows) {
      const st = String(p.service_type);
      if (!byService.has(st)) byService.set(st, p);
    }

    // Catalogue fallback so an empty packages collection cannot blank the dropdown.
    for (const p of DEFAULT_PACKAGES) {
      const st = String(p.service_type);
      if (byService.has(st)) continue;
      byService.set(st, {
        ...p,
        id: `type:${st}`,
        is_active: true,
      });
    }

    let allowed = [SELF_ASSESSMENT, MTD];
    try {
      const active = await activeServiceTypesForClient(me);
      if (active.length) allowed = active;
    } catch {
      // Keep full catalogue if entitlement lookup fails — still better than empty.
    }

    const taxReturnTypes = [...byService.values()]
      .filter((p) => allowed.includes(String(p.service_type)))
      .map((p) => {
        const isMtd = p.service_type === MTD;
        const price = Number(p.price ?? 0);
        return {
          id: p.id,
          typeName: isMtd ? "Making Tax Digital" : "Self Assessment",
          typeCode: isMtd ? "MTD" : "SA",
          serviceType: p.service_type,
          baseFee: Number.isFinite(price) && price > 0 ? price : 0,
          packageCode: p.code,
          isActive: true,
          requiredDocuments: [],
        };
      });

    // Final safety net: SA clients must always see Self Assessment.
    if (!taxReturnTypes.some((t) => t.typeCode === "SA") && allowed.includes(SELF_ASSESSMENT)) {
      const sa = DEFAULT_PACKAGES.find((p) => p.service_type === SELF_ASSESSMENT)!;
      taxReturnTypes.unshift({
        id: `type:${SELF_ASSESSMENT}`,
        typeName: "Self Assessment",
        typeCode: "SA",
        serviceType: SELF_ASSESSMENT,
        baseFee: Number(sa.price ?? 0),
        packageCode: sa.code,
        isActive: true,
        requiredDocuments: [],
      });
    }

    sendCompatSuccess(res, { taxReturnTypes }, "OK");
  }),
);
