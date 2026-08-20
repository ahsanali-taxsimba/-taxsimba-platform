import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { api, apiError, d, dt, money } from "@/lib/api";

export default function MyServices() {
  const [data, setData] = useState(null);
  const [upgrade, setUpgrade] = useState(null);
  const [offers, setOffers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/my-services").then(({ data }) => setData(data));
    api.get("/my-upgrade-options").then(({ data }) => setUpgrade(data)).catch(() => {});
    api.get("/my-offers").then(({ data }) => setOffers(data));
    api.get("/my-payments").then(({ data }) => setPayments(data));
  };
  useEffect(() => { load(); }, []);

  const startUpgrade = async (code) => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/payments/upgrade-checkout", { package_code: code, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
      setBusy(false);
    }
  };

  const startOffer = async (offerId) => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/payments/offer-checkout", { offer_id: offerId, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
      setBusy(false);
    }
  };

  const opt = upgrade?.options?.find((o) => o.code === selected);

  return (
    <AppShell title="Subscription" subtitle={data?.client_ref ? `Client ${data.client_ref} · one account, all your services` : "Your TaxSimba services"}>
      <div className="space-y-6">
        <Panel title="My Services" testId="my-services-panel">
          {!data?.services?.length && <Empty text="No services yet." />}
          <ul className="space-y-4">
            {data?.services?.map((s) => (
              <li key={s.id} data-testid={`service-${s.service_type}`} className="border border-[#E3E7E4] rounded-lg p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#161B18]">{s.service_name}</div>
                    <div className="text-sm text-[#626A65] mt-1">
                      {s.status === "ACTIVE"
                        ? `Package: ${s.package_name || "—"}${s.tax_year ? ` · Tax Year: ${s.tax_year}` : ""}`
                        : "Not currently active"}
                    </div>
                  </div>
                  <span data-testid={`service-status-${s.service_type}`} className="px-2.5 py-1 rounded-md text-xs font-bold uppercase"
                    style={{ background: s.status === "ACTIVE" ? "#E9F7EF" : "#F1F3F2", color: s.status === "ACTIVE" ? "#16A05D" : "#626A65" }}>
                    {s.status === "ACTIVE" ? "Active" : "Not Active"}
                  </span>
                </div>
                {s.cases?.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {s.cases.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-[#626A65]">{c.case_ref} · {c.tax_year}</span>
                        <StatusBadge status={c.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        {offers.length > 0 && (
          <Panel title="Recommended for you" testId="offers-panel">
            {offers.map((o) => (
              <div key={o.id} data-testid={`offer-${o.id}`} className="border border-[#16A05D] rounded-lg p-5 mb-4">
                <div className="font-semibold text-[#161B18]">{o.service_name} recommended</div>
                <p className="text-sm text-[#626A65] mt-1">
                  {o.message || "Your accountant believes this service is right for you. Our team has reviewed and approved this recommendation."}
                </p>
                <dl className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 text-sm">
                  <div><dt className="text-xs uppercase text-[#626A65]">Service</dt><dd className="font-semibold">{o.service_name}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Package</dt><dd className="font-semibold">{o.package_name}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Price</dt><dd className="font-semibold">{money(o.price)}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Billing</dt><dd className="font-semibold">{o.billing_frequency}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Credit applied</dt><dd className="font-semibold">{money(o.credit)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <span className="text-sm">Additional amount payable: <b>{money(o.amount_due)}</b></span>
                  <span className="text-sm">Total due now: <b data-testid={`offer-total-${o.id}`}>{money(o.amount_due)}</b></span>
                  <button data-testid={`add-service-btn-${o.id}`} disabled={busy} onClick={() => startOffer(o.id)}
                    className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-60">
                    Add {o.service_name}
                  </button>
                </div>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Self Assessment package" testId="upgrade-panel">
          {!upgrade?.current_package && <Empty text="No active Self Assessment package." />}
          {upgrade?.current_package && (
            <>
              <div className="text-sm">
                Current Package: <b data-testid="current-package">{upgrade.current_package.name}</b> · {money(upgrade.current_package.price)}
              </div>
              {upgrade.is_highest && (
                <p data-testid="highest-package-text" className="text-sm text-[#16A05D] font-semibold mt-3">
                  Current Package — Highest Package
                </p>
              )}
              {upgrade.locked && (
                <p data-testid="package-locked-text" className="text-sm text-[#E6A23C] mt-3">
                  Package changes are closed for this tax year at this stage of your return. {upgrade.lock_reason}. Please message your accountant if you need help.
                </p>
              )}
              {!upgrade.locked && upgrade.options.length > 0 && (
                <div className="mt-5 space-y-3">
                  {upgrade.options.map((o) => (
                    <button key={o.code} data-testid={`upgrade-option-${o.code}`} onClick={() => setSelected(o.code)}
                      className={`w-full text-left border rounded-lg p-4 transition-colors ${selected === o.code ? "border-[#078A4B] bg-[#F1F8F4]" : "border-[#E3E7E4] hover:bg-[#F7F8F7]"}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">Upgrade to {o.name}</span>
                        <span className="text-sm font-semibold">{money(o.upgrade_price)}</span>
                      </div>
                      <div className="text-xs text-[#626A65] mt-1">
                        Current package credit {money(o.current_package_credit)} · additional amount payable {money(o.additional_amount_payable)}
                      </div>
                    </button>
                  ))}
                  {opt && (
                    <div className="border border-[#E3E7E4] rounded-lg p-5 bg-[#F1F8F4]">
                      <dl className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                        <div><dt className="text-xs uppercase text-[#626A65]">Current Package</dt><dd className="font-semibold">{upgrade.current_package.name}</dd></div>
                        <div><dt className="text-xs uppercase text-[#626A65]">New Package</dt><dd className="font-semibold">{opt.name}</dd></div>
                        <div><dt className="text-xs uppercase text-[#626A65]">Current Package Credit</dt><dd className="font-semibold">{money(opt.current_package_credit)}</dd></div>
                        <div><dt className="text-xs uppercase text-[#626A65]">Upgrade Price</dt><dd className="font-semibold">{money(opt.upgrade_price)}</dd></div>
                        <div><dt className="text-xs uppercase text-[#626A65]">Total Due Now</dt><dd data-testid="total-due-now" className="font-bold">{money(opt.total_due_now)}</dd></div>
                      </dl>
                      <button data-testid="upgrade-package-btn" disabled={busy} onClick={() => startUpgrade(opt.code)}
                        className="mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold hover:bg-[#006B3C] transition-colors disabled:opacity-60">
                        Upgrade Package
                      </button>
                    </div>
                  )}
                </div>
              )}
              {err && <p data-testid="upgrade-error" className="text-sm text-[#D64545] mt-3">{err}</p>}
            </>
          )}
        </Panel>

        <Panel title="Payment history" testId="payments-panel">
          {!payments.length && <Empty text="No payments yet." />}
          {payments.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                <th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Change</th>
                <th className="py-3 pr-4">Amount</th><th className="py-3">Status</th></tr></thead>
              <tbody>{payments.map((p) => (
                <tr key={p.id} className="border-b border-[#E3E7E4]">
                  <td className="py-3 pr-4 text-[#626A65]">{d(p.created_at)}</td>
                  <td className="py-3 pr-4">{p.kind === "SA_UPGRADE" ? "Package upgrade" : "Service activation"}</td>
                  <td className="py-3 pr-4 text-[#626A65]">{p.previous_package ? `${p.previous_package} → ` : ""}{p.new_package}</td>
                  <td className="py-3 pr-4 font-semibold">{money(p.amount)}</td>
                  <td className="py-3" style={{ color: p.payment_status === "paid" ? "#16A05D" : "#626A65" }}>{p.payment_status}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [status, setStatus] = useState("checking");
  const sessionId = params.get("session_id");

  useEffect(() => {
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setStatus("paid"); return; }
        if (["expired", "failed"].includes(data.payment_status)) { setStatus("failed"); return; }
      } catch (e) { /* keep polling */ }
      if (tries > 8) { setStatus("pending"); return; }
      setTimeout(poll, 2000);
    };
    if (sessionId) poll(); else setStatus("failed");
  }, [sessionId]);

  return (
    <AppShell title="Payment" subtitle="Confirming your payment with our payment provider">
      <Panel testId="payment-success-panel">
        {status === "checking" && <p className="text-sm text-[#626A65]">Confirming your payment…</p>}
        {status === "paid" && (
          <>
            <p data-testid="payment-paid-text" className="text-sm font-semibold text-[#16A05D]">
              Payment received. Your account has been updated.
            </p>
            <button data-testid="back-to-services-btn" onClick={() => nav("/subscription")}
              className="mt-5 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold">Back to My Services</button>
          </>
        )}
        {status === "pending" && <p className="text-sm text-[#E6A23C]">Payment is still processing. We'll update your services as soon as it clears.</p>}
        {status === "failed" && <p className="text-sm text-[#D64545]">We couldn't confirm this payment. Nothing has been charged twice — please try again from My Services.</p>}
      </Panel>
    </AppShell>
  );
}

export function PaymentCancel() {
  const nav = useNavigate();
  return (
    <AppShell title="Payment cancelled" subtitle="Nothing has been charged">
      <Panel testId="payment-cancel-panel">
        <p className="text-sm text-[#626A65]">Your payment was cancelled. Your services are unchanged.</p>
        <button data-testid="cancel-back-btn" onClick={() => nav("/subscription")}
          className="mt-5 px-5 py-2.5 rounded-lg border border-[#E3E7E4] text-sm font-semibold hover:bg-[#F1F8F4]">Back to My Services</button>
      </Panel>
    </AppShell>
  );
}
