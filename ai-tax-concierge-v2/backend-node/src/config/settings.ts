/**
 * Application settings — secrets stay server-side.
 * Mirrors Python app.core.config.Settings with camelCase Node surface.
 */

export type SettingsOverrides = Partial<{
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_TIMEOUT_SECONDS: number | string;
  CONCIERGE_ENV: string;
  CONCIERGE_CORS_ORIGINS: string;
  CONCIERGE_LOG_LEVEL: string;
  CONCIERGE_FORCE_MOCK_LLM: boolean | string;
  CONSULTATION_BOOKING_URL: string;
  CONSULTATION_BOOKING_LIVE: boolean | string;
  WEBSITE_BASE_URL: string;
}>;

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return false;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function envOr(
  key: string,
  fallback: string,
  overrides: SettingsOverrides,
): string {
  const o = overrides[key as keyof SettingsOverrides];
  if (o !== undefined && o !== null) return String(o);
  const fromEnv = process.env[key];
  if (fromEnv !== undefined && fromEnv !== null) return fromEnv;
  return fallback;
}

const DEFAULT_CORS =
  "http://localhost:3000,http://127.0.0.1:3000," +
  "http://localhost:8090,http://127.0.0.1:8090," +
  "http://localhost:8091,http://127.0.0.1:8091," +
  "null";

export class Settings {
  readonly openaiApiKey: string;
  readonly openaiModel: string;
  readonly openaiTimeoutSeconds: number;
  readonly conciergeEnv: string;
  readonly conciergeCorsOrigins: string;
  readonly conciergeLogLevel: string;
  readonly conciergeForceMockLlm: boolean;
  readonly consultationBookingUrl: string;
  readonly consultationBookingLive: boolean;
  readonly websiteBaseUrl: string;

  constructor(overrides: SettingsOverrides = {}) {
    this.openaiApiKey = envOr("OPENAI_API_KEY", "", overrides).trim();
    this.openaiModel = envOr("OPENAI_MODEL", "gpt-4o-mini", overrides);
    const timeoutRaw =
      overrides.OPENAI_TIMEOUT_SECONDS ??
      process.env.OPENAI_TIMEOUT_SECONDS ??
      30;
    this.openaiTimeoutSeconds = Number(timeoutRaw);
    this.conciergeEnv = envOr("CONCIERGE_ENV", "development", overrides);
    this.websiteBaseUrl = envOr(
      "WEBSITE_BASE_URL",
      "https://www.taxsimba.co.uk",
      overrides,
    );
    let cors = envOr("CONCIERGE_CORS_ORIGINS", DEFAULT_CORS, overrides);
    // Never allow wildcard CORS in staging/production.
    if (
      (this.conciergeEnv === "staging" || this.conciergeEnv === "production") &&
      cors.split(",").some((o) => o.trim() === "*")
    ) {
      cors = cors
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o && o !== "*")
        .join(",");
      if (!cors) cors = this.websiteBaseUrl;
    }
    this.conciergeCorsOrigins = cors;
    this.conciergeLogLevel = envOr("CONCIERGE_LOG_LEVEL", "INFO", overrides);
    const forceRaw =
      overrides.CONCIERGE_FORCE_MOCK_LLM ??
      process.env.CONCIERGE_FORCE_MOCK_LLM;
    this.conciergeForceMockLlm = parseBool(forceRaw);
    this.consultationBookingUrl = envOr(
      "CONSULTATION_BOOKING_URL",
      "https://calendly.com/example/taxsimba-99-consultation",
      overrides,
    );
    const liveRaw =
      overrides.CONSULTATION_BOOKING_LIVE ??
      process.env.CONSULTATION_BOOKING_LIVE;
    this.consultationBookingLive =
      parseBool(liveRaw) &&
      !/example|localhost|stub/i.test(this.consultationBookingUrl);
  }

  get corsOrigins(): string[] {
    return this.conciergeCorsOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get useMockLlm(): boolean {
    if (this.conciergeForceMockLlm) return true;
    return !Boolean(this.openaiApiKey.trim());
  }

  get isProductionLike(): boolean {
    return this.conciergeEnv === "staging" || this.conciergeEnv === "production";
  }

  safePublicConfig(): Record<string, unknown> {
    return {
      env: this.conciergeEnv,
      phase: 3,
      product: "SIMBA AI",
      subtitle: "SIMBA AI Tax Assistant",
      llm_mode: this.useMockLlm ? "mock" : "openai",
      // Do not expose model id publicly in production-like envs.
      model: this.isProductionLike
        ? undefined
        : this.useMockLlm
          ? "mock-simba-v1"
          : this.openaiModel,
      website_base_url: this.websiteBaseUrl,
      consultation_price_gbp: 99,
      consultation_duration_minutes: 30,
      consultation_meeting: "Google Meet",
      consultation_booking_available: this.consultationBookingLive,
      consultation_booking_status: this.consultationBookingLive
        ? "live"
        : "not_connected",
      payment_status: "unavailable",
      free_callback_available: false,
      mock_notice: this.useMockLlm ? "MOCK MODE — not live OpenAI." : null,
    };
  }
}

export function createSettings(overrides: SettingsOverrides = {}): Settings {
  return new Settings(overrides);
}

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (!cached) cached = createSettings();
  return cached;
}

export function resetSettingsCache(): void {
  cached = null;
}
