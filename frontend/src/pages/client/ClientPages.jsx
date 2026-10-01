import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Journey } from "@/components/Journey";
import { Empty, Panel } from "@/components/StatCard";
import { DocStatusBadge } from "@/components/StatusBadge";
import { api, d, dt, openDocument } from "@/lib/api";
import { useContent } from "@/lib/content";
import { sharedServiceParams, useEntitlements } from "@/lib/services";

export function ClientJourneyPage() {
  const [cs, setCs] = useState(null);
  useEffect(() => {
    api.get("/cases", { params: { service_type: "SELF_ASSESSMENT" } }).then(async ({ data }) => {
      if (data.length) setCs((await api.get(`/cases/${data[0].id}`)).data);
    });
  }, []);
  return (
    <AppShell title="Your Tax Journey" subtitle={cs ? `Self Assessment ${cs.tax_year} · ${cs.case_ref}` : "Updated automatically as your case progresses."}>
      <Panel testId="journey-page">{cs ? <Journey steps={cs.journey} /> : <Empty text="No active case yet." />}</Panel>
    </AppShell>
  );
}

export function ClientTasks() {
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("open");
  const [busy, setBusy] = useState(null);
  const highlight = new URLSearchParams(window.location.search).get("task");
  const entitlements = useEntitlements();

  const load = useCallback(
    () => api.get("/tasks", { params: sharedServiceParams(entitlements) })
      .then(({ data }) => setTasks(data)),
    [entitlements],
  );
  useEffect(() => { if (entitlements.loaded) load(); }, [entitlements, load]);

  const upload = async (task, file) => {
    setBusy(task.id);
    const fd = new FormData();
    fd.append("case_id", task.case_id);
    fd.append("document_type", task.name);
    fd.append("task_id", task.id);
    fd.append("file", file);
    const { data: docs } = await api.get("/documents", { params: { case_id: task.case_id, filter: "requested" } });
    const placeholder = docs.find((x) => x.task_id === task.id);
    if (placeholder) fd.append("document_id", placeholder.id);
    await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setBusy(null);
    load();
  };

  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const done = tasks.filter((t) => t.status === "COMPLETED");
  const shown = tab === "open" ? open : done;

  return (
    <AppShell title="Tasks" subtitle="Everything we need from you, in one place.">
      <Panel testId="client-tasks-panel">
        <div className="flex gap-2 mb-6">
          {[["open", `Action Required (${open.length})`], ["completed", `Completed (${done.length})`]].map(([k, l]) => (
            <button key={k} data-testid={`task-tab-${k}`} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>
              {l}
            </button>
          ))}
        </div>
        {!shown.length && (
          <Empty text={tab === "open" ? "You have no outstanding tasks." : "No completed tasks yet."} />
        )}
        <ul className="space-y-4">
          {shown.map((t) => (
            <li key={t.id} data-testid={`task-${t.id}`}
              className={`border rounded-lg p-5 ${t.id === highlight ? "border-[#078A4B] bg-[#F1F8F4]" : "border-[#E3E7E4]"}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-[#161B18]">{t.name}</div>
                  {t.description && <p className="text-sm text-[#626A65] mt-1">{t.description}</p>}
                  <p className="text-xs text-[#626A65] mt-2">
                    {t.case_ref ? `Case ${t.case_ref}` : "Your account"}
                    {t.tax_year ? ` · ${t.tax_year}` : ""}
                    {" · "}
                    {t.due_date ? `Due ${d(t.due_date)}` : "No due date"}
                    {t.created_by_name ? ` · Requested by ${t.created_by_name} on ${d(t.created_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {t.status === "COMPLETED" ? (
                    <span className="text-xs font-semibold text-[#16A05D]">Completed {d(t.completed_date)}</span>
                  ) : (
                    <>
                      <label className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold cursor-pointer hover:bg-[#006B3C] transition-colors">
                        {busy === t.id ? "Uploading…" : "Upload file"}
                        <input data-testid={`task-upload-${t.id}`} type="file" className="hidden"
                          onChange={(e) => e.target.files[0] && upload(t, e.target.files[0])} />
                      </label>
                      <button
                        data-testid={`task-complete-${t.id}`}
                        onClick={async () => { await api.post(`/tasks/${t.id}/complete`); load(); }}
                        className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors"
                      >
                        Mark done
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </AppShell>
  );
}

export function ClientDocuments() {
  const t = useContent();
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [cs, setCs] = useState(null);
  const [notice, setNotice] = useState("");

  const entitlements = useEntitlements();

  const load = useCallback(
    (f) => {
      const scope = sharedServiceParams(entitlements);
      return api.get("/documents", {
        params: f === "all" ? scope : { filter: f, ...scope },
      }).then(({ data }) => setDocs(data));
    },
    [entitlements],
  );
  useEffect(() => { if (entitlements.loaded) load(filter); }, [filter, entitlements, load]);
  useEffect(() => {
    if (!entitlements.loaded) return;
    api.get("/cases", { params: sharedServiceParams(entitlements) })
      .then(({ data }) => data.length && setCs(data[0]));
  }, [entitlements]);

  const upload = async (file, input) => {
    setNotice("");
    const fd = new FormData();
    fd.append("case_id", cs.id);
    fd.append("document_type", "Client upload");
    fd.append("file", file);
    try {
      await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Stay on the Documents page, confirm, and refresh the list in place.
      setNotice("Document uploaded successfully.");
      setFilter("all");
      await load("all");
    } catch (e) {
      setNotice("");
      window.alert("Sorry, that upload didn't work. Please try again.");
    }
    if (input) input.value = "";
  };

  const who = (doc) => {
    if (!doc.uploader_name) return "Requested by your accountant";
    if (doc.uploader_id && cs && doc.uploader_id === cs.client_user_id) return "Uploaded by you";
    return `Uploaded by ${doc.uploader_name}`;
  };

  return (
    <AppShell title={t("client.documents.title", "Documents")} subtitle={t("client.documents.subtitle", "Requested items, your uploads and final documents.")}>
      <Panel
        title="Documents"
        testId="client-documents-panel"
        action={cs && (
          <label className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold cursor-pointer hover:bg-[#006B3C] transition-colors">
            Upload document
            <input data-testid="client-upload-input" type="file" className="hidden"
              onChange={(e) => e.target.files[0] && upload(e.target.files[0], e.target)} />
          </label>
        )}
      >
        {notice && (
          <p data-testid="upload-success-notice" className="text-sm text-[#16A05D] font-semibold mb-4">
            {notice}
          </p>
        )}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[["all", "All"], ["requested", "Requested"], ["uploaded", "Uploaded"], ["final", "Final Documents"]].map(([k, l]) => (
            <button key={k} data-testid={`doc-filter-${k}`} onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${filter === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>
              {l}
            </button>
          ))}
        </div>
        {!docs.length && <Empty text={t("client.documents.empty", "Nothing here yet.")} />}

        {/* Mobile: readable cards instead of four cramped columns */}
        <ul className="md:hidden space-y-3" data-testid="documents-cards">
          {docs.map((doc) => (
            <li key={doc.id} data-testid={`doc-card-${doc.id}`} className="border border-[#E3E7E4] rounded-lg p-4">
              <div className="font-semibold text-sm text-[#161B18] break-words">{doc.name}</div>
              <div className="text-xs text-[#626A65] mt-1">
                {doc.document_type}{doc.tax_year ? ` · ${doc.tax_year}` : ""}{doc.is_final ? ` · ${doc.case_ref || ""} · Final v${doc.final_version}` : ""}
              </div>
              <div className="text-xs text-[#626A65] mt-1">{who(doc)}{doc.upload_date ? ` · ${d(doc.upload_date)}` : ""}</div>
              <div className="flex items-center justify-between gap-3 mt-3">
                <DocStatusBadge status={doc.status} />
                {doc.storage_path && (
                  <button data-testid={`download-m-${doc.id}`} type="button"
                    onClick={() => openDocument(doc.id, doc.name)}
                    className="text-xs font-semibold text-[#078A4B] hover:underline">
                    View document
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          {docs.length > 0 && (
            <table className="w-full text-sm" data-testid="documents-table">
              <thead>
                <tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3 pr-4">Document</th><th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Tax Year</th><th className="py-3 pr-4">Uploaded by</th>
                  <th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Status</th><th className="py-3" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b border-[#E3E7E4]">
                    <td className="py-4 pr-4 font-semibold">{doc.name}{doc.is_final && <span className="ml-2 text-[11px] text-[#006B3C]">Final v{doc.final_version} · {doc.case_ref}</span>}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.document_type}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.tax_year || "—"}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.uploader_name || "—"}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.upload_date ? d(doc.upload_date) : "—"}</td>
                    <td className="py-4 pr-4"><DocStatusBadge status={doc.status} /></td>
                    <td className="py-4">
                      {doc.storage_path && (
                        <button data-testid={`download-${doc.id}`} type="button"
                          onClick={() => openDocument(doc.id, doc.name)}
                          className="text-xs font-semibold text-[#078A4B] hover:underline">
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}

export function ClientMessages() {
  const [cs, setCs] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [body, setBody] = useState("");
  const entitlements = useEntitlements();

  const load = useCallback(
    (id) => api.get("/messages", { params: { case_id: id } }).then(({ data }) => setMsgs(data)),
    [],
  );
  useEffect(() => {
    if (!entitlements.loaded) return;
    api.get("/cases", { params: sharedServiceParams(entitlements) }).then(({ data }) => {
      if (data.length) { setCs(data[0]); load(data[0].id); }
    });
  }, [entitlements, load]);

  const send = async () => {
    if (!body.trim()) return;
    await api.post("/messages", { case_id: cs.id, body });
    setBody("");
    load(cs.id);
  };

  return (
    <AppShell
      title="Messages"
      subtitle={cs?.assigned_accountant_name
        ? `Your accountant: ${cs.assigned_accountant_name}${cs.tax_year ? ` · ${cs.tax_year}` : ""}`
        : "TaxSimba Support"}
    >
      <Panel testId="client-messages-panel">
        <div className="space-y-4 max-h-[420px] overflow-y-auto mb-6">
          {!msgs.length && <Empty text="No messages yet." />}
          {msgs.map((m) => (
            <div key={m.id} data-testid={`message-${m.id}`}
              className={`rounded-lg p-4 border ${m.sender_role === "CLIENT" ? "bg-[#F1F8F4] border-[#EAF5EE] ml-auto max-w-[85%]" : "bg-white border-[#E3E7E4] max-w-[85%]"}`}>
              <div className="text-xs font-semibold text-[#006B3C]">
                {m.sender_role === "CLIENT" ? "You" : m.sender_name}
              </div>
              <p className="text-sm text-[#161B18] mt-1.5 whitespace-pre-wrap break-words">{m.body}</p>
              <div className="text-[11px] text-[#626A65] mt-2">{dt(m.created_at)}</div>
            </div>
          ))}
        </div>
        {cs && (
          <div className="flex flex-col sm:flex-row gap-3">
            <input data-testid="message-input" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message…"
              className="w-full sm:flex-1 min-w-0 rounded-lg border border-[#E3E7E4] px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
            <button data-testid="send-message-btn" onClick={send}
              className="w-full sm:w-auto shrink-0 px-5 py-3 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">Send</button>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

export function SimplePage({ title, subtitle, children, testId }) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <Panel testId={testId}>{children}</Panel>
    </AppShell>
  );
}
