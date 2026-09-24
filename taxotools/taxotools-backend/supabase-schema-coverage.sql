-- Coverage / quality columns for UK-wide crawl
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS company_number text;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS website_verified boolean DEFAULT false;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS crawl_status text DEFAULT 'pending';
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS last_crawled_at timestamptz;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS authority_score integer DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accountancy_firms_company_number
  ON accountancy_firms (company_number)
  WHERE company_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accountancy_firms_crawl_status
  ON accountancy_firms (crawl_status);

CREATE INDEX IF NOT EXISTS idx_accountancy_firms_last_crawled
  ON accountancy_firms (last_crawled_at NULLS FIRST);
