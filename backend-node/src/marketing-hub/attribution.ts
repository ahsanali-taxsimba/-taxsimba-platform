/**
 * Campaign UTM attribution — leads vs paid customers vs revenue.
 * Stores only non-PII attribution fields (no email/name/tax data).
 */

import { randomUUID } from "crypto";

import { OPERATIONAL_ONLY } from "../domain/testdata";
import { col, Doc } from "../db/mongo";
import { appendAudit } from "./store";

const ATTR = "marketing_attribution_events";

export type AttributionKind = "lead_registration" | "checkout_started" | "payment_confirmed";

export type UtmPayload = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  landing_page?: string;
  service?: "SA" | "MTD" | "UNKNOWN";
  plan_id?: string;
  /** Opaque user id hash or user id for join — never email */
  user_id?: string;
  session_id?: string;
  amount_gbp?: number;
  currency?: string;
};

export async function ensureAttributionIndexes(): Promise<void> {
  await col(ATTR).createIndex({ kind: 1, at: -1 });
  await col(ATTR).createIndex({ utm_campaign: 1, at: -1 });
  await col(ATTR).createIndex({ session_id: 1 }, { sparse: true });
  await col(ATTR).createIndex({ idempotency_key: 1 }, { unique: true, sparse: true });
}

function cleanUtm(input: UtmPayload): UtmPayload {
  const out: UtmPayload = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "landing_page",
    "plan_id",
    "user_id",
    "session_id",
  ] as const) {
    const v = input[key];
    if (typeof v === "string" && v && v.length < 200 && !v.includes("@")) out[key] = v;
  }
  if (input.service === "SA" || input.service === "MTD") out.service = input.service;
  else out.service = "UNKNOWN";
  if (typeof input.amount_gbp === "number" && Number.isFinite(input.amount_gbp)) {
    out.amount_gbp = input.amount_gbp;
  }
  out.currency = input.currency === "GBP" || !input.currency ? "GBP" : String(input.currency).slice(0, 8);
  return out;
}

export async function recordAttribution(
  kind: AttributionKind,
  payload: UtmPayload,
  actor = "system:attribution",
): Promise<{ recorded: boolean; reason?: string; id?: string }> {
  const clean = cleanUtm(payload);
  const idempotency_key =
    kind === "payment_confirmed" && clean.session_id
      ? `pay:${clean.session_id}`
      : kind === "lead_registration" && clean.user_id
        ? `lead:${clean.user_id}:${clean.utm_campaign || "none"}`
        : undefined;

  if (idempotency_key) {
    const existing = await col(ATTR).findOne({ idempotency_key });
    if (existing) return { recorded: false, reason: "duplicate_prevented", id: String(existing.id) };
  }

  const id = randomUUID();
  await col(ATTR).insertOne({
    id,
    kind,
    at: new Date().toISOString(),
    idempotency_key: idempotency_key ?? null,
    ...clean,
  });
  await appendAudit(actor, `attribution:${kind}`, idempotency_key || id);
  return { recorded: true, id };
}

export async function buildAttributionReport(): Promise<{
  generatedAt: string;
  leads: number;
  paidCustomers: number;
  revenueGbp: number | null;
  revenueState: "ok" | "no_data";
  byCampaign: Array<{
    utm_campaign: string;
    leads: number;
    paid: number;
    revenueGbp: number;
  }>;
  notes: string[];
  stripeJoin: {
    paidTransactions: number;
    attributedPayments: number;
    unattributedPayments: number;
  };
}> {
  const leads = await col(ATTR).countDocuments({ kind: "lead_registration" });
  const paidEvents = (await col(ATTR)
    .find({ kind: "payment_confirmed" })
    .toArray()) as Doc[];
  const paidCustomers = paidEvents.length;
  let revenue = 0;
  let revenueUsed = 0;
  for (const e of paidEvents) {
    const n = typeof e.amount_gbp === "number" ? e.amount_gbp : Number(e.amount_gbp);
    if (Number.isFinite(n)) {
      revenue += n;
      revenueUsed += 1;
    }
  }

  const pipeline = await col(ATTR)
    .aggregate([
      {
        $group: {
          _id: { campaign: "$utm_campaign", kind: "$kind" },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$amount_gbp", 0] } },
        },
      },
    ])
    .toArray();

  const map = new Map<string, { utm_campaign: string; leads: number; paid: number; revenueGbp: number }>();
  for (const row of pipeline) {
    const campaign = String((row._id as Doc)?.campaign || "(none)");
    const kind = String((row._id as Doc)?.kind || "");
    const cur = map.get(campaign) || { utm_campaign: campaign, leads: 0, paid: 0, revenueGbp: 0 };
    if (kind === "lead_registration") cur.leads += Number(row.count || 0);
    if (kind === "payment_confirmed") {
      cur.paid += Number(row.count || 0);
      cur.revenueGbp += Number(row.revenue || 0);
    }
    map.set(campaign, cur);
  }

  const paidTx = await col("payment_transactions").countDocuments({
    payment_status: { $in: ["paid", "succeeded", "complete", "COMPLETED"] },
    ...OPERATIONAL_ONLY,
  });
  const attributedPayments = paidCustomers;
  const unattributedPayments = Math.max(0, paidTx - attributedPayments);

  return {
    generatedAt: new Date().toISOString(),
    leads,
    paidCustomers,
    revenueGbp: revenueUsed ? Math.round(revenue * 100) / 100 : null,
    revenueState: revenueUsed ? "ok" : "no_data",
    byCampaign: [...map.values()].sort((a, b) => b.paid - a.paid || b.leads - a.leads),
    notes: [
      "Leads = registration attribution events (non-PII).",
      "Paid customers = confirmed Stripe payment attribution events (deduped by session_id).",
      "Revenue = sum of attributed payment amounts only — not impressions or post counts.",
      "UTM must be posted from the client journey; missing UTMs appear as (none) / unattributed.",
    ],
    stripeJoin: {
      paidTransactions: paidTx,
      attributedPayments,
      unattributedPayments,
    },
  };
}
