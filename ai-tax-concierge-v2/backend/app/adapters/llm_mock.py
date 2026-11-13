"""Deterministic mock LLM for tests and keyless local development."""

from __future__ import annotations

from typing import List

from app.adapters.base import LLMAdapter
from app.models.schemas import ChatMessage


class MockLLMAdapter(LLMAdapter):
    mode = "mock"

    async def complete(
        self,
        *,
        system_prompt: str,
        messages: List[ChatMessage],
        user_message: str,
    ) -> str:
        # Extract grounded facts section if present for a helpful reply.
        grounded = ""
        if "VERIFIED FACTS:" in system_prompt:
            grounded = system_prompt.split("VERIFIED FACTS:", 1)[1].strip()
            for marker in (
                "GROUNDING RULES",
                "TAXSIMBA CATALOGUE",
                "CONVERSATION RULES",
                "INSTRUCTIONS:",
                "GUIDED JOURNEY CONTEXT",
            ):
                if marker in grounded:
                    grounded = grounded.split(marker, 1)[0].strip()

        if grounded and not grounded.startswith("- No verified corpus match"):
            lines = [
                ln.strip(" -")
                for ln in grounded.splitlines()
                if ln.strip() and (ln.strip().startswith("-") or ln.strip().startswith("["))
            ]
            # Prefer bullet fact lines; fall back to any non-empty lines
            if not lines:
                lines = [ln.strip(" -") for ln in grounded.splitlines() if ln.strip()]
            q = user_message.lower().replace(",", "")
            best = lines[0]
            best_score = -1
            for ln in lines:
                low = ln.lower().replace(",", "")
                score = sum(1 for token in q.split() if len(token) > 3 and token in low)
                # Prefer facts that carry the figures/topics the user asked about
                for needle, weight in (
                    ("vat", 5),
                    ("90000", 8),
                    ("30000", 8),
                    ("50000", 6),
                    ("20000", 6),
                    ("april 2027", 8),
                    ("april 2026", 4),
                    ("april 2028", 6),
                    ("mtd", 3),
                    ("making tax digital", 4),
                ):
                    if needle in q and needle in low:
                        score += weight
                if score > best_score:
                    best_score = score
                    best = ln
            return (
                f"Based on verified HMRC / GOV.UK guidance: {best}\n\n"
                "This is general information, not personal tax advice. "
                "If your situation is complex, TaxSimba can arrange a £99 "
                "accountant consultation."
            )

        return (
            "I could not find a verified HMRC source in my knowledge base for "
            "that specific question. I recommend checking GOV.UK or booking a "
            "£99 TaxSimba accountant consultation for tailored guidance."
        )
