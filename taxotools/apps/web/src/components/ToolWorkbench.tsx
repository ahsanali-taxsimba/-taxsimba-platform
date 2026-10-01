"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { FadeIn, SlideUp, MotionButton } from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

function rowsFromResult(result: Record<string, unknown> | null): unknown[] {
  if (!result) return [];
  const prefer = [
    "keywords",
    "suggestions",
    "pages",
    "actions",
    "features",
    "backlinks",
    "items",
    "prospects",
    "crawls",
    "ideas",
    "events",
    "posts",
    "templates",
    "adCopies",
    "paidKeywords",
    "products",
    "ads",
    "campaigns",
    "records",
    "citations",
    "aioFeatures",
    "visibility",
    "jobs",
    "missing",
    "publishes",
  ];
  for (const key of prefer) {
    const val = result[key];
    if (Array.isArray(val)) return val;
  }
  return [];
}

export function ToolWorkbench({
  siteId,
  toolId,
  toolName,
  description,
}: {
  siteId: string;
  toolId: string;
  toolName: string;
  description: string;
}) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [competitor, setCompetitor] = useState("semrush.com");

  async function load(input?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/tools/${toolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: input || {} }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    setResult(data);
    router.refresh();
  }

  async function runAction(action: string) {
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/tools/${toolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        input: {
          query: query || undefined,
          competitorDomain: competitor,
          domain: competitor,
          prompts: query ? query.split("\n").filter(Boolean) : undefined,
          keyword: query || undefined,
          keywords: query ? query.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : undefined,
        },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    if (data.result && typeof data.result === "object" && !Array.isArray(data.result)) {
      // action wrappers often return job; reload tool view
      await load({
        query: query || undefined,
        competitorDomain: competitor,
        domain: competitor,
        keyword: query || undefined,
      });
    } else {
      setResult(data.result || data);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, toolId]);

  const rows = useMemo(() => rowsFromResult(result), [result]);
  const columns = useMemo(() => {
    const first = rows[0];
    if (!first || typeof first !== "object") return [] as string[];
    return Object.keys(first as object).filter((k) => !["id", "siteId", "createdAt", "updatedAt", "draftText", "rawAnswer", "outputJson", "inputJson", "serpJson", "metadata", "scoreBreakdown", "suggestions", "relatedJson", "structureJson", "ideasJson", "titleIdeas", "outlineJson", "semanticsJson", "summaryJson", "variablesJson"].includes(k)).slice(0, 6);
  }, [rows]);

  const needsQuery = [
    "keyword-magic",
    "keyword-cpc",
    "seo-content-template",
    "seo-writing-assistant",
    "ai-writing-assistant",
    "topic-research",
    "ads-launch-assistant",
    "bulk-ai-content",
    "programmatic-seo",
    "content-genius",
    "website-studio",
    "topical-map",
    "scholar-research",
    "quest",
    "topical-dominance",
    "content-planner",
    "meta-generator",
    "content-rewriter",
    "bulk-url-analyzer",
    "agent-chat",
    "site-explorer",
    "domain-power",
    "knowledge-base",
  ].includes(toolId);

  const needsCompetitor = [
    "keyword-gap",
    "organic-research",
    "advertising-research",
    "pla-research",
  ].includes(toolId);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="font-display text-3xl font-semibold">{toolName}</h1>
        <p className="mt-1 text-ink-500">{description}</p>
      </FadeIn>

      <SlideUp>
      <div className="rounded-xl border border-ink-100 bg-white p-5">
        <div className="flex flex-wrap gap-3">
          {needsQuery && (
            <input
              className="min-w-[220px] flex-1 rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              placeholder="Keyword / topic / prompts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {needsCompetitor && (
            <input
              className="min-w-[180px] rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              placeholder="Competitor domain"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
            />
          )}
          <MotionButton
            type="button"
            disabled={busy}
            onClick={() =>
              load({
                query: query || undefined,
                competitorDomain: competitor,
                domain: competitor,
                keyword: query || undefined,
                keywords: query
                  ? query.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
                  : undefined,
                topic: query || undefined,
              })
            }
          >
            {busy ? "Running…" : "Run tool"}
          </MotionButton>
          {toolId === "position-tracking" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("run")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Refresh ranks
            </button>
          )}
          {toolId === "site-audit" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("crawl")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Start crawl
            </button>
          )}
          {toolId === "ai-visibility" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("scan")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Run AEO scan
            </button>
          )}
          {(toolId === "taxo-agent" || toolId === "auto-seo") && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction("scan")}
                className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
              >
                Scan & queue fixes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction("enable")}
                className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
              >
                Enable autopilot
              </button>
            </>
          )}
          {toolId === "taxo-pixel" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("install")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Mark pixel installed
            </button>
          )}
          {toolId === "approval-mode" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("toggle")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Toggle approval mode
            </button>
          )}
          {(toolId === "cms-publishing" || toolId === "content-genius") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("publish")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Publish to CMS
            </button>
          )}
          {toolId === "overnight-repair" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("run")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Run overnight repair
            </button>
          )}
          {toolId === "wildfire" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => load({})}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Match WILDFIRE exchanges
            </button>
          )}
          {toolId === "instant-indexing" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => load({})}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Submit IndexNow + GSC
            </button>
          )}
          {toolId === "orders-tasks" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => load({})}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Queue Autopilot tasks
            </button>
          )}
          {(toolId === "backlink-engine" || toolId === "backlink-analytics") && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction("init")}
                className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
              >
                seo.backlinks.init
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction("refresh")}
                className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
              >
                Refresh crawl
              </button>
            </>
          )}
          {(toolId === "crawler-master" || toolId === "deep-crawl" || toolId === "live-crawl") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("init")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              seo.crawler.master.init
            </button>
          )}
          {toolId === "disavow-manager" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction("export")}
              className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
            >
              Export disavow file
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
      </SlideUp>

      {result && (
        <SlideUp>
        <div className="rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-500">
          <p className="font-medium text-ink-800">Result summary</p>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
            {JSON.stringify(
              Object.fromEntries(
                Object.entries(result).filter(([k, v]) => !Array.isArray(v) || k === "summary"),
              ),
              null,
              2,
            ).slice(0, 1200)}
          </pre>
        </div>
        </SlideUp>
      )}

      {rows.length > 0 && (
        <div className="overflow-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <m.tbody
              key={toolId + String(rows.length)}
              variants={reduce ? reducedMotionVariants : staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {rows.slice(0, 50).map((row, idx) => {
                const obj = row as Record<string, unknown>;
                return (
                  <m.tr key={idx} variants={reduce ? reducedMotionVariants : staggerItem} className="border-b border-ink-50">
                    {columns.map((c) => (
                      <td key={c} className="max-w-[240px] truncate px-3 py-2">
                        {formatCell(obj[c])}
                      </td>
                    ))}
                  </m.tr>
                );
              })}
            </m.tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}
