/**
 * Staff AML console — pending reviews, overdue periodic reviews, firm summary.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, d, dt } from "@/lib/api";

const STATUS_TONE = {
  SUBMITTED: ["#FDF3E3", "#B77A12"],
  IN_REVIEW: ["#F0EBFB", "#7656C9"],
  APPROVED: ["#E9F7EF", "#16A05D"],
  REJECTED: ["#FBEBEB", "#D64545"],
  REQUIRES_REUPLOAD: ["#FDF3E3", "#B77A12"],
};

function AmlBadge({ status }) {
  const [bg, fg] = STATUS_TONE[status] || ["#F1F3F2", "#626A65"];
  return (
    <span className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: bg, color: fg }}>
      {(status || "").replace(/_/g, " ")}
    </span>
  );
}

export default function AmlDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const base = user?.role === "ACCOUNTANT" ? "/work/aml" : "/admin/aml";

  useEffect(() => {
    api.get("/aml/dashboard").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  return (
    <AppShell
      title="AML compliance"
      subtitle="Customer due diligence cases pending review and periodic re-checks."
    >
      {!data ? (
        <Empty text="Loading…" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="AML cases pending review"
              value={data.counts?.pending_review ?? 0}
              tone="#B77A12"
              testId="aml-stat-pending"
              onClick={() => nav(`${base}?tab=pending`)}
            />
            <StatCard
              label="Clients with AML overdue"
              value={data.counts?.overdue_reviews ?? 0}
              tone="#D64545"
              testId="aml-stat-overdue"
              onClick={() => nav(`${base}?tab=overdue`)}
            />
            <StatCard
              label="Approved / compliant"
              value={data.counts?.approved ?? 0}
              tone="#16A05D"
              testId="aml-stat-approved"
            />
            <StatCard
              label="In progress (client)"
              value={data.counts?.in_progress_client ?? 0}
              tone="#078A4B"
              testId="aml-stat-progress"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="AML cases pending review" testId="aml-pending-panel">
              {(data.pending_review || []).length === 0 ? (
                <Empty text="No cases waiting for review." />
              ) : (
                <ul className="divide-y divide-[#E3E7E4]">
                  {data.pending_review.map((c) => (
                    <li key={c.id} className="py-3 flex justify-between gap-3 items-start">
                      <div>
                        <div className="text-sm font-semibold">{c.client_name || "Client"}</div>
                        <div className="text-xs text-[#626A65]">
                          {c.client_ref} · submitted {dt(c.submitted_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AmlBadge status={c.status} />
                        <Link
                          to={`${base}/${c.id}`}
                          data-testid={`aml-open-${c.id}`}
                          className="text-xs font-semibold text-[#006B3C]"
                        >
                          Review
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Clients with AML overdue or expiring" testId="aml-overdue-panel">
              {(data.overdue_reviews || []).length === 0 ? (
                <Empty text="No periodic reviews overdue." />
              ) : (
                <ul className="divide-y divide-[#E3E7E4]">
                  {data.overdue_reviews.map((c) => (
                    <li key={c.id} className="py-3 flex justify-between gap-3 items-start">
                      <div>
                        <div className="text-sm font-semibold">{c.client_name || "Client"}</div>
                        <div className="text-xs text-[#626A65]">
                          Review due {d(c.next_review_due)} · risk {c.risk_level || "—"}
                        </div>
                      </div>
                      <Link to={`${base}/${c.id}`} className="text-xs font-semibold text-[#006B3C]">
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
