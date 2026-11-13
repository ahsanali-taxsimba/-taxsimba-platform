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
    this.conciergeCorsOrigins = envOr(
      "CONCIERGE_CORS_ORIGINS",
      DEFAULT_CORS,
      overrides,
    );
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
    this.websiteBaseUrl = envOr(
      "WEBSITE_BASE_URL",
      "https://www.taxsimba.co.uk",
      overrides,
    );
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

  safePublicConfig(): Record<string, unknown> {
    return {
      env: this.conciergeEnv,
      phase: 3,
      product: "SIMBA AI",
      subtitle: "Your UK Tax Assistant",
      llm_mode: this.useMockLlm ? "mock" : "openai",
      model: this.useMockLlm ? "mock-simba-v1" : this.openaiModel,
      website_base_url: this.websiteBaseUrl,
      consultation_available: true,
      consultation_price_gbp: 99,
      consultation_duration_minutes: 30,
      consultation_meeting: "Google Meet",
      consultation_booking_status: "stub",
      payment_status: "mock_unavailable",
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
