/**
 * Master Tax Return Information Intake screen — grid of category upload cards
 * with overall completion progress. Used by clients and staff (case-scoped).
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import CategoryCard from "@/components/intake/CategoryCard";
import { Empty, Panel } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";

export default function TaxReturnIntake({ caseId: caseIdProp, embedded }) {
  const { id: routeCaseId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const caseId = caseIdProp || routeCaseId || params.get("case_id");
  const canVerify = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(user?.role);

  const [intake, setIntake] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setErr("");
    const req = caseId
      ? api.get(`/intake/cases/${caseId}`)
      : api.get("/intake/me", { params: { tax_year: params.get("tax_year") || undefined } });
    return req
      .then(({ data }) => setIntake(data))
      .catch((e) => setErr(apiError(e.response?.data?.detail) || "Could not load document intake"));
  }, [caseId, params]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = intake?.progress;
  const body = (
    <div className="space-y-6" data-testid="tax-return-intake">
      {err && <p className="text-sm text-[#D64545]">{err}</p>}
      {!intake && !err && <Empty text="Loading document intake…" />}
      {intake && (
        <>
          <Panel testId="intake-progress-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#161B18]">
                  Tax year {intake.tax_year} · {(intake.completion_status || "").replace(/_/g, " ")}
                </div>
                <p className="text-xs text-[#626A65] mt-1">
                  Upload supporting documents by category. Mandatory items must be uploaded or marked
                  not applicable before the return can proceed to admin review.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#006B3C]" data-testid="intake-percent">
                  {progress?.percent ?? 0}%
                </div>
                <div className="text-xs text-[#626A65]">
                  {progress?.completed_categories ?? 0}/{progress?.total_categories ?? 0} categories
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[#E3E7E4] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#078A4B] transition-all"
                style={{ width: `${progress?.percent ?? 0}%` }}
                data-testid="intake-progress-bar"
              />
            </div>
            {progress?.missing_mandatory?.length > 0 && (
              <p className="text-xs text-[#D64545] mt-3" data-testid="intake-missing-mandatory">
                Missing mandatory: {progress.missing_mandatory.join(", ")}
              </p>
            )}
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {(intake.categories || []).map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                canVerify={canVerify}
                onChanged={load}
              />
            ))}
          </div>

          {/* TODO(ocr): surface extracted bank/payslip fields per category */}
          {/* TODO(ai): show suggested expense categories for OTHER_EXPENSES */}
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <AppShell
      title="Tax return documents"
      subtitle="Structured intake for every income and expense category"
    >
      {caseId && canVerify && (
        <div className="mb-4">
          <Link
            to={user?.role === "ACCOUNTANT" ? `/work/cases/${caseId}` : `/admin/cases/${caseId}`}
            className="text-sm font-semibold text-[#006B3C]"
          >
            ← Back to case
          </Link>
        </div>
      )}
      {body}
    </AppShell>
  );
}

/** Staff dashboard of clients missing intake documents / blocked returns. */
export function IntakeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const base = user?.role === "ACCOUNTANT" ? "/work" : "/admin";

  useEffect(() => {
    api.get("/intake/dashboard").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  return (
    <AppShell
      title="Document intake"
      subtitle="Clients with missing tax-return documents and returns blocked on uploads"
    >
      {!data ? (
        <Empty text="Loading…" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Clients with missing documents" testId="intake-missing-panel">
            {(data.missing_documents || []).length === 0 ? (
              <Empty text="No missing mandatory documents." />
            ) : (
              <ul className="divide-y divide-[#E3E7E4]">
                {data.missing_documents.map((r) => (
                  <li key={r.intake_id} className="py-3 flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{r.client_name}</div>
                      <div className="text-xs text-[#626A65]">
                        {r.case_ref} · {r.tax_year} · missing {r.missing_mandatory?.join(", ")}
                      </div>
                    </div>
                    {r.case_id && (
                      <Link
                        to={`${base}/cases/${r.case_id}?tab=Document%20Intake`}
                        className="text-xs font-semibold text-[#006B3C]"
                      >
                        Open
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Tax returns blocked due to missing uploads" testId="intake-blocked-panel">
            {(data.blocked_returns || []).length === 0 ? (
              <Empty text="No returns currently blocked." />
            ) : (
              <ul className="divide-y divide-[#E3E7E4]">
                {data.blocked_returns.map((r) => (
                  <li key={r.intake_id} className="py-3 flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{r.client_name}</div>
                      <div className="text-xs text-[#626A65]">
                        {r.case_ref} · {r.case_status?.replace(/_/g, " ")}
                      </div>
                    </div>
                    {r.case_id && (
                      <Link
                        to={`${base}/intake/${r.case_id}`}
                        className="text-xs font-semibold text-[#006B3C]"
                      >
                        Intake
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
