import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import CaseTable from "@/components/CaseTable";
import { Panel, StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";

const CARDS = [
  ["needs_my_action", "Needs My Action", "#D64545"],
  ["due_today", "Due Today", "#E6A23C"],
  ["due_week", "Due This Week", "#006B3C"],
  ["awaiting_client", "Awaiting Client", "#E6A23C"],
  ["ready_for_admin", "Ready for Admin Review", "#7656C9"],
  ["admin_changes", "Admin Changes", "#D64545"],
  ["completed", "Completed", "#16A05D"],
];

const TABS = [
  ["needs_my_action", "Needs My Action"],
  ["in_progress", "In Progress"],
  ["awaiting_client", "Awaiting Client"],
  ["ready_for_admin", "Ready for Admin Review"],
  ["admin_changes", "Admin Changes"],
  ["completed", "Completed"],
];

export default function AccountantDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "needs_my_action";
  const [stats, setStats] = useState({});
  const [cases, setCases] = useState([]);

  useEffect(() => { api.get("/stats/accountant").then(({ data }) => setStats(data)); }, [tab]);
  useEffect(() => { api.get("/cases", { params: { bucket: tab } }).then(({ data }) => setCases(data)); }, [tab]);

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
