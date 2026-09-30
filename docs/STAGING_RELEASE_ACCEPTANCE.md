# Shared-staging release acceptance (operator)

Run **after** Backend, Client and Admin are deployed from the same tip SHA.

## 1. Confirm SHA parity

```bash
curl -sS "$BACKEND_URL/api/build-info" | jq .
curl -sS "$CLIENT_URL/build-info" | jq .
curl -sS "$ADMIN_URL/admin/build-info" | jq .
```

Abort unless all three `gitSha` values match the release tip.

## 2. Local API acceptance (already green in CI/agent)

```bash
cd backend-node
npm ci
npm test -- tests/integration/releaseAcceptanceApi.test.ts tests/integration/clientContractDto.test.ts
```

## 3. Client static + optional live Playwright

```bash
cd tax_simba_frontend
npm ci
npx playwright install chromium
npm run test:e2e
# Against staging:
E2E_BASE_URL=https://<CLIENT-ORIGIN> npm run test:e2e
```

## 4. Manual / Playwright RA01–RA30

Use unique timestamped emails, Stripe TEST, and a capture mailbox.
Do not repair databases to force a pass.

Required: 30/30 with screenshots/traces before marking  
`STAGING RELEASE ACCEPTANCE PASSED — READY FOR TOXSL`.
