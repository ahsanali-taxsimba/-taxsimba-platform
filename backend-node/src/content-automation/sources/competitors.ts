import { COMPETITOR_TOPIC_URLS, contentAutomationFixtureMode } from "../config";

export type CompetitorTopicIdea = {
  sourceUrl: string;
  title: string;
  question: string;
  /** Ideas only — never copy competitor wording into drafts. */
  ideaOnly: true;
};

/**
 * Pull lightweight topic ideas from competitor listing pages.
 * Titles are treated as reader-question prompts only; drafting must verify
 * independently against HMRC/GOV.UK and write original TaxSimba copy.
 */
export async function discoverCompetitorTopicIdeas(): Promise<CompetitorTopicIdea[]> {
  if (contentAutomationFixtureMode()) {
    return [
      {
        sourceUrl: COMPETITOR_TOPIC_URLS[0],
        title: "Do I need to register for Self Assessment this year?",
        question: "When does a sole trader need to register for Self Assessment?",
        ideaOnly: true,
      },
      {
        sourceUrl: COMPETITOR_TOPIC_URLS[1],
        title: "MTD quarterly updates vs the final tax bill",
        question: "What is the difference between an MTD quarterly update and the tax payment?",
        ideaOnly: true,
      },
      {
        sourceUrl: COMPETITOR_TOPIC_URLS[2],
        title: "Landlord rental income records for MTD",
        question: "Which rental records should landlords keep for Making Tax Digital?",
        ideaOnly: true,
      },
    ];
  }

  const ideas: CompetitorTopicIdea[] = [];
  for (const sourceUrl of COMPETITOR_TOPIC_URLS) {
    try {
      const res = await fetch(sourceUrl, {
        headers: { "User-Agent": "TaxSimbaContentAutomation/1.0" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const titles = [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
        .filter((t) => t.length > 12 && t.length < 120)
        .slice(0, 5);
      for (const title of titles) {
        ideas.push({
          sourceUrl,
          title,
          question: `Reader question suggested by competitor listing: ${title}`,
          ideaOnly: true,
        });
      }
    } catch {
      // Discovery is best-effort; failures must not stop official-source monitoring.
    }
  }
  return ideas;
}
