import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";

export default function AcceptInvite() {
  const { token } = useParams();
  const nav = useNavigate();
  const [invite, setInvite] = useState(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/auth/invite/${token}`)
      .then(({ data }) => setInvite(data))
      .catch((e) => setErr(apiError(e.response?.data?.detail)));
  }, [token]);

  const submit = async () => {
    setErr("");
    if (pw.length < 8) return setErr("Please choose a password of at least 8 characters.");
    if (pw !== pw2) return setErr("Both passwords must match.");
    try {
      await api.post(`/auth/invite/${token}/accept`, { password: pw });
      setDone(true);
      setTimeout(() => nav("/login"), 2500);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F8] px-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E3E7E4] p-8">
        <div className="text-lg font-bold text-[#006B3C]">TaxSimba</div>
        <h1 className="text-2xl font-bold mt-4">Set up your account</h1>
        {done ? (
          <p data-testid="invite-done" className="text-sm text-[#16A05D] font-semibold mt-4">
            Your password is set. Taking you to sign in…
          </p>
        ) : invite ? (
          <>
            <p className="text-sm text-[#626A65] mt-2">
              {invite.name} · {invite.email} · {invite.role}
            </p>
            <label className="block text-sm font-medium mt-6">Create a password</label>
            <input data-testid="invite-password" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm" />
            <label className="block text-sm font-medium mt-4">Confirm password</label>
            <input data-testid="invite-password-confirm" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm" />
            <button data-testid="invite-submit-btn" onClick={submit}
              className="mt-6 w-full px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
              Activate my account
            </button>
          </>
        ) : (
          !err && <p className="text-sm text-[#626A65] mt-4">Checking your invitation…</p>
        )}
        {err && <p data-testid="invite-error" className="text-sm text-[#D64545] mt-4">{err}</p>}
      </div>
    </div>
  );
}
