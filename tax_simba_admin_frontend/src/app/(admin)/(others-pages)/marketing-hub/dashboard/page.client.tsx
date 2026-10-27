"use client";

import React, { useEffect, useState } from "react";
import { HubShell, StatePill, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

type Metric = {
  key: string;
  label: string;
  value: number | null;
  state: string;
  note?: string;
  unit?: string;
};

export default function DashboardClient() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dash = await marketingHubApi.dashboard();
        if (!cancelled) setData(dash);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e && typeof e === "object" && "message" in e
              ? String((e as { message?: string }).message)
              : "Could not load marketing dashboard. Check API auth and MARKETING_HUB_ENABLED.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = (data?.metrics as Metric[]) || [];
  const progress = data?.progress as
    | {
        mtd: { current: number | null; goal: number; by: string; state: string };
        sa: { current: number | null; goal: number; by: string; state: string };
      }
    | undefined;

  return (
    <HubShell
      title="Dashboard"
      subtitle="Real registrations and payments where available. Traffic and campaign results stay Not Connected / No Data until platforms sync."
    >
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {progress ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: BRAND.forest }}>
                MTD paying customers
              </h2>
              <StatePill state={progress.mtd.state} />
            </div>
            <p className="mt-3 text-3xl font-bold" style={{ color: BRAND.green }}>
              {progress.mtd.current ?? "—"}{" "}
              <span className="text-base font-medium text-gray-500">/ {progress.mtd.goal}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">Target by {progress.mtd.by} (not a guarantee)</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: BRAND.forest }}>
                Self Assessment paying customers
              </h2>
              <StatePill state={progress.sa.state} />
            </div>
            <p className="mt-3 text-3xl font-bold" style={{ color: BRAND.green }}>
              {progress.sa.current ?? "—"}{" "}
              <span className="text-base font-medium text-gray-500">/ {progress.sa.goal}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">Target by {progress.sa.by} (not a guarantee)</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.key}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-600">{m.label}</h3>
              <StatePill state={m.state} />
            </div>
            <p className="mt-3 text-2xl font-bold" style={{ color: BRAND.forest }}>
              {m.value === null || m.value === undefined
                ? "—"
                : m.unit === "GBP"
                  ? `£${Number(m.value).toLocaleString("en-GB")}`
                  : m.value}
            </p>
            {m.note ? <p className="mt-2 text-xs text-gray-500">{m.note}</p> : null}
          </div>
        ))}
      </div>
    </HubShell>
  );
}
