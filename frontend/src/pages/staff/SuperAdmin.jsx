import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { api, d, dt } from "@/lib/api";

const TABS = [["overview", "Business Overview"], ["users", "Users"], ["accountants", "Accountants"], ["admins", "Admins"], ["roles", "Roles"], ["services", "Services"], ["packages", "Packages & Pricing"], ["payments", "Payments"], ["workflow", "Workflow Settings"], ["audit", "Audit Log"]];

export default function SuperAdmin() {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [audit, setAudit] = useState([]);
  const [packages, setPackages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [lock, setLock] = useState(null);
  const [overview, setOverview] = useState(null);
  const [includeTest, setIncludeTest] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [payKind, setPayKind] = useState("");
  const [auditQ, setAuditQ] = useState({ case_ref: "", user_name: "", action: "", date_from: "", date_to: "" });
  const [form, setForm] = useState({ name: "", email: "", role: "ACCOUNTANT", specialisms: ["SELF_ASSESSMENT"], capacity: 15 });
  const [err, setErr] = useState("");
  const [invite, setInvite] = useState(null);

  const load = () => {
    api.get("/users").then(({ data }) => setUsers(data));
    api.get("/services").then(({ data }) => setServices(data));
    api.get("/workflow/settings").then(({ data }) => setWorkflow(data));
    api.get("/packages").then(({ data }) => setPackages(data));
    api.get("/settings/package-lock").then(({ data }) => setLock(data));
    api.get("/overview").then(({ data }) => setOverview(data));
  };
  // Payments and the audit log are filtered server-side; test history is opt-in.
  const loadPayments = () => api.get("/payments", {
    params: { include_test: includeTest, ...(payStatus ? { status: payStatus } : {}), ...(payKind ? { kind: payKind } : {}) },
  }).then(({ data }) => setPayments(data));

  const loadAudit = () => {
    const params = { include_test: includeTest };
    Object.entries(auditQ).forEach(([k, v]) => { if (v.trim()) params[k] = v.trim(); });
    return api.get("/audit-log", { params }).then(({ data }) => setAudit(data));
  };

  useEffect(() => { loadPayments(); loadAudit(); }, [includeTest, payStatus, payKind]); // eslint-disable-line

  useEffect(() => { load(); }, []);
  // The invite form follows the tab: accountant fields only apply to accountants.
  useEffect(() => {
    if (tab === "admins") setForm((f) => ({ ...f, role: "ADMIN" }));
    if (tab === "accountants") setForm((f) => ({ ...f, role: "ACCOUNTANT" }));
  }, [tab]);

  const create = async () => {
    setErr(""); setInvite(null);
    try {
      const { data } = await api.post("/staff-invites", form);
      setInvite(data);
      setForm({ name: "", email: "", role: "ACCOUNTANT", specialisms: ["SELF_ASSESSMENT"], capacity: 15 });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed");
    }
  };

  const resend = async (u) => {
    setErr(""); setInvite(null);
    try {
      const { data } = await api.post(`/staff-invites/${u.id}/resend`);
      setInvite({ ...data, user: u });
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed");
    }
  };

  const filtered = tab === "accountants" ? users.filter((u) => u.role === "ACCOUNTANT")
    : tab === "admins" ? users.filter((u) => ["ADMIN", "SUPER_ADMIN"].includes(u.role)) : users;

  const statusCell = (u) => (u.status === "PENDING" ? (
    <div className="flex flex-wrap items-center gap-3" data-testid={`status-${u.email}`}>
      <span className="text-xs font-semibold text-[#E6A23C]">
        Pending invitation{u.invite_expires_at ? ` · expires ${dt(u.invite_expires_at)}` : ""}
      </span>
      <button data-testid={`resend-invite-${u.email}`} onClick={() => resend(u)}
        className="text-xs font-semibold text-[#006B3C]">Resend invite</button>
    </div>
  ) : (
    <button data-testid={`toggle-user-${u.email}`}
      onClick={async () => {
        const { data } = await api.patch(`/users/${u.id}/active`, null, { params: { is_active: !u.is_active } });
        if (data.active_cases_needing_reassignment) {
          window.alert(`${u.name} still has ${data.active_cases_needing_reassignment} active case(s). Please reassign them so they are not left unowned.`);
        }
        load();
      }}
      className="text-xs font-semibold" style={{ color: u.is_active ? "#16A05D" : "#D64545" }}>
      {u.is_active ? "Active" : "Inactive"}
    </button>
  ));

  return (
    <AppShell title="Super Admin" subtitle="Platform users, services, workflow and audit.">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([k, l]) => (
            <button key={k} data-testid={`super-tab-${k}`} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>{l}</button>
          ))}
        </div>

        {["users", "accountants", "admins"].includes(tab) && (
          <>
            <Panel title="Invite staff member" testId="create-user-panel">
              <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input data-testid="new-user-name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                <input data-testid="new-user-email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                <select data-testid="new-user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                  {["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].map((r) => <option key={r}>{r}</option>)}
                </select>
                {form.role === "ACCOUNTANT" && (
                  <>
                    <select data-testid="new-user-specialism" value={form.specialisms.join(",")}
                      onChange={(e) => setForm({ ...form, specialisms: e.target.value.split(",") })}
                      className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                      <option value="SELF_ASSESSMENT">Self Assessment</option>
                      <option value="MTD_IT">MTD for Income Tax</option>
                      <option value="SELF_ASSESSMENT,MTD_IT">Both</option>
                    </select>
                    <div>
                      <input data-testid="new-user-capacity" type="number" placeholder="Case capacity" value={form.capacity}
                        onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                      <p className="text-[11px] text-[#626A65] mt-1">Case capacity — recommended maximum number of active cases for this accountant.</p>
                    </div>
                  </>
                )}
                <button data-testid="create-user-btn" onClick={create} className="rounded-lg bg-[#078A4B] text-white text-xs font-semibold px-4 py-2 h-10">Send invitation as {form.role}</button>
              </div>
              <p className="text-xs text-[#626A65] mt-3">
                The invitee sets their own password from a single-use link that expires in 72 hours.
                No password is created or visible here.
              </p>
              {invite && (
                <p data-testid="invite-link" className="text-xs text-[#006B3C] mt-3 break-all">
                  Setup link (valid until {dt(invite.expires_at)}): {invite.setup_link}
                </p>
              )}
              {err && <p className="text-xs text-[#D64545] mt-2">{err}</p>}
            </Panel>
            <Panel title="Users" testId="users-panel">
              {/* Mobile: stacked cards so role, status and actions are never cut off */}
              <ul className="md:hidden space-y-3" data-testid="user-cards">
                {filtered.map((u) => (
                  <li key={u.id} data-testid={`user-card-${u.email}`} className="border border-[#E3E7E4] rounded-lg p-4">
                    <div className="font-semibold text-sm">{u.name}</div>
                    <div className="text-xs text-[#626A65] break-all mt-1">{u.email}</div>
                    <div className="text-xs text-[#626A65] mt-1">{u.role} · created {d(u.created_at)}</div>
                    <div className="mt-3">{statusCell(u)}</div>
                  </li>
                ))}
              </ul>
              <table className="w-full text-sm hidden md:table">
                <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Created</th><th className="py-3">Status</th></tr></thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-[#E3E7E4]">
                      <td className="py-4 pr-4 font-semibold">{u.name}</td>
                      <td className="py-4 pr-4 text-[#626A65]">{u.email}</td>
                      <td className="py-4 pr-4">{u.role}</td>
                      <td className="py-4 pr-4 text-[#626A65]">{d(u.created_at)}</td>
                      <td className="py-4">{statusCell(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}

        {tab === "roles" && (
          <Panel title="Roles & permissions" testId="roles-panel">
            <ul className="text-sm space-y-3">
              <li><b>CLIENT</b> — sees only their own cases, tasks, documents, messages and admin-approved calculations.</li>
              <li><b>ACCOUNTANT</b> — sees only cases assigned to them; full case workspace including internal notes.</li>
              <li><b>ADMIN</b> — sees and manages all operational cases, assignment and internal review.</li>
              <li><b>SUPER_ADMIN</b> — full platform access, user management and configuration.</li>
            </ul>
          </Panel>
        )}

        {tab === "services" && (
          <Panel title="Services" testId="services-panel">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]"><th className="py-3">Code</th><th className="py-3">Name</th><th className="py-3">Price</th><th className="py-3">Active</th></tr></thead>
              <tbody>{services.map((s) => (
                <tr key={s.id} className="border-b border-[#E3E7E4]"><td className="py-4 font-mono text-xs">{s.code}</td><td className="py-4">{s.name}</td><td className="py-4">£{s.price}</td><td className="py-4">{s.is_active ? "Yes" : "No"}</td></tr>
              ))}</tbody>
            </table>
          </Panel>
        )}

        {tab === "overview" && overview && (
          <div className="space-y-6" data-testid="overview-panel">
            <Panel title="Clients">
              <dl className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 text-sm">
                {[["Total clients", overview.clients.total, "total-clients"],
                  ["New this month", overview.clients.new_this_month, "new-clients"],
                  ["Active Self Assessment", overview.clients.active_self_assessment, "active-sa"],
                  ["Active MTD", overview.clients.active_mtd, "active-mtd"],
                  ["Both services", overview.clients.both_services, "both-services"]].map(([l, v, t]) => (
                  <div key={l}><dt className="text-xs uppercase text-[#626A65]">{l}</dt>
                    <dd data-testid={`overview-${t}`} className="mt-1 text-2xl font-bold text-[#006B3C]">{v}</dd></div>
                ))}
              </dl>
            </Panel>
            <Panel title="Cases">
              <dl className="grid sm:grid-cols-3 gap-6 text-sm">
                <div><dt className="text-xs uppercase text-[#626A65]">Open</dt><dd className="mt-1 text-2xl font-bold">{overview.cases.open}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Completed</dt><dd className="mt-1 text-2xl font-bold">{overview.cases.completed}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Overdue</dt><dd className="mt-1 text-2xl font-bold text-[#D64545]">{overview.cases.overdue}</dd></div>
              </dl>
              <table className="w-full text-sm mt-6">
                <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3">Accountant</th><th className="py-3">Open cases</th><th className="py-3">Completed</th></tr></thead>
                <tbody>{overview.cases.per_accountant.map((a) => (
                  <tr key={a.name} className="border-b border-[#E3E7E4]">
                    <td className="py-3">{a.name}</td><td className="py-3">{a.open_cases}</td><td className="py-3">{a.completed_cases}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
            <Panel title="Financial overview">
              <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                {[["Revenue this month", overview.revenue.this_month, "revenue-month"],
                  ["Revenue this year", overview.revenue.this_year, "revenue-year"],
                  ["Self Assessment revenue", overview.revenue.self_assessment, "revenue-sa"],
                  ["MTD revenue", overview.revenue.mtd, "revenue-mtd"],
                  ["Package upgrades (subset of Self Assessment)", overview.revenue.package_upgrades, "revenue-upgrades"]].map(([l, v, t]) => (
                  <div key={l}><dt className="text-xs uppercase text-[#626A65]">{l}</dt>
                    <dd data-testid={`overview-${t}`} className="mt-1 text-2xl font-bold text-[#006B3C]">£{Number(v).toFixed(2)}</dd></div>
                ))}
                <div><dt className="text-xs uppercase text-[#626A65]">Successful payments</dt><dd className="mt-1 text-2xl font-bold">{overview.revenue.successful_payments}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Failed / expired</dt><dd className="mt-1 text-2xl font-bold">{overview.revenue.failed_payments}</dd></div>
              </dl>
              <p className="text-xs text-[#626A65] mt-4">{overview.revenue.note}</p>
            </Panel>
          </div>
        )}

        {tab === "packages" && (
          <Panel title="Packages & pricing" testId="packages-panel">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                <th className="py-3 pr-4">Service</th><th className="py-3 pr-4">Package</th><th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Billing</th><th className="py-3 pr-4">Price (£)</th><th className="py-3" /></tr></thead>
              <tbody>{packages.map((p) => (
                <tr key={p.id} data-testid={`package-row-${p.code}`} className="border-b border-[#E3E7E4]">
                  <td className="py-4 pr-4">{p.service_type === "MTD_INCOME_TAX" ? "MTD for Income Tax" : "Self Assessment"}</td>
                  <td className="py-4 pr-4 font-semibold">{p.name}</td>
                  <td className="py-4 pr-4">{p.rank}</td>
                  <td className="py-4 pr-4 text-[#626A65]">{p.billing_frequency}</td>
                  <td className="py-4 pr-4">
                    <input data-testid={`price-input-${p.code}`} type="number" defaultValue={p.price}
                      onBlur={async (e) => {
                        const v = Number(e.target.value);
                        if (v !== p.price) { await api.patch(`/packages/${p.id}/price`, { price: v }); load(); }
                      }}
                      className="w-28 rounded-lg border border-[#E3E7E4] px-2 py-1 text-sm" />
                  </td>
                  <td className="py-4 text-xs text-[#626A65]">Edit and click away to save</td>
                </tr>
              ))}</tbody>
            </table>
            {lock && (
              <p className="text-xs text-[#626A65] mt-5">
                Client package changes are locked from these case statuses: {lock.locked_statuses.join(", ")}
              </p>
            )}
          </Panel>
        )}

        {tab === "payments" && (
          <Panel title="Payments" testId="payments-admin-panel">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <select data-testid="payment-status-filter" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}
                className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                <option value="">All statuses</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="refunded">Refunded</option>
              </select>
              <select data-testid="payment-kind-filter" value={payKind} onChange={(e) => setPayKind(e.target.value)}
                className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                <option value="">All payment types</option>
                <option value="ADDITIONAL_WORK">Additional Work</option>
                <option value="SA_UPGRADE">Package upgrade</option>
                <option value="SERVICE_ACTIVATION">Service activation</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-[#626A65]">
                <input data-testid="include-test-payments" type="checkbox" checked={includeTest}
                  onChange={(e) => setIncludeTest(e.target.checked)} />
                Include test activity
              </label>
            </div>
            {!payments.length && <Empty text="No payments recorded yet." />}
            {payments.length > 0 && (
              <>
              <ul className="md:hidden space-y-3" data-testid="payment-cards">
                {payments.map((p) => (
                  <li key={p.id} className="border border-[#E3E7E4] rounded-lg p-4 text-sm">
                    <div className="font-semibold">{p.client_name} <span className="text-xs text-[#626A65]">{p.client_ref}</span></div>
                    <div className="text-xs text-[#626A65] mt-1">{dt(p.created_at)} · {p.kind === "SA_UPGRADE" ? "Package upgrade" : "Service activation"}</div>
                    <div className="text-xs text-[#626A65] mt-1">{p.previous_package ? `${p.previous_package} → ` : ""}{p.new_package}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold">£{Number(p.amount).toFixed(2)}</span>
                      <span style={{ color: p.payment_status === "paid" ? "#16A05D" : "#626A65" }}>{p.payment_status}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <table className="w-full text-sm hidden md:table">
                <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Client</th><th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Change</th><th className="py-3 pr-4">Amount</th><th className="py-3">Status</th></tr></thead>
                <tbody>{payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#E3E7E4]">
                    <td className="py-3 pr-4 text-[#626A65]">{dt(p.created_at)}</td>
                    <td className="py-3 pr-4">{p.client_name} <span className="text-xs text-[#626A65]">{p.client_ref}</span></td>
                    <td className="py-3 pr-4">{p.kind === "SA_UPGRADE" ? "Package upgrade" : p.kind === "ADDITIONAL_WORK" ? "Additional work" : "Service activation"}</td>
                    <td className="py-3 pr-4 text-[#626A65]">
                      {p.kind === "ADDITIONAL_WORK"
                        ? `${p.case_ref || ""} · ${p.description || ""} · by ${p.created_by_name || "—"}${p.due_date ? ` · due ${d(p.due_date)}` : ""}${p.paid_at ? ` · paid ${d(p.paid_at)}` : ""}${p.stripe_payment_intent_id ? ` · ${p.stripe_payment_intent_id}` : ""}`
                        : `${p.previous_package ? `${p.previous_package} → ` : ""}${p.new_package || ""}`}
                    </td>
                    <td className="py-3 pr-4 font-semibold">£{Number(p.amount).toFixed(2)}</td>
                    <td className="py-3" style={{ color: p.payment_status === "paid" ? "#16A05D" : "#626A65" }}>{p.payment_status}</td>
                  </tr>
                ))}</tbody>
              </table>
              </>
            )}
          </Panel>
        )}

        {tab === "workflow" && workflow && (
          <Panel title="Workflow settings" testId="workflow-panel">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]"><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Stage</th><th className="py-3 pr-4">Next Action</th><th className="py-3">Owner</th></tr></thead>
              <tbody>{workflow.statuses.map((s) => (
                <tr key={s} className="border-b border-[#E3E7E4]">
                  <td className="py-3 pr-4 font-mono text-xs">{s}</td>
                  <td className="py-3 pr-4">{workflow.meta[s].stage}</td>
                  <td className="py-3 pr-4 text-[#626A65]">{workflow.meta[s].next_action}</td>
                  <td className="py-3">{workflow.meta[s].owner}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
        )}

        {tab === "audit" && (
          <Panel title="Audit log" testId="audit-panel">
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
              <input data-testid="audit-case-ref" placeholder="Case reference" value={auditQ.case_ref}
                onChange={(e) => setAuditQ({ ...auditQ, case_ref: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
              <input data-testid="audit-user" placeholder="User or staff name" value={auditQ.user_name}
                onChange={(e) => setAuditQ({ ...auditQ, user_name: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
              <input data-testid="audit-action" placeholder="Action" value={auditQ.action}
                onChange={(e) => setAuditQ({ ...auditQ, action: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
              <input data-testid="audit-date-from" type="date" value={auditQ.date_from}
                onChange={(e) => setAuditQ({ ...auditQ, date_from: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
              <input data-testid="audit-date-to" type="date" value={auditQ.date_to}
                onChange={(e) => setAuditQ({ ...auditQ, date_to: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
              <button data-testid="audit-search-btn" onClick={loadAudit}
                className="rounded-lg bg-[#078A4B] text-white text-xs font-semibold px-4 py-2">Search</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#626A65] mb-5">
              <input data-testid="include-test-audit" type="checkbox" checked={includeTest}
                onChange={(e) => setIncludeTest(e.target.checked)} />
              Include test activity
            </label>
            {!audit.length && <Empty text="No activity yet." />}
            <ul className="space-y-3">
              {audit.map((a) => (
                <li key={a.id} data-testid={`audit-row-${a.id}`} className="border-b border-[#E3E7E4] pb-3 text-sm">
                  <div className="font-semibold break-words">{a.action}</div>
                  <div className="text-xs text-[#626A65] mt-0.5 break-words">{a.user_name} ({a.role}) · {a.case_ref || "—"} {a.client_name ? `· ${a.client_name}` : ""} · {dt(a.created_at)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
