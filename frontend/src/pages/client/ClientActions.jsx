import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { clientStatusLabel } from "@/components/StatusBadge";
import { api, apiError, d, money } from "@/lib/api";

export function ActionRequired() {
  const [data, setData] = useState({ outstanding: [], history: [] });
  const [shown, setShown] = useState(10);
  const load = () => api.get("/my-actions").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  return (
    <AppShell title="Action Required" subtitle="Everything waiting on you, across all your services.">
      <div className="space-y-6">
        <Panel title="Outstanding" testId="actions-outstanding-panel">
          {!data.outstanding.length && <Empty text="Nothing needs your attention right now." />}
          <ul className="space-y-3">
            {data.outstanding.map((a) => (
              <li key={a.id} data-testid={`action-${a.id}`} className="border border-[#E3E7E4] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-[#161B18]">{a.action}</div>
                  {a.description && <p className="text-sm text-[#626A65] mt-1">{a.description}</p>}
                  <p className="text-xs text-[#626A65] mt-2">
                    {a.service_name || "Account"}{a.case_ref ? ` · ${a.case_ref}` : ""}{a.due_date ? ` · Due ${d(a.due_date)}` : ""}
                  </p>
                </div>
                <Link to={a.link} data-testid={`action-open-${a.id}`}
                  className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold hover:bg-[#006B3C] transition-colors">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Completed history" testId="actions-history-panel">
          {!data.history.length && <Empty text="No completed actions yet." />}
          <ul className="space-y-2 text-sm">
            {data.history.slice(0, shown).map((a) => (
              <li key={a.id} data-testid={`history-${a.id}`} className="text-[#626A65]">
                {a.action}
                {a.service_name ? ` · ${a.service_name}` : ""}
                {a.completed_date ? ` · completed ${d(a.completed_date)}` : " · completed"}
              </li>
            ))}
          </ul>
          {data.history.length > shown && (
            <button data-testid="history-show-more-btn" onClick={() => setShown(shown + 10)}
              className="mt-4 px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold hover:bg-[#F1F8F4] transition-colors">
              Show more ({data.history.length - shown} remaining)
            </button>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

export function RecommendationReview() {
  const { offerId } = useParams();
  const nav = useNavigate();
  const [offer, setOffer] = useState(null);
  const [err, setErr] = useState("");
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/my-offers/${offerId}`).then(({ data }) => setOffer(data)).catch(() => setErr("This recommendation is no longer available."));
  }, [offerId]);

  const pay = async () => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/payments/offer-checkout", { offer_id: offerId, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) { setErr(apiError(e.response?.data?.detail)); setBusy(false); }
  };

  const ask = async () => {
    const { data: cases } = await api.get("/cases", { params: { service_type: "SELF_ASSESSMENT" } });
    if (!cases.length) return;
    await api.post("/messages", { case_id: cases[0].id, body: `Question about the ${offer.service_name} recommendation: ${question}` });
    setQuestion(""); setSent(true);
  };

  return (
    <AppShell title="Additional service recommended" subtitle="Take your time — there's no obligation to buy now.">
      <div className="space-y-6">
        <Panel testId="recommendation-review-panel">
          {err && !offer && <p className="text-sm text-[#D64545]">{err}</p>}
          {offer && (
            <>
              <dl className="grid sm:grid-cols-2 gap-6 text-sm">
                <div><dt className="text-xs uppercase text-[#626A65]">Service</dt><dd data-testid="rec-service" className="mt-1 font-semibold">{offer.service_name}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Recommended package</dt><dd data-testid="rec-package" className="mt-1 font-semibold">{offer.package_name}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Price</dt><dd className="mt-1 font-semibold">{money(offer.price)}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Billing frequency</dt><dd className="mt-1 font-semibold">{offer.billing_frequency}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Credit / discount applied</dt><dd className="mt-1 font-semibold">{money(offer.credit)}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Additional amount payable</dt><dd className="mt-1 font-semibold">{money(offer.amount_due)}</dd></div>
                <div><dt className="text-xs uppercase text-[#626A65]">Total payable now</dt><dd data-testid="rec-total" className="mt-1 text-lg font-bold">{money(offer.amount_due)}</dd></div>
              </dl>
              <div className="mt-6 rounded-lg bg-[#F1F8F4] p-5">
                <div className="text-sm font-semibold">Why this has been recommended</div>
                <p className="text-sm text-[#626A65] mt-1" data-testid="rec-explanation">
                  {offer.explanation || offer.message || "Based on the information provided, your accountant has recommended that we review whether this service applies to you."}
                </p>
                <span data-testid="offer-explanation" className="hidden">{offer.explanation || offer.message || ""}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button data-testid="add-mtd-service-btn" disabled={busy} onClick={pay}
                  className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-60">
                  Add {offer.service_name}
                </button>
                <button data-testid="ask-taxsimba-btn" onClick={() => document.getElementById("ask-box")?.scrollIntoView({ behavior: "smooth" })}
                  className="px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors">
                  Ask TaxSimba a Question
                </button>
                <button data-testid="rec-later-btn" onClick={() => nav("/dashboard")}
                  className="px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4] transition-colors">
                  Maybe later
                </button>
              </div>
              {err && <p className="text-sm text-[#D64545] mt-3">{err}</p>}
            </>
          )}
        </Panel>

        {offer && (
          <Panel title="Ask TaxSimba a Question" testId="rec-question-panel">
            <div id="ask-box">
              <textarea data-testid="rec-question-input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about this recommendation…"
                className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm" />
              <button data-testid="rec-question-send-btn" onClick={ask} disabled={!question.trim()}
                className="mt-3 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50">Send question</button>
              {sent && <p className="text-xs text-[#16A05D] mt-2">Sent — your accountant will reply in Messages.</p>}
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

export function MtdDashboard() {
  const [cases, setCases] = useState([]);
  const [periods, setPeriods] = useState({});
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await api.get("/cases", { params: { service_type: "MTD_INCOME_TAX" } });
    setCases(data);
    const all = {};
    for (const c of data) {
      try { all[c.id] = (await api.get(`/mtd/cases/${c.id}/periods`)).data; } catch (e) { all[c.id] = []; }
    }
    setPeriods(all);
  };
  useEffect(() => { load(); }, []);

  const approve = async (p) => {
    setErr(""); setBusy(p.id);
    try {
      await api.post(`/mtd/periods/${p.id}/client-approve`);
      await load();
    } catch (e) { setErr(apiError(e.response?.data?.detail)); }
    setBusy(null);
  };

  return (
    <AppShell title="MTD for Income Tax" subtitle="Your Making Tax Digital service — separate from your Self Assessment.">
      <div className="space-y-6">
        {err && <p data-testid="mtd-error" className="text-sm text-[#D64545] font-semibold">{err}</p>}
        {!cases.length && (
          <Panel title="MTD status" testId="mtd-status-panel">
            <Empty text="Your MTD service is being set up. Your accountant will be in touch." />
          </Panel>
        )}
        {cases.map((c) => (
          <Panel key={c.id} title={`${c.case_ref} · ${c.tax_year}`} testId={`mtd-case-${c.case_ref}`}>
            <p className="text-sm text-[#626A65] mb-6">{c.current_stage} · {clientStatusLabel(c.status)}</p>
            <ul className="space-y-3">
              {(periods[c.id] || []).map((p) => (
                <li key={p.id} data-testid={`mtd-period-${p.id}`}
                  className={`border rounded-lg p-5 ${p.next_action_owner === "CLIENT" ? "border-[#078A4B] bg-[#F6FCF8]" : "border-[#E3E7E4]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs text-[#626A65] mt-1">
                        {d(p.period_start)} – {d(p.period_end)} · due {d(p.deadline)}
                      </div>
                    </div>
                    <span data-testid={`mtd-period-status-${p.id}`}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold ${p.status === "SUBMITTED" ? "bg-[#EAF5EE] text-[#006B3C]" : p.next_action_owner === "CLIENT" ? "bg-[#FFF4E5] text-[#8A5A00]" : "bg-[#F1F8F4] text-[#626A65]"}`}>
                      {p.stage_label}
                    </span>
                  </div>
                  {(p.income !== null || p.expenses !== null) && (
                    <dl className="grid grid-cols-3 gap-4 mt-4 text-sm" data-testid={`mtd-figures-${p.id}`}>
                      <div><dt className="text-xs uppercase text-[#626A65]">Income</dt><dd className="mt-1 font-semibold">{money(p.income)}</dd></div>
                      <div><dt className="text-xs uppercase text-[#626A65]">Expenses</dt><dd className="mt-1 font-semibold">{money(p.expenses)}</dd></div>
                      <div><dt className="text-xs uppercase text-[#626A65]">Profit</dt><dd className="mt-1 font-semibold">{money(p.profit)}</dd></div>
                    </dl>
                  )}
                  {p.figures_note && <p className="text-sm text-[#626A65] mt-3 break-words">{p.figures_note}</p>}
                  <p className="text-xs text-[#626A65] mt-3">Next: {p.next_action}</p>
                  {p.submission_reference && (
                    <p className="text-xs text-[#006B3C] mt-1" data-testid={`mtd-submission-${p.id}`}>
                      Submitted {d(p.submission_date)} · reference {p.submission_reference}
                    </p>
                  )}
                  {p.status === "AWAITING_CLIENT_APPROVAL" && (
                    <button data-testid={`mtd-approve-${p.id}`} disabled={busy === p.id} onClick={() => approve(p)}
                      className="mt-4 px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-50">
                      {busy === p.id ? "Approving…" : "Approve these figures"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
