/** Foundational keyword retrieval over the verified HMRC corpus. */

import { loadFacts } from "./loader.js";
import { appliesToYear } from "./tax_year.js";
import type { KnowledgeFact } from "../models/schemas.js";

const TOKEN = /[a-z0-9%]+/gi;
const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "do",
  "does",
  "i",
  "my",
  "me",
  "to",
  "for",
  "of",
  "and",
  "or",
  "in",
  "on",
  "what",
  "when",
  "how",
  "please",
  "can",
  "you",
  "tell",
  "about",
]);

export type RankedFact = {
  fact: KnowledgeFact;
  score: number;
  year_match: boolean;
};

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  const matches = text.match(TOKEN) || [];
  for (const t of matches) {
    const low = t.toLowerCase();
    if (!STOP.has(low) && low.length > 1) out.add(low);
  }
  return out;
}

function normalizeAmounts(text: string): string {
  return text
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/£/g, "")
    .replace(/\s+/g, " ");
}

export function scoreFact(
  query: string,
  fact: KnowledgeFact,
  taxYear: string,
): RankedFact {
  const q = tokens(query);
  const titleTokens = tokens(fact.title);
  const haystack = tokens(
    [fact.title, fact.summary, fact.keywords.join(" "), fact.category].join(
      " ",
    ),
  );
  let overlap = 0;
  for (const t of q) if (haystack.has(t)) overlap += 1;
  let titleOverlap = 0;
  for (const t of q) if (titleTokens.has(t)) titleOverlap += 1;

  let phraseBonus = 0.0;
  const qLower = query.toLowerCase();
  const qAmounts = normalizeAmounts(query);
  for (const kw of fact.keywords) {
    if (qLower.includes(kw.toLowerCase())) phraseBonus += 2.5;
    const kwAmount = normalizeAmounts(kw);
    if (
      kwAmount &&
      qAmounts.includes(kwAmount) &&
      /\d/.test(kwAmount)
    ) {
      phraseBonus += 4.0;
    }
  }
  if (qLower.includes(fact.title.toLowerCase())) phraseBonus += 3.0;

  for (const amount of ["50000", "30000", "20000", "90000", "12570"]) {
    if (
      qAmounts.includes(amount) &&
      normalizeAmounts(
        fact.summary + " " + fact.keywords.join(" "),
      ).includes(amount)
    ) {
      phraseBonus += 5.0;
    }
  }

  const category = (fact.category || "").toLowerCase();
  if (category && qLower.includes(category.replace(/_/g, " "))) {
    phraseBonus += 4.0;
  }
  if (qLower.includes("vat") && category === "vat") phraseBonus += 6.0;
  if (
    (qLower.includes("mtd") || qLower.includes("making tax digital")) &&
    category === "mtd"
  ) {
    phraseBonus += 3.0;
  }

  const yearMatch = appliesToYear(fact.tax_years, taxYear);
  let score = overlap + 2.0 * titleOverlap + phraseBonus;
  if (yearMatch) score += 1.5;
  else score *= 0.35;

  return { fact, score, year_match: yearMatch };
}

export function retrieve(
  query: string,
  taxYear: string,
  limit = 3,
  minScore = 1.5,
  facts?: KnowledgeFact[],
): RankedFact[] {
  const corpus = facts ?? loadFacts();
  let ranked = corpus.map((fact) => scoreFact(query, fact, taxYear));
  ranked = ranked.filter((r) => r.score >= minScore);
  // Python: sort key (year_match, score) reverse=True → year_match True first, then higher score
  ranked.sort((a, b) => {
    if (Number(b.year_match) !== Number(a.year_match)) {
      return Number(b.year_match) - Number(a.year_match);
    }
    return b.score - a.score;
  });
  return ranked.slice(0, limit);
}
