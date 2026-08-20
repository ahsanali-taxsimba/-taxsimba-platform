import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import CaseTable from "@/components/CaseTable";
import { Panel, StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";

const CARDS = [
  ["needs_my_action", "Needs My Action", "#D64545"],
  ["new_assigned", "New Assigned", "#006B3C"],
  ["in_progress", "In Progress", "#078A4B"],
  ["awaiting_client", "Waiting for Client", "#E6A23C"],
  ["changes_required", "Changes Required", "#D64545"],
  ["awaiting_admin_review", "Awaiting Admin Review", "#7656C9"],
  ["approved_ready", "Approved / Ready for Submission", "#16A05D"],
  ["case_completed", "Completed", "#626A65"],
  ["due_today", "Due Today", "#E6A23C"],
  ["due_week", "Due This Week", "#006B3C"],
];

const TABS = [
  ["needs_my_action", "Needs My Action"],
  ["new_assigned", "New Assigned"],
  ["in_progress", "In Progress"],
  ["awaiting_client", "Waiting for Client"],
  ["changes_required", "Changes Required"],
  ["awaiting_admin_review", "Awaiting Admin Review"],
  ["approved_ready", "Approved / Ready for Submission"],
  ["case_completed", "Completed"],
  ["due_today", "Due Today"],
  ["due_week", "Due This Week"],
];

export default function AccountantDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "needs_my_action";
  const [stats, setStats] = useState({});
  const [cases, setCases] = useState([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { api.get("/stats/accountant").then(({ data }) => setStats(data)); }, [tab]);
  useEffect(() => {
    api.get("/cases", { params: search ? { bucket: tab, q: search } : { bucket: tab } })
      .then(({ data }) => setCases(data));
  }, [tab, search]);

  return (
    <AppShell title="My Workload" subtitle="Cases assigned to you.">
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map(([key, label, tone]) => (
            <StatCard key={key} label={label} value={stats[key]} tone={tone} testId={`acc-card-${key}`}
              active={tab === key} onClick={() => setParams({ tab: key })} />
          ))}
        </div>
        <Panel title="My cases" testId="accountant-cases-panel">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              data-testid="case-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(q.trim())}
              placeholder="Search client name, case ID or email…"
              className="w-full sm:max-w-sm rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30"
            />
            <button data-testid="case-search-btn" onClick={() => setSearch(q.trim())}
              className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
              Search
            </button>
            {search && (
              <button data-testid="case-search-clear-btn" onClick={() => { setQ(""); setSearch(""); }}
                className="px-4 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors">
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap mb-6">
            {TABS.map(([k, l]) => (
              <button key={k} data-testid={`acc-tab-${k}`} onClick={() => setParams({ tab: k })}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>
                {l}
              </button>
            ))}
          </div>
          <CaseTable cases={cases} basePath="/work/cases" showAccountant={false} />
        </Panel>
      </div>
    </AppShell>
  );
}
