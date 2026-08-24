import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, apiError } from "@/lib/api";

export default function TwoFactorPanel() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState([]);
  const [err, setErr] = useState("");

  const load = () => api.get("/auth/2fa/status").then(({ data }) => setStatus(data));
  useEffect(() => { load(); }, []);

  const begin = async () => {
    setErr("");
    try {
      const { data } = await api.post("/auth/2fa/enrol");
      setSetup(data);
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  const activate = async () => {
    setErr("");
    try {
      const { data } = await api.post("/auth/2fa/activate", { code });
      setCodes(data.recovery_codes);
      setSetup(null); setCode(""); load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  if (!status) return null;

  return (
    <div data-testid="twofactor-panel" className="border border-[#E3E7E4] rounded-lg p-5">
      <div className="text-sm font-semibold">Two-factor authentication</div>
      <p className="text-xs text-[#626A65] mt-1">
        {status.enabled
          ? `On. You'll be asked for a code from your authenticator app each time you sign in. ${status.recovery_codes_remaining} recovery code(s) remaining.`
          : status.required
            ? "Required for your role. Set this up now to protect client tax data."
            : "Add a second step to your sign-in using an authenticator app."}
      </p>

      {!status.enabled && !setup && !codes.length && (
        <button data-testid="twofactor-start-btn" onClick={begin}
          className="mt-4 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
          Set up authenticator app
        </button>
      )}

      {setup && (
        <div className="mt-5 space-y-3">
          <div className="bg-white p-3 inline-block rounded-lg border border-[#E3E7E4]">
            <QRCodeSVG value={setup.otpauth_uri} size={168} />
          </div>
          <p className="text-xs text-[#626A65] break-all">
            Can't scan? Enter this key manually: <b>{setup.manual_secret}</b>
          </p>
          <input data-testid="twofactor-code" inputMode="numeric" maxLength={6} placeholder="6-digit code"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-40 rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm" />
          <div>
            <button data-testid="twofactor-activate-btn" onClick={activate} disabled={code.length !== 6}
              className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50">
              Turn on two-factor
            </button>
          </div>
        </div>
      )}

      {!!codes.length && (
        <div data-testid="twofactor-recovery-codes" className="mt-5">
          <p className="text-sm font-semibold text-[#16A05D]">Two-factor is on. Save these recovery codes now — they are shown only once.</p>
          <pre className="mt-3 bg-[#F1F8F4] rounded-lg p-4 text-xs leading-6 overflow-x-auto">{codes.join("\n")}</pre>
        </div>
      )}

      {err && <p data-testid="twofactor-error" className="text-sm text-[#D64545] mt-3">{err}</p>}
    </div>
  );
}
