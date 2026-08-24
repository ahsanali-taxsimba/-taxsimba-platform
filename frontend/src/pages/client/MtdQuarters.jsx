import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { api, apiError, d, dt, money, openDocument } from "@/lib/api";

const TONE = {
  Preparing: "bg-[#F1F8F4] text-[#626A65]",
  "Under review": "bg-[#F1F8F4] text-[#626A65]",
  "Awaiting your approval": "bg-[#FFF4E5] text-[#8A5A00]",
  "Approved — ready to submit": "bg-[#EAF5EE] text-[#006B3C]",
  Submitted: "bg-[#EAF5EE] text-[#006B3C]",
};

function Figure({ label, value, strong }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-[#078A4B] bg-[#F6FCF8]" : "border-[#E3E7E4] bg-white"}`}>
      <dt className="text-[11px] uppercase tracking-wide text-[#626A65]">{label}</dt>
      <dd className={`mt-1.5 font-semibold ${strong ? "text-2xl text-[#006B3C]" : "text-xl"}`}>{money(value)}</dd>
    </div>
  );
}

function QuarterCard({ p, onApprove, busy }) {
  const [docs, setDocs] = useState([]);
  const [err, setErr] = useState("");
  const pub = p.published;

  const loadDocs = () => api.get("/documents", { params: { mtd_period_id: p.id } })
    .then(({ data }) => setDocs(data)).catch(() => {});
  useEffect(() => { loadDocs(); }, [p.id]);

  const upload = async (e, request) => {
    const file = e.target.files[0];
    if (!file) return;
    setErr("");
    const fd = new FormData();
    fd.append("case_id", p.case_id);
    fd.append("document_type", request ? request.document_type : "MTD supporting record");
    fd.append("mtd_period_id", p.id);
    if (request) fd.append("document_id", request.id);
    fd.append("file", file);
    try {
      await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await loadDocs();
    } catch (e2) { setErr(apiError(e2.response?.data?.detail)); }
    e.target.value = "";
  };

  const requests = docs.filter((doc) => doc.status === "Requested");
  const uploaded = docs.filter((doc) => doc.status !== "Requested");

  return (
    <div data-testid={`mtd-period-${p.id}`}
      className={`rounded-2xl border p-5 sm:p-6 ${p.next_action_owner === "CLIENT" ? "border-[#078A4B] shadow-[0_2px_16px_rgba(7,138,75,0.10)]" : "border-[#E3E7E4]"} bg-white`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{p.label}</h3>
          <p className="text-sm text-[#626A65] mt-1">{d(p.period_start)} – {d(p.period_end)}</p>
          <p className="text-sm text-[#626A65]">Deadline: {d(p.deadline)}</p>
        </div>
        <span data-testid={`mtd-period-status-${p.id}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${TONE[p.stage_label] || "bg-[#F1F8F4] text-[#626A65]"}`}>
          {p.stage_label}
        </span>
      </div>

      {!pub && (
        <p data-testid={`mtd-preparing-${p.id}`} className="mt-5 text-sm text-[#626A65] leading-relaxed">
          Your accountant is preparing this quarter. Financial figures will appear here once they
          have been reviewed and published.
        </p>
      )}

      {pub && (
        <>
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid={`mtd-figures-${p.id}`}>
            <Figure label="Income" value={pub.income} />
            <Figure label="Allowable expenses" value={pub.expenses} />
            <Figure label="Net profit / loss" value={pub.net_profit} strong />
          </dl>
          {(pub.estimated_income_tax !== null || pub.estimated_national_insurance !== null
            || pub.suggested_set_aside !== null) && (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid={`mtd-estimates-${p.id}`}>
              {pub.estimated_income_tax !== null && <Figure label="Estimated Income Tax" value={pub.estimated_income_tax} />}
              {pub.estimated_national_insurance !== null && <Figure label="Estimated National Insurance" value={pub.estimated_national_insurance} />}
              {pub.suggested_set_aside !== null && <Figure label="Suggested amount to set aside" value={pub.suggested_set_aside} />}
            </dl>
          )}
          {pub.client_note && (
            <div className="mt-4 rounded-xl bg-[#F1F8F4] p-4" data-testid={`mtd-note-${p.id}`}>
              <p className="text-[11px] uppercase tracking-wide text-[#626A65]">Note from your accountant</p>
              <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">{pub.client_note}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-[#626A65]" data-testid={`mtd-version-${p.id}`}>
            Prepared by {pub.prepared_by_name} · published {dt(pub.published_at)} · version {pub.version}
          </p>
          <p className="mt-3 text-xs text-[#626A65] leading-relaxed">{p.disclaimer}</p>
        </>
      )}

      {p.submission_reference && (
        <p className="mt-4 text-sm font-semibold text-[#006B3C]" data-testid={`mtd-submission-${p.id}`}>
          Submitted {d(p.submission_date)} · reference {p.submission_reference}
        </p>
      )}

      <div className="mt-5 border-t border-[#E3E7E4] pt-4">
        {requests.length > 0 && (
          <ul className="mb-4 space-y-2" data-testid={`mtd-requests-${p.id}`}>
            {requests.map((r) => (
              <li key={r.id} data-testid={`mtd-request-${r.id}`}
                className="rounded-xl border border-[#E6A23C]/50 bg-[#FFFBF3] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{r.document_type}</p>
                    <p className="text-xs text-[#8A5A00] mt-1">Requested for {p.label}</p>
                    {r.note && <p className="text-sm text-[#626A65] mt-1.5 break-words">{r.note}</p>}
                    <p className="text-xs text-[#626A65] mt-1">
                      Requested by {r.requested_by_name} on {d(r.requested_at)}
                      {r.due_date ? ` · due ${d(r.due_date)}` : ""}
                    </p>
                  </div>
                  <label className="text-xs font-semibold text-[#078A4B] cursor-pointer shrink-0">
                    Upload
                    <input data-testid={`mtd-request-upload-${r.id}`} type="file" className="hidden"
                      onChange={(e) => upload(e, r)} />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#626A65]">
            Documents for this period{uploaded.length ? ` (${uploaded.length})` : ""}
          </p>
          <label className="text-xs font-semibold text-[#078A4B] cursor-pointer">
            Upload a record
            <input data-testid={`mtd-upload-${p.id}`} type="file" className="hidden" onChange={(e) => upload(e, null)} />
          </label>
        </div>
        {err && <p className="text-xs text-[#D64545] mt-2">{err}</p>}
        <ul className="mt-3 space-y-2">
          {uploaded.map((doc) => (
            <li key={doc.id} data-testid={`mtd-doc-${doc.id}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{doc.name} <span className="text-[11px] text-[#626A65]">{doc.status}</span></span>
              <button type="button" onClick={() => openDocument(doc.id, doc.name)}
                className="text-xs font-semibold text-[#078A4B] shrink-0">View</button>
            </li>
          ))}
        </ul>
      </div>

      {p.status === "AWAITING_CLIENT_APPROVAL" && (
        <button data-testid={`mtd-approve-${p.id}`} disabled={busy} onClick={() => onApprove(p)}
          className="mt-5 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-50">
          {busy ? "Approving…" : "Approve these figures"}
        </button>
      )}
    </div>
  );
}

function YearSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="rounded-2xl border border-[#E3E7E4] bg-white p-5 sm:p-6" data-testid="mtd-year-summary">
      <h3 className="text-base md:text-lg font-semibold">Year summary · {summary.tax_year}</h3>
      <p className="text-sm text-[#626A65] mt-1">
        {summary.published_quarters} of 4 quarters published so far
      </p>
      <ul className="mt-5 space-y-3">
        {summary.quarters.map((q) => (
          <li key={q.quarter} data-testid={`year-q-${q.quarter}`}
            className="rounded-xl border border-[#E3E7E4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{q.label}</p>
                <p className="text-xs text-[#626A65] mt-0.5">{d(q.period_start)} – {d(q.period_end)}</p>
              </div>
              <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#F1F8F4] text-[#626A65]">{q.stage_label}</span>
            </div>
            {q.income === null ? (
              <p className="text-xs text-[#626A65] mt-3">Not published yet</p>
            ) : (
              <dl className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div><dt className="text-[11px] uppercase text-[#626A65]">Income</dt><dd className="mt-1 font-semibold">{money(q.income)}</dd></div>
                <div><dt className="text-[11px] uppercase text-[#626A65]">Expenses</dt><dd className="mt-1 font-semibold">{money(q.expenses)}</dd></div>
                <div><dt className="text-[11px] uppercase text-[#626A65]">Net</dt><dd className="mt-1 font-semibold">{money(q.net_profit)}</dd></div>
              </dl>
            )}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" data-testid="mtd-year-totals">
        <Figure label="Year-to-date income" value={summary.totals.income} />
        <Figure label="Year-to-date expenses" value={summary.totals.expenses} />
        <Figure label="Year-to-date net profit / loss" value={summary.totals.net_profit} strong />
      </dl>
      <p className="mt-4 text-xs text-[#626A65] leading-relaxed">{summary.note}</p>
    </div>
  );
}

export default function MtdQuarters() {
  const [cases, setCases] = useState([]);
  const [periods, setPeriods] = useState({});
  const [finals, setFinals] = useState({});
  const [summaries, setSummaries] = useState({});
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await api.get("/cases", { params: { service_type: "MTD_INCOME_TAX" } });
    setCases(data);
    const all = {}; const fin = {}; const sum = {};
    for (const c of data) {
      try { all[c.id] = (await api.get(`/mtd/cases/${c.id}/periods`)).data; } catch { all[c.id] = []; }
      try { fin[c.id] = (await api.get(`/cases/${c.id}/final-documents`)).data; } catch { fin[c.id] = []; }
      try { sum[c.id] = (await api.get(`/mtd/cases/${c.id}/year-summary`)).data; } catch { sum[c.id] = null; }
    }
    setPeriods(all); setFinals(fin); setSummaries(sum);
  };
  useEffect(() => { load(); }, []);

  const approve = async (p) => {
    setErr(""); setBusy(p.id);
    try {
      await api.post(`/mtd/periods/${p.id}/client-approve`);
      await load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
    setBusy(null);
  };

  return (
    <AppShell title="MTD for Income Tax" subtitle="Your quarterly updates and Final Declaration.">
      <div className="space-y-8">
        {err && <p data-testid="mtd-error" className="text-sm text-[#D64545] font-semibold">{err}</p>}
        {!cases.length && (
          <Panel title="MTD status" testId="mtd-status-panel">
            <Empty text="Your MTD service is being set up. Your accountant will be in touch." />
          </Panel>
        )}
        {cases.map((c) => {
          const rows = periods[c.id] || [];
          const quarters = rows.filter((r) => r.kind === "QUARTER");
          const final = rows.find((r) => r.kind === "FINAL_DECLARATION");
          return (
            <section key={c.id} data-testid={`mtd-case-${c.case_ref}`} className="space-y-4">
              <div>
                <h2 className="text-base md:text-lg font-semibold">{c.case_ref} · {c.tax_year}</h2>
                <p className="text-sm text-[#626A65] mt-1">Making Tax Digital for Income Tax</p>
              </div>
              {quarters.map((p) => (
                <QuarterCard key={p.id} p={{ ...p, case_id: c.id }} onApprove={approve} busy={busy === p.id} />
              ))}
              <YearSummary summary={summaries[c.id]} />
              {final && (
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-wide text-[#626A65] mb-3">Year end</p>
                  <QuarterCard p={{ ...final, case_id: c.id }} onApprove={approve} busy={busy === final.id} />
                </div>
              )}
              {(finals[c.id] || []).length > 0 && (
                <div className="rounded-2xl border border-[#E3E7E4] bg-white p-5" data-testid={`mtd-final-docs-${c.case_ref}`}>
                  <h3 className="text-sm font-semibold">Final documents</h3>
                  <ul className="mt-3 space-y-2">
                    {(finals[c.id] || []).map((f) => (
                      <li key={f.id} data-testid={`mtd-final-doc-${f.id}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{f.name} <span className="text-[11px] text-[#006B3C]">v{f.final_version}</span></span>
                        <button type="button" onClick={() => openDocument(f.id, f.name)}
                          className="text-xs font-semibold text-[#078A4B] shrink-0">Download</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
