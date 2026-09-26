-- Continuous UK accountancy intelligence schema (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure firm columns exist
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS source text DEFAULT 'discovery';
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS last_crawled_at timestamptz;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS crawl_status text DEFAULT 'pending';
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS authority_score integer DEFAULT 0;

ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound';

-- SEO page-level data
CREATE TABLE IF NOT EXISTS seo_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  page_url text NOT NULL,
  title text,
  meta_description text,
  h1 text,
  h2 jsonb,
  h3 jsonb,
  canonical text,
  robots_meta text,
  schema_types jsonb,
  sitemap_urls jsonb,
  robots_txt text,
  http_status integer,
  redirect_chain jsonb,
  word_count integer,
  internal_links integer,
  external_links integer,
  broken_links integer DEFAULT 0,
  page_depth integer DEFAULT 0,
  lcp_ms numeric,
  cls numeric,
  inp_ms numeric,
  performance_score numeric,
  raw jsonb,
  crawled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, page_url)
);
CREATE INDEX IF NOT EXISTS idx_seo_data_domain ON seo_data (domain);

-- Keyword intelligence
CREATE TABLE IF NOT EXISTS keyword_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  keyword text NOT NULL,
  search_volume integer,
  cpc numeric,
  competition numeric,
  trend jsonb,
  related_keywords jsonb,
  long_tail boolean DEFAULT false,
  difficulty numeric,
  source text DEFAULT 'keywords_everywhere',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, keyword)
);
CREATE INDEX IF NOT EXISTS idx_keyword_data_domain ON keyword_data (domain);
CREATE INDEX IF NOT EXISTS idx_keyword_data_volume ON keyword_data (search_volume DESC NULLS LAST);

-- GEO / local signals
CREATE TABLE IF NOT EXISTS geo_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  business_name text,
  address text,
  city text,
  region text,
  postcode text,
  country text DEFAULT 'GB',
  latitude numeric,
  longitude numeric,
  phone text,
  local_signals jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AEO / answer-engine signals
CREATE TABLE IF NOT EXISTS aeo_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  page_url text,
  has_faq_schema boolean DEFAULT false,
  has_qa_schema boolean DEFAULT false,
  has_local_business_schema boolean DEFAULT false,
  faq_items jsonb,
  qa_items jsonb,
  featured_snippet_candidates jsonb,
  structured_answers jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, page_url)
);
CREATE INDEX IF NOT EXISTS idx_aeo_data_domain ON aeo_data (domain);

-- Competitor snapshots
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  competitor_domain text NOT NULL,
  city text,
  self_backlinks integer DEFAULT 0,
  competitor_backlinks integer DEFAULT 0,
  overlap_referring_domains integer DEFAULT 0,
  self_authority integer DEFAULT 0,
  competitor_authority integer DEFAULT 0,
  keyword_overlap integer DEFAULT 0,
  gap_domains jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, competitor_domain)
);
CREATE INDEX IF NOT EXISTS idx_competitor_profiles_domain ON competitor_profiles (domain);

-- Continuous crawler heartbeat / control
CREATE TABLE IF NOT EXISTS crawler_control (
  id text PRIMARY KEY DEFAULT 'uk-accountancy',
  status text NOT NULL DEFAULT 'running',
  last_cycle_at timestamptz,
  last_heartbeat_at timestamptz,
  cycles_completed integer DEFAULT 0,
  firms_processed integer DEFAULT 0,
  notes text
);

INSERT INTO crawler_control (id, status, last_heartbeat_at, notes)
VALUES ('uk-accountancy', 'running', now(), 'initialized')
ON CONFLICT (id) DO NOTHING;
