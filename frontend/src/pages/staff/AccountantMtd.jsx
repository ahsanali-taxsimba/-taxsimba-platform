import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { api, d } from "@/lib/api";
import { warningBadge } from "@/pages/staff/AdminMtd";

const BUCKETS = [
  ["needs_my_action", "Needs My Action", "#078A4B"],
  ["waiting_for_client", "Waiting for Client", "#E6A23C"],
  ["awaiting_admin_review", "Awaiting Admin Review", "#7656C9"],
  ["awaiting_client_approval", "Awaiting Client Approval", "#16A05D"],
  ["ready_submission", "Ready for Submission", "#16A05D"],
  ["due_14", "Due Within 14 Days", "#E6A23C"],
  ["overdue", "Overdue", "#D64545"],
  ["submitted", "Submitted / Completed", "#626A65"],
];

export default function AccountantMtd() {
  const [data, setData] = useState({ counts: {}, buckets: {} });
  const [tab, setTab] = useState("needs_my_action");
  const nav = useNavigate();

  useEffect(() => { api.get("/mtd/my-workload").then(({ data }) => setData(data)); }, []);
  const rows = data.buckets[tab] || [];

  return (
    <AppShell title="My MTD Workload" subtitle="Quarterly compliance on your assigned MTD cases — separate from your Self Assessment cases.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {BUCKETS.map(([key, label, tone]) => (
          <StatCard key={key} label={label} value={data.counts[key]} tone={tone}
            testId={`acc-mtd-card-${key}`} active={tab === key} onClick={() => setTab(key)} />
        ))}
      </div>

      <div className="mt-8">
        <Panel title={BUCKETS.find(([k]) => k === tab)?.[1]} testId="acc-mtd-panel">
          {!rows.length && <Empty text="Nothing in this bucket." />}
          <ul className="space-y-3">
            {rows.map((p) => (
              <li key={p.id} data-testid={`acc-mtd-row-${p.id}`}
                onClick={() => nav(`/work/cases/${p.case_id}`)}
                className="border border-[#E3E7E4] rounded-lg p-4 hover:bg-[#F9FCFA] cursor-pointer transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">{p.client_name} · {p.label}</div>
                    <div className="text-xs text-[#626A65] mt-1">
                      {p.case_ref} · {p.tax_year} · {d(p.period_start)} – {d(p.period_end)} · due {d(p.deadline)}
                    </div>
                    <div className="text-xs text-[#626A65] mt-1">Next: {p.next_action}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {warningBadge(p)}
                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#F1F8F4] text-[#006B3C]">
                      {p.stage_label}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
