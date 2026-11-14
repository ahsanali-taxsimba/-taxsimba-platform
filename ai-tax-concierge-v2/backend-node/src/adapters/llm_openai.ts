/** Secure server-side OpenAI adapter with retries and cost controls. */

import OpenAI from "openai";
import { ConciergeError, LLMUnavailableError } from "../core/errors.js";
import type { LLMAdapter } from "./base.js";
import type { ChatMessage } from "../models/schemas.js";

export type OpenAIAdapterOptions = {
  apiKey: string;
  model: string;
  timeoutSeconds?: number;
  maxRetries?: number;
  maxTokens?: number;
  dailyTokenBudget?: number;
};

export class OpenAIAdapter implements LLMAdapter {
  mode = "openai";
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly maxTokens: number;
  private readonly dailyTokenBudget: number;
  private tokensUsedToday = 0;
  private budgetDay: string;
  private readonly apiKeyFingerprint: string;

  constructor(options: OpenAIAdapterOptions) {
    const { apiKey, model } = options;
    if (!apiKey) {
      throw new Error("OpenAIAdapter requires a non-empty api_key");
    }
    const timeoutSeconds = options.timeoutSeconds ?? 30;
    this.client = new OpenAI({
      apiKey,
      timeout: Math.round(timeoutSeconds * 1000),
    });
    this.model = model;
    this.maxRetries = options.maxRetries ?? 2;
    this.maxTokens = options.maxTokens ?? 700;
    this.dailyTokenBudget = options.dailyTokenBudget ?? 250_000;
    this.budgetDay = new Date().toISOString().slice(0, 10);
    this.apiKeyFingerprint =
      apiKey.length > 4 ? `sk-...${apiKey.slice(-4)}` : "sk-...";
  }

  private rollBudgetDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.budgetDay) {
      this.budgetDay = today;
      this.tokensUsedToday = 0;
    }
  }

  usageSnapshot(): Record<string, unknown> {
    this.rollBudgetDay();
    return {
      model: this.model,
      tokens_used_today: this.tokensUsedToday,
      daily_token_budget: this.dailyTokenBudget,
      llm_mode: "openai",
    };
  }

  async complete(args: {
    system_prompt: string;
    messages: ChatMessage[];
    user_message: string;
  }): Promise<string> {
    this.rollBudgetDay();
    if (this.tokensUsedToday >= this.dailyTokenBudget) {
      throw new ConciergeError(
        "AI usage limit reached for today. Please try again later or speak to TaxSimba.",
        { code: "usage_limit", statusCode: 429 },
      );
    }

    const payload: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: args.system_prompt },
    ];
    for (const msg of args.messages.slice(-12)) {
      if (msg.role === "system") continue;
      payload.push({ role: msg.role, content: msg.content });
    }
    payload.push({ role: "user", content: args.user_message });

    let lastExc: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: payload,
          temperature: 0.2,
          max_tokens: this.maxTokens,
        });
        const usage = response.usage;
        if (usage) {
          this.tokensUsedToday += usage.total_tokens || 0;
        }
        const choice = response.choices[0]?.message?.content;
        if (!choice) {
          throw new LLMUnavailableError("Empty response from AI service");
        }
        return choice.trim();
      } catch (exc) {
        if (exc instanceof ConciergeError) throw exc;
        lastExc = exc;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }
    }
    throw new LLMUnavailableError(
      lastExc instanceof Error ? lastExc.message : undefined,
    );
  }
}
