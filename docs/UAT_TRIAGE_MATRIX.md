# Toxel UAT evidence-to-code triage (release candidate)

**Baseline tip before this RC:** `47ac3ec96b4452b0b0ce50f53a773bc03afae270`  
**Content SHA (functional prior):** `fe16d36a2fa9a13f7c680897174d72e40123f157`  
**Older evidence SHA (invalid for acceptance):** `db323e23a71e163f5c1908c21c55d637afded2f9`  
**Branch:** `toxel-uat-approved` (via `cursor/uat-release-candidate-80a7`)

Classifications used: confirmed current defect | already corrected or obsolete evidence | blocked by another defect | incomplete test execution | incorrect role or journey | outside agreed release | requires product decision

| Test ID | Journey | Role | Route/service | Evidence SHA | Reproduced on tip | Classification | Root cause | Correction | Regression risk |
|---------|---------|------|---------------|--------------|-------------------|----------------|------------|------------|-----------------|
| INV01 / accountant invite 404 | Staff invite password setup | SUPER_ADMIN → ACCOUNTANT | `POST /api/staff-invites`, Admin `/admin/invite/{token}` | unknown / local | Yes | confirmed current defect | Links used `{origin}/invite/{token}` without Admin `basePath`; no Admin invite page | `staffInviteLinks.ts` + Admin invite page + `ADMIN_BASE_URL` | Low — invite path only |
| R01 File is required | MTD draft multipart upload | ACCOUNTANT | UploadDraftModal → compat draft upload | old / db323e2 | No on tip | already corrected or obsolete evidence | Prior FormData JSON Content-Type stringify | Already fixed `16cf050` | Medium if multipart headers regress |
| DRAFT / Advance to Draft Ready | Admin progress bar | ADMIN | `POST .../progress` `draft_ready` | unknown | Yes (soft-map → ADMIN_APPROVED) | confirmed current defect | `toxelToPreferredNodeStatus` soft-mapped draft_ready onto ADMIN_APPROVED, bypassing approve action | Map draft_ready safely; reject during Admin review | Medium — workflow |
| Client pre-approval draft visibility | Draft gate | CLIENT | documents list/preview | tip | No (already gated) | already corrected or obsolete evidence | Fixed `3b38339` | Retain | High if is_internal cleared early |
| ASSIGN / SUPER_ADMIN assign | Assignment | SUPER_ADMIN | assign APIs | tip | No (403) | already corrected or obsolete evidence | Fixed ADMIN-only assign | Retain | High |
| DEACT / active cases | Deactivate accountant | SUPER_ADMIN | deactivate/delete | tip | No (409) | already corrected or obsolete evidence | Fixed `d094342` | Retain | Medium |
| SA tax-type empty | SA Start Now catalogue | CLIENT | tax-return-type | tip | No | already corrected or obsolete evidence | Fixed `fe16d36` Bearer + catalogue fallback | Retain | Medium |
| B01 both services at registration | Dual service | CLIENT | registration | N/A | No | incorrect role or journey | Product is purchase-after-verify, not dual select at register | Document correct journey; no new UI | Low |
| PKG £150/£255 | Pricing | CLIENT/ADMIN | package catalogue | old | No | already corrected or obsolete evidence | Canonical: SIMPLE £119, SMART £149, ELITE £299; MTD 29.99/59.99/89.99 | No invent | High if prices edited ad-hoc |
| PAG01 repeated clients | Admin client list pages | ADMIN | `POST /admin/clients` | tip | Yes | confirmed current defect | Backend ignored page/limit; FE re-fetched full list each page | Server pagination + stable sort | Low |
| MOB01 sidebar stays open | Mobile nav | ADMIN/ACCOUNTANT | SidebarContext | tip | Yes | confirmed current defect | No close-on-route-change | Close mobile drawer on pathname change | Low |
| MOB02 Tax List overflow | Accountant sidebar | ACCOUNTANT | AppSidebar | tip | Likely | confirmed current defect | Long label / padding without truncate | CSS truncate + min-w-0 | Low |
| EMAIL redesign / welcome seq | Marketing emails | — | — | N/A | N/A | outside agreed release | Later programme | Not in this RC | — |
| AGR01 agreement | Consent | CLIENT | — | unknown | N/A | outside agreed release / Not Applicable | No unapproved agreement module added | Classify NA unless product confirms | — |
| COM01 complaints module | Complaints | CLIENT | — | unknown | N/A | outside agreed release / incomplete | Vague failure; no unapproved module | Message/service-issue paths retained | — |
| EMAIL-CHANGE token to new address | Profile email | CLIENT/STAFF | profile | tip | Partial | requires product decision | Current staff PENDING flow ≠ token-to-new-email | Do not invent unsafe immediate replace | Medium |
| G05/G06 prod gates | Ops | — | — | N/A | N/A | outside agreed release | Future production gates | Do not mark passed | — |
| A11Y login-only video | Accessibility | — | login | incomplete | N/A | incomplete test execution | Login-only clip ≠ full failure | Keyboard paths exist; scanner optional on staging | Low |
| FILING HMRC API wording | External filing | ACCOUNTANT/ADMIN | submission record | tip | No (accountant-led) | already corrected or obsolete evidence | Wording already external/Xero | Retain | Medium |

## Canonical package catalogue (repository)

| Code | Service | Name | Price | Billing |
|------|---------|------|------:|---------|
| SIMPLE | SELF_ASSESSMENT | Tax Simba Simple | 119.00 | ONE_OFF / Per tax year |
| SMART | SELF_ASSESSMENT | Tax Simba Smart | 149.00 | ONE_OFF / Per tax year |
| ELITE | SELF_ASSESSMENT | Tax Simba Elite | 299.00 | ONE_OFF / Per tax year |
| MTD_COMPLY | MTD | Simbian Comply | 29.99 | RECURRING / Monthly |
| MTD_GROWTH | MTD | Simbian Growth | 59.99 | RECURRING / Monthly |
| MTD_ELITE | MTD | Simbian Elite | 89.99 | RECURRING / Monthly |

## Runtime URL configuration (non-secret names)

- `APP_BASE_URL` — client portal origin for client emails/CTAs
- `ADMIN_BASE_URL` — admin portal origin (no `/admin` path); staff invites → `{ADMIN_BASE_URL}/admin/invite/{token}`
- `NEXT_PUBLIC_API_URL` — frontend API base (typically `/api/compat/` on Admin/Client)
- `GIT_SHA` / `NEXT_PUBLIC_GIT_SHA` — build-info parity
- `PAYMENT_PROVIDER` — stripe (staging/prod); `fake` only when `APP_BASE_URL` is localhost
- `EMAIL_DRIVER` — smtp/resend/none

## Localhost / hardcoded origin classification

| Occurrence | Classification |
|------------|----------------|
| `payments.ts` fake provider localhost guard | development-only / safety |
| `email.ts` comments about never localhost logos | documentation |
| `stagingUatSeed.ts` BASE_URL default localhost:8002 | development-only script |
| Admin FE axiosInstance fallback `localhost:3000/api` | development-only fallback |
| Legacy `frontend/` AcceptInvite `/invite/` | legacy app not deployed |
