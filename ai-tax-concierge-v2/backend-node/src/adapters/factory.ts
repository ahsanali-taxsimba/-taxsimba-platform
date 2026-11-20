/** Build adapters from settings. */

import type { Settings } from "../config/settings.js";
import type { LLMAdapter } from "./base.js";
import { MockLLMAdapter } from "./llm_mock.js";
import { OpenAIAdapter } from "./llm_openai.js";
import {
  ConfigCalendlyAdapter,
  ConfigWebsiteNavAdapter,
  MockClientPortalAdapter,
  MockPaymentAdapter,
} from "./stubs.js";

export function buildLlmAdapter(settings: Settings): LLMAdapter {
  if (settings.useMockLlm) {
    return new MockLLMAdapter();
  }
  return new OpenAIAdapter({
    apiKey: settings.openaiApiKey,
    model: settings.openaiModel,
    timeoutSeconds: settings.openaiTimeoutSeconds,
    dailyTokenBudget: Number(
      process.env.OPENAI_DAILY_TOKEN_BUDGET || 250_000,
    ),
  });
}

export function buildStubAdapters(settings: Settings): {
  website: ConfigWebsiteNavAdapter;
  payment: MockPaymentAdapter;
  calendly: ConfigCalendlyAdapter;
  client_portal: MockClientPortalAdapter;
} {
  return {
    website: new ConfigWebsiteNavAdapter(settings),
    payment: new MockPaymentAdapter(),
    calendly: new ConfigCalendlyAdapter(settings),
    client_portal: new MockClientPortalAdapter(),
  };
}
