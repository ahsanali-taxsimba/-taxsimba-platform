# P0 K.4 — Engagement acceptance notes (client FE)

- Accept API: `POST /api/compat/client/accept-engagement-letter` `{ signature, accepted }`
- Status: `GET /api/compat/client/engagement-letter-status`
- Login / get-account-details expose `isEngagementLetterAccepted` for JWT hydration
- Middleware (G2): after ACTIVE entitlement, require acceptance before dashboard;
  planlist/purchase remains available without engagement
- Accept refuses when no ACTIVE service (not before purchase)
- **client-care-v1** is account-level: a valid current-version acceptance covers later ACTIVE
  services; `service_types`/`case_ids` are audit-at-accept only
- Version changes (`ENGAGEMENT_AGREEMENT_VERSION` / required version) invalidate prior
  acceptance until re-accept; prior snapshot is archived in `history[]`

