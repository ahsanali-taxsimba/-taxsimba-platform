/** Normalized backlink row produced by any BacklinkProvider. */
export type ProviderBacklink = {
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  authority: number;
  relevance: number;
  spam: number;
  risk: number;
  sourceApi: string;
  competitorDomain?: string | null;
  relNofollow?: boolean;
  meta?: Record<string, unknown>;
};

export type ProviderDomainMetrics = {
  domain: string;
  /** 0–100 authority-style score */
  authority: number;
  referringDomains?: number;
  rank?: number | null;
  raw?: Record<string, unknown>;
};

export type FetchBacklinksInput = {
  domain: string;
  siteUrl: string;
  competitors?: string[];
  limit?: number;
};

export type FetchBacklinksResult = {
  provider: string;
  mode: "live" | "stub";
  links: ProviderBacklink[];
  metrics?: ProviderDomainMetrics;
  error?: string;
};

export interface BacklinkProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when API credentials are configured for live calls. */
  isConfigured(): boolean;
  fetchBacklinks(input: FetchBacklinksInput): Promise<FetchBacklinksResult>;
  /** Optional domain-level metrics (authority / RD count). */
  fetchDomainMetrics?(domains: string[]): Promise<ProviderDomainMetrics[]>;
}
