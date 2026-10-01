/** Normalized keyword metrics from any SEO data provider. */
export type KeywordMetrics = {
  keyword: string;
  volume: number;
  difficulty: number;
  cpcCents: number;
  competition?: number;
  trend?: number[];
  related?: string[];
  source: string;
  mode: "live" | "heuristic";
};

export type KeywordSuggestResult = {
  query: string;
  suggestions: KeywordMetrics[];
  mode: "live" | "heuristic";
  source: string;
};

export type SerpOrganicResult = {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
};

export type SerpRankResult = {
  phrase: string;
  domain: string;
  position: number | null;
  url: string | null;
  hasAiOverview: boolean;
  aiOverviewCited?: boolean;
  shareOfVoice: number;
  organics: SerpOrganicResult[];
  features: Array<{ type: string; present: boolean; metadata?: Record<string, unknown> }>;
  mode: "live" | "crawl-derived" | "heuristic";
  source: string;
  raw?: Record<string, unknown>;
};

export type CrawlPageSignal = {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  path?: string | null;
  wordCount?: number | null;
};

export type AeoScanPromptResult = {
  prompt: string;
  engineCode: string;
  brandMentioned: boolean;
  sentiment: number;
  shareOfVoice: number;
  rawAnswer: string;
  citations: Array<{
    citedUrl: string;
    citedBrand: string;
    isOwnBrand: boolean;
    position: number;
  }>;
  mode: "live" | "heuristic";
  source: string;
};

export type ContentGenInput = {
  type: string;
  keyword: string;
  title?: string;
  tone?: string;
  brand?: string;
  domain?: string;
  extra?: Record<string, unknown>;
};

export type ContentGenResult = {
  output: Record<string, unknown>;
  mode: "live" | "heuristic";
  source: string;
};
