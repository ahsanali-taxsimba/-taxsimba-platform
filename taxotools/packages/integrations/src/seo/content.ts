import type { ContentGenInput, ContentGenResult } from "./types";

function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function isContentLlmConfigured(): boolean {
  return Boolean(openaiKey());
}

function stubArticle(input: ContentGenInput): Record<string, unknown> {
  const keyword = input.keyword || "seo";
  const title = input.title || `The Complete Guide to ${keyword}`;
  const tone = input.tone || "expert";
  return {
    title,
    metaTitle: `${title} | Taxotools`.slice(0, 60),
    metaDescription: `Master ${keyword} with SEO + AI visibility tactics.`.slice(0, 155),
    outline: [
      { level: "h2", text: `What is ${keyword}?` },
      { level: "h2", text: `How to improve ${keyword}` },
      { level: "h2", text: "FAQs" },
    ],
    bodyMarkdown: `# ${title}\n\nActionable guidance on ${keyword} for search and AI engines (${tone}).\n`,
    faq: [
      { q: `What is ${keyword}?`, a: `${keyword} improves discovery across search and AI answers.` },
    ],
    schemaJsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
    },
    provider: "stub",
  };
}

function stubForType(input: ContentGenInput): Record<string, unknown> {
  const base = stubArticle(input);
  switch (input.type) {
    case "OUTLINE":
      return { outline: base.outline };
    case "META":
      return { metaTitle: base.metaTitle, metaDescription: base.metaDescription };
    case "FAQ":
      return { faq: base.faq };
    case "SCHEMA":
      return { schemaJsonLd: base.schemaJsonLd };
    case "SOCIAL_POST":
      return {
        posts: [
          {
            platform: "LINKEDIN",
            content: `New insights on ${input.keyword || "SEO"} — track ranks and AI citations in Taxotools.`,
          },
        ],
      };
    default:
      return base;
  }
}

async function openaiJson(
  system: string,
  user: string,
): Promise<Record<string, unknown> | null> {
  const key = openaiKey();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CONTENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * Generate SEO content via OpenAI when configured; otherwise structured stubs.
 */
export async function generateSeoContent(input: ContentGenInput): Promise<ContentGenResult> {
  if (!openaiKey()) {
    return { output: stubForType(input), mode: "heuristic", source: "stub" };
  }

  try {
    const brand = input.brand || "the brand";
    const domain = input.domain || "";
    const keyword = input.keyword || "seo";
    const type = input.type || "ARTICLE";

    const system =
      "You are Taxotools Content Genius, an SEO content engine. " +
      "Always respond with a single JSON object. No markdown fences.";

    let schemaHint =
      '{ "title": string, "metaTitle": string, "metaDescription": string, "outline": [{"level":"h2"|"h3","text":string}], "bodyMarkdown": string, "faq": [{"q":string,"a":string}], "schemaJsonLd": object }';
    if (type === "OUTLINE") schemaHint = '{ "outline": [{"level":"h2"|"h3","text":string}] }';
    if (type === "META") schemaHint = '{ "metaTitle": string, "metaDescription": string }';
    if (type === "FAQ") schemaHint = '{ "faq": [{"q":string,"a":string}] }';
    if (type === "SCHEMA") schemaHint = '{ "schemaJsonLd": object }';
    if (type === "SOCIAL_POST") {
      schemaHint = '{ "posts": [{"platform": string, "content": string}] }';
    }

    const user =
      `Generate ${type} content.\n` +
      `Keyword: ${keyword}\n` +
      `Title hint: ${input.title || ""}\n` +
      `Tone: ${input.tone || "expert"}\n` +
      `Brand: ${brand}\n` +
      `Domain: ${domain}\n` +
      `JSON shape: ${schemaHint}`;

    const output = await openaiJson(system, user);
    if (!output) throw new Error("Empty content response");
    return {
      output: { ...output, provider: "openai" },
      mode: "live",
      source: "openai",
    };
  } catch {
    return {
      output: { ...stubForType(input), providerNote: "OpenAI failed — stub used" },
      mode: "heuristic",
      source: "stub_fallback",
    };
  }
}
