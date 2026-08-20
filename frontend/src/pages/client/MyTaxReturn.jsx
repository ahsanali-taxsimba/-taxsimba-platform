import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { api, d, money } from "@/lib/api";

export default function MyTaxReturn() {
  const [cs, setCs] = useState(null);
  const [calc, setCalc] = useState(null);
  const [docs, setDocs] = useState([]);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const load = async () => {
    const { data } = await api.get("/cases");
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

  return (
    <AppShell title="My Tax Return" subtitle={`Self Assessment ${cs.tax_year} · ${cs.case_ref}`}>
      <div className="space-y-6">
        <Panel title="Current status" testId="return-status-panel">
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={cs.status} />
            <span className="text-sm text-[#626A65]">{cs.next_action}</span>
          </div>
        </Panel>

        {!calc && (
          <Panel testId="no-calc-panel">
            <p className="text-sm text-[#626A65]">
              Your tax return isn't ready to review yet. Once your accountant has prepared it and our internal
              review team has approved it, you'll be able to review and approve it here.
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

            <Panel title="Final documents" testId="final-docs-panel">
              {!docs.length && <Empty text="Final documents will appear here once available." />}
              <ul className="space-y-3">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between border border-[#E3E7E4] rounded-lg px-4 py-3">
                    <span className="text-sm font-semibold">{doc.name}</span>
                    <a className="text-xs font-semibold text-[#078A4B]" target="_blank" rel="noreferrer"
                      href={`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download`}>View</a>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Approve your tax return" testId="approve-panel">
              {["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(cs.status) ? (
                <>
                  <p className="text-sm text-[#626A65] mb-5">
                    By approving, you confirm the information is complete and correct to the best of your knowledge.
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
                  You approved version {calc.version}. Your return is now with our submission team.
                </p>
              )}
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
