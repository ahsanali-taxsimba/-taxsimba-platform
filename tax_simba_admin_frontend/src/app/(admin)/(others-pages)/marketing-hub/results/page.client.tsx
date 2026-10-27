"use client";

import React, { useCallback, useEffect, useState } from "react";
import { HubShell, StatePill, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

const LABELS: Record<string, string> = {
  facebook_pages: "Facebook Pages",
  instagram_professional: "Instagram professional",
  linkedin_company: "LinkedIn Company Pages",
  google_ads: "Google Ads (owner-controlled spend)",
  google_search_console: "Google Search Console",
  google_analytics_4: "Google Analytics 4",
  tiktok_manual: "TikTok (manual only)",
};

export default function ResultsClient() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [oauthNote, setOauthNote] = useState("");
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [c, d] = await Promise.all([
      marketingHubApi.connections(),
      marketingHubApi.drafts(),
    ]);
    setItems(c.items || []);
    setOauthNote(c.oauthNote || "");
    setDrafts(d.items || []);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e?.message || e)));
  }, [refresh]);

  const begin = async (platform: string, mockUiPreview?: boolean) => {
    setError(null);
    setMessage(null);
    try {
      const res = await marketingHubApi.beginConnect(platform, mockUiPreview);
      setMessage(JSON.stringify(res, null, 2));
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connect failed");
    }
  };

  const disconnect = async (platform: string) => {
    await marketingHubApi.disconnect(platform);
    await refresh();
  };

  const loadTikTok = async (id: string) => {
    const p = await marketingHubApi.tiktokPack(id);
    setPack(p);
  };

  const tryPublish = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await marketingHubApi.publish(id, [
        "facebook_pages",
        "linkedin_company",
        "tiktok_manual",
        "google_ads",
      ]);
      setMessage(res.note + "\n" + JSON.stringify(res.draft?.platformResults || [], null, 2));
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish blocked (expected without authorisation/credentials).");
    }
  };

  return (
    <HubShell
      title="Results & Connections"
      subtitle="Official OAuth when client IDs are configured. TikTok is manual-only. Google Ads spend stays owner-controlled."
    >
      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm whitespace-pre-wrap text-amber-900">
          {error}
        </p>
      ) : null}
      {message ? (
        <pre className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
          {message}
        </pre>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Connect accounts
        </h2>
        <p className="mt-1 text-xs text-gray-500">{oauthNote}</p>
        <ul className="mt-4 space-y-3">
          {items.map((c) => {
            const platform = String(c.platform);
            const status = String(c.status);
            return (
              <li
                key={platform}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
              >
                <div>
                  <p className="font-medium">{LABELS[platform] || platform}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatePill
                      state={
                        status === "not_connected"
                          ? "not_connected"
                          : status === "connected"
                            ? "ok"
                            : "no_data"
                      }
                    />
                    <span className="text-xs text-gray-500">
                      last sync: {c.lastSyncAt ? String(c.lastSyncAt) : "—"} · credentials:{" "}
                      {c.hasCredentials ? "yes" : "no"}
                    </span>
                  </div>
                  {c.lastError ? (
                    <p className="mt-1 text-xs text-red-600">{String(c.lastError)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {platform === "tiktok_manual" ? (
                    <span className="text-xs text-gray-500">Manual packs only</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => begin(platform)}
                      >
                        Begin OAuth
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-gray-600"
                        onClick={() => begin(platform, true)}
                        title="UI preview only — remains Not Connected"
                      >
                        UI preview (not connected)
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => disconnect(platform)}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold" style={{ color: BRAND.forest }}>
          Publishing history / TikTok packs
        </h2>
        {!drafts.length ? (
          <p className="mt-3 text-sm text-gray-500">No Data — create drafts in AI Marketing first.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {drafts.slice(0, 10).map((d) => (
              <li key={String(d.id)} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                <span>
                  {String(d.title)} · <code>{String(d.stage)}</code>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => loadTikTok(String(d.id))}
                  >
                    TikTok pack
                  </button>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => tryPublish(String(d.id))}
                  >
                    Attempt publish
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {pack ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
            {JSON.stringify(pack, null, 2)}
          </pre>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: BRAND.forest }}
          onClick={async () => {
            const res = await marketingHubApi.pause(true);
            setMessage(JSON.stringify(res, null, 2));
          }}
        >
          Emergency pause ON
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
          style={{ color: BRAND.forest, borderColor: BRAND.lime }}
          onClick={async () => {
            const res = await marketingHubApi.pause(false);
            setMessage(JSON.stringify(res, null, 2));
          }}
        >
          Emergency pause OFF
        </button>
      </div>
    </HubShell>
  );
}
