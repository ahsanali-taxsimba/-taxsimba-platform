# TaxSimba — Toxel Start Here

Use these folders only:

**Backend:**  
`backend-node/`

**Client frontend:**  
`tax_simba_frontend/`

**Admin / Accountant / Super Admin frontend:**  
`tax_simba_admin_frontend/`

**DO NOT use:**  
`frontend/`

---

## Main detailed instructions

See **`TOXEL_HANDOVER.md`**.

---

## Important

- This branch (`taxsimba-p0-integration`) is for **staging / UAT first**.
- Do **not** change application code before first running the supplied version exactly as documented.
- If anything fails, provide the **exact error**, **logs**, **URL**, **API request**, and **reproduction steps** before proposing changes.

---

## Frontend API base

```text
NEXT_PUBLIC_API_URL=https://<STAGING-API-HOST>/api/compat/
```

Trailing slash **required**.

---

## Stripe webhook

```text
POST /api/stripe/webhook
```
