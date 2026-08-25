import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import CaseTable from "@/components/CaseTable";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { api, d } from "@/lib/api";

const CARDS = [
  ["new", "New Cases", "#006B3C"],
  ["unassigned", "Unassigned Cases", "#E6A23C"],
  ["assigned", "Assigned Cases", "#078A4B"],
  ["waiting_client", "Waiting for Client", "#E6A23C"],
  ["in_progress", "In Progress", "#078A4B"],
  ["awaiting_admin_review", "Awaiting Admin Review", "#7656C9"],
  ["changes_required", "Changes Required", "#D64545"],
  ["awaiting_client_approval", "Awaiting Client Approval", "#16A05D"],
  ["ready_submission", "Ready for Submission", "#16A05D"],
  ["submitted", "Submitted", "#006B3C"],
  ["case_completed", "Completed", "#626A65"],
  ["attention", "Overdue / Attention Required", "#D64545"],
];

export function AdminDashboard() {
  const [stats, setStats] = useState({});
  const nav = useNavigate();
  useEffect(() => { api.get("/stats/admin").then(({ data }) => setStats(data)); }, []);
  return (
    <AppShell title="Operations Control Centre" subtitle="All client cases across the practice.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CARDS.map(([key, label, tone]) => (
          <StatCard key={key} label={label} value={stats[key]} tone={tone} testId={`admin-card-${key}`}
            onClick={() => nav(`/admin/cases?bucket=${key}`)} />
        ))}
      </div>
    </AppShell>
  );
}

export function AdminCases() {
  const [params, setParams] = useSearchParams();
  const bucket = params.get("bucket") || "";
  const [cases, setCases] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ accountant_id: "", priority: "", tax_year: "", service_type: "" });

  const load = () => {
    const p = { ...filters };
    Object.keys(p).forEach((k) => !p[k] && delete p[k]);
    if (bucket) p.bucket = bucket;
    if (q) p.q = q;
    api.get("/cases", { params: p }).then(({ data }) => setCases(data));
  };
  useEffect(() => { load(); }, [bucket, filters]);
  useEffect(() => { api.get("/users", { params: { role: "ACCOUNTANT" } }).then(({ data }) => setAccountants(data)); }, []);

  return (
    <AppShell title="All Cases" subtitle={bucket ? `Filtered view: ${bucket.replace(/_/g, " ")}` : "Every case in the practice."}>
      <Panel testId="admin-cases-panel">
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <input data-testid="case-search-input" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search client, email or case ID"
            className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
          <button data-testid="case-search-btn" onClick={load} className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold">Search</button>
          <select data-testid="filter-accountant" value={filters.accountant_id}
            onChange={(e) => setFilters({ ...filters, accountant_id: e.target.value })}
            className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
            <option value="">All accountants</option>
            <option value="UNASSIGNED">Unassigned</option>
            {accountants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select data-testid="filter-priority" value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
            <option value="">All priorities</option>
            <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
          <select data-testid="filter-service" value={filters.service_type}
            onChange={(e) => setFilters({ ...filters, service_type: e.target.value })}
            className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
            <option value="">All services</option>
            <option value="SELF_ASSESSMENT">Self Assessment</option>
            <option value="MTD_INCOME_TAX">MTD for Income Tax</option>
          </select>
          <select data-testid="filter-taxyear" value={filters.tax_year}
            onChange={(e) => setFilters({ ...filters, tax_year: e.target.value })}
            className="rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm">
            <option value="">All tax years</option><option value="2024/25">2024/25</option><option value="2025/26">2025/26</option><option value="2026/27">2026/27</option><option value="2023/24">2023/24</option>
          </select>
          {bucket && (
            <button data-testid="clear-bucket-btn" onClick={() => setParams({})}
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4]">Clear filter</button>
          )}
        </div>
        <CaseTable cases={cases} basePath="/admin/cases" />
      </Panel>
    </AppShell>
  );
}

export function AdminAccountants() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/accountants/workload").then(({ data }) => setRows(data)); }, []);
  return (
    <AppShell title="Accountants" subtitle="Live workload across the team.">
      <Panel testId="accountants-panel">
        {!rows.length && <Empty text="No accountants yet." />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
              <th className="py-3 pr-4">Accountant</th><th className="py-3 pr-4">Active Cases</th>
              <th className="py-3 pr-4">Waiting for Client</th><th className="py-3 pr-4">Due This Week</th>
              <th className="py-3 pr-4">Overdue</th><th className="py-3">Availability</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid={`workload-${r.id}`} className="border-b border-[#E3E7E4]">
                  <td className="py-4 pr-4 font-semibold">{r.name}<div className="text-xs text-[#626A65]">{r.email}</div></td>
                  <td className="py-4 pr-4">{r.active_cases}</td>
                  <td className="py-4 pr-4">{r.waiting_client}</td>
                  <td className="py-4 pr-4">{r.due_this_week}</td>
                  <td className="py-4 pr-4" style={{ color: r.overdue ? "#D64545" : undefined }}>{r.overdue}</td>
                  <td className="py-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold"
                      style={{ background: r.availability === "Available" ? "#E9F7EF" : "#FBEBEB", color: r.availability === "Available" ? "#16A05D" : "#D64545" }}>
                      {r.availability}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
