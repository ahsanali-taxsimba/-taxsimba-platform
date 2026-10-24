import { env, intEnv } from "../config/env";

/** Secret/config NAMES only — values stay in the hosting environment. */
export const CONTENT_AUTOMATION_SECRET_NAMES = [
  "CONTENT_AUTOMATION_ENABLED",
  "CONTENT_AUTOMATION_PAUSED",
  "CONTENT_AUTOMATION_PUBLIC_BASE_URL",
  "CONTENT_AUTOMATION_ALERT_WEBHOOK_URL",
  "CONTENT_AUTOMATION_GENERATION_API_KEY",
  "CONTENT_AUTOMATION_GENERATION_API_BASE",
  "CONTENT_AUTOMATION_GENERATION_MODEL",
  "CONTENT_AUTOMATION_IMAGE_API_KEY",
  "CONTENT_AUTOMATION_IMAGE_API_BASE",
  "CONTENT_AUTOMATION_DAILY_JOB_LIMIT",
  "CONTENT_AUTOMATION_API_BUDGET",
  "CONTENT_AUTOMATION_FIXTURE_MODE",
  "MONGO_URL",
] as const;

export function contentAutomationEnabled(): boolean {
  return String(env("CONTENT_AUTOMATION_ENABLED") || "").toLowerCase() === "true";
}

export function contentAutomationPaused(): boolean {
  return String(env("CONTENT_AUTOMATION_PAUSED") || "").toLowerCase() === "true";
}

export function contentAutomationFixtureMode(): boolean {
  const v = String(env("CONTENT_AUTOMATION_FIXTURE_MODE") || "").toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  // Default to fixture mode unless a generation key is present.
  return !env("CONTENT_AUTOMATION_GENERATION_API_KEY");
}

export function contentAutomationPublicBaseUrl(): string {
  return (
    env("CONTENT_AUTOMATION_PUBLIC_BASE_URL") ||
    env("APP_BASE_URL") ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

export function contentAutomationDailyJobLimit(): number {
  return intEnv("CONTENT_AUTOMATION_DAILY_JOB_LIMIT", 5);
}

export function contentAutomationApiBudget(): number {
  return intEnv("CONTENT_AUTOMATION_API_BUDGET", 40);
}

export function generationApiConfig(): {
  apiKey?: string;
  base: string;
  model: string;
} {
  return {
    apiKey: env("CONTENT_AUTOMATION_GENERATION_API_KEY"),
    base: env("CONTENT_AUTOMATION_GENERATION_API_BASE") || "https://api.openai.com/v1",
    model: env("CONTENT_AUTOMATION_GENERATION_MODEL") || "gpt-4.1-mini",
  };
}

export function imageApiConfig(): { apiKey?: string; base: string } {
  return {
    apiKey: env("CONTENT_AUTOMATION_IMAGE_API_KEY"),
    base: env("CONTENT_AUTOMATION_IMAGE_API_BASE") || "https://api.openai.com/v1",
  };
}

export function alertWebhookUrl(): string | undefined {
  return env("CONTENT_AUTOMATION_ALERT_WEBHOOK_URL");
}

/** Official topic areas the worker is allowed to monitor. */
export const MONITORED_TOPICS = [
  "Self Assessment",
  "sole traders",
  "freelancers",
  "small businesses",
  "landlords",
  "rental income",
  "Making Tax Digital for Income Tax",
  "CIS contractors",
  "CIS subcontractors",
  "Uber private hire drivers",
  "delivery drivers",
  "National Insurance",
] as const;

export const COMPETITOR_TOPIC_URLS = [
  "https://taxfix.com/en-uk/category/blog/",
  "https://www.theaccountancy.co.uk/accountancy-news-and-articles",
  "https://gorillaaccounting.com/blog/",
] as const;

/** Approved artwork fallbacks by category (existing site assets — never regenerate the library). */
export const APPROVED_ARTWORK_FALLBACKS: Record<string, { src: string; alt: string }> = {
  "Making Tax Digital": {
    src: "/images/blog-category-mtd.png",
    alt: "Making Tax Digital tax guide illustration",
  },
  "Self Assessment": {
    src: "/images/blog-category-self-assessment.png",
    alt: "Self Assessment tax guide illustration",
  },
  Landlords: {
    src: "/images/blog-category-landlord.png",
    alt: "Landlord tax guide illustration",
  },
  CIS: {
    src: "/images/blog-category-cis.png",
    alt: "CIS contractor tax guide illustration",
  },
  default: {
    src: "/images/tax_blog_default.png",
    alt: "TaxSimba UK tax guide",
  },
};
