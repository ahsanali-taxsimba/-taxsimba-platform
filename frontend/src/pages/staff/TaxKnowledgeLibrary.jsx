/**
 * Tax Knowledge Library — staff-only knowledge base for Taxsimba Group Ltd.
 * Editors: create/edit/upload/archive. All staff: view, notes, bookmarks.
 */
import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Plus, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import ScanStatusBadge from "@/components/documents/ScanStatusBadge";
import { Empty, Panel } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, dt } from "@/lib/api";
import { openSecureFile } from "@/lib/secureDownload";

const SECTIONS = [
  { id: "all", label: "All Knowledge" },
  { id: "categories", label: "Categories" },
  { id: "recent", label: "Recently Added" },
  { id: "notes", label: "Staff Notes" },
  { id: "bookmarks", label: "Bookmarks" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "General",
  tags: "",
  link_label: "",
  link_url: "",
};

export default function TaxKnowledgeLibrary() {
  const { user } = useAuth();
  const canEdit = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "MANAGER", "SENIOR_ACCOUNTANT"].includes(
    user?.role,
  ) && user?.role !== "JUNIOR_ACCOUNTANT";

  const [section, setSection] = useState("all");
  const [meta, setMeta] = useState({ categories: [], suggested_tags: [] });
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [noteText, setNoteText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ description: "", tags: "", link_label: "", link_url: "" });

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || detail,
    [items, selectedId, detail],
  );

  const loadMeta = () =>
    api
      .get("/tax-knowledge/meta")
      .then(({ data }) => setMeta(data))
      .catch(() => {});

  const loadList = async () => {
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (category) params.category = category;
    if (tag) params.tag = tag;
    if (section === "recent") params.recently = "1";
    if (section === "bookmarks") params.bookmarked = "1";
    const { data } = await api.get("/tax-knowledge", { params });
    setItems(data);
    if (data.length && !data.some((i) => i.id === selectedId)) {
      setSelectedId(data[0].id);
    }
    if (!data.length) {
      setSelectedId("");
      setDetail(null);
    }
  };

  const loadDetail = async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const { data } = await api.get(`/tax-knowledge/${id}`);
    setDetail(data);
    setEditForm({
      description: data.description || "",
      tags: (data.tags || []).join(", "),
      link_label: "",
      link_url: "",
    });
    setEditMode(false);
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    setErr("");
    loadList().catch((e) => setErr(apiError(e.response?.data?.detail)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, category, tag]);

  useEffect(() => {
    loadDetail(selectedId).catch((e) => setErr(apiError(e.response?.data?.detail)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onSearch = async (e) => {
    e?.preventDefault?.();
    setErr("");
    try {
      await loadList();
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail));
    }
  };

  const createItem = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const links = form.link_url.trim()
        ? [{ label: form.link_label || form.link_url, url: form.link_url.trim() }]
        : [];
      const { data } = await api.post("/tax-knowledge", {
        title: form.title,
        description: form.description,
        category: form.category,
        tags,
        external_links: links,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setNotice("Knowledge item created.");
      setSection("all");
      await loadList();
      setSelectedId(data.id);
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail) || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr("");
    try {
      const tags = editForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const links = [...(detail?.external_links || [])];
      if (editForm.link_url.trim()) {
        links.push({
          label: editForm.link_label || editForm.link_url,
          url: editForm.link_url.trim(),
        });
      }
      await api.patch(`/tax-knowledge/${selectedId}`, {
        description: editForm.description,
        tags,
        external_links: links,
      });
      setNotice("Item updated.");
      await loadDetail(selectedId);
      await loadList();
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail) || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const archiveItem = async (archived) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.patch(`/tax-knowledge/${selectedId}`, { is_archived: archived });
      setNotice(archived ? "Item archived." : "Item restored.");
      await loadList();
      await loadDetail(selectedId);
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!selectedId || !noteText.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await api.post(`/tax-knowledge/${selectedId}/notes`, { note_text: noteText.trim() });
      setNoteText("");
      setNotice("Note added.");
      await loadDetail(selectedId);
      await loadList();
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail) || "Could not add note");
    } finally {
      setBusy(false);
    }
  };

  const toggleBookmark = async () => {
    if (!selectedId) return;
    const on = !(detail?.bookmarked || selected?.bookmarked);
    try {
      if (on) await api.post(`/tax-knowledge/${selectedId}/bookmark`);
      else await api.delete(`/tax-knowledge/${selectedId}/bookmark`);
      await loadDetail(selectedId);
      await loadList();
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail));
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/tax-knowledge/${selectedId}/files`, fd);
      setNotice(`Uploaded ${file.name}`);
      await loadDetail(selectedId);
      await loadList();
    } catch (ex) {
      setErr(apiError(ex.response?.data?.detail) || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (file) => {
    try {
      await openSecureFile({
        url: `/tax-knowledge/files/${file.id}/download`,
        name: file.file_name,
        onRisk: async ({ mode, scanStatus }) => {
          if (mode === "blocked") {
            window.alert("This file is infected and cannot be downloaded.");
            return "cancel";
          }
          const ok = window.confirm(
            `This file is marked ${scanStatus}. Download anyway?`,
          );
          return ok ? "confirm" : "cancel";
        },
      });
    } catch (ex) {
      if (ex.code !== "INFECTED") setErr(ex.message || "Download failed");
    }
  };

  const notesFlat = useMemo(() => {
    if (section !== "notes") return [];
    return (detail?.notes || []).map((n) => ({ ...n, item_title: detail?.title }));
  }, [section, detail]);

  return (
    <AppShell
      title="Tax Knowledge Library"
      subtitle="Taxsimba Group Ltd — staff knowledge base, HMRC links, and notes"
    >
      {err && (
        <p className="text-sm text-[#D64545] mb-4" data-testid="tk-error">
          {err}
        </p>
      )}
      {notice && (
        <p className="text-sm text-[#16A05D] mb-4" data-testid="tk-notice">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`tk-section-${s.id}`}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              section === s.id ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65]"
            }`}
          >
            {s.label}
          </button>
        ))}
        {canEdit && (
          <button
            type="button"
            data-testid="tk-new"
            onClick={() => setShowCreate((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#078A4B] text-white"
          >
            <Plus className="w-3.5 h-3.5" /> New item
          </button>
        )}
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#626A65]" />
          <input
            data-testid="tk-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, descriptions, tags, notes, file names…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E3E7E4] text-sm"
          />
        </div>
        {(section === "categories" || section === "all") && (
          <select
            data-testid="tk-category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E3E7E4] text-sm"
          >
            <option value="">All categories</option>
            {(meta.categories || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          data-testid="tk-tag-filter"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E3E7E4] text-sm"
        >
          <option value="">All tags</option>
          {(meta.suggested_tags || []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#E3E7E4] text-[#161B18]"
        >
          Search
        </button>
      </form>

      {showCreate && canEdit && (
        <Panel title="Add knowledge item" testId="tk-create">
          <form onSubmit={createItem} className="grid md:grid-cols-2 gap-3 text-sm">
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#626A65]">Title</span>
              <input
                required
                data-testid="tk-create-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#626A65]">Category</span>
              <select
                data-testid="tk-create-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              >
                {(meta.categories || ["General"]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#626A65]">Tags (comma-separated)</span>
              <input
                data-testid="tk-create-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="HMRC Manual, MTD ITSA"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-[#626A65]">Description</span>
              <textarea
                data-testid="tk-create-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#626A65]">Link label</span>
              <input
                value={form.link_label}
                onChange={(e) => setForm({ ...form, link_label: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#626A65]">External URL (HMRC etc.)</span>
              <input
                data-testid="tk-create-url"
                type="url"
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://www.gov.uk/…"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
              />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                data-testid="tk-create-submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#078A4B] text-white disabled:opacity-50"
              >
                Save item
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm border border-[#E3E7E4]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Panel
          title={section === "notes" ? "Items with notes focus" : "Knowledge items"}
          testId="tk-list"
        >
          {!items.length && <Empty text="No knowledge items match these filters." />}
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`tk-item-${item.id}`}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left px-3 py-3 rounded-lg border text-sm ${
                    selectedId === item.id
                      ? "border-[#078A4B] bg-[#EAF5EE]"
                      : "border-[#E3E7E4] hover:bg-[#F1F8F4]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-[#161B18]">{item.title}</div>
                    {item.bookmarked && <BookmarkCheck className="w-4 h-4 text-[#078A4B] shrink-0" />}
                  </div>
                  <div className="text-xs text-[#626A65] mt-1 flex flex-wrap gap-2">
                    <span className="font-semibold text-[#006B3C]">{item.category}</span>
                    <span>{item.file_count || 0} files</span>
                    <span>{item.note_count || 0} notes</span>
                    <span>Updated {dt(item.updated_at)}</span>
                  </div>
                  {(item.tags || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F8F4] text-[#006B3C]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Item detail" testId="tk-detail">
            {!detail && <Empty text="Select an item to view details." />}
            {detail && (
              <div className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#161B18]" data-testid="tk-detail-title">
                      {detail.title}
                    </h3>
                    <p className="text-xs text-[#626A65] mt-1">
                      {detail.category} · by {detail.created_by_name} · {dt(detail.updated_at)}
                      {detail.is_archived ? " · Archived" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="tk-bookmark"
                    onClick={toggleBookmark}
                    className="p-2 rounded-lg border border-[#E3E7E4]"
                    title={detail.bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    {detail.bookmarked ? (
                      <BookmarkCheck className="w-4 h-4 text-[#078A4B]" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-[#626A65]" />
                    )}
                  </button>
                </div>

                {!editMode && (
                  <p className="text-[#161B18] whitespace-pre-wrap">{detail.description || "No description."}</p>
                )}
                {editMode && canEdit && (
                  <textarea
                    data-testid="tk-edit-desc"
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
                  />
                )}

                {(detail.tags || []).length > 0 && !editMode && (
                  <div className="flex flex-wrap gap-1">
                    {detail.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F8F4] text-[#006B3C]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {editMode && canEdit && (
                  <input
                    data-testid="tk-edit-tags"
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    placeholder="Tags, comma-separated"
                    className="w-full px-3 py-2 rounded-lg border border-[#E3E7E4]"
                  />
                )}

                {(detail.external_links || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[#626A65] mb-1">External links</div>
                    <ul className="space-y-1">
                      {detail.external_links.map((l, idx) => (
                        <li key={`${l.url}-${idx}`}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#078A4B] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {l.label || l.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {editMode && canEdit && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editForm.link_label}
                      onChange={(e) => setEditForm({ ...editForm, link_label: e.target.value })}
                      placeholder="New link label"
                      className="px-3 py-2 rounded-lg border border-[#E3E7E4]"
                    />
                    <input
                      value={editForm.link_url}
                      onChange={(e) => setEditForm({ ...editForm, link_url: e.target.value })}
                      placeholder="https://…"
                      className="px-3 py-2 rounded-lg border border-[#E3E7E4]"
                    />
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-[#626A65] mb-1">Uploaded files</div>
                  {!(detail.files || []).length && (
                    <p className="text-xs text-[#626A65]">No files yet.</p>
                  )}
                  <ul className="space-y-2">
                    {(detail.files || []).map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 border border-[#E3E7E4] rounded-lg px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => downloadFile(f)}
                          className="text-left text-[#078A4B] hover:underline truncate"
                        >
                          {f.file_name}
                        </button>
                        <ScanStatusBadge status={f.scan_status} />
                      </li>
                    ))}
                  </ul>
                  {canEdit && !detail.is_archived && (
                    <label className="mt-2 inline-block text-xs font-semibold text-[#078A4B] cursor-pointer">
                      + Upload file (PDF, Word, Excel, images · max 20MB)
                      <input
                        type="file"
                        data-testid="tk-upload"
                        className="hidden"
                        onChange={onUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      />
                    </label>
                  )}
                </div>

                {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E3E7E4]">
                    {!editMode ? (
                      <button
                        type="button"
                        data-testid="tk-edit"
                        onClick={() => setEditMode(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E3E7E4]"
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-testid="tk-save"
                          disabled={busy}
                          onClick={saveEdit}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#078A4B] text-white disabled:opacity-50"
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditMode(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E3E7E4]"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      data-testid="tk-archive"
                      disabled={busy}
                      onClick={() => archiveItem(!detail.is_archived)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E3E7E4]"
                    >
                      {detail.is_archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Staff notes" testId="tk-notes">
            {!detail && <Empty text="Select an item to view or add notes." />}
            {detail && (
              <>
                <form onSubmit={addNote} className="mb-4 space-y-2">
                  <textarea
                    data-testid="tk-note-text"
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a staff note…"
                    className="w-full px-3 py-2 rounded-lg border border-[#E3E7E4] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !noteText.trim()}
                    data-testid="tk-note-submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#078A4B] text-white disabled:opacity-50"
                  >
                    Add note
                  </button>
                </form>
                <ul className="space-y-3">
                  {(section === "notes" ? notesFlat : detail.notes || []).map((n) => (
                    <li key={n.id} className="border-b border-[#E3E7E4] pb-2 text-sm last:border-0">
                      <div className="text-xs text-[#626A65]">
                        {n.staff_name} · {dt(n.created_at)}
                      </div>
                      <p className="mt-1 text-[#161B18] whitespace-pre-wrap">{n.note_text}</p>
                    </li>
                  ))}
                  {!(detail.notes || []).length && (
                    <Empty text="No notes yet — junior and senior staff can add them." />
                  )}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
