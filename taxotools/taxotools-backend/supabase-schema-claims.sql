-- Multi-machine crawl claims (idempotent)
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS claimed_by text;
ALTER TABLE accountancy_firms ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_accountancy_firms_claim
  ON accountancy_firms (crawl_status, claimed_at NULLS FIRST, last_crawled_at NULLS FIRST);

-- Atomically claim N crawlable firms for one worker.
-- Uses FOR UPDATE SKIP LOCKED so multiple Fly machines never take the same firm.
CREATE OR REPLACE FUNCTION claim_firms_for_crawl(
  p_limit integer DEFAULT 10,
  p_worker text DEFAULT 'worker',
  p_lease_seconds integer DEFAULT 1800
)
RETURNS SETOF accountancy_firms
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT f.id
    FROM accountancy_firms f
    WHERE f.website_verified IS TRUE
      AND f.domain NOT LIKE '%.companieshouse.pending'
      AND (
        f.crawl_status IN ('pending', 'failed')
        OR (
          f.crawl_status = 'running'
          AND (f.claimed_at IS NULL OR f.claimed_at < now() - make_interval(secs => p_lease_seconds))
        )
        OR (
          f.crawl_status = 'completed'
          AND (f.last_crawled_at IS NULL OR f.last_crawled_at < now() - interval '7 days')
        )
      )
    ORDER BY
      CASE WHEN f.crawl_status IN ('pending', 'failed') THEN 0 ELSE 1 END,
      f.last_crawled_at NULLS FIRST,
      f.discovered_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE accountancy_firms f
  SET
    crawl_status = 'running',
    claimed_by = p_worker,
    claimed_at = now(),
    updated_at = now()
  FROM picked
  WHERE f.id = picked.id
  RETURNING f.*;
END;
$$;
