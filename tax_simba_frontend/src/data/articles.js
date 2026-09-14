/**
 * Canonical TaxSimba public article registry.
 * Used as the scalable source for /blogs and /blogs/[slug],
 * with optional CMS/API articles merged on top for non-overlapping slugs.
 */

export const ARTICLE_CTA = {
  SA: { href: "/register", label: "Start Self Assessment with TaxSimba" },
  MTD: { href: "/register?role=MTD", label: "Get MTD support with TaxSimba" },
};

/** @typedef {'SA'|'MTD'|'BOTH'} CtaType */

/**
 * @type {Array<{
 *  id: string,
 *  slug: string,
 *  title: string,
 *  excerpt: string,
 *  content: string,
 *  metaTitle: string,
 *  metaDescription: string,
 *  category: string,
 *  audience: string,
 *  tags: string[],
 *  publishedAt: string,
 *  reviewedAt: string,
 *  authorName: string,
 *  reviewerName: string,
 *  featuredImage: string,
 *  featuredImageAlt: string,
 *  ctaType: CtaType,
 *  relatedSlugs: string[],
 *  relatedPages: Array<{href: string, label: string}>,
 *  sources: Array<{label: string, url: string}>,
 *  curated?: boolean,
 * }>}
 */
export const articles = [
  {
    id: "seo-mtd-hmrc-signed-up",
    slug: "hmrc-signed-me-up-for-making-tax-digital",
    title: "HMRC Signed Me Up for Making Tax Digital — What Do I Do?",
    excerpt:
      "If HMRC has told you that Making Tax Digital for Income Tax applies to you, here is what it means, what you need to do next, and how an accountant-led service can help.",
    metaTitle: "HMRC Signed Me Up for Making Tax Digital — What To Do | TaxSimba",
    metaDescription:
      "HMRC has signed you up for Making Tax Digital for Income Tax. Learn what that means, what happens next with digital records and quarterly updates, and how TaxSimba’s accountant-led MTD service can help.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "hmrc", "income-tax", "quarterly-updates"],
    publishedAt: "2026-09-14T09:00:00.000Z",
    reviewedAt: "2026-09-14T09:00:00.000Z",
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Making Tax Digital guidance for UK sole traders and landlords",
    ctaType: "MTD",
    relatedSlugs: [
      "making-tax-digital-explained",
      "understanding-self-assessment-uk",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD information and packages" },
      { href: "/check-mtd", label: "Check if MTD applies to you" },
      { href: "/rental-income-tax", label: "MTD for landlords" },
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
    ],
    sources: [
      {
        label: "GOV.UK — Using Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/using-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Check if Making Tax Digital for Income Tax applies to you",
        url: "https://www.gov.uk/guidance/check-if-making-tax-digital-for-income-tax-applies-to-you",
      },
    ],
    curated: true,
    content: `
<p><strong>Immediate answer:</strong> If HMRC has told you that Making Tax Digital (MTD) for Income Tax applies to you, you will need to keep digital business records and send quarterly income and expense updates to HMRC — usually through compatible software or an authorised agent. You do not need to become a tax-software expert overnight. An accountant-led service can handle the MTD process for you.</p>

<h2>What does “HMRC signed me up” usually mean?</h2>
<p>HMRC may contact you when its records show you are in scope for Making Tax Digital for Income Tax Self Assessment (often called MTD for ITSA). That contact is a signal that HMRC expects you to follow the MTD rules from your start date — not that TaxSimba or any software has automatically enrolled you.</p>
<p>In practice, it means HMRC expects digital record-keeping and regular digital submissions for the income types covered by MTD, instead of relying only on a once-a-year paper-style Self Assessment process.</p>

<h2>Who does MTD for Income Tax affect?</h2>
<p>MTD for Income Tax is being phased in for people with qualifying income from self-employment and/or property. HMRC uses income thresholds and start dates set out in official guidance. Paye salary, pensions, dividends and savings interest are generally treated differently and are not used in the same way as qualifying self-employment or property income when checking MTD thresholds.</p>
<p>If you are unsure whether you are in scope, use HMRC’s official checker and, if needed, ask an accountant to review your income mix.</p>

<h2>Example</h2>
<p>Sam is a sole trader with property rental income as well. HMRC writes to Sam confirming MTD for Income Tax applies from Sam’s start date. Sam still has Self Assessment obligations, but must also keep digital records of business and property transactions and send quarterly updates covering those activities. Sam appoints TaxSimba as agent so an accountant-led team can manage the MTD workflow, while Sam supplies records and answers questions.</p>

<h2>Common mistake</h2>
<p>Ignoring the letter because “I already file a Self Assessment return.” MTD for Income Tax adds digital record and quarterly update duties on top of the annual Self Assessment / final declaration process. Waiting until January can leave you without the records and quarterly submissions HMRC expects.</p>

<h2>What you should do next</h2>
<ol>
  <li>Read HMRC’s message carefully and note any start date or reference.</li>
  <li>Check whether MTD applies using official GOV.UK guidance.</li>
  <li>Decide how you will keep digital records (yourself with compatible tools, or through an accountant/agent).</li>
  <li>Plan for quarterly updates as well as the year-end final declaration.</li>
  <li>If you want help, appoint an agent and gather bank statements, invoices, expense records and property income details.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>TaxSimba is an <strong>accountant-led</strong> Making Tax Digital service. Our accountants and platform workflow help you collect the right information, keep the MTD process organised, and manage quarterly updates and related Self Assessment steps — without expecting you to become an HMRC software specialist.</p>
<p>We do not claim to be DIY accounting software or an automated robot that files without accountant involvement. You remain responsible for providing complete and accurate information.</p>

<p>General information only — not personal tax advice. Rules and dates can change; always check current GOV.UK guidance for your situation.</p>
`,
  },
  {
    id: "static-1",
    slug: "understanding-self-assessment-uk",
    title: "A Simple Guide to UK Self Assessment",
    excerpt:
      "Self Assessment is how HMRC collects Income Tax from people who need to report income themselves each year — including many self-employed people and landlords.",
    metaTitle: "UK Self Assessment Guide — Who Needs to File | TaxSimba",
    metaDescription:
      "Plain-English guide to UK Self Assessment: who needs to file, allowable expenses, key dates, and how TaxSimba’s accountant-led service helps you submit confidently.",
    category: "Self Assessment",
    audience: "self-assessment",
    tags: ["self-assessment", "hmrc", "deadlines"],
    publishedAt: "2024-03-20T10:00:00.000Z",
    reviewedAt: "2026-09-14T09:00:00.000Z",
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "UK Self Assessment tax return guidance",
    ctaType: "SA",
    relatedSlugs: ["hmrc-signed-me-up-for-making-tax-digital", "top-tax-saving-tips-uk"],
    relatedPages: [
      { href: "/self-assessment", label: "Online Self Assessment accountant" },
      { href: "/pricing", label: "Self Assessment packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Self Assessment tax returns",
        url: "https://www.gov.uk/self-assessment-tax-returns",
      },
    ],
    curated: true,
    content: `
<p><strong>Immediate answer:</strong> Self Assessment is HMRC’s system for collecting Income Tax from people who need to report certain income themselves. If you are self-employed, a landlord, or have other untaxed income, you may need to file a return each year.</p>

<h2>What Self Assessment means</h2>
<p>Instead of tax being collected only through PAYE, you tell HMRC about your income and claim allowable expenses, then pay any tax due by the deadlines HMRC sets.</p>

<h2>Who it affects</h2>
<p>You may need to file if you earned more than the trading allowance threshold from self-employment, received taxable rental income, had untaxed foreign income, or meet other HMRC criteria (for example certain high incomes or Child Benefit charges). Check GOV.UK if you are unsure.</p>

<h2>Example</h2>
<p>Priya freelances alongside a part-time job. PAYE covers her employment income, but her freelance profit still needs reporting through Self Assessment so HMRC can collect the right Income Tax and National Insurance.</p>

<h2>Common mistake</h2>
<p>Missing allowable expenses that are wholly and exclusively for business — such as relevant travel, insurance, or equipment — and overpaying tax as a result.</p>

<h2>What to do next</h2>
<ol>
  <li>Confirm whether you need to register for Self Assessment.</li>
  <li>Gather income records and expense evidence.</li>
  <li>Note the online filing and payment deadlines on GOV.UK.</li>
  <li>Decide whether to prepare the return yourself or use an accountant-led service.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>TaxSimba’s accountants guide you through an online Self Assessment process: you provide information and documents, we prepare and review the return, and you approve before filing where applicable.</p>

<p>General information only — not personal tax advice.</p>
`,
  },
  {
    id: "static-2",
    slug: "top-tax-saving-tips-uk",
    title: "Top Tax-Saving Tips for Small Businesses in the UK",
    excerpt:
      "Practical ways sole traders and small businesses can stay compliant while claiming what they are entitled to — without aggressive tax schemes.",
    metaTitle: "Tax-Saving Tips for UK Sole Traders & Small Businesses | TaxSimba",
    metaDescription:
      "Practical UK tax tips for sole traders and small businesses: allowable expenses, record-keeping, and when an accountant-led Self Assessment service helps.",
    category: "Self Assessment",
    audience: "sole-traders",
    tags: ["expenses", "sole-trader", "self-assessment"],
    publishedAt: "2024-04-15T09:00:00.000Z",
    reviewedAt: "2026-09-14T09:00:00.000Z",
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Tax tips for UK small businesses and sole traders",
    ctaType: "SA",
    relatedSlugs: ["understanding-self-assessment-uk", "making-tax-digital-explained"],
    relatedPages: [
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
      { href: "/self-assessment", label: "Self Assessment accountant service" },
    ],
    sources: [
      {
        label: "GOV.UK — Expenses if you're self-employed",
        url: "https://www.gov.uk/expenses-if-youre-self-employed",
      },
    ],
    curated: true,
    content: `
<p><strong>Immediate answer:</strong> The most reliable “tax saving” for most sole traders is accurate record-keeping and claiming allowable expenses — not exotic schemes.</p>

<h2>What this means</h2>
<p>HMRC allows you to deduct costs that are wholly and exclusively for your business. Good records make those claims defensible.</p>

<h2>Who it affects</h2>
<p>Self-employed people, freelancers and small traders who report profits through Self Assessment (and, where applicable, Making Tax Digital).</p>

<h2>Example</h2>
<p>A courier who keeps mileage and phone evidence can claim legitimate business costs. Without records, those claims are hard to support if HMRC asks questions.</p>

<h2>Common mistake</h2>
<p>Mixing personal and business spending with no audit trail, then guessing expenses at year end.</p>

<h2>What to do next</h2>
<ol>
  <li>Separate business transactions where practical.</li>
  <li>Store invoices and bank evidence digitally.</li>
  <li>Review HMRC’s allowable expenses guidance.</li>
  <li>Use an accountant if your affairs are mixed or growing.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>Our accountant-led Self Assessment service helps you organise information and prepare an accurate return — without promising unrealistic “guaranteed savings.”</p>

<p>General information only — not personal tax advice.</p>
`,
  },
  {
    id: "static-3",
    slug: "making-tax-digital-explained",
    title: "Making Tax Digital (MTD): What You Need to Know",
    excerpt:
      "Making Tax Digital for Income Tax changes how many sole traders and landlords keep records and report to HMRC. Here is the plain-English version.",
    metaTitle: "Making Tax Digital for Income Tax Explained | TaxSimba",
    metaDescription:
      "What Making Tax Digital for Income Tax means for sole traders and landlords: digital records, quarterly updates, and how an accountant-led TaxSimba service can help.",
    category: "Making Tax Digital",
    audience: "mtd",
    tags: ["mtd", "landlords", "sole-traders"],
    publishedAt: "2024-05-02T11:30:00.000Z",
    reviewedAt: "2026-09-14T09:00:00.000Z",
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Making Tax Digital for Income Tax overview",
    ctaType: "MTD",
    relatedSlugs: [
      "hmrc-signed-me-up-for-making-tax-digital",
      "understanding-self-assessment-uk",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant" },
      { href: "/check-mtd", label: "MTD eligibility checker" },
      { href: "/mtd-information", label: "MTD packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/using-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p><strong>Immediate answer:</strong> Making Tax Digital for Income Tax requires many sole traders and landlords to keep digital records and send quarterly updates to HMRC, alongside year-end obligations.</p>

<h2>What the rules mean</h2>
<p>MTD is about digital record-keeping and regular digital reporting for qualifying income. It is separate from older “file once in January” habits, even though Self Assessment still matters for your overall tax position.</p>

<h2>Who it affects</h2>
<p>People with qualifying income from self-employment and/or property who meet HMRC’s phased thresholds and dates. Check GOV.UK for the current rules that apply to you.</p>

<h2>Example</h2>
<p>A landlord above the relevant threshold must keep digital property records and submit quarterly updates, rather than leaving everything to a single annual spreadsheet tidy-up.</p>

<h2>Common mistake</h2>
<p>Assuming MTD for VAT experience automatically covers Income Tax MTD — they are related ideas but different regimes.</p>

<h2>What to do next</h2>
<ol>
  <li>Confirm whether you are in scope.</li>
  <li>Choose how digital records will be kept.</li>
  <li>Diary quarterly update periods.</li>
  <li>Decide whether to appoint an accountant/agent.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>TaxSimba provides accountant-led MTD support: we help manage the process so you are not left alone with software complexity.</p>

<p>General information only — not personal tax advice.</p>
`,
  },
];

export function getPublishedArticles() {
  return [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getArticleBySlug(slug) {
  if (!slug) return null;
  return articles.find((a) => a.slug === slug) || null;
}

export function getRelatedArticles(article, limit = 3) {
  if (!article) return [];
  const fromSlugs = (article.relatedSlugs || [])
    .map((slug) => getArticleBySlug(slug))
    .filter(Boolean);
  if (fromSlugs.length >= limit) return fromSlugs.slice(0, limit);
  const extras = getPublishedArticles().filter(
    (a) => a.slug !== article.slug && !fromSlugs.some((x) => x.slug === a.slug),
  );
  return [...fromSlugs, ...extras].slice(0, limit);
}

export function getCtaForArticle(article) {
  if (!article) return ARTICLE_CTA.SA;
  return ARTICLE_CTA[article.ctaType] || ARTICLE_CTA.SA;
}

export function normalizeApiArticle(raw = {}) {
  return {
    id: raw.id || raw._id || raw.slug,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt || raw.summary || "",
    content: raw.content || "",
    metaTitle: raw.metaTitle || raw.title,
    metaDescription: raw.metaDescription || raw.excerpt || "",
    category: raw.category?.name || raw.category || raw.subCategory?.name || "Tax guides",
    audience: raw.audience || "general",
    tags: raw.tags || [],
    publishedAt: raw.publishedAt || raw.createdAt || new Date().toISOString(),
    reviewedAt: raw.reviewedAt || raw.updatedAt || raw.publishedAt,
    authorName: raw.authorName || raw.author || "TaxSimba Tax Team",
    reviewerName: raw.reviewerName || "TaxSimba Tax Team",
    featuredImage: raw.featuredImage || "/images/tax_blog_default.png",
    featuredImageAlt: raw.featuredImageAlt || raw.title || "TaxSimba guide",
    ctaType: raw.ctaType === "MTD" ? "MTD" : "SA",
    relatedSlugs: raw.relatedSlugs || [],
    relatedPages: raw.relatedPages || [],
    sources: raw.sources || [],
    curated: false,
  };
}

/**
 * Merge curated registry with CMS/API articles.
 * Curated slugs always win so SEO content cannot disappear if the API is empty.
 */
export function mergeArticlesWithApi(apiArticles = []) {
  const map = new Map();
  for (const article of getPublishedArticles()) {
    map.set(article.slug, article);
  }
  for (const raw of apiArticles) {
    if (!raw?.slug) continue;
    if (map.has(raw.slug) && map.get(raw.slug).curated) continue;
    if (!map.has(raw.slug)) map.set(raw.slug, normalizeApiArticle(raw));
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getFeaturedArticles(limit = 3) {
  return getPublishedArticles().slice(0, limit);
}

export function getAllArticleSlugs() {
  return getPublishedArticles().map((a) => a.slug);
}

/** Backward-compatible export name used across the app */
export const staticBlogs = articles;
