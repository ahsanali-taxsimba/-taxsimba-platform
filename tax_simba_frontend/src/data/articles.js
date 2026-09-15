/**
 * Canonical TaxSimba public article registry.
 * Used as the scalable source for /blogs and /blogs/[slug],
 * with optional CMS/API articles merged on top for non-overlapping slugs.
 *
 * Commercial keyword ownership stays on service pages (see SEO cannibalisation plan).
 * Blog articles answer informational/problem searches and link into those hubs.
 */

export const ARTICLE_CTA = {
  SA: { href: "/register", label: "Start Self Assessment with TaxSimba" },
  MTD: { href: "/register?role=MTD", label: "Get MTD support with TaxSimba" },
  CHECK: { href: "/check-mtd", label: "Check if MTD applies" },
};

/** @typedef {'SA'|'MTD'|'CHECK'|'BOTH'} CtaType */

/** Europe/London calendar date as YYYY-MM-DD. */
export function getLondonCalendarDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Resolve date-window markers in curated article HTML.
 * Markers (any calendar boundary):
 *   <!--deadline:until-YYYY-MM-DD-->...<!--/deadline:until-YYYY-MM-DD-->
 *   <!--deadline:from-YYYY-MM-DD-->...<!--/deadline:from-YYYY-MM-DD-->
 * "until" is inclusive; "from" is inclusive of that calendar day (Europe/London).
 */
export function resolveDeadlineSensitiveHtml(html, now = new Date()) {
  if (!html || !html.includes("<!--deadline:")) return html;
  const londonDate = getLondonCalendarDate(now);
  const keys = new Set();
  for (const match of html.matchAll(
    /<!--deadline:((?:until|from)-\d{4}-\d{2}-\d{2})-->/g,
  )) {
    keys.add(match[1]);
  }
  let out = html;
  for (const key of keys) {
    const parsed = key.match(/^(until|from)-(\d{4}-\d{2}-\d{2})$/);
    if (!parsed) continue;
    const [, kind, date] = parsed;
    const keep = kind === "until" ? londonDate <= date : londonDate >= date;
    if (!keep) {
      out = out.replace(
        new RegExp(
          "<!--deadline:" + key + "-->[\\s\\S]*?<!--/deadline:" + key + "-->",
          "g",
        ),
        "",
      );
    } else {
      out = out.replace(new RegExp("<!--/?deadline:" + key + "-->", "g"), "");
    }
  }
  return out;
}

/**
 * Apply deadline-sensitive HTML and optional title/meta packs.
 * deadlineSwitch: { untilDate: "YYYY-MM-DD", before: {...}, after: {...} }
 * "before" applies while London date <= untilDate; "after" from the next day.
 */
export function withResolvedArticleContent(article, now = new Date()) {
  if (!article) return article;
  const londonDate = getLondonCalendarDate(now);
  let resolved = {
    ...article,
    content: resolveDeadlineSensitiveHtml(article.content || "", now),
  };
  const switcher = article.deadlineSwitch;
  if (switcher?.untilDate && (switcher.before || switcher.after)) {
    const pack =
      londonDate <= switcher.untilDate ? switcher.before : switcher.after;
    if (pack) {
      resolved = {
        ...resolved,
        ...(pack.title ? { title: pack.title } : {}),
        ...(pack.metaTitle ? { metaTitle: pack.metaTitle } : {}),
        ...(pack.metaDescription ? { metaDescription: pack.metaDescription } : {}),
        ...(pack.excerpt ? { excerpt: pack.excerpt } : {}),
      };
    }
  }
  return resolved;
}


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
 *  deadlineSwitch?: { untilDate: string, before?: object, after?: object },
 *  curated?: boolean,
 * }>}
 */
