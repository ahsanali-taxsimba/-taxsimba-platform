/**
 * Accountant / admin AML case review — view documents, structured checklist, decision.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import DownloadWarningModal from "@/components/documents/DownloadWarningModal";
import ScanStatusBadge from "@/components/documents/ScanStatusBadge";
import { Empty, Panel } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, d, dt } from "@/lib/api";
import { openSecureFile } from "@/lib/secureDownload";

export default function AmlCaseReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = user?.role === "ACCOUNTANT" ? "/work/aml" : "/admin/aml";
  const [row, setRow] = useState(null);
  const [audit, setAudit] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    decision: "APPROVED",
    risk_level: "LOW",
    comments: "",
    edd_required: false,
    reupload_message: "",
    checklist: {
      id_matches_client: false,
      address_docs_valid_and_recent: false,
      selfie_matches_id: false,
      pep_sanctions_cleared: false,
    },
  });
  const [warn, setWarn] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/aml/cases/${id}`);
    setRow(data);
    api.get(`/aml/cases/${id}/audit`).then((r) => setAudit(r.data)).catch(() => {});
  };

  useEffect(() => {
    load().catch((e) => setErr(apiError(e.response?.data?.detail)));
  }, [id]);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/aml/cases/${id}/review`, form);
      await load();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const runScreening = async () => {
    setBusy(true);
    try {
      await api.post(`/aml/cases/${id}/screening`);
      await load();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  if (!row) {
    return (
      <AppShell title="AML review">
        {err ? <p className="text-sm text-[#D64545]">{err}</p> : <Empty text="Loading…" />}
      </AppShell>
    );
  }

  const docs = (type) => (row.documents || []).filter((d) => d.type === type);
  const canReview = ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"].includes(row.status);

  const requestAlt = async (doc) => {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/aml/documents/${doc.id}/request-alternative`, {});
      setWarn(null);
      await load();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Could not request alternative");
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (doc) => {
    setErr("");
    try {
      await openSecureFile({
        url: `/aml/documents/${doc.id}/file`,
        name: doc.file_name,
        onRisk: ({ mode, scanStatus }) =>
          new Promise((resolve) => {
            setWarn({ mode, scanStatus, file: doc, resolve });
          }),
      });
    } catch (e) {
      if (e?.code === "INFECTED") return;
      setErr(apiError(e.response?.data?.detail) || e.message || "Could not open file");
    }
  };

  const idDocs = [...docs("PASSPORT"), ...docs("DRIVING_LICENCE_FRONT"), ...docs("DRIVING_LICENCE_BACK")];
  const poaDocs = dedupeDocs(docs("PROOF_OF_ADDRESS"));
  const selfieDocs = docs("SELFIE");
  const checklistDone = Object.values(form.checklist).filter(Boolean).length;
  const checklistTotal = 4;

  return (
    <AppShell
      title={row.client?.name || "AML case"}
      subtitle={`${row.client?.client_ref || ""} · ${(row.status || "").replace(/_/g, " ")}`}
    >
      <div className="mb-4">
        <Link to={base} className="text-sm font-semibold text-[#006B3C]">
          ← Back to AML list
        </Link>
      </div>

      <div
        className="mb-6 rounded-xl border border-[#E3E7E4] bg-[#F7F8F7] px-4 py-3 flex flex-wrap gap-3 items-center"
        data-testid="aml-review-summary"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[#626A65]">Pack summary</span>
        <Chip ok={idDocs.length > 0}>{idDocs.length ? "ID on file" : "ID missing"}</Chip>
        <Chip ok={poaDocs.length >= 2}>
          Address {poaDocs.length}/2
        </Chip>
        <Chip ok={selfieDocs.length > 0}>{selfieDocs.length ? "Live photo" : "No live photo"}</Chip>
        {row.submitted_at && (
          <span className="text-xs text-[#626A65]">Submitted {dt(row.submitted_at)}</span>
        )}
        {canReview && (
          <span className="ml-auto text-xs font-semibold text-[#006B3C]">
            Checklist {checklistDone}/{checklistTotal}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Panel title="Client details" testId="aml-review-client">
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase text-[#626A65]">Name</dt>
                <dd className="font-semibold">{row.full_name || row.client?.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#626A65]">Date of birth</dt>
                <dd className="font-semibold">{row.date_of_birth || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-[#626A65]">Residential address</dt>
                <dd className="font-semibold whitespace-pre-wrap">
                  {row.residential_address || row.client?.address || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#626A65]">Country</dt>
                <dd>{row.country_of_residence || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#626A65]">Occupation</dt>
                <dd>{row.occupation || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-[#626A65]">Source of funds</dt>
                <dd>{row.source_of_funds_note || "—"}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Identity document" testId="aml-review-id">
            <DocList items={idDocs} onOpen={openDoc} onRequestAlt={requestAlt} />
          </Panel>

          <Panel title="Proofs of address" testId="aml-review-poa">
            <DocList items={poaDocs} onOpen={openDoc} onRequestAlt={requestAlt} />
          </Panel>

          <Panel title="Live photo" testId="aml-review-selfie">
            <DocList items={selfieDocs} onOpen={openDoc} onRequestAlt={requestAlt} />
          </Panel>

          <Panel title="PEP / sanctions screening" testId="aml-review-screening">
            <p className="text-xs text-[#626A65] mb-3">
              {/* TODO(pep): replace stub with live provider results */}
              Integration stub — re-run records a placeholder until an external screening API is configured.
            </p>
            {(row.screening || []).length === 0 && <Empty text="No screening results yet." />}
            <ul className="space-y-2 text-sm">
              {(row.screening || []).map((s) => (
                <li key={s.id} className="border border-[#E3E7E4] rounded-lg p-3">
                  {s.provider} · {s.result} · {dt(s.checked_at)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-testid="aml-rerun-screening"
              disabled={busy}
              onClick={runScreening}
              className="mt-3 text-xs font-semibold text-[#006B3C]"
            >
              Re-run screening (stub)
            </button>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Review decision" testId="aml-review-form">
            {!canReview ? (
              <p className="text-sm text-[#626A65]">
                Case is {row.status}. Risk: {row.risk_level || "—"}. Reviewed {dt(row.reviewed_at)} by{" "}
                {row.reviewer_name || "—"}.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  ["id_matches_client", "ID matches client details"],
                  ["address_docs_valid_and_recent", "Address documents valid and recent"],
                  ["selfie_matches_id", "Live photo matches ID photo"],
                  ["pep_sanctions_cleared", "PEP / sanctions cleared (or N/A)"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid={`aml-check-${key}`}
                      checked={!!form.checklist[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          checklist: { ...form.checklist, [key]: e.target.checked },
                        })
                      }
                      className="mt-1"
                    />
                    <span>{label}</span>
                  </label>
                ))}

                <label className="block font-medium">
                  Risk level
                  <select
                    data-testid="aml-risk-level"
                    value={form.risk_level}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        risk_level: e.target.value,
                        edd_required: e.target.value === "HIGH" ? true : form.edd_required,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High (triggers EDD flag)</option>
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.edd_required}
                    onChange={(e) => setForm({ ...form, edd_required: e.target.checked })}
                  />
                  Enhanced Due Diligence required
                </label>

                <label className="block font-medium">
                  Decision
                  <select
                    data-testid="aml-decision"
                    value={form.decision}
                    onChange={(e) => setForm({ ...form, decision: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2"
                  >
                    <option value="APPROVED">Approve</option>
                    <option value="REQUIRES_REUPLOAD">Request re-upload</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </label>

                {form.decision === "REQUIRES_REUPLOAD" && (
                  <textarea
                    data-testid="aml-reupload-msg"
                    rows={2}
                    placeholder="What should the client re-upload?"
                    value={form.reupload_message}
                    onChange={(e) => setForm({ ...form, reupload_message: e.target.value })}
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2"
                  />
                )}

                <textarea
                  data-testid="aml-comments"
                  rows={3}
                  placeholder="Review notes / SAR escalation notes (internal)"
                  value={form.comments}
                  onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2"
                />
                {/* TODO(sar): link high-risk / suspicious notes to internal SAR workflow */}

                <button
                  type="button"
                  data-testid="aml-review-submit"
                  disabled={busy}
                  onClick={submit}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Submit decision"}
                </button>
                {err && <p className="text-sm text-[#D64545]">{err}</p>}
              </div>
            )}
          </Panel>

          <Panel title="Audit trail" testId="aml-audit">
            {!audit.length && <Empty text="No audit events." />}
            <ul className="space-y-2 max-h-80 overflow-y-auto text-xs">
              {audit.map((a) => (
                <li key={a.id} className="border-b border-[#E3E7E4] pb-2">
                  <div className="font-semibold">{a.action}</div>
                  <div className="text-[#626A65]">
                    {a.actor_name} · {dt(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
            {row.next_review_due && (
              <p className="text-xs text-[#626A65] mt-3">Next periodic review due {d(row.next_review_due)}</p>
            )}
          </Panel>
        </div>
      </div>

      <DownloadWarningModal
        open={Boolean(warn)}
        mode={warn?.mode}
        scanStatus={warn?.scanStatus}
        fileName={warn?.file?.file_name}
        busy={busy}
        onCancel={() => {
          warn?.resolve?.("cancel");
          setWarn(null);
        }}
        onConfirm={() => {
          warn?.resolve?.("confirm");
          setWarn(null);
        }}
        onRequestAlternative={() => {
          warn?.resolve?.("request");
          if (warn?.file) requestAlt(warn.file);
        }}
      />
    </AppShell>
  );
}

function Chip({ children, ok }) {
  return (
    <span
      className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
      style={{
        background: ok ? "#E9F7EF" : "#FBEBEB",
        color: ok ? "#16A05D" : "#D64545",
      }}
    >
      {children}
    </span>
  );
}

/** Collapse identical filename+size uploads so review is not cluttered by retries. */
function dedupeDocs(items) {
  const seen = new Set();
  const out = [];
  for (const d of items || []) {
    const key = `${d.file_name}|${d.file_size || d.size || 0}|${d.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

function DocList({ items, onOpen, onRequestAlt }) {
  if (!items?.length) return <Empty text="No documents uploaded." />;
  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-3 text-sm border border-[#E3E7E4] rounded-lg p-3"
        >
          <div className="min-w-0">
            <div className="font-semibold flex flex-wrap items-center gap-2">
              {d.type.replace(/_/g, " ")}
              <ScanStatusBadge status={d.scan_status} />
            </div>
            <div className="text-xs text-[#626A65]">
              {d.file_name} · {dt(d.uploaded_at)}
              {d.replacement_requested ? " · Replacement requested" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid={`aml-view-doc-${d.id}`}
              className="px-3 py-1.5 rounded-lg bg-[#078A4B] text-white text-xs font-semibold"
              onClick={() => onOpen(d)}
            >
              View
            </button>
            <button
              type="button"
              data-testid={`aml-request-alt-${d.id}`}
              className="px-3 py-1.5 rounded-lg border border-[#E3E7E4] text-xs font-semibold text-[#B77A12]"
              onClick={() => onRequestAlt(d)}
            >
              Request alternative
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
