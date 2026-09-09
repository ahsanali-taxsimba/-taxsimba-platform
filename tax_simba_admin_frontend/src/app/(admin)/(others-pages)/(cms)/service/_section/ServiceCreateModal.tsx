"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    createService,
    updateService,
    getServiceById,
    type Service,
    type ServiceCreatePayload,
    type ServiceFaqItem,
} from "@/lib/cms/service";
import { useRouter } from "next/navigation";

/** ---------------------------
 * Section Types (UI-friendly)
 * -------------------------- */
type BannerSection = {
    title1: string;
    title2: string;
    description: string;
    buttonText: string;
};

type WhoWeAreSection = {
    title1: string;
    title2: string;
    description: string;
    sectionImageUrl: string;
};

type WhatWeDoItem = { title: string; description: string; imageUrl: string };
type WhatWeDoSection = {
    title1: string;
    title2: string;
    items: WhatWeDoItem[];
};

type WhoWeHelpItem = { title: string; imageUrl: string };
type WhoWeHelpSection = {
    title1: string;
    title2: string;
    items: WhoWeHelpItem[];
};

type WhyChooseUsSection = {
    title1: string;
    title2: string;
    itemsListing: {
        title: string;
        lists: string[];
        buttonText: string;
    };
};

type HowItWorksItem = { title: string; description: string; imageUrl: string };
type HowItWorksSection = {
    title1: string;
    title2: string;
    items: HowItWorksItem[];
};

type BenefitsSection = {
    title: string;
    items: string[];
    imageUrl: string;
};

const emptyBanner: BannerSection = {
    title1: "",
    title2: "",
    description: "",
    buttonText: "",
};

const emptyWhoWeAre: WhoWeAreSection = {
    title1: "",
    title2: "",
    description: "",
    sectionImageUrl: "",
};

const emptyWhatWeDo: WhatWeDoSection = {
    title1: "",
    title2: "",
    items: [{ title: "", description: "", imageUrl: "" }],
};

const emptyWhoWeHelp: WhoWeHelpSection = {
    title1: "",
    title2: "",
    items: [{ title: "", imageUrl: "" }],
};

const emptyWhyChooseUs: WhyChooseUsSection = {
    title1: "",
    title2: "",
    itemsListing: {
        title: "",
        lists: [""],
        buttonText: "",
    },
};

const emptyHowItWorks: HowItWorksSection = {
    title1: "",
    title2: "",
    items: [{ title: "", description: "", imageUrl: "" }],
};

const emptyBenefits: BenefitsSection = {
    title: "",
    items: [""],
    imageUrl: "",
};

const hasAnyValue = (obj: Record<string, any>): boolean => {
    if (!obj) return false;
    return Object.values(obj).some((v) => {
        if (Array.isArray(v)) {
            return v.some((x) => {
                if (typeof x === "string") return x.trim().length > 0;
                if (typeof x === "object" && x) return hasAnyValue(x);
                return !!x;
            });
        }
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "object" && v) return hasAnyValue(v);
        return v !== null && v !== undefined;
    });
};

type Props = {
    /** If provided → edit mode */
    serviceId?: number | string;
    /** Optional: go back after save */
    redirectTo?: string; // e.g. "/admin/cms/services"
};

