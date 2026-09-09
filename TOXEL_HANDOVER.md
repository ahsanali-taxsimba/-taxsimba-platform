# TOXEL HANDOVER — Ready for Toxel Staging

**Verdict:** A. READY FOR TOXEL STAGING  
**Handover tip:** `3f55537aeced5f2a7efb8fda1467ca62b89d880c`  
**K.9 tip audited:** `38549faa0d2b71da3fc8c98fd240222c279971b1`  
**K.8 checkpoint:** `9d5251d`  
**Branch:** `taxsimba-p0-integration` → base `node-only-production`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/2  

**This is not a production-ready declaration.** Staging handover only.

---

## Protected tips (unchanged)

| Branch | SHA |
|---|---|
| `main` | `b37f6b60f8b80ef7631773ae853b620f33b24c8f` |
| `node-only-production` | `12ec7915b537b7086d24cfe22062f82bedcc40ff` |
| `toxel-frontend-reference` | `e13d6e973424e8e74f65ce07b156d2217f621b61` |

---

## Repository structure

```
/
├── backend-node/                 # Node SoT API + /api/compat adapters
├── tax_simba_frontend/           # Toxel client Next.js app
├── tax_simba_admin_frontend/     # Toxel admin/staff Next.js app
├── frontend/                     # Legacy CRA (Node-native UI; not Toxel launch FE)
├── memory/                       # P0 contracts, K.x notes, this handover
└── README.md / render.yaml
```

---

## Frontend applications

| App | Path | Role |
|---|---|---|
| Client | `tax_simba_frontend/` | CLIENT journeys (auth, planlist Checkout, dashboard, MTD, AW pay) |
| Admin | `tax_simba_admin_frontend/` | ADMIN / SUPER_ADMIN / ACCOUNTANT staff UI |

Both must set `NEXT_PUBLIC_API_URL` to the **compat base with trailing slash**, e.g.:

```text
https://<staging-api-host>/api/compat/
```

Admin also uses the same base via `src/lib/axios-client.ts` (`baseURL: process.env.NEXT_PUBLIC_API_URL`).

---

## Node backend

- Process: `backend-node/` Express app
- Native API: `/api/*` (unchanged domain)
- Toxel adapters: `/api/compat/*` (thin path/envelope maps → existing domain)
- Stripe webhook (native): `POST /api/stripe/webhook` (not under `/api/compat`)

### `/api/compat` configuration

1. Deploy Node so `/api/compat` is publicly reachable from both Next apps.
2. Set FE `NEXT_PUBLIC_API_URL=https://<host>/api/compat/` (**trailing slash required** — FE concatenates paths like `auth/login`).
3. CORS: include exact client + admin staging origins in `CORS_ORIGINS` (no `*`).
4. Auth: Bearer JWT from compat login / NextAuth `accessToken`.

---

## Environment variables required (staging)

### Backend (`backend-node/.env.example`)

`PORT`, `MONGO_URL`, `DB_NAME`,  
`JWT_SECRET`, `COOKIE_SECURE`, `COOKIE_SAMESITE`,  
`TOTP_FERNET_KEY`, `TOTP_ISSUER`,  
`CORS_ORIGINS`, `CORS_DEV_ORIGINS`, `TRUSTED_PROXY_CIDRS`,  
`STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `LOCAL_STORAGE_DIR`,  
`STRIPE_SECRET_KEY` (**test** `sk_test_…`), `STRIPE_WEBHOOK_SECRET` (**test** `whsec_…`),  
`API_RATE_LIMIT_PER_MINUTE`, `MAX_UPLOAD_MB`, `APP_BASE_URL`,  
`EMAIL_DRIVER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MAX_ATTEMPTS`,  
`SMTP_*` or `RESEND_API_KEY`,  
`REMINDERS_ENABLED`, `REMINDER_*`, `SEED_DEMO_DATA=false`

### Client / Admin FE

| Var | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api-host>/api/compat/` |
| NextAuth secrets / URLs | per each app’s existing auth config |

---

## Database / migrations

- MongoDB 6/7 dedicated **staging** database.
- Indexes created at boot (`ensureCoreIndexes`); no separate migration runner.
- Packages / services seeded via domain seed / boot as configured — do **not** restore production dumps for first staging.

---

## Stripe / webhook

- **Checkout Session only** for P0 (service, upgrade, additional work).
- Webhook: `POST https://<api-host>/api/stripe/webhook`
- Events: at least `checkout.session.completed` (and `checkout.session.expired` optional).
- Activation only via verified `fulfil` → `activateService` (AW fulfil never activates SA/MTD).
- VERIFY-BEFORE-PURCHASE enforced server-side on all paid checkouts.

---

## Storage

- `STORAGE_DRIVER=s3` with a private staging bucket, **or** `local` + persistent `LOCAL_STORAGE_DIR`.
- Document download for Toxel uses authenticated `GET …/client/documents/:id/download` (Bearer).

---

## Build / run commands

```bash
# Backend
cd backend-node
npm ci
npm run build
npm start          # or: npm run dev

# Client FE
cd tax_simba_frontend
npm ci
npm run build && npm start   # or next dev

# Admin FE
cd tax_simba_admin_frontend
npm ci
npm run build && npm start
```

