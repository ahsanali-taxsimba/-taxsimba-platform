# TOXEL HANDOVER — Ready for Toxel Staging

**Verdict:** A. READY FOR TOXEL STAGING  
**Branch:** `taxsimba-p0-integration` (base: `node-only-production`)  
**Handover tip:** `b572172893e104490796479cc3c74cb33ff561be`  
**K.9 baseline:** `38549faa0d2b71da3fc8c98fd240222c279971b1`  
**K.8 checkpoint:** `9d5251d`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/2  

**This is not a production-ready declaration.** Staging handover only. Do not merge protected branches from this gate.

---

## Architecture (binding)

TaxSimba is an **accountant-led** platform.

### HMRC APIs — OUT OF SCOPE / NOT REQUIRED BY ARCHITECTURE

- Do **not** build HMRC APIs, HMRC OAuth, HMRC submission endpoints, or require HMRC credentials.
- Absence of HMRC integration is **not** deferred work, technical debt, failure, or a staging/production blocker.
- **Self Assessment** filings are completed externally by accountants using third-party filing software.
- **MTD** filings are completed externally by accountants using Xero / external filing software.
- TaxSimba records **workflow status + submission date/reference** only (`record-submission` / external submission panel).

---

## Protected tips (must remain unchanged)

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
├── tax_simba_admin_frontend/     # Toxel admin / accountant / SUPER_ADMIN Next.js app
├── frontend/                     # Legacy CRA (Node-native UI; not Toxel launch FE)
├── memory/                       # P0 contracts + audit notes
└── TOXEL_HANDOVER.md             # This document
```

---

## Frontend applications

| App | Path | Roles |
|---|---|---|
| Client | `tax_simba_frontend/` | CLIENT |
| Admin | `tax_simba_admin_frontend/` | ADMIN, SUPER_ADMIN, ACCOUNTANT |

### `/api/compat` configuration (required)

Both Next apps must set:

```text
NEXT_PUBLIC_API_URL=https://<staging-api-host>/api/compat/
```

**Trailing slash is required** — FE concatenates paths (`auth/login`, `client/…`).

Admin NextAuth may also use `BACKEND_URL` pointing at the same compat base for login.

CORS: list exact client + admin origins in backend `CORS_ORIGINS` (no `*`).

---

## Node backend

- Native API: `/api/*` (domain SoT — do not rewrite)
- Toxel adapters: `/api/compat/*` (thin path/envelope/ID maps → existing domain)
- Stripe webhook: `POST /api/stripe/webhook` (native, not under compat)

---

## Environment variables (staging)

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

### Frontends

| Var | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api-host>/api/compat/` |
| NextAuth secrets / `NEXTAUTH_URL` | per each app |

---

## Database / migrations

- MongoDB 6/7 dedicated **staging** DB (never production dump for first stand-up).
- Indexes created at boot — no separate migration runner.
- Packages / services come from domain seed/boot as configured.

---

## Stripe requirements

- Checkout Session only (service activation, SA upgrade, additional work).
- Webhook: `POST https://<api-host>/api/stripe/webhook` — at least `checkout.session.completed`.
- Activation only via verified `fulfil` → `activateService`.
- AW fulfil **never** activates SA/MTD or creates a service case.
- VERIFY-BEFORE-PURCHASE on all paid checkouts (server-enforced).
- Unpaid/failed/incomplete never activates entitlement.
- Replay/idempotent fulfil guarded by `fulfilled` / duplicate flags.

---

## Storage requirements

- `STORAGE_DRIVER=s3` (private staging bucket) **or** `local` + persistent `LOCAL_STORAGE_DIR`.
- Downloads use authenticated `GET …/client/documents/:id/download` (Bearer).
- Ownership/assignment enforced via `getCase` before stream.

---

## Build / run

```bash
# Backend
cd backend-node && npm ci && npm run build && npm start

# Client FE
cd tax_simba_frontend && npm ci && npm run build && npm start

# Admin FE
cd tax_simba_admin_frontend && npm ci && npm run build && npm start
```

## Test commands (evidence)

```bash
cd backend-node
npm run typecheck   # PASS
npm test            # PASS — 28 files / 291 tests
```

| Metric | Result |
|---|---|
| Typecheck | **PASS** |
| Test files | **28** |
| Tests | **291** |
| Failures | **0** |
| Handover suite | `tests/integration/handoverAudit.test.ts` (9) |

---

## Role / test-user matrix

| Capability | CLIENT | ACCOUNTANT | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Register / login / verify | ✓ | staff login | ✓ | ✓ |
| Purchase SA/MTD (Checkout) | ✓ verified email | — | — | — |
| Own cases / docs / messages | ✓ | assigned only | all operational | all |
| Progress status (whitelist) | — | assigned cases | ✓ | ✓ |
| Record external submission | — | — | ✓ | ✓ |
| Create AW request | — | — | ✓ | ✓ |
| Pay AW | ✓ | — | — | — |
| Contact reveal (audited) | — | ✗ | ✗ | ✓ |
| Invite accountants | — | — | limited | ✓ |
| S6 CMS / fee CMS | — | — | HIDE | HIDE |

---

## Intentionally unsupported (SAFE — UI hidden or 405)

| Item | Status |
|---|---|
| **HMRC APIs** | **OUT OF SCOPE / NOT REQUIRED** |
| OTP / Google login | UI gated |
| Card Elements / portal / cancel | HIDE + Checkout-only |
| S6 CMS (partners, tax-rates, api-keys, templates, admin global-fee) | nav `p0Hide` / 405 |
| Payment export / stats / by-user | deferred; Export button hidden |
| Notification DELETE | 405; trash control hidden |
| start-next-quarter | periods on activation; Start Now hidden |
| Star-review CMS (`/reviews`) | nav `p0Hide` |
| Audit log FE | nav `p0Hide` |
| Case-detail flags / star-review tabs | removed from tabs |
| Overview yearly-metrics charts | removed; stats cards remain |
| Staff photo / UTR edit | non-critical |
| Non-AW VAT PDF invoice | AW HTML receipt only |
| Marketing CMS depth | not launch-critical for paid journey |

---

## Staging smoke-test checklist

1. Register CLIENT → SA+MTD NOT_ACTIVE.  
2. Login unverified → dashboard OK; paid checkout blocked.  
3. Verify email → planlist → SA Checkout → webhook/fulfil → ACTIVE + one case.  
4. Engagement letter → dashboard.  
5. Apply / tax-return-form loads types + fee hint; apply prefers existing case.  
6. Client upload docs; accountant request docs; messages both ways.  
7. Admin/accountant open case detail — taxReturn + files + progress steps load.  
8. Advance status via progress control (whitelist only).  
9. Admin create AW → client pays AW → entitlements unchanged.  
10. SA upgrade when already ACTIVE.  
11. SUPER_ADMIN Reveal contact (audited); ADMIN cannot.  
12. When case `READY_FOR_SUBMISSION` → Record external submission (date + reference).  
13. No Start Next Quarter Start Now; no Elements PaymentModal; no payment Export; no notif trash.  
14. Document download with Bearer succeeds for owner/assignee only.

---

## Rollback

| Checkpoint | SHA |
|---|---|
| K.8 | `9d5251d` |
| K.9 | `38549fa` |
| Prior handover closes | `3f55537` / `e8b5239` |
| This audit tip | `b572172893e104490796479cc3c74cb33ff561be` |

Revert feature commits on `taxsimba-p0-integration` only. **Do not** rewrite protected tips.

---

## Explicit non-goals

- Do not start staging/production from this agent.  
- Do not merge without owner acceptance.  
- Do not start K.10.  
- Do not invent parallel payment/entitlement/CMS systems.  
- Do not implement HMRC.
