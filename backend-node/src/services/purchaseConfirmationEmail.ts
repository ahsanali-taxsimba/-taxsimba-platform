/**
 * Post-purchase welcome / subscription confirmation email.
 *
 * Triggered only from authoritative paid fulfilment (`fulfil` after Stripe webhook /
 * payments status confirms payment_status === "paid"). Never from the browser success page.
 *
 * Idempotent via dedupeKey `purchase-welcome:${session_id}` — webhook retries do not
 * duplicate delivery. Email failure never rolls back entitlement; the queued row is retryable.
 */
import { env } from "../config/env";
import { col, Doc } from "../db/mongo";
import { MTD, SELF_ASSESSMENT } from "./clientServices";
import { resolveEmailFirstName } from "./emailRecipient";
import { queueEmail } from "./email";

export type PurchaseEmailKind = "SERVICE_ACTIVATION" | "SA_UPGRADE";

function appBase(): string {
  return (env("APP_BASE_URL") ?? "https://taxsimba.co.uk").replace(/\/+$/, "");
}

/** Acceptance wording for the purchased service (not RBAC role). */
export function serviceDisplayName(serviceType: string): string {
  if (serviceType === MTD || serviceType === "MTD") {
    return "Making Tax Digital for Income Tax";
  }
  if (serviceType === SELF_ASSESSMENT || serviceType === "SA") {
    return "Self Assessment";
  }
  return String(serviceType);
}

export function dashboardPathForService(serviceType: string): string {
  if (serviceType === MTD || serviceType === "MTD") return "/mtd-dashboard";
  return "/dashboard";
}

function formatAmount(amount: unknown, currency?: string | null): string {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  const cur = String(currency ?? "gbp").toLowerCase();
  if (cur === "gbp" || cur === "£") return `£${value}`;
  return `${value} ${cur.toUpperCase()}`;
}

function formatActivationDate(iso: string | null | undefined): string {
  const raw = iso || new Date().toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface PurchaseConfirmationContent {
  firstName: string;
  serviceName: string;
  packageName: string;
  amountPaid: string;
  billingTypeLabel: string;
  billingFrequency: string;
  subscriptionStatus: string;
  activationDate: string;
  dashboardPath: string;
  dashboardUrl: string;
  engagementPath: string;
  engagementUrl: string;
  supportUrl: string;
  subject: string;
  title: string;
  body: string;
  callToAction: string;
  preheader: string;
  dedupeKey: string;
}

/**
 * Pure composer — used by fulfilment and by preview / unit tests.
 * Does not invent package descriptions; uses catalogue name + billing fields only.
 */
export function buildPurchaseConfirmationContent(params: {
  firstName: string;
  serviceType: string;
  packageName: string;
  amount: unknown;
  currency?: string | null;
  billingType: string;
  billingFrequency: string;
  activationAt?: string | null;
  sessionId: string;
  kind?: PurchaseEmailKind;
}): PurchaseConfirmationContent {
  const serviceName = serviceDisplayName(params.serviceType);
  const dashboardPath = dashboardPathForService(params.serviceType);
  const base = appBase();
  const billingType = String(params.billingType || "ONE_OFF").toUpperCase();
  const isRecurring = billingType === "RECURRING";
  const billingTypeLabel = isRecurring ? "Recurring subscription" : "One-off payment";
  const billingFrequency = String(params.billingFrequency || (isRecurring ? "Monthly" : "Per tax year"));
  const amountPaid = formatAmount(params.amount, params.currency);
  const activationDate = formatActivationDate(params.activationAt);
  const firstName = String(params.firstName || "").trim();
  const packageName = String(params.packageName || "").trim() || String(params.serviceType);

  const subject = `Your ${serviceName} package is confirmed | TaxSimba`;
  const title = "Purchase confirmed";
  const body = [
    `Thank you for choosing TaxSimba.`,
    `Service purchased: ${serviceName}`,
    `Package: ${packageName}`,
    `Amount paid: ${amountPaid}`,
    `Billing: ${billingTypeLabel}`,
    `Billing frequency: ${billingFrequency}`,
    `Subscription status: Active`,
    `Purchase / activation date: ${activationDate}`,
    `Next steps:`,
    `1. Review and accept your client care agreement in your account if you have not already done so.`,
    `2. Open your ${serviceName} dashboard and follow any document or information requests from your accountant.`,
    `3. Contact TaxSimba support if you need help with your account.`,
    `Your client care agreement is available here: ${base}/engagement-letter`,
    `Support: ${base}/contact-us`,
  ].join("\n\n");

  return {
    firstName,
    serviceName,
    packageName,
    amountPaid,
    billingTypeLabel,
    billingFrequency,
    subscriptionStatus: "Active",
    activationDate,
    dashboardPath,
    dashboardUrl: `${base}${dashboardPath}`,
    engagementPath: "/engagement-letter",
    engagementUrl: `${base}/engagement-letter`,
    supportUrl: `${base}/contact-us`,
    subject,
    title,
    body,
    callToAction: `Open my ${serviceName === "Self Assessment" ? "Self Assessment" : "MTD"} dashboard`,
    preheader: `${packageName} is active on your TaxSimba account`,
    dedupeKey: `purchase-welcome:${params.sessionId}`,
  };
}

/**
 * Queue a purchase confirmation for a paid SERVICE_ACTIVATION or SA_UPGRADE transaction.
 * Safe to call on webhook retries — dedupe prevents duplicates. Never throws to the caller.
 */
export async function queuePurchaseConfirmationEmail(
  tx: Doc,
  user: Doc,
  client: Doc | null,
): Promise<string | null> {
  try {
    const kind = String(tx.kind ?? "");
    if (kind !== "SERVICE_ACTIVATION" && kind !== "SA_UPGRADE") return null;
    if (tx.payment_status !== "paid") return null;

    const serviceType = String(
      tx.service_type ?? (kind === "SA_UPGRADE" ? SELF_ASSESSMENT : ""),
    );
    if (!serviceType) return null;

    const packageCode = String(tx.new_package ?? "");
    const pkg = packageCode
      ? ((await col("packages").findOne({
          code: packageCode,
          is_active: { $ne: false },
        })) as Doc | null)
      : null;

    const content = buildPurchaseConfirmationContent({
      firstName: resolveEmailFirstName(user, client),
      serviceType,
      packageName: String(pkg?.name ?? packageCode),
      amount: tx.amount ?? pkg?.price ?? 0,
      currency: (tx.currency as string) ?? "gbp",
      billingType: String(pkg?.billing_type ?? (serviceType === MTD ? "RECURRING" : "ONE_OFF")),
      billingFrequency: String(
        pkg?.billing_frequency ?? (serviceType === MTD ? "Monthly" : "Per tax year"),
      ),
      activationAt: (tx.updated_at as string) ?? (tx.created_at as string) ?? null,
      sessionId: String(tx.session_id),
      kind: kind as PurchaseEmailKind,
    });

    return await queueEmail({
      to: String(user.email),
      recipientName: content.firstName || null,
      kind: "PURCHASE_CONFIRMATION",
      subject: content.subject,
      title: content.title,
      body: content.body,
      link: content.dashboardPath,
      callToAction: content.callToAction,
      preheader: content.preheader,
      dedupeKey: content.dedupeKey,
      userId: user.id as string,
      caseId: null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`purchase confirmation email skipped: ${String(e)}`);
    return null;
  }
}
