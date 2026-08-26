import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { api, d, money, openDocument } from "@/lib/api";
import { useContent } from "@/lib/content";

export default function MyTaxReturn() {
  const t = useContent();
  const [cs, setCs] = useState(null);
  const [calc, setCalc] = useState(null);
  const [docs, setDocs] = useState([]);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const load = async () => {
    const { data } = await api.get("/cases", { params: { service_type: "SELF_ASSESSMENT" } });
    if (!data.length) return;
    const { data: full } = await api.get(`/cases/${data[0].id}`);
    setCs(full);
    const { data: calcs } = await api.get(`/cases/${full.id}/calculations`);
    setCalc(calcs[0] || null);
    const { data: dd } = await api.get("/documents", { params: { case_id: full.id, filter: "final" } });
    setDocs(dd);
  };
  useEffect(() => { load(); }, []);

  const approve = async () => {
    await api.post(`/cases/${cs.id}/client-approve`);
    load();
  };

  const ask = async () => {
    await api.post("/messages", { case_id: cs.id, body: msg });
    setMsg("");
    setSent(true);
  };

  if (!cs) return <AppShell title="My Tax Return"><Empty text="No active case yet." /></AppShell>;

  // The approved version comes from the recorded client approval, falling back to the version
  // the client is currently being shown -- never a hard-coded number.
  const approvedVersion = cs.approved_version ?? calc?.version;

  return (
    <AppShell title="My Tax Return" subtitle={`Self Assessment ${cs.tax_year} · ${cs.case_ref}`}>
      <div className="space-y-6">
        <Panel title="Current status" testId="return-status-panel">
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={cs.status} client testId="return-status-badge" />
            <span className="text-sm text-[#626A65]">
              {cs.has_submission_record
                ? "Your accountant has submitted your return to HMRC."
                : ["CLIENT_APPROVED", "READY_FOR_SUBMISSION"].includes(cs.status)
                  ? "You've approved your return. Your accountant will now submit it to HMRC — nothing more is needed from you."
                  : cs.next_action_owner === "CLIENT"
                    ? cs.next_action
                    : "Your return is with our team. We'll let you know when we need anything."}
            </span>
          </div>
          {cs.has_submission_record && cs.submission_date && (
            <p data-testid="client-submission-info" className="text-sm text-[#161B18] mt-4">
              Submitted to HMRC on <b>{d(cs.submission_date)}</b>
              {cs.submission_reference ? <> · reference <b>{cs.submission_reference}</b></> : null}
            </p>
          )}
          <p className="text-xs text-[#626A65] mt-4">
            {t("client.return.status.helper", "You review and approve your return. Your accountant then files it with HMRC and records the outcome here.")}
          </p>
        </Panel>

        {!calc && (
          <Panel testId="no-calc-panel">
            <p className="text-sm text-[#626A65]">
              {t("client.return.not_ready", "Your tax return isn't ready to review yet. Once your accountant has prepared it and our internal review team has approved it, you'll be able to review and approve it here.")}
            </p>
          </Panel>
        )}

        {calc && (
          <>
            <Panel title={`Your calculation (Version ${calc.version})`} testId="calculation-panel">
              <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div><dt className="text-xs uppercase tracking-wide text-[#626A65]">Tax Year</dt><dd className="mt-1 text-lg font-semibold">{cs.tax_year}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-[#626A65]">Total Income</dt><dd data-testid="calc-total-income" className="mt-1 text-lg font-semibold">{money(calc.total_income)}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-[#626A65]">Taxable Income</dt><dd className="mt-1 text-lg font-semibold">{money(calc.taxable_income)}</dd></div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#626A65]">{calc.is_refund ? "Refund Due" : "Tax Due"}</dt>
                  <dd data-testid="calc-tax-due" className="mt-1 text-lg font-bold" style={{ color: calc.is_refund ? "#16A05D" : "#161B18" }}>{money(calc.tax_due)}</dd>
                </div>
              </dl>
              <div className="mt-6 rounded-lg bg-[#F1F8F4] p-5 text-sm text-[#161B18]">
                <div className="font-semibold">Payment information</div>
                <p className="text-[#626A65] mt-1">
                  {calc.is_refund
                    ? "Any refund will be paid by HMRC to your nominated bank account after submission."
                    : `Payment deadline: ${calc.payment_deadline}. You can pay HMRC online, by bank transfer or by debit card.`}
                </p>
                {calc.notes && <p className="text-[#626A65] mt-2">Accountant summary: {calc.notes}</p>}
              </div>
            </Panel>

            {cs.has_submission_record && (
              <Panel title="Paying your tax" testId="paying-your-tax-panel">
                {calc.is_refund || !(calc.tax_due > 0) ? (
                  <p data-testid="no-payment-due" className="text-sm font-semibold text-[#16A05D]">
                    No payment is currently due.
                  </p>
                ) : (
                  <>
                    <dl className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-[#626A65]">Amount due</dt>
                        <dd data-testid="pay-amount-due" className="mt-1 text-lg font-bold">{money(calc.tax_due)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-[#626A65]">Payment deadline</dt>
                        <dd data-testid="pay-deadline" className="mt-1 text-lg font-semibold">{calc.payment_deadline}</dd>
                      </div>
                    </dl>
                    {(calc.breakdown?.payments_on_account || []).length > 0 && (
                      <ul data-testid="payments-on-account" className="mt-6 space-y-2">
                        {calc.breakdown.payments_on_account.map((p, i) => (
                          <li key={i} className="text-sm text-[#161B18]">
                            Payment on account: <b>{money(p.amount)}</b> due <b>{p.due}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <p data-testid="pay-submission-summary" className="text-sm text-[#161B18] mt-6">
                  Submitted on <b>{d(cs.submission_date)}</b>
                  {cs.submission_reference ? <> · HMRC / filing software reference <b>{cs.submission_reference}</b></> : null}
                </p>
                <p className="text-sm text-[#626A65] mt-3">
                  Your tax return has been submitted to HMRC. It can take up to 72 hours for your HMRC
                  online account to update. Any tax due is paid directly to HMRC, not to TaxSimba.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <a data-testid="hmrc-signin-link" href="https://www.gov.uk/personal-tax-account"
                    target="_blank" rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold text-center hover:bg-[#F1F8F4] transition-colors">
                    Sign in to HMRC
                  </a>
                  <a data-testid="hmrc-pay-link" href="https://www.gov.uk/pay-self-assessment-tax-bill"
                    target="_blank" rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold text-center hover:bg-[#006B3C] transition-colors">
                    Pay HMRC
                  </a>
                </div>
              </Panel>
            )}

            <Panel title="Final documents" testId="final-docs-panel">              {!docs.length && <Empty text="Final documents will appear here once available." />}
              <ul className="space-y-3">
                {docs.map((doc) => (
                  <li key={doc.id} data-testid={`final-doc-${doc.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#E3E7E4] rounded-lg px-4 py-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words">{doc.name}</span>
                      <span className="block text-xs text-[#626A65] mt-0.5">
                        Released {d(doc.upload_date || doc.created_at)}
                        {doc.tax_year ? ` · ${doc.tax_year}` : ""}
                      </span>
                    </span>
                    <button data-testid={`final-doc-download-${doc.id}`} type="button"
                      onClick={() => openDocument(doc.id, doc.name)}
                      className="text-xs font-semibold text-[#078A4B] shrink-0 hover:underline">
                      View / Download
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Approve your tax return" testId="approve-panel">
              {["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(cs.status) ? (
                <>
                  <p className="text-sm text-[#626A65] mb-5">
                    {t("client.return.approve.helper", "By approving, you confirm the information is complete and correct to the best of your knowledge.")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button data-testid="client-approve-btn" onClick={approve}
                      className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors">
                      Approve My Tax Return
                    </button>
                  </div>
                  <div className="mt-6">
                    <label className="text-sm font-medium">Ask My Accountant a Question</label>
                    <textarea data-testid="ask-accountant-input" value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
                      className="mt-1.5 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#078A4B]/30" />
                    <button data-testid="ask-accountant-btn" onClick={ask} disabled={!msg.trim()}
                      className="mt-3 px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors disabled:opacity-50">
                      Send question
                    </button>
                    {sent && <p className="text-xs text-[#16A05D] mt-2">Your question has been sent to your accountant.</p>}
                  </div>
                </>
              ) : (
                <p data-testid="already-approved-text" className="text-sm text-[#16A05D] font-semibold">
                  {cs.has_submission_record
                    ? `You approved version ${approvedVersion}. Your return has now been submitted to HMRC.`
                    : `You approved version ${approvedVersion}. Your return is now with your accountant for submission to HMRC.`}
                </p>
              )}
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
