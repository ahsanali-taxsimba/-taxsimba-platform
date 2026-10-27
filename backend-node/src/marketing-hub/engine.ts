/** Daily AI marketing engine — real generation when configured; clear disconnected otherwise. */

import { randomUUID } from "crypto";

import {
  dailyDraftLimit,
  generationApiBase,
  generationApiKey,
  generationModel,
  marketingFixtureMode,
  PROPOSED_STARTING_PRICES,
} from "./config";
import { focusLabel } from "./claims";
import { appendAudit, getTemplateLibrary, insertDraft, isMarketingPaused, listDrafts } from "./store";
import type { CampaignFocus, MarketingDraft } from "./types";
import { WORKFLOW_LABELS } from "./types";

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

export type GenerationStatus =
  | "fixture_demo"
  | "real_generation"
  | "disconnected"
  | "paused"
  | "limit_reached"
  | "generation_failed";

function pickFocus(hour: number): CampaignFocus {
  if (hour % 3 === 0) return "SELF_ASSESSMENT";
  if (hour % 3 === 1) return "MTD";
  return "GENERAL";
}

function britishFixtureCopy(
  focus: CampaignFocus,
  topic: string,
): Omit<MarketingDraft, "id" | "createdAt" | "updatedAt" | "audit"> {
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
      `Focus: ${focusLabel(focus)}. Keep Self Assessment filing and ongoing MTD reporting separate.`,
      "",
      "What to do next:",
      "1. Open the GOV.UK page linked below and confirm the rule for your tax year.",
      "2. Gather invoices, platform statements and expense evidence before you file or update.",
      "",
      priceNote,
      "TaxSimba provides accountant-led support. This is general information, not personal tax advice. TaxSimba is not endorsed by HMRC.",
    ].join("\n"),
    googleAdsDraft: `Headline ideas (draft only): ${topic} | TaxSimba\nDescription: Practical UK help. Confirm rules on GOV.UK. Owner must set bids and budgets — no automated spend. Do not state prices until checkout is verified.`,
    landingCta:
      focus === "MTD"
        ? "Compare MTD support — verify live price on checkout before any public claim."
        : focus === "SELF_ASSESSMENT"
          ? "Compare Self Assessment packages — verify live price on checkout before any public claim."
          : "Explore TaxSimba guides — no unverified prices in this creative.",
    videoScript: `Hook (3s): "${topic} — explained calmly."\nBody (20s): Walk through one practical checklist item and point to GOV.UK.\nCTA (5s): "Compare TaxSimba support when you are ready."\nOn-screen: TaxSimba logo from approved brand assets only. Never claim HMRC endorsement.`,
    sources: GOVUK_SOURCES,
    nation: "UK",
    fixtureMode: true,
    artworkApproved: false,
  };
}

