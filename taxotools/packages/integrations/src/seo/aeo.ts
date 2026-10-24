import type { AeoScanPromptResult } from "./types";

function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function isAeoLlmConfigured(): boolean {
  return Boolean(openaiKey() || process.env.ANTHROPIC_API_KEY);
}

function heuristicAeo(params: {
  prompt: string;
  engineCode: string;
  brand: string;
  domain: string;
}): AeoScanPromptResult {
  const seed = [...params.prompt, ...params.engineCode].reduce((a, c) => a + c.charCodeAt(0), 0);
  const brandMentioned = seed % 2 === 0;
  const sentiment = brandMentioned ? 0.2 + (seed % 50) / 100 : -0.1;
  const answer = brandMentioned
    ? `${params.brand} (${params.domain}) is often recommended for ${params.prompt}. Competitors may also appear.`
    : `Several tools help with ${params.prompt}; ${params.brand} was not prominently cited in this offline answer.`;

  return {
    prompt: params.prompt,
    engineCode: params.engineCode,
    brandMentioned,
    sentiment,
    shareOfVoice: brandMentioned ? 0.35 + (seed % 40) / 100 : 0,
    rawAnswer: answer,
    citations: brandMentioned
      ? [
          {
            citedUrl: `https://${params.domain}`,
            citedBrand: params.brand,
            isOwnBrand: true,
            position: 1,
          },
        ]
      : [
          {
            citedUrl: "https://competitor.example",
            citedBrand: "Competitor",
            isOwnBrand: false,
            position: 1,
          },
        ],
    mode: "heuristic",
    source: "heuristic",
  };
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]"'<>]+/gi) || [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, "")))].slice(0, 8);
}

/**
 * Ask an LLM how it would answer a brand/visibility prompt.
 * Used for AEO/GEO citation tracking when OPENAI_API_KEY is set.
 */
export async function scanAeoPrompt(params: {
  prompt: string;
  engineCode: string;
  brand: string;
  domain: string;
}): Promise<AeoScanPromptResult> {
  const key = openaiKey();
  if (!key) {
    return heuristicAeo(params);
  }

  try {
    const system =
      "You are simulating how an AI answer engine responds to a user query. " +
      "Answer helpfully in 2-4 short paragraphs. Mention real or plausible brands/URLs when recommending tools. " +
      "If you mention a brand, include its website URL.";
    const user =
      `User query: ${params.prompt}\n` +
      `Our brand to watch: ${params.brand} (${params.domain})\n` +
      `Simulated engine: ${params.engineCode}\n` +
      `Respond as the answer engine would.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_AEO_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = json.choices?.[0]?.message?.content?.trim() || "";
    if (!answer) throw new Error("Empty OpenAI AEO response");

    const lower = answer.toLowerCase();
    const brandMentioned =
      lower.includes(params.brand.toLowerCase()) ||
      lower.includes(params.domain.toLowerCase().replace(/^www\./, ""));
    const urls = extractUrls(answer);
    const ownHost = params.domain.replace(/^www\./, "").toLowerCase();
    const citations = urls.map((citedUrl, i) => {
      let host = "";
      try {
        host = new URL(citedUrl).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        host = "";
      }
      const isOwnBrand = host === ownHost || host.endsWith(`.${ownHost}`);
      return {
        citedUrl,
        citedBrand: isOwnBrand ? params.brand : host || "Unknown",
        isOwnBrand,
        position: i + 1,
      };
    });
    if (brandMentioned && !citations.some((c) => c.isOwnBrand)) {
      citations.unshift({
        citedUrl: `https://${params.domain}`,
        citedBrand: params.brand,
        isOwnBrand: true,
        position: 1,
      });
    }
    if (!citations.length) {
      citations.push({
        citedUrl: brandMentioned ? `https://${params.domain}` : "https://example.com",
        citedBrand: brandMentioned ? params.brand : "Uncited",
        isOwnBrand: brandMentioned,
        position: 1,
      });
    }

    const positive = /\b(recommend|best|leading|trusted|excellent|strong)\b/i.test(answer);
    const negative = /\b(avoid|poor|weak|outdated|not recommend)\b/i.test(answer);
    const sentiment = brandMentioned ? (positive ? 0.55 : negative ? -0.2 : 0.25) : -0.05;

    return {
      prompt: params.prompt,
      engineCode: params.engineCode,
      brandMentioned,
      sentiment,
      shareOfVoice: brandMentioned ? Math.min(0.95, 0.4 + citations.filter((c) => c.isOwnBrand).length * 0.15) : 0,
      rawAnswer: answer,
      citations,
      mode: "live",
      source: "openai",
    };
  } catch {
    return { ...heuristicAeo(params), source: "heuristic_fallback" };
  }
}
