/**
 * Engagement Letter signing modal — replaces the former “Client Care Letter” step.
 *
 * Pops up after service activation / on dashboard when status is PENDING_SIGNATURE.
 * Legal wording is server-rendered and not editable; only signature + early-start
 * checkbox are client inputs.
 */
import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

export default function EngagementLetterModal({
  open,
  engagement: initial,
  onClose,
  onSigned,
  /** When true, modal cannot be dismissed without signing (onboarding gate). */
  required = false,
}) {
  const [letter, setLetter] = useState(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("CLICK");
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [earlyStart, setEarlyStart] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setConsent(false);
    if (initial) {
      setLetter(initial);
      setTypedName(initial.signed_name || initial.your_ref || "");
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get("/engagement/me")
      .then(({ data }) => {
        setLetter(data.engagement);
        setTypedName(data.engagement?.your_ref || "");
      })
      .catch((e) => setErr(apiError(e.response?.data?.detail) || "Could not load engagement letter"))
      .finally(() => setLoading(false));
  }, [open, initial]);

  if (!open) return null;

  const alreadySigned = letter && ["SIGNED", "ACTIVE"].includes(letter.status);

  const sign = async () => {
    setErr("");
    if (!consent) return setErr("Please confirm you agree to the engagement letter and terms of business.");
    setBusy(true);
    try {
      const { data } = await api.post("/engagement/me/sign", {
        signature_type: mode,
        typed_name: mode === "TYPED" ? typedName.trim() : null,
        signature_data: mode === "TYPED" ? typedName.trim() : null,
        early_start_instructed: earlyStart,
        consent_accepted: true,
      });
      setLetter(data);
      onSigned?.(data);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Could not record your signature");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"
      data-testid="engagement-letter-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Engagement letter"
    >
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-xl border border-[#E3E7E4] shadow-xl flex flex-col overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-[#E3E7E4] flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#626A65] font-semibold">
              Engagement letter
            </p>
            <h2 className="text-lg font-bold text-[#161B18] mt-0.5">
              Terms of Engagement
            </h2>
            <p className="text-xs text-[#626A65] mt-1">
              This replaces the previous Client Care Letter. Please read and sign to continue.
              {letter?.our_ref ? ` · Our Ref ${letter.our_ref}` : ""}
            </p>
          </div>
          {!required || alreadySigned ? (
            <button
              type="button"
              className="text-sm text-[#626A65] font-semibold"
              onClick={onClose}
              data-testid="engagement-close"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {loading && <p className="text-sm text-[#626A65]">Loading your engagement letter…</p>}
          {!loading && letter && (
            <>
              <div
                data-testid="engagement-letter-body"
                className="rounded-lg border border-[#E3E7E4] bg-[#FCFDFC] p-4 sm:p-6 text-sm"
                // Server escapes the legal text into HTML; body is not staff-editable.
                dangerouslySetInnerHTML={{ __html: letter.body_html }}
              />
              {letter.schedules?.length > 0 && (
                <div className="mt-4 text-xs text-[#626A65]" data-testid="engagement-schedules-summary">
                  <span className="font-semibold text-[#161B18]">Schedules included: </span>
                  {letter.schedules.map((s) => s.service_label).join(" · ")}
                </div>
              )}
            </>
          )}
          {!loading && !letter && (
            <p className="text-sm text-[#626A65]">
              No engagement letter is ready yet. Activate a service first, then return here to sign.
            </p>
          )}
        </div>

        <div className="border-t border-[#E3E7E4] px-5 sm:px-6 py-4 shrink-0 bg-[#F7F9F8]">
          {alreadySigned ? (
            <div data-testid="engagement-already-signed" className="text-sm text-[#16A05D] font-semibold">
              Signed {letter.signed_name ? `by ${letter.signed_name}` : ""} — engagement is active.
              {letter.early_start_instructed ? " Early start of services was instructed." : ""}
            </div>
          ) : letter ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="engagement-mode-click"
                  onClick={() => setMode("CLICK")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "CLICK" ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]" : "border-[#E3E7E4]"}`}
                >
                  Click to sign
                </button>
                <button
                  type="button"
                  data-testid="engagement-mode-typed"
                  onClick={() => setMode("TYPED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "TYPED" ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]" : "border-[#E3E7E4]"}`}
                >
                  Type signature
                </button>
              </div>

              {mode === "TYPED" && (
                <input
                  data-testid="engagement-typed-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm italic"
                />
              )}
              {mode === "CLICK" && (
                <div
                  data-testid="engagement-click-preview"
                  className="rounded-lg border-2 border-dashed border-[#C6EBD5] bg-white px-4 py-4 text-center italic text-lg text-[#006B3C]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {typedName || letter.your_ref || "Your signature"}
                </div>
              )}

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="engagement-early-start"
                  className="mt-1"
                  checked={earlyStart}
                  onChange={(e) => setEarlyStart(e.target.checked)}
                />
                <span>
                  I hereby instruct you to begin providing the attached schedules of services before the expiry of the cancellation period
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="engagement-consent"
                  className="mt-1"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  <strong>{letter.consent_text}</strong>
                </span>
              </label>

              {err && <p data-testid="engagement-sign-error" className="text-sm text-[#D64545]">{err}</p>}

              <button
                type="button"
                data-testid="engagement-sign-btn"
                disabled={busy || !consent}
                onClick={sign}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] disabled:opacity-50"
              >
                {busy ? "Signing…" : "Sign engagement letter"}
              </button>
            </div>
          ) : null}
          {err && !letter && <p className="text-sm text-[#D64545] mt-2">{err}</p>}
        </div>
      </div>
    </div>
  );
}
