/** Adapter interfaces for external systems. */

import type { ChatMessage, SourceReference } from "../models/schemas.js";

export interface LLMAdapter {
  mode: string;
  complete(args: {
    system_prompt: string;
    messages: ChatMessage[];
    user_message: string;
  }): Promise<string>;
}

export interface WebsiteNavAdapter {
  suggestPaths(intent: string): Array<Record<string, string>>;
}

export interface PaymentAdapter {
  createCheckout(packageCode: string): Record<string, unknown>;
}

export interface CalendlyAdapter {
  consultationLink(priceGbp?: number): Record<string, unknown>;
}

export interface ClientPortalAdapter {
  accountStatus(externalRef: string | null): Record<string, unknown>;
}

export class GroundingContext {
  sources: SourceReference[];
  taxYear: string;

  constructor(sources: SourceReference[], taxYear: string) {
    this.sources = sources;
    this.taxYear = taxYear;
  }
}
