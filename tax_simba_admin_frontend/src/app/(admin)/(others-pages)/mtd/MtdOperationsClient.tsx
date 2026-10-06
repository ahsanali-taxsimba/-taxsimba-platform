"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";
import { nativeApiUrl } from "@/lib/nativeApiUrl";

type MtdStats = Record<string, number>;
type MtdPeriod = {
  id: string;
  case_id: string;
  client_name?: string;
  case_ref?: string;
  label?: string;
  tax_year?: string;
  period_start?: string;
  period_end?: string;
  deadline?: string;
  stage_label?: string;
  next_action?: string;
  next_action_owner?: string;
  assigned_accountant_name?: string;
  deadline_warning?: string | null;
  overdue_waiting_for_client?: boolean;
};

const CARDS: Array<{ key: string; label: string; bucket: string | null; tone: string }> = [
  { key: "admin_review", label: "Needs Admin Review", bucket: "admin_review", tone: "#7656C9" },
  { key: "waiting_for_client", label: "Waiting for Client", bucket: "waiting_for_client", tone: "#E6A23C" },
  { key: "overdue_waiting_client", label: "Overdue — waiting for client", bucket: "overdue_waiting_client", tone: "#D64545" },
  { key: "client_action", label: "Awaiting Client Approval", bucket: "client_action", tone: "#16A05D" },
  { key: "ready_submission", label: "Ready for Submission", bucket: "ready_submission", tone: "#16A05D" },
  { key: "due_14", label: "Due Within 14 Days", bucket: "due_14", tone: "#E6A23C" },
  { key: "overdue", label: "Overdue", bucket: "overdue", tone: "#D64545" },
  { key: "submitted", label: "Submitted / Completed", bucket: "submitted", tone: "#006B3C" },
  { key: "final_declarations", label: "Final Declarations Open", bucket: "final_declaration", tone: "#7656C9" },
  { key: "active_mtd_clients", label: "Active MTD Clients", bucket: null, tone: "#626A65" },
];

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v.length <= 10 ? `${v}T00:00:00Z` : v).toLocaleDateString("en-GB");
  } catch {
    return String(v).slice(0, 10);
  }
}

async function authGet<T>(path: string): Promise<T> {
  const session = await getSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken;
  const res = await fetch(nativeApiUrl(path), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export default function AdminMtdOperationsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const bucket = search.get("bucket") || "";
  const [stats, setStats] = useState<MtdStats>({});
  const [rows, setRows] = useState<MtdPeriod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, periods] = await Promise.all([
        authGet<MtdStats>("/api/mtd/stats"),
        authGet<MtdPeriod[]>(`/api/mtd/periods${bucket ? `?bucket=${encodeURIComponent(bucket)}` : ""}`),
      ]);
      setStats(s || {});
      setRows(Array.isArray(periods) ? periods : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load MTD operations");
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(
    () => (bucket ? `MTD periods · ${bucket.replace(/_/g, " ")}` : "All MTD periods"),
    [bucket],
  );

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="admin-mtd-operations">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">MTD Operations</h1>
        <p className="text-sm text-gray-600 mt-1">
          Making Tax Digital quarterly compliance — separate from Self Assessment.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            data-testid={`mtd-card-${card.key}`}
            disabled={!card.bucket}
            onClick={() => {
              if (!card.bucket) return;
              router.push(`/mtd?bucket=${encodeURIComponent(card.bucket)}`);
            }}
            className="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition disabled:cursor-default disabled:hover:shadow-sm"
            style={{ borderTop: `3px solid ${card.tone}` }}
          >
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{stats[card.key] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900" data-testid="mtd-periods-panel">
            {title}
          </h2>
          {bucket ? (
            <button
              type="button"
              data-testid="mtd-clear-bucket"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              onClick={() => router.push("/mtd")}
            >
              Clear filter
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 px-4 py-8 text-center">Loading…</p>
        ) : !rows.length ? (
          <p data-testid="mtd-op-empty" className="text-sm text-gray-500 px-4 py-8 text-center">
            No MTD periods in this view.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`mtd-op-row-${p.id}`}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 transition"
                  onClick={() => router.push(`/manage-tax/${p.case_id}`)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">
                        {p.client_name || "Client"} · {p.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {p.case_ref} · {p.tax_year} · {fmtDate(p.period_start)} – {fmtDate(p.period_end)} · due{" "}
                        {fmtDate(p.deadline)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Accountant: {p.assigned_accountant_name || "Unassigned"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Next: {p.next_action} ({p.next_action_owner})
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.deadline_warning ? (
                        <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-600">
                          {p.deadline_warning}
                        </span>
                      ) : null}
                      {p.overdue_waiting_for_client ? (
                        <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
                          Overdue — waiting for client
                        </span>
                      ) : null}
                      <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                        {p.stage_label || "—"}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">Open MTD period</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
