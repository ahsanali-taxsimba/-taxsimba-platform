"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function NewLeadModal({ open, onClose, onCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: "",
    message: "",
    notes: "",
  });

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, source: "manual" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Could not create lead");
      }
      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        subject: "",
        message: "",
        notes: "",
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/40 p-4 sm:items-center"
      data-testid="new-lead-modal"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-lg animate-rise rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow)]"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Add lead</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Manual entry when a lead arrives offline</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-new-lead"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--mist)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
              ["company", "Company", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--ink-soft)]">{label}</span>
              <input
                data-testid={`field-${key}`}
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </label>
          ))}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-[var(--ink-soft)]">Subject</span>
            <input
              data-testid="field-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-[var(--ink-soft)]">Message</span>
            <textarea
              data-testid="field-message"
              rows={3}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-[var(--ink-soft)]">Internal notes</span>
            <textarea
              data-testid="field-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" data-testid="new-lead-error">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--mist)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            data-testid="submit-new-lead"
            className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--ink-soft)] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
