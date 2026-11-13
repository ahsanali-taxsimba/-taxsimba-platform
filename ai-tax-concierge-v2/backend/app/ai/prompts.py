"""System prompts for the Tax Concierge conversational engine."""

from __future__ import annotations

from typing import List, Optional

from app.catalog.service import package_catalog_text
from app.models.schemas import SourceReference

DISCLAIMER = (
    "TaxSimba AI Tax Concierge provides general UK tax information based on "
    "verified HMRC / GOV.UK sources. It is not personalised tax, legal or "
    "financial advice. Rules depend on your circumstances and can change. "
    "For tailored advice, book a £99 accountant consultation with TaxSimba."
)


def build_system_prompt(
    tax_year: str,
    sources: List[SourceReference],
    *,
    journey_blurb: str = "",
    llm_mode: str = "mock",
) -> str:
    if sources:
        lines = []
        for src in sources:
            years = ", ".join(src.tax_years)
            lines.append(
                f"- [{src.id}] {src.title} ({years}): {src.excerpt or ''} "
                f"(source: {src.url})"
            )
        facts_block = "\n".join(lines)
    else:
        facts_block = (
            "- No verified corpus match. Do not invent HMRC figures or deadlines. "
            "Say you lack a verified source and suggest GOV.UK or a £99 consultation."
        )

    journey_block = journey_blurb or "No active guided journey."

    return f"""You are TaxSimba AI Tax Concierge, a helpful UK tax assistant.

RUNTIME: llm_mode={llm_mode}
TAX YEAR CONTEXT: {tax_year}
(The UK tax year runs 6 April to 5 April.)

VERIFIED FACTS:
{facts_block}

TAXSIMBA CATALOGUE (authoritative for prices — do not invent other prices or inclusions):
{package_catalog_text()}

GUIDED JOURNEY CONTEXT:
{journey_block}

INSTRUCTIONS:
- Answer clearly in plain English for UK taxpayers.
- Prefer the verified facts above. Cite sources by title when you use them.
- If facts do not cover the question, say so and do not invent numbers, thresholds, or deadlines.
- Be tax-year aware; if guidance may differ by year, say which year you are using.
- Never request or repeat full UTR, National Insurance number, passwords or card details.
- Never invent package inclusions, website URLs, tax rules, discounts, or booking availability.
- Only quote TaxSimba package prices from the catalogue block above.
- Do not pressure the visitor to buy. Information first; packages are optional support.
- If booking/payment is stubbed, say booking is not connected live yet and share the configured consultation price (£99) only.
- Keep replies concise (under ~200 words unless the user asks for detail).
- Ask at most one clarifying question when needed.
"""


def mock_package_reply(message: str) -> Optional[str]:
    lower = message.lower()
    if "package" in lower or "mtd plan" in lower or ("cost" in lower and "mtd" in lower) or (
        "how much" in lower and ("self assessment" in lower or "mtd" in lower or "plan" in lower)
    ):
        return (
            "Here are TaxSimba's configured prices (catalogue only — inclusions are not "
            "invented by this assistant):\n\n"
            "Self Assessment (per tax year): Simple £119, Smart £149, Elite £299.\n"
            "MTD plans (per month, VAT included): Starter £29.99, Growth £59.99, Complete £89.99.\n"
            "Accountant consultation: £99 one-off (booking not live in this phase).\n\n"
            "Tell me which situation you're in if you'd like help choosing what to read about — "
            "no pressure to purchase."
        )
    if "consult" in lower or "accountant" in lower:
        return (
            "TaxSimba offers a £99 accountant consultation for personalised help. "
            "Live booking is not connected in this phase (stub configuration only). "
            "Meanwhile I can still answer general UK tax questions with GOV.UK sources."
        )
    if "included" in lower or "inclusion" in lower:
        return (
            "I don't invent package inclusions. The catalogue used by this assistant lists "
            "prices and billing only. Please confirm full inclusions with TaxSimba before buying."
        )
    return None
