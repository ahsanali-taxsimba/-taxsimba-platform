export type {
  KeywordMetrics,
  KeywordSuggestResult,
  SerpOrganicResult,
  SerpRankResult,
  CrawlPageSignal,
  AeoScanPromptResult,
  ContentGenInput,
  ContentGenResult,
} from "./types";

export {
  heuristicKeywordMetrics,
  isKeywordsEverywhereConfigured,
  fetchKeywordMetrics,
  suggestKeywords,
  phrasesFromCrawlPages,
} from "./keywords";

export {
  isSerpApiConfigured,
  estimateRankFromCrawl,
  checkKeywordRank,
  organicsToSnapshots,
} from "./serp";

export { isAeoLlmConfigured, scanAeoPrompt } from "./aeo";

export { isContentLlmConfigured, generateSeoContent } from "./content";

import { isKeywordsEverywhereConfigured } from "./keywords";
import { isSerpApiConfigured } from "./serp";
import { isAeoLlmConfigured } from "./aeo";
import { isContentLlmConfigured } from "./content";

export function listSeoProviderStatuses() {
  return [
    {
      id: "keywords_everywhere",
      displayName: "Keywords Everywhere",
      configured: isKeywordsEverywhereConfigured(),
    },
    {
      id: "serpapi",
      displayName: "SerpAPI",
      configured: isSerpApiConfigured(),
    },
    {
      id: "openai_aeo",
      displayName: "OpenAI AEO",
      configured: isAeoLlmConfigured(),
    },
    {
      id: "openai_content",
      displayName: "OpenAI Content",
      configured: isContentLlmConfigured(),
    },
  ];
}
