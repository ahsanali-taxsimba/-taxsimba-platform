/**
 * Admin / accountant dashboard for HMRC 64-8 agent authorisations.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel, StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, dt } from "@/lib/api";

const STATUS_TONE = {
  DRAFT: "bg-[#F1F3F2] text-[#626A65]",
  SENT: "bg-[#FDF3E3] text-[#B77A12]",
  SIGNED: "bg-[#E9F7EF] text-[#16A05D]",
  EXPIRED: "bg-[#FDECEC] text-[#D64545]",
};

export default function Hmrc64Dashboard() {
  const { user } = useAuth();
  const base = user?.role === "ACCOUNTANT" ? "/work" : "/admin";
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("pending");

  const load = () =>
    api
      .get("/hmrc64/dashboard")
      .then(({ data: d }) => setData(d))
      .catch((e) => setErr(apiError(e.response?.data?.detail) || "Could not load dashboard"));

  useEffect(() => {
    load();
  }, []);

  const rows =
    tab === "pending"
      ? data?.pending_authorisation
      : tab === "completed"
        ? data?.completed_authorisation
        : tab === "expired"
          ? data?.expired
          : data?.missing_tax_references;

  return (
    <AppShell
      title="HMRC 64-8 authorisations"
      subtitle="Agent authorisation forms — generate, send, track signatures"
    >
      {err && <p className="text-sm text-[#D64545] mb-4">{err}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Awaiting signature" value={data?.counts?.pending ?? "—"} testId="hmrc64-stat-pending" />
        <StatCard label="Signed" value={data?.counts?.completed ?? "—"} testId="hmrc64-stat-signed" />
        <StatCard label="Expired" value={data?.counts?.expired ?? "—"} testId="hmrc64-stat-expired" />
        <StatCard
          label="Missing tax refs"
          value={data?.counts?.missing_tax_references ?? "—"}
          testId="hmrc64-stat-missing"
        />
      </div>

      <Panel
        title="Authorisations"
        testId="hmrc64-dashboard-panel"
        action={
          <div className="flex flex-wrap gap-2">
            {[
              ["pending", "Pending"],
              ["completed", "Completed"],
              ["expired", "Expired"],
              ["missing", "Missing refs"],
            ].map(([k, l]) => (
              <button
                key={k}
                type="button"
                data-testid={`hmrc64-tab-${k}`}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  tab === k ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      >
        {!rows?.length && <Empty text="Nothing in this list yet." />}
        {tab !== "missing" && rows?.length > 0 && (
          <ul className="divide-y divide-[#E3E7E4]">
            {rows.map((f) => (
              <li key={f.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{f.fill_fields?.client_full_name || f.client_id}</div>
                  <div className="text-xs text-[#626A65] mt-1">
                    Generated {dt(f.generated_at)}
                    {f.sent_at ? ` · Sent ${dt(f.sent_at)}` : ""}
                    {f.signed_at ? ` · Signed ${dt(f.signed_at)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${STATUS_TONE[f.status] || ""}`}>
                    {f.status}
                  </span>
                  <Link
                    to={`${base}/hmrc64/${f.id}`}
                    data-testid={`hmrc64-open-${f.id}`}
                    className="text-xs font-semibold text-[#006B3C]"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {tab === "missing" && rows?.length > 0 && (
          <ul className="divide-y divide-[#E3E7E4]">
            {rows.map((c) => (
              <li key={c.id} className="py-4 flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-[#626A65]">{c.client_ref} · {c.email || "no email"}</div>
                </div>
                <Link
                  to={`${base}/hmrc64/client/${c.id}`}
                  className="text-xs font-semibold text-[#006B3C]"
                  data-testid={`hmrc64-client-${c.id}`}
                >
                  Pre-check
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
