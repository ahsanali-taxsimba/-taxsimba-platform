"use client";

import { useEffect, useState } from "react";
import { FadeIn, SlideUp, MotionButton } from "@/motion";

type Coverage = {
  firms_total?: number;
  firms_crawled?: number;
  geo_profiles?: number;
  seo_pages?: number;
  backlinks?: number;
  firms_pending_crawl?: number;
};

type FirmRow = {
  domain?: string;
  company_name?: string;
  location?: string;
  crawl_status?: string;
  website_url?: string;
  authority_score?: number | null;
};

export function IntelligencePanel() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [domain, setDomain] = useState("sedulo.co.uk");
  const [firmBundle, setFirmBundle] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [covRes, listRes] = await Promise.all([
          fetch("/api/intelligence?resource=coverage"),
          fetch("/api/intelligence?resource=accountants&limit=25"),
        ]);
        const covJson = await covRes.json();
        const listJson = await listRes.json();
        if (!covRes.ok) throw new Error(covJson.error || "Coverage failed");
        if (!listRes.ok) throw new Error(listJson.error || "Firm list failed");
        if (cancelled) return;
        setCoverage(covJson.data?.coverage || covJson.data || null);
        setFirms(listJson.data?.accountants || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load intelligence");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function lookupFirm(nextDomain?: string) {
    const d = (nextDomain || domain).trim().toLowerCase();
    if (!d) return;
    setDomain(d);
    setLookingUp(true);
    setError(null);
    try {
      const res = await fetch(`/api/intelligence?resource=firm&domain=${encodeURIComponent(d)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed");
      setFirmBundle(json.data);
    } catch (err) {
      setFirmBundle(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  const firm = (firmBundle?.firm || null) as FirmRow | null;
  const seoCount = Array.isArray(firmBundle?.seo) ? firmBundle!.seo.length : firmBundle?.seo ? 1 : 0;
  const aeoCount = Array.isArray(firmBundle?.aeo) ? firmBundle!.aeo.length : 0;
  const competitorCount = Array.isArray(firmBundle?.competitors)
    ? firmBundle!.competitors.length
    : typeof firmBundle?.count === "number"
      ? firmBundle.count
      : 0;

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="font-display text-3xl font-semibold text-ink-950">UK Intelligence</h1>
        <p className="mt-1 max-w-2xl text-ink-500">
          Live crawler data for UK accountancy firms — coverage, firm profiles, SEO, AEO, GEO,
          backlinks, and competitors. Available to signed-in trial accounts for testing.
        </p>
      </FadeIn>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <SlideUp>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Firms", coverage?.firms_total],
            ["Crawled", coverage?.firms_crawled],
            ["GEO profiles", coverage?.geo_profiles],
            ["SEO pages", coverage?.seo_pages],
            ["Backlinks", coverage?.backlinks],
            ["Pending crawl", coverage?.firms_pending_crawl],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-ink-100 bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink-900">
                {loading ? "…" : value ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </SlideUp>

      <SlideUp delay={0.05}>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-xl font-semibold">Firm lookup</h2>
          <p className="mt-1 text-sm text-ink-500">
            Pull the full intelligence bundle for any crawled domain.
          </p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void lookupFirm();
            }}
          >
            <input
              className="w-full flex-1 rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="sedulo.co.uk"
            />
            <MotionButton type="submit" disabled={lookingUp}>
              {lookingUp ? "Loading…" : "Lookup"}
            </MotionButton>
          </form>

          {firm && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-ink-500">Company</p>
                <p className="mt-1 font-medium text-ink-900">{firm.company_name || domain}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ink-500">Location</p>
                <p className="mt-1 font-medium text-ink-900">{firm.location || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ink-500">Status</p>
                <p className="mt-1 font-medium text-ink-900">{firm.crawl_status || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ink-500">Signals</p>
                <p className="mt-1 font-medium text-ink-900">
                  SEO {seoCount} · AEO {aeoCount} · rivals {competitorCount}
                </p>
              </div>
            </div>
          )}
        </div>
      </SlideUp>

      <SlideUp delay={0.08}>
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="font-display text-xl font-semibold">Recent firms</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((row) => (
                  <tr key={row.domain || row.company_name} className="border-b border-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      <button
                        type="button"
                        className="text-left text-accent-dark hover:underline"
                        onClick={() => void lookupFirm(row.domain)}
                      >
                        {row.company_name || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{row.domain}</td>
                    <td className="px-4 py-3 text-ink-600">{row.location || "—"}</td>
                    <td className="px-4 py-3 text-ink-600">{row.crawl_status || "—"}</td>
                  </tr>
                ))}
                {!loading && firms.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                      No firm rows returned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SlideUp>
    </div>
  );
}
