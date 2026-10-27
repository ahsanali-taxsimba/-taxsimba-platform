/** Importable 120-template library — batches of 10, stable IDs, no false approvals. */

import type { CampaignFocus, MarketingTemplate } from "./types";

const SA_TOPICS = [
  "Self Assessment deadline reminders",
  "Payments on account explained",
  "Late filing penalties — what to do",
  "Records checklist for sole traders",
  "Rental income on your tax return",
  "Side hustle income reporting",
  "CIS and Self Assessment together",
  "High income Child Benefit charge",
  "Capital gains alongside SA",
  "Choosing accountant-led SA support",
];

const MTD_TOPICS = [
  "Making Tax Digital start dates",
  "Qualifying income thresholds",
  "Quarterly update habits",
  "Digital records that actually help",
  "HMRC signed you up for MTD",
  "MTD for landlords",
  "MTD for sole traders",
  "Does MTD replace Self Assessment?",
  "MTD exemptions and exceptions",
  "Choosing MTD software support",
];

const GENERAL_TOPICS = [
  "UK tax year dates (6 April–5 April)",
  "Nation-aware guidance (England/Scotland/Wales/NI)",
  "Government Gateway security basics",
  "Avoiding fake tax refund scams",
  "When to compare TaxSimba packages",
  "Free calculators as a first step",
  "Verified GOV.UK sources only",
  "Consent-aware analytics reminder",
  "Customer stories without invented reviews",
  "Seasonal planning for January / July",
];

function focusForIndex(i: number): CampaignFocus {
  if (i % 3 === 0) return "SELF_ASSESSMENT";
  if (i % 3 === 1) return "MTD";
  return "GENERAL";
}

function topicFor(focus: CampaignFocus, slot: number): string {
  const list = focus === "SELF_ASSESSMENT" ? SA_TOPICS : focus === "MTD" ? MTD_TOPICS : GENERAL_TOPICS;
  return list[slot % list.length];
}

/**
 * Builds the canonical 120-template library.
 * Artwork is never marked approved — placeholders only until assets exist.
 */
export function buildTemplateLibrary(nowIso = new Date().toISOString()): MarketingTemplate[] {
  const out: MarketingTemplate[] = [];
  for (let n = 1; n <= 120; n += 1) {
    const batch = Math.ceil(n / 10);
    const focus = focusForIndex(n - 1);
    const topic = topicFor(focus, n - 1);
    const id = `tmpl-${String(n).padStart(3, "0")}`;
    const priceRef =
      focus === "SELF_ASSESSMENT" ? "sa_119" : focus === "MTD" ? "mtd_29_99" : "none";
    out.push({
      id,
      batch,
      batchLabel: `Batch ${String(batch).padStart(2, "0")} (${(batch - 1) * 10 + 1}–${batch * 10})`,
      title: topic,
      focus,
      channelHints:
        focus === "MTD"
          ? ["linkedin_company", "google_ads", "instagram_professional"]
          : ["facebook_pages", "linkedin_company", "google_ads"],
      captionSeed: `Practical UK guidance on ${topic.toLowerCase()}. Check GOV.UK for your tax year before you act.`,
      ctaHint:
        focus === "MTD"
          ? "Compare MTD support on TaxSimba (price unverified in creatives)"
          : focus === "SELF_ASSESSMENT"
            ? "Compare Self Assessment packages on TaxSimba (price unverified in creatives)"
            : "Explore TaxSimba guides and calculators",
      thumbnailStatus: "placeholder",
      artworkStatus: "missing",
      status: "pending_artwork",
      version: 1,
      versionHistory: [{ version: 1, note: "Initial library seed", at: nowIso }],
      nationAware: true,
      metadata: {
        hooks: [
          `Still unsure about ${topic.toLowerCase()}?`,
          "Clear next steps — not scare tactics.",
        ],
        aspectRatios: ["1:1", "4:5", "9:16", "16:9"],
        proposedPriceRef: priceRef,
      },
    });
  }
  return out;
}

export function templatesByBatch(templates: MarketingTemplate[]): Record<number, MarketingTemplate[]> {
  const map: Record<number, MarketingTemplate[]> = {};
  for (const t of templates) {
    (map[t.batch] ??= []).push(t);
  }
  return map;
}

export function assertNoFalseApprovals(templates: MarketingTemplate[]): void {
  for (const t of templates) {
    if (t.artworkStatus === "missing" && t.status === "approved") {
      throw new Error(`Template ${t.id} cannot be approved without artwork`);
    }
    if (t.thumbnailStatus === "placeholder" && t.status === "approved") {
      throw new Error(`Template ${t.id} cannot be approved with placeholder thumbnail`);
    }
  }
}
