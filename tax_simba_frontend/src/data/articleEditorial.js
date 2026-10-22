import { reviseArticle } from "./articleEditorialRevisions.js";
import { remainingEnhancements, appendRemainingDepth } from "./articleRemainingBatches.js";
import { REMAINING_ARTICLE_SLUGS } from "./articleRemainingOrder.js";
import { batch02 } from "./articleBatch02.js";
import { appendPriority20Depth } from "./articlePriority20Depth.js";
import { batch01 } from "./articleBatch01.js";
import { getArticleArtwork } from "./articleArtwork.js";

export const PRIORITY_ARTICLE_SLUGS = [
  "mtd-accountant-cost",
  "self-assessment-accountant-cost",
  "join-mtd-service-mid-year",
  "switch-mtd-accountant-mid-year",
  "mtd-quarterly-updates-tax-payments",
  "self-assessment-2025-26-mtd-2026-27",
  "mtd-cumulative-quarterly-updates",
  "correct-mtd-quarterly-update",
  "waiting-for-utr-tax-return",
  "employed-and-self-employed-tax-return",
  "uber-private-hire-driver-tax-return",
  "delivery-driver-courier-tax-return",
  "mtd-software-vs-accountant-service",
  "authorise-mtd-accountant-safely",
  "multiple-overdue-self-assessment-returns",
  "appeal-self-assessment-late-penalty",
  "sold-rental-property-60-day-tax",
  "pay-self-assessment-through-tax-code-december",
  "mtd-proof-quarterly-update-submitted",
  "hmrc-signed-me-up-for-making-tax-digital",
];

export const RELEASE_ORDER_SLUGS = [...PRIORITY_ARTICLE_SLUGS, ...REMAINING_ARTICLE_SLUGS];
const EDITORIAL_BATCHES = { ...batch01, ...batch02, ...remainingEnhancements };

const CHECKLISTS = {
  "mtd-accountant-cost": ["Confirm what the fee includes", "Check who completes quarterly updates", "Ask what triggers an extra charge"],
  "self-assessment-accountant-cost": ["List every income source", "Confirm the filing and advice included", "Compare like-for-like annual service"],
  "join-mtd-service-mid-year": ["Gather records from the tax-year start", "Check earlier update periods", "Agree who submits the next update"],
  "switch-mtd-accountant-mid-year": ["Download your records", "Confirm agent authorisation", "Set a clear handover date"],
  "mtd-quarterly-updates-tax-payments": ["Keep quarterly records current", "Treat estimates as provisional", "Budget separately for the final bill"],
  "self-assessment-2025-26-mtd-2026-27": ["Finish the earlier return", "Prepare digital records", "Track both deadlines separately"],
  "mtd-cumulative-quarterly-updates": ["Check the period covered", "Reconcile year-to-date totals", "Keep submission evidence"],
  "correct-mtd-quarterly-update": ["Record the error", "Correct the digital records", "Keep an audit trail"],
  "waiting-for-utr-tax-return": ["Keep registration evidence", "Prepare the return meanwhile", "Escalate before the deadline"],
  "employed-and-self-employed-tax-return": ["Collect P60 or P45 details", "Prepare business records", "Reconcile tax already deducted"],
  "uber-private-hire-driver-tax-return": ["Export platform statements", "Keep mileage evidence", "Separate business costs"],
  "delivery-driver-courier-tax-return": ["Export every platform statement", "Record mileage consistently", "Keep equipment receipts"],
  "mtd-software-vs-accountant-service": ["Decide who keeps records", "Decide who checks accuracy", "Compare support and filing responsibility"],
  "authorise-mtd-accountant-safely": ["Use HMRC authorisation", "Never share your password", "Confirm the agent relationship"],
  "multiple-overdue-self-assessment-returns": ["List every missing year", "Gather records year by year", "Contact HMRC where needed"],
  "appeal-self-assessment-late-penalty": ["Check the appeal deadline", "Collect dated evidence", "Explain the full timeline"],
  "sold-rental-property-60-day-tax": ["Confirm the completion date", "Calculate the gain promptly", "Check the 60-day report"],
  "pay-self-assessment-through-tax-code-december": ["Check eligibility", "File by 30 December", "Review the coding notice"],
  "mtd-proof-quarterly-update-submitted": ["Save the receipt", "Check the period and business", "Keep software status evidence"],
  "hmrc-signed-me-up-for-making-tax-digital": ["Check HMRC's income sources", "Choose software or an agent", "Catch up digital records"],
};

export function enhanceArticle(article) {
  if (article?.editorialRevisionVersion === 2) return article;
  const artwork = getArticleArtwork(article?.slug);
  const priorityIndex = PRIORITY_ARTICLE_SLUGS.indexOf(article?.slug);
  const description = String(article?.metaDescription || article?.excerpt || "")
    .replace(/\s*\.{3}\s*$/, ".")
    .trim();
  return reviseArticle({
    ...article,
    ...(EDITORIAL_BATCHES[article?.slug] || {}),
    ...appendPriority20Depth(article),
    ...appendRemainingDepth(article),
    premiumReady: Boolean(EDITORIAL_BATCHES[article?.slug]),
    ...(artwork ? { featuredImage: artwork.src.replace(/-960\.webp$/, "-1440.webp"), artwork } : {}),
    featuredImageAlt: EDITORIAL_BATCHES[article?.slug]?.alt || article?.featuredImageAlt || article?.title || "TaxSimba tax guide",
    heroStyle: artwork ? "editorial-illustration" : article?.heroStyle,
    metaDescription: EDITORIAL_BATCHES[article?.slug]?.metaDescription || description || `A practical TaxSimba guide to ${article?.title || "UK tax"}, with clear next steps and links to official guidance.`,
    priorityRank: priorityIndex === -1 ? null : priorityIndex + 1,
    releaseRank: RELEASE_ORDER_SLUGS.indexOf(article?.slug) + 1,
    checklist: EDITORIAL_BATCHES[article?.slug]?.checklist || CHECKLISTS[article?.slug] || null,
  });
}

export function compareArticlePriority(a, b) {
  const ar = a?.releaseRank || a?.priorityRank || Number.MAX_SAFE_INTEGER;
  const br = b?.releaseRank || b?.priorityRank || Number.MAX_SAFE_INTEGER;
  if (ar !== br) return ar - br;
  return new Date(b?.publishedAt || 0).getTime() - new Date(a?.publishedAt || 0).getTime();
}
