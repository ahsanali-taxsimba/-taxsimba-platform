/** API and domain schemas (Zod + TypeScript types). */

import { randomUUID } from "node:crypto";
import { z } from "zod";

export type SourceReference = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  tax_years: string[];
  verified: boolean;
  excerpt?: string | null;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type JourneyStepView = {
  step_id: string;
  prompt?: string | null;
  options: Array<{ id: string; label: string }>;
};

export type JourneyState = {
  journey_id: string;
  journey_title: string;
  step_id: string;
  complete: boolean;
  answers: Record<string, string>;
  tags: string[];
  current?: JourneyStepView | null;
  summary?: string | null;
  suggested_package_codes?: string[];
  suggested_calculator_ids?: string[];
  follow_ups?: string[];
};

export type PackageCard = {
  code: string;
  name: string;
  price_gbp: number;
  billing: string;
  vat_note: string;
  family: string;
  inclusions_status: string;
  pressure_free_note?: string;
};

export type CalculatorCard = {
  id: string;
  title: string;
  description: string;
  url_status: string;
  url?: string | null;
  note?: string | null;
};

export type RouteCard = {
  id: string;
  label: string;
  path: string;
  status: string;
  url?: string | null;
  note?: string | null;
  kind?: string | null;
};

export type KnowledgeFact = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  tax_years: string[];
  source_url: string;
  publisher: string;
  category: string;
  last_verified: string;
  effective_date?: string | null;
  knowledge_version?: string | null;
  review_status?: string | null;
};

export type ChatResponse = {
  session_id: string;
  reply: string;
  tax_year: string;
  sources: SourceReference[];
  confidence: "high" | "medium" | "low";
  disclaimer: string;
  assistant_name?: string;
  is_ai_disclosure?: string;
  consultation_hint?: string | null;
  follow_ups: string[];
  packages: PackageCard[];
  calculators: CalculatorCard[];
  routes: RouteCard[];
  journey?: JourneyState | null;
  llm_mode: "openai" | "mock";
  mock_notice?: string | null;
  created_at?: string;
};

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const JourneyStepViewSchema = z.object({
  step_id: z.string(),
  prompt: z.string().nullable().optional(),
  options: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .default([]),
});

export const JourneyStateSchema = z.object({
  journey_id: z.string(),
  journey_title: z.string(),
  step_id: z.string(),
  complete: z.boolean().default(false),
  answers: z.record(z.string()).default({}),
  tags: z.array(z.string()).default([]),
  current: JourneyStepViewSchema.nullable().optional(),
  summary: z.string().nullable().optional(),
  suggested_package_codes: z.array(z.string()).default([]),
  suggested_calculator_ids: z.array(z.string()).default([]),
  follow_ups: z.array(z.string()).default([]),
});

function validateTaxYear(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  const normalised = trimmed.replace(/\//g, "-");
  const parts = normalised.split("-");
  if (parts.length !== 2 || !/^\d{4}$/.test(parts[0]!)) {
    throw new Error("tax_year must look like 2025-26");
  }
  const start = Number(parts[0]);
  const endToken = parts[1]!;
  if (endToken.length === 2) {
    const end = Number(endToken);
    if (end !== (start + 1) % 100) {
      throw new Error("tax_year end must be start+1 (e.g. 2025-26)");
    }
    return `${start}-${endToken.padStart(2, "0")}`;
  }
  if (endToken.length === 4 && Number(endToken) === start + 1) {
    return `${start}-${String(start + 1).slice(2)}`;
  }
  throw new Error("tax_year must look like 2025-26");
}

export const ChatRequestSchema = z.object({
  session_id: z.string().default(() => randomUUID()),
  message: z
    .string()
    .max(4000)
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, { message: "message must not be blank" }),
  tax_year: z
    .string()
    .nullable()
    .optional()
    .transform((v, ctx) => {
      try {
        return validateTaxYear(v ?? null);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: (err as Error).message,
        });
        return z.NEVER;
      }
    }),
  history: z.array(ChatMessageSchema).max(20).default([]),
  journey_id: z.string().nullable().optional(),
  journey_option_id: z.string().nullable().optional(),
  journey_state: JourneyStateSchema.nullable().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const JourneyStartSchema = z.object({
  session_id: z.string().default(() => randomUUID()),
  journey_id: z.string().min(1),
});

export const JourneyAdvanceSchema = z.object({
  session_id: z.string(),
  option_id: z.string(),
  journey_state: JourneyStateSchema,
});

export const AnalyticsTrackSchema = z.object({
  session_id: z.string(),
  event: z.string().regex(/^[a-z0-9_]+$/),
  meta: z.record(z.unknown()).default({}),
});

export const SessionDeleteSchema = z.object({
  session_id: z.string(),
});
