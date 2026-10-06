"use client";

/**
 * G-008 / H-010 — MTD period actions on manage-tax:
 * - Show published/draft figures for Admin review (MTD only; not SA F-008)
 * - Admin-approve (publish to client) when in ADMIN_REVIEW
 * - Record external quarterly submission (no HMRC API)
 */
import React, { useCallback, useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import { toast } from "react-toastify";
import { nativeApiUrl } from "@/lib/nativeApiUrl";

type Period = {
  id: string;
  label?: string;
  quarter?: number;
  kind?: string;
  status?: string;
  stage_label?: string;
  draft?: Record<string, unknown> | null;
  published?: Record<string, unknown> | null;
  submission_reference?: string | null;
  submission_date?: string | null;
};

type Props = {
  caseId: string;
  onChanged?: () => void;
};

async function authFetch(path: string, init?: RequestInit) {
  const session = await getSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken;
  const res = await fetch(nativeApiUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { detail?: string; message?: string })?.detail
      || (body as { message?: string })?.message
      || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function money(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `£${n.toFixed(2)}`;
}

export default function MtdPeriodActionsPanel({ caseId, onChanged }: Props) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { date: string; reference: string; provider: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await authFetch(`/api/mtd/cases/${encodeURIComponent(caseId)}/periods`)) as Period[];
      setPeriods(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load MTD periods");
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (periodId: string) => {
    setBusyId(periodId);
    try {
      await authFetch(`/api/mtd/periods/${encodeURIComponent(periodId)}/admin-approve`, {
        method: "POST",
        body: "{}",
      });
      toast.success("Figures published — client can now review");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish figures");
    } finally {
      setBusyId(null);
    }
  };

  const recordSubmission = async (periodId: string) => {
    const form = forms[periodId] || { date: "", reference: "", provider: "" };
    if (!form.date.trim() || !form.reference.trim()) {
      toast.error("Submission date and reference are required");
      return;
    }
    setBusyId(periodId);
    try {
      await authFetch(`/api/mtd/periods/${encodeURIComponent(periodId)}/record-submission`, {
        method: "POST",
        body: JSON.stringify({
          submission_date: form.date.trim(),
          submission_reference: form.reference.trim(),
          provider: form.provider.trim() || null,
        }),
      });
      toast.success("External MTD submission recorded");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record submission");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-500" data-testid="mtd-period-panel-loading">
        Loading MTD periods…
      </div>
    );
  }

  if (!periods.length) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="mtd-period-actions-panel">
      <div>
        <h3 className="text-lg font-medium text-gray-900">MTD quarterly periods</h3>
        <p className="text-sm text-gray-500 mt-1">
          Review figures, publish to the client, and record external quarterly submissions.
          TaxSimba does not connect to HMRC.
        </p>
      </div>
      {periods.map((p) => {
        const figures = (p.published || p.draft || null) as Record<string, unknown> | null;
        const status = String(p.status || "");
        const form = forms[p.id] || { date: "", reference: "", provider: "" };
        return (
          <div
            key={p.id}
            className="border border-gray-200 rounded-lg p-4"
            data-testid={`mtd-period-card-${p.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <div className="font-semibold text-sm text-gray-900">
                  {p.label || (p.kind === "FINAL_DECLARATION" ? "Final Declaration" : `Q${p.quarter}`)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Status: {p.stage_label || status}
                </div>
              </div>
              {status === "ADMIN_REVIEW" ? (
                <button
                  type="button"
                  data-testid={`mtd-publish-${p.id}`}
                  disabled={busyId === p.id}
                  onClick={() => void publish(p.id)}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === p.id ? "Publishing…" : "Publish figures to client"}
                </button>
              ) : null}
            </div>

            {figures ? (
              <div
                className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 bg-gray-50 rounded-lg p-3"
                data-testid={`mtd-figures-${p.id}`}
              >
                <div>
                  <div className="text-xs text-gray-500">Income</div>
                  <div className="text-sm font-semibold">{money(figures.income)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Expenses</div>
                  <div className="text-sm font-semibold">{money(figures.expenses)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Net profit</div>
                  <div className="text-sm font-semibold">{money(figures.net_profit)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Est. income tax</div>
                  <div className="text-sm font-semibold">{money(figures.estimated_income_tax)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Est. NI</div>
                  <div className="text-sm font-semibold">{money(figures.estimated_national_insurance)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Suggested set-aside</div>
                  <div className="text-sm font-semibold">{money(figures.suggested_set_aside)}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mb-3">No figures saved for this period yet.</p>
            )}

            {status === "SUBMITTED" ? (
              <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3" data-testid={`mtd-submitted-${p.id}`}>
                External submission recorded
                {p.submission_reference ? ` · ref ${p.submission_reference}` : ""}
                {p.submission_date ? ` · ${p.submission_date}` : ""}
              </div>
            ) : status === "APPROVED" ? (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2" data-testid={`mtd-record-submission-${p.id}`}>
                <div className="text-sm font-semibold text-amber-900">Record external submission</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="date"
                    className="border rounded-lg px-2 py-1.5 text-sm"
                    value={form.date}
                    data-testid={`mtd-sub-date-${p.id}`}
                    onChange={(e) =>
                      setForms((prev) => ({ ...prev, [p.id]: { ...form, date: e.target.value } }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Submission reference"
                    className="border rounded-lg px-2 py-1.5 text-sm"
                    value={form.reference}
                    data-testid={`mtd-sub-ref-${p.id}`}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [p.id]: { ...form, reference: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Provider (optional)"
                    className="border rounded-lg px-2 py-1.5 text-sm"
                    value={form.provider}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [p.id]: { ...form, provider: e.target.value },
                      }))
                    }
                  />
                </div>
                <button
                  type="button"
                  data-testid={`mtd-record-sub-btn-${p.id}`}
                  disabled={busyId === p.id}
                  onClick={() => void recordSubmission(p.id)}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === p.id ? "Saving…" : "Record submission"}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
