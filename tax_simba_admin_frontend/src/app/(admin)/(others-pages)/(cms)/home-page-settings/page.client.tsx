"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getHomePageSettings,
  upsertHomePageSettings,
  updateHomePageSection,
  toggleHomePageSettingsStatus,
  resetHomePageSettings,
  type HomePageSettings,
  type FaqItem,
  type WhyChooseUsItem,
  type TailoredItem,
  type HowItWorksStep,
  type SectionName,
} from "@/lib/cms/home-page-settings";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/cms/useConfirm";

const inputCls =
  "mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm";
const textareaCls =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm";
const cardCls = "rounded-xl border border-gray-200 bg-white p-4";
const btnXs =
  "rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50";
const btnDangerXs =
  "rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50";

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

function SectionHeader({
  title,
  sectionKey,
  onSaveSection,
  savingKey,
}: {
  title: string;
  sectionKey: SectionName;
  onSaveSection: (key: SectionName) => void;
  savingKey: SectionName | null;
}) {
  return (
    <div className="mb-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <button
        type="button"
        onClick={() => onSaveSection(sectionKey)}
        disabled={savingKey === sectionKey}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
      >
        {savingKey === sectionKey ? "Saving..." : "Save Section"}
      </button>
    </div>
  );
}

export default function HomePageSettingsPageClient() {
  const router = useRouter();
  const { confirm, ConfirmUI } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingSection, setSavingSection] = useState<SectionName | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<HomePageSettings | null>(null);

  // ---- form states (all sections) ----
  const [homeBannerTitle, setHomeBannerTitle] = useState("");

  const [howSteps, setHowSteps] = useState<HowItWorksStep[]>([
    { title: "", description: "" },
  ]);

  const [saTitlePrimary, setSaTitlePrimary] = useState("");
  const [saTitleSecondary, setSaTitleSecondary] = useState("");
  const [saButtonText, setSaButtonText] = useState("");

  const [wiTitle, setWiTitle] = useState("");
  const [wiList, setWiList] = useState<string[]>([""]);

  const [costTitlePrimary, setCostTitlePrimary] = useState("");
  const [costTitleSecondary, setCostTitleSecondary] = useState("");
  const [costList, setCostList] = useState<string[]>([""]);

  const [whyTitle, setWhyTitle] = useState("");
  const [whyItems, setWhyItems] = useState<WhyChooseUsItem[]>([
    { title: "", description: "", imageUrl: "" },
  ]);

  const [tailoredTitle, setTailoredTitle] = useState("");
  const [tailoredItems, setTailoredItems] = useState<TailoredItem[]>([
    { title: "", imageUrl: "" },
  ]);

  const [accTitle, setAccTitle] = useState("");
  const [accDesc, setAccDesc] = useState("");

  const [faqs, setFaqs] = useState<FaqItem[]>([{ question: "", answer: "" }]);

  const [globeHeading, setGlobeHeading] = useState("");
  const [globeSubheading, setGlobeSubheading] = useState("");
  const [globeBtn, setGlobeBtn] = useState("");

  // status dropdown (instead of checkbox)
  const [isActive, setIsActive] = useState<boolean>(true);

  const hydrate = (s: HomePageSettings) => {
    setHomeBannerTitle(s.homeBannerSection?.title ?? "");

    setHowSteps(
      s.howItWorksSection?.steps?.length
        ? s.howItWorksSection.steps.map((x) => ({
          title: x.title ?? "",
          description: x.description ?? "",
        }))
        : [{ title: "", description: "" }]
    );

    setSaTitlePrimary(s.selfAssessmentSection?.titlePrimary ?? "");
    setSaTitleSecondary(s.selfAssessmentSection?.titleSecondary ?? "");
    setSaButtonText(s.selfAssessmentSection?.buttonText ?? "");

    setWiTitle(s.whatsIncludedSection?.title ?? "");
    setWiList(
      s.whatsIncludedSection?.list?.length ? s.whatsIncludedSection.list : [""]
    );

    setCostTitlePrimary(s.costSection?.titlePrimary ?? "");
    setCostTitleSecondary(s.costSection?.titleSecondary ?? "");
    setCostList(s.costSection?.list?.length ? s.costSection.list : [""]);

    setWhyTitle(s.whyChooseUsSection?.title ?? "");
    setWhyItems(
      s.whyChooseUsSection?.items?.length
        ? s.whyChooseUsSection.items.map((x) => ({
          title: x.title ?? "",
          description: x.description ?? "",
          imageUrl: x.imageUrl ?? "",
        }))
        : [{ title: "", description: "", imageUrl: "" }]
    );

    setTailoredTitle(s.tailoredSection?.title ?? "");
    setTailoredItems(
      s.tailoredSection?.items?.length
        ? s.tailoredSection.items.map((x) => ({
          title: x.title ?? "",
          imageUrl: x.imageUrl ?? "",
        }))
        : [{ title: "", imageUrl: "" }]
    );

    setAccTitle(s.accountantsSection?.title ?? "");
    setAccDesc(s.accountantsSection?.description ?? "");

    setFaqs(
      s.faqs?.length
        ? s.faqs.map((x) => ({
          question: x.question ?? "",
          answer: x.answer ?? "",
        }))
        : [{ question: "", answer: "" }]
    );

    setGlobeHeading(s.globeSection?.heading ?? "");
    setGlobeSubheading(s.globeSection?.subheading ?? "");
    setGlobeBtn(s.globeSection?.buttonText ?? "");

    setIsActive(!!s.isActive);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
  
      const res = await getHomePageSettings();
      setSettings(res.data);
      hydrate(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
  
      // ✅ settings not created yet
      if (status === 404) {
        setSettings(null);
        setError("Home page settings not found. Please create settings first.");
        return;
      }
  
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load home page settings"
      );
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    load();
  }, []);

  // -------- helpers for arrays --------
  const addStep = () => setHowSteps((p) => [...p, { title: "", description: "" }]);
  const updateStep = (i: number, k: keyof HowItWorksStep, v: string) =>
    setHowSteps((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const removeStep = (i: number) =>
    setHowSteps((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const addWi = () => setWiList((p) => [...p, ""]);
  const updateWi = (i: number, v: string) =>
    setWiList((p) => p.map((x, idx) => (idx === i ? v : x)));
  const removeWi = (i: number) =>
    setWiList((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const addCost = () => setCostList((p) => [...p, ""]);
  const updateCost = (i: number, v: string) =>
    setCostList((p) => p.map((x, idx) => (idx === i ? v : x)));
  const removeCost = (i: number) =>
    setCostList((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const addWhy = () =>
    setWhyItems((p) => [...p, { title: "", description: "", imageUrl: "" }]);
  const updateWhy = (i: number, k: keyof WhyChooseUsItem, v: string) =>
    setWhyItems((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const removeWhy = (i: number) =>
    setWhyItems((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  const addTailored = () =>
    setTailoredItems((p) => [...p, { title: "", imageUrl: "" }]);
  const updateTailored = (i: number, k: keyof TailoredItem, v: string) =>
    setTailoredItems((p) =>
      p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x))
    );
  const removeTailored = (i: number) =>
    setTailoredItems((p) =>
      p.length <= 1 ? p : p.filter((_, idx) => idx !== i)
    );

  const addFaq = () => setFaqs((p) => [...p, { question: "", answer: "" }]);
  const updateFaq = (i: number, k: keyof FaqItem, v: string) =>
    setFaqs((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const removeFaq = (i: number) =>
    setFaqs((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));

  // -------- build payloads --------
  const cleanedSteps = useMemo(
    () =>
      howSteps
        .map((x) => ({
          title: (x.title ?? "").trim(),
          description: (x.description ?? "").trim(),
        }))
        .filter((x) => x.title || x.description),
    [howSteps]
  );

  const cleanedFaqs = useMemo(
    () =>
      faqs
        .map((x) => ({
          question: (x.question ?? "").trim(),
          answer: (x.answer ?? "").trim(),
        }))
        .filter((x) => x.question || x.answer),
    [faqs]
  );

  const buildAllPayload = () => ({
    homeBannerSection: { title: homeBannerTitle.trim() },

    howItWorksSection: {
      steps: cleanedSteps,
    },

    selfAssessmentSection: {
      titlePrimary: saTitlePrimary.trim(),
      titleSecondary: saTitleSecondary.trim(),
      buttonText: saButtonText.trim(),
    },

    whatsIncludedSection: {
      title: wiTitle.trim(),
      list: wiList.map((x) => x.trim()).filter(Boolean),
    },

    costSection: {
      titlePrimary: costTitlePrimary.trim(),
      titleSecondary: costTitleSecondary.trim(),
      list: costList.map((x) => x.trim()).filter(Boolean),
    },

    whyChooseUsSection: {
      title: whyTitle.trim(),
      items: whyItems
        .map((x) => ({
          title: (x.title ?? "").trim(),
          description: (x.description ?? "").trim(),
          imageUrl: (x.imageUrl ?? "").trim(),
        }))
        .filter((x) => x.title || x.description || x.imageUrl),
    },

    tailoredSection: {
      title: tailoredTitle.trim(),
      items: tailoredItems
        .map((x) => ({
          title: (x.title ?? "").trim(),
          imageUrl: (x.imageUrl ?? "").trim(),
        }))
        .filter((x) => x.title || x.imageUrl),
    },

    accountantsSection: {
      title: accTitle.trim(),
      description: accDesc.trim(),
    },

    faqs: cleanedFaqs,

    globeSection: {
      heading: globeHeading.trim(),
      subheading: globeSubheading.trim(),
      buttonText: globeBtn.trim(),
    },

    isActive,
  });

  const saveAll = async () => {
    try {
      setSavingAll(true);
      setError(null);
      setSuccessMsg(null);

      const res = await upsertHomePageSettings(buildAllPayload());
      setSettings(res.data);
      hydrate(res.data);
      setSuccessMsg(res.message || "Saved successfully");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update settings"
      );
    } finally {
      setSavingAll(false);
    }
  };

  const saveOneSection = async (key: SectionName) => {
    try {
      setSavingSection(key);
      setError(null);
      setSuccessMsg(null);
  
      const all = buildAllPayload() as any;
  
      const sectionData =
        key === "faqs" ? all.faqs
        : key === "homeBannerSection" ? all.homeBannerSection
        : key === "howItWorksSection" ? all.howItWorksSection
        : key === "selfAssessmentSection" ? all.selfAssessmentSection
        : key === "whatsIncludedSection" ? all.whatsIncludedSection
        : key === "costSection" ? all.costSection
        : key === "whyChooseUsSection" ? all.whyChooseUsSection
        : key === "tailoredSection" ? all.tailoredSection
        : key === "accountantsSection" ? all.accountantsSection
        : key === "globeSection" ? all.globeSection
        : null;
  
      // ✅ Always use POST upsert (because PATCH /section is 404 on server)
      const payload: any = {};
      payload[key] = sectionData;
  
      // IMPORTANT: to avoid "GET not found after refresh" issue
      // create/update should keep it active unless you explicitly want inactive
      payload.isActive = true; // or payload.isActive = isActive (see note below)
  
      const res = await upsertHomePageSettings(payload);
  
      setSettings(res.data);
      hydrate(res.data);
      setSuccessMsg(res.message || `${key} saved successfully`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update section");
    } finally {
      setSavingSection(null);
    }
  };
  


  const toggleStatus = async () => {
    try {
      setError(null);
      setSuccessMsg(null);
      const res = await toggleHomePageSettingsStatus();
      setSettings(res.data);
      hydrate(res.data);
      setSuccessMsg(res.message || "Status updated");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to toggle status"
      );
    }
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: "Reset Home Page Settings",
      message:
        "Are you sure you want to reset ALL home page settings? This action cannot be undone.",
      confirmText: "Yes, Reset",
      cancelText: "Cancel",
      tone: "danger",
    });
  
    if (!ok) return;
  
    try {
      setError(null);
      setSuccessMsg(null);
  
      const res = await resetHomePageSettings();
      setSettings(res.data);
      hydrate(res.data);
  
      setSuccessMsg(res.message || "Reset successful");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to reset settings"
      );
    }
  };
  
  

  return (
    <div className="space-y-4">
      {/* Header */}
      {ConfirmUI}
      <div className="flex flex-wrap md:flex:nowrap gap-2 md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Home Page Settings</h1>
          {settings && (
            <p className="mt-1 text-xs text-gray-500">
              Last updated: <b>{formatDate(settings.updatedAt)}</b>
            </p>
          )}
        </div>

        <div className="flex flex-wrap flex-wrap md:flex:nowrap gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm hover:bg-gray-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={toggleStatus}
            disabled={loading || !settings?.id}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            Toggle Status
          </button>

          <button
            type="button"
            onClick={resetAll}
            disabled={loading || !settings?.id}
            className="h-11 rounded-lg border border-red-200 bg-white px-4 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={saveAll}
            disabled={savingAll || loading}
            className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingAll ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          Loading settings...
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {!loading && (
        <>
          {/* Status dropdown */}
          <div className={cardCls}>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Global</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* homeBannerSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Home Banner Section"
              sectionKey="homeBannerSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <label className="text-sm font-medium">Title</label>
            <input
              value={homeBannerTitle}
              onChange={(e) => setHomeBannerTitle(e.target.value)}
              className={inputCls}
              placeholder="Simplify Your Taxes with Expert Guidance"
            />
          </div>

          {/* howItWorksSection */}
          <div className={cardCls}>
            <SectionHeader
              title="How It Works Section"
              sectionKey="howItWorksSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="mb-2 flex justify-end">
              <button type="button" onClick={addStep} className={btnXs}>
                + Add Step
              </button>
            </div>

            <div className="space-y-3">
              {howSteps.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">
                      Step #{i + 1}
                    </div>
                    {howSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Title
                      </label>
                      <input
                        value={s.title ?? ""}
                        onChange={(e) => updateStep(i, "title", e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        value={s.description ?? ""}
                        onChange={(e) =>
                          updateStep(i, "description", e.target.value)
                        }
                        rows={3}
                        className={textareaCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* selfAssessmentSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Self Assessment Section"
              sectionKey="selfAssessmentSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Title Primary</label>
                <input
                  value={saTitlePrimary}
                  onChange={(e) => setSaTitlePrimary(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Title Secondary</label>
                <input
                  value={saTitleSecondary}
                  onChange={(e) => setSaTitleSecondary(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Button Text</label>
                <input
                  value={saButtonText}
                  onChange={(e) => setSaButtonText(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* whatsIncludedSection */}
          <div className={cardCls}>
            <SectionHeader
              title="What's Included Section"
              sectionKey="whatsIncludedSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                value={wiTitle}
                onChange={(e) => setWiTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">List</label>
                <button type="button" onClick={addWi} className={btnXs}>
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {wiList.map((x, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={x}
                      onChange={(e) => updateWi(i, e.target.value)}
                      className={inputCls}
                    />
                    {wiList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWi(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* costSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Cost Section"
              sectionKey="costSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Title Primary</label>
                <input
                  value={costTitlePrimary}
                  onChange={(e) => setCostTitlePrimary(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Title Secondary</label>
                <input
                  value={costTitleSecondary}
                  onChange={(e) => setCostTitleSecondary(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">List</label>
                <button type="button" onClick={addCost} className={btnXs}>
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {costList.map((x, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={x}
                      onChange={(e) => updateCost(i, e.target.value)}
                      className={inputCls}
                    />
                    {costList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCost(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* whyChooseUsSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Why Choose Us Section"
              sectionKey="whyChooseUsSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                value={whyTitle}
                onChange={(e) => setWhyTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={addWhy} className={btnXs}>
                + Add Item
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {whyItems.map((it, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">
                      Item #{i + 1}
                    </div>
                    {whyItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWhy(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Title
                      </label>
                      <input
                        value={it.title ?? ""}
                        onChange={(e) => updateWhy(i, "title", e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Image URL
                      </label>
                      <input
                        value={it.imageUrl ?? ""}
                        onChange={(e) =>
                          updateWhy(i, "imageUrl", e.target.value)
                        }
                        className={inputCls}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        value={it.description ?? ""}
                        onChange={(e) =>
                          updateWhy(i, "description", e.target.value)
                        }
                        rows={3}
                        className={textareaCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* tailoredSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Tailored Section"
              sectionKey="tailoredSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                value={tailoredTitle}
                onChange={(e) => setTailoredTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={addTailored} className={btnXs}>
                + Add Item
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {tailoredItems.map((it, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">
                      Item #{i + 1}
                    </div>
                    {tailoredItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTailored(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Title
                      </label>
                      <input
                        value={it.title ?? ""}
                        onChange={(e) =>
                          updateTailored(i, "title", e.target.value)
                        }
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Image URL
                      </label>
                      <input
                        value={it.imageUrl ?? ""}
                        onChange={(e) =>
                          updateTailored(i, "imageUrl", e.target.value)
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* accountantsSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Accountants Section"
              sectionKey="accountantsSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  value={accTitle}
                  onChange={(e) => setAccTitle(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={accDesc}
                  onChange={(e) => setAccDesc(e.target.value)}
                  rows={3}
                  className={textareaCls}
                />
              </div>
            </div>
          </div>

          {/* faqs */}
          <div className={cardCls}>
            <SectionHeader
              title="FAQs"
              sectionKey="faqs"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="mb-2 flex justify-end">
              <button type="button" onClick={addFaq} className={btnXs}>
                + Add FAQ
              </button>
            </div>

            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-600">
                      FAQ #{i + 1}
                    </div>
                    {faqs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFaq(i)}
                        className={btnDangerXs}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="text-xs font-medium text-gray-700">
                    Question
                  </label>
                  <input
                    value={f.question ?? ""}
                    onChange={(e) => updateFaq(i, "question", e.target.value)}
                    className={inputCls}
                  />

                  <label className="mt-3 block text-xs font-medium text-gray-700">
                    Answer
                  </label>
                  <textarea
                    value={f.answer ?? ""}
                    onChange={(e) => updateFaq(i, "answer", e.target.value)}
                    rows={3}
                    className={textareaCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* globeSection */}
          <div className={cardCls}>
            <SectionHeader
              title="Globe Section"
              sectionKey="globeSection"
              onSaveSection={saveOneSection}
              savingKey={savingSection}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Heading</label>
                <input
                  value={globeHeading}
                  onChange={(e) => setGlobeHeading(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Subheading</label>
                <input
                  value={globeSubheading}
                  onChange={(e) => setGlobeSubheading(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Button Text</label>
                <input
                  value={globeBtn}
                  onChange={(e) => setGlobeBtn(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
