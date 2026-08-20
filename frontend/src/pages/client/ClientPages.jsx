import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Journey } from "@/components/Journey";
import { Empty, Panel } from "@/components/StatCard";
import { DocStatusBadge } from "@/components/StatusBadge";
import { api, d, dt, money } from "@/lib/api";

export function ClientJourneyPage() {
  const [cs, setCs] = useState(null);
  useEffect(() => {
    api.get("/cases").then(async ({ data }) => {
      if (data.length) setCs((await api.get(`/cases/${data[0].id}`)).data);
    });
  }, []);
  return (
    <AppShell title="Your Tax Journey" subtitle="Updated automatically as your case progresses.">
      <Panel testId="journey-page">{cs ? <Journey steps={cs.journey} /> : <Empty text="No active case yet." />}</Panel>
    </AppShell>
  );
}

export function ClientTasks() {
  const [tasks, setTasks] = useState([]);
  const [cs, setCs] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/tasks").then(({ data }) => setTasks(data));
  useEffect(() => {
    load();
    api.get("/cases").then(({ data }) => data.length && setCs(data[0]));
  }, []);

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

  return (
    <AppShell title="Tasks" subtitle="Everything we need from you, in one place.">
      <Panel testId="client-tasks-panel">
        {!tasks.length && <Empty text="You have no outstanding tasks." />}
        <ul className="space-y-4">
          {tasks.map((t) => (
            <li key={t.id} data-testid={`task-${t.id}`} className="border border-[#E3E7E4] rounded-lg p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#161B18]">{t.name}</div>
                  <p className="text-sm text-[#626A65] mt-1">{t.description}</p>
                  <p className="text-xs text-[#626A65] mt-2">
                    Case {t.case_ref} · Due {d(t.due_date)} · Requested by {t.created_by_name} on {d(t.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [cs, setCs] = useState(null);

  const load = (f) => api.get("/documents", { params: f === "all" ? {} : { filter: f } }).then(({ data }) => setDocs(data));
  useEffect(() => { load(filter); }, [filter]);
  useEffect(() => { api.get("/cases").then(({ data }) => data.length && setCs(data[0])); }, []);

  const upload = async (file) => {
    const fd = new FormData();
    fd.append("case_id", cs.id);
    fd.append("document_type", "Client upload");
    fd.append("file", file);
    await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    load(filter);
  };

  return (
    <AppShell title="Documents" subtitle="Requested items, your uploads and final documents.">
      <Panel
        testId="client-documents-panel"
        action={cs && (
          <label className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold cursor-pointer hover:bg-[#006B3C] transition-colors">
            Upload document
            <input data-testid="client-upload-input" type="file" className="hidden"
              onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
          </label>
        )}
      >
        <div className="flex gap-2 mb-6 flex-wrap">
          {[["all", "All"], ["requested", "Requested"], ["uploaded", "Uploaded"], ["final", "Final Documents"]].map(([k, l]) => (
            <button key={k} data-testid={`doc-filter-${k}`} onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${filter === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>
              {l}
            </button>
          ))}
        </div>
        {!docs.length && <Empty text="Nothing here yet." />}
        <div className="overflow-x-auto">
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
                    <td className="py-4 pr-4 font-semibold">{doc.name}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.document_type}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.tax_year}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{doc.uploader_name || "—"}</td>
                    <td className="py-4 pr-4 text-[#626A65]">{d(doc.upload_date)}</td>
                    <td className="py-4 pr-4"><DocStatusBadge status={doc.status} /></td>
                    <td className="py-4">
                      {doc.storage_path && (
                        <a data-testid={`download-${doc.id}`} className="text-xs font-semibold text-[#078A4B]"
                          href={`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download?`} target="_blank" rel="noreferrer">
                          View
                        </a>
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

  const load = (id) => api.get("/messages", { params: { case_id: id } }).then(({ data }) => setMsgs(data));
  useEffect(() => {
    api.get("/cases").then(({ data }) => {
      if (data.length) { setCs(data[0]); load(data[0].id); }
    });
  }, []);

  const send = async () => {
    if (!body.trim()) return;
    await api.post("/messages", { case_id: cs.id, body });
    setBody("");
    load(cs.id);
  };

  return (
    <AppShell title="Messages" subtitle={cs?.assigned_accountant_name ? `Your accountant: ${cs.assigned_accountant_name}` : "TaxSimba Support"}>
      <Panel testId="client-messages-panel">
        <div className="space-y-4 max-h-[420px] overflow-y-auto mb-6">
          {!msgs.length && <Empty text="No messages yet." />}
          {msgs.map((m) => (
            <div key={m.id} data-testid={`message-${m.id}`}
              className={`rounded-lg p-4 border ${m.sender_role === "CLIENT" ? "bg-[#F1F8F4] border-[#EAF5EE] ml-auto max-w-[80%]" : "bg-white border-[#E3E7E4] max-w-[80%]"}`}>
              <div className="text-xs font-semibold text-[#006B3C]">{m.sender_name} · {m.sender_role === "CLIENT" ? "You" : m.sender_role}</div>
              <p className="text-sm text-[#161B18] mt-1.5 whitespace-pre-wrap">{m.body}</p>
              <div className="text-[11px] text-[#626A65] mt-2">{dt(m.created_at)}</div>
            </div>
          ))}
        </div>
        {cs && (
          <div className="flex gap-3">
            <input data-testid="message-input" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message to your accountant…"
              className="flex-1 rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
            <button data-testid="send-message-btn" onClick={send}
              className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">Send</button>
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
