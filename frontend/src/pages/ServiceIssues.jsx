import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { api, apiError, dt } from "@/lib/api";

const CATEGORIES = ["Service delay", "Communication", "Fees or billing",
  "Quality of work", "Document handling", "Other"];

const LABEL = { OPEN: "Open", IN_REVIEW: "In review", RESOLVED: "Resolved" };
const TONE = {
  OPEN: "bg-[#FBEBEB] text-[#D64545]",
  IN_REVIEW: "bg-[#FFF4E5] text-[#8A5A00]",
  RESOLVED: "bg-[#EAF5EE] text-[#006B3C]",
};

function Tag({ status }) {
  return (
    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold ${TONE[status] || ""}`}>
      {LABEL[status] || status}
    </span>
  );
}

export function ClientServiceIssues() {
  const [rows, setRows] = useState([]);
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState({ category: CATEGORIES[0], subject: "", description: "", case_id: "" });
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/service-issues").then(({ data }) => setRows(data));
  useEffect(() => {
    load();
    api.get("/cases").then(({ data }) => setCases(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setNotice(""); setBusy(true);
    try {
      await api.post("/service-issues", { ...form, case_id: form.case_id || null });
      setNotice("Thank you — your service issue has been sent to our team.");
      setForm({ category: CATEGORIES[0], subject: "", description: "", case_id: "" });
      await load();
    } catch (e2) {
      setErr(apiError(e2.response?.data?.detail));
    }
    setBusy(false);
  };

  return (
    <AppShell title="Report a problem" subtitle="Raise a service issue and we will review it and come back to you.">
      <div className="space-y-6">
        <Panel title="Raise a service issue" testId="issue-form-panel">
          <form onSubmit={submit} className="space-y-4 max-w-2xl">
            <div>
              <label className="text-xs uppercase text-[#626A65]">Related case or service</label>
              <select data-testid="issue-case" value={form.case_id}
                onChange={(e) => setForm({ ...form, case_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                <option value="">General — not about a specific case</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.case_ref} · {c.service_type === "MTD_INCOME_TAX" ? "MTD" : "Self Assessment"} {c.tax_year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-[#626A65]">Category</label>
              <select data-testid="issue-category" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-[#626A65]">Subject</label>
              <input data-testid="issue-subject" value={form.subject} maxLength={120}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase text-[#626A65]">What happened?</label>
              <textarea data-testid="issue-description" rows={5} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
            </div>
            {err && <p data-testid="issue-error" className="text-sm text-[#D64545] font-semibold">{err}</p>}
            {notice && <p data-testid="issue-notice" className="text-sm text-[#16A05D] font-semibold">{notice}</p>}
            <button data-testid="issue-submit" type="submit" disabled={busy}
              className="px-5 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-50">
              {busy ? "Sending…" : "Submit"}
            </button>
          </form>
        </Panel>

        <Panel title="Your service issues" testId="client-issues-panel">
          {!rows.length && <Empty text="You have not raised any service issues." />}
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} data-testid={`client-issue-${r.id}`} className="border border-[#E3E7E4] rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold text-sm break-words">{r.subject}</div>
                  <Tag status={r.status} />
                </div>
                <div className="text-xs text-[#626A65] mt-1">
                  {r.category}{r.case_ref ? ` · ${r.case_ref}` : ""} · raised {dt(r.created_at)}
                </div>
                <p className="text-sm text-[#161B18] mt-2 whitespace-pre-wrap break-words">{r.description}</p>
                {r.resolution && (
                  <div className="mt-3 rounded-lg bg-[#F1F8F4] p-3" data-testid={`issue-resolution-${r.id}`}>
                    <div className="text-xs font-semibold text-[#006B3C]">Our response</div>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">{r.resolution}</p>
                    {r.resolved_at && <p className="text-xs text-[#626A65] mt-1">Resolved {dt(r.resolved_at)}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}

export function AdminServiceIssues() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const load = (s) => api.get("/service-issues", { params: s ? { status: s } : {} })
    .then(({ data }) => setRows(data));
  useEffect(() => { load(status); }, [status]);

  const set = async (row, next) => {
    setErr("");
    let resolution = row.resolution || "";
    if (next === "RESOLVED") {
      resolution = window.prompt("Resolution message for the client", resolution) || "";
      if (!resolution.trim()) { setErr("A resolution message for the client is required."); return; }
    }
    try {
      await api.patch(`/service-issues/${row.id}`, { status: next, resolution: resolution || null });
      await load(status);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    }
  };

  return (
    <AppShell title="Service issues" subtitle="Client-raised complaints and service issues.">
      <Panel title="Service issues" testId="admin-issues-panel">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[["", "All"], ["OPEN", "Open"], ["IN_REVIEW", "In review"], ["RESOLVED", "Resolved"]].map(([k, l]) => (
            <button key={k || "all"} data-testid={`issue-filter-${k || "all"}`} onClick={() => setStatus(k)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${status === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>
              {l}
            </button>
          ))}
        </div>
        {err && <p data-testid="admin-issue-error" className="text-sm text-[#D64545] font-semibold mb-4">{err}</p>}
        {!rows.length && <Empty text="No service issues." />}
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} data-testid={`admin-issue-${r.id}`} className="border border-[#E3E7E4] rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-sm break-words">{r.subject}</div>
                <Tag status={r.status} />
              </div>
              <div className="text-xs text-[#626A65] mt-1">
                {r.client_name} · {r.category}{r.case_ref ? ` · ${r.case_ref}` : " · General"} · raised {dt(r.created_at)}
                {r.handled_by_name ? ` · handled by ${r.handled_by_name}` : ""}
              </div>
              <p className="text-sm text-[#161B18] mt-2 whitespace-pre-wrap break-words">{r.description}</p>
              {r.resolution && <p className="text-sm text-[#006B3C] mt-2 break-words">Response: {r.resolution}</p>}
              <div className="flex gap-3 mt-3 flex-wrap">
                {r.status === "OPEN" && (
                  <button data-testid={`issue-review-${r.id}`} onClick={() => set(r, "IN_REVIEW")}
                    className="text-xs font-semibold text-[#006B3C]">Mark in review</button>
                )}
                {r.status !== "RESOLVED" && (
                  <button data-testid={`issue-resolve-${r.id}`} onClick={() => set(r, "RESOLVED")}
                    className="text-xs font-semibold text-[#006B3C]">Resolve with a message</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </AppShell>
  );
}
