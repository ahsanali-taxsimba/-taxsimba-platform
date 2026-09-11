"use client";

/**
 * Accountant-led external filing recorder.
 * TaxSimba does NOT call HMRC — staff record submission date/reference from
 * third-party filing software (e.g. Xero / commercial SA software).
 */
import React, { useState } from "react";
import clientAxios from "@/lib/axios-client";
import { toast } from "react-toastify";

type Props = {
  taxReturnId: string;
  nodeStatus?: string | null;
  onRecorded?: () => void;
};

export default function ExternalSubmissionPanel({
  taxReturnId,
  nodeStatus,
  onRecorded,
}: Props) {
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [provider, setProvider] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = nodeStatus === "READY_FOR_SUBMISSION";
  const already = nodeStatus === "SUBMITTED" || nodeStatus === "COMPLETED";

  const submit = async () => {
    if (!date.trim() || !reference.trim()) {
      toast.error("Submission date and reference are required");
      return;
    }
    setBusy(true);
    try {
      await clientAxios.post(
        `/admin/tax-return/${encodeURIComponent(taxReturnId)}/record-submission`,
        {
          submissionDate: date.trim(),
          submissionReference: reference.trim(),
          provider: provider.trim() || null,
          note: note.trim() || null,
        },
      );
      toast.success("External submission recorded");
      onRecorded?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to record submission";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (already) {
    return (
      <div
        className="border border-green-200 bg-green-50 rounded-lg p-4"
        data-testid="external-submission-recorded"
      >
        <h3 className="text-sm font-semibold text-green-900">
          External submission recorded
        </h3>
        <p className="text-xs text-green-800 mt-1">
          Filing was completed outside TaxSimba (third-party software). No HMRC API
          is used by this platform.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-200 rounded-lg p-5"
      data-testid="external-submission-panel"
    >
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        Record external submission
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Accountants file Self Assessment / MTD externally. Enter the filing
        reference here for audit — TaxSimba does not connect to HMRC APIs.
      </p>
      {!ready && (
        <p className="text-sm text-amber-700 mb-3">
          Available when the case is Ready for Submission (admin + client
          approval complete).
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="date"
          data-testid="submission-date"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={!ready || busy}
        />
        <input
          type="text"
          data-testid="submission-reference"
          placeholder="Submission reference"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={!ready || busy}
        />
        <input
          type="text"
          placeholder="Provider (e.g. Xero, commercial SA software)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={!ready || busy}
        />
        <textarea
          rows={2}
          placeholder="Optional note"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!ready || busy}
        />
      </div>
      <button
        type="button"
        data-testid="record-submission-btn"
        disabled={!ready || busy || !date || !reference}
        className="mt-3 px-4 py-2 rounded-lg bg-[#37a267] text-white text-sm font-semibold disabled:opacity-50"
        onClick={() => void submit()}
      >
        Record submission
      </button>
    </div>
  );
}
