"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getServiceById, type Service } from "@/lib/cms/service";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
      title="Copy"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const Field = ({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}) => (
  <div className="grid grid-cols-1 gap-1 md:grid-cols-3 md:items-start">
    <div className="text-xs font-semibold text-gray-600">{label}</div>
    <div className="md:col-span-2 text-sm text-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="break-words">{value}</div>
        {copyable && typeof value === "string" && value !== "-" && (
          <CopyBtn text={value} />
        )}
      </div>
    </div>
  </div>
);

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function AccordionItem({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-white px-3 py-3 text-left hover:bg-gray-50"
      >
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <span className="text-xs font-semibold text-gray-500">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ServiceViewModal() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Service | null>(null);

  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const [showRawSections, setShowRawSections] = useState(false);
  const [showRawFaq, setShowRawFaq] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getServiceById(id);
        setData(res.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err?.message || "Failed to load service"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const sections = useMemo(() => data?.sections ?? [], [data]);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <PageBreadcrumb 
        pageTitle="Service Details" 
        parentPage="Services" 
        parentPageUrl="/service" 
      />

      {/* Action Bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-11 rounded-lg border border-gray-200 bg-white px-6 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
        >
          Back
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          Loading service...
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          No data found.
        </div>
      )}

      {!!data && (
        <>
          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              ID: {data.id}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                data.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {data.isActive ? "Active" : "Inactive"}
            </span>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Display Order: {data.displayOrder ?? "-"}
            </span>
          </div>

          {/* Basic Info */}
          <SectionCard title="Basic Info">
            <div className="space-y-3">
              <Field label="Title" value={data.title || "-"} />
              <Field label="Slug" value={data.slug || "-"} copyable />
              <Field label="Tagline" value={data.tagline ?? "-"} />
              <Field label="Summary" value={data.summary ?? "-"} />
              <Field label="CTA" value={data.cta ?? "-"} copyable />
              <Field label="Created At" value={formatDate(data.createdAt)} />
              <Field label="Updated At" value={formatDate(data.updatedAt)} />
            </div>
          </SectionCard>

          {/* SEO */}
          <SectionCard title="SEO">
            <div className="space-y-3">
              <Field label="Meta Title" value={data.metaTitle ?? "-"} copyable />
              <Field
                label="Meta Description"
                value={data.metaDescription ?? "-"}
                copyable={typeof data.metaDescription === "string" && !!data.metaDescription}
              />
              <Field
                label="Meta Keywords"
                value={data.metaKeywords ?? "-"}
                copyable={typeof data.metaKeywords === "string" && !!data.metaKeywords}
              />
            </div>
          </SectionCard>

          {/* Sections (ALL) */}
          <SectionCard title="Sections">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                Total sections: <b>{sections.length}</b>
              </div>

              <button
                type="button"
                onClick={() => setShowRawSections((s) => !s)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {showRawSections ? "Hide Raw" : "Show Raw"}
              </button>
            </div>

            {!sections.length ? (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                No sections found.
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((sec: any, idx: number) => {
                  const key = Object.keys(sec || {})[0] || `section_${idx + 1}`;
                  const open = openSectionIndex === idx;
                  const payload = sec?.[key];

                  return (
                    <AccordionItem
                      key={idx}
                      title={key}
                      open={open}
                      onToggle={() => setOpenSectionIndex(open ? null : idx)}
                    >
                      {/* Pretty render for known shapes */}
                      {key === "bannerSection" && (
                        <div className="space-y-2">
                          <div className="text-base font-semibold text-gray-900">
                            {payload?.title1 || "-"}
                          </div>
                          <div className="text-sm font-medium text-gray-700">
                            {payload?.title2 || "-"}
                          </div>
                          <div className="text-sm text-gray-700">
                            {payload?.description || "-"}
                          </div>
                          <div className="pt-2">
                            <span className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
                              {payload?.buttonText || "Button"}
                            </span>
                          </div>
                        </div>
                      )}

                      {key === "whatWeDoSection" && (
                        <div className="space-y-3">
                          <div className="font-semibold text-gray-900">
                            {payload?.title1 || "-"}
                          </div>
                          <div className="text-sm text-gray-700">
                            {payload?.title2 || "-"}
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            {(payload?.items || []).map((it: any, i: number) => (
                              <div
                                key={i}
                                className="rounded-lg border border-gray-200 bg-white p-3"
                              >
                                <div className="text-sm font-semibold text-gray-900">
                                  {it?.title || "-"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {it?.imageUrl ? it.imageUrl : "No image URL"}
                                </div>
                                <div className="mt-1 text-sm text-gray-700">
                                  {it?.description || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {key === "whoWeHelpSection" && (
                        <div className="space-y-3">
                          <div className="font-semibold text-gray-900">
                            {payload?.title1 || "-"}
                          </div>
                          <div className="text-sm text-gray-700">
                            {payload?.title2 || "-"}
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            {(payload?.items || []).map((it: any, i: number) => (
                              <div
                                key={i}
                                className="rounded-lg border border-gray-200 bg-white p-3"
                              >
                                <div className="text-sm font-semibold text-gray-900">
                                  {it?.title || "-"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {it?.imageUrl ? it.imageUrl : "No image URL"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {key === "whyChoseUsSection" && (
                        <div className="space-y-3">
                          <div className="font-semibold text-gray-900">
                            {payload?.title1 || "-"}
                          </div>
                          <div className="text-sm text-gray-700">
                            {payload?.title2 || "-"}
                          </div>

                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {payload?.itemsListing?.title || "-"}
                            </div>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                              {(payload?.itemsListing?.lists || []).map(
                                (x: string, i: number) => (
                                  <li key={i}>{x}</li>
                                )
                              )}
                            </ul>

                            <div className="mt-3 inline-flex rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
                              {payload?.itemsListing?.buttonText || "Button"}
                            </div>
                          </div>
                        </div>
                      )}

                      {key === "howItWorksSection" && (
                        <div className="space-y-3">
                          <div className="font-semibold text-gray-900">
                            {payload?.title1 || "-"}
                          </div>
                          <div className="text-sm text-gray-700">
                            {payload?.title2 || "-"}
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            {(payload?.items || []).map((it: any, i: number) => (
                              <div
                                key={i}
                                className="rounded-lg border border-gray-200 bg-white p-3"
                              >
                                <div className="text-sm font-semibold text-gray-900">
                                  {it?.title || "-"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {it?.imageUrl ? it.imageUrl : "No image URL"}
                                </div>
                                <div className="mt-1 text-sm text-gray-700">
                                  {it?.description || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {key === "benefitsSection" && (
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {payload?.title || "-"}
                          </div>

                          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                            {(payload?.items || []).map((x: string, i: number) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>

                          <div className="text-xs text-gray-500">
                            {payload?.imageUrl ? payload.imageUrl : "No image URL"}
                          </div>
                        </div>
                      )}

                      {/* fallback */}
                      {[
                        "bannerSection",
                        "whatWeDoSection",
                        "whoWeHelpSection",
                        "whyChoseUsSection",
                        "howItWorksSection",
                        "benefitsSection",
                      ].includes(key) ? null : (
                        <pre className="max-h-72 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                          {JSON.stringify(payload ?? sec, null, 2)}
                        </pre>
                      )}
                    </AccordionItem>
                  );
                })}
              </div>
            )}

            {showRawSections && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                {JSON.stringify(data.sections ?? [], null, 2)}
              </pre>
            )}
          </SectionCard>

          {/* FAQ */}
          <SectionCard title="FAQ">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">
                Total FAQ: <b>{data.faq?.length ?? 0}</b>
              </div>

              <button
                type="button"
                onClick={() => setShowRawFaq((s) => !s)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {showRawFaq ? "Hide Raw" : "Show Raw"}
              </button>
            </div>

            {!data.faq?.length ? (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                No FAQ items.
              </div>
            ) : (
              <div className="space-y-2">
                {data.faq.map((item, idx) => {
                  const open = openFaqIndex === idx;
                  return (
                    <AccordionItem
                      key={idx}
                      title={item.q || `Question ${idx + 1}`}
                      open={open}
                      onToggle={() => setOpenFaqIndex(open ? null : idx)}
                    >
                      <div className="text-sm text-gray-700">{item.a || "-"}</div>
                    </AccordionItem>
                  );
                })}
              </div>
            )}

            {showRawFaq && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                {JSON.stringify(data.faq ?? [], null, 2)}
              </pre>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
