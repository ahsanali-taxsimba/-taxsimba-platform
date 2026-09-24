/**
 * Signup / onboarding journey intent — additive to multi-service entitlements.
 *
 * A CLIENT may hold BOTH Self Assessment and MTD_INCOME_TAX services. This module
 * persists which journey the registrant chose at signup so verification, catalogue
 * filtering, and pending routing survive logout/login without treating RBAC role as
 * "MTD" vs "SA".
 */
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { MTD, SELF_ASSESSMENT } from "../services/clientServices";

export type OnboardingIntent = typeof SELF_ASSESSMENT | typeof MTD;

/** Admin / API display of service + pending onboarding state. */
export type ClientServiceState =
  | "SA"
  | "MTD"
  | "SA_AND_MTD"
  | "PENDING_MTD"
  | "PENDING_SA"
  | "NO_ACTIVE_SERVICE";

export const ONBOARDING_INTENT_VALUES: OnboardingIntent[] = [SELF_ASSESSMENT, MTD];

/** Default for direct /register with no journey hint — matches current SA-first product. */
export const DEFAULT_ONBOARDING_INTENT: OnboardingIntent = SELF_ASSESSMENT;

const SA_ALIASES = new Set([
  "sa",
  "self_assessment",
  "self-assessment",
  "taxsimba",
  "tax_simba",
  "simple",
  "smart",
  "elite",
]);

const MTD_ALIASES = new Set([
  "mtd",
  "mtd_income_tax",
  "mtd-income-tax",
  "making_tax_digital",
  "simbian",
]);

/**
 * Validate and normalise a signup journey identifier.
 * Rejects arbitrary values. When `required` is false and input is empty, returns the
 * product default (Self Assessment).
 */
export function parseOnboardingIntent(
  raw: unknown,
  opts: { required?: boolean } = {},
): OnboardingIntent {
  const required = Boolean(opts.required);
  if (raw == null || String(raw).trim() === "") {
    if (required) throw httpError(400, "A valid signup journey is required");
    return DEFAULT_ONBOARDING_INTENT;
  }
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (SA_ALIASES.has(key) || key === SELF_ASSESSMENT.toLowerCase()) {
    return SELF_ASSESSMENT;
  }
  if (MTD_ALIASES.has(key) || key === MTD.toLowerCase()) {
    return MTD;
  }
  throw httpError(
    400,
    "Invalid signup journey. Use MTD or TAXSIMBA (Self Assessment).",
  );
}

export function catalogueCategoryForIntent(intent: OnboardingIntent): "mtd" | "taxSimba" {
  return intent === MTD ? "mtd" : "taxSimba";
}

/** Post-verify / pending-purchase continuation path (relative). */
export function continuePathForIntent(intent: OnboardingIntent): string {
  const category = catalogueCategoryForIntent(intent);
  return `/planlist?category=${category}`;
}

export function resolveClientServiceState(
  intent: OnboardingIntent | null | undefined,
  hasActiveSa: boolean,
  hasActiveMtd: boolean,
): ClientServiceState {
  if (hasActiveSa && hasActiveMtd) return "SA_AND_MTD";
  if (hasActiveSa) return "SA";
  if (hasActiveMtd) return "MTD";
  if (intent === MTD) return "PENDING_MTD";
  if (intent === SELF_ASSESSMENT) return "PENDING_SA";
  return "NO_ACTIVE_SERVICE";
}

export function serviceStateLabel(state: ClientServiceState): string {
  switch (state) {
    case "SA":
      return "SA";
    case "MTD":
      return "MTD";
    case "SA_AND_MTD":
      return "SA + MTD";
    case "PENDING_MTD":
      return "Pending MTD";
    case "PENDING_SA":
      return "Pending SA";
    default:
      return "No active service";
  }
}

/** Read persisted intent from a clients document (never invent MTD). */
export function intentFromClient(client: Doc | null | undefined): OnboardingIntent | null {
  if (!client) return null;
  const raw = client.onboarding_intent ?? client.onboardingIntent ?? null;
  if (raw == null || String(raw).trim() === "") return null;
  try {
    return parseOnboardingIntent(raw, { required: true });
  } catch {
    return null;
  }
}

export async function onboardingIntentForUser(
  user: Doc,
): Promise<OnboardingIntent | null> {
  if (user.role !== "CLIENT") return null;
  const client = (await col("clients").findOne({ user_id: user.id })) as Doc | null;
  return intentFromClient(client);
}

export async function onboardingSnapshotForUser(user: Doc): Promise<{
  onboardingIntent: OnboardingIntent | null;
  catalogueCategory: "mtd" | "taxSimba" | null;
  continuePath: string | null;
}> {
  const intent = await onboardingIntentForUser(user);
  if (!intent) {
    return { onboardingIntent: null, catalogueCategory: null, continuePath: null };
  }
  return {
    onboardingIntent: intent,
    catalogueCategory: catalogueCategoryForIntent(intent),
    continuePath: continuePathForIntent(intent),
  };
}