export default function ServiceCreateModal({ serviceId, redirectTo }: Props) {
    const router = useRouter();
    const isEdit = useMemo(() => !!serviceId, [serviceId]);

    const [pageLoading, setPageLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [editingService, setEditingService] = useState<Service | null>(null);

    // Base fields
    const [slug, setSlug] = useState("");
    const [title, setTitle] = useState("");
    const [tagline, setTagline] = useState("");
    const [summary, setSummary] = useState("");

    // SEO
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");

    // payload sample doesn’t include metaKeywords now, but your API model supports it
    const [metaKeywords, setMetaKeywords] = useState("");

    // Sections
    const [banner, setBanner] = useState<BannerSection>(emptyBanner);
    const [whoWeAre, setWhoWeAre] = useState<WhoWeAreSection>(emptyWhoWeAre);
    const [whatWeDo, setWhatWeDo] = useState<WhatWeDoSection>(emptyWhatWeDo);
    const [whoWeHelp, setWhoWeHelp] = useState<WhoWeHelpSection>(emptyWhoWeHelp);
    const [whyChooseUs, setWhyChooseUs] =
        useState<WhyChooseUsSection>(emptyWhyChooseUs);
    const [howItWorks, setHowItWorks] =
        useState<HowItWorksSection>(emptyHowItWorks);
    const [benefits, setBenefits] = useState<BenefitsSection>(emptyBenefits);

    // FAQ
    const [faq, setFaq] = useState<ServiceFaqItem[]>([{ q: "", a: "" }]);

    // CTA + other
    const [cta, setCta] = useState("");
    const [displayOrder, setDisplayOrder] = useState<number>(1);
    const [isActive, setIsActive] = useState(true);

    /** ---------------------------
     * Fetch service for edit
     * -------------------------- */
    useEffect(() => {
        const load = async () => {
            if (!serviceId) return;

            try {
                setPageLoading(true);
                setError(null);

                const res = await getServiceById(serviceId);
                setEditingService(res.data);
            } catch (err: any) {
                setError(
                    err?.response?.data?.message || err?.message || "Failed to load service"
                );
            } finally {
                setPageLoading(false);
            }
        };

        load();
    }, [serviceId]);

    /** ---------------------------
     * Prefill when editingService loaded
     * -------------------------- */
    useEffect(() => {
        if (!editingService) return;

        setSlug(editingService.slug || "");
        setTitle(editingService.title || "");
        setTagline(editingService.tagline || "");
        setSummary(editingService.summary || "");

        setMetaTitle(editingService.metaTitle || "");
        setMetaDescription(editingService.metaDescription || "");
        setMetaKeywords(editingService.metaKeywords || "");

        const sections = editingService.sections || [];
        const b = sections.find((s: any) => s?.bannerSection)?.bannerSection;
        const ww = sections.find((s: any) => s?.whoWeAreSection)?.whoWeAreSection;
        const wwd = sections.find((s: any) => s?.whatWeDoSection)?.whatWeDoSection;
        const wwh = sections.find((s: any) => s?.whoWeHelpSection)?.whoWeHelpSection;
        const yc = sections.find((s: any) => s?.whyChoseUsSection)?.whyChoseUsSection;
        const hiw = sections.find((s: any) => s?.howItWorksSection)?.howItWorksSection;
        const ben = sections.find((s: any) => s?.benefitsSection)?.benefitsSection;

        setBanner({
            title1: b?.title1 || "",
            title2: b?.title2 || "",
            description: b?.description || "",
            buttonText: b?.buttonText || "",
        });

        setWhoWeAre({
            title1: ww?.title1 || "",
            title2: ww?.title2 || "",
            description: ww?.description || "",
            sectionImageUrl: ww?.sectionImageUrl || "",
        });

        setWhatWeDo({
            title1: wwd?.title1 || "",
            title2: wwd?.title2 || "",
            items: wwd?.items?.length
                ? wwd.items
                : [{ title: "", description: "", imageUrl: "" }],
        });

        setWhoWeHelp({
            title1: wwh?.title1 || "",
            title2: wwh?.title2 || "",
            items: wwh?.items?.length ? wwh.items : [{ title: "", imageUrl: "" }],
        });

        setWhyChooseUs({
            title1: yc?.title1 || "",
            title2: yc?.title2 || "",
            itemsListing: {
                title: yc?.itemsListing?.title || "",
                lists: yc?.itemsListing?.lists?.length ? yc.itemsListing.lists : [""],
                buttonText: yc?.itemsListing?.buttonText || "",
            },
        });

        setHowItWorks({
            title1: hiw?.title1 || "",
            title2: hiw?.title2 || "",
            items: hiw?.items?.length
                ? hiw.items
                : [{ title: "", description: "", imageUrl: "" }],
        });

        setBenefits({
            title: ben?.title || "",
            items: ben?.items?.length ? ben.items : [""],
            imageUrl: ben?.imageUrl || "",
        });

        const existingFaq = editingService.faq?.length
            ? editingService.faq
            : [{ q: "", a: "" }];
        setFaq(existingFaq.map((f) => ({ q: f.q || "", a: f.a || "" })));

        setCta(editingService.cta || "");
        setDisplayOrder(editingService.displayOrder || 1);
        setIsActive(!!editingService.isActive);
    }, [editingService]);

    /** ---------------------------
     * FAQ handlers
     * -------------------------- */
    const updateFaq = (index: number, key: "q" | "a", value: string) => {
        setFaq((prev) => {
            const clone = [...prev];
            clone[index] = { ...clone[index], [key]: value };
            return clone;
        });
    };
    const addFaq = () => setFaq((prev) => [...prev, { q: "", a: "" }]);
    const removeFaq = (index: number) =>
        setFaq((prev) => prev.filter((_, i) => i !== index));

    /** ---------------------------
     * Section arrays handlers
     * -------------------------- */
    const addWhatWeDoItem = () =>
        setWhatWeDo((p) => ({
            ...p,
            items: [...p.items, { title: "", description: "", imageUrl: "" }],
        }));
    const updateWhatWeDoItem = (i: number, k: keyof WhatWeDoItem, v: string) =>
        setWhatWeDo((p) => ({
            ...p,
            items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
        }));
    const removeWhatWeDoItem = (i: number) =>
        setWhatWeDo((p) => ({
            ...p,
            items: p.items.filter((_, idx) => idx !== i),
        }));

    const addWhoWeHelpItem = () =>
        setWhoWeHelp((p) => ({
            ...p,
            items: [...p.items, { title: "", imageUrl: "" }],
        }));
    const updateWhoWeHelpItem = (i: number, k: keyof WhoWeHelpItem, v: string) =>
        setWhoWeHelp((p) => ({
            ...p,
            items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
        }));
    const removeWhoWeHelpItem = (i: number) =>
        setWhoWeHelp((p) => ({
            ...p,
            items: p.items.filter((_, idx) => idx !== i),
        }));

    const addWhyList = () =>
        setWhyChooseUs((p) => ({
            ...p,
            itemsListing: { ...p.itemsListing, lists: [...p.itemsListing.lists, ""] },
        }));
    const updateWhyList = (i: number, v: string) =>
        setWhyChooseUs((p) => ({
            ...p,
            itemsListing: {
                ...p.itemsListing,
                lists: p.itemsListing.lists.map((x, idx) => (idx === i ? v : x)),
            },
        }));
    const removeWhyList = (i: number) =>
        setWhyChooseUs((p) => ({
            ...p,
            itemsListing: {
                ...p.itemsListing,
                lists: p.itemsListing.lists.filter((_, idx) => idx !== i),
            },
        }));

    const addHowItWorksItem = () =>
        setHowItWorks((p) => ({
            ...p,
            items: [...p.items, { title: "", description: "", imageUrl: "" }],
        }));
    const updateHowItWorksItem = (i: number, k: keyof HowItWorksItem, v: string) =>
        setHowItWorks((p) => ({
            ...p,
            items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
        }));
    const removeHowItWorksItem = (i: number) =>
        setHowItWorks((p) => ({
            ...p,
            items: p.items.filter((_, idx) => idx !== i),
        }));

    const addBenefit = () =>
        setBenefits((p) => ({ ...p, items: [...p.items, ""] }));
    const updateBenefit = (i: number, v: string) =>
        setBenefits((p) => ({
            ...p,
            items: p.items.map((x, idx) => (idx === i ? v : x)),
        }));
    const removeBenefit = (i: number) =>
        setBenefits((p) => ({
            ...p,
            items: p.items.filter((_, idx) => idx !== i),
        }));

    /** ---------------------------
     * Submit
     * -------------------------- */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setSuccessMsg(null);

        // slug might be required in your API for create; for edit you may allow unchanged

        if (!title.trim()) return setError("Title is required");

        try {
            setSaving(true);
            setError(null);

            const cleanedFaq = faq
                .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
                .filter((f) => f.q || f.a);

            // Build sections in the exact keys you showed
            const sections: Record<string, any>[] = [];

            if (hasAnyValue(banner)) sections.push({ bannerSection: banner });
            if (hasAnyValue(whoWeAre)) sections.push({ whoWeAreSection: whoWeAre });
            if (hasAnyValue(whatWeDo)) sections.push({ whatWeDoSection: whatWeDo });
            if (hasAnyValue(whoWeHelp)) sections.push({ whoWeHelpSection: whoWeHelp });

            // IMPORTANT: key must be whyChoseUsSection (spelling as per your payload)
            if (hasAnyValue(whyChooseUs))
                sections.push({ whyChoseUsSection: whyChooseUs });

            if (hasAnyValue(howItWorks)) sections.push({ howItWorksSection: howItWorks });
            if (hasAnyValue(benefits)) sections.push({ benefitsSection: benefits });

            const payload: ServiceCreatePayload = {
                slug: slug.trim(),
                title: title.trim(),

                metaTitle: metaTitle.trim() || undefined,
                metaDescription: metaDescription.trim() || undefined,
                metaKeywords: metaKeywords.trim() || undefined,

                tagline: tagline.trim() || undefined,
                summary: summary.trim() || undefined,

                sections,
                faq: cleanedFaq,

                cta: cta.trim() || undefined,
                displayOrder: Number(displayOrder) || 1,
                isActive,
            };


            if (isEdit && serviceId) {
                await updateService(serviceId, payload);
                setSuccessMsg("Service updated successfully.");
            } else {
                await createService(payload);
                setSuccessMsg("Service created successfully.");
            }

            if (redirectTo) {
                router.push(redirectTo);
            }
        } catch (err: any) {
            setError(
                err?.response?.data?.message || err?.message || "Failed to save service"
            );
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        "mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm";
    const textareaCls =
        "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm";
    const btnXs =
        "rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50 mt-4 text-right";
    const btnDangerXs =
        "rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50";

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">
                        {isEdit ? "Edit Service" : "Create Service"}
                    </h1>
                    <p className="text-sm text-gray-600 mb-0">
                        Manage service content blocks, FAQ, SEO, and status.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm hover:bg-gray-50"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit as any}
                        disabled={saving || pageLoading}
                        className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white disabled:opacity-60"
                    >
                        {saving ? "Saving..." : isEdit ? "Update" : "Create"}
                    </button>
                </div>
            </div>

            {pageLoading && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                    Loading service...
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

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basics */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">Add Service</h3>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                        <div>
                            <label className="text-sm font-medium">Title <span className="text-danger">*</span></label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Tagline</label>
                            <input
                                value={tagline}
                                onChange={(e) => setTagline(e.target.value)}
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Summary</label>
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={3}
                                className={textareaCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Display Order</label>
                            <input
                                type="number"
                                min={1}
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                                className={inputCls}
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-6">

                            <label className="mb-1 block text-sm font-medium">Status</label>
                            <select
                                value={isActive ? "active" : "inactive"}
                                onChange={(e) => setIsActive(e.target.value === "active")}
                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm
               shadow-theme-xs focus:border-brand-300 focus:outline-hidden
               focus:ring-3 focus:ring-brand-500/10"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>

                        </div>
                    </div>
                </div>

                {/* SEO */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">SEO</h3>

                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="text-sm font-medium">Meta Title</label>
                            <input
                                value={metaTitle}
                                onChange={(e) => setMetaTitle(e.target.value)}
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Meta Description</label>
                            <textarea
                                value={metaDescription}
                                onChange={(e) => setMetaDescription(e.target.value)}
                                rows={3}
                                className={textareaCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Meta Keywords</label>
                            <input
                                value={metaKeywords}
                                onChange={(e) => setMetaKeywords(e.target.value)}
                                className={inputCls}
                                placeholder="comma,separated,keywords"
                            />
                        </div>
                    </div>
                </div>

                {/* Sections: Banner */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">
                        Banner Section
                    </h3>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={banner.title1}
                                onChange={(e) =>
                                    setBanner((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={banner.title2}
                                onChange={(e) =>
                                    setBanner((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={banner.description}
                                onChange={(e) =>
                                    setBanner((p) => ({ ...p, description: e.target.value }))
                                }
                                rows={3}
                                className={textareaCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Button Text</label>
                            <input
                                value={banner.buttonText}
                                onChange={(e) =>
                                    setBanner((p) => ({ ...p, buttonText: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>
                    </div>
                </div>

                {/* WhoWeAre */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">
                        Who We Are Section
                    </h3>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={whoWeAre.title1}
                                onChange={(e) =>
                                    setWhoWeAre((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={whoWeAre.title2}
                                onChange={(e) =>
                                    setWhoWeAre((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={whoWeAre.description}
                                onChange={(e) =>
                                    setWhoWeAre((p) => ({ ...p, description: e.target.value }))
                                }
                                rows={3}
                                className={textareaCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Section Image URL</label>
                            <input
                                value={whoWeAre.sectionImageUrl}
                                onChange={(e) =>
                                    setWhoWeAre((p) => ({ ...p, sectionImageUrl: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>
                    </div>
                </div>

                {/* WhatWeDo */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                            What We Do Section
                        </h3>

                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={whatWeDo.title1}
                                onChange={(e) =>
                                    setWhatWeDo((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={whatWeDo.title2}
                                onChange={(e) =>
                                    setWhatWeDo((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="mt-3 space-y-3">
                        {whatWeDo.items.map((it, i) => (
                            <div key={i} className="rounded-lg border border-gray-200 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-600">
                                        Item #{i + 1}
                                    </p>
                                    {whatWeDo.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeWhatWeDoItem(i)}
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
                                            value={it.title}
                                            onChange={(e) =>
                                                updateWhatWeDoItem(i, "title", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-700">
                                            Image URL
                                        </label>
                                        <input
                                            value={it.imageUrl}
                                            onChange={(e) =>
                                                updateWhatWeDoItem(i, "imageUrl", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-700">
                                            Description
                                        </label>
                                        <textarea
                                            value={it.description}
                                            onChange={(e) =>
                                                updateWhatWeDoItem(i, "description", e.target.value)
                                            }
                                            rows={3}
                                            className={textareaCls}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addWhatWeDoItem} className={btnXs}>
                        + Add Item
                    </button>
                </div>

                {/* WhoWeHelp */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Who We Help Section
                        </h3>
                        
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={whoWeHelp.title1}
                                onChange={(e) =>
                                    setWhoWeHelp((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={whoWeHelp.title2}
                                onChange={(e) =>
                                    setWhoWeHelp((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="mt-3 space-y-3">
                        {whoWeHelp.items.map((it, i) => (
                            <div key={i} className="rounded-lg border border-gray-200 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-600">
                                        Item #{i + 1}
                                    </p>
                                    {whoWeHelp.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeWhoWeHelpItem(i)}
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
                                            value={it.title}
                                            onChange={(e) =>
                                                updateWhoWeHelpItem(i, "title", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-700">
                                            Image URL
                                        </label>
                                        <input
                                            value={it.imageUrl}
                                            onChange={(e) =>
                                                updateWhoWeHelpItem(i, "imageUrl", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addWhoWeHelpItem} className={btnXs}>
                            + Add Item
                        </button>
                </div>

                {/* WhyChooseUs */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Why Chose Us Section
                        </h3>
                       
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={whyChooseUs.title1}
                                onChange={(e) =>
                                    setWhyChooseUs((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={whyChooseUs.title2}
                                onChange={(e) =>
                                    setWhyChooseUs((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Items Listing Title</label>
                            <input
                                value={whyChooseUs.itemsListing.title}
                                onChange={(e) =>
                                    setWhyChooseUs((p) => ({
                                        ...p,
                                        itemsListing: { ...p.itemsListing, title: e.target.value },
                                    }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Button Text</label>
                            <input
                                value={whyChooseUs.itemsListing.buttonText}
                                onChange={(e) =>
                                    setWhyChooseUs((p) => ({
                                        ...p,
                                        itemsListing: {
                                            ...p.itemsListing,
                                            buttonText: e.target.value,
                                        },
                                    }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Lists</label>
                            <div className="mt-2 space-y-2">
                                {whyChooseUs.itemsListing.lists.map((x, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            value={x}
                                            onChange={(e) => updateWhyList(i, e.target.value)}
                                            className={inputCls}
                                        />
                                        {whyChooseUs.itemsListing.lists.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeWhyList(i)}
                                                className={btnDangerXs}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="text-right md:col-span-2">
                        <button type="button" onClick={addWhyList} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-50 mt-4 text-right ">
                            + Add List Item
                        </button>
                        </div>
                       
                    </div>
                </div>

                {/* HowItWorks */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                            How It Works Section
                        </h3>
                        <button type="button" onClick={addHowItWorksItem} className={btnXs}>
                            + Add Step
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title 1</label>
                            <input
                                value={howItWorks.title1}
                                onChange={(e) =>
                                    setHowItWorks((p) => ({ ...p, title1: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Title 2</label>
                            <input
                                value={howItWorks.title2}
                                onChange={(e) =>
                                    setHowItWorks((p) => ({ ...p, title2: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="mt-3 space-y-3">
                        {howItWorks.items.map((it, i) => (
                            <div key={i} className="rounded-lg border border-gray-200 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-600">
                                        Step #{i + 1}
                                    </p>
                                    {howItWorks.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeHowItWorksItem(i)}
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
                                            value={it.title}
                                            onChange={(e) =>
                                                updateHowItWorksItem(i, "title", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-700">
                                            Image URL
                                        </label>
                                        <input
                                            value={it.imageUrl}
                                            onChange={(e) =>
                                                updateHowItWorksItem(i, "imageUrl", e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-gray-700">
                                            Description
                                        </label>
                                        <textarea
                                            value={it.description}
                                            onChange={(e) =>
                                                updateHowItWorksItem(i, "description", e.target.value)
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

                {/* Benefits */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Benefits Section
                        </h3>
                        <button type="button" onClick={addBenefit} className={btnXs}>
                            + Add Benefit
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <input
                                value={benefits.title}
                                onChange={(e) =>
                                    setBenefits((p) => ({ ...p, title: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Image URL</label>
                            <input
                                value={benefits.imageUrl}
                                onChange={(e) =>
                                    setBenefits((p) => ({ ...p, imageUrl: e.target.value }))
                                }
                                className={inputCls}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium">Items</label>
                            <div className="mt-2 space-y-2">
                                {benefits.items.map((x, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            value={x}
                                            onChange={(e) => updateBenefit(i, e.target.value)}
                                            className={inputCls}
                                        />
                                        {benefits.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeBenefit(i)}
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
                </div>

                {/* FAQ */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">FAQ</h3>
                        <button type="button" onClick={addFaq} className={btnXs}>
                            + Add FAQ
                        </button>
                    </div>

                    <div className="space-y-3">
                        {faq.map((item, idx) => (
                            <div key={idx} className="rounded-lg border border-gray-200 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-600">
                                        FAQ #{idx + 1}
                                    </p>
                                    {faq.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeFaq(idx)}
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
                                    value={item.q}
                                    onChange={(e) => updateFaq(idx, "q", e.target.value)}
                                    className={inputCls}
                                />

                                <label className="mt-3 block text-xs font-medium text-gray-700">
                                    Answer
                                </label>
                                <textarea
                                    value={item.a}
                                    onChange={(e) => updateFaq(idx, "a", e.target.value)}
                                    rows={3}
                                    className={textareaCls}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">CTA</h3>
                    <input
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                        className={inputCls}
                        placeholder="Start your CIS tax return online today."
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm hover:bg-gray-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={saving || pageLoading}
                        className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white disabled:opacity-60"
                    >
                        {saving ? "Saving..." : isEdit ? "Update" : "Create"}
                    </button>
                </div>
            </form>
        </div>
    );
}
