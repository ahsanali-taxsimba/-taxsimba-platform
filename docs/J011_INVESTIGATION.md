# J-011 investigation (full evidence pack)

## Original pack text
> Fail — Error in upgrade payment; NOT VERIFIABLE (no package/SA-upgrade payment-success email).

## Video evidence (`J-011_b138.pdf` sampled frames)
1. Client on **Tax Simba Simple £119** (`/dashboard/my-subscriptions`).
2. Opens upgrade options → selects **Smart £149**.
3. Clicks **Continue to secure checkout**.
4. Toast: **`Package changes are locked at this stage (READY_FOR_SUBMISSION)`**.

## Root cause
Late-stage package-change lock (`DEFAULT_LOCK_STATUSES` includes `READY_FOR_SUBMISSION`). Checkout API correctly rejected the upgrade; earlier tips still showed an active Continue button before lock state loaded / was surfaced.

## Fix / verification
| Item | Result |
|---|---|
| Lock at READY_FOR_SUBMISSION | **Expected product behaviour** (no mid-late-journey package change) |
| Upgrade CTA when locked | Disabled on planlist + my-subscriptions with clear banner |
| No SA-upgrade payment-success email | Already enforced in fulfilment (`payments.ts` comment + path) |
| Successful upgrade (unlocked stage) | LOCAL PASS SIMULATED via Task 5 suite |
| Stripe TEST live upgrade | **BLOCKED** (no `sk_test` in env) |

## Classification
**LOCAL PASS** for lock UX + no-email code path. Do not claim Stripe TEST / staging email verification without those credentials.
