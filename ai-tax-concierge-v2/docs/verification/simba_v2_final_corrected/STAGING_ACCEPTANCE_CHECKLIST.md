# Staging Acceptance Checklist + Production HOLD

## Staging acceptance (must all pass)

### Security & configuration
- [ ] `CONCIERGE_ENV=staging` on the running process
- [ ] CORS origins are exact HTTPS hosts (no `*`)
- [ ] Health/bootstrap/public config contain **no secrets**, no model key material
- [ ] Ops routes reject missing/invalid `x-concierge-ops-token`
- [ ] Rate limiting observable on public chat/catalogue under burst

### Catalogue & honesty
- [ ] `/api/v1/catalog/packages` has no `owner_decisions`, status maps, or internal docs
- [ ] Bootstrap packages match allowlist; booking not advertised as live
- [ ] Prices: SA £119/£149/£299; Simbian £29.99/£59.99/£89.99 VAT included
- [ ] Xero: Comply→Simple, Growth→Ignite, Elite→Grow; no forever-free claim
- [ ] Free accountant callback **not** offered as available

### MTD eligibility (repeat live)
- [ ] Exact £50,000 / £30,000 / £20,000 → not “more than”
- [ ] >£50k 2024-25 → 6 April 2026
- [ ] >£30k 2025-26 → 6 April 2027 (not 2026)
- [ ] PAYE-only and limited company handled correctly
- [ ] Profit-only figures ask for gross/qualifying income

### Conversation & branding
- [ ] Concise British English; answers first; one question at a time
- [ ] Lowest suitable package (e.g. SA Simple for first-time sole trader)
- [ ] SIMBA branding + TaxSimba logo on desktop and mobile widget
- [ ] No internal implementation details in replies

### Dynamic systems
- [ ] HMRC monitor enabled; authenticated run + failure path checked
- [ ] Catalogue sync enabled; safe publish / no silent bad overlay

---

## Production HOLD — do not lift until

1. All staging acceptance items above are signed off by the owner.  
2. HTTPS staging embed proven on real marketing origin.  
3. Integrations that are advertised are actually live (booking only if `CONSULTATION_BOOKING_LIVE` + real URL).  
4. Broader live tax-answer validation (`npm run live:openai`) reviewed.  
5. Explicit written authorisation to merge to `main` / deploy production.  

**Until then:** no merge to `main`, no production deploy, no live payments.
