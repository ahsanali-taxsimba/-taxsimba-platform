"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HubShell, BRAND } from "../_components/HubShell";
import { marketingHubApi } from "@/lib/marketingHub";

type Asset = Record<string, unknown>;

function previewUrl(id: string) {
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/compat\/?$/, "");
  return `${base}/api/marketing-hub/assets/${id}/preview`;
}

function downloadUrl(id: string) {
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/compat\/?$/, "");
  return `${base}/api/marketing-hub/assets/${id}/download`;
}

export default function ContentLibraryClient() {
  const [items, setItems] = useState<Asset[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authHeader, setAuthHeader] = useState("");

  const refresh = useCallback(async () => {
    const res = await marketingHubApi.assetsLibrary({
      q: q || undefined,
      category: category || undefined,
      uploadedOnly: true,
    });
    setItems((res.items as Asset[]) || []);
  }, [q, category]);

  useEffect(() => {
    (async () => {
      try {
        const { getSession } = await import("next-auth/react");
        const session = await getSession();
        const raw = session?.user?.accessToken as string | undefined;
        if (raw) setAuthHeader(raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`);
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load Content Library");
      }
    })();
  }, [refresh]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of items) if (a.category) set.add(String(a.category));
    return [...set].sort();
  }, [items]);

  const detail = items.find((a) => a.id === selected) || null;

  const setStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await marketingHubApi.setAssetPublication(id, status);
      setMessage(`${id} → ${status}`);
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err.message || "Status update failed");
    }
  };

  return (
    <HubShell
      title="Content Library"
      subtitle="Batch 01 permanent originals TS-001–TS-010. Draft / Awaiting Final QA. Auto-publish disabled."
    >
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm" htmlFor="lib-q">
          Search
          <input
            id="lib-q"
            className="ml-2 rounded border px-2 py-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ID, title, category"
          />
        </label>
        <label className="text-sm" htmlFor="lib-cat">
          Category
          <select
            id="lib-cat"
            className="ml-2 rounded border px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => refresh().catch((e) => setError(String(e)))}
        >
          Refresh
        </button>
        <p className="text-xs text-gray-500">{items.length} uploaded asset(s)</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm" role="status">
          {message}
        </p>
      ) : null}

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="content-library-grid"
        aria-label="Content Library grid"
      >
        {items.map((a) => {
          const id = String(a.id);
          return (
            <article
              key={id}
              className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
              style={{ borderColor: selected === id ? BRAND.green : undefined }}
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setSelected(id)}
                aria-label={`Open ${id} ${String(a.title || "")}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl(id)}
                  alt={String(a.altText || a.title || id)}
                  className="h-48 w-full object-cover bg-gray-50"
                  loading="lazy"
                  // Auth via cookie may fail; use fetch blob if needed — for same-origin Bearer we rely on img + session cookie if API accepts cookie.
                  onError={async (e) => {
                    try {
                      const res = await fetch(previewUrl(id), {
                        headers: authHeader ? { Authorization: authHeader } : {},
                      });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      (e.target as HTMLImageElement).src = URL.createObjectURL(blob);
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </button>
              <div className="p-3 space-y-1">
                <p className="text-xs font-mono text-gray-500">{id}</p>
                <h3 className="font-semibold text-sm" style={{ color: BRAND.forest }}>
                  {String(a.title || "—")}
                </h3>
                <p className="text-xs text-gray-500">{String(a.category || "")}</p>
                <p className="text-[11px] text-amber-800">
                  {String(a.publicationStatus || "draft_awaiting_qa")}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <a
                    className="rounded border px-2 py-0.5 text-[11px]"
                    href={downloadUrl(id)}
                    onClick={async (ev) => {
                      ev.preventDefault();
                      const res = await fetch(downloadUrl(id), {
                        headers: authHeader ? { Authorization: authHeader } : {},
                      });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const aEl = document.createElement("a");
                      aEl.href = url;
                      aEl.download = String(a.originalFilename || `${id}.png`);
                      aEl.click();
                    }}
                  >
                    Download original
                  </a>
                  <button
                    type="button"
                    className="rounded border px-2 py-0.5 text-[11px]"
                    onClick={() => setStatus(id, "scheduled")}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {detail ? (
        <section
          className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6"
          aria-labelledby="asset-detail-heading"
        >
          <h2 id="asset-detail-heading" className="font-semibold" style={{ color: BRAND.forest }}>
            {String(detail.id)} — {String(detail.title)}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {String(detail.width)}×{String(detail.height)} · sha256={String(detail.sha256 || "").slice(0, 16)}…
            · status={String(detail.publicationStatus)} · db={String(detail.databaseId || detail.id)}
          </p>
          <p className="text-xs text-gray-500">storage={String(detail.storedPath)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl(String(detail.id))}
            alt={String(detail.altText || detail.title)}
            className="mt-4 max-h-[70vh] w-auto max-w-full rounded border"
            onError={async (e) => {
              const res = await fetch(previewUrl(String(detail.id)), {
                headers: authHeader ? { Authorization: authHeader } : {},
              });
              if (!res.ok) return;
              (e.target as HTMLImageElement).src = URL.createObjectURL(await res.blob());
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setStatus(String(detail.id), "draft_awaiting_qa")}
            >
              Draft / Awaiting QA
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setStatus(String(detail.id), "approved")}
            >
              Mark copy approved
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setStatus(String(detail.id), "scheduled")}
            >
              Schedule
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm text-red-700"
              onClick={() => setStatus(String(detail.id), "published")}
              title="Should remain blocked"
            >
              Attempt Published (blocked)
            </button>
          </div>
        </section>
      ) : null}
    </HubShell>
  );
}
