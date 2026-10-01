-- TaxoTools UK Accountancy Backlinks Database (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) accountancy_firms
CREATE TABLE IF NOT EXISTS accountancy_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  company_name text,
  location text,
  sic_code text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS source text DEFAULT 'discovery';
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_accountancy_firms_location ON accountancy_firms (location);
CREATE INDEX IF NOT EXISTS idx_accountancy_firms_sic ON accountancy_firms (sic_code);

-- 2) backlinks (matches product spec table name)
CREATE TABLE IF NOT EXISTS backlinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  target_url text NOT NULL,
  anchor_text text,
  referring_domain text,
  link_type text DEFAULT 'dofollow',
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  crawl_date timestamptz NOT NULL DEFAULT now(),
  accountant_domain text NOT NULL
);

ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound';

CREATE UNIQUE INDEX IF NOT EXISTS uq_backlinks_src_tgt_acct
  ON backlinks (source_url, target_url, accountant_domain);
CREATE INDEX IF NOT EXISTS idx_backlinks_accountant ON backlinks (accountant_domain);
CREATE INDEX IF NOT EXISTS idx_backlinks_referring ON backlinks (referring_domain);
CREATE INDEX IF NOT EXISTS idx_backlinks_link_type ON backlinks (link_type);
CREATE INDEX IF NOT EXISTS idx_backlinks_last_seen ON backlinks (last_seen DESC);

-- 3) referring_domains
CREATE TABLE IF NOT EXISTS referring_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  authority_score integer DEFAULT 0,
  backlink_count integer DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referring_domains_authority ON referring_domains (authority_score DESC);

-- 4) crawl_logs
CREATE TABLE IF NOT EXISTS crawl_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  pages_crawled integer DEFAULT 0,
  errors text,
  crawl_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_domain_date ON crawl_logs (domain, crawl_date DESC);

CREATE OR REPLACE FUNCTION mark_lost_backlinks(p_accountant text, p_before timestamptz)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE backlinks
  SET link_type = 'lost'
  WHERE accountant_domain = p_accountant
    AND last_seen < p_before
    AND link_type <> 'lost';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
