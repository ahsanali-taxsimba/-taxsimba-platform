/**
 * Single tax-return document category card — title, description, upload, status, notes.
 */
import { useState } from "react";
import { api, apiError, dt } from "@/lib/api";

const STATUS_TONE = {
  NOT_UPLOADED: ["#F1F3F2", "#626A65", "Not uploaded"],
  UPLOADED: ["#FDF3E3", "#B77A12", "Uploaded"],
  VERIFIED: ["#E9F7EF", "#16A05D", "Verified"],
  NOT_APPLICABLE: ["#F0EBFB", "#7656C9", "Not applicable"],
};

export function CategoryStatusBadge({ status }) {
  const [bg, fg, label] = STATUS_TONE[status] || STATUS_TONE.NOT_UPLOADED;
  return (
    <span
      data-testid={`intake-status-${status}`}
      className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

export default function CategoryCard({
  category,
  canVerify,
  onChanged,
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState(category.accountant_notes || "");

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/intake/categories/${category.id}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChanged?.();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (body) => {
    setBusy(true);
    setErr("");
    try {
      await api.patch(`/intake/categories/${category.id}`, body);
      onChanged?.();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (fileId) => {
    const win = window.open("", "_blank");
    try {
      const res = await api.get(`/intake/files/${fileId}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      if (win) win.location.href = url;
    } catch (e) {
      if (win) win.close();
      setErr(apiError(e.response?.data?.detail) || "Could not open file");
    }
  };

  return (
    <div
      className="border border-[#E3E7E4] rounded-xl p-5 bg-white flex flex-col min-h-[220px]"
      data-testid={`intake-card-${category.category_key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#161B18]">{category.category_name}</h3>
          {category.mandatory && (
            <span className="text-[10px] uppercase tracking-wide text-[#D64545] font-bold">Mandatory</span>
          )}
        </div>
        <CategoryStatusBadge status={category.status} />
      </div>
      <p className="text-xs text-[#626A65] mt-2 flex-1">{category.description}</p>
      <p className="text-[10px] text-[#626A65] mt-1">
        Maps to: <span className="font-semibold">{(category.tax_section || "").replace(/_/g, " ")}</span>
      </p>

      <ul className="mt-3 space-y-1 max-h-24 overflow-y-auto">
        {(category.files || []).map((f) => (
          <li key={f.id} className="flex justify-between gap-2 text-xs">
            <button
              type="button"
              className="text-[#006B3C] font-semibold truncate text-left"
              onClick={() => openFile(f.id)}
            >
              {f.file_name}
            </button>
            <span className="text-[#626A65] shrink-0">v{f.version} · {dt(f.uploaded_at)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <label className={`px-3 py-1.5 rounded-lg border border-[#E3E7E4] text-xs font-semibold cursor-pointer ${busy ? "opacity-50" : "hover:bg-[#F1F8F4]"}`}>
          Upload
          <input
            data-testid={`intake-upload-${category.category_key}`}
            type="file"
            className="hidden"
            disabled={busy || category.status === "NOT_APPLICABLE"}
            accept="image/*,application/pdf,.csv,.xls,.xlsx"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        {category.status !== "NOT_APPLICABLE" ? (
          <button
            type="button"
            data-testid={`intake-na-${category.category_key}`}
            disabled={busy}
            className="text-xs font-semibold text-[#7656C9]"
            onClick={() => patch({ status: "NOT_APPLICABLE" })}
          >
            Mark N/A
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="text-xs font-semibold text-[#626A65]"
            onClick={() => patch({ status: "NOT_UPLOADED" })}
          >
            Clear N/A
          </button>
        )}
        {canVerify && category.status === "UPLOADED" && (
          <button
            type="button"
            data-testid={`intake-verify-${category.category_key}`}
            disabled={busy}
            className="text-xs font-semibold text-[#16A05D]"
            onClick={() => patch({ status: "VERIFIED" })}
          >
            Verify
          </button>
        )}
      </div>

      {canVerify && (
        <div className="mt-3">
          <label className="text-[10px] uppercase text-[#626A65] font-semibold">Accountant notes</label>
          <textarea
            data-testid={`intake-notes-${category.category_key}`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((category.accountant_notes || "") !== notes) {
                patch({ accountant_notes: notes || null });
              }
            }}
            className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-2 py-1.5 text-xs"
            placeholder="Internal notes for this category"
          />
        </div>
      )}
      {!canVerify && category.accountant_notes && (
        <p className="mt-2 text-xs text-[#626A65]">Note: {category.accountant_notes}</p>
      )}
      {err && <p className="text-xs text-[#D64545] mt-2">{err}</p>}
    </div>
  );
}
