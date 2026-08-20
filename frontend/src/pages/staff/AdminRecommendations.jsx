import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { api, apiError, dt, money } from "@/lib/api";

export default function AdminRecommendations() {
  const [recs, setRecs] = useState([]);
  const [packages, setPackages] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const load = () => {
    api.get("/recommendations").then(({ data }) => setRecs(data));
    api.get("/packages").then(({ data }) => setPackages(data));
  };
  useEffect(() => { load(); }, []);

  const act = async (fn) => {
    setErr("");
    try { await fn(); setModal(null); setForm({}); load(); }
    catch (e) { setErr(apiError(e.response?.data?.detail)); }
  };

  const options = packages.filter((p) => p.service_type === (modal?.service_type || ""));

  return (
    <AppShell title="Service Recommendations" subtitle="Accountant recommendations awaiting admin review.">
      <Panel testId="recommendations-panel">
        {!recs.length && <Empty text="No recommendations yet." />}
        <div className="overflow-x-auto">
          {recs.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#626A65] border-b border-[#E3E7E4]">
                <th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Client</th><th className="py-3 pr-4">Case</th>
                <th className="py-3 pr-4">Recommended</th><th className="py-3 pr-4">Reason</th>
                <th className="py-3 pr-4">Raised by</th><th className="py-3 pr-4">Status</th><th className="py-3">Action</th>
              </tr></thead>
              <tbody>{recs.map((r) => (
                <tr key={r.id} data-testid={`rec-row-${r.id}`} className="border-b border-[#E3E7E4]">
                  <td className="py-4 pr-4 font-semibold">{r.type === "MTD" ? "MTD" : "Package upgrade"}</td>
                  <td className="py-4 pr-4">{r.client_name}</td>
                  <td className="py-4 pr-4">
                    <button className="text-[#078A4B] font-semibold" onClick={() => nav(`/admin/cases/${r.case_id}`)}>{r.case_ref}</button>
                  </td>
                  <td className="py-4 pr-4 text-[#626A65]">{r.recommended_package || "—"}</td>
                  <td className="py-4 pr-4 text-[#626A65] max-w-[220px]">{r.reason}{r.note ? ` · ${r.note}` : ""}</td>
                  <td className="py-4 pr-4 text-[#626A65]">{r.raised_by_name}<div className="text-xs">{dt(r.created_at)}</div></td>
                  <td className="py-4 pr-4">
                    <span className="px-2 py-1 rounded-md text-xs font-semibold"
                      style={{ background: r.status === "PENDING" ? "#FDF3E3" : r.status === "DECLINED" ? "#FBEBEB" : "#E9F7EF",
                               color: r.status === "PENDING" ? "#B77A12" : r.status === "DECLINED" ? "#D64545" : "#16A05D" }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4">
                    {r.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button data-testid={`send-offer-btn-${r.id}`}
                          onClick={() => { setModal(r); setForm({ package_code: r.recommended_package || "", credit: 0 }); }}
                          className="px-3 py-1.5 rounded-lg bg-[#078A4B] text-white text-xs font-semibold">Approve</button>
                        <button data-testid={`decline-rec-btn-${r.id}`}
                          onClick={() => act(() => api.post(`/recommendations/${r.id}/reject`, { reason: "Not required" }))}
                          className="px-3 py-1.5 rounded-lg border border-[#E3E7E4] text-xs font-semibold">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        {err && <p className="text-sm text-[#D64545] mt-3">{err}</p>}
      </Panel>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div data-testid="offer-modal" className="bg-white rounded-xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Approve recommendation & release to client</h3>
            <p className="text-sm text-[#626A65] mb-5">{modal.client_name} · {modal.type === "MTD" ? "MTD for Income Tax" : "Self Assessment upgrade"} — the client will be asked to review it, not charged automatically.</p>
            <div className="space-y-4">
              <select data-testid="offer-package" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                value={form.package_code || ""} onChange={(e) => setForm({ ...form, package_code: e.target.value })}>
                <option value="">Select package</option>
                {options.map((p) => <option key={p.id} value={p.code}>{p.name} — {money(p.price)} ({p.billing_frequency})</option>)}
              </select>
              <div>
                <label className="text-sm font-medium">Price override (optional)</label>
                <input data-testid="offer-price" type="number" className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Credit / discount</label>
                <input data-testid="offer-credit" type="number" className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.credit ?? 0} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
              </div>
              <textarea data-testid="offer-explanation" rows={3} placeholder="Plain-English explanation of why this is recommended (shown to the client)"
                className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                value={form.explanation || ""} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              <textarea data-testid="offer-message" rows={3} placeholder="Message to client"
                className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                value={form.message || ""} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <button data-testid="confirm-offer-btn" disabled={!form.package_code}
                className="w-full px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50"
                onClick={() => act(() => api.post(`/recommendations/${modal.id}/approve`, {
                  package_code: form.package_code,
                  price: form.price !== undefined && form.price !== "" ? Number(form.price) : null,
                  credit: Number(form.credit || 0), message: form.message || null,
                  explanation: form.explanation || null,
                }))}>Approve & release to client</button>
              {err && <p className="text-sm text-[#D64545]">{err}</p>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
