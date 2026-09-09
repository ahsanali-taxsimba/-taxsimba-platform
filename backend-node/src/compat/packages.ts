/**
 * Packages / subscription-plans adapter (baseline E2 / E3).
 * Calls existing GET /packages domain data via Mongo — no parallel catalogue.
 */
import { Router } from "express";

import { clean, cleanMany, col, Doc } from "../db/mongo";
import { applyDuePriceSchedules } from "../domain/pricing";
import { contentMap } from "../domain/content";
import { handler, httpError } from "../http/errors";
import { auth } from "../middleware/auth";
import { sendCompatSuccess } from "./envelope";
import { categoryToServiceType } from "./ownership";

export const compatPackagesRouter = Router();

function mapPackage(p: Doc, content: Record<string, string>): Doc {
  const description = content[`package.${String(p.code)}.description`] || null;
  const features = (content[`package.${String(p.code)}.features`] ?? "")
    .split("\n")
    .filter((line) => line.trim());
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    price: p.price,
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
    vatPercentage: 0,
  };
}

compatPackagesRouter.get(
  "/subscription-plans",
  auth(),
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
