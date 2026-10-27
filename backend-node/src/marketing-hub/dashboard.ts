/** Dashboard metrics from real Mongo data — never fabricate traffic or revenue. */

import { OPERATIONAL_ONLY } from "../domain/testdata";
import { col, Doc } from "../db/mongo";
import { MARKETING_TARGETS } from "./config";
import { listConnections } from "./store";
import type { DashboardMetric } from "./types";

function metric(
  key: string,
  label: string,
  value: number | null,
  state: DashboardMetric["state"],
  note?: string,
  unit?: string,
): DashboardMetric {
  return { key, label, value, state, note, unit };
}

async function countPayingByService(serviceType: string): Promise<number> {
  // Prefer client_services active rows; fall back to successful payment_transactions.
  const services = await col("client_services").countDocuments({
    service_type: serviceType,
    status: { $in: ["ACTIVE", "active", "PAID", "paid"] },
    ...OPERATIONAL_ONLY,
  });
  if (services > 0) return services;

  const tx = await col("payment_transactions").countDocuments({
    payment_status: { $in: ["paid", "succeeded", "complete", "COMPLETED"] },
    $or: [{ service_type: serviceType }, { kind: serviceType }, { package_service_type: serviceType }],
    ...OPERATIONAL_ONLY,
  });
  return tx;
}

async function sumVerifiedRevenueGbp(): Promise<{ amount: number | null; state: DashboardMetric["state"]; note?: string }> {
  const rows = (await col("payment_transactions")
    .find({
      payment_status: { $in: ["paid", "succeeded", "complete", "COMPLETED"] },
      ...OPERATIONAL_ONLY,
    })
    .project({ amount: 1, amount_gbp: 1, total: 1, currency: 1 })
    .toArray()) as Doc[];

  if (!rows.length) {
    return { amount: null, state: "no_data", note: "No verified paid transactions in payment_transactions." };
  }

  let sum = 0;
  let used = 0;
  for (const r of rows) {
    const raw = r.amount_gbp ?? r.amount ?? r.total;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) {
      sum += n;
      used += 1;
    }
  }
  if (!used) {
    return { amount: null, state: "no_data", note: "Paid rows exist but amounts are missing or unreadable." };
  }
  return { amount: Math.round(sum * 100) / 100, state: "ok" };
}

export async function buildDashboard(): Promise<{
  generatedAt: string;
  targets: typeof MARKETING_TARGETS;
  metrics: DashboardMetric[];
  progress: {
    mtd: { current: number | null; goal: number; by: string; state: DashboardMetric["state"] };
    sa: { current: number | null; goal: number; by: string; state: DashboardMetric["state"] };
  };
  connectionsSummary: { connected: number; notConnected: number; manualOnly: number; errors: number };
}> {
  const connections = await listConnections();
  const gsc = connections.find((c) => c.platform === "google_search_console");
  const ga4 = connections.find((c) => c.platform === "google_analytics_4");

  const registrations = await col("users").countDocuments({
    role: "CLIENT",
    ...OPERATIONAL_ONLY,
  });

  const saPaying = await countPayingByService("SELF_ASSESSMENT");
  const mtdPaying = await countPayingByService("MTD_INCOME_TAX");
  const revenue = await sumVerifiedRevenueGbp();

  const metrics: DashboardMetric[] = [
    metric(
      "website_traffic",
      "UK website traffic",
      null,
      ga4?.status === "connected" ? "no_data" : "not_connected",
      ga4?.status === "connected"
        ? "GA4 connected but no synced traffic rows yet."
        : "Connect Google Analytics 4 to load real traffic.",
    ),
    metric(
      "registrations",
      "Registrations (CLIENT users)",
      registrations,
      "ok",
      "Operational CLIENT users only; excludes is_test where flagged.",
    ),
    metric(
      "paying_sa",
      "Paying Self Assessment customers",
      saPaying,
      saPaying === 0 ? "no_data" : "ok",
      saPaying === 0 ? "No verified SA active services/payments found." : undefined,
    ),
    metric(
      "paying_mtd",
      "Paying MTD customers",
      mtdPaying,
      mtdPaying === 0 ? "no_data" : "ok",
      mtdPaying === 0 ? "No verified MTD active services/payments found." : undefined,
    ),
    metric(
      "revenue_gbp",
      "Verified revenue",
      revenue.amount,
      revenue.state,
      revenue.note,
      "GBP",
    ),
    metric(
      "search_performance",
      "Search Console performance",
      null,
      gsc?.status === "connected" ? "no_data" : "not_connected",
      gsc?.status === "connected"
        ? "GSC connected but no synced query rows yet."
        : "Connect Google Search Console to load queries, impressions and CTR.",
    ),
    metric(
      "campaign_results",
      "Campaign publish results",
      null,
      "no_data",
      "No confirmed platform publications yet. Drafts never count as Published.",
    ),
  ];

  const connectionsSummary = {
    connected: connections.filter((c) => c.status === "connected").length,
    notConnected: connections.filter((c) => c.status === "not_connected").length,
    manualOnly: connections.filter((c) => c.status === "manual_only").length,
    errors: connections.filter((c) => c.status === "error" || c.status === "expired").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    targets: MARKETING_TARGETS,
    metrics,
    progress: {
      mtd: {
        current: mtdPaying === 0 ? null : mtdPaying,
        goal: MARKETING_TARGETS.mtdPayingGoal,
        by: MARKETING_TARGETS.mtdPayingBy,
        state: mtdPaying === 0 ? "no_data" : "ok",
      },
      sa: {
        current: saPaying === 0 ? null : saPaying,
        goal: MARKETING_TARGETS.saPayingGoal,
        by: MARKETING_TARGETS.saPayingBy,
        state: saPaying === 0 ? "no_data" : "ok",
      },
    },
    connectionsSummary,
  };
}
