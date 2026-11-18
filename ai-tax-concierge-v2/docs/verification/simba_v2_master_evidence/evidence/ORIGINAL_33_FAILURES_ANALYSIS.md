# Original 33 scenario failures — analysis & retest

**Baseline:** commit `84da383` — master suite **504/537** (33 FAIL, 0 critical).
**After fixes:** commit (this evidence pack) — master suite **537/537** PASS; multiturn **50/50**.
**Obtained via:** mock LLM + deterministic handlers (`suite:master`). Live OpenAI journeys are separate.

## Classification summary

| Theme | Count | Classification | Code correction | Retest |
|-------|------:|----------------|-----------------|--------|
| `retrieval_misroute_paye_to_crypto` | 6 | genuine behavioural defect | PAYE filing fast-path + retrieval scoring (stop crypto corpus win) | **6/6 PASS** |
| `retrieval_misroute_landlord` | 8 | genuine behavioural defect | Rent-a-room / landlord handlers + corpus boosts | **8/8 PASS** |
| `mtd_eligibility_overmatch_ops` | 7 | genuine behavioural defect | `mtd_operations` short-circuit; exclude Xero/software from eligibility matcher | **7/7 PASS** |
| `cis_mtd_eligibility_overmatch_or_retrieval` | 7 | genuine behavioural defect | CIS path requires figures for eligibility; CIS knowledge content | **7/7 PASS** |
| `crypto_sa_misroute` | 5 | genuine behavioural defect | Crypto SA handler (not paper-deadline-only answer) | **5/5 PASS** |

All 33 were **genuine behavioural defects** (wrong retrieval topic or MTD eligibility over-match), not softened expects. Expectations were kept; handlers/retrieval were corrected.

## Per-scenario detail

### MS-0024 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 2)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0029 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 7)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0034 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 12)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0039 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 17)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0044 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 22)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0054 — paye_employment

