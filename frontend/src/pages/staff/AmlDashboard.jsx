/**
 * Staff AML console — pending reviews, overdue periodic reviews, firm summary.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, d, dt } from "@/lib/api";

const STATUS_TONE = {
  SUBMITTED: ["#FDF3E3", "#B77A12"],
  IN_REVIEW: ["#FDF3E3", "#B77A12"],
  APPROVED: ["#E9F7EF", "#16A05D"],
  REJECTED: ["#FBEBEB", "#D64545"],
  REQUIRES_REUPLOAD: ["#FDF3E3", "#B77A12"],
  IN_PROGRESS: ["#F1F3F2", "#626A65"],
};

function AmlBadge({ status }) {
  const [bg, fg] = STATUS_TONE[status] || ["#F1F3F2", "#626A65"];
  return (
    <span className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: bg, color: fg }}>
      {(status || "").replace(/_/g, " ")}
    </span>
  );
}

function hoursSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60));
}

export default function AmlDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const base = user?.role === "ACCOUNTANT" ? "/work/aml" : "/admin/aml";
  const tab = params.get("tab") || "pending";

  useEffect(() => {
    api.get("/aml/dashboard").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  const pending = data?.pending_review || [];
  const overdue = data?.overdue_reviews || [];

  const list = useMemo(() => {
    if (tab === "overdue") return overdue;
    return pending;
  }, [tab, pending, overdue]);

  return (
    <AppShell
      title="AML compliance"
      subtitle="Customer due diligence cases pending review and periodic re-checks."
    >
      {!data ? (
        <Empty text="Loading…" />
      ) : (
        <>
          <div
            className="mb-6 rounded-xl border border-[#E3E7E4] bg-[#F7F8F7] px-4 py-3 text-sm text-[#161B18]"
            data-testid="aml-dashboard-guidance"
          >
            <span className="font-semibold text-[#006B3C]">Review queue. </span>
            Open a submitted case, check ID / address / live photo against the checklist, then approve,
            request a re-upload, or reject with notes.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="AML cases pending review"
              value={data.counts?.pending_review ?? 0}
              tone="#B77A12"
              testId="aml-stat-pending"
              onClick={() => setParams({ tab: "pending" })}
            />
            <StatCard
              label="Clients with AML overdue"
              value={data.counts?.overdue_reviews ?? 0}
              tone="#D64545"
              testId="aml-stat-overdue"
              onClick={() => setParams({ tab: "overdue" })}
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

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              ["pending", `Pending review (${pending.length})`],
              ["overdue", `Overdue / expiring (${overdue.length})`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`aml-tab-${id}`}
                onClick={() => setParams({ tab: id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  tab === id ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Panel
            title={tab === "overdue" ? "Clients with AML overdue or expiring" : "AML cases pending review"}
            testId={tab === "overdue" ? "aml-overdue-panel" : "aml-pending-panel"}
          >
            {!list.length ? (
              <Empty
                text={
                  tab === "overdue"
                    ? "No periodic reviews overdue."
                    : "No cases waiting for review."
                }
              />
            ) : (
              <ul className="divide-y divide-[#E3E7E4]">
                {list.map((c) => {
                  const ageH = hoursSince(c.submitted_at || c.next_review_due);
                  return (
                    <li
                      key={c.id}
                      className="py-4 flex flex-wrap justify-between gap-3 items-center"
                      data-testid={`aml-row-${c.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-[#161B18]">
                            {c.client_name || c.full_name || "Client"}
                          </div>
                          <AmlBadge status={c.status} />
                        </div>
                        <div className="text-xs text-[#626A65] mt-1">
                          {c.client_ref || "—"}
                          {c.submitted_at ? ` · submitted ${dt(c.submitted_at)}` : ""}
                          {c.next_review_due && tab === "overdue"
                            ? ` · review due ${d(c.next_review_due)}`
                            : ""}
                          {c.id_document_kind
                            ? ` · ${(c.id_document_kind || "").replace(/_/g, " ")}`
                            : ""}
                          {typeof c.proof_of_address_count === "number"
                            ? ` · ${c.proof_of_address_count} address docs`
                            : ""}
                          {c.has_selfie ? " · live photo" : ""}
                          {ageH != null && tab === "pending" ? ` · ${ageH}h in queue` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`aml-open-${c.id}`}
                        onClick={() => nav(`${base}/${c.id}`)}
                        className="shrink-0 px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold hover:bg-[#006B3C]"
                      >
                        {tab === "overdue" ? "Open case" : "Start review"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {tab === "pending" && overdue.length > 0 && (
            <div className="mt-4 text-xs text-[#626A65]">
              Also {overdue.length} overdue periodic review
              {overdue.length === 1 ? "" : "s"}.{" "}
              <button
                type="button"
                className="font-semibold text-[#006B3C]"
                onClick={() => setParams({ tab: "overdue" })}
              >
                View overdue tab
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
