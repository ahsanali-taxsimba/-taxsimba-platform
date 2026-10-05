/**
 * SA package upgrade quoting — single source of truth for options + checkout.
 *
 * Charging rule (agreed product behaviour):
 *   amount_payable = max(target_catalogue_price − existing_SA_agreed_price, 0)
 *
 * - Credit is the client's frozen SA `agreed_price` (what they paid / were quoted),
 *   never an MTD payment and never a client-supplied amount.
 * - Target price is the live Self Assessment catalogue price for the higher-rank package.
 * - All money math is integer pence; major units are derived for API/Stripe helpers.
 */
import { Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { SELF_ASSESSMENT } from "./packages";

export type SaUpgradeQuote = {
  currency: "gbp";
  current_package: { code: string; name: string; catalogue_price: number };
  target_package: { code: string; name: string; catalogue_price: number };
  /** Frozen SA purchase / agreed price used as upgrade credit (major units). */
  current_package_credit: number;
  /** Live catalogue price of the target package (major units). */
  upgrade_price: number;
  /** Amount payable now = upgrade difference (major units). */
  additional_amount_payable: number;
  total_due_now: number;
  /** Integer pence mirrors for audit / Stripe. */
  credit_pence: number;
  target_pence: number;
  amount_due_pence: number;
};

/** Major GBP → integer pence. Allows 0 (credit); rejects NaN/negative. */
export function gbpMajorToPence(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw httpError(400, "Checkout amount must be a non-negative GBP price");
  }
  return Math.round(n * 100);
}

export function penceToGbpMajor(pence: number): number {
  if (!Number.isInteger(pence) || pence < 0) {
    throw httpError(500, "Invalid pence amount");
  }
  return Math.round(pence) / 100;
}

/**
 * Resolve credit for an ACTIVE SA service row.
 * Prefer frozen agreed_price; fall back to current catalogue price if unset.
 */
export function saUpgradeCreditMajor(svc: Doc, currentPkg: Doc): number {
  const agreed = Number(svc.agreed_price);
  if (Number.isFinite(agreed) && agreed >= 0) return agreed;
  const catalogue = Number(currentPkg.price);
  if (Number.isFinite(catalogue) && catalogue >= 0) return catalogue;
  throw httpError(400, "Current Self Assessment package price is unavailable");
}

/**
 * Compute the payable upgrade difference in integer pence.
 * Callers must already enforce rank upgrade + ACTIVE SA + lock rules.
 */
export function computeSaUpgradeQuote(params: {
  svc: Doc;
  currentPkg: Doc;
  targetPkg: Doc;
}): SaUpgradeQuote {
  const { svc, currentPkg, targetPkg } = params;
  if (String(currentPkg.service_type) !== SELF_ASSESSMENT) {
    throw httpError(400, "Upgrade credit must use Self Assessment package only");
  }
  if (String(targetPkg.service_type) !== SELF_ASSESSMENT) {
    throw httpError(400, "Upgrade target must be a Self Assessment package");
  }
  const creditMajor = saUpgradeCreditMajor(svc, currentPkg);
  const targetMajor = Number(targetPkg.price);
  if (!Number.isFinite(targetMajor) || targetMajor <= 0) {
    throw httpError(400, "Target package price is unavailable");
  }
  const creditPence = gbpMajorToPence(creditMajor);
  const targetPence = gbpMajorToPence(targetMajor);
  const duePence = Math.max(targetPence - creditPence, 0);
  const dueMajor = penceToGbpMajor(duePence);
  return {
    currency: "gbp",
    current_package: {
      code: String(currentPkg.code),
      name: String(currentPkg.name),
      catalogue_price: Number(currentPkg.price),
    },
    target_package: {
      code: String(targetPkg.code),
      name: String(targetPkg.name),
      catalogue_price: targetMajor,
    },
    current_package_credit: penceToGbpMajor(creditPence),
    upgrade_price: targetMajor,
    additional_amount_payable: dueMajor,
    total_due_now: dueMajor,
    credit_pence: creditPence,
    target_pence: targetPence,
    amount_due_pence: duePence,
  };
}

/** Reject client-supplied amount fields — server quote is authoritative. */
export function assertNoClientAmount(body: Record<string, unknown> | null | undefined): void {
  if (!body || typeof body !== "object") return;
  for (const key of [
    "amount",
    "amount_due",
    "amountDue",
    "total_due_now",
    "totalDueNow",
    "additional_amount_payable",
    "additionalAmountPayable",
    "upgrade_price",
    "upgradePrice",
    "price",
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null) {
      throw httpError(400, "Client-supplied payment amounts are not accepted; amount is calculated server-side");
    }
  }
}
