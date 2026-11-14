export type UpstreamPlan = {
  id?: string;
  code: string;
  name: string;
  price: number;
  priceAvailable?: boolean;
  billingFrequency?: string;
  billingType?: string;
  vatTreatment?: string;
  description?: string;
  features?: string[];
  category?: string;
  stripePriceId?: string | null;
  currency?: string;
};

export type UpstreamCataloguePayload = {
  success?: boolean;
  data?: UpstreamPlan[];
  message?: string;
};

export type CatalogueSyncResult = {
  started_at: string;
  finished_at: string;
  source_sa: string;
  source_mtd: string;
  applied: boolean;
  reason?: string;
  overlay_version?: string;
  stable_codes_preserved: string[];
  price_changes: Array<{
    code: string;
    from: number | null;
    to: number | null;
  }>;
  name_changes: Array<{ code: string; from: string; to: string }>;
  skipped_unpublished: string[];
  removed_claims_stripped: string[];
};

export type FetchCatalogueFn = (url: string) => Promise<UpstreamCataloguePayload>;
