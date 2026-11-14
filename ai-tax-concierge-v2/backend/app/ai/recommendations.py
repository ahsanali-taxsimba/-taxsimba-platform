"""Non-pushy package / calculator / follow-up recommendations from config only."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.catalog.service import (
    all_packages_flat,
    calculators_catalog,
    match_calculators,
    packages_catalog,
)
from app.models.schemas import CalculatorCard, JourneyState, PackageCard

_SA_PRICE = re.compile(r"\b(package|packages|pricing|price|cost|how much)\b", re.I)
_MTD_PRICE = re.compile(r"\bmtd\b|\bmaking tax digital\b", re.I)
_CONSULT = re.compile(r"\b(consult|accountant|book|speak to|talk to)\b", re.I)


def to_package_cards(codes: List[str]) -> List[PackageCard]:
    flat = all_packages_flat()
    cards: List[PackageCard] = []
    for code in codes:
        pkg = flat.get(code)
        if not pkg:
            continue
        cards.append(
            PackageCard(
                code=pkg["code"],
                name=pkg["name"],
                price_gbp=float(pkg["price_gbp"]),
                billing=pkg["billing"],
                vat_note=pkg.get("vat_note", ""),
                family=pkg["family"],
                inclusions_status=pkg.get("inclusions_status", "not_specified_in_catalog"),
            )
        )
    return cards


_NO_BUY = re.compile(
    r"\b(don'?t want to buy|do not want to buy|not looking to buy|no sales|"
    r"just information|information only|not interested in (a )?package|"
    r"don'?t sell|no pressure|just asking|curious only)\b",
    re.I,
)


def visitor_declines_sales(message: str) -> bool:
    return bool(_NO_BUY.search(message or ""))


def to_calculator_cards(items: List[dict], website_base: str) -> List[CalculatorCard]:
    cards: List[CalculatorCard] = []
    for item in items:
        url = None
        note = None
        status = item.get("url_status", "stub")
        if status == "live_verified":
            url = f"{website_base.rstrip('/')}{item.get('path', '')}"
            note = "Verified public calculator on taxsimba.co.uk"
        elif status == "soft_or_generic":
            url = f"{website_base.rstrip('/')}{item.get('path', '')}"
            note = "Reachable path — confirm destination before relying in production."
        else:
            note = "Calculator path configured but not confirmed on the live website yet."
        cards.append(
            CalculatorCard(
                id=item["id"],
                title=item["title"],
                description=item["description"],
                url_status=status,
                url=url,
                note=note,
            )
        )
    return cards


def recommend_for_message(
    message: str,
    *,
    journey: Optional[JourneyState],
    website_base: str,
) -> Tuple[List[PackageCard], List[CalculatorCard], List[str]]:
    packages: List[PackageCard] = []
    follow_ups: List[str] = []
    decline_sales = visitor_declines_sales(message)

    if journey and journey.complete:
        packages = [] if decline_sales else to_package_cards(journey.suggested_package_codes)
        calc_ids = set(journey.suggested_calculator_ids)
        calc_items = [c for c in calculators_catalog()["items"] if c["id"] in calc_ids]
        calculators = to_calculator_cards(calc_items, website_base)
        follow_ups = list(journey.follow_ups)
        if decline_sales:
            follow_ups = [
                "What Self Assessment deadlines should I know?",
                "Where can I check this on GOV.UK?",
            ] + [f for f in follow_ups if "£99" not in f and "package" not in f.lower()]
        return packages, calculators, follow_ups[:4]

    cat = packages_catalog()
    lower = message.lower()

    if decline_sales:
        follow_ups = [
            "What Self Assessment deadlines should I know?",
            "How does Making Tax Digital work in plain English?",
            "Where should I check this on GOV.UK?",
        ]
    elif _SA_PRICE.search(message) and not _MTD_PRICE.search(message):
        packages = to_package_cards([p["code"] for p in cat["self_assessment"]])
        follow_ups = [
            "What is included in each Self Assessment package?",
            "Do I need Self Assessment this year?",
            "Can I book a £99 accountant consultation instead?",
        ]
    elif _MTD_PRICE.search(message) and _SA_PRICE.search(message):
        packages = to_package_cards(
            [p["code"] for p in cat["self_assessment"]] + [p["code"] for p in cat["mtd"]]
        )
        follow_ups = [
            "Who needs Making Tax Digital?",
            "How do MTD plans differ from Self Assessment packages?",
        ]
    elif _MTD_PRICE.search(message) and ("plan" in lower or "price" in lower or "cost" in lower):
        packages = to_package_cards([p["code"] for p in cat["mtd"]])
        follow_ups = [
            "What is Making Tax Digital for Income Tax?",
            "Do landlords need MTD?",
        ]
    elif _CONSULT.search(message):
        packages = to_package_cards([cat["consultation"]["code"]])
        follow_ups = [
            "What can an accountant consultation help with?",
            "What Self Assessment packages are available?",
        ]

    # Soft defaults for topic-based follow-ups when empty
    if not follow_ups:
        if "deadline" in lower:
            follow_ups = [
                "Do I need to send a Self Assessment tax return?",
                "What are payments on account?",
            ]
        elif "landlord" in lower or "rental" in lower:
            follow_ups = [
                "Do landlords need Self Assessment?",
                "What is Making Tax Digital for landlords?",
            ]
        elif "cis" in lower:
            follow_ups = [
                "Do CIS subcontractors need Self Assessment?",
                "What records should I keep under CIS?",
            ]
        elif "freelancer" in lower or "self-employed" in lower or "self employed" in lower:
            follow_ups = [
                "How do I register as self-employed?",
                "When is the Self Assessment deadline?",
            ]

    calculators = to_calculator_cards(match_calculators(message), website_base)
    return packages, calculators, follow_ups


def answer_inclusions_question(message: str) -> Optional[str]:
    if "included" in message.lower() or "inclusion" in message.lower() or "what do i get" in message.lower():
        return (
            "I do not invent package inclusions. TaxSimba's catalogue for this assistant "
            "lists prices and billing only. For a full inclusions list, please check with "
            "TaxSimba directly or ask during a £99 accountant consultation."
        )
    return None
