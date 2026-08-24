import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, FileCheck2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Journey } from "@/components/Journey";
import { Panel } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { api, d } from "@/lib/api";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [cs, setCs] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [offers, setOffers] = useState([]);
  const [mtdActive, setMtdActive] = useState(null);

  useEffect(() => {
    api.get("/cases").then(async ({ data }) => {
      const sa = data.filter((c) => c.service_type === "SELF_ASSESSMENT");
      if (!sa.length) return;
      const { data: full } = await api.get(`/cases/${sa[0].id}`);
      setCs(full);
    });
    api.get("/tasks", { params: { status: "OPEN", service_type: "SELF_ASSESSMENT" } }).then(({ data }) => setTasks(data));
    api.get("/my-offers").then(({ data }) => setOffers(data));
    api.get("/my-services")
      .then(({ data }) => setMtdActive(
        (data.services || []).some((s) => s.service_type === "MTD_INCOME_TAX" && s.status === "ACTIVE")))
      .catch(() => {});
  }, []);
  const clientName = (user?.name || "").trim();  const openTasks = tasks.length;
  const readyToApprove = cs && ["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(cs.status);
  // Never claim a successful HMRC submission without an authorised submission record.
  const submitted = cs && ["SUBMITTED", "COMPLETED"].includes(cs.status) && cs.has_submission_record;

  return (
    <AppShell
      title={`Welcome back, ${clientName}`}
      subtitle={cs ? `Your Self Assessment (${cs.tax_year}) is in progress.` : mtdActive ? "Your MTD for Income Tax service is active." : "No active Self Assessment yet."}
    >
      <div className="space-y-6">
        {!cs && mtdActive ? (
          <div data-testid="mtd-portal-card" className="bg-white border border-[#16A05D] rounded-xl p-8">
            <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">Making Tax Digital for Income Tax</h2>
            <p className="text-sm text-[#626A65] mt-2 max-w-xl">
              Your MTD service is active. Your quarterly updates and Final Declaration are in your MTD area.
            </p>
            <Link to="/mtd" data-testid="open-mtd-portal-btn"
              className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
              Open MTD for Income Tax
            </Link>
          </div>
        ) : readyToApprove ? (
          <div data-testid="client-action-card" className="bg-white border border-[#16A05D] rounded-xl p-8">
            <div className="flex items-start gap-4">
              <FileCheck2 size={22} color="#16A05D" className="mt-1" />
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">Your tax return is ready to review</h2>
                <p className="text-sm text-[#626A65] mt-2 max-w-xl">
                  Your accountant has prepared your return and it has been approved by our internal review team.
                  Please review it and approve when you're happy.
                </p>
                <Link to="/my-return" data-testid="review-my-return-btn"
                  className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
                  Review My Tax Return
                </Link>
              </div>
            </div>
          </div>
        ) : submitted ? (
          <div data-testid="client-action-card" className="bg-white border border-[#16A05D] rounded-xl p-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 size={22} color="#16A05D" className="mt-1" />
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">Your return has been submitted to HMRC</h2>
                <p className="text-sm text-[#626A65] mt-2 max-w-xl">
                  We've submitted your tax return and you'll find your submission reference and final documents on
                  My Tax Return. There's nothing more for you to do.
                </p>
                <Link to="/my-return" data-testid="view-submission-btn"
                  className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
                  View My Tax Return
                </Link>
              </div>
            </div>
          </div>
        ) : openTasks > 0 ? (
          <div data-testid="client-action-card" className="bg-white border border-[#E6A23C] rounded-xl p-8">
            <div className="flex items-start gap-4">
              <AlertCircle size={22} color="#E6A23C" className="mt-1" />
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">Action required</h2>
                <p className="text-sm text-[#626A65] mt-2 max-w-xl">
                  We still need some information from you. Your accountant needs the following items before they can
                  continue preparing your tax return.
                </p>
                <Link to="/tasks" data-testid="view-required-items-btn"
                  className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
                  View Required Items ({openTasks})
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div data-testid="client-action-card" className="bg-white border border-[#E3E7E4] rounded-xl p-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 size={22} color="#16A05D" className="mt-1" />
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">You're all up to date</h2>
                <p className="text-sm text-[#626A65] mt-2 max-w-xl">
                  We have everything we need for now. Your accountant is reviewing your information and documents.
                  We'll let you know if anything else is required.
                </p>
                <p className="text-xs font-semibold text-[#078A4B] mt-4">No action required from you right now.</p>
              </div>
            </div>
          </div>
        )}

        {offers.slice(0, 1).map((o) => (
          <div key={o.id} data-testid="recommendation-action-card" className="bg-white border border-[#7656C9] rounded-xl p-8">
            <h2 className="text-lg md:text-xl font-semibold text-[#161B18]">Additional service recommended</h2>
            <p className="text-sm text-[#626A65] mt-2 max-w-xl">
              Based on the information provided, your accountant has recommended that we review whether{" "}
              {o.service_name === "MTD for Income Tax" ? "Making Tax Digital for Income Tax" : o.service_name} applies to you.
            </p>
            <Link to={`/recommendation/${o.id}`} data-testid="review-recommendation-btn"
              className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
              Review Recommendation
            </Link>
          </div>
        ))}

        {cs && mtdActive === false && (
          <div data-testid="mtd-informational-card" className="bg-white border border-[#E3E7E4] rounded-xl p-6 sm:p-8">
            <h2 className="text-base md:text-lg font-semibold text-[#161B18]">Making Tax Digital</h2>
            <p className="text-sm text-[#626A65] mt-2 max-w-xl leading-relaxed">
              You don't need to take any action for MTD right now.
            </p>
            <p className="text-sm text-[#626A65] mt-3 max-w-xl leading-relaxed">
              Based on your current position, you may need to register for Making Tax Digital in a future tax year.
              We'll review this for you and contact you if and when you need to take action.
            </p>
            <p className="text-xs font-semibold text-[#078A4B] mt-4">No action required at the moment.</p>
          </div>
        )}

        {cs && (
          <>
            <Panel title="Your Tax Journey" testId="journey-panel">              <Journey steps={cs.journey} />
            </Panel>
            <Panel title="Case summary" testId="client-case-summary">
              <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                <div><dt className="text-[#626A65] text-xs uppercase tracking-wide">Case</dt><dd className="mt-1 font-semibold">{cs.case_ref}</dd></div>
                <div><dt className="text-[#626A65] text-xs uppercase tracking-wide">Tax Year</dt><dd data-testid="dashboard-tax-year" className="mt-1 font-semibold">{cs.tax_year}</dd></div>
                <div><dt className="text-[#626A65] text-xs uppercase tracking-wide">Status</dt><dd className="mt-1"><StatusBadge status={cs.status} client testId="dashboard-status" /></dd></div>
                <div><dt className="text-[#626A65] text-xs uppercase tracking-wide">Tax Return Deadline</dt><dd data-testid="dashboard-deadline" className="mt-1 font-semibold">{d(cs.external_deadline)}</dd></div>
              </dl>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