export const articles = [
  {
    id: "seo-mtd-hmrc-signed-up",
    slug: "hmrc-signed-me-up-for-making-tax-digital",
    title: "HMRC Signed Me Up for Making Tax Digital — What Do I Do Next?",
    excerpt:
      "If HMRC has signed you up for Making Tax Digital for Income Tax, here is what that means, the practical steps to take next, and how an accountant-led service can help.",
    metaTitle: "HMRC Signed Me Up for Making Tax Digital — What To Do Next | TaxSimba",
    metaDescription:
      "HMRC signed you up for Making Tax Digital for Income Tax. Plain-English next steps: check your records, choose software or an agent, catch up on digital records and quarterly updates.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "hmrc", "income-tax", "signed-up"],
    publishedAt: "2026-09-14T14:00:00.000Z",
    reviewedAt: "2026-09-14T14:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "UK taxpayer reviewing an HMRC Making Tax Digital signup notice",
    ctaType: "MTD",
    relatedSlugs: [
      "hmrc-mtd-signup-wrong",
      "mtd-exemptions",
      "mtd-qualifying-income",
      "mtd-quarterly-updates",
      "mtd-accountant-or-agent",
      "does-mtd-replace-self-assessment",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD packages and product detail" },
      { href: "/check-mtd", label: "Check if MTD applies to you" },
      { href: "/rental-income-tax", label: "MTD for landlords" },
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
    ],
    sources: [
      {
        label: "GOV.UK — Check what to do if HMRC has signed you up for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/check-what-to-do-if-hmrc-has-signed-you-up-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p><strong>Do this next:</strong> If HMRC has signed you up for Making Tax Digital (MTD) for Income Tax, treat it as a real process change — not junk mail. You need to check the income sources HMRC holds for you, choose compatible software (or appoint an agent), keep digital records from the start of the tax year, and send quarterly updates. You do not have to become a software specialist overnight.</p>

<h2>What “HMRC signed me up” actually means</h2>
<p>From September 2026, HMRC began signing up people who need MTD for Income Tax for the 2026 to 2027 tax year and have not already signed up themselves — typically where HMRC’s records show qualifying income over £50,000 in 2024 to 2025.</p>
<p>When HMRC signs you up, it uses information it already holds from your Self Assessment history. That may not include every change since your last return. Your job is to confirm the details and get the MTD workflow running — yourself with compatible software, or through an authorised agent.</p>
<p>This is not TaxSimba (or any other product) enrolling you. It is HMRC telling you MTD obligations apply.</p>

<h2>What you need to do next</h2>
<ol>
  <li><strong>Sign in to HMRC online services</strong> and open Making Tax Digital for Income Tax.</li>
  <li><strong>Check and confirm your income sources</strong> — self-employment and property details based on what HMRC holds. Add new sources or mark ceased ones if your situation has changed.</li>
  <li><strong>Choose compatible software</strong>, or ask an accountant/agent to handle this for you.</li>
  <li><strong>Catch up on digital records</strong> from the start of the tax year, then send any overdue quarterly updates.</li>
  <li><strong>Keep going through the year</strong> — quarterly updates are part of the design, not an optional extra before January.</li>
</ol>

<h2>Example</h2>
<p>Sam is a sole trader who also lets a flat. HMRC confirms Sam is signed up for MTD for Income Tax. Sam logs into HMRC online services, checks both income sources, and decides not to learn every MTD software screen alone. Sam appoints TaxSimba so an accountant-led team can manage the MTD workflow while Sam supplies bank exports, invoices and rental statements.</p>

<h2>Common mistake</h2>
<p>Putting the letter aside because “I already do Self Assessment.” MTD adds digital record-keeping and quarterly updates for the income types in scope. Leaving everything until January makes catch-up harder — and you need to send the required quarterly updates before you can submit your tax return.</p>

<h3>If you think you were signed up incorrectly</h3>
<p>If your question is “HMRC has put me into MTD, but I think that is wrong,” use the dedicated guide on <a href="/blogs/hmrc-mtd-signup-wrong">disputing an MTD signup</a>. Contact HMRC if you believe you are exempt or should not be in scope — and do not ignore the message while you wait.</p>

<h2>How TaxSimba can help</h2>
<p>TaxSimba is an <strong>accountant-led</strong> Making Tax Digital service. If you have just been signed up and want the process managed, our accountants use TaxSimba’s platform to help you organise records, stay on the quarterly rhythm, and handle the MTD workflow without expecting you to become an HMRC software expert.</p>
<p>You still provide complete, accurate information. We do not describe TaxSimba as DIY accounting software or as automated filing without accountant involvement.</p>
<p>If that is what you need, start with our <a href="/making-tax-digital">Making Tax Digital accountant service</a> and register for MTD support.</p>

<p>General information only — not personal tax advice. Always check current GOV.UK guidance for your situation.</p>
`,
  },
  {
    id: "seo-mtd-qualifying-income",
    slug: "mtd-qualifying-income",
    title: "MTD Qualifying Income Explained — Does the £50,000 Rule Apply to Me?",
    excerpt:
      "Qualifying income is the figure HMRC uses to decide when Making Tax Digital for Income Tax applies. Here is what counts, what does not, and how the £50,000 threshold fits in.",
    metaTitle: "MTD Qualifying Income & the £50,000 Rule Explained | TaxSimba",
    metaDescription:
      "What counts as MTD qualifying income, how the £50,000 (then £30,000 and £20,000) thresholds work, and what to do if you think you are in scope for Making Tax Digital.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "qualifying-income", "thresholds"],
    publishedAt: "2026-09-14T13:30:00.000Z",
    reviewedAt: "2026-09-14T13:30:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Calculator and notes used to work out MTD qualifying income",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-30000-threshold-2027",
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-quarterly-updates",
      "mtd-accountant-or-agent",
      "mtd-digital-records",
      "making-tax-digital-explained",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/check-mtd", label: "MTD checker" },
      { href: "/rental-income-tax", label: "MTD for landlords" },
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
    ],
    sources: [
      {
        label: "GOV.UK — Work out your qualifying income for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p><strong>Short answer:</strong> For Making Tax Digital for Income Tax, “qualifying income” is your gross income from self-employment and property for a tax year — before expenses (turnover). The £50,000 figure is the first threshold: if your qualifying income for 2024 to 2025 was over £50,000, you should have started MTD from 6 April 2026. Later phases use £30,000 and £20,000.</p>

<h2>What counts as qualifying income</h2>
<p>HMRC adds up income from:</p>
<ul>
  <li>self-employment</li>
  <li>property (including, where relevant, more than one source)</li>
</ul>
<p>That total can come from several trades or properties. It is based on the Self Assessment return HMRC uses to assess the relevant year — not on a rough guess from your bank balance.</p>

<h2>What usually does not count</h2>
<p>These are generally <strong>not</strong> part of qualifying income for MTD threshold checks:</p>
<ul>
  <li>employment income taxed through PAYE</li>
  <li>State Pension and private pensions</li>
  <li>dividends (including from your own company)</li>
  <li>your share of profit as an individual partner in a partnership (with limited exceptions explained on GOV.UK)</li>
</ul>
<p>You may still need Self Assessment for those incomes. They just do not drive the MTD qualifying-income total in the same way.</p>

<h2>How the £50,000 rule fits the timeline</h2>
<p>According to current GOV.UK guidance, if your qualifying income is over:</p>
<ul>
  <li><strong>£50,000</strong> for 2024 to 2025 — MTD from <strong>6 April 2026</strong></li>
  <li><strong>£30,000</strong> for 2025 to 2026 — MTD from <strong>6 April 2027</strong></li>
  <li><strong>£20,000</strong> for 2026 to 2027 — MTD from <strong>6 April 2028</strong></li>
</ul>
<p>HMRC reviews returns and may write to you. Even without a letter, it is still your responsibility to check whether you need to use MTD.</p>

<h2>Example</h2>
<p>Jordan has £27,000 rental turnover and £26,000 self-employment turnover in the same tax year. Qualifying income is £53,000 before expenses. That is over £50,000, so the April 2026 MTD start can apply even though neither figure alone looks “huge.”</p>

<h2>Common mistake</h2>
<p>Using profit after expenses, or adding PAYE salary into the total, then deciding you are “safely under £50,000.” Threshold checks are based on HMRC’s qualifying-income rules — read the official page rather than social media shortcuts.</p>

<h2>What to do next</h2>
<ol>
  <li>Work out your self-employment and property totals using GOV.UK’s qualifying-income guidance.</li>
  <li>Use HMRC’s checker / TaxSimba’s <a href="/check-mtd">MTD checker</a> as a practical prompt — then confirm against official rules.</li>
  <li>If you are in scope (or already signed up), plan digital records and quarterly updates.</li>
  <li>Decide whether you want accountant-led support.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>If the £50,000 (or later) threshold puts you into MTD and you want the process managed, TaxSimba’s <a href="/making-tax-digital">accountant-led MTD service</a> helps you organise the right information and keep quarterly reporting moving. We explain the rules in plain English; we do not invent shortcuts around HMRC thresholds.</p>

<p>General information only — not personal tax advice. Thresholds and dates can change; check GOV.UK for your year.</p>
`,
  },
  {
    id: "seo-mtd-quarterly-updates",
    slug: "mtd-quarterly-updates",
    title: "MTD Quarterly Updates — What Do I Actually Need to Send?",
    excerpt:
      "Quarterly updates are summaries of your self-employment and property income and expenses — not a full tax return. Here is what goes to HMRC and when.",
    metaTitle: "MTD Quarterly Updates Explained — What You Need to Send | TaxSimba",
    metaDescription:
      "What Making Tax Digital quarterly updates include, standard deadlines (7 August, 7 November, 7 February, 7 May), and how an accountant-led service can help you stay on track.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "quarterly-updates", "deadlines"],
    publishedAt: "2026-09-14T13:00:00.000Z",
    reviewedAt: "2026-09-14T13:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar marking Making Tax Digital quarterly update deadlines",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-quarterly-deadline-7-november-2026",
      "mtd-qualifying-income",
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-digital-records",
      "missed-mtd-quarterly-update",
      "making-tax-digital-explained",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD packages" },
      { href: "/check-mtd", label: "Check if MTD applies" },
    ],
    sources: [
      {
        label: "GOV.UK — Send quarterly updates (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
      {
        label: "GOV.UK — Create digital records",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p><strong>Short answer:</strong> An MTD quarterly update is a summary of totals for your self-employment and/or property income and expense categories — created from your digital records and sent to HMRC through compatible software (or by an agent). It is <em>not</em> your full year-end tax return, and HMRC does not receive every individual invoice.</p>

<h2>What actually gets sent</h2>
<p>Your software adds up digital records for each business and produces totals using the same broad income and expense categories used in Self Assessment. Each quarterly update covers from the start of the tax year to the end of that update period, so it shows year-to-date totals. If you need to correct something, update your digital records in the software so later updates reflect the right figures, following HMRC’s process.</p>
<p>You do not need to make accounting or tax adjustments before sending a quarterly update. If you had no income or expenses in a period, you still need to send the update.</p>

<h2>When they are due (standard update periods)</h2>
<p>If your accounting period aligns with the tax year (6 April to 5 April), GOV.UK sets out standard periods and deadlines including:</p>
<ul>
  <li>6 April to 5 July — send by <strong>7 August</strong></li>
  <li>6 April to 5 October — send by <strong>7 November</strong></li>
  <li>6 April to 5 January — send by <strong>7 February</strong></li>
  <li>6 April to 5 April — send by <strong>7 May</strong> (following tax year)</li>
</ul>
<p>Calendar update periods exist for some 1 April–31 March accounting periods. The send-by deadlines above stay the same. Your software should show the dates that apply to you.</p>

<h2>Example</h2>
<p>Riley is a self-employed electrician in MTD. Throughout the year Riley stores invoices and expenses digitally. Before each deadline, compatible software (used with accountant oversight through TaxSimba) produces the quarterly totals for Riley to check, then sends the update. Riley is not emailing HMRC a folder of PDF receipts every quarter.</p>

<h2>Common mistake</h2>
<p>Treating quarterlies as optional “practice runs” before Self Assessment. For people in MTD, quarterly updates are required. For 2026 to 2027, HMRC will not apply penalty points for late quarterly updates — but you still need to send them before you can submit your tax return, and late-return penalties can still apply.</p>

<h2>What to do next</h2>
<ol>
  <li>Confirm you are in MTD (or have been signed up).</li>
  <li>Keep digital records as you go — not in a January shoebox.</li>
  <li>Diary the quarterly deadlines your software shows.</li>
  <li>Decide whether an accountant/agent should send updates for you.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>TaxSimba’s <a href="/making-tax-digital">accountant-led MTD service</a> is built for people who want help with the quarterly rhythm without living inside HMRC software manuals. You supply records; accountants help manage the workflow and keep updates moving as part of the managed service.</p>

<p>General information only — not personal tax advice. Always check current GOV.UK deadlines for your update period type.</p>
`,
  },
  {
    id: "seo-sa-deadline-2027",
    slug: "self-assessment-deadline",
    title: "Self Assessment Deadline 2027 — Dates You Need to Know",
    excerpt:
      "For the 2025 to 2026 tax year, the online Self Assessment deadline is 31 January 2027. Here are the key dates, what happens if you are late, and how to prepare.",
    metaTitle: "Self Assessment Deadline 2027 — Key Dates | TaxSimba",
    metaDescription:
      "Self Assessment deadlines for January 2027: online filing and payment by 31 January, paper return by 31 October 2026, and what to do if you need to register or may be late.",
    category: "Self Assessment",
    audience: "self-assessment",
    tags: ["self-assessment", "deadlines", "31-january"],
    publishedAt: "2026-09-14T12:30:00.000Z",
    reviewedAt: "2026-09-14T12:30:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar highlighting the 31 January Self Assessment deadline",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-register-by-5-october-2026",
      "self-assessment-documents-checklist",
      "payments-on-account-explained",
      "late-self-assessment-penalties",
      "self-assessment-for-sole-traders-2025-26",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Online Self Assessment accountant" },
      { href: "/pricing", label: "Self Assessment packages" },
      { href: "/self-assessment-guide", label: "Self Assessment guide" },
      { href: "/making-tax-digital", label: "Also need MTD support?" },
    ],
    sources: [
      {
        label: "GOV.UK — Self Assessment tax returns: deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Self Assessment tax returns",
        url: "https://www.gov.uk/self-assessment-tax-returns",
      },
      {
        label: "GOV.UK — Understand your Self Assessment bill: payments on account",
        url: "https://www.gov.uk/understand-self-assessment-bill/payments-on-account",
      },
    ],
    curated: true,
    content: `
<p><strong>Short answer:</strong> For the 2025 to 2026 tax year (6 April 2025 to 5 April 2026), HMRC must receive your <strong>online</strong> Self Assessment return and any tax you owe by <strong>11:59pm on 31 January 2027</strong>. Miss that and you can face late filing and late payment penalties.</p>

<h2>Key dates for the 2027 filing season</h2>
<ul>
  <li><strong>31 October 2026</strong> — paper tax return deadline (if you still file on paper).</li>
  <li><strong>30 December 2026</strong> — online deadline if you want HMRC to collect through your tax code where that option applies.</li>
  <li><strong>31 January 2027</strong> — online return and payment deadline for most people.</li>
  <li><strong>31 July</strong> — second payment on account deadline where payments on account apply.</li>
</ul>
<p>If you need to tell HMRC you should be in Self Assessment for the first time (or again after a gap), GOV.UK also sets a <strong>5 October</strong> registration-related deadline for the previous tax year — check the deadlines page for the exact wording that applies to you.</p>

<h2>What “deadline” covers</h2>
<p>People often hear “31 January” and only think about clicking submit. In practice you usually need:</p>
<ul>
  <li>the return filed online, and</li>
  <li>the balancing payment paid on time</li>
</ul>
<p>Filing on time but paying late can still create charges. Payments on account, if they apply, are a separate rhythm — not a surprise “extra bill” invented by your accountant.</p>

<h2>Example</h2>
<p>Priya freelances and also has a small rental. She gathers records in autumn, uses TaxSimba’s accountant-led Self Assessment service to prepare the return, reviews it in December, and files well before 31 January 2027 instead of discovering missing invoices in the last week of January.</p>

<h2>Common mistake</h2>
<p>Waiting for a perfect final bank export on 30 January. If something is missing, you still need a plan: file on time with best available figures only where HMRC rules allow, or get advice quickly — do not simply ghost the deadline.</p>

<h2>What to do next</h2>
<ol>
  <li>Confirm which tax year you are filing for and diary <strong>31 January 2027</strong>.</li>
  <li>Build a document checklist (income, expenses, property, dividends, and so on).</li>
  <li>Start early if your affairs are mixed or you may also have MTD obligations.</li>
  <li>Choose DIY software carefully — or use an accountant-led service if you want preparation handled.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>TaxSimba is an <strong>accountant-led</strong> online Self Assessment service. For deadline season, that means you upload information, an accountant prepares and reviews the return, and you approve before filing where that step applies. See our <a href="/self-assessment">Self Assessment accountant page</a> if you want help hitting January without a last-minute scramble.</p>

<p>General information only — not personal tax advice. Always re-check GOV.UK deadlines for your filing year.</p>
`,
  },
  {
    id: "seo-sa-documents-checklist",
    slug: "self-assessment-documents-checklist",
    title: "What Documents Do I Need for My Self Assessment Tax Return?",
    excerpt:
      "A practical Self Assessment document checklist for sole traders, landlords and people with mixed income — so you are not hunting for paperwork in January.",
    metaTitle: "Self Assessment Documents Checklist | TaxSimba",
    metaDescription:
      "Documents you usually need for a UK Self Assessment tax return: income records, expenses, rental paperwork, savings and dividends, and identity details — plus how TaxSimba helps you organise them.",
    category: "Self Assessment",
    audience: "self-assessment",
    tags: ["self-assessment", "documents", "checklist", "records"],
    publishedAt: "2026-09-14T12:00:00.000Z",
    reviewedAt: "2026-09-14T12:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Organised folders of Self Assessment tax return documents",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-for-landlords-2025-26",
      "self-assessment-for-sole-traders-2025-26",
      "self-assessment-deadline",
      "self-assessment-register-by-5-october-2026",
      "payments-on-account-explained",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Online Self Assessment accountant" },
      { href: "/pricing", label: "Packages and pricing" },
      { href: "/rental-income-tax", label: "Landlords also facing MTD?" },
      { href: "/self-employed-tax-return", label: "Sole traders also facing MTD?" },
    ],
    sources: [
      {
        label: "GOV.UK — Self Assessment tax returns",
        url: "https://www.gov.uk/self-assessment-tax-returns",
      },
      {
        label: "GOV.UK — Self-employed records",
        url: "https://www.gov.uk/self-employed-records",
      },
      {
        label: "GOV.UK — Expenses if you're self-employed",
        url: "https://www.gov.uk/expenses-if-youre-self-employed",
      },
      {
        label: "GOV.UK — Income Tax when you rent out a property: working out your rental income",
        url: "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
      },
    ],
    curated: true,
    content: `
<p><strong>Short answer:</strong> You need enough evidence to report your income and claim what you are entitled to claim — usually identity/HMRC references, income records, expense evidence, and anything extra that applies to you (property, investments, foreign income, student loans, and so on). You do not need a perfect filing cabinet, but you do need a trail HMRC could ask about.</p>

<h2>Core documents most people should gather</h2>
<ul>
  <li>National Insurance number and Unique Taxpayer Reference (UTR) if you have one</li>
  <li>P60 / P45 / P11D where you also had employment</li>
  <li>Bank statements covering the tax year</li>
  <li>Records of other untaxed income you must report</li>
</ul>

<h2>If you are self-employed or freelancing</h2>
<ul>
  <li>Sales invoices and payment records (turnover)</li>
  <li>Expense receipts and bills that are wholly and exclusively for business</li>
  <li>Mileage or travel logs if you claim them</li>
  <li>Home-as-office workings if relevant</li>
  <li>Details of any stock, equipment or capital purchases</li>
</ul>
<p>HMRC expects you to keep business records; digital copies are fine if they are clear and complete.</p>

<h2>If you have rental income</h2>
<ul>
  <li>Rent received (statements from agents help)</li>
  <li>Allowable property expenses (repairs, insurance, agent fees, and similar)</li>
  <li>Mortgage interest information where it affects your property calculations</li>
  <li>Dates properties were let, empty or personally used</li>
</ul>

<h2>Other common extras</h2>
<ul>
  <li>Dividend vouchers or broker summaries</li>
  <li>Bank / building society interest certificates</li>
  <li>Capital gains information if you disposed of assets</li>
  <li>Pension contribution records</li>
  <li>Charitable donation evidence for Gift Aid</li>
  <li>Student loan plan details if repayments interact with your return</li>
</ul>

<h2>Example</h2>
<p>Alex freelances and lets one flat. Before using TaxSimba, Alex exports business bank CSV files, saves PDF invoices, downloads the letting agent’s annual statement, and photographs repair receipts. The accountant can prepare the return from that pack instead of chasing missing items in January.</p>

<h2>Common mistake</h2>
<p>Keeping only the “big” invoices and losing small recurring costs (software, phone, insurance). Those small items add up — and without evidence they are hard to support if HMRC asks questions.</p>

<h2>What to do next</h2>
<ol>
  <li>List your income types for the tax year.</li>
  <li>Create a simple folder (digital is fine) per category.</li>
  <li>Note gaps early — do not discover them on 30 January.</li>
  <li>If you want help, use an accountant-led service and upload as you go.</li>
</ol>

<h2>How TaxSimba can help</h2>
<p>On TaxSimba’s <a href="/self-assessment">accountant-led Self Assessment service</a>, you upload the documents and answers your accountant needs. We prepare and review the return; you review and approve before filing where that step applies. Good records make that process faster and clearer — for you and for us.</p>

<p>General information only — not personal tax advice. Your exact document list depends on your income mix.</p>
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
    reviewedAt: "2026-09-14T12:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "UK Self Assessment tax return guidance",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-deadline",
      "self-assessment-documents-checklist",
      "hmrc-signed-me-up-for-making-tax-digital",
    ],
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
    reviewedAt: "2026-09-14T12:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Tax tips for UK small businesses and sole traders",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-documents-checklist",
      "understanding-self-assessment-uk",
      "making-tax-digital-explained",
    ],
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
    reviewedAt: "2026-09-14T13:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Making Tax Digital for Income Tax overview",
    ctaType: "MTD",
    relatedSlugs: [
      "does-mtd-replace-self-assessment",
      "mtd-exemptions",
      "mtd-for-sole-traders-2026-27",
      "mtd-for-landlords-2026-27",
      "mtd-qualifying-income",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant" },
      { href: "/check-mtd", label: "MTD eligibility checker" },
      { href: "/mtd-information", label: "MTD packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
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
<p>TaxSimba provides accountant-led MTD support: we help manage the process so you are not left alone with software complexity. See our <a href="/making-tax-digital">MTD accountant service</a> for the commercial next step.</p>

<p>General information only — not personal tax advice.</p>
`,
  },
  {
    id: "seo-mtd-accountant-or-agent",
    slug: "mtd-accountant-or-agent",
    title: "Can an Accountant Handle Making Tax Digital for Me?",
    excerpt:
      "Yes — you can appoint an accountant or agent for Making Tax Digital for Income Tax. Here is what they can do, what you still need to provide, and how an accountant-led service differs from DIY software.",
    metaTitle: "Can an Accountant Handle Making Tax Digital for Me? | TaxSimba",
    metaDescription:
      "Can an accountant or agent handle Making Tax Digital for Income Tax? What agents can do, what records you still supply, and how TaxSimba’s accountant-led MTD support works.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "accountant", "agent", "sole-trader", "landlord"],
    publishedAt: "2026-09-15T10:00:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "UK taxpayer meeting an accountant about Making Tax Digital",
    ctaType: "MTD",
    relatedSlugs: [
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-qualifying-income",
      "mtd-quarterly-updates",
      "mtd-digital-records",
      "making-tax-digital-explained",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/check-mtd", label: "Check if MTD applies to you" },
      { href: "/mtd-information", label: "MTD packages" },
      { href: "/rental-income-tax", label: "MTD for landlords" },
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
    ],
    sources: [
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Sign up your client for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/sign-up-your-client-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Choose the right software for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Create digital records",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
    ],
    curated: true,
    content: `
<p>If Making Tax Digital for Income Tax applies to you, you do not have to run the software alone. GOV.UK’s guidance is written for you <em>or</em> your agent: an authorised accountant can help keep digital records, send quarterly updates, and submit your tax return using compatible software.</p>

<p>Appointing help does not hand HMRC responsibility to someone else in the abstract. You still need to supply complete, accurate information. The accountant manages process and software — they cannot invent missing invoices or guess rent you never recorded.</p>

<h2>What an authorised agent can typically help with</h2>
<p>In practice, once you have authorised an agent for MTD (and they have the right HMRC agent services setup), they can usually help with:</p>
<ul>
  <li>signing you up for MTD where that step is still needed</li>
  <li>choosing and connecting compatible software</li>
  <li>creating and maintaining digital records from the evidence you provide</li>
  <li>preparing and sending quarterly updates</li>
  <li>helping you complete and submit the year-end tax return through that software</li>
</ul>
<p>Exact permissions depend on how you authorise them. Ask your accountant to spell out what they will do and what stays with you.</p>

<h2>Checklist: what you normally still need to do</h2>
<ol>
  <li><strong>Authorise the agent</strong> for Making Tax Digital for Income Tax (and Self Assessment where relevant) through HMRC’s agent processes.</li>
  <li><strong>Confirm your income sources</strong> — self-employment, UK or foreign property, or both — so the right records and updates are set up.</li>
  <li><strong>Hand over usable evidence</strong> on a steady rhythm: bank exports, sales invoices, expense receipts, letting-agent statements, and notes for anything unusual.</li>
  <li><strong>Answer clarifying questions</strong> when a transaction is unclear (private vs business, which property, which category).</li>
  <li><strong>Review and approve</strong> work where your service process asks you to, before updates or the return go to HMRC.</li>
  <li><strong>Keep supporting documents</strong> — MTD digital records sit alongside the invoices and statements you still need for Self Assessment evidence.</li>
</ol>
<p>Late or incomplete records make quarterly updates harder for everyone involved. That is a customer-side constraint, not something software can paper over.</p>

<h2>DIY software vs accountant support</h2>
<p>With DIY-compatible software you drive categorisation, submissions, and HMRC screens yourself. With an accountant-led service such as TaxSimba, you feed information through a client workflow and accountants use compatible software to help manage MTD. TaxSimba is not standalone DIY filing software you are expected to run unsupervised.</p>
<p>DIY can still suit simple affairs if you are comfortable with software and will update records weekly. Mixed income, several properties, or a sudden HMRC signup are usually when people want help.</p>

<h2>If you are still checking whether MTD applies</h2>
<p>Use GOV.UK’s eligibility guidance and our free <a href="/check-mtd">MTD checker</a>, then read <a href="/blogs/mtd-qualifying-income">how qualifying income thresholds work</a> if the £50,000 (and later) figures are unclear.</p>

<h2>Prefer not to learn every MTD screen?</h2>
<p>Compare packages on <a href="/mtd-information">MTD information</a> and <a href="/pricing">pricing</a>, then start from the <a href="/making-tax-digital">Making Tax Digital accountant service</a> if you want managed support rather than DIY software alone. Authorisation and software choices should still follow current GOV.UK guidance for your situation — this page is general information, not personal tax advice.</p>
`,
  },

  {
    id: "seo-mtd-digital-records",
    slug: "mtd-digital-records",
    title: "MTD Digital Records — What You Actually Need to Keep",
    excerpt:
      "MTD for Income Tax requires digital records of self-employment and property income and expenses. Here is what that means day to day — without the jargon.",
    metaTitle: "MTD Digital Records — What You Need to Keep | TaxSimba",
    metaDescription:
      "What digital records Making Tax Digital for Income Tax requires for sole traders and landlords, how digital links work between software, and how accountant support can help.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "digital-records", "record-keeping", "landlords", "sole-traders"],
    publishedAt: "2026-09-15T09:30:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Digital invoices and bank records prepared for Making Tax Digital",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-for-sole-traders-2026-27",
      "mtd-for-landlords-2026-27",
      "mtd-quarterly-updates",
      "missed-mtd-quarterly-update",
      "mtd-qualifying-income",
      "mtd-accountant-or-agent",
      "hmrc-signed-me-up-for-making-tax-digital",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/check-mtd", label: "MTD checker" },
      { href: "/self-employed-tax-return", label: "MTD for sole traders" },
      { href: "/rental-income-tax", label: "MTD for landlords" },
    ],
    sources: [
      {
        label: "GOV.UK — Create digital records (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
      {
        label: "GOV.UK — Choose the right software for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/choose-the-right-software-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Send quarterly updates",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
    ],
    curated: true,
    content: `
<p>A digital record, in HMRC’s words, is a record of income or expense created and stored in software that works with Making Tax Digital for Income Tax. If MTD applies, you or your agent must keep those records for self-employment and/or property income and expenses. They are what feed quarterly updates later — but this guide is about the records themselves, not how to submit an update.</p>

<p>Paper shoeboxes and a January tidy-up are not the design. You should still keep underlying evidence (invoices, statements, receipts); MTD does not mean “delete everything except software totals.”</p>

<h2>What each digital record needs</h2>
<p>When you create a record, GOV.UK expects at least:</p>
<ul>
  <li><strong>amount</strong></li>
  <li><strong>date</strong> the income was received or the expense incurred</li>
  <li><strong>category</strong> — using the same broad Self Assessment-style categories your software supports</li>
</ul>
<p>Day to day that usually means a clear trail for money in (sales, fees, rent and other taxable income in scope) and money out (allowable expenses), recorded close enough to the transaction that period totals are not guesswork.</p>

<p><strong>Simple example:</strong> a landlord’s boiler repair might be recorded as amount <strong>£240</strong>, date <strong>12 June 2026</strong>, category something like <strong>repairs and maintenance</strong> (wording depends on the software). The invoice PDF still sits in your files as supporting evidence.</p>

<h2>Self-employment vs property — a useful nuance</h2>
<p>If you have more than one sole-trader business, GOV.UK expects separate digital records (and separate quarterly updates) for each. UK rental properties are different: they are generally treated as one <strong>UK property business</strong>, so you do not create a separate MTD “set” per flat — your software rolls UK property income and expenses into that one business (including your share of jointly let UK property). Foreign property has its own rules, including separate digital records per foreign property in many cases, even though they still form one foreign property business for the update. Check GOV.UK if you have mixed UK and overseas lets.</p>

<h2>One product or several — and digital links</h2>
<p>You can use one all-in-one product for records and submissions, or more than one product. If you use more than one, GOV.UK requires them to be <strong>digitally linked</strong> before you send updates or the return.</p>
<p>Legitimate digital links include methods such as:</p>
<ul>
  <li>linked cells or formulas in spreadsheets</li>
  <li>importing or exporting files (for example CSV or XML) between compatible tools</li>
  <li>emailing a spreadsheet of digital records for import into another product</li>
  <li>transferring files on a portable device for import</li>
  <li>automated data transfer or an API connection</li>
</ul>
<p>What is <em>not</em> treated as a digital link is manually rewriting figures, or cutting and pasting records between systems after they have been created. Once a digital record has gone to HMRC in a quarterly update, you must not manually move that record around inside or between products in those non-compliant ways. If multi-product linking sounds fiddly, many people prefer an accountant or agent to design the workflow.</p>

<h2>When to start</h2>
<p>Start from the beginning of the relevant tax year for your accounting period (often 6 April for standard periods, or 1 April if you use calendar update periods). If you join part-way through the year, you may need to catch up records from the start of the year so the first update is complete. Create records as close to each transaction as you reasonably can.</p>

<h2>A common mistake</h2>
<p>Mixing personal and business spending in one account with no labels, then expecting software — or an accountant — to reconstruct everything from vague bank descriptions. Cleaner habits through the year make the records usable. For how those records later roll into HMRC summaries, see <a href="/blogs/mtd-quarterly-updates">what quarterly updates contain</a>; keep this page focused on the underlying trail.</p>

<h2>Getting the record-keeping workflow off your plate</h2>
<p>On TaxSimba’s <a href="/making-tax-digital">MTD service</a>, you still provide documents and answers. Accountants help organise the compatible-software workflow so records stay usable. We do not claim you can skip evidence, and TaxSimba is not DIY bookkeeping software.</p>
<p>Unsure whether MTD applies at all? Confirm on GOV.UK and use the <a href="/check-mtd">MTD checker</a> as a prompt. This is general information only — follow current GOV.UK digital-records guidance for your income types.</p>
`,
  },
{
    id: "seo-mtd-missed-quarterly",
    slug: "missed-mtd-quarterly-update",
    title: "I Missed an MTD Quarterly Update — What Should I Do Now?",
    excerpt:
      "Already past an MTD quarterly deadline? Here is how to catch up, what HMRC’s 2026 to 2027 soft landing means, and when penalty points can apply in later years.",
    metaTitle: "Missed an MTD Quarterly Deadline — Catch-Up Steps | TaxSimba",
    metaDescription:
      "Catch-up steps if you missed an MTD quarterly deadline, HMRC’s 2026 to 2027 soft landing for quarterly penalty points, and how later points-based penalties work.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "missed-deadline", "catch-up", "penalties"],
    publishedAt: "2026-09-15T09:00:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar showing a missed Making Tax Digital quarterly deadline",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-quarterly-deadline-7-november-2026",
      "mtd-quarterly-updates",
      "mtd-digital-records",
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-accountant-or-agent",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Send quarterly updates (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
      {
        label: "GOV.UK — Penalties for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Create digital records",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
    ],
    curated: true,
    content: `
<p>If a quarterly deadline has already passed, treat it as catch-up work — not a reason to ignore HMRC messages until January. Repair the digital records, send the overdue update, then protect the next date.</p>

<p>For how quarterly updates work when you are on track, use the separate guide on <a href="/blogs/mtd-quarterly-updates">what quarterly updates include and when they are due</a>. This page is only about being late.</p>

<h2>Does missing a deadline mean an automatic fine?</h2>
<p><strong>For the 2026 to 2027 tax year, HMRC will not apply penalty points for late quarterly updates.</strong> That soft landing does <em>not</em> make updates optional. You still need to keep digital records and send the quarterly updates — including before you can submit your tax return. Late tax returns and late payment of tax can still attract penalties.</p>
<p>After 2026 to 2027, late quarterly updates sit in HMRC’s points-based late submission system. In outline: each missed quarterly deadline (and, separately, a missed tax return deadline) can attract a penalty point; the threshold is <strong>4 points</strong>; reaching it brings a <strong>£200</strong> penalty, and further missed deadlines while at the threshold can each bring another £200. You only get one point per deadline, even if you have more than one business. Always re-check the current <a href="https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer">GOV.UK MTD penalties page</a> for the year you are in.</p>

<h2>Catch-up sequence that usually works</h2>
<ol>
  <li><strong>Name the gap</strong> — which update period is overdue, and for which self-employment or property business?</li>
  <li><strong>Rebuild the digital records</strong> from the start of the tax year where catch-up is required (invoices, bank exports, rental statements). Guessing totals to clear a screen is a bad trade.</li>
  <li><strong>Send the overdue update</strong> through compatible software, or ask your accountant/agent to send it.</li>
  <li><strong>Confirm it landed</strong> in the software / HMRC view your agent uses, then diary the next deadline your software shows (often 7 August, 7 November, 7 February, 7 May when periods align with the tax year).</li>
  <li><strong>Fix the habit that caused the miss</strong> — monthly record uploads, calendar reminders, or handing the workflow to an agent.</li>
</ol>

<h2>What not to do</h2>
<ul>
  <li>Assume the 2026 to 2027 quarterly soft landing means you can skip updates</li>
  <li>Wait for Self Assessment season and hope the gap disappears</li>
  <li>Invent figures without evidence just to get past a screen</li>
</ul>

<h2>If you want help getting back on track</h2>
<p>TaxSimba’s <a href="/making-tax-digital">Making Tax Digital service</a> is set up for people who need records organised and quarterly reporting moving again without DIY-only catch-up. You still supply the underlying information. Package options are on <a href="/mtd-information">MTD information</a>.</p>
<p>Also useful while you catch up: <a href="/blogs/mtd-digital-records">what digital records to keep</a> and <a href="/blogs/mtd-accountant-or-agent">how an accountant can handle MTD</a>.</p>
<p>Rules change by tax year — confirm deadlines and penalties on GOV.UK before you rely on any summary, including this one. This is general information, not personal tax advice.</p>
`,
  },
{
    id: "seo-sa-payments-on-account",
    slug: "payments-on-account-explained",
    title: "Payments on Account Explained — Why Is HMRC Asking for More?",
    excerpt:
      "Payments on account are advance payments towards next year’s Self Assessment bill. Here is why HMRC asks for them, when they are due, and when they might not apply.",
    metaTitle: "Payments on Account Explained — Self Assessment | TaxSimba",
    metaDescription:
      "Why HMRC asks for Self Assessment payments on account, how the 31 January and 31 July instalments work, when you may not need them, and how to ask for a reduction.",
    category: "Self Assessment",
    audience: "self-assessment",
    tags: ["self-assessment", "payments-on-account", "hmrc", "deadlines"],
    publishedAt: "2026-09-15T08:30:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Self Assessment bill showing payments on account",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-deadline",
      "self-assessment-documents-checklist",
      "late-self-assessment-penalties",
      "understanding-self-assessment-uk",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Online Self Assessment accountant" },
      { href: "/pricing", label: "Self Assessment packages" },
      { href: "/self-assessment-guide", label: "Self Assessment guide" },
    ],
    sources: [
      {
        label: "GOV.UK — Understand your Self Assessment bill: payments on account",
        url: "https://www.gov.uk/understand-self-assessment-bill/payments-on-account",
      },
      {
        label: "GOV.UK — Understand your Self Assessment bill",
        url: "https://www.gov.uk/understand-self-assessment-bill",
      },
      {
        label: "GOV.UK — Self Assessment tax returns: deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Pay your Self Assessment tax bill",
        url: "https://www.gov.uk/pay-self-assessment-tax-bill",
      },
    ],
    curated: true,
    content: `
<p>Payments on account are not a surprise “extra tax.” They are HMRC’s way of collecting Income Tax (and Class 4 National Insurance, where relevant) <em>in advance</em> towards your <strong>next</strong> Self Assessment bill, based on what you owed last year.</p>

<h2>How the two instalments work</h2>
<p>GOV.UK explains that you can spread the cost by paying in two instalments. <strong>Each payment is usually half of the tax you owed last year.</strong> They are due by midnight on <strong>31 January</strong> and <strong>31 July</strong>.</p>
<p>On 31 January you may also owe a balancing payment for the year you have just reported, alongside the first payment on account towards the following year. That stack is why January often looks like two demands at once.</p>

<h2>When they might not apply</h2>
<p>According to GOV.UK, you must make the two payments unless either:</p>
<ul>
  <li>the tax you owed last year was less than <strong>£1,000</strong>, or</li>
  <li>last year you paid more than <strong>80%</strong> of the tax you owed outside Self Assessment (for example through your tax code, or because tax was already deducted at source on some income)</li>
</ul>

<h2>Clearer numbers (January stack)</h2>
<p>Suppose last year’s Self Assessment bill was <strong>£4,000</strong>. Payments on account towards the next year are usually <strong>£2,000 by 31 January</strong> and <strong>£2,000 by 31 July</strong>.</p>
<p>If you had already paid £1,800 on account during the previous cycle against that £4,000 bill, your January amount might look like:</p>
<ul>
  <li><strong>£2,200</strong> balancing payment (£4,000 − £1,800), plus</li>
  <li><strong>£2,000</strong> first payment on account towards the following year</li>
</ul>
<p>So £4,200 could be due on one January date even though nothing “mysterious” has happened. If the following year’s final bill is only £3,000, the excess paid on account is typically settled through the balancing calculation — it is not lost.</p>

<h2>Reducing payments on account</h2>
<p>If you expect to owe less than last year, you can ask HMRC to reduce payments on account (online or by post) using a realistic estimate. Do not reduce them casually: GOV.UK is clear that if you reduce them and your bill turns out higher than expected, <strong>you can be charged interest on the difference</strong>.</p>

<h2>Filing dates vs this article</h2>
<p>Filing deadlines are covered in the <a href="/blogs/self-assessment-deadline">Self Assessment deadline guide</a>. This page is about the advance-payment rhythm that often surprises people after a larger SA bill.</p>

<h2>If you cannot pay</h2>
<p>Contact HMRC early and use the payment options on GOV.UK. Late payment can attract interest and late payment penalties on unpaid tax. Filing on time still matters while you sort payment.</p>

<p>If you want help preparing the return that feeds these figures, TaxSimba’s <a href="/self-assessment">Self Assessment service</a> works from the information you provide. We do not promise a lower bill or a particular payment outcome. Always check your HMRC statement and current GOV.UK guidance — this is general information, not personal advice.</p>
`,
  },
{
    id: "seo-sa-late-penalties",
    slug: "late-self-assessment-penalties",
    title: "Late Self Assessment Filing — Penalties and What To Do Now",
    excerpt:
      "Already late on Self Assessment? Here are the classic late filing and late payment penalties, how the MTD-era penalty rules differ for relevant tax years, and what to do next.",
    metaTitle: "Late Self Assessment Penalties — What To Do Now | TaxSimba",
    metaDescription:
      "Classic Self Assessment late filing and late payment penalties, how Making Tax Digital changes penalties for relevant tax years, and practical steps if you are already late.",
    category: "Self Assessment",
    audience: "self-assessment",
    tags: ["self-assessment", "penalties", "late-filing", "hmrc", "mtd"],
    publishedAt: "2026-09-15T08:00:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Warning letter about a late Self Assessment tax return",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-deadline",
      "payments-on-account-explained",
      "self-assessment-documents-checklist",
      "understanding-self-assessment-uk",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Online Self Assessment accountant" },
      { href: "/pricing", label: "Self Assessment packages" },
      { href: "/self-assessment-guide", label: "Self Assessment guide" },
    ],
    sources: [
      {
        label: "GOV.UK — Self Assessment tax returns: penalties",
        url: "https://www.gov.uk/self-assessment-tax-returns/penalties",
      },
      {
        label: "GOV.UK — Penalties for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Self Assessment tax returns: deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Pay your Self Assessment tax bill",
        url: "https://www.gov.uk/pay-self-assessment-tax-bill",
      },
    ],
    curated: true,
    content: `
<p>If the filing or payment deadline has already passed, move quickly: submit the return you still owe, pay what you can, and read any HMRC penalty notice carefully. Penalties can stack; waiting rarely makes them smaller.</p>
<p>For dates and preparation <em>before</em> the deadline, use the preventive guide on <a href="/blogs/self-assessment-deadline">Self Assessment deadlines</a>. This page is remedial — you are late, or about to be.</p>

<h2>Which penalty regime applies?</h2>
<p>Do not blend these two systems:</p>
<ul>
  <li><strong>Classic Self Assessment penalties</strong> (the familiar £100 / daily / percentage-or-£300 structure) still apply to tax years that are <em>not</em> under the new Making Tax Digital for Income Tax penalty rules — including previous tax years after you join MTD. Example from GOV.UK: if you use MTD from 6 April 2026, the <strong>current</strong> (classic) penalties still apply to your <strong>2025 to 2026</strong> return deadline of <strong>31 January 2027</strong>.</li>
  <li><strong>New MTD Income Tax penalties</strong> apply from the tax year you join Making Tax Digital for Income Tax. They replace the classic late submission and late payment penalties for your personal tax return for that year onward (with limited exceptions such as some trust, estate, partnership or non-resident company returns). See <a href="https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer">GOV.UK — Penalties for Making Tax Digital for Income Tax</a>.</li>
</ul>
<p>If you are unsure which year and regime you are dealing with, check your HMRC messages and the two GOV.UK pages linked in the sources — do not assume the amounts below apply to every return forever.</p>

<h2>Classic Self Assessment late filing penalties</h2>
<p>Where the classic regime applies, GOV.UK sets out that if you need to send a Self Assessment tax return and you send it late, you can get:</p>
<ul>
  <li>an initial <strong>£100</strong> penalty</li>
  <li>after 3 months, daily penalties of <strong>£10 per day</strong>, up to a maximum of <strong>£900</strong></li>
  <li>after 6 months, a further penalty of <strong>5% of the tax due or £300</strong>, whichever is greater</li>
  <li>after 12 months, another <strong>5% or £300</strong> charge, whichever is greater</li>
</ul>
<p>Partnership returns can create penalties for each partner when the partnership return is late. GOV.UK also notes a separate “failure to notify” risk if you register late after 5 October and do not pay your bill by 31 January — check the Self Assessment penalties page for the wording that applies to you.</p>

<h2>Classic late payment penalties</h2>
<p>Under the classic rules, paying late can bring penalties of <strong>5%</strong> of the unpaid tax at 30 days, 6 months and 12 months, plus interest. Filing on time but leaving the bill unpaid is still a problem.</p>

<h2>MTD-era late submission and late payment (separate system)</h2>
<p>Once the new MTD penalties apply for a tax year, late submission uses <strong>penalty points</strong> rather than the classic £100 starting charge for that year’s return (and, after 2026 to 2027, for quarterly updates too). In outline for people required to use MTD: the point threshold is <strong>4</strong>; reaching it brings a <strong>£200</strong> penalty, with further £200 charges for later missed deadlines while at the threshold. For 2026 to 2027 specifically, HMRC will not apply penalty points for late <em>quarterly</em> updates — but points can still apply for a late tax return for that year, and you still need to send quarterly updates before you can submit the return.</p>
<p>Late <em>payment</em> penalties under MTD are also different: they are proportionate to how long the tax stays unpaid (with a longer “first year” window), and they do <strong>not</strong> apply to payments on account. Late payment interest still applies. Full tables and conditions are on the GOV.UK MTD penalties page — this summary is not a substitute for that page.</p>

<h2>What to do now</h2>
<ol>
  <li><strong>File the outstanding return</strong> with the best complete information you can support.</li>
  <li><strong>Pay what you can</strong> and use HMRC’s published payment routes if you need time.</li>
  <li><strong>Read any penalty notice</strong> — payment deadlines and appeal rights matter.</li>
  <li><strong>Consider a reasonable excuse appeal</strong> only where it genuinely fits; “I was busy” is rarely enough on its own.</li>
  <li><strong>Prevent a repeat</strong> — earlier document gathering, or accountant help for the next cycle.</li>
</ol>

<p>If you need a return prepared properly rather than guessing alone, TaxSimba’s <a href="/self-assessment">Self Assessment service</a> works from documents you provide; an accountant prepares and reviews, and you approve before filing where that step applies. We do not guarantee penalty cancellation.</p>
<p>Related reading: <a href="/blogs/self-assessment-documents-checklist">documents checklist</a> and <a href="/blogs/payments-on-account-explained">payments on account</a>. Confirm penalty amounts and which regime applies on current GOV.UK pages — this is general information, not personal tax advice.</p>
`,
  },

  {
    id: "seo-mtd-deadline-7-nov-2026",
    slug: "mtd-quarterly-deadline-7-november-2026",
    title: "MTD Quarterly Deadline: What You Need to Do Before 7 November 2026",
    excerpt:
      "The next Making Tax Digital quarterly update for many people in 2026 to 2027 is due by 7 November 2026. Here is what that deadline covers and what to do before it.",
    metaTitle: "MTD Deadline 7 November 2026 — What To Do | TaxSimba",
    metaDescription:
      "Action checklist for the Making Tax Digital quarterly update due by 7 November 2026: which period it covers, what to send, and how to catch up if records are behind.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "deadline", "7-november-2026", "quarterly-updates"],
    publishedAt: "2026-09-15T16:00:00.000Z",
    reviewedAt: "2026-09-15T18:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar highlighting the 7 November 2026 Making Tax Digital deadline",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-quarterly-updates",
      "missed-mtd-quarterly-update",
      "mtd-digital-records",
      "mtd-accountant-or-agent",
      "hmrc-signed-me-up-for-making-tax-digital",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Send quarterly updates (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax (first-year dates)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/before-you-use-this-guide",
      },
      {
        label: "GOV.UK — Penalties for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<!--deadline:until-2026-11-07-->
<p><strong>Deadline in focus:</strong> if you use standard or calendar update periods for Making Tax Digital for Income Tax in 2026 to 2027, the second quarterly update is due by <strong>7 November 2026</strong>. You can send it any time after the update period ends — you do not have to wait until the deadline day.</p>
<!--/deadline:until-2026-11-07-->
<!--deadline:from-2026-11-08-->
<p><strong>Update after 7 November 2026:</strong> that Making Tax Digital quarterly deadline has passed. If you still need to send the update that was due by 7 November 2026, use the <a href="/blogs/missed-mtd-quarterly-update">missed quarterly update guide</a> for catch-up steps. Below is what that specific deadline covered, so you can check you sent the right period.</p>
<!--/deadline:from-2026-11-08-->

<p>This page is only about the <strong>7 November 2026</strong> quarterly deadline — not a full explainer of every MTD update. For what quarterly updates contain in general, see <a href="/blogs/mtd-quarterly-updates">MTD quarterly updates explained</a>.</p>

<h2>Which period did the 7 November update cover?</h2>
<p>GOV.UK sets the same send-by date for both period types:</p>
<ul>
  <li><strong>Standard update periods</strong> (tax year aligned): totals from <strong>6 April to 5 October</strong> — send by 7 November</li>
  <li><strong>Calendar update periods</strong> (1 April–31 March accounting): totals from <strong>1 April to 30 September</strong> — send by 7 November</li>
</ul>
<p>Each update is cumulative from the start of the tax year to the end of that period. Your software should show the exact window that applies to you.</p>

<!--deadline:until-2026-11-07-->
<h2>Before 7 November — checklist</h2>
<!--/deadline:until-2026-11-07-->
<!--deadline:from-2026-11-08-->
<h2>Checklist for the 7 November 2026 update</h2>
<!--/deadline:from-2026-11-08-->
<ol>
  <li><strong>Confirm you are in MTD</strong> for the income sources involved (self-employment, property, or both).</li>
  <li><strong>Bring digital records up to date</strong> through the end of the update period — amounts, dates and categories in compatible software (or with your agent).</li>
  <li><strong>Check joint property choices</strong> if relevant: for jointly let property, GOV.UK allows income-and-expenses or income-only in quarterly updates (expenses must be sorted later if you omit them).</li>
  <li><strong>Send the update</strong> through compatible software, or ask your accountant/agent to send it.</li>
  <li><strong>Diary the next dates</strong> — typically 7 February 2027 and 7 May 2027 for later 2026 to 2027 updates when periods align.</li>
</ol>

<h2>Penalties for this particular deadline</h2>
<p>For the <strong>2026 to 2027</strong> tax year, HMRC will not apply penalty points for late quarterly updates. That soft landing does <em>not</em> make the update optional: you still need to send quarterly updates before you can submit your tax return. Late tax returns and late payment of tax can still attract penalties. Re-check <a href="https://www.gov.uk/guidance/penalties-for-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer">GOV.UK MTD penalties</a> for the year you are in.</p>

<!--deadline:until-2026-11-07-->
<h2>If records are behind this week</h2>
<p>Prioritise usable totals from bank exports, invoices and (for landlords) agent statements covering the period. Guessing figures just to clear a screen is a poor fix. If you want the workflow handled rather than DIY catch-up alone, TaxSimba’s <a href="/making-tax-digital">Making Tax Digital service</a> is accountant-led — you still supply the evidence.</p>
<!--/deadline:until-2026-11-07-->
<!--deadline:from-2026-11-08-->
<h2>If you still have not sent it</h2>
<p>Follow the catch-up sequence in the <a href="/blogs/missed-mtd-quarterly-update">missed quarterly update guide</a>. TaxSimba’s <a href="/making-tax-digital">Making Tax Digital service</a> is accountant-led if you want help organising records — you still supply the evidence.</p>
<!--/deadline:from-2026-11-08-->

<p>General information only — not personal tax advice. Confirm dates in your software and on current GOV.UK guidance.</p>
`,
  },
  {
    id: "seo-mtd-landlords-2026-27",
    slug: "mtd-for-landlords-2026-27",
    title: "MTD for Landlords: What Landlords Need to Do in 2026/27",
    excerpt:
      "If Making Tax Digital for Income Tax applies to your property income in 2026 to 2027, here is what landlords actually need to do — digital records, quarterly updates, and joint-let points.",
    metaTitle: "MTD for Landlords 2026/27 — What To Do | TaxSimba",
    metaDescription:
      "Landlord-focused Making Tax Digital requirements for 2026 to 2027: UK property business records, quarterly updates, jointly let property, and when to use accountant support.",
    category: "Making Tax Digital",
    audience: "landlords",
    tags: ["mtd", "landlords", "property", "2026-27"],
    publishedAt: "2026-09-15T15:45:00.000Z",
    reviewedAt: "2026-09-15T18:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "UK rental property paperwork prepared for Making Tax Digital",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-digital-records",
      "mtd-quarterly-updates",
      "mtd-qualifying-income",
      "mtd-accountant-or-agent",
      "mtd-for-sole-traders-2026-27",
    ],
    relatedPages: [
      { href: "/rental-income-tax", label: "MTD accountant support for landlords" },
      { href: "/making-tax-digital", label: "Making Tax Digital overview" },
      { href: "/check-mtd", label: "MTD checker" },
    ],
    sources: [
      {
        label: "GOV.UK — Create digital records (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
      {
        label: "GOV.UK — Send quarterly updates",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Work out your qualifying income",
        url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p>Landlords in Making Tax Digital for Income Tax for 2026 to 2027 are not filing a new “property-only tax return” every quarter. You (or your agent) keep <strong>digital records</strong> of property income and expenses in compatible software and send <strong>quarterly summary updates</strong> to HMRC — then still submit a tax return after the year ends.</p>

<p>This guide is about the landlord obligations themselves. If you already know you need managed help, the commercial service page is <a href="/rental-income-tax">MTD for landlords</a>.</p>

<h2>Does MTD apply to your property income?</h2>
<p>MTD for Income Tax can apply if you are on Self Assessment with property income (alone or with a trade) and your <strong>qualifying income</strong> — gross self-employment and property turnover <em>before</em> expenses — sits above the look-back threshold. The April 2026 wave used more than <strong>£50,000</strong> on the 2024 to 2025 return; later waves use £30,000 (from April 2027) and £20,000 (from April 2028). Check GOV.UK or the <a href="/check-mtd">MTD checker</a>; do not use profit after mortgage interest as the test.</p>
<p>For jointly owned property, only <strong>your share</strong> of the relevant property income counts toward that qualifying-income total. GOV.UK’s example style: a property generating £50,000 of income owned equally with one other person gives you £25,000 toward your threshold (before adding any self-employment turnover).</p>

<h2>What landlords must keep digitally</h2>
<p>GOV.UK expects digital records of UK property income (rent, certain premiums/inducements) and property expenses (repairs, maintenance, and other allowable categories your software supports). You still keep supporting documents such as agent statements and invoices.</p>
<p><strong>Useful nuance:</strong> UK rental properties are generally treated as one <strong>UK property business</strong>. You do not create a separate MTD “set” for each flat in the UK — the software rolls them together (including your share of jointly let UK property). Foreign property has separate record rules; check GOV.UK if you have overseas lets.</p>

<p>Example entry: rent received <strong>£1,250</strong> on <strong>1 September 2026</strong>, categorised as property income; a boiler repair of <strong>£240</strong> on <strong>12 June 2026</strong> as repairs and maintenance. The agent statement and invoice stay on file.</p>

<h2>Quarterly updates for property</h2>
<p>Every three months, software totals those digital records and sends category summaries. HMRC does not receive every individual receipt. Deadlines for many people in 2026 to 2027 include 7 August, 7 November, 7 February and 7 May (following tax year). Details: <a href="/blogs/mtd-quarterly-updates">what quarterly updates include</a>.</p>
<p>For jointly let property, GOV.UK lets you include income and expenses, or income only, in quarterly updates — if you omit expenses you must report them later by resending the fourth update before the tax return.</p>

<h2>Landlord-specific traps</h2>
<ul>
  <li>Treating profit after mortgage interest as the MTD threshold test</li>
  <li>Counting a joint property’s full rent toward your threshold instead of your share</li>
  <li>Leaving agent statements in an email inbox until January</li>
  <li>Mixing personal and rental spending with no labels</li>
  <li>Assuming “I only have two buy-to-lets” means two separate UK MTD property businesses (usually it does not)</li>
</ul>

<h2>Where TaxSimba fits</h2>
<p>TaxSimba is an accountant-led MTD service, not DIY landlord software. For product and packages aimed at landlords, start at <a href="/rental-income-tax">rental income / MTD for landlords</a>. This article answers “what do I have to do?” — it does not replace that commercial page.</p>

<p>Rules and exemptions can change; confirm on GOV.UK for your situation. General information only — not personal tax advice.</p>
`,
  },
  {
    id: "seo-mtd-sole-traders-2026-27",
    slug: "mtd-for-sole-traders-2026-27",
    title: "MTD for Sole Traders: What You Need to Do in 2026/27",
    excerpt:
      "Sole traders in Making Tax Digital for Income Tax in 2026 to 2027 need digital business records and quarterly updates. Here is the practical checklist — without the sales brochure.",
    metaTitle: "MTD for Sole Traders 2026/27 — Checklist | TaxSimba",
    metaDescription:
      "What sole traders must do under Making Tax Digital for Income Tax in 2026 to 2027: digital records, separate businesses, quarterly updates, and how accountant-led support fits.",
    category: "Making Tax Digital",
    audience: "sole-traders",
    tags: ["mtd", "sole-trader", "self-employed", "2026-27"],
    publishedAt: "2026-09-15T15:30:00.000Z",
    reviewedAt: "2026-09-15T18:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Self-employed trader reviewing invoices for Making Tax Digital",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-digital-records",
      "mtd-quarterly-updates",
      "mtd-qualifying-income",
      "mtd-accountant-or-agent",
      "mtd-for-landlords-2026-27",
    ],
    relatedPages: [
      { href: "/self-employed-tax-return", label: "MTD accountant support for sole traders" },
      { href: "/making-tax-digital", label: "Making Tax Digital overview" },
      { href: "/check-mtd", label: "MTD checker" },
    ],
    sources: [
      {
        label: "GOV.UK — Create digital records (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/create-digital-records",
      },
      {
        label: "GOV.UK — Send quarterly updates",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Work out your qualifying income",
        url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p>If Making Tax Digital for Income Tax applies to you as a sole trader in 2026 to 2027, three duties sit on top of ordinary Self Assessment: keep <strong>digital records</strong> of business income and expenses, send <strong>quarterly updates</strong> through compatible software (or an agent), and still submit your <strong>tax return</strong> after year-end.</p>

<p>Looking for the managed service rather than the rules? That commercial page is <a href="/self-employed-tax-return">MTD for sole traders</a>.</p>

<h2>When a sole trader is in scope</h2>
<p>You need MTD when you are Self Assessment-registered with self-employment income (and sometimes property too) and your qualifying income — <strong>turnover before expenses</strong> — clears the look-back threshold. From 6 April 2026 that meant more than £50,000 on the 2024 to 2025 return; from 6 April 2027 it is more than £30,000 on 2025 to 2026; from 6 April 2028 it is more than £20,000 on 2026 to 2027. Profit after costs is the wrong figure for this test. Use GOV.UK or the <a href="/check-mtd">MTD checker</a> if you are unsure.</p>

<h2>Digital records for a trade</h2>
<p>Record sales, fees and allowable expenses with amount, date and category in software that works with MTD. Supporting invoices and bank exports still matter. If you run <strong>more than one sole-trader business</strong>, GOV.UK expects separate digital records — and separate quarterly updates — for each (for example electrician work and a separate tutoring trade).</p>
<p><strong>Example:</strong> a freelance designer invoices a client <strong>£1,800</strong> on <strong>14 September 2026</strong> (category: turnover/sales) and pays <strong>£45</strong> for design software on <strong>3 September 2026</strong> (category: office costs, or the nearest match your software uses). Both sit in the digital records with the invoice and receipt kept as evidence — not reconstructed from a vague bank line in January.</p>
<p>More on the record trail: <a href="/blogs/mtd-digital-records">MTD digital records</a>.</p>

<h2>Quarterly rhythm without the jargon</h2>
<p>Software totals your digital records into category summaries every three months. Those summaries are not full tax returns, and HMRC does not see every receipt. Typical deadlines when periods align include 7 August, 7 November, 7 February and 7 May. For 2026 to 2027, late quarterly updates do not attract penalty points — but updates are still required before the return can be submitted.</p>

<h2>Sole trader checklist for 2026/27</h2>
<ol>
  <li>Confirm scope (threshold + Self Assessment status).</li>
  <li>Authorise compatible software or an agent.</li>
  <li>Keep digital records from the start of the relevant tax year (catch up if you joined late).</li>
  <li>Send each quarterly update on time for every trade in MTD.</li>
  <li>At year-end, use the software route to adjustments, other income, reliefs and the tax return.</li>
</ol>

<p>TaxSimba offers accountant-led MTD support for self-employed clients who do not want DIY-only software. Compare that offering on <a href="/self-employed-tax-return">the sole trader MTD page</a> — this article stays on what HMRC expects, not package selling.</p>

<p>General information only — not personal tax advice. Always check current GOV.UK guidance for your trades.</p>
`,
  },
  {
    id: "seo-hmrc-mtd-signup-wrong",
    slug: "hmrc-mtd-signup-wrong",
    title: "HMRC Says I Need Making Tax Digital, But I Think They’re Wrong — What Should I Do?",
    excerpt:
      "Think HMRC has put you into Making Tax Digital incorrectly? Here is how to check qualifying income, exemptions and ceased sources — and how to contact HMRC without ignoring the signup.",
    metaTitle: "HMRC MTD Signup Looks Wrong — What To Do | TaxSimba",
    metaDescription:
      "Steps if you believe HMRC signed you up for Making Tax Digital incorrectly: check qualifying income, ceased income, exemptions, and how to contact HMRC while staying compliant.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "hmrc", "dispute", "exemption", "signed-up"],
    publishedAt: "2026-09-15T15:15:00.000Z",
    reviewedAt: "2026-09-15T18:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Taxpayer reviewing an HMRC Making Tax Digital signup letter carefully",
    ctaType: "CHECK",
    relatedSlugs: [
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-exemptions",
      "mtd-qualifying-income",
      "mtd-accountant-or-agent",
      "mtd-digital-records",
    ],
    relatedPages: [
      { href: "/check-mtd", label: "MTD checker" },
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
    ],
    sources: [
      {
        label: "GOV.UK — Check what to do if HMRC has signed you up for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/check-what-to-do-if-hmrc-has-signed-you-up-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Work out your qualifying income for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Apply for an exemption from Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/apply-for-an-exemption-from-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p>This is not the “I’ve been signed up — what are the next setup steps?” guide. That sits at <a href="/blogs/hmrc-signed-me-up-for-making-tax-digital">HMRC signed me up for MTD</a>. This page is for a narrower problem: <strong>HMRC says you need Making Tax Digital, and you think that is wrong.</strong></p>

<h2>First principle: do not ignore the notice</h2>
<p>Even while you challenge the position, GOV.UK expects you to engage with the signup message — sign in, check the income sources HMRC holds, and follow the published steps. Leaving the letter unopened does not pause obligations if HMRC’s records still show you in scope.</p>
<p>If you are already signed up and you apply for an exemption because your circumstances have changed, GOV.UK is clear that you should <strong>continue using Making Tax Digital for Income Tax while you wait</strong> for HMRC’s decision. An exemption application is not a pause button.</p>

<h2>Common reasons the signup can look wrong</h2>
<ul>
  <li><strong>Qualifying income mix-up</strong> — thresholds use gross self-employment and property turnover before expenses, not profit. PAYE salary, pensions and dividends generally do not count toward the MTD total. See <a href="/blogs/mtd-qualifying-income">qualifying income explained</a>.</li>
  <li><strong>All trading/property income ceased before 6 April 2026</strong> — GOV.UK says you should not need MTD for Income Tax, but you must update HMRC (and still file any required Self Assessment return for 2025 to 2026).</li>
  <li><strong>All sources ceased on or after 6 April 2026</strong> — you still need compatible software to send a quarterly update covering up to the date those sources ceased, and to submit your 2026 to 2027 tax return. You should not need MTD after that.</li>
  <li><strong>Exemption</strong> — for example digital exclusion. Exemptions are specific; many need an application to HMRC (see GOV.UK’s <a href="https://www.gov.uk/guidance/apply-for-an-exemption-from-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer">apply for an exemption</a> guidance). Unfamiliarity with software alone is not treated as digital exclusion.</li>
  <li><strong>Stale HMRC data</strong> — when HMRC signs you up it uses information it already holds. Changes since your last return may be missing until you update them in the service.</li>
</ul>

<h2>A calm dispute sequence</h2>
<ol>
  <li><strong>Re-check the look-back figures</strong> on the Self Assessment return HMRC used (for the April 2026 wave, typically 2024 to 2025 qualifying income over £50,000).</li>
  <li><strong>Use official checkers</strong> — HMRC’s tool on GOV.UK, and TaxSimba’s <a href="/check-mtd">MTD checker</a> as a prompt — then compare to GOV.UK text, not forums.</li>
  <li><strong>Update ceased or new income sources</strong> in HMRC online services where the signup flow asks you to confirm records.</li>
  <li><strong>Contact HMRC</strong> if you still disagree. GOV.UK directs people who think they do not need the service to Self Assessment general enquiries (agents use the agent helpline). Ask about exemptions if that is your basis.</li>
  <li><strong>Keep evidence</strong> — copies of returns, cessation dates, exemption applications, and HMRC correspondence.</li>
</ol>

<h2>What if HMRC is right after all?</h2>
<p>Then treat the signup as real and move to digital records and quarterly updates (yourself or via an agent). The setup walkthrough is in the <a href="/blogs/hmrc-signed-me-up-for-making-tax-digital">signed-up next-steps article</a>. If you want accountant-led help once the dispute is settled, see the <a href="/making-tax-digital">Making Tax Digital service</a> — TaxSimba does not claim to overturn HMRC decisions for you.</p>

<p>General information only — not personal tax advice. Only HMRC can confirm your exemption or remove an incorrect obligation.</p>
`,
  },
  {
    id: "seo-mtd-30000-threshold-2027",
    slug: "mtd-30000-threshold-2027",
    title: "Making Tax Digital £30,000 Rule: Who Needs to Prepare for April 2027?",
    excerpt:
      "From 6 April 2027, sole traders and landlords with qualifying income over £30,000 for 2025 to 2026 need Making Tax Digital for Income Tax. Here is how to prepare — without confusing turnover with profit.",
    metaTitle: "MTD £30,000 Rule — Prepare for April 2027 | TaxSimba",
    metaDescription:
      "Who falls into Making Tax Digital from April 2027 under the £30,000 qualifying income rule, how turnover differs from profit, and a practical preparation checklist.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "30000", "april-2027", "qualifying-income", "preparation"],
    publishedAt: "2026-09-15T15:00:00.000Z",
    reviewedAt: "2026-09-15T15:00:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Planning calendar for Making Tax Digital from April 2027",
    ctaType: "CHECK",
    relatedSlugs: [
      "mtd-qualifying-income",
      "mtd-digital-records",
      "mtd-quarterly-updates",
      "mtd-accountant-or-agent",
      "making-tax-digital-explained",
    ],
    relatedPages: [
      { href: "/check-mtd", label: "MTD checker" },
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/mtd-information", label: "MTD packages" },
    ],
    sources: [
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Work out your qualifying income for Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax (before you use this guide)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/before-you-use-this-guide",
      },
    ],
    curated: true,
    content: `
<p>If your self-employment and property <strong>qualifying income for 2025 to 2026</strong> is more than <strong>£30,000</strong>, current GOV.UK guidance says you need to use Making Tax Digital for Income Tax from <strong>6 April 2027</strong>. This article is for that next cohort — people preparing ahead — not a full reprint of every qualifying-income edge case (that lives in <a href="/blogs/mtd-qualifying-income">MTD qualifying income explained</a>).</p>

<h2>Turnover, not profit</h2>
<p>Qualifying income is total income from self-employment and property <strong>before expenses</strong> (turnover), taken from the Self Assessment return for the look-back year. A sole trader with £34,000 sales and £12,000 profit is still over £30,000 for threshold purposes. Adding PAYE salary or pension income into the total is usually the wrong test — those sources generally do not count toward MTD qualifying income.</p>
<p>HMRC’s own example style: £25,000 property income + £27,000 self-employment income = £52,000 qualifying income. The same logic applies at the £30,000 line; only the threshold and the look-back year change.</p>

<h2>How the phases sit together</h2>
<ul>
  <li><strong>Over £50,000</strong> for 2024 to 2025 → from 6 April 2026</li>
  <li><strong>Over £30,000</strong> for 2025 to 2026 → from 6 April 2027</li>
  <li><strong>Over £20,000</strong> for 2026 to 2027 → from 6 April 2028</li>
</ul>
<p>If you are already in the £50,000 wave, you do not “wait for 2027.” If you are under £50,000 but heading over £30,000 on the 2025 to 2026 return, April 2027 is your planning horizon.</p>

<h2>Preparation checklist before April 2027</h2>
<ol>
  <li><strong>Estimate 2025 to 2026 qualifying income early</strong> — gross self-employment + property totals, not net profit.</li>
  <li><strong>Confirm with GOV.UK / HMRC’s checker</strong> and use TaxSimba’s <a href="/check-mtd">MTD checker</a> as a practical prompt.</li>
  <li><strong>Decide DIY software vs an agent</strong> before the rush; authorisation and software choice take time.</li>
  <li><strong>Practise cleaner digital habits now</strong> — monthly bank exports, labelled expenses, rental statements filed as you go. See <a href="/blogs/mtd-digital-records">digital records</a>.</li>
  <li><strong>Know the quarterly rhythm</strong> you will inherit from April 2027 — summaries every three months, then a software-based tax return. Overview: <a href="/blogs/mtd-quarterly-updates">quarterly updates</a>.</li>
</ol>

<h2>Who this is not aimed at</h2>
<p>People already mandated from April 2026 should follow current-year guides (including deadline and catch-up pieces), not treat 2027 as their start date. Partnership MTD timing is separate — GOV.UK says that timeline will be set later.</p>

<p>If you confirm you are in the April 2027 cohort and want accountant-led support rather than DIY-only software, browse the <a href="/making-tax-digital">Making Tax Digital service</a> and <a href="/mtd-information">MTD information</a> pages. We do not invent thresholds or promise to keep you under £30,000.</p>

<p>Thresholds and dates follow current GOV.UK guidance and can be updated by HMRC — re-check before you rely on any summary. General information only — not personal tax advice.</p>
`,
  },

  {
    id: "seo-does-mtd-replace-self-assessment",
    slug: "does-mtd-replace-self-assessment",
    title: "Does Making Tax Digital Replace Self Assessment?",
    excerpt:
      "No — Making Tax Digital for Income Tax is a new way to do Self Assessment, not a replacement for the tax-year return. Here is what still happens at year end.",
    metaTitle: "Does Making Tax Digital Replace Self Assessment? | TaxSimba",
    metaDescription:
      "Clear answer: Making Tax Digital for Income Tax does not scrap your Self Assessment tax return. What quarterly updates do, what still happens by 31 January, and how an accountant can help.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "self-assessment", "tax-return", "quarterly-updates"],
    publishedAt: "2026-09-15T11:30:00.000Z",
    reviewedAt: "2026-09-15T11:30:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Comparing Making Tax Digital quarterly updates with a Self Assessment tax return",
    ctaType: "MTD",
    relatedSlugs: [
      "making-tax-digital-explained",
      "mtd-quarterly-updates",
      "self-assessment-deadline",
      "mtd-accountant-or-agent",
      "understanding-self-assessment-uk",
    ],
    relatedPages: [
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
      { href: "/self-assessment", label: "Self Assessment accountant service" },
      { href: "/check-mtd", label: "Check if MTD applies" },
    ],
    sources: [
      {
        label: "GOV.UK — Use Making Tax Digital for Income Tax (before you use this guide)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/before-you-use-this-guide",
      },
      {
        label: "GOV.UK — Submit your tax return (Making Tax Digital for Income Tax)",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/submit-your-tax-return",
      },
      {
        label: "GOV.UK — Send quarterly updates",
        url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates",
      },
    ],
    curated: true,
    content: `
<p><strong>Short answer:</strong> no. Making Tax Digital for Income Tax does not replace Self Assessment. GOV.UK describes it as a <strong>new way for sole traders and landlords to do Self Assessment</strong> — digital records and quarterly updates during the year, then a tax return after the tax year ends.</p>

<p>If you only needed the overview of MTD itself, see <a href="/blogs/making-tax-digital-explained">Making Tax Digital explained</a>. This page answers one confusion: “If I’m sending quarterly updates, do I still do a return?”</p>

<h2>What stays the same</h2>
<p>Under MTD for Income Tax you still:</p>
<ul>
  <li><strong>Submit one tax return every tax year</strong></li>
  <li><strong>Pay your tax bill</strong> on the same broad payment dates you know from Self Assessment</li>
</ul>
<p>GOV.UK is explicit that both still need to be done by <strong>31 January</strong> following the end of the tax year (online). Making Tax Digital does not invent a new “instead of January” filing system that cancels the return.</p>

<h2>What is new</h2>
<p>On top of that year-end process you (or your agent) must:</p>
<ul>
  <li>keep <strong>digital records</strong> of self-employment and/or property income and expenses in compatible software</li>
  <li>send <strong>quarterly updates</strong> — category summaries built from those records, not mini tax returns</li>
  <li>use that software route to finish adjustments, other income and the <strong>tax return</strong> itself for MTD years</li>
</ul>
<p>Quarterly updates are cumulative totals for the year so far. They do not finalise your tax. HMRC still uses the year-end submission to generate your Self Assessment bill. Details of what those updates contain sit in <a href="/blogs/mtd-quarterly-updates">MTD quarterly updates explained</a>.</p>

<h2>How the year actually looks</h2>
<p>Take someone mandated from April 2026 with standard update periods. During 2026 to 2027 they send quarterly updates (typical send-by dates include 7 August, 7 November, 7 February and 7 May). After the year ends they still prepare and submit the tax return through compatible software — for that first MTD year, by <strong>31 January 2028</strong>. Payment rules remain Self Assessment payment rules; GOV.UK says MTD does not change how you pay tax or the payment due dates.</p>
<p>For the tax year <em>before</em> you start MTD, you still submit a normal Self Assessment return in the way you always have.</p>

<h2>Where people get tripped up</h2>
<ul>
  <li>Treating a quarterly update as “I’ve filed for the year”</li>
  <li>Assuming predicted tax figures in software are the final bill</li>
  <li>Forgetting other income (savings, dividends, partnership share) still has to sit on the return</li>
  <li>Mixing MTD years with classic Self Assessment years and expecting the same filing path</li>
</ul>

<h2>How TaxSimba fits</h2>
<p>TaxSimba is accountant-led support for Making Tax Digital and Self Assessment — not DIY tax software that “replaces” HMRC’s process. If MTD applies and you want the quarterly rhythm handled with an accountant, start at the <a href="/making-tax-digital">Making Tax Digital service</a>. If you mainly need a classic Self Assessment return prepared from your documents, use the <a href="/self-assessment">Self Assessment service</a>.</p>

<p>General information only — not personal tax advice. Confirm current wording on GOV.UK.</p>
`,
  },

  {
    id: "seo-mtd-exemptions",
    slug: "mtd-exemptions",
    title: "Making Tax Digital Exemptions: Who Does Not Have to Use MTD?",
    excerpt:
      "Some people are automatically exempt from Making Tax Digital for Income Tax; others need to apply. Here is who may not have to use MTD — and what happens while HMRC considers an application.",
    metaTitle: "MTD Exemptions — Who Does Not Have to Use MTD? | TaxSimba",
    metaDescription:
      "Who can be exempt from Making Tax Digital for Income Tax: automatic exclusions, digital exclusion, temporary exemptions, applying to HMRC, and continuing MTD while you wait.",
    category: "Making Tax Digital",
    audience: "sole-traders-landlords",
    tags: ["mtd", "exemptions", "digital-exclusion", "hmrc"],
    publishedAt: "2026-09-15T11:28:00.000Z",
    reviewedAt: "2026-09-15T11:28:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "GOV.UK exemption guidance notes for Making Tax Digital for Income Tax",
    ctaType: "CHECK",
    relatedSlugs: [
      "hmrc-mtd-signup-wrong",
      "mtd-qualifying-income",
      "hmrc-signed-me-up-for-making-tax-digital",
      "does-mtd-replace-self-assessment",
      "mtd-30000-threshold-2027",
    ],
    relatedPages: [
      { href: "/check-mtd", label: "Check if MTD applies" },
      { href: "/making-tax-digital", label: "Making Tax Digital accountant service" },
    ],
    sources: [
      {
        label: "GOV.UK — Find out if you can get an exemption from Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-you-can-get-an-exemption-from-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Apply for an exemption from Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/apply-for-an-exemption-from-making-tax-digital-for-income-tax",
      },
      {
        label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
        url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
      },
    ],
    curated: true,
    content: `
<p>If Making Tax Digital for Income Tax feels unworkable for you, the useful question is not “can I skip it because software is annoying?” — it is <strong>whether an HMRC exemption or exclusion actually applies</strong>. Exempt people still report income and gains on a Self Assessment tax return as normal; they just do not have to use the MTD digital-records and quarterly-update route.</p>

<p>This page owns “who can be exempt?” If your issue is “HMRC signed me up and I think that is wrong,” use <a href="/blogs/hmrc-mtd-signup-wrong">that dispute guide</a> instead.</p>

<h2>Two shapes of exemption</h2>
<p>GOV.UK groups exemptions as:</p>
<ul>
  <li><strong>Automatic</strong> — HMRC grants them from information it already holds; you do not submit an application</li>
  <li><strong>Applied for</strong> — you (or an authorised agent/friend/family member) must contact HMRC and explain why</li>
</ul>
<p>They can also be <strong>permanent</strong> (unless circumstances change) or <strong>temporary</strong> (often until April 2027 at the earliest).</p>

<h2>Automatic examples (not a full catalogue)</h2>
<p>Current GOV.UK guidance includes, among others:</p>
<ul>
  <li><strong>Qualifying income of £20,000 or less</strong> — automatically exempt from MTD for Income Tax</li>
  <li><strong>No National Insurance number</strong> before the start of the tax year — automatically exempt and cannot sign up</li>
  <li><strong>Partnerships</strong> — partnerships do not currently need to use MTD for Income Tax (HMRC will set that timeline later)</li>
  <li><strong>Certain role-based cases</strong> — for example some trust returns (SA900), non-resident company SA700 filings, and acting only as a personal representative of someone who has died (your own trade/property income is assessed separately)</li>
  <li><strong>Specific 2024 to 2025 return markers</strong> — some supplementary pages and claims trigger automatic temporary or longer exemptions (averaging relief, qualifying care relief, certain SA107/SA109 cases, ministers of religion, Blind Person’s Allowance, and others). The full list belongs on GOV.UK, not in a blog paraphrase</li>
</ul>
<p>If you are near a threshold rather than an exemption, start with <a href="/blogs/mtd-qualifying-income">qualifying income</a> and the <a href="/check-mtd">MTD checker</a>.</p>

<h2>Digital exclusion — what it is and is not</h2>
<p>Being <strong>digitally excluded</strong> means it is not reasonable for you to use compatible software to keep digital records and send quarterly updates or the tax return. GOV.UK examples include age, health or disability that stops you using a computer/tablet/smartphone for this; certain religious beliefs incompatible with digital records <em>and</em> no personal/business use of those devices; or no workable internet access at home or business (and no suitable alternative).</p>
<p>HMRC says it will <strong>not</strong> accept an application if your only reason is that you previously filed on paper, you are unfamiliar with accountancy software, you have few digital records each year, or MTD will take extra time or cost. Disliking software is not digital exclusion.</p>
<p>If an agent already keeps digital records and submits for you with compatible software, speak to them first — you may not need a digitally excluded exemption.</p>

<h2>Applying, waiting, and changing circumstances</h2>
<p>Applications go by phone or letter to Self Assessment general enquiries (agents use the agent line), with the subject titles GOV.UK publishes for digitally excluded or other exemption applications. HMRC aims to respond within 28 calendar days.</p>
<p><strong>Already signed up and applying because circumstances changed?</strong> GOV.UK says you should <strong>continue using Making Tax Digital for Income Tax while you wait</strong> for a decision. An application is not a pause.</p>
<p>If your circumstances later change after an exemption, you may need to apply again or start using MTD when HMRC says you must. Previously digitally excluded from MTD for VAT still needs a separate Income Tax confirmation with HMRC — it does not transfer silently.</p>

<h2>Practical next step</h2>
<p>Read GOV.UK’s exemption pages for your exact case, then use the <a href="/check-mtd">MTD checker</a> as a planning prompt. If you are not exempt and want accountant-led help rather than DIY software alone, see the <a href="/making-tax-digital">Making Tax Digital service</a>. TaxSimba does not grant exemptions and does not claim HMRC approval.</p>

<p>General information only — not personal tax advice. Only HMRC can confirm an exemption.</p>
`,
  },

  {
    id: "seo-sa-landlords-2025-26",
    slug: "self-assessment-for-landlords-2025-26",
    title: "Self Assessment for Landlords: What You Need for Your 2025/26 Tax Return",
    excerpt:
      "A practical Self Assessment preparation list for UK landlords covering the 2025 to 2026 tax year — rental figures, expenses, joint ownership, and filing deadlines.",
    metaTitle: "Self Assessment for Landlords 2025/26 — What You Need | TaxSimba",
    metaDescription:
      "What UK landlords need for the 2025/26 Self Assessment tax return: rental income records, allowable expenses, jointly owned property, accountant prep, and current deadlines.",
    category: "Self Assessment",
    audience: "landlords",
    tags: ["self-assessment", "landlords", "rental-income", "2025-26"],
    publishedAt: "2026-09-15T11:26:00.000Z",
    reviewedAt: "2026-09-15T11:26:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Landlord gathering rental statements for a Self Assessment tax return",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-documents-checklist",
      "self-assessment-deadline",
      "self-assessment-for-sole-traders-2025-26",
      "payments-on-account-explained",
      "mtd-for-landlords-2026-27",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Self Assessment accountant service" },
      { href: "/register", label: "Start Self Assessment with TaxSimba" },
    ],
    sources: [
      {
        label: "GOV.UK — Work out your rental income when you let property",
        url: "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
      },
      {
        label: "GOV.UK — Self Assessment tax returns: Deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Check how to register for Self Assessment",
        url: "https://www.gov.uk/register-for-self-assessment",
      },
    ],
    curated: true,
    content: `
<p>This guide is for landlords preparing a <strong>Self Assessment tax return for 2025 to 2026</strong> (6 April 2025 to 5 April 2026). It stays on classic Self Assessment preparation — not Making Tax Digital for landlords. MTD obligations for property sit in <a href="/blogs/mtd-for-landlords-2026-27">MTD for landlords 2026/27</a>.</p>

<h2>What “good enough” records look like</h2>
<p>You pay tax on <strong>rental profit</strong>: rental income minus allowable expenses (and any allowances that apply). Gather:</p>
<ul>
  <li><strong>Rent received</strong> — including payments for furniture use and services you charge for (cleaning of communal areas, heating, and similar)</li>
  <li><strong>Letting agent statements</strong> for the full tax year, not just December’s summary</li>
  <li><strong>Bank statements</strong> that show rent and property spending</li>
  <li><strong>Invoices and receipts</strong> for repairs, insurance, ground rent, service charges, accountant fees, advertising for tenants, and other wholly-and-exclusively property costs</li>
  <li><strong>Finance costs</strong> paperwork (interest on mortgages/loans) — residential finance-cost relief is restricted; your accountant needs the figures even when relief is limited</li>
  <li><strong>Mileage or vehicle logs</strong> if you claim property-business motoring</li>
</ul>
<p>GOV.UK expects records kept for at least five years after the 31 January deadline for the year. A broader document list is in the <a href="/blogs/self-assessment-documents-checklist">Self Assessment documents checklist</a>.</p>

<h2>Jointly owned property</h2>
<p>You are taxed on <strong>your share</strong> of the rental income. Married couples and civil partners living together are usually taxed 50/50 unless they have declared beneficial interests differently. For other joint owners, shares usually follow ownership unless you agree a different income allocation. Tell your accountant the ownership split and whose name is on the agent statements.</p>

<h2>What else an accountant often needs</h2>
<ul>
  <li>Whether you use (or want) the £1,000 property allowance instead of expenses</li>
  <li>Rent-a-Room figures if you let a room in your home</li>
  <li>Capital improvements vs repairs (extensions and upgrades are usually capital, not revenue deductions)</li>
  <li>Other income on the same return — employment, dividends, savings interest, capital gains</li>
  <li>Whether payments on account from last year need adjusting</li>
</ul>

<h2>Approval, filing and deadlines for this return</h2>
<p>Online filing and payment for 2025 to 2026 are due by <strong>11:59pm on 31 January 2027</strong>. Paper returns (if you still use one) must reach HMRC by <strong>31 October 2026</strong>. If you need to tell HMRC you require a return for this year and you have not filed before (or you registered before but did not need a 2024 to 2025 return), that notification date is <strong>5 October 2026</strong> — see <a href="/blogs/self-assessment-register-by-5-october-2026">the 5 October registration guide</a>.</p>
<p>With TaxSimba’s <a href="/self-assessment">Self Assessment service</a>, you upload documents, an accountant prepares the return, and you approve before filing where that step applies. We do not invent allowable expenses or guarantee a particular tax bill.</p>

<p>General information only — not personal tax advice. Confirm allowances and reliefs on current GOV.UK pages for your lets.</p>
`,
  },

  {
    id: "seo-sa-sole-traders-2025-26",
    slug: "self-assessment-for-sole-traders-2025-26",
    title: "Self Assessment for Sole Traders: What You Need for Your 2025/26 Tax Return",
    excerpt:
      "What self-employed sole traders should gather for the 2025 to 2026 Self Assessment return — sales, expenses, other income, filing steps and deadlines.",
    metaTitle: "Self Assessment for Sole Traders 2025/26 — Checklist | TaxSimba",
    metaDescription:
      "Sole trader Self Assessment prep for 2025/26: income and expense records, other income, accountant workflow, a worked example, and current filing deadlines.",
    category: "Self Assessment",
    audience: "sole-traders",
    tags: ["self-assessment", "sole-trader", "self-employed", "2025-26"],
    publishedAt: "2026-09-15T11:24:00.000Z",
    reviewedAt: "2026-09-15T11:24:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Sole trader sorting invoices for a 2025/26 Self Assessment return",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-documents-checklist",
      "self-assessment-deadline",
      "self-assessment-for-landlords-2025-26",
      "payments-on-account-explained",
      "mtd-for-sole-traders-2026-27",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Self Assessment accountant service" },
      { href: "/register", label: "Start Self Assessment with TaxSimba" },
    ],
    sources: [
      {
        label: "GOV.UK — Self Assessment tax returns: Deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Check how to register for Self Assessment",
        url: "https://www.gov.uk/register-for-self-assessment",
      },
      {
        label: "GOV.UK — Payments on account",
        url: "https://www.gov.uk/understand-self-assessment-bill/payments-on-account",
      },
    ],
    curated: true,
    content: `
<p>If you traded as a sole trader in <strong>2025 to 2026</strong>, your Self Assessment return needs a clear picture of sales, allowable expenses and anything else taxable that year. This page is Self Assessment preparation — not the Making Tax Digital sole-trader checklist (that is <a href="/blogs/mtd-for-sole-traders-2026-27">MTD for sole traders 2026/27</a>), and not a generic document dump (see the <a href="/blogs/self-assessment-documents-checklist">documents checklist</a> for the wide list).</p>

<h2>Income and sales evidence</h2>
<ul>
  <li>Invoices or sales reports for the tax year (6 April 2025 to 5 April 2026)</li>
  <li>Bank statements for the business account (or highlighted personal-account business lines)</li>
  <li>Platform payouts (marketplaces, card readers) reconciled to invoices</li>
  <li>CIS statements if you are a subcontractor</li>
  <li>Any tips, grants or other trading receipts</li>
</ul>

<h2>Business expenses worth sorting early</h2>
<p>Group costs the way your accountant will ask for them: stock or materials, subcontractors, premises, vehicle/travel, office costs, professional fees, insurance, phone/internet used for the trade, and capital purchases that may need capital allowances. Private spending mixed into the same account needs a clear split — “I’ll remember in January” is how allowable claims get lost.</p>

<h2>A concrete prep example</h2>
<p>Maya is a freelance photographer. For 2025 to 2026 she has invoices totalling <strong>£42,600</strong>, equipment hire and props of <strong>£3,150</strong>, software subscriptions of <strong>£480</strong>, train travel to shoots of <strong>£920</strong>, and a new camera body costing <strong>£1,800</strong> that may need capital-allowance treatment rather than a simple expense. She exports bank CSV files and keeps PDF invoices in one folder labelled by month. That pack is enough for an accountant to draft the trade pages without reconstructing the year from memory.</p>

<h2>Other income and the rest of the return</h2>
<p>Sole-trader profit is rarely the whole story. Note employment income, taxable benefits, dividends, savings interest, rental income, pension contributions, and student loan indicators. Payments on account from the previous year also affect what you pay by 31 January — see <a href="/blogs/payments-on-account-explained">payments on account explained</a>.</p>

<h2>Accountant workflow, approval and deadlines</h2>
<p>Online return and balancing payment for 2025 to 2026: <strong>31 January 2027</strong>. Paper deadline: <strong>31 October 2026</strong>. If you still need to register or reactivate Self Assessment for this year, check the <a href="/blogs/self-assessment-register-by-5-october-2026">5 October 2026 notification date</a>.</p>
<p>TaxSimba’s <a href="/self-assessment">Self Assessment service</a> is accountant-led: you supply the records, an accountant prepares the return, you approve, then it is filed. We do not sell DIY filing software or promise a fixed tax saving.</p>

<p>General information only — not personal tax advice.</p>
`,
  },

  {
    id: "seo-sa-register-5-oct-2026",
    slug: "self-assessment-register-by-5-october-2026",
    title: "Do I Need to Register for Self Assessment by 5 October 2026?",
    excerpt:
      "5 October 2026 is the date to tell HMRC you need a Self Assessment tax return for 2025 to 2026 if you are new to filing or need to reactivate — not the same as the 31 January filing deadline.",
    metaTitle: "Register for Self Assessment by 5 October 2026? | TaxSimba",
    metaDescription:
      "Who must tell HMRC by 5 October 2026 about a 2025/26 Self Assessment return, how that differs from 31 January filing, and what to do if you miss the date.",
    category: "Self Assessment",
    audience: "sole-traders-landlords",
    tags: ["self-assessment", "register", "5-october-2026", "deadline"],
    publishedAt: "2026-09-15T11:22:00.000Z",
    reviewedAt: "2026-09-15T11:22:00.000Z",
    authorName: "TaxSimba",
    reviewerName: "TaxSimba",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar highlighting the 5 October 2026 Self Assessment registration date",
    ctaType: "SA",
    deadlineSwitch: {
      untilDate: "2026-10-05",
      before: {
        title: "Do I Need to Register for Self Assessment by 5 October 2026?",
        metaTitle: "Register for Self Assessment by 5 October 2026? | TaxSimba",
        metaDescription:
          "Who must tell HMRC by 5 October 2026 about a 2025/26 Self Assessment return, how that differs from 31 January filing, and what to do if you miss the date.",
        excerpt:
          "5 October 2026 is the date to tell HMRC you need a Self Assessment tax return for 2025 to 2026 if you are new to filing or need to reactivate — not the same as the 31 January filing deadline.",
      },
      after: {
        title: "Missed the 5 October Self Assessment Registration Date? Here’s What to Do",
        metaTitle: "Missed 5 October Self Assessment Registration? | TaxSimba",
        metaDescription:
          "If you missed telling HMRC by 5 October 2026 that you need a 2025/26 Self Assessment return, here is what GOV.UK says about penalties, revised filing deadlines and paying by 31 January 2027.",
        excerpt:
          "The 5 October 2026 Self Assessment notification date has passed. Here is what to do if you still need to register or reactivate for 2025 to 2026.",
      },
    },
    relatedSlugs: [
      "self-assessment-deadline",
      "late-self-assessment-penalties",
      "self-assessment-documents-checklist",
      "self-assessment-for-sole-traders-2025-26",
      "self-assessment-for-landlords-2025-26",
    ],
    relatedPages: [
      { href: "/self-assessment", label: "Self Assessment accountant service" },
      { href: "/register", label: "Start Self Assessment with TaxSimba" },
    ],
    sources: [
      {
        label: "GOV.UK — Check how to register for Self Assessment",
        url: "https://www.gov.uk/register-for-self-assessment",
      },
      {
        label: "GOV.UK — Self Assessment tax returns: Deadlines",
        url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
      },
      {
        label: "GOV.UK — Self Assessment tax returns: Registering",
        url: "https://www.gov.uk/self-assessment-tax-returns/registering",
      },
    ],
    curated: true,
    content: `
<!--deadline:until-2026-10-05-->
<p><strong>Not everyone</strong> must “register by 5 October.” GOV.UK’s rule is narrower: you must <strong>tell HMRC by 5 October 2026</strong> if you need to complete a tax return for the previous tax year (2025 to 2026: 6 April 2025 to 5 April 2026) and you have either:</p>
<ul>
  <li>not sent a tax return before, or</li>
  <li>registered before but did not need to send a tax return for <strong>2024 to 2025</strong></li>
</ul>
<p>You tell HMRC by registering for Self Assessment (or by following the reactivation path inside that service if you already had an account). Check whether you need a return before you register.</p>
<!--/deadline:until-2026-10-05-->
<!--deadline:from-2026-10-06-->
<p><strong>The 5 October 2026 notification date has passed.</strong> GOV.UK required people to tell HMRC by that date if they needed a tax return for 2025 to 2026 and had either never sent a return, or had registered before but did not need a return for 2024 to 2025. If that described you and you have not told HMRC yet, register or reactivate now — waiting does not remove the need to file or pay.</p>
<!--/deadline:from-2026-10-06-->

<h2>What 5 October is — and is not</h2>
<p>5 October is a <strong>tell HMRC / registration (or reactivation) date</strong> for people in those two situations. It is <strong>not</strong> the deadline for submitting the tax return or paying the bill.</p>
<ul>
  <li><strong>Online return and payment:</strong> 11:59pm on <strong>31 January 2027</strong></li>
  <li><strong>Paper return:</strong> 11:59pm on <strong>31 October 2026</strong></li>
</ul>
<p>People who already file Self Assessment every year are not suddenly given a new universal “re-register by 5 October” duty. Use GOV.UK’s “check how to register” flow if you are unsure which path applies — including reactivation if you skipped 2024 to 2025.</p>

<!--deadline:until-2026-10-05-->
<h2>If you miss 5 October 2026</h2>
<p>GOV.UK warns you could get a penalty if you tell HMRC after 5 October 2026. If you register after that date, HMRC will send a letter or email with a <strong>different deadline to send your tax return</strong> — three months from the date on that letter or email. You must still pay any tax owed by <strong>11:59pm on 31 January 2027</strong> or you can get a payment penalty. More on late filing generally: <a href="/blogs/late-self-assessment-penalties">late Self Assessment penalties</a>.</p>
<!--/deadline:until-2026-10-05-->
<!--deadline:from-2026-10-06-->
<h2>If you are registering after 5 October 2026</h2>
<p>GOV.UK says you could get a penalty for telling HMRC late. After a late registration, HMRC will send a letter or email with a <strong>revised deadline to send your tax return</strong> — three months from the date on that letter or email. You must still pay any tax owed by <strong>11:59pm on 31 January 2027</strong> or you can get a payment penalty. Practical catch-up reading: <a href="/blogs/late-self-assessment-penalties">late Self Assessment penalties</a>.</p>
<!--/deadline:from-2026-10-06-->

<h2>Practical next steps</h2>
<ol>
  <li>Confirm you actually need a 2025 to 2026 return (GOV.UK’s “check if you need to send a tax return” tool).</li>
  <li>Use <a href="https://www.gov.uk/register-for-self-assessment" target="_blank" rel="noopener noreferrer">Check how to register for Self Assessment</a> on GOV.UK — including reactivation where relevant.</li>
  <li>Gather records early so the January filing date is not a scramble — <a href="/blogs/self-assessment-documents-checklist">documents checklist</a>.</li>
  <li>Diary <strong>31 January 2027</strong> for online filing and payment.</li>
</ol>

<p>If you want an accountant to prepare the return once you are registered, TaxSimba’s <a href="/self-assessment">Self Assessment service</a> is accountant-led from your documents. We cannot register you with HMRC in place of the GOV.UK process, and we do not guarantee penalty cancellation.</p>

<p>General information only — not personal tax advice. Re-check GOV.UK for the wording that applies to you.</p>
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
    authorName: raw.authorName || raw.author || "TaxSimba",
    reviewerName: raw.reviewerName || "TaxSimba",
    featuredImage: raw.featuredImage || "/images/tax_blog_default.png",
    featuredImageAlt: raw.featuredImageAlt || raw.title || "TaxSimba guide",
    ctaType: raw.ctaType === "MTD" ? "MTD" : raw.ctaType === "CHECK" ? "CHECK" : "SA",
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
