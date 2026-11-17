"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AppShell } from "./AppShell";
import { NewLeadModal } from "./NewLeadModal";
import { SourceBadge } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";
import { formatRelative } from "@/lib/format";

type Lead = {
  id: string;
  source: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  created_at: string;
};

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
};

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [sampleDatabase, setSampleDatabase] = useState(false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (source) params.set("source", source);
      if (status) params.set("status", status);

      const [meRes, leadsRes, statsRes] = await Promise.all([
        fetch("/api/me"),
        fetch(`/api/leads?${params}`),
        fetch("/api/stats"),
      ]);

      if (!meRes.ok || !leadsRes.ok || !statsRes.ok) {
        throw new Error("Failed to load leads");
      }

      const me = (await meRes.json()) as {
        name?: string;
        sampleDatabase?: boolean;
      };
      const leadsData = (await leadsRes.json()) as { leads: Lead[] };
      const statsData = (await statsRes.json()) as { stats: Stats };

      setViewerName(me.name || "You");
      setSampleDatabase(Boolean(me.sampleDatabase));
      setLeads(leadsData.leads);
      setStats(statsData.stats);

      if (leadsData.leads.length === 0) {
        await fetch("/api/seed", { method: "POST" });
        const again = await fetch(`/api/leads?${params}`);
        const againData = (await again.json()) as { leads: Lead[] };
        setLeads(againData.leads);
        const statsAgain = await fetch("/api/stats");
        const statsAgainData = (await statsAgain.json()) as { stats: Stats };
        setStats(statsAgainData.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [q, source, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      viewerName={viewerName}
      sampleDatabase={sampleDatabase}
      onNewLead={() => setModalOpen(true)}
    >
      <div className="space-y-6">
        <section className="animate-rise rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow)] md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight md:text-4xl">
                LeadInbox
              </p>
              <h1 className="mt-2 max-w-xl text-lg font-medium text-[var(--ink-soft)] md:text-xl">
                Capture Outlook, WhatsApp Business, and website form enquiries in one database.
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              data-testid="refresh-leads"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-[var(--mist)]"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="stagger mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total leads" value={stats?.total ?? 0} testId="stat-total" />
            <Stat label="New" value={stats?.byStatus?.new ?? 0} testId="stat-new" />
            <Stat
              label="From WhatsApp"
              value={stats?.bySource?.whatsapp ?? 0}
              testId="stat-whatsapp"
            />
            <Stat
              label="From website"
              value={stats?.bySource?.website ?? 0}
              testId="stat-website"
            />
          </div>
        </section>

        <section className="animate-rise rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow)]">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                data-testid="search-leads"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, company…"
                className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                data-testid="filter-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All sources</option>
                <option value="outlook">Outlook</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Website</option>
                <option value="manual">Manual</option>
              </select>
              <select
                data-testid="filter-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <Link
                href="/connections"
                data-testid="goto-connections"
                className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Connect sources
              </Link>
            </div>
          </div>

          {error ? (
            <p className="p-5 text-sm text-[var(--danger)]" data-testid="leads-error">
              {error}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm" data-testid="leads-table">
              <thead className="sticky top-0 bg-[var(--mist)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Lead</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Subject</th>
                  <th className="px-5 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-[var(--muted)]">
                      Loading leads…
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-[var(--muted)]" data-testid="leads-empty">
                      No leads yet. Connect Outlook, WhatsApp, or a website form — or add one manually.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-[var(--line)] transition-colors duration-200 hover:bg-[var(--mist)]"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/leads/${lead.id}`}
                          data-testid={`lead-row-${lead.id}`}
                          className="block"
                        >
                          <span className="font-semibold text-[var(--ink)]">
                            {lead.name || "Unnamed"}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {[lead.company, lead.email || lead.phone].filter(Boolean).join(" · ")}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <SourceBadge source={lead.source} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="max-w-[240px] truncate px-5 py-3.5 text-[var(--ink-soft)]">
                        {lead.subject || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--muted)]">
                        {formatRelative(lead.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <NewLeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void load()}
      />
    </AppShell>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)]/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
