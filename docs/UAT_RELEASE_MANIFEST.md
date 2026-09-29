# UAT release candidate manifest

## Identity

| Field | Value |
| --- | --- |
| Branch (working) | `cursor/uat-release-candidate-80a7` |
| Target merge branch | `toxel-uat-approved` |
| Previous tip SHA | `47ac3ec96b4452b0b0ce50f53a773bc03afae270` |
| Prior content SHA | `fe16d36a2fa9a13f7c680897174d72e40123f157` |
| New tip SHA | *(filled after commit — see `git rev-parse HEAD`)* |
| Content SHA | same as new tip for this RC |

## Changed files by defect

### Accountant invite 404

- `backend-node/src/services/staffInviteLinks.ts` (new)
- `backend-node/src/routes/admin.ts`
- `backend-node/src/compat/admin.ts` (invite link usage)
- `backend-node/.env.example` (`ADMIN_BASE_URL`)
- `backend-node/src/app.ts` (build-info `adminBaseUrl`)
- `tax_simba_admin_frontend/src/app/invite/[token]/page.tsx` (new)
- `tax_simba_admin_frontend/src/middleware.ts`
- `tax_simba_admin_frontend/src/app/(admin)/(others-pages)/manage-accountant/_sections/FormAddEdit.tsx`
- `backend-node/tests/unit/staffInviteLinks.test.ts` (new)
- `backend-node/tests/integration/admin.test.ts`
- `backend-node/tests/integration/email.test.ts`

### Draft Ready Admin bypass

- `backend-node/src/compat/cases.ts`
- `backend-node/tests/integration/draftReadyAdminGate.test.ts` (new)

### Admin directory pagination

- `backend-node/src/compat/admin.ts`
- `backend-node/tests/integration/adminDirectoryPagination.test.ts` (new)

### Mobile sidebar / Tax List viewport

- `tax_simba_admin_frontend/src/context/SidebarContext.tsx`
- `tax_simba_admin_frontend/src/layout/AppSidebar.tsx`
- `tax_simba_admin_frontend/src/app/main.css`

### Release documentation

- `START_HERE_TOXEL.md`
- `docs/UAT_TRIAGE_MATRIX.md`
- `docs/UAT_RELEASE_MANIFEST.md`

## Migrations

None. No schema changes in this RC. Rollback = redeploy previous tip only.

## Configuration changes (names only)

| Name | Change |
| --- | --- |
| `ADMIN_BASE_URL` | **Required** on staging/production for staff invite emails (admin origin, no path) |
| `GIT_SHA` | Backend build-info |
| `NEXT_PUBLIC_GIT_SHA` | Client + Admin build-info |

No secret values changed in git.

## Items explicitly not changed

- SEO / PPC surfaces
- Email redesign / welcome sequence / logo redesign / Direct Debit reminders
- Agreement module (AGR01 Not Applicable)
- Complaints module (unapproved)
- Package price amounts (remain founder-approved catalogue)
- HMRC API filing (out of scope)
- Unsafe immediate email-address replacement

## Known limitations

- Staging/production pass requires deploying this tip and Toxel evidenced retest
- G05/G06 remain future production gates
- Email-change token-to-new-address is a product decision (not invented here)
- Accountant Manage UI still loads unpaged list when page/limit omitted (by design for legacy FE)
- Legacy `frontend/` not deployed

## Automated verification

*(filled after local commands complete)*
