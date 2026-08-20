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
  const [tasks, setTasks] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    api.get("/cases", { params: { service_type: "MTD_INCOME_TAX" } }).then(({ data }) => setCases(data));
    api.get("/tasks", { params: { service_type: "MTD_INCOME_TAX" } }).then(({ data }) => setTasks(data));
    api.get("/documents", { params: { service_type: "MTD_INCOME_TAX" } }).then(({ data }) => setDocs(data));
  }, []);

  return (
    <AppShell title="MTD for Income Tax" subtitle="Your Making Tax Digital service — separate from your Self Assessment.">
      <div className="space-y-6">
        <Panel title="MTD status" testId="mtd-status-panel">
          {!cases.length && <Empty text="Your MTD service is being set up. Your accountant will be in touch." />}
          <ul className="space-y-3">
            {cases.map((c) => (
              <li key={c.id} data-testid={`mtd-case-${c.case_ref}`} className="border border-[#E3E7E4] rounded-lg p-5 text-sm">
                <div className="font-semibold">{c.case_ref} · {c.tax_year}</div>
                <p className="text-[#626A65] mt-1">{c.current_stage} · {clientStatusLabel(c.status)}</p>
                <p className="text-xs text-[#626A65] mt-1">Next: {c.next_action}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="MTD tasks" testId="mtd-tasks-panel">
          {!tasks.length && <Empty text="No MTD tasks for you right now." />}
          <ul className="space-y-2 text-sm">
            {tasks.map((t) => <li key={t.id} className="text-[#626A65]">{t.name} · {t.status}</li>)}
          </ul>
        </Panel>
        <Panel title="MTD documents" testId="mtd-documents-panel">
          {!docs.length && <Empty text="No MTD documents yet." />}
          <ul className="space-y-2 text-sm">
            {docs.map((x) => <li key={x.id} className="text-[#626A65]">{x.name} · {x.status}</li>)}
          </ul>
        </Panel>
        <Panel title="Quarterly periods" testId="mtd-periods-panel">
          <p className="text-sm text-[#626A65]">
            Quarterly period tracking arrives with the full MTD workflow. Your accountant currently manages your
            quarterly filings and will record each submission here.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
