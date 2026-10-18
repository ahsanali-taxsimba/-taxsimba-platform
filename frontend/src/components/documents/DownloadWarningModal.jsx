/**
 * Staff gate before downloading suspicious/corrupt files, or blocking infected ones.
 */
export default function DownloadWarningModal({
  open,
  mode, // "warn" | "blocked"
  scanStatus,
  fileName,
  onConfirm,
  onCancel,
  onRequestAlternative,
  busy,
}) {
  if (!open) return null;
  const infected = mode === "blocked" || scanStatus === "infected";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="download-warning-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-[#E3E7E4]">
        {infected ? (
          <>
            <h2 className="text-lg font-semibold text-[#161B18]">
              ❌ This file contains malware and cannot be downloaded.
            </h2>
            <p className="text-sm text-[#626A65] mt-2">
              Please request a replacement from the client
              {fileName ? ` for “${fileName}”` : ""}.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#161B18]">
              ⚠ This file appears suspicious or corrupt. Download at your own risk.
            </h2>
            <p className="text-sm text-[#626A65] mt-2">
              We recommend requesting an alternative document from the client
              {fileName ? ` for “${fileName}”` : ""}.
            </p>
            {scanStatus && (
              <p className="text-xs text-[#626A65] mt-2 capitalize">Scan status: {scanStatus}</p>
            )}
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            data-testid="download-warn-cancel"
            className="px-3 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold text-[#626A65]"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          {onRequestAlternative && (
            <button
              type="button"
              data-testid="download-warn-request-alt"
              className="px-3 py-2 rounded-lg border border-[#B77A12] text-xs font-semibold text-[#B77A12]"
              onClick={onRequestAlternative}
              disabled={busy}
            >
              Request Alternative Document
            </button>
          )}
          {!infected && (
            <button
              type="button"
              data-testid="download-warn-confirm"
              className="px-3 py-2 rounded-lg bg-[#161B18] text-white text-xs font-semibold"
              onClick={onConfirm}
              disabled={busy}
            >
              Download anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
