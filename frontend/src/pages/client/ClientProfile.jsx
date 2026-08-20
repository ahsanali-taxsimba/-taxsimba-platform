import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Panel } from "@/components/StatCard";
import { api, apiError } from "@/lib/api";

function Field({ label, value, onChange, testId, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-[#626A65]">{label}</span>
      <input
        data-testid={testId}
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30"
      />
    </label>
  );
}

export default function ClientProfile() {
  const [p, setP] = useState(null);
  const [form, setForm] = useState({});
  const [utr, setUtr] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.get("/my-profile").then(({ data }) => { setP(data); setForm(data); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(""); setMsg("");
    try {
      await api.patch("/my-profile", { name: form.name, phone: form.phone, address: form.address });
      setMsg("Your details have been saved.");
      load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  const requestEmail = async () => {
    setErr(""); setMsg("");
    try {
      await api.post("/my-profile/email-change", { new_email: newEmail });
      setNewEmail("");
      setMsg("We've received your request. For your security we verify email changes before they take effect.");
      load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  if (!p) return <AppShell title="Profile" subtitle="Your details"><Panel testId="profile-panel">Loading…</Panel></AppShell>;

  return (
    <AppShell title="Profile" subtitle={p.client_ref ? `Client ${p.client_ref}` : "Your details"}>
      <div className="space-y-6">
        <Panel title="Personal details" testId="profile-panel">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="profile-name-input" />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testId="profile-phone-input" placeholder="07700 900000" />
            <div className="sm:col-span-2">
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testId="profile-address-input" />
            </div>
          </div>
          <button data-testid="profile-save-btn" onClick={save}
            className="mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
            Save changes
          </button>
          {msg && <p data-testid="profile-msg" className="text-sm text-[#16A05D] mt-3">{msg}</p>}
          {err && <p data-testid="profile-err" className="text-sm text-[#D64545] mt-3">{err}</p>}
        </Panel>

        <Panel title="Tax reference" testId="profile-utr-panel">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-wide text-[#626A65]">UTR</span>
              <div data-testid="profile-utr" className="mt-1 font-semibold tracking-wider">
                {utr || p.utr_masked || "Not on record yet"}
              </div>
            </div>
            {p.utr_on_record && !utr && (
              <button data-testid="profile-utr-show-btn"
                onClick={async () => setUtr((await api.get("/my-profile/utr")).data.utr)}
                className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">
                Show
              </button>
            )}
            {utr && (
              <button data-testid="profile-utr-hide-btn" onClick={() => setUtr(null)}
                className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">
                Hide
              </button>
            )}
          </div>
          <p className="text-sm text-[#626A65] mt-4">
            Your UTR is held securely and hidden by default. If it's wrong, message your accountant and we'll
            correct it with the right checks in place.
          </p>
        </Panel>

        <Panel title="Sign-in email" testId="profile-email-panel">
          <div className="text-sm">
            Current email: <b data-testid="profile-current-email">{p.email}</b>
          </div>
          {p.pending_email_change ? (
            <p data-testid="profile-email-pending" className="text-sm text-[#E6A23C] mt-3">
              A change to <b>{p.pending_email_change}</b> is awaiting verification. We'll confirm once it's approved.
            </p>
          ) : (
            <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Field label="New email address" value={newEmail} onChange={setNewEmail} testId="profile-new-email-input" type="email" />
              </div>
              <button data-testid="profile-email-request-btn" onClick={requestEmail} disabled={!newEmail.trim()}
                className="px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors disabled:opacity-50">
                Request change
              </button>
            </div>
          )}
          <p className="text-xs text-[#626A65] mt-3">For your security, email changes are verified before they take effect.</p>
        </Panel>

        <Panel title="Security" testId="profile-security-panel">
          <p className="text-sm text-[#626A65]">
            Manage your password and notification preferences in Settings.
          </p>
          <a href="/settings" data-testid="profile-to-settings-link"
            className="inline-flex mt-4 px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">
            Manage security
          </a>
        </Panel>
      </div>
    </AppShell>
  );
}
