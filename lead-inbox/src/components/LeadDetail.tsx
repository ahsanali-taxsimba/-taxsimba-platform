"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "./AppShell";
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
  message: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;

export function LeadDetail({ id }: { id: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [sampleDatabase, setSampleDatabase] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [meRes, leadRes] = await Promise.all([fetch("/api/me"), fetch(`/api/leads/${id}`)]);
      if (!meRes.ok) throw new Error("Auth failed");
      if (leadRes.status === 404) {
        setLead(null);
        return;
      }
      if (!leadRes.ok) throw new Error("Failed to load lead");
      const me = (await meRes.json()) as { name?: string; sampleDatabase?: boolean };
      const data = (await leadRes.json()) as { lead: Lead };
      setViewerName(me.name || "You");
      setSampleDatabase(Boolean(me.sampleDatabase));
      setLead(data.lead);
      setNotes(data.lead.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: string) {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = (await res.json()) as { lead: Lead };
      setLead(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Could not save notes");
      const data = (await res.json()) as { lead: Lead };
      setLead(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell viewerName={viewerName} sampleDatabase={sampleDatabase}>
      <div className="space-y-4">
        <Link
          href="/"
          data-testid="back-to-leads"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} />
          All leads
        </Link>

        {error ? (
          <p className="text-sm text-[var(--danger)]" data-testid="lead-detail-error">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-8 shadow-[var(--shadow)]">
            <p data-testid="lead-loading" className="text-[var(--muted)]">
              Loading lead…
            </p>
          </div>
        ) : !lead ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-8 shadow-[var(--shadow)]">
            <p data-testid="lead-not-found">Lead not found.</p>
          </div>
        ) : (
          <article className="animate-rise rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={lead.source} />
                  <StatusBadge status={lead.status} />
                </div>
                <h1
                  className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight"
                  data-testid="lead-name"
                >
                  {lead.name || "Unnamed lead"}
                </h1>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Received {formatRelative(lead.created_at)} · updated{" "}
                  {formatRelative(lead.updated_at)}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Email" value={lead.email} testId="lead-email" />
              <Field label="Phone" value={lead.phone} testId="lead-phone" />
              <Field label="Company" value={lead.company} testId="lead-company" />
              <Field label="Subject" value={lead.subject} testId="lead-subject" />
            </dl>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Message
              </p>
              <p
                className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--mist)]/60 p-4 text-sm leading-relaxed"
                data-testid="lead-message"
              >
                {lead.message || "—"}
              </p>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Pipeline status
              </p>
              <div className="flex flex-wrap gap-2" data-testid="status-actions">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy || lead.status === s}
                    data-testid={`set-status-${s}`}
                    onClick={() => void setStatus(s)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      lead.status === s
                        ? "bg-[var(--ink)] text-white"
                        : "border border-[var(--line)] hover:bg-[var(--mist)]"
                    } disabled:opacity-50`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Internal notes
                </span>
                <textarea
                  data-testid="lead-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                data-testid="save-notes"
                onClick={() => void saveNotes()}
                className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b46822] disabled:opacity-60"
              >
                Save notes
              </button>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium" data-testid={testId}>
        {value || "—"}
      </dd>
    </div>
  );
}
