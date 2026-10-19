/**
 * Embedded signing page — branded public route at /sign/:token
 *
 * - Unique expiring link per signer (no login required).
 * - Click-to-sign / type signature.
 * - Explicit HMRC consent checkbox.
 * - Records VIEWED on load and SIGNED on submit via /api/esign/sign/:token
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiError, d } from "@/lib/api";

export default function SignDocument() {
  const { token } = useParams();
  const [pack, setPack] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("CLICK"); // CLICK | TYPED
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/esign/sign/${token}`)
      .then(({ data }) => {
        setPack(data);
        setTypedName(data.signer?.name || "");
        if (data.already_signed) setDone({ status: "SIGNED", all_signed: true });
      })
      .catch((e) => setErr(apiError(e.response?.data?.detail) || "This signing link is not valid."));
  }, [token]);

  const brand = pack?.branding || { firm_name: "TaxSimba", primary_colour: "#006B3C" };
  const primary = brand.primary_colour || "#006B3C";

  const submit = async () => {
    setErr("");
    if (!consent) return setErr("Please confirm the consent statement before signing.");
    setBusy(true);
    try {
      const { data } = await api.post(`/esign/sign/${token}`, {
        signature_type: mode,
        signature_data: mode === "TYPED" ? typedName.trim() : null,
        typed_name: mode === "TYPED" ? typedName.trim() : pack?.signer?.name,
        consent_accepted: true,
      });
      setDone(data);
      // TODO(payments): if data.payment_redirect_url, navigate after a short delay
      if (data.payment_redirect_url) {
        // window.location.href = data.payment_redirect_url;
      }
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Could not record your signature.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8]" data-testid="esign-sign-page">
      <header className="border-b border-[#E3E7E4] bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt="" className="h-9 w-auto" />
          ) : (
            <span
              className="h-9 w-9 rounded-xl text-white flex items-center justify-center font-extrabold text-sm"
              style={{ backgroundColor: primary }}
            >
              {(brand.firm_name || "TS").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <div className="text-lg font-extrabold tracking-tight" style={{ color: primary }}>
              {brand.firm_name || "TaxSimba"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[#626A65]">Secure e-signature</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {err && !pack && (
          <div className="bg-white border border-[#E3E7E4] rounded-xl p-8">
            <h1 className="text-xl font-bold">Unable to open document</h1>
            <p data-testid="esign-sign-error" className="text-sm text-[#D64545] mt-3">{err}</p>
          </div>
        )}

        {pack && (
          <>
            <div className="bg-white border border-[#E3E7E4] rounded-xl p-6 sm:p-8">
              <p className="text-xs uppercase tracking-wide text-[#626A65] font-semibold">
                {pack.document.type?.replace(/_/g, " ")}
              </p>
              <h1 className="text-2xl font-bold mt-1" data-testid="esign-doc-title">
                {pack.document.title}
              </h1>
              {pack.instructions && (
                <p
                  data-testid="esign-instructions"
                  className="mt-3 text-sm font-semibold text-[#006B3C] bg-[#EAF5EE] rounded-lg px-3 py-2"
                >
                  {pack.instructions}
                </p>
              )}
              <p className="text-sm text-[#626A65] mt-2">
                {pack.document.client_name}
                {pack.document.tax_period_label ? ` · ${pack.document.tax_period_label}` : ""}
                {" · "}Expires {d(pack.expires_at)}
              </p>
              <p className="text-[11px] text-[#626A65] mt-2 font-mono break-all">
                Document hash: {pack.document.calculation_hash}
              </p>

              {pack.document.body_rendered?.trim().startsWith("<") ? (
                <div
                  data-testid="esign-doc-body"
                  className="mt-6 border-t border-[#E3E7E4] pt-6"
                  dangerouslySetInnerHTML={{ __html: pack.document.body_rendered }}
                />
              ) : (
                <div
                  data-testid="esign-doc-body"
                  className="mt-6 prose prose-sm max-w-none text-[#161B18] whitespace-pre-wrap font-serif leading-relaxed border-t border-[#E3E7E4] pt-6"
                >
                  {pack.document.body_rendered}
                </div>
              )}
            </div>

            {done ? (
              <div className="mt-6 bg-[#E9F7EF] border border-[#C6EBD5] rounded-xl p-6" data-testid="esign-sign-done">
                <h2 className="text-lg font-bold text-[#16A05D]">
                  {done.all_signed ? "Document signed" : "Your signature has been recorded"}
                </h2>
                <p className="text-sm text-[#161B18] mt-2">
                  {done.all_signed
                    ? "All required parties have signed. Figures are locked and the return can proceed to HMRC submission."
                    : "Waiting for the remaining signers to complete."}
                </p>
              </div>
            ) : (
              <div className="mt-6 bg-white border border-[#E3E7E4] rounded-xl p-6 sm:p-8 space-y-5">
                <h2 className="text-lg font-bold">Sign this document</h2>
                <p className="text-sm text-[#626A65]">
                  Signing as <strong>{pack.signer.name}</strong> ({pack.signer.email}) · {pack.signer.role}
                </p>

                {/* TODO(otp): when pack.otp_required, show OTP challenge UI before enabling sign */}
                {pack.otp_required && (
                  <p className="text-xs text-[#B77A12] bg-[#FDF3E3] rounded-lg px-3 py-2">
                    Stronger authentication (OTP) is configured for this signer — OTP challenge UI is a scaffold stub.
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    data-testid="esign-mode-click"
                    onClick={() => setMode("CLICK")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "CLICK" ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]" : "border-[#E3E7E4]"}`}
                  >
                    Click to sign
                  </button>
                  <button
                    type="button"
                    data-testid="esign-mode-typed"
                    onClick={() => setMode("TYPED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "TYPED" ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]" : "border-[#E3E7E4]"}`}
                  >
                    Type signature
                  </button>
                </div>

                {mode === "TYPED" && (
                  <label className="block text-sm font-medium">
                    Type your full name
                    <input
                      data-testid="esign-typed-name"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm italic"
                    />
                  </label>
                )}

                {mode === "CLICK" && (
                  <div
                    data-testid="esign-click-preview"
                    className="rounded-lg border-2 border-dashed border-[#C6EBD5] bg-[#F1F8F4] px-4 py-6 text-center italic text-xl"
                    style={{ color: primary, fontFamily: "Georgia, serif" }}
                  >
                    {pack.signer.name}
                  </div>
                )}

                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    data-testid="esign-consent"
                    type="checkbox"
                    className="mt-1"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    <strong>{pack.consent_text}</strong>
                    <span className="block text-xs text-[#626A65] mt-1">
                      Your IP address, browser details, and the time of signing are recorded in the audit trail.
                    </span>
                  </span>
                </label>

                {err && <p data-testid="esign-sign-error" className="text-sm text-[#D64545]">{err}</p>}

                <button
                  type="button"
                  data-testid="esign-sign-submit"
                  disabled={busy || !consent}
                  onClick={submit}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                >
                  {busy ? "Signing…" : "Sign document"}
                </button>
              </div>
            )}
          </>
        )}

        {!pack && !err && (
          <p className="text-sm text-[#626A65] text-center mt-16">Loading document…</p>
        )}
      </main>
    </div>
  );
}
