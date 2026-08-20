import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Panel } from "@/components/StatCard";
import { api, apiError, d } from "@/lib/api";

const PREFS = [
  ["accountant_message", "Accountant message", "When your accountant sends you a message."],
  ["document_requested", "Document requested", "When we need a document or information from you."],
  ["calculation_ready", "Calculation ready", "When your tax calculation is ready to review."],
  ["approval_required", "Approval required", "When your return is waiting for your approval."],
  ["submission_update", "Submission update", "Progress on submitting your return to HMRC."],
  ["payment_update", "Payment & subscription", "Payment receipts and changes to your services."],
];

function Toggle({ on, onClick, testId }) {
  return (
    <button data-testid={testId} onClick={onClick} role="switch" aria-checked={on}
      className="relative h-6 w-11 rounded-full transition-colors shrink-0"
      style={{ background: on ? "#078A4B" : "#D5DAD7" }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: on ? "22px" : "2px" }} />
    </button>
  );
}

export default function ClientSettings() {
  const [profile, setProfile] = useState(null);
  const [prefs, setPrefs] = useState({});
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/my-profile").then(({ data }) => { setProfile(data); setPrefs(data.preferences || {}); });
    api.get("/my-data-requests").then(({ data }) => setRequests(data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const savePrefs = async (next) => {
    setPrefs(next);
    await api.patch("/my-preferences", { preferences: next });
  };

  const changePassword = async () => {
    setErr(""); setMsg("");
    try {
      await api.post("/my-profile/change-password", pw);
      setPw({ current_password: "", new_password: "" });
      setMsg("Your password has been changed.");
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  const raise = async (kind) => {
    setErr(""); setMsg("");
    const confirmText = kind === "DATA_EXPORT"
      ? "Request a copy of your personal data? Our team will prepare it and contact you."
      : "Request account closure? Nothing is closed or deleted straight away — our team will contact you first, and tax records we must keep by law are retained.";
    if (!window.confirm(confirmText)) return;
    try {
      await api.post("/my-data-requests", { kind });
      setMsg(kind === "DATA_EXPORT"
        ? "We've received your data request and will be in touch."
        : "We've received your account closure request. A member of our team will contact you before anything changes.");
      load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  return (
    <AppShell title="Settings" subtitle="Your login, notifications and privacy">
      <div className="space-y-6">
        <Panel title="Login & Security" testId="settings-security-panel">
          <div className="text-sm">
            Login email: <b data-testid="settings-email">{profile?.email || "—"}</b>
            {profile?.pending_email_change && (
              <span className="text-[#E6A23C]"> · email change awaiting approval by our team</span>
            )}
          </div>
          <Link to="/profile" data-testid="settings-change-email-link"
            className="inline-flex mt-3 text-xs font-semibold text-[#078A4B]">Change login email</Link>

          <div className="mt-6 border-t border-[#E3E7E4] pt-6">
            <div className="text-sm font-semibold mb-4">Change password</div>
            <div className="grid sm:grid-cols-2 gap-5 max-w-xl">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[#626A65]">Current password</span>
                <input data-testid="settings-current-password" type="password" value={pw.current_password}
                  onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[#626A65]">New password</span>
                <input data-testid="settings-new-password" type="password" value={pw.new_password}
                  onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
              </label>
            </div>
            <button data-testid="settings-change-password-btn" onClick={changePassword}
              disabled={!pw.current_password || !pw.new_password}
              className="mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-50">
              Change password
            </button>
          </div>
          {msg && <p data-testid="settings-msg" className="text-sm text-[#16A05D] mt-4">{msg}</p>}
          {err && <p data-testid="settings-err" className="text-sm text-[#D64545] mt-4">{err}</p>}
        </Panel>

        <Panel title="Notifications" testId="settings-notifications-panel">
          <ul className="divide-y divide-[#E3E7E4]">
            {PREFS.map(([key, label, hint]) => (
              <li key={key} className="flex items-start justify-between gap-6 py-4">
                <div>
                  <div className="text-sm font-semibold text-[#161B18]">{label}</div>
                  <p className="text-sm text-[#626A65] mt-0.5">{hint}</p>
                </div>
                <Toggle testId={`pref-${key}`} on={prefs[key] !== false}
                  onClick={() => savePrefs({ ...prefs, [key]: prefs[key] === false })} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#626A65] mt-4">
            Essential messages about your tax return, security and legal obligations are always sent.
          </p>
        </Panel>

        <Panel title="Personal details" testId="settings-personal-panel">
          <p className="text-sm text-[#626A65]">Your name, phone number and address are managed in your profile.</p>
          <Link to="/profile" data-testid="settings-manage-details-link"
            className="inline-flex mt-4 px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">
            Manage personal details
          </Link>
        </Panel>

        <Panel title="Privacy & Data" testId="settings-privacy-panel">
          <div className="flex flex-wrap gap-3">
            <a href="/privacy" data-testid="settings-privacy-link"
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">Privacy Policy</a>
            <a href="/terms" data-testid="settings-terms-link"
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">Terms & Conditions</a>
            <button data-testid="settings-cookies-btn"
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">Cookie preferences</button>
            <button data-testid="settings-request-data-btn" onClick={() => raise("DATA_EXPORT")}
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">Request my data</button>
            <button data-testid="settings-close-account-btn" onClick={() => raise("ACCOUNT_CLOSURE")}
              className="px-4 py-2 rounded-lg border border-[#F2C9C9] text-xs font-semibold text-[#D64545] hover:bg-[#FBEBEB] transition-colors">Request account closure</button>
          </div>
          <p className="text-xs text-[#626A65] mt-4">
            Closing your account is handled by our team. Tax records we're required to keep are retained for the
            legal retention period.
          </p>
          {requests.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm" data-testid="settings-requests-list">
              {requests.map((r) => (
                <li key={r.id} className="text-[#626A65]">
                  {r.kind === "DATA_EXPORT" ? "Data request" : "Account closure request"} · {r.status === "PENDING" ? "In progress" : "Completed"} · {d(r.created_at)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
