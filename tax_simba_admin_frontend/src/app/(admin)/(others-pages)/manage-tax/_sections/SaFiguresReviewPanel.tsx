"use client";

/**
 * F-008 — SA Admin figures review (Self Assessment only).
 * Admin must see calculation version figures before Approve Draft.
 * MTD period figures are a separate journey (G-006/G-008).
 */
import React, { useCallback, useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import { toast } from "react-toastify";
import { nativeApiUrl } from "@/lib/nativeApiUrl";

type Calc = {
  id: string;
  version?: number;
  total_income?: number;
  taxable_income?: number;
  tax_due?: number;
  is_refund?: boolean;
  notes?: string | null;
  payment_deadline?: string | null;
  is_locked?: boolean;
  is_approved?: boolean;
  created_by_name?: string | null;
  created_at?: string | null;
};

type Props = {
  caseId: string;
};

function money(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function authGet(path: string) {
  const session = await getSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken;
  const res = await fetch(nativeApiUrl(path), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string; message?: string })?.detail ||
        (body as { message?: string })?.message ||
        `HTTP ${res.status}`,
    );
  }
  return res.json();
}

export default function SaFiguresReviewPanel({ caseId }: Props) {
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await authGet(`/api/cases/${encodeURIComponent(caseId)}/calculations`)) as Calc[];
      setCalcs(Array.isArray(rows) ? rows : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load calculations";
      setError(msg);
      setCalcs([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="border border-gray-200 rounded-lg p-4 text-sm text-gray-500"
        data-testid="sa-figures-review-loading"
      >
        Loading SA calculation figures…
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5 space-y-4" data-testid="sa-figures-review-panel">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Self Assessment calculation figures</h3>
        <p className="text-sm text-gray-500 mt-1">
          Review the accountant&apos;s calculation versions before approving the draft for the client.
          This is separate from MTD quarterly figures.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" data-testid="sa-figures-review-error">
          {error}
        </p>
      ) : null}

      {!calcs.length && !error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="sa-figures-empty">
          No calculation versions yet. The accountant must create a calculation before Admin can review figures.
        </p>
      ) : null}

      {calcs.map((c) => (
        <div
          key={c.id}
          className="border border-gray-100 rounded-lg p-4 bg-gray-50"
          data-testid={`sa-calc-version-${c.version ?? c.id}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="font-semibold text-sm text-gray-900">
              Calculation Version {c.version ?? "—"}
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              {c.is_approved ? (
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Approved</span>
              ) : null}
              {c.is_locked ? (
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">Locked</span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Draft</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid={`sa-calc-figures-${c.id}`}>
            <div>
              <div className="text-xs text-gray-500 uppercase">Total income</div>
              <div className="text-sm font-semibold">{money(c.total_income)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Taxable income</div>
              <div className="text-sm font-semibold">{money(c.taxable_income)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">{c.is_refund ? "Refund" : "Tax due"}</div>
              <div className="text-sm font-semibold">{money(c.tax_due)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Payment deadline</div>
              <div className="text-sm font-semibold">{c.payment_deadline || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Prepared by</div>
              <div className="text-sm font-semibold">{c.created_by_name || "—"}</div>
            </div>
          </div>
          {c.notes ? (
            <p className="text-sm text-gray-600 mt-3" data-testid={`sa-calc-notes-${c.id}`}>
              {c.notes}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
