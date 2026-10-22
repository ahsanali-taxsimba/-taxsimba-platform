/**
 * Engagement Letter signing modal — Taxsimba Group Ltd.
 *
 * Compact client UX: summary + schedules first, full letter behind a toggle,
 * signature controls always visible (minimal scrolling).
 */
import { useEffect, useMemo, useState } from "react";
import { api, apiError, money as formatMoney } from "@/lib/api";

function feeLabel(v) {
  if (v == null || v === "") return null;
  try {
    return formatMoney(v);
  } catch {
    return null;
  }
}

const KEY_POINTS = [
  {
    title: "Who you’re engaging",
    body: "Taxsimba Group Ltd will act as your tax advisers for the services listed below.",
  },
  {
    title: "What we will do",
    body: "Tax return clients: prepare and submit your Self Assessment return. MTD clients: quarterly updates and Final Declaration. Only scheduled services are included.",
  },
  {
    title: "Fees",
    body: "Fees match the package you purchased on Taxsimba (shown in your schedules).",
  },
  {
    title: "Your right to cancel",
    body: "You can cancel within 14 days. Email admin@taxsimba.co.uk to cancel.",
  },
];

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
  const [showFull, setShowFull] = useState(false);
  const [tab, setTab] = useState("summary"); // summary | sign

  useEffect(() => {
    if (!open) return;
    setErr("");
    setConsent(false);
    setShowFull(false);
    setTab("summary");
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

  const schedules = useMemo(() => letter?.schedules || [], [letter]);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      data-testid="engagement-letter-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Engagement letter"
    >
      <div className="w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[88vh] bg-white rounded-t-2xl sm:rounded-xl border border-[#E3E7E4] shadow-xl flex flex-col overflow-hidden">
        {/* Header — compact */}
        <div className="px-4 sm:px-5 py-3 border-b border-[#E3E7E4] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#626A65] font-semibold">
              Taxsimba Group Ltd
            </p>
            <h2 className="text-base sm:text-lg font-bold text-[#161B18] mt-0.5 truncate">
              Engagement letter — review & sign
            </h2>
            <p className="text-xs text-[#626A65] mt-0.5">
              {letter?.our_ref ? `Ref ${letter.our_ref}` : "Terms of Engagement"}
              {letter?.letter_date ? ` · ${letter.letter_date}` : ""}
            </p>
          </div>
          {!required || alreadySigned ? (
            <button
              type="button"
              className="text-sm text-[#626A65] font-semibold shrink-0"
              onClick={onClose}
              data-testid="engagement-close"
            >
              Close
            </button>
          ) : null}
        </div>

        {/* Segment tabs — keep client in one viewport */}
        {!alreadySigned && letter && (
          <div className="px-4 sm:px-5 pt-3 shrink-0 flex gap-2" data-testid="engagement-tabs">
            {[
              ["summary", "Summary"],
              ["sign", "Sign"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`engagement-tab-${id}`}
                onClick={() => setTab(id)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-semibold ${
                  tab === id
                    ? "bg-[#EAF5EE] text-[#006B3C]"
                    : "border border-[#E3E7E4] text-[#626A65]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 min-h-0">
          {loading && <p className="text-sm text-[#626A65]">Loading your engagement letter…</p>}

          {!loading && letter && alreadySigned && (
            <div data-testid="engagement-already-signed" className="space-y-3">
              <p className="text-sm font-semibold text-[#16A05D]">
                Signed {letter.signed_name ? `by ${letter.signed_name}` : ""} — engagement is active.
              </p>
              {letter.early_start_instructed && (
                <p className="text-xs text-[#626A65]">Early start of services was instructed.</p>
              )}
              <ScheduleCards schedules={schedules} />
              <FullLetterToggle
                showFull={showFull}
                setShowFull={setShowFull}
                bodyHtml={letter.body_html}
              />
            </div>
          )}

          {!loading && letter && !alreadySigned && tab === "summary" && (
            <div className="space-y-4" data-testid="engagement-summary">
              <p className="text-sm text-[#161B18]">
                Please review the key points and your package fees, then continue to sign. The full
                letter is available if you want to read every clause.
              </p>

              <ScheduleCards schedules={schedules} />

              <div className="grid sm:grid-cols-2 gap-2">
                {KEY_POINTS.map((p) => (
                  <div key={p.title} className="rounded-lg border border-[#E3E7E4] px-3 py-2">
                    <div className="text-[11px] font-semibold text-[#006B3C]">{p.title}</div>
                    <p className="text-[11px] text-[#626A65] mt-0.5 leading-snug">{p.body}</p>
                  </div>
                ))}
              </div>

              <FullLetterToggle
                showFull={showFull}
                setShowFull={setShowFull}
                bodyHtml={letter.body_html}
              />

              <button
                type="button"
                data-testid="engagement-continue-sign"
                onClick={() => setTab("sign")}
                className="w-full px-4 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C]"
              >
                Continue to sign
              </button>
            </div>
          )}

          {!loading && letter && !alreadySigned && tab === "sign" && (
            <div className="space-y-3" data-testid="engagement-sign-panel">
              <button
                type="button"
                className="text-xs font-semibold text-[#006B3C]"
                onClick={() => setTab("summary")}
                data-testid="engagement-back-summary"
              >
                ← Back to summary
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="engagement-mode-click"
                  onClick={() => setMode("CLICK")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    mode === "CLICK"
                      ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]"
                      : "border-[#E3E7E4]"
                  }`}
                >
                  Click to sign
                </button>
                <button
                  type="button"
                  data-testid="engagement-mode-typed"
                  onClick={() => setMode("TYPED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    mode === "TYPED"
                      ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]"
                      : "border-[#E3E7E4]"
                  }`}
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
                  className="rounded-lg border-2 border-dashed border-[#C6EBD5] bg-[#FCFDFC] px-4 py-3 text-center italic text-base text-[#006B3C]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {typedName || letter.your_ref || "Your signature"}
                </div>
              )}

              <label className="flex items-start gap-2 text-xs sm:text-sm cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="engagement-early-start"
                  className="mt-0.5"
                  checked={earlyStart}
                  onChange={(e) => setEarlyStart(e.target.checked)}
                />
                <span>
                  Start services now (before the 14-day cancellation period ends)
                </span>
              </label>

              <label className="flex items-start gap-2 text-xs sm:text-sm cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="engagement-consent"
                  className="mt-0.5"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  <strong className="font-semibold text-[#161B18]">
                    {letter.consent_text ||
                      "I agree to this engagement letter, the schedules of services, and the terms of business."}
                  </strong>
                </span>
              </label>

              {err && (
                <p data-testid="engagement-sign-error" className="text-sm text-[#D64545]">
                  {err}
                </p>
              )}
            </div>
          )}

          {!loading && !letter && (
            <p className="text-sm text-[#626A65]">
              No engagement letter is ready yet. Activate a service first, then return here to sign.
            </p>
          )}
          {err && !letter && <p className="text-sm text-[#D64545] mt-2">{err}</p>}
        </div>

        {/* Sticky footer — always on screen */}
        {!alreadySigned && letter && tab === "sign" && (
          <div className="border-t border-[#E3E7E4] px-4 sm:px-5 py-3 shrink-0 bg-[#F7F9F8]">
            <button
              type="button"
              data-testid="engagement-sign-btn"
              disabled={busy || !consent}
              onClick={sign}
              className="w-full px-6 py-3 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] disabled:opacity-50"
            >
              {busy ? "Signing…" : "Sign engagement letter"}
            </button>
            <p className="text-[10px] text-[#626A65] text-center mt-2">
              Contact: admin@taxsimba.co.uk
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleCards({ schedules }) {
  if (!schedules?.length) {
    return (
      <div className="rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-xs text-[#626A65]">
        Schedules will appear here once your package is linked.
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="engagement-schedules-summary">
      <div className="text-xs font-semibold text-[#161B18]">Your services & package fees</div>
      <ul className="space-y-2">
        {schedules.map((s) => {
          const fee = feeLabel(s.price);
          return (
            <li
              key={s.id || `${s.sort_order}-${s.service_type}`}
              className="rounded-lg border border-[#E3E7E4] bg-[#F7F8F7] px-3 py-2.5"
            >
              <div className="text-xs font-semibold text-[#006B3C]">
                Schedule {s.sort_order || ""} ·{" "}
                {(s.service_type || "").includes("MTD")
                  ? "MTD"
                  : (s.service_type || "").includes("SELF")
                    ? "Tax return"
                    : "Service"}
              </div>
              <div className="text-sm text-[#161B18] mt-0.5 leading-snug">
                {s.service_label || s.line_text}
              </div>
              <div className="text-xs text-[#626A65] mt-1">
                {[
                  fee ? `Package fee: ${fee}` : null,
                  s.package_name ? `Package: ${s.package_name}` : null,
                  s.billing_frequency || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || s.line_text}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FullLetterToggle({ showFull, setShowFull, bodyHtml }) {
  return (
    <div className="rounded-lg border border-[#E3E7E4]" data-testid="engagement-full-letter">
      <button
        type="button"
        data-testid="engagement-toggle-full"
        onClick={() => setShowFull((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-[#161B18]"
      >
        <span>{showFull ? "Hide full letter" : "Read full engagement letter"}</span>
        <span className="text-[#626A65]">{showFull ? "▲" : "▼"}</span>
      </button>
      {showFull && (
        <div
          data-testid="engagement-letter-body"
          className="border-t border-[#E3E7E4] max-h-[36vh] overflow-y-auto px-3 py-3 text-xs bg-[#FCFDFC]"
          // Server escapes the legal text into HTML; body is not staff-editable.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}
    </div>
  );
}
