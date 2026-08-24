import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { DocStatusBadge, PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { api, d, dt, money } from "@/lib/api";

const CHECKLIST = [
  ["client_information_reviewed", "Client information reviewed"],
  ["required_documents_reviewed", "Required documents reviewed"],
  ["income_checked", "Income checked"],
  ["allowable_expenses_checked", "Allowable expenses checked"],
  ["tax_calculation_checked", "Tax calculation checked"],
  ["supporting_documents_attached", "Supporting documents attached"],
  ["return_ready", "Return ready for internal review"],
];

const TABS = ["Overview", "Tasks", "Documents", "Messages", "Tax Working", "Internal Notes", "Activity"];

export default function CaseWorkspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role);
  const [tab, setTab] = useState("Overview");
  const [cs, setCs] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [docs, setDocs] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [calcs, setCalcs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [saPackages, setSaPackages] = useState([]);
  const [recs, setRecs] = useState([]);
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({});
  const [checks, setChecks] = useState({});
  const [payReqs, setPayReqs] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/cases/${id}`);
    setCs(data);
    api.get("/tasks", { params: { case_id: id } }).then((r) => setTasks(r.data));
    api.get("/documents", { params: { case_id: id } }).then((r) => setDocs(r.data));
    api.get("/messages", { params: { case_id: id } }).then((r) => setMsgs(r.data));
    api.get(`/cases/${id}/notes`).then((r) => setNotes(r.data));
    api.get(`/cases/${id}/activity`).then((r) => setLogs(r.data));
    api.get(`/cases/${id}/calculations`).then((r) => setCalcs(r.data));
    api.get(`/cases/${id}/reviews`).then((r) => setReviews(r.data));
    api.get(`/cases/${id}/recommendations`).then((r) => setRecs(r.data)).catch(() => {});
    api.get("/packages", { params: { service_type: "SELF_ASSESSMENT" } }).then((r) => setSaPackages(r.data));
    api.get("/payment-requests", { params: { case_id: id } }).then((r) => setPayReqs(r.data)).catch(() => {});
    if (isAdmin) api.get("/accountants/workload").then((r) => setAccountants(r.data));
  };
  useEffect(() => { load(); }, [id]);

  const act = async (fn) => {
    setErr("");
    try {
      await fn();
      setModal(null);
      setForm({});
      await load();
    } catch (e) {
      setErr(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Action failed");
    }
  };

  if (!cs) return <AppShell title="Case"><Empty text="Loading…" /></AppShell>;

  const st = cs.status;
  const latestCalc = calcs[0];
  const pendingReview = reviews.find((r) => !r.outcome);
  const lastReturned = reviews.find((r) => r.outcome === "CHANGES_REQUIRED");

  const btn = "px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors";
  const primary = `${btn} bg-[#078A4B] text-white hover:bg-[#006B3C]`;
  const ghost = `${btn} border border-[#E3E7E4] text-[#161B18] hover:bg-[#F1F8F4]`;

  const accountantActions = user?.role === "ACCOUNTANT" && (
    <div className="flex flex-wrap gap-3">
      {["ASSIGNED", "CHANGES_REQUIRED"].includes(st) && (
        <button data-testid="start-review-btn" className={primary} onClick={() => act(() => api.post(`/cases/${id}/start-review`))}>Start Review</button>
      )}
      {["ACCOUNTANT_REVIEW", "IN_PREPARATION", "AWAITING_CLIENT"].includes(st) && (
        <button data-testid="request-from-client-btn" className={ghost} onClick={() => setModal("request")}>Request from Client</button>
      )}
      {st === "ACCOUNTANT_REVIEW" && (
        <button data-testid="mark-reviewed-btn" className={ghost} onClick={() => act(() => api.post(`/cases/${id}/mark-reviewed`))}>Mark Information Reviewed</button>
      )}
      {["ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"].includes(st) && (
        <button data-testid="prepare-calculation-btn" className={primary} onClick={() => setModal("calc")}>Prepare Calculation</button>
      )}
      {["ACCOUNTANT_REVIEW", "IN_PREPARATION", "CHANGES_REQUIRED"].includes(st) && latestCalc && (
        <button data-testid="submit-admin-review-btn" className={primary} onClick={() => setModal("submit")}>Send to Admin for Review</button>
      )}
      <button data-testid="add-note-btn" className={ghost} onClick={() => setModal("note")}>Add Internal Note</button>
      <button data-testid="recommend-additional-work-btn" className={ghost} onClick={() => setModal("recAddWork")}>Recommend Additional Work</button>
      <button data-testid="recommend-package-btn" className={ghost} onClick={() => setModal("recPackage")}>Recommend Package Upgrade</button>
      <button data-testid="recommend-mtd-btn" className={ghost} onClick={() => setModal("recMtd")}>Recommend MTD</button>
      <label className={`${ghost} cursor-pointer`}>
        Upload Working Document
        <input data-testid="upload-working-doc" type="file" className="hidden" onChange={async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("case_id", id); fd.append("document_type", "Working document");
          fd.append("is_internal", "true"); fd.append("file", file);
          await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
          load();
        }} />
      </label>
    </div>
  );

  const adminActions = isAdmin && (
    <div className="flex flex-wrap gap-3">
      {st === "COMPLETED" ? null : !cs.assigned_accountant_id ? (
        <button data-testid="assign-accountant-btn" className={primary} onClick={() => setModal("assign")}>Assign Accountant</button>
      ) : (
        <>
          <button data-testid="reassign-accountant-btn" className={ghost} onClick={() => setModal("assign")}>Reassign Accountant</button>
          <button data-testid="unassign-accountant-btn" className={ghost} onClick={() => setModal("unassign")}>Unassign</button>
        </>
      )}
      {st === "COMPLETED" && (
        <button data-testid="reopen-case-btn" className={ghost} onClick={() => setModal("reopen")}>Reopen Case</button>
      )}
      {["READY_FOR_ADMIN_REVIEW", "ADMIN_REVIEW"].includes(st) && (
        <>
          <button data-testid="admin-approve-btn" className={primary} onClick={() => setModal("approve")}>Approve</button>
          <button data-testid="admin-return-btn" className={`${btn} bg-[#D64545] text-white hover:opacity-90`} onClick={() => setModal("return")}>Return for Changes</button>
        </>
      )}
      {st !== "COMPLETED" && (
        <button data-testid="request-additional-payment-btn" className={ghost} onClick={() => setModal("addpay")}>Request Additional Payment</button>
      )}
      {st !== "COMPLETED" && (
        <button data-testid="admin-request-btn" className={ghost} onClick={() => setModal("request")}>Request from Client</button>
      )}
      <button data-testid="add-note-btn" className={ghost} onClick={() => setModal("note")}>Add Internal Note</button>
      {st === "READY_FOR_SUBMISSION" && (
        <button data-testid="record-submission-btn" className={primary} onClick={() => setModal("submission")}>Record Submission</button>
      )}
      {st === "SUBMITTED" && (
        <button data-testid="mark-completed-btn" className={primary} onClick={() => setModal("complete")}>Mark Completed</button>
      )}
    </div>
  );

  return (
    <AppShell title={cs.client_name} subtitle={`${cs.case_ref} · Self Assessment ${cs.tax_year}`}>
      <div className="space-y-6">
        <Panel testId="case-header">
          <div className="flex flex-wrap gap-8 items-start justify-between">
            <dl className="grid grid-cols-2 md:grid-cols-5 gap-6 text-sm flex-1">
              <div><dt className="text-xs uppercase text-[#626A65]">Priority</dt><dd className="mt-1"><PriorityBadge priority={cs.priority} /></dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Stage</dt><dd className="mt-1 font-semibold">{cs.current_stage}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Status</dt><dd className="mt-1"><StatusBadge status={cs.status} /></dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Internal Deadline</dt><dd className="mt-1 font-semibold">{d(cs.internal_deadline)} ({cs.days_left}d)</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Accountant</dt><dd className="mt-1 font-semibold">{cs.assigned_accountant_name || "Unassigned"}</dd></div>
            </dl>
          </div>
          <div className="mt-6 pt-6 border-t border-[#E3E7E4]">{accountantActions}{adminActions}</div>
          {err && <p data-testid="workspace-error" className="text-sm text-[#D64545] mt-3">{err}</p>}
        </Panel>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t} data-testid={`case-tab-${t.toLowerCase().replace(/ /g, "-")}`} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-[#EAF5EE] text-[#006B3C]" : "border border-[#E3E7E4] text-[#626A65] hover:bg-[#F1F8F4]"}`}>{t}</button>
          ))}
        </div>

        {tab === "Overview" && (
          <Panel title="Overview" testId="tab-overview">
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
              <div><dt className="text-xs uppercase text-[#626A65]">Next Action</dt><dd className="mt-1">{cs.next_action}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Next Action Owner</dt><dd className="mt-1 font-semibold">{cs.next_action_owner}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Waiting Reason</dt><dd className="mt-1">{cs.waiting_reason || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">HMRC Deadline</dt><dd className="mt-1">{d(cs.external_deadline)}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Admin Reviewer</dt><dd className="mt-1">{cs.admin_reviewer_name || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Internal Instructions</dt><dd className="mt-1">{cs.internal_instructions || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Admin Approved</dt><dd className="mt-1">{cs.admin_approved_by ? `${cs.admin_approved_by} · ${dt(cs.admin_approved_at)}` : "—"}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Submission</dt><dd className="mt-1" data-testid="overview-submission">{cs.submission_reference ? `${cs.submission_reference} · ${cs.submission_date} · by ${cs.submitted_by_name}` : "—"}</dd></div>
              <div><dt className="text-xs uppercase text-[#626A65]">Completed</dt><dd className="mt-1">{cs.completed_by_name ? `${cs.completed_by_name} · ${dt(cs.completed_at)}` : "—"}</dd></div>
            </dl>
            {recs.length > 0 && (
              <div className="mt-6 border border-[#E3E7E4] rounded-lg p-5" data-testid="overview-recommendations">
                <div className="text-sm font-semibold mb-2">Service recommendations</div>
                <ul className="text-sm text-[#626A65] space-y-1">
                  {recs.map((r) => (
                    <li key={r.id} data-testid={`rec-${r.id}`} className="flex flex-wrap items-center gap-3">
                      <span>
                        {r.type === "MTD" ? "MTD" : r.type === "ADDITIONAL_WORK"
                          ? `Additional work recommended by ${r.raised_by_name}${r.suggested_amount ? ` · suggested £${Number(r.suggested_amount).toFixed(2)}` : ""}`
                          : `Package upgrade → ${r.recommended_package}`} · {r.reason} · <b>{r.status}</b>
                        {r.final_amount ? ` · sent at £${Number(r.final_amount).toFixed(2)}` : ""}
                      </span>
                      {isAdmin && r.type === "ADDITIONAL_WORK" && r.status === "PENDING" && (
                        <>
                          <button data-testid={`rec-approve-${r.id}`} className="text-xs font-semibold text-[#006B3C]"
                            onClick={() => { setForm({ description: r.reason, amount: r.suggested_amount || "", recommendation_id: r.id }); setModal("addpay"); }}>
                            Approve &amp; send charge
                          </button>
                          <button data-testid={`rec-decline-${r.id}`} className="text-xs font-semibold text-[#D64545]"
                            onClick={() => {
                              const reason = window.prompt("Internal reason for declining (optional)") ?? null;
                              act(() => api.post(`/recommendations/${r.id}/decline`, { reason: reason || "Declined" }));
                            }}>Decline</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {payReqs.length > 0 && (
              <div className="mt-6 border border-[#E3E7E4] rounded-lg p-5" data-testid="overview-payment-requests">
                <div className="text-sm font-semibold mb-2">Additional work payment requests</div>
                <ul className="text-sm space-y-2">
                  {payReqs.map((p) => (
                    <li key={p.id} data-testid={`case-payreq-${p.id}`} className="flex flex-wrap items-center gap-3">
                      <span>{p.description} · <b>£{Number(p.amount).toFixed(2)}</b> · <b>{p.payment_status === "paid" ? "Paid" : p.payment_status}</b>
                        {p.due_date ? ` · due ${d(p.due_date)}` : ""} · raised by {p.created_by_name}</span>
                      {p.payment_status === "paid" && p.receipt_number && (
                        <a data-testid={`payreq-receipt-${p.id}`} target="_blank" rel="noopener noreferrer"
                          href={`${process.env.REACT_APP_BACKEND_URL}/api/payment-requests/${p.id}/receipt`}
                          className="text-xs font-semibold text-[#006B3C]">Receipt {p.receipt_number}</a>
                      )}
                      {isAdmin && p.payment_status !== "paid" && p.payment_status !== "cancelled" && (
                        <>
                          <button data-testid={`payreq-resend-${p.id}`} className="text-xs font-semibold text-[#006B3C]"
                            onClick={() => act(() => api.post(`/payment-requests/${p.id}/resend`))}>Resend</button>
                          <button data-testid={`payreq-cancel-${p.id}`} className="text-xs font-semibold text-[#D64545]"
                            onClick={() => window.confirm("Cancel this unpaid payment request? It stays in the audit history.") && act(() => api.post(`/payment-requests/${p.id}/cancel`))}>Cancel</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="rounded-lg bg-[#F1F8F4] p-5">
                <div className="text-sm font-semibold mb-2">Missing items</div>
                {tasks.filter((t) => t.status === "OPEN").length === 0
                  ? <p className="text-sm text-[#626A65]">Nothing outstanding.</p>
                  : <ul className="text-sm text-[#626A65] list-disc pl-5 space-y-1">{tasks.filter((t) => t.status === "OPEN").map((t) => <li key={t.id}>{t.name} ({t.owner_role})</li>)}</ul>}
              </div>
              {lastReturned && (
                <div className="rounded-lg p-5" style={{ background: "#FBEBEB" }} data-testid="admin-changes-alert">
                  <div className="text-sm font-semibold text-[#D64545] mb-1">Admin returned changes</div>
                  <p className="text-sm text-[#161B18]">{lastReturned.reason}</p>
                  <p className="text-sm text-[#626A65] mt-1">{lastReturned.instructions}</p>
                </div>
              )}
            </div>
          </Panel>
        )}

        {tab === "Tasks" && (
          <Panel title="Tasks" testId="tab-tasks">
            {!tasks.length && <Empty text="No tasks yet." />}
            <ul className="space-y-3">{tasks.map((t) => (
              <li key={t.id} data-testid={`case-task-${t.id}`} className="border border-[#E3E7E4] rounded-lg p-4 flex justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <p className="text-sm text-[#626A65]">{t.description}</p>
                  <p className="text-xs text-[#626A65] mt-1">
                    Case {t.case_ref || cs?.case_ref}{(t.tax_year || cs?.tax_year) ? ` · ${t.tax_year || cs.tax_year}` : ""}
                  </p>
                  <p className="text-xs text-[#626A65] mt-1">Owner: {t.owner_role} · Due {d(t.due_date)} · Created by {t.created_by_name} {d(t.created_at)}</p>
                </div>
                <div className="text-xs font-semibold" style={{ color: t.status === "COMPLETED" ? "#16A05D" : "#E6A23C" }}>
                  {t.status === "COMPLETED" ? `Completed ${d(t.completed_date)}` : "Open"}
                  {t.status === "OPEN" && t.owner_role === "ACCOUNTANT" && (
                    <button data-testid={`complete-acc-task-${t.id}`} className="block mt-2 text-[#078A4B]"
                      onClick={() => act(() => api.post(`/tasks/${t.id}/complete`))}>Mark done</button>
                  )}
                </div>
              </li>
            ))}</ul>
          </Panel>
        )}

        {tab === "Documents" && (
          <Panel title="Documents" testId="tab-documents">
            {!docs.length && <Empty text="No documents yet." />}
            <table className="w-full text-sm">
              <tbody>{docs.map((doc) => (
                <tr key={doc.id} data-testid={`case-doc-${doc.id}`} className="border-b border-[#E3E7E4]">
                  <td className="py-4 pr-4 font-semibold">{doc.name}{doc.is_internal && <span className="ml-2 text-[11px] text-[#7656C9]">Internal</span>}</td>
                  <td className="py-4 pr-4 text-[#626A65]">{doc.document_type}</td>
                  <td className="py-4 pr-4 text-[#626A65]">{doc.uploader_name || "—"} {doc.upload_date ? `· ${d(doc.upload_date)}` : ""}</td>
                  <td className="py-4 pr-4"><DocStatusBadge status={doc.status} /></td>
                  <td className="py-4 pr-4">
                    <select data-testid={`doc-status-${doc.id}`} value={doc.status}
                      onChange={(e) => act(() => api.patch(`/documents/${doc.id}/status`, null, { params: { status: e.target.value } }))}
                      className="rounded-lg border border-[#E3E7E4] px-2 py-1 text-xs">
                      {["Requested", "Uploaded", "Under Review", "Accepted", "Replacement Required", "Final"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-4">{doc.storage_path && <a className="text-xs font-semibold text-[#078A4B]" target="_blank" rel="noreferrer"
                    href={`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download`}>View</a>}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
        )}

        {tab === "Messages" && (
          <Panel title="Client messages" testId="tab-messages">
            <div className="space-y-3 max-h-96 overflow-y-auto mb-5">
              {!msgs.length && <Empty text="No messages yet." />}
              {msgs.map((m) => (
                <div key={m.id} className="border border-[#E3E7E4] rounded-lg p-4">
                  <div className="text-xs font-semibold text-[#006B3C]">{m.sender_name} · {m.sender_role}</div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{m.body}</p>
                  <div className="text-[11px] text-[#626A65] mt-1">{dt(m.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <input data-testid="staff-message-input" value={form.msg || ""} onChange={(e) => setForm({ ...form, msg: e.target.value })}
                placeholder="Message the client…" className="flex-1 rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm" />
              <button data-testid="staff-send-message-btn" className={primary}
                onClick={() => act(async () => { await api.post("/messages", { case_id: id, body: form.msg }); setForm({}); })}>Send</button>
            </div>
          </Panel>
        )}

        {tab === "Tax Working" && (
          <Panel title="Tax working — internal only" testId="tab-tax-working">
            {!calcs.length && <Empty text="No calculation versions yet." />}
            <ul className="space-y-4">{calcs.map((c) => (
              <li key={c.id} data-testid={`calc-version-${c.version}`} className="border border-[#E3E7E4] rounded-lg p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold">Calculation Version {c.version}</div>
                  <div className="flex gap-2 text-xs">
                    {c.is_locked && <span className="px-2 py-1 rounded-md bg-[#F1F3F2] text-[#626A65] font-semibold">Locked</span>}
                    {c.is_approved && <span className="px-2 py-1 rounded-md bg-[#E9F7EF] text-[#16A05D] font-semibold">Admin approved</span>}
                  </div>
                </div>
                <dl className="grid sm:grid-cols-4 gap-4 mt-4 text-sm">
                  <div><dt className="text-xs uppercase text-[#626A65]">Total income</dt><dd className="font-semibold">{money(c.total_income)}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Taxable income</dt><dd className="font-semibold">{money(c.taxable_income)}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">{c.is_refund ? "Refund" : "Tax due"}</dt><dd className="font-semibold">{money(c.tax_due)}</dd></div>
                  <div><dt className="text-xs uppercase text-[#626A65]">Created</dt><dd className="text-[#626A65]">{c.created_by_name} · {d(c.created_at)}</dd></div>
                </dl>
                {c.notes && <p className="text-sm text-[#626A65] mt-3">{c.notes}</p>}
              </li>
            ))}</ul>
            {reviews.length > 0 && (
              <div className="mt-6">
                <div className="text-sm font-semibold mb-3">Review history</div>
                <ul className="space-y-2 text-sm">{reviews.map((r) => (
                  <li key={r.id} className="text-[#626A65]">
                    V{r.version} submitted by {r.submitted_by_name} {dt(r.submitted_at)} —{" "}
                    <b style={{ color: r.outcome === "APPROVED" ? "#16A05D" : r.outcome ? "#D64545" : "#7656C9" }}>{r.outcome || "PENDING ADMIN REVIEW"}</b>
                    {r.reason && ` · ${r.reason}`}
                  </li>
                ))}</ul>
              </div>
            )}
          </Panel>
        )}

        {tab === "Internal Notes" && (
          <Panel title="Internal notes — Internal – Client cannot see this" testId="tab-internal-notes">
            <p className="text-xs font-semibold text-[#7656C9] mb-4" data-testid="internal-notes-warning">
              Internal – Client cannot see this
            </p>
            {!notes.length && <Empty text="No internal notes yet." />}
            <ul className="space-y-3">{notes.map((n) => (
              <li key={n.id} className="border border-[#E3E7E4] rounded-lg p-4">
                <p className="text-sm">{n.body}</p>
                <div className="text-xs text-[#626A65] mt-1">{n.author_name} ({n.author_role}) · {dt(n.created_at)}</div>
              </li>
            ))}</ul>
          </Panel>
        )}

        {tab === "Activity" && (
          <Panel title="Activity timeline" testId="tab-activity">
            <ul className="space-y-4">{logs.map((l) => (
              <li key={l.id} data-testid={`activity-${l.id}`} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-[#078A4B] mt-2 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">{l.action}</div>
                  <div className="text-xs text-[#626A65]">{l.user_name} · {l.role} · {dt(l.created_at)}</div>
                </div>
              </li>
            ))}</ul>
          </Panel>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()} data-testid={`modal-${modal}`}>
            {modal === "recAddWork" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Recommend Additional Work</h3>
                <p className="text-xs text-[#626A65] mb-5">
                  Internal only. Admin sets the final price and sends any charge — the client sees
                  nothing until then.
                </p>
                <div className="space-y-4">
                  <textarea data-testid="recwork-reason" rows={3} placeholder="Description / reason for the additional work"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                  <input data-testid="recwork-amount" type="number" min="0" step="0.01" placeholder="Suggested amount (£, optional)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.suggested_amount || ""} onChange={(e) => setForm({ ...form, suggested_amount: e.target.value })} />
                  <textarea data-testid="recwork-note" rows={2} placeholder="Internal note (optional)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  <button data-testid="recwork-send-btn" disabled={!form.reason} className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => act(() => api.post(`/cases/${id}/recommend-additional-work`, {
                      reason: form.reason, note: form.note || null,
                      suggested_amount: form.suggested_amount ? Number(form.suggested_amount) : null,
                    }))}>Send recommendation to Admin</button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}
            {modal === "addpay" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Request Additional Payment</h3>
                <p className="text-xs text-[#626A65] mb-5">
                  {cs.client_name} · {cs.case_ref} · {cs.tax_year}. VAT is applied by the existing
                  TaxSimba payment configuration at checkout.
                </p>
                <div className="space-y-4">
                  <textarea data-testid="addpay-description" rows={3} placeholder="Description of additional work (shown to the client)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <input data-testid="addpay-amount" type="number" min="0" step="0.01" placeholder="Amount (£)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  <input data-testid="addpay-due-date" type="date" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  <textarea data-testid="addpay-note" rows={2} placeholder="Internal note (optional, not shown to the client)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.internal_note || ""} onChange={(e) => setForm({ ...form, internal_note: e.target.value })} />
                  <button data-testid="addpay-send-btn" disabled={!form.description || !form.amount}
                    className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => {
                      if (!window.confirm(`Send a payment request of £${Number(form.amount).toFixed(2)} to ${cs.client_name} for: ${form.description}?`)) return;
                      act(() => api.post("/payment-requests", {
                        case_id: id, description: form.description, amount: Number(form.amount),
                        due_date: form.due_date || null, internal_note: form.internal_note || null,
                        recommendation_id: form.recommendation_id || null,
                      }));
                    }}>Send payment request</button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}
            {modal === "request" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Request from Client</h3>
                <div className="space-y-4">
                  <select data-testid="request-type" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.request_type || "DOCUMENT"} onChange={(e) => setForm({ ...form, request_type: e.target.value })}>
                    <option value="DOCUMENT">Document</option><option value="INFORMATION">Information</option><option value="QUESTION">Question</option>
                  </select>
                  <input data-testid="request-title" placeholder="Title (e.g. Upload bank statements)" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <textarea data-testid="request-description" rows={3} placeholder="Description" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <input data-testid="request-doc-required" type="checkbox" checked={form.document_required !== false}
                      onChange={(e) => setForm({ ...form, document_required: e.target.checked })} /> Document required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input data-testid="request-mandatory" type="checkbox" checked={!!form.mandatory}
                      onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} /> Mandatory for submission
                  </label>
                  <input data-testid="request-due-date" type="date" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  <textarea data-testid="request-message" rows={2} placeholder="Message to client" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.message || ""} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  <button data-testid="send-request-btn" className={`${primary} w-full`} onClick={() => act(() => api.post(`/cases/${id}/request-from-client`, {
                    request_type: form.request_type || "DOCUMENT", title: form.title, description: form.description || "",
                    document_required: form.document_required !== false,
                    mandatory: !!form.mandatory,
                    due_date: form.due_date ? new Date(form.due_date).toISOString() : null, message: form.message || "",
                  }))}>Send Request</button>
                </div>
              </>
            )}

            {modal === "calc" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Prepare Calculation (new version)</h3>
                <div className="space-y-4">
                  {[["total_income", "Total income"], ["taxable_income", "Taxable income"], ["tax_due", "Tax due / refund amount"]].map(([k, l]) => (
                    <div key={k}>
                      <label className="text-sm font-medium">{l}</label>
                      <input data-testid={`calc-${k}`} type="number" className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                        value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-sm">
                    <input data-testid="calc-is-refund" type="checkbox" checked={!!form.is_refund}
                      onChange={(e) => setForm({ ...form, is_refund: e.target.checked })} /> This is a refund
                  </label>
                  <textarea data-testid="calc-notes" rows={3} placeholder="Summary for the client" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  <button data-testid="save-calculation-btn" className={`${primary} w-full`} onClick={() => act(() => api.post(`/cases/${id}/calculations`, {
                    total_income: Number(form.total_income || 0), taxable_income: Number(form.taxable_income || 0),
                    tax_due: Number(form.tax_due || 0), is_refund: !!form.is_refund, notes: form.notes || "",
                  }))}>Create Version</button>
                </div>
              </>
            )}

            {modal === "submit" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Submit for Admin Review</h3>
                <p className="text-sm text-[#626A65] mb-5">Submitting Calculation V{latestCalc?.version}. Confirm each item.</p>
                <div className="space-y-3">
                  {CHECKLIST.map(([k, l]) => (
                    <label key={k} className="flex items-center gap-3 text-sm">
                      <input data-testid={`check-${k}`} type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
                      {l}
                    </label>
                  ))}
                  <textarea data-testid="submit-admin-note" rows={3} placeholder="Internal note for Admin (optional)"
                    className="w-full mt-2 rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.admin_note || ""} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} />
                  <button data-testid="confirm-submit-review-btn" className={`${primary} w-full mt-4`}
                    onClick={() => act(() => api.post(`/cases/${id}/submit-for-admin-review`, { calculation_version_id: latestCalc.id, checklist: checks, admin_note: form.admin_note || null }))}>
                    Send to Admin for Review
                  </button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}

            {modal === "note" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Add Internal Note</h3>
                <textarea data-testid="note-body" rows={4} className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                <button data-testid="save-note-btn" className={`${primary} w-full mt-4`}
                  onClick={() => act(() => api.post(`/cases/${id}/notes`, { body: form.body }))}>Save note</button>
              </>
            )}

            {modal === "return" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Return for Changes</h3>
                <input data-testid="return-reason" placeholder="Reason" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <textarea data-testid="return-instructions" rows={4} placeholder="Instructions for the accountant"
                  className="w-full mt-4 rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.instructions || ""} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                <button data-testid="confirm-return-btn" className={`${btn} bg-[#D64545] text-white w-full mt-4`}
                  onClick={() => act(() => api.post(`/cases/${id}/admin-return`, { reason: form.reason, instructions: form.instructions }))}>
                  Return for Changes
                </button>
              </>
            )}

            {modal === "unassign" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Unassign Accountant</h3>
                <p className="text-sm text-[#626A65] mb-5">All work, notes and history are preserved. The case returns to the unassigned queue.</p>
                <input data-testid="unassign-reason" placeholder="Reason" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <button data-testid="confirm-unassign-btn" disabled={!form.reason} className={`${primary} w-full mt-4 disabled:opacity-50`}
                  onClick={() => act(() => api.post(`/cases/${id}/unassign`, { reason: form.reason }))}>Unassign</button>
              </>
            )}

            {modal === "reopen" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Reopen Completed Case</h3>
                <p className="text-sm text-[#626A65] mb-5">A reason is required and this is recorded in the audit trail.</p>
                <input data-testid="reopen-reason" placeholder="Reason" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <button data-testid="confirm-reopen-btn" disabled={!form.reason} className={`${primary} w-full mt-4 disabled:opacity-50`}
                  onClick={() => act(() => api.post(`/cases/${id}/reopen`, { reason: form.reason }))}>Reopen Case</button>
              </>
            )}

            {modal === "recPackage" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Recommend Package Upgrade</h3>
                <p className="text-sm text-[#626A65] mb-5">Admin reviews this before anything is offered to the client. You cannot change packages or prices.</p>
                <div className="space-y-4">
                  <select data-testid="rec-package-select" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.recommended_package || ""} onChange={(e) => setForm({ ...form, recommended_package: e.target.value })}>
                    <option value="">Select recommended package</option>
                    {saPackages.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
                  </select>
                  <select data-testid="rec-package-reason" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                    <option value="">Select reason</option>
                    <option>Rental income requires a higher package</option>
                    <option>Self-employment accounts required</option>
                    <option>Capital gains reporting required</option>
                    <option>Multiple income sources</option>
                    <option>Complex expenses review required</option>
                  </select>
                  <textarea data-testid="rec-package-note" rows={3} placeholder="Internal note for Admin"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  <button data-testid="send-package-rec-btn" disabled={!form.recommended_package || !form.reason}
                    className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => act(() => api.post(`/cases/${id}/recommend-package`, {
                      recommended_package: form.recommended_package, reason: form.reason, note: form.note || null,
                    }))}>Send recommendation to Admin</button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}

            {modal === "recMtd" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Recommend MTD</h3>
                <p className="text-sm text-[#626A65] mb-5">Admin selects the MTD package, price and activation. You cannot activate MTD or take payment.</p>
                <div className="space-y-4">
                  <select data-testid="rec-mtd-reason" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                    <option value="">Select reason</option>
                    <option>Turnover above the MTD threshold</option>
                    <option>Rental income requires quarterly reporting</option>
                    <option>Self-employment requires quarterly reporting</option>
                    <option>Client would benefit from quarterly bookkeeping</option>
                  </select>
                  <textarea data-testid="rec-mtd-note" rows={3} placeholder="Internal note for Admin"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  <button data-testid="send-mtd-rec-btn" disabled={!form.reason}
                    className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => act(() => api.post(`/cases/${id}/recommend-mtd`, {
                      reason: form.reason, note: form.note || null,
                    }))}>Send recommendation to Admin</button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}

            {modal === "approve" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Approve Calculation</h3>
                <p className="text-sm text-[#626A65] mb-5">Approving releases V{latestCalc?.version} to the client for final review.</p>
                <textarea data-testid="approve-note" rows={3} placeholder="Admin note (optional)"
                  className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <button data-testid="confirm-approve-btn" className={`${primary} w-full mt-4`}
                  onClick={() => act(() => api.post(`/cases/${id}/admin-approve`, { note: form.note || null }))}>Approve</button>
              </>
            )}

            {modal === "submission" && (
              <>
                <h3 className="text-lg font-semibold mb-2">Record Submission</h3>
                <p className="text-sm text-[#626A65] mb-5">Only available once Admin approval and Client approval are both complete.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Submission date</label>
                    <input data-testid="submission-date" type="date" className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                      value={form.submission_date || ""} onChange={(e) => setForm({ ...form, submission_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">HMRC / filing software submission reference</label>
                    <p className="text-xs text-[#626A65] mt-1">
                      Enter the submission reference provided by the third-party tax software after
                      filing. Do not enter the TaxSimba case ID.
                    </p>
                    <input data-testid="submission-reference" placeholder="Reference from your filing software (not the TaxSimba case ID)"
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                      value={form.submission_reference || ""} onChange={(e) => setForm({ ...form, submission_reference: e.target.value })} />
                  </div>
                  <textarea data-testid="submission-note" rows={3} placeholder="Internal note (optional)"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  <button data-testid="confirm-submission-btn" disabled={!form.submission_date || !form.submission_reference}
                    className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => act(() => api.post(`/cases/${id}/record-submission`, {
                      submission_date: form.submission_date, submission_reference: form.submission_reference,
                      note: form.note || null,
                    }))}>Record Submission</button>
                  {err && <p className="text-sm text-[#D64545]">{err}</p>}
                </div>
              </>
            )}

            {modal === "complete" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Mark Case Completed</h3>
                <textarea data-testid="complete-note" rows={3} placeholder="Completion note (optional)"
                  className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                  value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <button data-testid="confirm-complete-btn" className={`${primary} w-full mt-4`}
                  onClick={() => act(() => api.post(`/cases/${id}/complete`, { note: form.note || null }))}>Mark Completed</button>
              </>
            )}

            {modal === "assign" && (
              <>
                <h3 className="text-lg font-semibold mb-5">Assignment Centre</h3>
                <div className="space-y-3">
                  {accountants.map((a) => (
                    <button key={a.id} data-testid={`select-accountant-${a.id}`} onClick={() => setForm({ ...form, accountant_id: a.id })}
                      className={`w-full text-left border rounded-lg p-4 transition-colors ${form.accountant_id === a.id ? "border-[#078A4B] bg-[#F1F8F4]" : "border-[#E3E7E4] hover:bg-[#F7F8F7]"}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">{a.name}</span>
                        <span className="text-xs font-semibold" style={{ color: a.availability === "Available" ? "#16A05D" : "#D64545" }}>{a.availability}</span>
                      </div>
                      <div className="text-xs text-[#626A65] mt-1">
                        Active {a.active_cases} · Waiting client {a.waiting_client} · Due this week {a.due_this_week} · Overdue {a.overdue}
                      </div>
                    </button>
                  ))}
                  <select data-testid="assign-priority" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.priority || "MEDIUM"} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="HIGH">High priority</option><option value="MEDIUM">Medium priority</option><option value="LOW">Low priority</option>
                  </select>
                  <input data-testid="assign-deadline" type="date" className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.deadline || ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  <textarea data-testid="assign-instructions" rows={3} placeholder="Internal instructions"
                    className="w-full rounded-lg border border-[#E3E7E4] px-3 py-2.5 text-sm"
                    value={form.instructions || ""} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                  <button data-testid="confirm-assign-btn" disabled={!form.accountant_id} className={`${primary} w-full disabled:opacity-50`}
                    onClick={() => act(() => api.post(`/cases/${id}/assign`, {
                      accountant_id: form.accountant_id, priority: form.priority || "MEDIUM",
                      internal_deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
                      internal_instructions: form.instructions || null,
                    }))}>Assign Case</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
