/**
 * Client AML/KYC onboarding — mandatory before service activation.
 * Steps: profile → identity document → two proofs of address → live photo → submit.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import LivePhotoCapture from "@/components/aml/LivePhotoCapture";
import { Empty, Panel } from "@/components/StatCard";
import { api, apiError } from "@/lib/api";

const STEPS = [
  { key: "profile", label: "Your details" },
  { key: "id", label: "Identity document" },
  { key: "address", label: "Proof of address" },
  { key: "selfie", label: "Live photo" },
  { key: "review", label: "Submit" },
];

function Progress({ progress, status }) {
  const items = [
    ["ID uploaded", progress?.id_uploaded],
    ["Proof of address uploaded", progress?.proof_of_address_uploaded],
    ["Live photo captured", progress?.live_photo_captured],
  ];
  return (
    <div className="flex flex-wrap gap-2" data-testid="aml-progress">
      {items.map(([label, done]) => (
        <span
          key={label}
          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold"
          style={{
            background: done ? "#E9F7EF" : "#F1F3F2",
            color: done ? "#16A05D" : "#626A65",
          }}
        >
          {done ? "✓ " : "○ "}
          {label}
        </span>
      ))}
      <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold bg-[#F0EBFB] text-[#7656C9]">
        Status: {(status || "NOT_STARTED").replace(/_/g, " ")}
      </span>
    </div>
  );
}

export default function AmlOnboarding() {
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [idKind, setIdKind] = useState("PASSPORT");
  const [form, setForm] = useState({
    date_of_birth: "",
    residential_address: "",
    country_of_residence: "United Kingdom",
    occupation: "",
    source_of_funds_note: "",
  });

  const load = async () => {
    const { data: d } = await api.get("/aml/me");
    setData(d);
    const c = d.case || {};
    setForm({
      date_of_birth: c.date_of_birth || "",
      residential_address: c.residential_address || "",
      country_of_residence: c.country_of_residence || "United Kingdom",
      occupation: c.occupation || "",
      source_of_funds_note: c.source_of_funds_note || "",
    });
    if (c.id_document_kind) setIdKind(c.id_document_kind);
  };

  useEffect(() => {
    load().catch((e) => setErr(apiError(e.response?.data?.detail)));
  }, []);

  const amlCase = data?.case;
  const progress = amlCase?.progress;
  const approved = data?.ok;
  const underReview = ["SUBMITTED", "IN_REVIEW"].includes(amlCase?.status);

  const docsByType = useMemo(() => {
    const map = {};
    for (const d of amlCase?.documents || []) {
      if (!map[d.type]) map[d.type] = [];
      map[d.type].push(d);
    }
    return map;
  }, [amlCase]);

  const upload = async (type, file) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      await api.post("/aml/me/documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail) || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.patch("/aml/me/profile", { ...form, id_document_kind: idKind });
      await load();
      setStep(1);
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post("/aml/me/submit");
      await load();
    } catch (e) {
      setErr(apiError(e.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  if (!data && !err) {
    return (
      <AppShell title="Identity verification">
        <Empty text="Loading…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Identity verification"
      subtitle="Required before you can activate tax or MTD services"
    >
      <div className="space-y-6 max-w-3xl">
        <Panel testId="aml-intro-panel">
          <p className="text-sm text-[#161B18]" data-testid="aml-regulatory-message">
            To comply with UK Anti-Money Laundering regulations, we must verify your identity and address.
          </p>
          <div className="mt-4">
            <Progress progress={progress} status={amlCase?.status} />
          </div>
        </Panel>

        {approved && (
          <Panel testId="aml-approved-panel">
            <p className="text-sm font-semibold text-[#16A05D]">
              Your identity check is complete. You can activate services and continue onboarding.
            </p>
            <Link
              to="/subscription"
              className="inline-flex mt-4 px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold"
            >
              Go to My Services
            </Link>
          </Panel>
        )}

        {underReview && (
          <Panel testId="aml-pending-review-panel">
            <p className="text-sm text-[#B77A12] font-semibold">
              Your documents have been submitted and are awaiting review by our team.
            </p>
          </Panel>
        )}

        {!approved && !underReview && (
          <>
            <div className="flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    step === i
                      ? "bg-[#EAF5EE] border-[#078A4B] text-[#006B3C]"
                      : "border-[#E3E7E4] text-[#626A65]"
                  }`}
                >
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>

            {step === 0 && (
              <Panel title="Your details" testId="aml-step-profile">
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    Date of birth
                    <input
                      data-testid="aml-dob"
                      type="date"
                      value={form.date_of_birth || ""}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Residential address
                    <textarea
                      data-testid="aml-address"
                      rows={3}
                      value={form.residential_address || ""}
                      onChange={(e) => setForm({ ...form, residential_address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                      placeholder="Address lines and postcode"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Country of residence
                    <input
                      data-testid="aml-country"
                      value={form.country_of_residence || ""}
                      onChange={(e) => setForm({ ...form, country_of_residence: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Occupation
                    <input
                      data-testid="aml-occupation"
                      value={form.occupation || ""}
                      onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Source of funds (brief note)
                    <textarea
                      data-testid="aml-sof"
                      rows={2}
                      value={form.source_of_funds_note || ""}
                      onChange={(e) => setForm({ ...form, source_of_funds_note: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E3E7E4] px-3 py-2 text-sm"
                      placeholder="e.g. Employment income, savings"
                    />
                  </label>
                  {/* TODO(edd): surface company / high-risk fields when client_type = COMPANY */}
                  <button
                    type="button"
                    data-testid="aml-save-profile"
                    disabled={busy || !form.date_of_birth || !form.residential_address}
                    onClick={saveProfile}
                    className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Save and continue
                  </button>
                </div>
              </Panel>
            )}

            {step === 1 && (
              <Panel title="Upload identity document" testId="aml-step-id">
                <p className="text-sm text-[#626A65] mb-4">
                  Upload a valid passport, or driving licence (front and back).
                </p>
                <div className="flex gap-3 mb-4">
                  {["PASSPORT", "DRIVING_LICENCE"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      data-testid={`aml-id-kind-${k}`}
                      onClick={() => setIdKind(k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        idKind === k ? "bg-[#EAF5EE] border-[#078A4B]" : "border-[#E3E7E4]"
                      }`}
                    >
                      {k === "PASSPORT" ? "Passport" : "Driving licence"}
                    </button>
                  ))}
                </div>
                {idKind === "PASSPORT" ? (
                  <FileUpload
                    label="Passport photo page"
                    testId="aml-upload-passport"
                    existing={docsByType.PASSPORT?.[0]}
                    disabled={busy}
                    onFile={(f) => upload("PASSPORT", f)}
                  />
                ) : (
                  <div className="space-y-4">
                    <FileUpload
                      label="Driving licence — front"
                      testId="aml-upload-licence-front"
                      existing={docsByType.DRIVING_LICENCE_FRONT?.[0]}
                      disabled={busy}
                      onFile={(f) => upload("DRIVING_LICENCE_FRONT", f)}
                    />
                    <FileUpload
                      label="Driving licence — back"
                      testId="aml-upload-licence-back"
                      existing={docsByType.DRIVING_LICENCE_BACK?.[0]}
                      disabled={busy}
                      onFile={(f) => upload("DRIVING_LICENCE_BACK", f)}
                    />
                  </div>
                )}
                <button
                  type="button"
                  className="mt-4 text-sm font-semibold text-[#006B3C]"
                  onClick={() => setStep(2)}
                  disabled={!progress?.id_uploaded}
                >
                  Continue →
                </button>
              </Panel>
            )}

            {step === 2 && (
              <Panel title="Proof of address (two documents)" testId="aml-step-address">
                <p className="text-sm text-[#626A65] mb-4">
                  Upload two separate documents showing your name and address (for example a bank
                  statement, utility bill, council tax bill, or HMRC letter).
                </p>
                <p className="text-xs text-[#626A65] mb-3" data-testid="aml-poa-count">
                  Uploaded {progress?.proof_of_address_count || 0} of{" "}
                  {progress?.proof_of_address_required || 2}
                </p>
                {(docsByType.PROOF_OF_ADDRESS || []).map((d) => (
                  <div key={d.id} className="text-sm text-[#16A05D] mb-1">
                    ✓ {d.file_name}
                  </div>
                ))}
                <FileUpload
                  label="Add proof of address"
                  testId="aml-upload-poa"
                  disabled={busy || (progress?.proof_of_address_count || 0) >= 5}
                  onFile={(f) => upload("PROOF_OF_ADDRESS", f)}
                />
                <button
                  type="button"
                  className="mt-4 text-sm font-semibold text-[#006B3C]"
                  onClick={() => setStep(3)}
                  disabled={!progress?.proof_of_address_uploaded}
                >
                  Continue →
                </button>
              </Panel>
            )}

            {step === 3 && (
              <Panel title="Live photo" testId="aml-step-selfie">
                <p className="text-sm text-[#626A65] mb-4">
                  Take a live photo of yourself so we can compare it with your identity document.
                </p>
                {docsByType.SELFIE?.[0] && (
                  <p className="text-sm text-[#16A05D] mb-3">✓ Photo captured: {docsByType.SELFIE[0].file_name}</p>
                )}
                <LivePhotoCapture disabled={busy} onCapture={(f) => upload("SELFIE", f)} />
                <button
                  type="button"
                  className="mt-4 text-sm font-semibold text-[#006B3C]"
                  onClick={() => setStep(4)}
                  disabled={!progress?.live_photo_captured}
                >
                  Continue →
                </button>
              </Panel>
            )}

            {step === 4 && (
              <Panel title="Submit for review" testId="aml-step-submit">
                <ul className="text-sm text-[#626A65] space-y-1 mb-4">
                  <li>{progress?.profile_complete ? "✓" : "○"} Personal details</li>
                  <li>{progress?.id_uploaded ? "✓" : "○"} Identity document</li>
                  <li>
                    {progress?.proof_of_address_uploaded ? "✓" : "○"} Two proofs of address (
                    {progress?.proof_of_address_count || 0}/2)
                  </li>
                  <li>{progress?.live_photo_captured ? "✓" : "○"} Live photo</li>
                </ul>
                {amlCase?.status === "REQUIRES_REUPLOAD" && amlCase.reupload_message && (
                  <p className="text-sm text-[#D64545] mb-3">{amlCase.reupload_message}</p>
                )}
                <button
                  type="button"
                  data-testid="aml-submit-btn"
                  disabled={busy || !progress?.ready_to_submit}
                  onClick={submit}
                  className="px-5 py-2.5 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? "Submitting…" : "Submit for AML review"}
                </button>
              </Panel>
            )}
          </>
        )}

        {err && <p data-testid="aml-error" className="text-sm text-[#D64545]">{err}</p>}
      </div>
    </AppShell>
  );
}

function FileUpload({ label, testId, onFile, existing, disabled }) {
  return (
    <div>
      <div className="text-sm font-medium mb-1.5">{label}</div>
      {existing && <p className="text-xs text-[#16A05D] mb-1">✓ {existing.file_name}</p>}
      <label
        className={`inline-flex px-4 py-2 rounded-lg border border-[#E3E7E4] text-sm font-semibold cursor-pointer ${
          disabled ? "opacity-50" : "hover:bg-[#F1F8F4]"
        }`}
      >
        Choose file
        <input
          data-testid={testId}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
    </div>
  );
}
