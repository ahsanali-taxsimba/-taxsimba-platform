"use client";

import { useEffect, useMemo, useState } from "react";
import { FadeIn, SlideUp, MotionButton } from "@/motion";
import {
  MetricTile,
  DonutBreakdown,
  BarSeries,
  Sparkline,
  ActionRow,
} from "@/components/dashboard/ChartKit";

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
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [covRes, listRes] = await Promise.all([
          fetch("/api/intelligence?resource=coverage"),
          fetch("/api/intelligence?resource=accountants&limit=40"),
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
    : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return firms;
    return firms.filter(
      (f) =>
        f.company_name?.toLowerCase().includes(q) ||
        f.domain?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q),
    );
  }, [firms, query]);

  const locationBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of firms) {
      const loc = (f.location || "Unknown").split(",")[0]?.trim() || "Unknown";
      map.set(loc, (map.get(loc) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label: label.slice(0, 10), value }));
  }, [firms]);

  const crawled = coverage?.firms_crawled ?? 0;
  const total = coverage?.firms_total ?? 0;
  const pending = coverage?.firms_pending_crawl ?? Math.max(total - crawled, 0);

  return (
    <div className="space-y-8" data-testid="intelligence-dashboard">
      <FadeIn>
        <div className="overflow-hidden rounded-3xl border border-ink-100 bg-grid-fade px-6 py-7 shadow-sm md:px-8">
          <p className="text-sm font-medium text-accent-dark">UK accountancy market graph</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink-950 md:text-4xl">
            Intelligence dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            Coverage, firm scorecards, SEO/AEO signals, and lead-ready lists — presented like an Auto
            SEO research cockpit.
          </p>
        </div>
      </FadeIn>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="Firms in graph"
          value={loading ? "…" : total}
          hint={`${crawled} crawled`}
          tone="accent"
        >
          <Sparkline
            points={[
              Math.max(0, crawled - 400),
              Math.max(0, crawled - 250),
              Math.max(0, crawled - 120),
              crawled,
            ]}
          />
        </MetricTile>
        <MetricTile label="SEO pages" value={loading ? "…" : coverage?.seo_pages ?? "—"} />
        <MetricTile
          label="Backlinks stored"
          value={loading ? "…" : coverage?.backlinks ?? "—"}
          tone="good"
        />
        <MetricTile label="GEO profiles" value={loading ? "…" : coverage?.geo_profiles ?? "—"} />
        <MetricTile label="Pending crawl" value={loading ? "…" : pending} tone="warn" />
        <MetricTile label="Listed now" value={firms.length} hint="Sample in this view" />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Crawl coverage</h2>
          <p className="mb-4 text-sm text-ink-500">How much of the UK firm set is enriched</p>
          <DonutBreakdown
            segments={[
              { label: "Crawled", value: crawled || 1, color: "#0F9F8F" },
              { label: "Pending", value: pending || 0, color: "#E8EDF5" },
            ]}
            centerLabel="firms"
            centerValue={total || "—"}
          />
        </SlideUp>

        <SlideUp delay={0.04} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="font-display text-xl font-semibold">Top locations in sample</h2>
          <p className="mb-4 text-sm text-ink-500">Firm density by city / region from the live list</p>
          {locationBars.length ? (
            <BarSeries items={locationBars} color="#38BDF8" />
          ) : (
            <p className="text-sm text-ink-500">{loading ? "Loading…" : "No location data yet."}</p>
          )}
        </SlideUp>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="font-display text-xl font-semibold">Firm lookup</h2>
          <p className="mt-1 text-sm text-ink-500">Pull the SEO / AEO / competitor bundle</p>
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
              data-testid="intel-domain-input"
            />
            <MotionButton type="submit" disabled={lookingUp}>
              {lookingUp ? "Loading…" : "Lookup"}
            </MotionButton>
          </form>

          {firm && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Company" value={firm.company_name || domain} />
              <MetricTile label="Location" value={firm.location || "—"} />
              <MetricTile label="Status" value={firm.crawl_status || "—"} />
              <MetricTile
                label="Signals"
                value={`${seoCount}/${aeoCount}/${competitorCount}`}
                hint="SEO · AEO · rivals"
                tone="accent"
              />
            </div>
          )}

          <div className="mt-5 space-y-2">
            <ActionRow
              title="Export lead ideas"
              detail="Open crawler lead filters for missing phone / website"
              href="https://taxotools-crawler.fly.dev/leads?limit=25"
              cta="Leads"
            />
            <ActionRow
              title="City markets"
              detail="Compare Manchester, London, Birmingham and more"
              href="https://taxotools-crawler.fly.dev/markets"
              cta="Markets"
            />
          </div>
        </SlideUp>

        <SlideUp delay={0.05} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Firm directory</h2>
              <p className="text-sm text-ink-500">Click a company to load its intelligence card</p>
            </div>
            <input
              className="w-full max-w-xs rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              placeholder="Filter by name, domain, city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="intel-filter"
            />
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
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
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dark">
                        {row.crawl_status || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                      No firms match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SlideUp>
      </div>
    </div>
  );
}
