import {
  APPROVED_ARTWORK_FALLBACKS,
  contentAutomationFixtureMode,
  generationApiConfig,
} from "../config";
import { ArticleDraft, SourceSnapshot } from "../types";
import { MappingResult } from "./map";
import { loadSourceMap } from "../store";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function artworkFor(category: string, title: string): { src: string; alt: string } {
  const key = Object.keys(APPROVED_ARTWORK_FALLBACKS).find((k) =>
    category.toLowerCase().includes(k.toLowerCase()),
  );
  const art = APPROVED_ARTWORK_FALLBACKS[key || "default"] || APPROVED_ARTWORK_FALLBACKS.default;
  return { src: art.src, alt: `${title} — ${art.alt}` };
}

function estimateMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

/** Deterministic original TaxSimba draft used in fixture mode and as generation fallback. */
export function buildFixtureDraft(input: {
  mapping: MappingResult;
  source: SourceSnapshot;
  topicTitle?: string;
  changeSummary: string;
}): ArticleDraft {
  const map = loadSourceMap();
  const existing = input.mapping.slug
    ? map.articles.find((a) => a.slug === input.mapping.slug)
    : undefined;
  const isUpdate = input.mapping.action === "update";
  const title =
    isUpdate && existing
      ? existing.title
      : input.topicTitle ||
        input.source.title ||
        "Practical UK tax guidance from TaxSimba";
  const category = existing?.category || inferCategory(title, input.source);
  const art = artworkFor(category, title);
  const sourceLabel = input.source.title || "GOV.UK guidance";
  const sourceUrl = input.source.url;
  const immediate = isUpdate
    ? `HMRC/GOV.UK guidance linked from this guide has changed. Here is what still matters for your records and next steps.`
    : `Here is a clear answer to a practical UK tax question, checked against current GOV.UK guidance.`;

  const content = `
<p><strong>Immediate answer:</strong> ${escapeHtml(immediate)}</p>
<h2>What changed</h2>
<p>${escapeHtml(input.changeSummary)}</p>
<p>Always re-check the official page before you rely on any summary, including this one. Tax years, thresholds and deadlines can differ by home nation and by your exact income sources.</p>
<h2>Who this guide is for</h2>
<p>This page is for UK individuals who need a practical explanation of ${escapeHtml(category)} rules that affect Self Assessment, Making Tax Digital for Income Tax, rental income, CIS work, platform driving or National Insurance. It is written for readers who want clear next steps rather than a restatement of a press release.</p>
<h2>Practical steps</h2>
<ol>
  <li>Open the official GOV.UK guidance linked below and confirm the rule that applies to your tax year and income type.</li>
  <li>Write down the tax year dates you are dealing with (6 April to 5 April) so seasonal wording does not get mixed with an earlier year.</li>
  <li>Gather the records that support the figures you will report: invoices, platform statements, agent statements, expense evidence and previous submissions.</li>
  <li>If a threshold or start date is involved, work from GOV.UK’s qualifying-income or eligibility wording rather than social media summaries.</li>
  <li>If Making Tax Digital or Self Assessment support would help, compare packages on TaxSimba before you register so you see the service scope first.</li>
</ol>
<h2>Checked example</h2>
<p>Illustrative only: a sole trader with mixed self-employment and a small UK rental interest lists each source, checks the current GOV.UK threshold wording for the relevant start year, then decides whether digital records and quarterly updates are required from 6 April. They keep agent statements showing gross rent separately from bank transfers. Replace every figure with your own and verify on GOV.UK before you act.</p>
<p>A second illustrative case: a CIS subcontractor with platform driving income keeps CIS statements and mileage logs in one place, then checks whether Self Assessment filing and any MTD obligations are separate jobs for different tax years. This example is fictional and does not promise a saving, refund or particular result.</p>
<h2>What to avoid</h2>
<ul>
  <li>Treating a quarterly update as the final tax bill.</li>
  <li>Using profit after expenses when GOV.UK asks for qualifying income.</li>
  <li>Sharing your Government Gateway password with anyone, including an accountant.</li>
  <li>Assuming a competitor blog post is the current official rule.</li>
</ul>
<h2>When to get help</h2>
<p>If your records are incomplete, you have overdue returns, or you are unsure which package fits, use TaxSimba’s package pages to compare support before registration. We do not invent prices, qualifications, guarantees or urgency in this guide.</p>
<h2>Official sources</h2>
<ul>
  <li><a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(sourceLabel)}</a></li>
</ul>
<p class="ts-disclaimer">TaxSimba provides accountant-led support. This guide is general information, not personal tax advice. Rules change by tax year — confirm details on GOV.UK.</p>
`.trim();

  const publishedAt =
    (isUpdate && (input.mapping.firstPublishedAt || existing?.publishedAt)) ||
    new Date().toISOString();

  return {
    slug: input.mapping.slug!,
    title,
    excerpt: immediate.slice(0, 180),
    content,
    metaTitle: title.length <= 60 ? `${title} | TaxSimba` : title.slice(0, 57) + "…",
    metaDescription: immediate.slice(0, 155),
    category,
    audience: existing?.audience || "general",
    tags: [category, "HMRC", "GOV.UK"].filter(Boolean),
    ctaType: (existing?.ctaType as ArticleDraft["ctaType"]) || (category.includes("Digital") ? "MTD" : "SA"),
    relatedSlugs: existing?.relatedSlugs || [],
    relatedPages:
      category.includes("Digital")
        ? ["/mtd-information", "/check-mtd", "/pricing"]
        : ["/pricing", "/self-assessment", "/check-mtd"],
    sources: [
      ...(existing?.sources || []).filter((s) => s.url !== sourceUrl),
      { label: `GOV.UK — ${sourceLabel}`, url: sourceUrl },
    ].slice(0, 8),
    featuredImage: art.src,
    featuredImageAlt: art.alt,
    authorName: "TaxSimba Editorial",
    reviewerName: "Pending qualified tax review",
    publishedAt,
    contentUpdatedAt: new Date().toISOString(),
    readingMinutes: estimateMinutes(content),
    iconKey: "tax-guide",
    contentType: "Guide",
    curatedBaseSlug: isUpdate ? input.mapping.slug! : null,
    changeSummary: input.changeSummary,
    isUpdate,
  };
}

