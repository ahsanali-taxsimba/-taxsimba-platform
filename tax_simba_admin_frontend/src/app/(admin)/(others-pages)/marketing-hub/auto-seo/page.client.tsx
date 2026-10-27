"use client";

import React, { useEffect, useState } from "react";
import { HubShell, StatePill, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

export default function AutoSeoClient() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    marketingHubApi
      .seo()
      .then(setReport)
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  const preservation = report?.articlePreservation as
    | { expected: number; found: number; ok: boolean; note: string }
    | undefined;
  const google = report?.google as
    | { searchConsole: string; analytics4: string; note: string }
    | undefined;
  const recommendations = (report?.recommendations as Array<Record<string, unknown>>) || [];
  const guards = (report?.guards as string[]) || [];

  return (
    <HubShell
      title="Auto SEO"
      subtitle="Improve existing guides first. No invented volumes, no mass AI publishing, no artificial backlinks."
    >
      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-sm font-medium text-gray-600">Article preservation</h2>
          <p className="mt-2 text-2xl font-bold" style={{ color: BRAND.forest }}>
            {preservation ? `${preservation.found} / ${preservation.expected}` : "—"}
          </p>
          <div className="mt-2">
            <StatePill state={preservation?.ok ? "ok" : "no_data"} />
          </div>
          <p className="mt-2 text-xs text-gray-500">{preservation?.note}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-sm font-medium text-gray-600">Google Search Console</h2>
          <div className="mt-3">
            <StatePill
              state={
                google?.searchConsole === "not_connected" ? "not_connected" : "no_data"
              }
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">{google?.searchConsole}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-sm font-medium text-gray-600">Google Analytics 4</h2>
          <div className="mt-3">
            <StatePill
              state={google?.analytics4 === "not_connected" ? "not_connected" : "no_data"}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">{google?.analytics4}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Recommendations (human review required)
        </h2>
        <ul className="mt-4 space-y-3">
          {recommendations.map((r) => (
            <li key={String(r.id)} className="rounded-xl border border-gray-100 p-3">
              <p className="text-xs font-semibold text-gray-500">
                {String(r.priority)} · /blogs/{String(r.slug)}
              </p>
              <p className="font-medium">{String(r.title)}</p>
              <p className="mt-1 text-sm text-gray-700">{String(r.action)}</p>
              <p className="mt-1 text-xs text-gray-500">{String(r.rationale)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Guards
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {guards.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">{google?.note}</p>
      </section>
    </HubShell>
  );
}
