"use client";

import React, { useCallback, useEffect, useState } from "react";
import { HubShell, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

export default function AiMarketingClient() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [assetSummary, setAssetSummary] = useState<Record<string, unknown> | null>(null);
  const [batch, setBatch] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState("TS-001");

  const refresh = useCallback(async () => {
    const [s, t, d, a] = await Promise.all([
      marketingHubApi.status(),
      marketingHubApi.templates(batch),
      marketingHubApi.drafts(),
      marketingHubApi.assets(),
    ]);
    setStatus(s);
    setTemplates(t);
    setDrafts(d.items || []);
    setAssets((a.items as Array<Record<string, unknown>>) || []);
    setAssetSummary((a.summary as Record<string, unknown>) || null);
  }, [batch]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e?.message || e)));
  }, [refresh]);

  const generation = (status?.generation as Record<string, unknown>) || {};

  const runDaily = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await marketingHubApi.runDaily();
      const created = Array.isArray(res.created) ? (res.created as unknown[]).length : 0;
      if (res.generationStatus === "disconnected" || res.mode === "disconnected") {
        setError(
          String(
            res.skippedReason ||
              "Generation disconnected — configure MARKETING_HUB_GENERATION_API_KEY or enable fixture mode.",
          ),
        );
      } else {
        setMessage(
          `Engine status=${String(res.generationStatus)} mode=${String(res.mode)} created=${created}. ${
            res.skippedReason ? String(res.skippedReason) : ""
          }`,
        );
      }
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(
        err?.response?.data?.detail ||
          (e instanceof Error ? e.message : "Daily engine failed (SUPER_ADMIN required)."),
      );
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
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || (e instanceof Error ? e.message : "Advance failed"));
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await marketingHubApi.uploadAsset(uploadSlot, file);
      setMessage(`Uploaded ${file.name} → ${uploadSlot} (pending review — not finished artwork).`);
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || (e instanceof Error ? e.message : "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const items = (templates?.items as Array<Record<string, unknown>>) || [];
  const genMode = String(generation.mode || "unknown");

  return (
    <HubShell
      title="AI Marketing"
      subtitle="Draft → Review → Approved → Scheduled. SA and MTD stay separate. Unsupported claims are blocked before schedule."
    >
      <div
        className="rounded-xl border p-4 text-sm"
        role="status"
        aria-live="polite"
        style={{
          borderColor: genMode === "disconnected" ? "#f59e0b" : BRAND.lime,
          background: genMode === "disconnected" ? "#fffbeb" : BRAND.mint,
          color: BRAND.forest,
        }}
      >
        <strong>Generation:</strong> {genMode}
        <span className="ml-2 text-xs">{String(generation.note || "")}</span>
        {status?.paused ? (
          <p className="mt-1 font-semibold text-amber-800">Emergency pause is ON.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={runDaily}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: BRAND.green }}
          aria-label="Run daily AI marketing engine"
        >
          Run daily engine
        </button>
        <label className="text-sm text-gray-600" htmlFor="template-batch">
          Template batch{" "}
          <select
            id="template-batch"
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
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {error}
        </p>
      ) : null}

      <section
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        aria-labelledby="assets-heading"
      >
        <h2 id="assets-heading" className="font-semibold" style={{ color: BRAND.forest }}>
          Marketing assets TS-001 – TS-120
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {String(assetSummary?.note || "")} Uploaded {String(assetSummary?.uploaded ?? 0)} · Pending{" "}
          {String(assetSummary?.pendingReview ?? 0)} · Approved {String(assetSummary?.approved ?? 0)}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm" htmlFor="asset-slot">
            Slot
            <select
              id="asset-slot"
              className="ml-2 rounded border px-2 py-1"
              value={uploadSlot}
              onChange={(e) => setUploadSlot(e.target.value)}
            >
              {Array.from({ length: 120 }, (_, i) => `TS-${String(i + 1).padStart(3, "0")}`).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm" htmlFor="asset-file">
            High-res image (≥1080px)
            <input
              id="asset-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="ml-2 block text-xs"
              onChange={(e) => onUpload(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <ul className="mt-4 grid max-h-64 gap-2 overflow-auto md:grid-cols-3" aria-label="Asset slots">
          {assets
            .filter((a) => a.storedPath || Number(a.slot) <= 12)
            .slice(0, 24)
            .map((a) => (
              <li key={String(a.id)} className="rounded border border-gray-100 p-2 text-xs">
                <strong>{String(a.id)}</strong> · {String(a.approvalStatus)}
                {a.width ? ` · ${a.width}×${a.height}` : ""}
                <div className="mt-1 text-[11px] text-gray-500">
                  finished={String(a.isFinishedArtwork)} · {String(a.originalFilename || "no file")}
                </div>
                {a.approvalStatus === "pending_review" ? (
                  <button
                    type="button"
                    className="mt-1 rounded border px-2 py-0.5"
                    onClick={() =>
                      marketingHubApi.approveAsset(String(a.id), true).then(refresh).catch((err) =>
                        setError(String(err?.response?.data?.detail || err.message || err)),
                      )
                    }
                  >
                    Approve artwork
                  </button>
                ) : null}
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Template library ({String(templates?.total ?? "—")} · batches of 10)
        </h2>
        <p className="mt-1 text-xs text-gray-500">{String(templates?.note || "")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <div key={String(t.id)} className="rounded-xl border border-gray-100 p-3">
              <p className="text-xs font-mono text-gray-500">
                {String(t.id)} ↔ {String(t.assetId)}
              </p>
              <p className="font-medium" style={{ color: BRAND.forest }}>
                {String(t.title)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {String(t.focus)} · template {String(t.status)} · artwork {String(t.artworkStatus)}
                {t.linkedAsset
                  ? ` · asset ${(t.linkedAsset as Record<string, unknown>).approvalStatus}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Workflow queue (Draft → Review → Approved → Scheduled)
        </h2>
        {!drafts.length ? (
          <p className="mt-3 text-sm text-gray-500">No Data — run the daily engine (fixture) or configure real generation.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {drafts.map((d) => (
              <li key={String(d.id)} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(d.title)}</p>
                    <p className="text-xs text-gray-500">
                      {String(d.workflowLabel || d.stage)} · fixture={String(d.fixtureMode)} ·{" "}
                      {String(d.focus)} · {String(d.nation)}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">{String(d.caption)}</p>
                    {Array.isArray(d.claimIssues) && (d.claimIssues as unknown[]).length ? (
                      <p className="mt-1 text-xs text-red-700" role="alert">
                        Claim issues:{" "}
                        {(d.claimIssues as Array<{ message: string }>).map((i) => i.message).join(" ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.stage === "ai_draft" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => advance(String(d.id), "content_qa")}>
                        Send to Review
                      </button>
                    ) : null}
                    {d.stage === "content_qa" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => advance(String(d.id), "approval")}>
                        Mark Approved
                      </button>
                    ) : null}
                    {d.stage === "approval" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => advance(String(d.id), "scheduled")}>
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
