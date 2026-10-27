/** Marketing Hub runtime flags. Secret values never logged. */

import { env, intEnv } from "../config/env";

export const MARKETING_TARGETS = {
  mtdPayingBy: "2026-12-31",
  mtdPayingGoal: 1000,
  saPayingBy: "2027-01-31",
  saPayingGoal: 5000,
} as const;

/** Proposed starting prices for creative drafts only — not live checkout truth. */
export const PROPOSED_STARTING_PRICES = {
  selfAssessmentGbp: 119,
  mtdGbp: 29.99,
  disclaimer:
    "Proposed starting prices for draft creatives only. Do not publish until live checkout, VAT, billing period, inclusions and offer terms are verified.",
} as const;

export const BRAND = {
  forest: "#031f18",
  green: "#37A267",
  mint: "#EAF6F0",
  lime: "#B3ED97",
  logoPath: "/images/logo.svg",
  logoSource: "tax_simba_frontend/public/images/logo.svg",
} as const;

export function marketingHubEnabled(): boolean {
  return (env("MARKETING_HUB_ENABLED") ?? "true").toLowerCase() !== "false";
}

/** Env kill switch — also OR'd with durable Mongo pause via `isMarketingPaused()`. */
export function marketingHubPausedEnv(): boolean {
  return (env("MARKETING_HUB_PAUSED") ?? "false").toLowerCase() === "true";
}

/** @deprecated Prefer `isMarketingPaused()` which includes durable Mongo pause. */
export function marketingHubPaused(): boolean {
  return marketingHubPausedEnv();
}

/** When true, drafts use deterministic British-English fixtures (no external LLM). */
export function marketingFixtureMode(): boolean {
  return (env("MARKETING_HUB_FIXTURE_MODE") ?? "true").toLowerCase() !== "false";
}

/** Organic auto-publish requires explicit production authorisation. */
export function organicPublishAuthorised(): boolean {
  return (env("MARKETING_HUB_ORGANIC_PUBLISH_AUTHORISED") ?? "false").toLowerCase() === "true";
}

export function generationApiKey(): string | undefined {
  return env("MARKETING_HUB_GENERATION_API_KEY");
}

export function generationApiBase(): string {
  return env("MARKETING_HUB_GENERATION_API_BASE") ?? "https://api.openai.com/v1";
}

export function generationModel(): string {
  return env("MARKETING_HUB_GENERATION_MODEL") ?? "gpt-4.1-mini";
}

export function alertWebhookUrl(): string | undefined {
  return env("MARKETING_HUB_ALERT_WEBHOOK_URL");
}

export function dailyDraftLimit(): number {
  return intEnv("MARKETING_HUB_DAILY_DRAFT_LIMIT", 5);
}

export const PLATFORM_IDS = [
  "facebook_pages",
  "instagram_professional",
  "linkedin_company",
  "google_ads",
  "google_search_console",
  "google_analytics_4",
  "tiktok_manual",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];
