import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function Login() {
  const { login, verifyTwoFactor } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      if (user?.two_factor_required) {
        setChallenge(user.challenge);
        return;
      }
      nav(user.role === "CLIENT" ? "/dashboard" : user.role === "ACCOUNTANT" ? "/work" : "/admin");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const user = await verifyTwoFactor(challenge, code);
      nav(user.role === "CLIENT" ? "/dashboard" : user.role === "ACCOUNTANT" ? "/work" : "/admin");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold text-[#006B3C] font-heading tracking-tight">TaxSimba</div>
          <p className="text-sm text-[#626A65] mt-2">Accountant-led Self Assessment platform</p>
        </div>
        {challenge ? (
          <form onSubmit={submitCode} className="bg-white border border-[#E3E7E4] rounded-xl p-8 space-y-5">
            <h2 className="text-xl font-semibold text-[#161B18]">Two-step verification</h2>
            <p className="text-sm text-[#626A65]">
              Enter the 6-digit code from your authenticator app, or one of your recovery codes.
            </p>
            <input data-testid="login-2fa-code" autoFocus value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
            {error && <p data-testid="login-2fa-error" className="text-sm text-[#D64545]">{error}</p>}
            <button data-testid="login-2fa-submit" disabled={busy || !code}
              className="w-full rounded-lg bg-[#078A4B] text-white py-2.5 text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-60">
              {busy ? "Verifying…" : "Verify and sign in"}
            </button>
          </form>
        ) : (
        <form onSubmit={submit} className="bg-white border border-[#E3E7E4] rounded-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-[#161B18]">Sign in</h2>
          <div>
            <label className="text-sm font-medium text-[#161B18]">Email</label>
            <input
              data-testid="login-email-input"
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#161B18]">Password</label>
            <input
              data-testid="login-password-input"
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30"
            />
          </div>
          {error && <p data-testid="login-error" className="text-sm text-[#D64545]">{error}</p>}
          <button
            data-testid="login-submit-btn" disabled={busy}
            className="w-full rounded-lg bg-[#078A4B] text-white py-2.5 text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        )}
        <div className="mt-6 bg-white border border-[#E3E7E4] rounded-xl p-5 text-xs text-[#626A65] space-y-1">
          <div className="font-semibold text-[#161B18] mb-1">Demo accounts</div>
          <div>Client: clienta@example.com / Client@123</div>
          <div>Accountant: accountant.a@taxsimba.co.uk / Account@123</div>
          <div>Admin: admin@taxsimba.co.uk / Admin@123</div>
          <div>Super Admin: superadmin@taxsimba.co.uk / Super@123</div>
        </div>
      </div>
    </div>
  );
}
