/**
 * Signature status dashboard — widgets for:
 *  - Documents awaiting signature
 *  - Returns approved and ready to file
 *
 * Linked from admin / accountant nav as "E-signatures".
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { SignatureStatusBadge } from "@/components/esign/SignatureStatusBadge";
import { useAuth } from "@/context/AuthContext";
import { api, d, dt } from "@/lib/api";

export default function EsignDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    api
      .get("/esign/dashboard")
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Could not load e-signature dashboard"));
  };
  useEffect(() => { load(); }, []);

  const caseHref = (caseId) =>
    user?.role === "ACCOUNTANT" ? `/work/cases/${caseId}` : `/admin/cases/${caseId}`;

  const download = async (requestId) => {
    const res = await api.get(`/esign/requests/${requestId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `esign-${requestId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="E-signatures"
      subtitle="Track approval documents awaiting signature and returns ready to file with HMRC."
    >
      {err && <p className="text-sm text-[#D64545] mb-4">{err}</p>}
      {!data ? (
        <Empty text="Loading…" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <StatCard
              label="Documents awaiting signature"
              value={data.counts?.awaiting_signature ?? 0}
              tone="#B77A12"
              testId="esign-widget-awaiting"
            />
            <StatCard
              label="Returns approved and ready to file"
              value={data.counts?.approved_ready_to_file ?? 0}
              tone="#16A05D"
              testId="esign-widget-ready"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Documents awaiting signature" testId="esign-awaiting-panel">
              {(data.awaiting_signature || []).length === 0 ? (
                <Empty text="Nothing waiting for a signature." />
              ) : (
                <ul className="divide-y divide-[#E3E7E4]">
                  {data.awaiting_signature.map((r) => (
                    <li key={r.id} className="py-3 flex flex-wrap items-start justify-between gap-2" data-testid={`esign-awaiting-${r.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{r.document?.title || "Document"}</div>
                        <div className="text-xs text-[#626A65] mt-0.5">
                          {r.document?.client_name || "—"}
                          {r.document?.tax_period_label ? ` · ${r.document.tax_period_label}` : ""}
                          {" · "}Sent {dt(r.sent_at)} · Expires {d(r.expires_at)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(r.signers || []).map((s) => (
                            <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F3F2] text-[#626A65]">
                              {s.name}: {s.status}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SignatureStatusBadge status={r.status} />
                        {r.case_id && (
                          <Link to={caseHref(r.case_id)} className="text-xs font-semibold text-[#006B3C]">
                            Open case
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Approved and ready to file" testId="esign-ready-panel">
              {(data.approved_ready_to_file || []).length === 0 ? (
                <Empty text="No signed packs waiting for HMRC submission." />
              ) : (
                <ul className="divide-y divide-[#E3E7E4]">
                  {data.approved_ready_to_file.map((r) => (
                    <li key={r.id} className="py-3 flex flex-wrap items-start justify-between gap-2" data-testid={`esign-ready-${r.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{r.document?.title || "Document"}</div>
                        <div className="text-xs text-[#626A65] mt-0.5">
                          {r.document?.client_name || "—"} · Signed {dt(r.completed_at)}
                        </div>
                        <div className="text-[10px] font-mono text-[#626A65] mt-1 truncate max-w-xs">
                          hash {r.document?.calculation_hash?.slice(0, 16)}…
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SignatureStatusBadge status={r.status} />
                        <button
                          type="button"
                          data-testid={`esign-download-${r.id}`}
                          className="text-xs font-semibold text-[#006B3C]"
                          onClick={() => download(r.id)}
                        >
                          Download + certificate
                        </button>
                        {r.case_id && (
                          <Link to={caseHref(r.case_id)} className="text-xs font-semibold text-[#006B3C]">
                            File
                          </Link>
                        )}
                      </div>
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
