import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { api, d } from "@/lib/api";

const CARDS = [
  ["active_mtd_clients", "Active MTD Clients", "#006B3C", null],
  ["not_started", "Quarters Not Started", "#626A65", "not_started"],
  ["preparing", "Accountant Preparing", "#078A4B", "preparing"],
  ["admin_review", "Awaiting Admin Review", "#7656C9", "admin_review"],
  ["client_action", "Waiting for Client", "#E6A23C", "client_action"],
  ["ready_submission", "Ready for Submission", "#16A05D", "ready_submission"],
  ["submitted", "Submitted", "#006B3C", "submitted"],
  ["due_14", "Due Within 14 Days", "#E6A23C", "due_14"],
  ["overdue", "Overdue", "#D64545", "overdue"],
];

const WARN_TONE = {
  OVERDUE: "bg-[#FBEBEB] text-[#D64545]",
  DUE_3: "bg-[#FBEBEB] text-[#D64545]",
  DUE_7: "bg-[#FFF4E5] text-[#8A5A00]",
  DUE_14: "bg-[#FFF4E5] text-[#8A5A00]",
};
const WARN_LABEL = {
  OVERDUE: "Overdue", DUE_3: "Due in 3 days", DUE_7: "Due in 7 days", DUE_14: "Due in 14 days",
};

export function warningBadge(p) {
  if (!p.deadline_warning) return null;
  return (
    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold ${WARN_TONE[p.deadline_warning]}`}>
      {WARN_LABEL[p.deadline_warning]}
    </span>
  );
}

export default function AdminMtd() {
  const [stats, setStats] = useState({});
  const [rows, setRows] = useState([]);
  const [params, setParams] = useSearchParams();
  const bucket = params.get("bucket") || "";
  const nav = useNavigate();

  useEffect(() => { api.get("/mtd/stats").then(({ data }) => setStats(data)); }, []);
  useEffect(() => {
    api.get("/mtd/periods", { params: bucket ? { bucket } : {} }).then(({ data }) => setRows(data));
  }, [bucket]);

  return (
    <AppShell title="MTD Operations" subtitle="Making Tax Digital quarterly compliance — separate from Self Assessment.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CARDS.map(([key, label, tone, b]) => (
          <StatCard key={key} label={label} value={stats[key]} tone={tone}
            testId={`mtd-card-${key}`}
            onClick={b ? () => setParams({ bucket: b }) : undefined} />
        ))}
      </div>

      <div className="mt-8">
        <Panel title={bucket ? `MTD periods · ${bucket.replace(/_/g, " ")}` : "All MTD periods"}
          testId="mtd-periods-panel"
          action={bucket && (
            <button data-testid="mtd-clear-bucket" onClick={() => setParams({})}
              className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4]">
              Clear filter
            </button>
          )}>
          {!rows.length && <Empty text="No MTD periods match this view." />}
          <ul className="space-y-3">
            {rows.map((p) => (
              <li key={p.id} data-testid={`mtd-op-row-${p.id}`}
                className="border border-[#E3E7E4] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F9FCFA] cursor-pointer transition-colors"
                onClick={() => nav(`/admin/cases/${p.case_id}`)}>
                <div>
                  <div className="font-semibold text-sm">{p.client_name} · {p.label}</div>
                  <div className="text-xs text-[#626A65] mt-1">
                    {p.case_ref} · {p.tax_year} · {d(p.period_start)} – {d(p.period_end)} · due {d(p.deadline)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {warningBadge(p)}
                  <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-[#F1F8F4] text-[#006B3C]">
                    {p.stage_label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
