/**
 * "Send for approval" modal — used from SA Case Workspace and MTD period rows.
 *
 * Flow:
 *  1. POST /esign/documents  (template + merge fields + calc hash)
 *  2. POST /esign/requests   (signers + channels + send_now)
 *
 * Supports multi-signer for CT (directors) via the signers list.
 */
import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

const DOC_TYPES = [
  { value: "SA_SUMMARY_APPROVAL", label: "Self Assessment summary" },
  { value: "MTD_QUARTERLY_APPROVAL", label: "MTD quarterly update" },
  { value: "VAT_RETURN_APPROVAL", label: "VAT return" },
  { value: "CT_SUMMARY_APPROVAL", label: "Corporation Tax summary" },
  // Engagement letters are generated automatically from /engagement (not this staff modal).
  { value: "AML_PACK", label: "AML / onboarding pack (stub)" },
];

const emptySigner = () => ({ name: "", email: "", role: "CLIENT" });

export default function SendForApprovalModal({
  open,
  onClose,
  onSent,
  /** Pre-filled context from the case / MTD period screen */
  context = {},
}) {
  const [docType, setDocType] = useState(context.documentType || "SA_SUMMARY_APPROVAL");
  const [signers, setSigners] = useState([emptySigner()]);
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState(14);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelSms, setChannelSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setDocType(context.documentType || "SA_SUMMARY_APPROVAL");
    setSigners([
      {
        name: context.clientName || "",
        email: context.clientEmail || "",
        role: context.documentType === "CT_SUMMARY_APPROVAL" ? "DIRECTOR" : "CLIENT",
      },
    ]);
    setMessage("");
    setErr("");
  }, [open, context.documentType, context.clientName, context.clientEmail]);

  if (!open) return null;

  const updateSigner = (i, patch) => {
    setSigners((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const merge = {
        ...(context.mergeFields || {}),
        client_name: context.clientName || context.mergeFields?.client_name,
        tax_year: context.taxYear || context.mergeFields?.tax_year,
        period_label: context.periodLabel || context.mergeFields?.period_label,
        case_ref: context.caseRef || context.mergeFields?.case_ref,
        calculation_version: context.calculationVersion || context.mergeFields?.calculation_version,
        figures: context.figures || context.mergeFields?.figures || {},
      };

      const { data: document } = await api.post("/esign/documents", {
        type: docType,
        case_id: context.caseId || null,
        mtd_period_id: context.mtdPeriodId || null,
        client_user_id: context.clientUserId || null,
        client_name: context.clientName || null,
        tax_period_label: context.periodLabel || context.taxYear || null,
        calculation_version_id: context.calculationVersionId || null,
        merge_fields: merge,
        // TODO(white-label): pass firm_id when multi-firm branding is live
        firm_id: context.firmId || null,
      });

      const channels = [];
      if (channelEmail) channels.push("EMAIL");
      if (channelSms) channels.push("SMS"); // stub — backend records intent only
      if (!channels.length) channels.push("EMAIL");

      const expires = new Date();
      expires.setDate(expires.getDate() + Number(expiryDays || 14));

      const { data: request } = await api.post("/esign/requests", {
        document_id: document.id,
        signers: signers.map((s, i) => ({
          name: s.name.trim(),
          email: s.email.trim(),
          role: s.role || "CLIENT",
          // TODO(otp): allow staff to select OTP_EMAIL / OTP_SMS for stronger auth
          auth_method: "EMAIL_LINK",
          sort_order: i,
        })),
        channels,
        message: message || null,
        expires_at: expires.toISOString(),
        // TODO(payments): optional payment_redirect_url after signing
        payment_redirect_url: context.paymentRedirectUrl || null,
        send_now: true,
      });

      onSent?.(request);
      onClose?.();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Could not send for approval");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="esign-send-modal">
      <div className="w-full max-w-lg bg-white rounded-xl border border-[#E3E7E4] shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#E3E7E4] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#161B18]">Send for approval</h2>
            <p className="text-xs text-[#626A65] mt-0.5">
              Generate an approval document and invite signers with a unique expiring link.
            </p>
          </div>
          <button type="button" className="text-[#626A65] text-sm" onClick={onClose} data-testid="esign-send-close">
            Close
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block text-sm font-medium">
            Document type
            <select
              data-testid="esign-doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Signers</span>
              <button
                type="button"
                data-testid="esign-add-signer"
                className="text-xs font-semibold text-[#006B3C]"
                onClick={() => setSigners((s) => [...s, { ...emptySigner(), role: docType === "CT_SUMMARY_APPROVAL" ? "DIRECTOR" : "CLIENT" }])}
              >
                + Add signer
              </button>
            </div>
            <p className="text-xs text-[#626A65] mb-2">
              CT / multi-director packs can invite several directors. Each gets their own link.
            </p>
            {signers.map((s, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-2">
                <input
                  data-testid={`esign-signer-name-${i}`}
                  placeholder="Name"
                  value={s.name}
                  onChange={(e) => updateSigner(i, { name: e.target.value })}
                  className="sm:col-span-2 rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                />
                <input
                  data-testid={`esign-signer-email-${i}`}
                  placeholder="Email"
                  value={s.email}
                  onChange={(e) => updateSigner(i, { email: e.target.value })}
                  className="sm:col-span-2 rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                />
                <select
                  data-testid={`esign-signer-role-${i}`}
                  value={s.role}
                  onChange={(e) => updateSigner(i, { role: e.target.value })}
                  className="sm:col-span-1 rounded-lg border border-[#E3E7E4] px-2 py-2 text-sm"
                >
                  <option value="CLIENT">Client</option>
                  <option value="DIRECTOR">Director</option>
                  <option value="PARTNER">Partner</option>
                  <option value="AGENT">Agent</option>
                  <option value="WITNESS">Witness</option>
                </select>
                {signers.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-[#D64545] font-semibold"
                    onClick={() => setSigners((rows) => rows.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <label className="block text-sm font-medium">
            Message to signers (optional)
            <textarea
              data-testid="esign-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
              placeholder="Please review the figures and sign to authorise HMRC submission."
            />
          </label>

          <div className="flex flex-wrap gap-4 items-center">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={channelEmail} onChange={(e) => setChannelEmail(e.target.checked)} data-testid="esign-channel-email" />
              Email
            </label>
            <label className="text-sm flex items-center gap-2 text-[#626A65]" title="SMS delivery is a design stub">
              <input type="checkbox" checked={channelSms} onChange={(e) => setChannelSms(e.target.checked)} data-testid="esign-channel-sms" />
              SMS (stub)
            </label>
            <label className="text-sm font-medium flex items-center gap-2 ml-auto">
              Expires in
              <input
                data-testid="esign-expiry-days"
                type="number"
                min={1}
                max={90}
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-16 rounded-lg border border-[#E3E7E4] px-2 py-1 text-sm"
              />
              days
            </label>
          </div>

          {err && <p data-testid="esign-send-error" className="text-sm text-[#D64545]">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[#E3E7E4] flex justify-end gap-3">
          <button type="button" className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-sm font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="esign-send-submit"
            disabled={busy}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send for approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
