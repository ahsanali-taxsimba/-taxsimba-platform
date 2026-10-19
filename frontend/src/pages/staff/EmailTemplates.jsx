/**
 * Email Template Library — Taxsimba Group Ltd.
 * Admin + Accountant: pick template, fill merge fields, preview, send to client.
 * Admins may edit template subject/body; accountants are read-only on catalogue copy.
 */
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, dt } from "@/lib/api";

const TOKENS = [
  "[Client Name]",
  "[Appointment Date]",
  "[Appointment Time]",
  "[Staff Name]",
  "[Missing Item 1]",
  "[Missing Item 2]",
];

export default function EmailTemplates() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const defaultCat = isAdmin ? "admin" : "accountant";

  const [category, setCategory] = useState(defaultCat);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [merge, setMerge] = useState({});
  const [clients, setClients] = useState([]);
  const [clientUserId, setClientUserId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [preview, setPreview] = useState(null);
  const [log, setLog] = useState([]);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", subject: "", body: "" });

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId],
  );

  const loadTemplates = async (cat) => {
    const { data } = await api.get("/email-templates", { params: { category: cat } });
    setTemplates(data);
    if (data.length && !data.some((t) => t.id === selectedId)) {
      setSelectedId(data[0].id);
    }
  };

  const loadClients = async () => {
    // Derive recipients from cases the staff member can see.
    try {
      const { data } = await api.get("/cases");
      const map = new Map();
      for (const c of data || []) {
        if (c.client_user_id && !map.has(c.client_user_id)) {
          map.set(c.client_user_id, {
            user_id: c.client_user_id,
            name: c.client_name,
            email: c.client_email,
            case_id: c.id,
            label: `${c.client_name} · ${c.case_ref || c.id}`,
          });
        }
      }
      setClients([...map.values()]);
    } catch {
      setClients([]);
    }
  };

  const loadLog = () =>
    api
      .get("/email-templates/send-log")
      .then(({ data }) => setLog(data))
      .catch(() => setLog([]));

  useEffect(() => {
    setErr("");
    loadTemplates(category).catch((e) => setErr(apiError(e.response?.data?.detail)));
    loadClients();
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (!selected) return;
    setEditForm({
      title: selected.title || "",
      subject: selected.subject || "",
      body: selected.body || "",
    });
    setEditMode(false);
    setPreview(null);
  }, [selectedId, selected]);

  useEffect(() => {
    if (!clientUserId) return;
    api
      .get("/email-templates/merge-suggestions", {
        params: { client_user_id: clientUserId, case_id: caseId || undefined },
      })
      .then(({ data }) => setMerge((m) => ({ ...data, ...m, "[Client Name]": data["[Client Name]"] || m["[Client Name]"], "[Staff Name]": data["[Staff Name]"] || user?.name || "" })))
      .catch(() => {});
  }, [clientUserId, caseId, user?.name]);

  const doPreview = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post(`/email-templates/${selectedId}/preview`, {
        merge_values: merge,
      });
      setPreview(data);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!selectedId || !clientUserId) {
      setErr("Select a template and a client");
      return;
    }
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      // Refresh preview first so sender sees final copy.
      const { data: prev } = await api.post(`/email-templates/${selectedId}/preview`, {
        merge_values: merge,
      });
      setPreview(prev);
      await api.post(`/email-templates/${selectedId}/send`, {
        client_user_id: clientUserId,
        case_id: caseId || null,
        merge_values: merge,
        subject_override: prev.subject,
        body_override: prev.body,
      });
      setNotice("Email queued and logged.");
      loadLog();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedId || !isAdmin) return;
    setBusy(true);
    setErr("");
    try {
      await api.patch(`/email-templates/${selectedId}`, editForm);
      await loadTemplates(category);
      setEditMode(false);
      setNotice("Template updated.");
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Email Templates"
      subtitle="Taxsimba Group Ltd — predefined Admin & Accountant client emails"
    >
      {err && (
        <p className="text-sm text-[#D64545] mb-4" data-testid="email-tpl-error">
          {err}
        </p>
      )}
      {notice && (
        <p className="text-sm text-[#16A05D] mb-4" data-testid="email-tpl-notice">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {(isAdmin ? ["admin", "accountant"] : ["accountant"]).map((c) => (
          <button
            key={c}
            type="button"
            data-testid={`email-tpl-cat-${c}`}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
              category === c ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65]"
            }`}
          >
            {c} templates
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Catalogue" testId="email-tpl-list">
          {!templates.length && <Empty text="No templates in this category." />}
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  data-testid={`email-tpl-item-${t.seed_key || t.id}`}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-3 py-3 rounded-lg border text-sm ${
                    selectedId === t.id
                      ? "border-[#078A4B] bg-[#EAF5EE]"
                      : "border-[#E3E7E4] hover:bg-[#F1F8F4]"
                  }`}
                >
                  <div className="font-semibold text-[#161B18]">{t.title}</div>
                  <div className="text-xs text-[#626A65] mt-1 truncate">{t.subject}</div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Compose & send" testId="email-tpl-compose">
            {!selected && <Empty text="Select a template." />}
            {selected && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#626A65]">Client</label>
                  <select
                    data-testid="email-tpl-client"
                    value={clientUserId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setClientUserId(id);
                      const row = clients.find((c) => c.user_id === id);
                      if (row?.case_id) setCaseId(row.case_id);
                    }}
                    className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.user_id} value={c.user_id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#626A65]">Case id (optional)</label>
                  <input
                    data-testid="email-tpl-case"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {TOKENS.map((token) => (
                    <label key={token} className="text-xs font-semibold text-[#626A65]">
                      {token}
                      <input
                        data-testid={`email-tpl-merge-${token.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                        value={merge[token] || ""}
                        onChange={(e) => setMerge({ ...merge, [token]: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  ))}
                </div>

                {isAdmin && (
                  <div className="border-t border-[#E3E7E4] pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#626A65]">
                        Template copy {editMode ? "(editing)" : "(read-only for accountants)"}
                      </span>
                      <button
                        type="button"
                        data-testid="email-tpl-edit-toggle"
                        className="text-xs font-semibold text-[#006B3C]"
                        onClick={() => setEditMode(!editMode)}
                      >
                        {editMode ? "Cancel edit" : "Edit template"}
                      </button>
                    </div>
                    {editMode ? (
                      <div className="space-y-2">
                        <input
                          data-testid="email-tpl-edit-title"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                        />
                        <input
                          data-testid="email-tpl-edit-subject"
                          value={editForm.subject}
                          onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                          className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                        />
                        <textarea
                          data-testid="email-tpl-edit-body"
                          rows={8}
                          value={editForm.body}
                          onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                          className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm font-mono"
                        />
                        <button
                          type="button"
                          data-testid="email-tpl-save"
                          disabled={busy}
                          onClick={saveEdit}
                          className="px-3 py-2 rounded-lg bg-[#161B18] text-white text-xs font-semibold"
                        >
                          Save template
                        </button>
                      </div>
                    ) : (
                      <pre className="text-xs text-[#445049] whitespace-pre-wrap bg-[#F7F8F7] rounded-lg p-3 max-h-40 overflow-auto">
                        {selected.subject}
                        {"\n\n"}
                        {selected.body}
                      </pre>
                    )}
                  </div>
                )}

                {!isAdmin && (
                  <pre className="text-xs text-[#445049] whitespace-pre-wrap bg-[#F7F8F7] rounded-lg p-3 max-h-40 overflow-auto">
                    {selected.subject}
                    {"\n\n"}
                    {selected.body}
                  </pre>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="email-tpl-preview"
                    disabled={busy}
                    onClick={doPreview}
                    className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    data-testid="email-tpl-send"
                    disabled={busy || !clientUserId}
                    onClick={doSend}
                    className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send to client"}
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Preview" testId="email-tpl-preview-panel">
            {!preview && <Empty text="Click Preview to see the merged email." />}
            {preview && (
              <div className="space-y-3" data-testid="email-tpl-preview-body">
                <div>
                  <div className="text-[10px] uppercase text-[#626A65] font-semibold">Subject</div>
                  <div className="text-sm font-semibold">{preview.subject}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[#626A65] font-semibold">Body</div>
                  <pre className="text-sm whitespace-pre-wrap text-[#161B18] mt-1">{preview.body}</pre>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Send log" testId="email-tpl-log" className="mt-6">
        {!log.length && <Empty text="No template emails sent yet." />}
        <ul className="divide-y divide-[#E3E7E4] text-sm">
          {log.map((row) => (
            <li key={row.id} className="py-3 flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-semibold">{row.template_title}</div>
                <div className="text-xs text-[#626A65]">
                  To {row.client_name} ({row.client_email}) · by {row.sender_name}
                </div>
                <div className="text-xs text-[#626A65] mt-0.5">{row.subject}</div>
              </div>
              <div className="text-xs text-[#626A65]">{dt(row.created_at)}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </AppShell>
  );
}