function inferCategory(title: string, source: SourceSnapshot): string {
  const t = `${title} ${source.title || ""} ${source.basePath || ""}`.toLowerCase();
  if (t.includes("mtd") || t.includes("making-tax-digital")) return "Making Tax Digital";
  if (t.includes("landlord") || t.includes("rental") || t.includes("property")) return "Landlords";
  if (t.includes("cis")) return "CIS";
  return "Self Assessment";
}

export async function draftArticle(input: {
  mapping: MappingResult;
  source: SourceSnapshot;
  topicTitle?: string;
  changeSummary: string;
}): Promise<ArticleDraft> {
  if (!input.mapping.slug) {
    throw new Error("Cannot draft without a mapped slug");
  }
  if (contentAutomationFixtureMode() || !generationApiConfig().apiKey) {
    return buildFixtureDraft(input);
  }

  const cfg = generationApiConfig();
  const system = `You write original TaxSimba UK tax guides in natural British English.
Rules: clear immediate answer; practical steps; no invented prices, guarantees or urgency;
cite only verified GOV.UK/HMRC URLs provided; do not copy competitor wording;
HTML fragments only (p, h2, ol, ul, li, a, strong); keep under 1200 words.`;
  const user = JSON.stringify({
    mapping: input.mapping,
    source: {
      url: input.source.url,
      title: input.source.title,
      excerpt: input.source.excerpt,
      updated: input.source.publicUpdatedAt,
    },
    topicTitle: input.topicTitle,
    changeSummary: input.changeSummary,
  });

  try {
    const res = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Return JSON with keys title, excerpt, contentHtml, metaTitle, metaDescription.\nContext:\n${user}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Generation API ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as Record<
      string,
      string
    >;
    const base = buildFixtureDraft(input);
    return {
      ...base,
      title: parsed.title || base.title,
      excerpt: parsed.excerpt || base.excerpt,
      content: parsed.contentHtml || base.content,
      metaTitle: (parsed.metaTitle || base.metaTitle).slice(0, 65),
      metaDescription: (parsed.metaDescription || base.metaDescription).slice(0, 160),
      readingMinutes: estimateMinutes(parsed.contentHtml || base.content),
    };
  } catch {
    return buildFixtureDraft(input);
  }
}