- **Customer question:** My employer deducts tax. Do I still need to file? (variant 32)
- **Expected (suite):** `expect_any`=['self assessment', 'paye', 'return']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:self assessment
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_paye_to_crypto
- **Code correction:** PAYE filing handler + retrieval boosts; prevent crypto corpus win
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [cryptoassets-tax] Cryptoassets and tax overview (2024-25, 2025-26, 2026-27): HMRC treats cryptoassets as potentially taxable. Depending on your activity you may need to consider Capital Gains Tax and/or Income Tax. Keep detailed records of transactions. Check GOV.UK cryptoassets tax guidance for how your situation may be treated. (source: https://www.gov.uk/guidance/tax-on-cryptoassets)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
If your employer deducts tax under PAYE, you may still need to send a Self Assessment tax return — for example if you have untaxed income, self-employment, property income, or other reasons listed on GOV.UK. PAYE alone does not automatically remove a filing duty. Check https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return — or tell me what other income you have and I can help narrow it down.
```

### MS-0155 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #4
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0160 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #9
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0165 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #14
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0170 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #19
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0175 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #24
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0180 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #29
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0185 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #34
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0190 — landlords

- **Customer question:** Rent a room scheme and PAYE salary #39
- **Expected (suite):** `expect_any`=['property', 'rental', 'landlord', 'self assessment', 'mtd', 'making tax']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:property
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: retrieval_misroute_landlord, rent_a_room
- **Code correction:** Landlord/rent-a-room handlers + corpus scoring; rent-a-room deterministic explainer
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [rent-a-room] Rent a Room Scheme (2024-25, 2025-26): The Rent a Room Scheme lets you earn a certain amount from letting out furnished accommodation in your home without paying tax on that income, if you meet the conditions. Check the current annual threshold on GOV.UK. (source: https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
The Rent a Room Scheme can let you earn a set amount from letting furnished accommodation in your home without paying tax on that rental income, if you qualify. It still sits in the wider property/rental landscape — you may need Self Assessment depending on your overall income. Confirm the current limit and rules on https://www.gov.uk/rent-room-in-your-home/the-rent-a-room-scheme. Do you also have other rental property or only a lodger in your home?
```

### MS-0236 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (2)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0241 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (7)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0246 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (12)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0251 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (17)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0256 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (22)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0261 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (27)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0266 — mtd_operations

- **Customer question:** Do I need Xero for MTD? (32)
- **Expected (suite):** `expect_any`=['quarter', 'xero', 'year-end', 'self assessment', 'cannot', "can't", 'hmrc', 'simbian']; `reject_any`=['i will submit your return to hmrc now']
- **Failure flag:** EXPECT_MISS:quarter
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: mtd_eligibility_overmatch_ops
- **Code correction:** mtd_operations short-circuit; exclude Xero/software from eligibility matcher
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
For Making Tax Digital for Income Tax, you need compatible software and digital records. TaxSimba’s Simbian plans include a Xero subscription in the monthly price (Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — customers do not pay separately for that mapped licence. Quarterly updates and year-end Self Assessment are included subject to documented customer responsibilities. SIMBA itself does not submit your quarterly updates or returns to HMRC — a TaxSimba accountant leads those workflows using Xero. Prices (VAT included): Simbian Comply £29.99, Growth £59.99, Elite £89.99 per month. Review https://www.taxsimba.co.uk/making-tax-digital — or tell me your qualifying income and tax year if you’re checking eligibility.
```

### MS-0303 — cis

- **Customer question:** Construction sole trader needing MTD? 2
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0306 — cis

- **Customer question:** Construction sole trader needing MTD? 5
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0309 — cis

- **Customer question:** Construction sole trader needing MTD? 8
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0312 — cis

- **Customer question:** Construction sole trader needing MTD? 11
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0315 — cis

- **Customer question:** Construction sole trader needing MTD? 14
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0318 — cis

- **Customer question:** Construction sole trader needing MTD? 17
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0321 — cis

- **Customer question:** Construction sole trader needing MTD? 20
- **Expected (suite):** `expect_any`=['cis', 'self assessment', 'subcontract', 'construction', '119', 'smart']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:cis
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: cis_mtd_eligibility_overmatch_or_retrieval
- **Code correction:** CIS figures required for eligibility; CIS knowledge path
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
I can work out your Making Tax Digital start date once I know your qualifying income. That’s total self-employment and property income before expenses for a specific tax year — not profit, and not PAYE salary.

What was that amount, and which tax year was it for (for example 2024-25)?
```

**Actual SIMBA response AFTER (verbatim):**

```
CIS subcontractors / construction sole traders often need Self Assessment, and may also need Making Tax Digital if qualifying income (turnover before expenses) is more than the relevant threshold for the tax year. TaxSimba’s lowest suitable Self Assessment starting point is usually Simple (£119) or Smart (£149) depending on complexity — not an MTD subscription unless you’re in scope. What was your sole-trader/CIS turnover before expenses, and for which tax year? Packages: https://www.taxsimba.co.uk/self-assessment
```

### MS-0327 — vat_expenses_cgt_crypto

- **Customer question:** Crypto gains Self Assessment [5]
- **Expected (suite):** `expect_any`=['vat', '90', 'expense', 'capital', 'crypto', 'dividend', 'allowance', 'gain']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:vat
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: crypto_sa_misroute
- **Code correction:** crypto SA handler; do not answer with paper-deadline only
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [sa-paper-deadline] Self Assessment paper filing deadline (2024-25, 2025-26, 2026-27): If you file a paper Self Assessment return, the usual deadline is 31 October following the end of the tax year. Online filing is normally due by 31 January. Confirm current deadlines on GOV.UK. (source: https://www.gov.uk/self-assessment-tax-returns/deadlines)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?
```

### MS-0335 — vat_expenses_cgt_crypto

- **Customer question:** Crypto gains Self Assessment [13]
- **Expected (suite):** `expect_any`=['vat', '90', 'expense', 'capital', 'crypto', 'dividend', 'allowance', 'gain']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:vat
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: crypto_sa_misroute
- **Code correction:** crypto SA handler; do not answer with paper-deadline only
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [sa-paper-deadline] Self Assessment paper filing deadline (2024-25, 2025-26, 2026-27): If you file a paper Self Assessment return, the usual deadline is 31 October following the end of the tax year. Online filing is normally due by 31 January. Confirm current deadlines on GOV.UK. (source: https://www.gov.uk/self-assessment-tax-returns/deadlines)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?
```

### MS-0343 — vat_expenses_cgt_crypto

- **Customer question:** Crypto gains Self Assessment [21]
- **Expected (suite):** `expect_any`=['vat', '90', 'expense', 'capital', 'crypto', 'dividend', 'allowance', 'gain']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:vat
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: crypto_sa_misroute
- **Code correction:** crypto SA handler; do not answer with paper-deadline only
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [sa-paper-deadline] Self Assessment paper filing deadline (2024-25, 2025-26, 2026-27): If you file a paper Self Assessment return, the usual deadline is 31 October following the end of the tax year. Online filing is normally due by 31 January. Confirm current deadlines on GOV.UK. (source: https://www.gov.uk/self-assessment-tax-returns/deadlines)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?
```

### MS-0351 — vat_expenses_cgt_crypto

- **Customer question:** Crypto gains Self Assessment [29]
- **Expected (suite):** `expect_any`=['vat', '90', 'expense', 'capital', 'crypto', 'dividend', 'allowance', 'gain']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:vat
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: crypto_sa_misroute
- **Code correction:** crypto SA handler; do not answer with paper-deadline only
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [sa-paper-deadline] Self Assessment paper filing deadline (2024-25, 2025-26, 2026-27): If you file a paper Self Assessment return, the usual deadline is 31 October following the end of the tax year. Online filing is normally due by 31 January. Confirm current deadlines on GOV.UK. (source: https://www.gov.uk/self-assessment-tax-returns/deadlines)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?
```

### MS-0359 — vat_expenses_cgt_crypto

- **Customer question:** Crypto gains Self Assessment [37]
- **Expected (suite):** `expect_any`=['vat', '90', 'expense', 'capital', 'crypto', 'dividend', 'allowance', 'gain']; `reject_any`=[]
- **Failure flag:** EXPECT_MISS:vat
- **Severity:** Medium — Customer could receive off-topic or eligibility-overmatched guidance under the failing path
- **Classification:** genuine_behavioural_defect — themes: crypto_sa_misroute
- **Code correction:** crypto SA handler; do not answer with paper-deadline only
- **Retest:** **PASS**

**Actual SIMBA response BEFORE (verbatim):**

```
Based on verified HMRC / GOV.UK guidance: [sa-paper-deadline] Self Assessment paper filing deadline (2024-25, 2025-26, 2026-27): If you file a paper Self Assessment return, the usual deadline is 31 October following the end of the tax year. Online filing is normally due by 31 January. Confirm current deadlines on GOV.UK. (source: https://www.gov.uk/self-assessment-tax-returns/deadlines)

This is general information, not personal tax advice. If your situation is complex, TaxSimba offers Quick Tax Advice (£99 for 20 minutes) or an Extended Tax Consultation (£149 for 40 minutes), or email info@taxsimba.co.uk.
```

**Actual SIMBA response AFTER (verbatim):**

```
Cryptoassets can create Self Assessment reporting needs. HMRC may treat disposals under Capital Gains Tax, and frequent trading can be Income Tax instead — it depends on your activity. Keep detailed records. I won’t invent your tax figure. Official guidance: https://www.gov.uk/guidance/tax-on-cryptoassets — were your crypto disposals investment-style gains, or more like a trading business?
```
