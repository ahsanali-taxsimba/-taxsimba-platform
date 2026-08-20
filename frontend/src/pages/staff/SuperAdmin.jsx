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
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ACCOUNTANT" });
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/users").then(({ data }) => setUsers(data));
    api.get("/services").then(({ data }) => setServices(data));
    api.get("/workflow/settings").then(({ data }) => setWorkflow(data));
    api.get("/audit-log").then(({ data }) => setAudit(data));
    api.get("/packages").then(({ data }) => setPackages(data));
    api.get("/payments").then(({ data }) => setPayments(data));
    api.get("/settings/package-lock").then(({ data }) => setLock(data));
    api.get("/overview").then(({ data }) => setOverview(data));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr("");
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", role: "ACCOUNTANT" });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed");
    }
  };

  const filtered = tab === "accountants" ? users.filter((u) => u.role === "ACCOUNTANT")
    : tab === "admins" ? users.filter((u) => ["ADMIN", "SUPER_ADMIN"].includes(u.role)) : users;

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
            <Panel title="Create user" testId="create-user-panel">
              <div className="grid sm:grid-cols-5 gap-3">
                <input data-testid="new-user-name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                <input data-testid="new-user-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                <input data-testid="new-user-password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm" />
                <select data-testid="new-user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
                  {["CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].map((r) => <option key={r}>{r}</option>)}
                </select>
                <button data-testid="create-user-btn" onClick={create} className="rounded-lg bg-[#078A4B] text-white text-xs font-semibold px-4 py-2">Create user</button>
              </div>
              {err && <p className="text-xs text-[#D64545] mt-2">{err}</p>}
            </Panel>
            <Panel title="Users" testId="users-panel">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Created</th><th className="py-3">Status</th></tr></thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-[#E3E7E4]">
                      <td className="py-4 pr-4 font-semibold">{u.name}</td>
                      <td className="py-4 pr-4 text-[#626A65]">{u.email}</td>
                      <td className="py-4 pr-4">{u.role}</td>
                      <td className="py-4 pr-4 text-[#626A65]">{d(u.created_at)}</td>
                      <td className="py-4">
                        <button data-testid={`toggle-user-${u.email}`}
                          onClick={async () => { await api.patch(`/users/${u.id}/active`, null, { params: { is_active: !u.is_active } }); load(); }}
                          className="text-xs font-semibold" style={{ color: u.is_active ? "#16A05D" : "#D64545" }}>
                          {u.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
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
                  ["Package upgrade revenue", overview.revenue.package_upgrades, "revenue-upgrades"]].map(([l, v, t]) => (
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
            {!payments.length && <Empty text="No payments recorded yet." />}
            {payments.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                  <th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Client</th><th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Change</th><th className="py-3 pr-4">Amount</th><th className="py-3">Status</th></tr></thead>
                <tbody>{payments.map((p) => (
                  <tr key={p.id} className="border-b border-[#E3E7E4]">
                    <td className="py-3 pr-4 text-[#626A65]">{dt(p.created_at)}</td>
                    <td className="py-3 pr-4">{p.client_name} <span className="text-xs text-[#626A65]">{p.client_ref}</span></td>
                    <td className="py-3 pr-4">{p.kind === "SA_UPGRADE" ? "Package upgrade" : "Service activation"}</td>
                    <td className="py-3 pr-4 text-[#626A65]">{p.previous_package ? `${p.previous_package} → ` : ""}{p.new_package}</td>
                    <td className="py-3 pr-4 font-semibold">£{Number(p.amount).toFixed(2)}</td>
                    <td className="py-3" style={{ color: p.payment_status === "paid" ? "#16A05D" : "#626A65" }}>{p.payment_status}</td>
                  </tr>
                ))}</tbody>
              </table>
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
            {!audit.length && <Empty text="No activity yet." />}
            <ul className="space-y-3">
              {audit.map((a) => (
                <li key={a.id} className="border-b border-[#E3E7E4] pb-3 text-sm">
                  <div className="font-semibold">{a.action}</div>
                  <div className="text-xs text-[#626A65] mt-0.5">{a.user_name} ({a.role}) · {a.case_ref || "—"} {a.client_name ? `· ${a.client_name}` : ""} · {dt(a.created_at)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
