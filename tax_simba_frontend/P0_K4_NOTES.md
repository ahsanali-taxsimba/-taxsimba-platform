# P0 K.4 — Engagement acceptance notes (client FE)

- Accept API: `POST /api/compat/client/accept-engagement-letter` `{ signature, accepted }`
- Status: `GET /api/compat/client/engagement-letter-status`
- Login / get-account-details expose `isEngagementLetterAccepted` for JWT hydration
- Middleware (G2): after ACTIVE entitlement, require acceptance before dashboard;
  planlist/purchase remains available unverified-of-engagement
- Accept refuses when no ACTIVE service (not before purchase)
