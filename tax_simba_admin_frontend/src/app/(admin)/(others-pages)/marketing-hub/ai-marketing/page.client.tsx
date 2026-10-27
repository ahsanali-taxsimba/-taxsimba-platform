"use client";

import React, { useCallback, useEffect, useState } from "react";
import { HubShell, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

export default function AiMarketingClient() {
  const [templates, setTemplates] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [batch, setBatch] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [t, d] = await Promise.all([
      marketingHubApi.templates(batch),
      marketingHubApi.drafts(),
    ]);
    setTemplates(t);
    setDrafts(d.items || []);
  }, [batch]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e?.message || e)));
  }, [refresh]);

  const runDaily = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await marketingHubApi.runDaily();
      setMessage(
        `Daily engine: created ${Array.isArray(res.created) ? (res.created as unknown[]).length : 0}. Search demand: ${res.searchDemandEvidence || "unavailable"}.`,
      );
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Daily engine failed (SUPER_ADMIN required).");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (id: string, stage: string) => {
    setBusy(true);
    setError(null);
    try {
      await marketingHubApi.advance(id, stage);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Advance failed");
    } finally {
      setBusy(false);
    }
  };

  const items = (templates?.items as Array<Record<string, unknown>>) || [];

  return (
    <HubShell
      title="AI Marketing"
      subtitle="Daily British-English drafts, approval queue, 120-template library. Artwork is never marked approved while missing."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={runDaily}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: BRAND.green }}
        >
          Run daily engine
        </button>
        <label className="text-sm text-gray-600">
          Template batch{" "}
          <select
            className="ml-2 rounded border px-2 py-1"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Template library ({String(templates?.total ?? "—")} total · batches of 10)
        </h2>
        <p className="mt-1 text-xs text-gray-500">{String(templates?.note || "")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <div key={String(t.id)} className="rounded-xl border border-gray-100 p-3">
              <p className="text-xs font-mono text-gray-500">{String(t.id)}</p>
              <p className="font-medium" style={{ color: BRAND.forest }}>
                {String(t.title)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {String(t.focus)} · status {String(t.status)} · artwork {String(t.artworkStatus)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Approval queue & calendar drafts
        </h2>
        {!drafts.length ? (
          <p className="mt-3 text-sm text-gray-500">No Data — run the daily engine to create fixture drafts.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {drafts.map((d) => (
              <li key={String(d.id)} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(d.title)}</p>
                    <p className="text-xs text-gray-500">
                      stage={String(d.stage)} · fixture={String(d.fixtureMode)} ·{" "}
                      {String(d.nation)}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">{String(d.caption)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.stage === "ai_draft" ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => advance(String(d.id), "content_qa")}
                      >
                        Send to QA
                      </button>
                    ) : null}
                    {d.stage === "content_qa" ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => advance(String(d.id), "approval")}
                      >
                        Approve copy
                      </button>
                    ) : null}
                    {d.stage === "approval" ? (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => advance(String(d.id), "scheduled")}
                      >
                        Schedule
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </HubShell>
  );
}
