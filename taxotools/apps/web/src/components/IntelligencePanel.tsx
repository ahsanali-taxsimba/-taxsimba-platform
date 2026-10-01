"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MetricTile,
  DonutBreakdown,
  BarSeries,
  Sparkline,
  ActionRow,
} from "@/components/dashboard/ChartKit";
import {
  SectionHeader,
  MetricCard,
  ChartContainer,
  Card,
  Button,
  StatusTag,
  SmartTable,
  FadeIn,
  SplitView,
  Stagger,
  StaggerItem,
} from "@/ui";

type Coverage = {
  firms_total?: number;
  firms_crawled?: number;
  geo_profiles?: number;
  seo_pages?: number;
  backlinks?: number;
  firms_pending_crawl?: number;
};

type FirmRow = {
  id?: string;
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
    const rows = (!q
      ? firms
      : firms.filter(
          (f) =>
            f.company_name?.toLowerCase().includes(q) ||
            f.domain?.toLowerCase().includes(q) ||
            f.location?.toLowerCase().includes(q),
        )
    ).map((f, i) => ({ ...f, id: f.domain || f.company_name || String(i) }));
    return rows;
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
        <SectionHeader
          eyebrow="UK accountancy market graph"
          title="Intelligence dashboard"
          description="Coverage, firm scorecards, SEO/AEO signals, and lead-ready lists — glass + neu research cockpit."
        />
      </FadeIn>

      {error && (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <MetricCard
            label="Firms in graph"
            value={loading ? 0 : total}
            hint={`${crawled} crawled`}
            trend={total ? 5 : 0}
            gradient
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="SEO pages" value={loading ? 0 : coverage?.seo_pages ?? 0} />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Backlinks stored"
            value={loading ? 0 : coverage?.backlinks ?? 0}
            trend={3}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricTile label="GEO profiles" value={loading ? "…" : coverage?.geo_profiles ?? "—"} />
        </StaggerItem>
        <StaggerItem>
          <MetricTile label="Pending crawl" value={loading ? "…" : pending} tone="warn" />
        </StaggerItem>
        <StaggerItem>
          <MetricTile label="Listed now" value={firms.length} hint="Sample in this view">
            <Sparkline
              points={[
                Math.max(0, crawled - 400),
                Math.max(0, crawled - 250),
                Math.max(0, crawled - 120),
                crawled,
              ]}
            />
          </MetricTile>
        </StaggerItem>
      </Stagger>

      <SplitView
        primaryRatio="lg"
        primary={
          <ChartContainer title="Top locations in sample" description="Firm density by city / region">
            {locationBars.length ? (
              <BarSeries items={locationBars} color="#2997FF" />
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {loading ? "Loading…" : "No location data yet."}
              </p>
            )}
          </ChartContainer>
        }
        secondary={
          <ChartContainer title="Crawl coverage" description="How much of the UK firm set is enriched">
            <DonutBreakdown
              segments={[
                { label: "Crawled", value: crawled || 1, color: "#0071E3" },
                { label: "Pending", value: pending || 0, color: "#D2D2D7" },
              ]}
              centerLabel="firms"
              centerValue={total || "—"}
            />
          </ChartContainer>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card surface="neu" className="xl:col-span-2">
          <h2 className="font-display text-xl font-semibold">Firm lookup</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Pull the SEO / AEO / competitor bundle</p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void lookupFirm();
            }}
          >
            <input
              className="w-full flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2 outline-none ring-[var(--accent-blue)] focus:ring-2"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="sedulo.co.uk"
              data-testid="intel-domain-input"
            />
            <Button type="submit" disabled={lookingUp}>
              {lookingUp ? "Loading…" : "Lookup"}
            </Button>
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
        </Card>

        <div className="xl:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Firm directory</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Click a company to load its intelligence card
              </p>
            </div>
            <input
              className="w-full max-w-xs rounded-pill border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2 text-sm outline-none ring-[var(--accent-blue)] focus:ring-2"
              placeholder="Filter by name, domain, city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="intel-filter"
            />
          </div>
          <SmartTable
            rows={filtered}
            columns={[
              {
                id: "company",
                header: "Company",
                sticky: true,
                render: (row) => (
                  <button
                    type="button"
                    className="text-left font-medium text-[var(--accent-blue)] hover:underline"
                    onClick={() => void lookupFirm(row.domain)}
                  >
                    {row.company_name || "—"}
                  </button>
                ),
              },
              {
                id: "domain",
                header: "Domain",
                render: (row) => row.domain || "—",
              },
              {
                id: "location",
                header: "Location",
                render: (row) => row.location || "—",
              },
              {
                id: "status",
                header: "Status",
                render: (row) => (
                  <StatusTag
                    label={row.crawl_status || "—"}
                    tone={
                      row.crawl_status === "crawled" || row.crawl_status === "done"
                        ? "success"
                        : "info"
                    }
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