---

## Test commands (evidence)

```bash
cd backend-node
npm run typecheck   # PASS
npm test            # PASS — 28 files / 288 tests
```

| Metric | Result |
|---|---|
| Typecheck | **PASS** |
| Test files | **28** |
| Tests | **288** |
| Failures | **0** |
| New handover suite | `tests/integration/handoverAudit.test.ts` (6) |

---

## Role matrix

| Capability | CLIENT | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Register / login / verify | ✓ | staff login | ✓ | ✓ |
| Purchase SA/MTD (Checkout) | ✓ (verified email) | — | — | — |
| Own cases / docs / messages | ✓ | assigned only | all operational | all |
| Create AW payment request | — | — | ✓ | ✓ |
| Pay AW | ✓ | — | — | — |
| Contact reveal (full email/phone) | — | ✗ masked | ✗ masked | ✓ |
| S6 CMS / fee CMS | — | — | HIDE 405 | HIDE 405 |
| Invite accountants | — | — | limited | ✓ |

---

## Audit summary (journey-outward)

### Launch-critical fixes applied in this handover commit

| Issue | Fix |
|---|---|
| Admin case detail `POST /admin/tax-return/:id/files` missing | Compat staff detail payload `{ taxReturn, files }` |
| AW panel dropped `case_id` query (`clientAxios.get` arity) | `get(url, true, { params })` |
| `GET client/global-fee` missing | Compat from packages catalogue (display only) |
| `POST client/tax-return-type` missing | Compat from packages (SA/MTD options) |
| Elements PaymentModal still wired in TaxTracker | Removed; Elements paths HIDE 405 |
| Start Next Quarter “Start Now” dead/broken | UI replaced with Auto-scheduled (T3 HIDE) |
| Client draft review paths missing | Compat `client/drafts` GET + approve + feedback |
| Auth’d document downloads via bare `<a href>` | FE fetch with Bearer |

### Payments / entitlements (proven by existing K.2/K.3/K.8/K.9 + handover)

- New service purchase → fulfil → single activation case (no duplicate entitlement).
- Additional work pay → fulfil AW only; **no** SA/MTD activate / no new service case.
- Package upgrade → upgrade-checkout spine.
- Unverified checkout → blocked.
- Replayed success → fulfil idempotent (`fulfilled` / duplicate guards).

---

## Known safe deferred items (do **not** block Toxel staging)

| Item | Why safe |
|---|---|
| OTP / Google login | UI gated / HIDE; password path works |
| Card Elements / portal / cancel | Checkout-only; Elements 405 + UI removed from tracker |
| S6 CMS (partners, tax-rates, api-keys, templates, admin global-fee) | Nav `p0Hide`; endpoints 405 |
| Payment analytics / stats / export / by-user | 405; list + AW operational without them |
| start-next-quarter | Periods on activation; Start Now hidden |
| HMRC submission | Explicitly out of P0 |
| Staff photo / UTR edit | Profile non-critical |
| Non-AW VAT PDF invoice | AW HTML receipt only in P0 |
| Marketing CMS (faqs/services/resources/reviews public) | Not on paid journey critical path |
| Admin create-client via accountant endpoints | Staff invite/assign paths cover ops |
| Yearly metrics / status-distribution | Dashboard extras; 405/HIDE |

Any **reachable launch-critical** control that was BROKEN has been closed or UI-hidden. Remaining deferred items are intentionally HIDE or non-critical.

---

## Staging smoke-test checklist

1. Register CLIENT → account only; SA+MTD NOT_ACTIVE.  
2. Login unverified → dashboard allowed; checkout blocked until verify.  
3. Verify email → planlist → SA Checkout → webhook/fulfil → ACTIVE + case.  
4. Accept engagement letter → dashboard/case visible.  
5. Apply / tax-return-form loads types + fee hint; apply prefers existing case.  
6. Client upload docs; accountant request docs; messages both ways.  
7. Admin/accountant open case detail (`manage-tax/[id]`) — loads taxReturn + files.  
8. Admin create AW → client billing pay AW → paid; entitlements unchanged.  
9. SA upgrade path from planlist when already ACTIVE.  
10. SUPER_ADMIN reveal contact; ADMIN sees masked.  
11. Confirm Start Next Quarter has no Start Now action.  
12. Confirm no Elements payment modal on tax tracker.  
13. Draft review: GET drafts + approve (when case/period in approval state).  
14. Rollback tip known: K.8 `9d5251d` / K.9 `38549fa` if needed before this handover commit.

---

## Rollback / checkpoint information

| Checkpoint | SHA | Notes |
|---|---|---|
| K.8 | `9d5251d` | AW FE + shared domain |
| K.9 | `38549fa` | E2E gate + CRITICAL aliases |
| This handover | `3f55537` | Launch-critical closes + `TOXEL_HANDOVER.md` |

Rollback: revert to `38549fa` (pre-handover fixes) or `9d5251d` (pre-K.9). Do **not** rewrite protected tips.

---

## Explicit non-goals (still binding)

- Do not start production cutover from this gate.  
- Do not implement HMRC / S6 invent-backends to greenwash.  
- Do not merge this PR until Toxel accepts staging handover.  
- Do not start K.10 until staging acceptance.
