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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "UK taxpayer reviewing an HMRC Making Tax Digital signup notice",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-qualifying-income",
      "mtd-quarterly-updates",
      "making-tax-digital-explained",
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
<p>Putting the letter aside because “I already do Self Assessment.” MTD adds digital record-keeping and quarterly updates for the income types in scope. Leaving everything until January makes catch-up harder and can block year-end filing until quarterlies are done.</p>

<h3>If you think you were signed up incorrectly</h3>
<p>Contact HMRC Self Assessment if you believe you are exempt or should not be in MTD. Do not ignore the message while you wait — check the official guidance and get advice if your income mix is complicated.</p>

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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Calculator and notes used to work out MTD qualifying income",
    ctaType: "MTD",
    relatedSlugs: [
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-quarterly-updates",
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
<p><strong>Short answer:</strong> For Making Tax Digital for Income Tax, “qualifying income” is your total income from self-employment and property for a tax year — usually before expenses (turnover). The £50,000 figure is the first threshold: if your qualifying income for 2024 to 2025 was over £50,000, you should have started MTD from 6 April 2026. Later phases use £30,000 and £20,000.</p>

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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar marking Making Tax Digital quarterly update deadlines",
    ctaType: "MTD",
    relatedSlugs: [
      "mtd-qualifying-income",
      "hmrc-signed-me-up-for-making-tax-digital",
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
<p>Your software adds up digital records for each business and produces totals using the same broad income and expense categories used in Self Assessment. Each update covers from the start of the tax year to the end of that update period (cumulative), so later updates can reflect corrections to earlier records without always resending old periods as separate “amendments” in the old sense.</p>
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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_1.png",
    featuredImageAlt: "Calendar highlighting the 31 January Self Assessment deadline",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-documents-checklist",
      "understanding-self-assessment-uk",
      "hmrc-signed-me-up-for-making-tax-digital",
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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_2.png",
    featuredImageAlt: "Organised folders of Self Assessment tax return documents",
    ctaType: "SA",
    relatedSlugs: [
      "self-assessment-deadline",
      "understanding-self-assessment-uk",
      "top-tax-saving-tips-uk",
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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
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
    authorName: "TaxSimba Tax Team",
    reviewerName: "TaxSimba Tax Team",
    featuredImage: "/images/blog_3.png",
    featuredImageAlt: "Making Tax Digital for Income Tax overview",
    ctaType: "MTD",
    relatedSlugs: [
      "hmrc-signed-me-up-for-making-tax-digital",
      "mtd-qualifying-income",
      "mtd-quarterly-updates",
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
