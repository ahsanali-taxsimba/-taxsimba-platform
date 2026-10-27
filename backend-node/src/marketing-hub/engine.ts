/** Daily AI marketing engine — British English drafts with verified deadline sources. */

import { randomUUID } from "crypto";

import {
  dailyDraftLimit,
  marketingFixtureMode,
  marketingHubPaused,
  PROPOSED_STARTING_PRICES,
  generationApiKey,
} from "./config";
import { appendAudit, getTemplateLibrary, insertDraft, listDrafts } from "./store";
import type { CampaignFocus, MarketingDraft } from "./types";

const GOVUK_SOURCES = [
  {
    label: "GOV.UK — Self Assessment tax returns",
    url: "https://www.gov.uk/self-assessment-tax-returns",
  },
  {
    label: "GOV.UK — Making Tax Digital for Income Tax",
    url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
  },
  {
    label: "GOV.UK — Check if you need to use MTD for ITSA",
    url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
  },
];

function ukDeadlineHints(now = new Date()): string[] {
  const year = now.getUTCFullYear();
  // 31 January online SA filing; 31 July payments on account — stated as calendar facts, not invented thresholds.
  return [
    `Online Self Assessment filing deadline: 31 January ${year + (now.getUTCMonth() > 0 ? 1 : 0)} (confirm on GOV.UK for your tax year).`,
    "Payments on account are typically due 31 January and 31 July — verify your own balancing payment on GOV.UK.",
    "MTD for Income Tax start dates depend on qualifying income and tax year — check the official eligibility page.",
  ];
}

function pickFocus(hour: number): CampaignFocus {
  if (hour % 3 === 0) return "SELF_ASSESSMENT";
  if (hour % 3 === 1) return "MTD";
  return "GENERAL";
}

function britishFixtureCopy(focus: CampaignFocus, topic: string): Omit<MarketingDraft, "id" | "createdAt" | "updatedAt" | "audit"> {
  const priceNote = PROPOSED_STARTING_PRICES.disclaimer;
  const caption =
    focus === "MTD"
      ? `Making Tax Digital can feel sudden when HMRC writes to you. Here is a calm next step for ${topic.toLowerCase()} — always re-check GOV.UK for your tax year.`
      : focus === "SELF_ASSESSMENT"
        ? `Self Assessment does not have to be a January scramble. A practical look at ${topic.toLowerCase()}, with official sources linked.`
        : `Clear UK tax guidance on ${topic.toLowerCase()}. No invented rankings, no fake urgency — just useful next steps.`;

  return {
    stage: "ai_draft",
    focus,
    title: topic,
    caption,
    copyLong: [
      caption,
      "",
      "What to do next:",
      "1. Open the GOV.UK page linked below and confirm the rule for your tax year.",
      "2. Note whether you are dealing with annual Self Assessment filing or ongoing MTD reporting — they are separate jobs.",
      "3. Gather invoices, platform statements and expense evidence before you file or update.",
      "",
      priceNote,
      "TaxSimba provides accountant-led support. This is general information, not personal tax advice.",
    ].join("\n"),
    googleAdsDraft: `Headline ideas (draft only): ${topic} | TaxSimba\nDescription: Practical UK help. Confirm rules on GOV.UK. Owner must set bids and budgets — no automated spend.`,
    landingCta:
      focus === "MTD"
        ? "Compare MTD support — verify live price on checkout before any public claim."
        : "Compare Self Assessment packages — verify live price on checkout before any public claim.",
    videoScript: `Hook (3s): "${topic} — explained calmly."\nBody (20s): Walk through one practical checklist item and point to GOV.UK.\nCTA (5s): "Compare TaxSimba support when you are ready."\nOn-screen: TaxSimba logo from approved brand assets only.`,
    sources: GOVUK_SOURCES,
    nation: "UK",
    fixtureMode: true,
    artworkApproved: false,
  };
}

export async function runDailyEngine(actor = "system:daily-engine"): Promise<{
  created: MarketingDraft[];
  skippedReason?: string;
  searchDemandEvidence: "unavailable" | "connected_pending_sync";
}> {
  if (marketingHubPaused()) {
    return { created: [], skippedReason: "Marketing Hub is paused (MARKETING_HUB_PAUSED).", searchDemandEvidence: "unavailable" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await listDrafts(100);
  const todays = existing.filter((d) => d.createdAt.startsWith(today));
  const remaining = Math.max(0, dailyDraftLimit() - todays.length);
  if (remaining === 0) {
    return { created: [], skippedReason: "Daily draft limit reached.", searchDemandEvidence: "unavailable" };
  }

  const templates = getTemplateLibrary().filter((t) => t.status !== "retired");
  const focus = pickFocus(new Date().getUTCHours());
  const pool = templates.filter((t) => t.focus === focus);
  const created: MarketingDraft[] = [];

  for (let i = 0; i < remaining; i += 1) {
    const template = pool[i % pool.length] ?? templates[i % templates.length];
    const base = britishFixtureCopy(focus, template.title);
    // Real generation path reserved — only used when fixture mode is off AND a key exists.
    // Without a key we stay on fixtures and label clearly.
    const canCallLlm = !marketingFixtureMode() && Boolean(generationApiKey());
    const draft: MarketingDraft = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...base,
      fixtureMode: !canCallLlm,
      templateId: template.id,
      publishIdempotencyKey: `draft-${today}-${template.id}-${i}`,
      audit: [{ at: new Date().toISOString(), actor, action: "created", detail: canCallLlm ? "generation_api" : "fixture" }],
    };

    if (canCallLlm) {
      // Intentionally not calling external APIs in CI. Staging must set keys and FIXTURE_MODE=false.
      draft.audit.push({
        at: new Date().toISOString(),
        actor,
        action: "generation_deferred",
        detail: "Generation key present but live LLM call is staging-gated; fixture body retained until Toxel enables.",
      });
    }

    await insertDraft(draft);
    created.push(draft);
  }

  await appendAudit(actor, "daily_engine_run", `created=${created.length}`);
  return {
    created,
    searchDemandEvidence: "unavailable",
    skippedReason: undefined,
  };
}

export function buildTikTokManualPack(draft: MarketingDraft): {
  aspectRatio: "9:16";
  caption: string;
  hooks: string[];
  script: string;
  postingNotes: string[];
  downloadable: true;
  autoPublish: false;
} {
  return {
    aspectRatio: "9:16",
    caption: draft.caption,
    hooks: [
      draft.title,
      "UK tax — clear next steps",
      "Check GOV.UK for your year",
    ],
    script: draft.videoScript ?? draft.copyLong,
    postingNotes: [
      "TikTok is MANUAL ONLY — download this pack and post from the official TikTok app.",
      "Do not claim HMRC approval, guaranteed savings, or unverified prices.",
      "Use TaxSimba logo.svg from the repository — never a generative-AI recreation.",
    ],
    downloadable: true,
    autoPublish: false,
  };
}
