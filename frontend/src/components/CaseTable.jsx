import { useNavigate } from "react-router-dom";
import { d } from "@/lib/api";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { Empty } from "@/components/StatCard";

export default function CaseTable({ cases, basePath = "/work/cases", showAccountant = true }) {
  const nav = useNavigate();
  if (!cases?.length) return <Empty text="No cases match this view." />;
  return (
    <div className="overflow-x-auto">
      <table data-testid="case-table" className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[#626A65] border-b border-[#E3E7E4]">
            <th className="py-3 pr-4">Priority</th>
            <th className="py-3 pr-4">Client</th>
            <th className="py-3 pr-4">Case ID</th>
            {showAccountant && <th className="py-3 pr-4">Service</th>}
            <th className="py-3 pr-4">Tax Year</th>
            {showAccountant && <th className="py-3 pr-4">Accountant</th>}
            <th className="py-3 pr-4">Stage / Status</th>
            <th className="py-3 pr-4">Next Action</th>
            <th className="py-3 pr-4">Owner</th>
            <th className="py-3 pr-4">Deadline</th>
            <th className="py-3 pr-4">Days Left</th>
            <th className="py-3 pr-4">Last Activity</th>
            <th className="py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} data-testid={`case-row-${c.case_ref}`} className="border-b border-[#E3E7E4] hover:bg-[#F7F8F7] transition-colors">
              <td className="py-4 pr-4"><PriorityBadge priority={c.priority} /></td>
              <td className="py-4 pr-4 font-semibold text-[#161B18] whitespace-nowrap">{c.client_name}</td>
              <td className="py-4 pr-4 text-[#626A65]">{c.case_ref}</td>
              {showAccountant && <td className="py-4 pr-4 text-[#626A65]">{c.service_type === "MTD_INCOME_TAX" ? "MTD for Income Tax" : "Self Assessment"}</td>}
              <td className="py-4 pr-4 text-[#626A65]">{c.tax_year}</td>
              {showAccountant && (
                <td className="py-4 pr-4 text-[#626A65] whitespace-nowrap">
                  {c.assigned_accountant_name || <span className="text-[#E6A23C] font-semibold">Unassigned</span>}
                </td>
              )}
              <td className="py-4 pr-4">
                <div className="text-xs text-[#626A65] mb-1">{c.current_stage}</div>
                <StatusBadge status={c.status} />
              </td>
              <td className="py-4 pr-4 text-[#626A65] max-w-[200px]">{c.next_action}</td>
              <td className="py-4 pr-4 text-[#626A65]">{c.next_action_owner}</td>
              <td className="py-4 pr-4 text-[#626A65] whitespace-nowrap">{d(c.internal_deadline)}</td>
              <td className="py-4 pr-4 font-semibold" style={{ color: c.days_left < 0 ? "#D64545" : c.days_left <= 3 ? "#E6A23C" : "#161B18" }}>
                {c.days_left ?? "—"}
              </td>
              <td className="py-4 pr-4 text-xs text-[#626A65] max-w-[180px]">
                {c.last_activity ? `${c.last_activity.action} · ${d(c.last_activity.created_at)}` : "—"}
              </td>
              <td className="py-4">
                <button
                  data-testid={`open-case-${c.case_ref}`}
                  onClick={() => nav(`${basePath}/${c.id}`)}
                  className="px-3 py-1.5 rounded-lg bg-[#078A4B] text-white text-xs font-semibold hover:bg-[#006B3C] transition-colors"
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