async function callGenerationApi(topic: string, focus: CampaignFocus): Promise<{
  title: string;
  caption: string;
  copyLong: string;
  googleAdsDraft: string;
  landingCta: string;
  videoScript: string;
}> {
  const key = generationApiKey();
  if (!key) throw new Error("GENERATION_DISCONNECTED");

  const system = [
    "You write original British-English UK tax marketing drafts for TaxSimba.",
    "Never claim HMRC approval, endorsement, certification or guaranteed outcomes.",
    "Never invent reviews, rankings, awards or customer counts.",
    "Never state £ prices or discounts — say prices must be verified on checkout.",
    "Keep Self Assessment (annual filing) and Making Tax Digital (ongoing reporting) clearly separate.",
    "Return strict JSON keys: title, caption, copyLong, googleAdsDraft, landingCta, videoScript.",
  ].join(" ");

  const user = `Topic: ${topic}. Focus: ${focusLabel(focus)}. Include calm next steps and a reminder to check GOV.UK.`;

  const res = await fetch(`${generationApiBase().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: generationModel(),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Generation API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Generation API returned empty content");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    title: String(parsed.title || topic),
    caption: String(parsed.caption || ""),
    copyLong: String(parsed.copyLong || ""),
    googleAdsDraft: String(parsed.googleAdsDraft || ""),
    landingCta: String(parsed.landingCta || ""),
    videoScript: String(parsed.videoScript || ""),
  };
}

export async function runDailyEngine(actor = "system:daily-engine"): Promise<{
  created: MarketingDraft[];
  skippedReason?: string;
  generationStatus: GenerationStatus;
  searchDemandEvidence: "unavailable" | "connected_pending_sync";
  mode: "fixture" | "real" | "disconnected";
}> {
  if (await isMarketingPaused()) {
    return {
      created: [],
      skippedReason: "Marketing Hub is paused (env or emergency pause).",
      generationStatus: "paused",
      searchDemandEvidence: "unavailable",
      mode: "disconnected",
    };
  }

  const fixture = marketingFixtureMode();
  const key = generationApiKey();

  // Real mode without credentials → clear disconnected state (no simulated success drafts).
  if (!fixture && !key) {
    return {
      created: [],
      skippedReason:
        "Generation disconnected: MARKETING_HUB_FIXTURE_MODE=false but MARKETING_HUB_GENERATION_API_KEY is not configured.",
      generationStatus: "disconnected",
      searchDemandEvidence: "unavailable",
      mode: "disconnected",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await listDrafts(100);
  const todays = existing.filter((d) => d.createdAt.startsWith(today));
  const remaining = Math.max(0, dailyDraftLimit() - todays.length);
  if (remaining === 0) {
    return {
      created: [],
      skippedReason: "Daily draft limit reached.",
      generationStatus: "limit_reached",
      searchDemandEvidence: "unavailable",
      mode: fixture ? "fixture" : "real",
    };
  }

  const templates = getTemplateLibrary().filter((t) => t.status !== "retired");
  const focus = pickFocus(new Date().getUTCHours());
  const pool = templates.filter((t) => t.focus === focus);
  const created: MarketingDraft[] = [];
  let generationStatus: GenerationStatus = fixture ? "fixture_demo" : "real_generation";

  for (let i = 0; i < remaining; i += 1) {
    const template = pool[i % pool.length] ?? templates[i % templates.length];
    const idempotencyKey = `draft-${today}-${template.id}-${i}`;
    if (existing.some((d) => d.publishIdempotencyKey === idempotencyKey)) {
      continue; // duplicate prevention
    }

    let body = britishFixtureCopy(focus, template.title);
    let usedReal = false;

    if (!fixture && key) {
      try {
        const gen = await callGenerationApi(template.title, focus);
        body = {
          ...body,
          ...gen,
          fixtureMode: false,
          sources: GOVUK_SOURCES,
          stage: "ai_draft",
          nation: "UK",
          artworkApproved: false,
          focus,
        };
        usedReal = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "GENERATION_DISCONNECTED") {
          return {
            created: [],
            skippedReason: "Generation disconnected: API key missing at call time.",
            generationStatus: "disconnected",
            searchDemandEvidence: "unavailable",
            mode: "disconnected",
          };
        }
        return {
          created,
          skippedReason: `Generation failed: ${msg}`,
          generationStatus: "generation_failed",
          searchDemandEvidence: "unavailable",
          mode: "real",
        };
      }
    }

    const draft: MarketingDraft = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...body,
      fixtureMode: !usedReal,
      templateId: template.id,
      assetId: template.id.replace(/^tmpl-/, "TS-"),
      workflowLabel: WORKFLOW_LABELS.ai_draft,
      retryCount: 0,
      publishIdempotencyKey: idempotencyKey,
      audit: [
        {
          at: new Date().toISOString(),
          actor,
          action: "created",
          detail: usedReal ? "real_generation" : "fixture_demo",
        },
      ],
    };

    try {
      await insertDraft(draft);
      created.push(draft);
    } catch (e) {
      // Unique idempotency key collision → skip
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|E11000/i.test(msg)) continue;
      throw e;
    }
  }

  await appendAudit(actor, "daily_engine_run", `created=${created.length};status=${generationStatus}`);
  return {
    created,
    generationStatus,
    searchDemandEvidence: "unavailable",
    mode: fixture ? "fixture" : "real",
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
    hooks: [draft.title, "UK tax — clear next steps", "Check GOV.UK for your year"],
    script: draft.videoScript ?? draft.copyLong,
    postingNotes: [
      "TikTok is MANUAL ONLY — download this pack and post from the official TikTok app.",
      "Do not claim HMRC approval, guaranteed savings, or unverified prices.",
      "Use TaxSimba logo.svg from the repository — never a generative-AI recreation.",
      `Keep focus separate: ${focusLabel(draft.focus)}.`,
    ],
    downloadable: true,
    autoPublish: false,
  };
}
