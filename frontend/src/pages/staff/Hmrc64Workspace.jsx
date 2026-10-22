/**
 * Pre-check → generate → preview → send HMRC 64-8 (staff only).
 * Clients never land here — they only receive the e-sign link.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Empty, Panel } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, dt } from "@/lib/api";

const FIELD_LABELS = [
  ["client_full_name", "Full name"],
  ["address_line_1", "Address line 1"],
  ["address_line_2", "Address line 2"],
  ["address_line_3", "Address line 3 / town"],
  ["address_postcode", "Postcode"],
  ["date_of_birth", "Date of birth"],
  ["ni_number", "NI number"],
  ["utr", "UTR"],
  ["business_name", "Business name"],
  ["business_utr", "Business UTR"],
  ["vat_registration_number", "VAT number"],
  ["company_registration_number", "Company number"],
];

export default function Hmrc64Workspace() {
  const { clientId, formId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const base = user?.role === "ACCOUNTANT" ? "/work/hmrc64" : "/admin/hmrc64";
  const [precheck, setPrecheck] = useState(null);
  const [fields, setFields] = useState({});
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState("");

  const loadPrecheck = async (id) => {
    const { data } = await api.get(`/hmrc64/clients/${id}/precheck`);
    setPrecheck(data);
    setFields(data.fields || {});
  };

  const loadForm = async (id) => {
    const { data } = await api.get(`/hmrc64/forms/${id}`);
    setForm(data);
    setFields(data.fill_fields || {});
    if (data.client_id) {
      const { data: pc } = await api.get(`/hmrc64/clients/${data.client_id}/precheck`);
      setPrecheck(pc);
    }
  };

  useEffect(() => {
    setErr("");
    if (formId) {
      loadForm(formId).catch((e) => setErr(apiError(e.response?.data?.detail)));
    } else if (clientId) {
      loadPrecheck(clientId).catch((e) => setErr(apiError(e.response?.data?.detail)));
    }
  }, [clientId, formId]);

  const generate = async () => {
    setBusy(true);
    setErr("");
    try {
      const id = clientId || form?.client_id;
      // Client boxes only — never send agent_* (structure / agent identity are locked).
      const clientOverrides = {};
      for (const [key] of FIELD_LABELS) {
        if (fields[key] != null) clientOverrides[key] = fields[key];
      }
      const { data } = await api.post(`/hmrc64/clients/${id}/generate`, {
        case_id: caseId || null,
        overrides: clientOverrides,
      });
      setForm(data);
      nav(`${base}/${data.id}`, { replace: true });
    } catch (e) {
      const d = e.response?.data?.detail;
      setErr(apiError(d?.message || d) || "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!form?.id) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post(`/hmrc64/forms/${form.id}/send`, {});
      setForm(data);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!form?.id) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post(`/hmrc64/forms/${form.id}/resend`, {});
      setForm(data);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Resend failed");
    } finally {
      setBusy(false);
    }
  };

  const status = form?.status || "NOT_STARTED";

  return (
    <AppShell
      title="HMRC 64-8"
      subtitle="Fill client details only — official HMRC 64-8 structure stays locked"
    >
      <div className="mb-4">
        <Link to={base} className="text-sm font-semibold text-[#006B3C]">
          ← Back to 64-8 dashboard
        </Link>
      </div>

      <div
        className="mb-4 rounded-lg border border-[#E3E7E4] bg-[#F7F8F7] px-3 py-2.5 text-xs text-[#161B18]"
        data-testid="hmrc64-structure-lock-banner"
      >
        <strong className="text-[#006B3C]">Official form locked. </strong>
        Only client details are completed into the HMRC 64-8 boxes. The form structure and HMRC
        labels are not changed (changing them risks HMRC rejection). Agent details come from
        Taxsimba Group Ltd firm settings and are not editable here.
      </div>

      {err && (
        <p className="text-sm text-[#D64545] mb-4" data-testid="hmrc64-error">
          {err}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Client details to insert" testId="hmrc64-precheck">
          {!precheck && !form && <Empty text="Loading client details…" />}
          {precheck && (
            <>
              <p className="text-xs text-[#626A65] mb-4">
                Correct missing client details before generating. You cannot edit the 64-8 layout or
                agent boxes.
              </p>
              {precheck.missing?.length > 0 && (
                <div className="mb-3 text-xs text-[#D64545] bg-[#FDECEC] rounded-lg px-3 py-2">
                  Missing: {precheck.missing.join(", ")}
                </div>
              )}
              {precheck.warnings?.length > 0 && (
                <div className="mb-3 text-xs text-[#B77A12] bg-[#FDF3E3] rounded-lg px-3 py-2">
                  {precheck.warnings.join(" · ")}
                </div>
              )}
              <div className="space-y-3">
                {FIELD_LABELS.map(([key, label]) => (
                  <label key={key} className="block text-xs font-semibold text-[#626A65]">
                    {label}
                    <input
                      data-testid={`hmrc64-field-${key}`}
                      value={fields[key] || ""}
                      disabled={["SENT", "SIGNED"].includes(status)}
                      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm font-normal text-[#161B18] disabled:bg-[#F7F8F7]"
                    />
                  </label>
                ))}
                <label className="block text-xs font-semibold text-[#626A65]">
                  Link to case (optional)
                  <input
                    data-testid="hmrc64-case-id"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    placeholder="Case id"
                    disabled={Boolean(form?.id)}
                    className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm font-normal"
                  />
                </label>
              </div>

              <div
                className="mt-5 rounded-lg border border-[#E3E7E4] bg-[#F7F8F7] px-3 py-3"
                data-testid="hmrc64-agent-readonly"
              >
                <div className="text-xs font-semibold text-[#161B18] mb-2">
                  Agent details (locked — Taxsimba Group Ltd)
                </div>
                <dl className="grid sm:grid-cols-2 gap-2 text-xs text-[#626A65]">
                  <div>
                    <dt>Agent / firm name</dt>
                    <dd className="font-semibold text-[#161B18]">{fields.agent_name || "—"}</dd>
                  </div>
                  <div>
                    <dt>Agent reference</dt>
                    <dd className="font-semibold text-[#161B18]">{fields.agent_reference || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt>Agent address</dt>
                    <dd className="font-semibold text-[#161B18]">{fields.agent_address || "—"}</dd>
                  </div>
                  <div>
                    <dt>Agent telephone</dt>
                    <dd className="font-semibold text-[#161B18]">{fields.agent_phone || "—"}</dd>
                  </div>
                </dl>
              </div>

              {!form?.id && (
                <button
                  type="button"
                  data-testid="hmrc64-generate"
                  disabled={busy || precheck.missing?.length > 0}
                  onClick={generate}
                  className="mt-5 px-4 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#006B3C]"
                >
                  {busy ? "Generating…" : "Generate 64-8"}
                </button>
              )}
            </>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Status" testId="hmrc64-status">
            <div className="flex flex-wrap items-center gap-3">
              <span
                data-testid="hmrc64-status-badge"
                className="inline-flex px-3 py-1 rounded-md text-xs font-bold uppercase bg-[#EAF5EE] text-[#006B3C]"
              >
                {form?.label || status.replace(/_/g, " ")}
              </span>
              {form?.agent_authorisation === "Completed" && (
                <span className="text-xs font-semibold text-[#16A05D]">
                  HMRC Agent Authorisation: Completed
                </span>
              )}
            </div>
            {form && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#626A65]">
                <div>
                  <dt>Generated</dt>
                  <dd className="font-semibold text-[#161B18]">{dt(form.generated_at)}</dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd className="font-semibold text-[#161B18]">{dt(form.sent_at)}</dd>
                </div>
                <div>
                  <dt>Signed</dt>
                  <dd className="font-semibold text-[#161B18]">{dt(form.signed_at)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd className="font-semibold text-[#161B18]">{dt(form.expires_at)}</dd>
                </div>
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {form?.id && form.status === "DRAFT" && (
                <button
                  type="button"
                  data-testid="hmrc64-send"
                  disabled={busy}
                  onClick={send}
                  className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-xs font-semibold"
                >
                  Send for Signature
                </button>
              )}
              {form?.id && ["SENT", "EXPIRED"].includes(form.status) && (
                <button
                  type="button"
                  data-testid="hmrc64-resend"
                  disabled={busy}
                  onClick={resend}
                  className="px-4 py-2 rounded-lg border border-[#B77A12] text-[#B77A12] text-xs font-semibold"
                >
                  Resend Signature Request
                </button>
              )}
              {form?.id && form.status === "SIGNED" && form.esign_request_id && (
                <button
                  type="button"
                  data-testid="hmrc64-download"
                  className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-xs font-semibold text-[#006B3C]"
                  onClick={async () => {
                    const res = await api.get(`/esign/requests/${form.esign_request_id}/download`, {
                      responseType: "blob",
                    });
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `hmrc-64-8-${form.id}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download signed copy
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Official 64-8 preview (structure locked)" testId="hmrc64-preview">
            <p className="text-xs text-[#626A65] mb-2">
              Preview of filled client boxes on the locked HMRC 64-8 structure.
            </p>
            {(form?.preview_html || precheck) && (
              <div
                data-testid="hmrc64-preview-frame"
                className="border border-[#161B18] rounded-sm bg-white overflow-auto max-h-[32rem] p-2"
                // Preview only — official labels/structure are server-locked; values autofilled.
                dangerouslySetInnerHTML={{
                  __html:
                    form?.preview_html ||
                    "<p class='text-sm text-[#626A65] p-4'>Generate to preview the filled 64-8.</p>",
                }}
              />
            )}
            {!form && !precheck && <Empty text="No preview yet." />}
          </Panel>

          {form?.audit?.length > 0 && (
            <Panel title="Audit trail" testId="hmrc64-audit">
              <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
                {form.audit.map((a) => (
                  <li key={a.id} className="border-b border-[#E3E7E4] pb-2">
                    <span className="font-semibold">{a.event_type}</span>
                    <span className="text-[#626A65]"> · {dt(a.timestamp)}</span>
                    {a.ip_address && <span className="text-[#626A65]"> · IP {a.ip_address}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
