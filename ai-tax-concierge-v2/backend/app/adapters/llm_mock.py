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
            grounded = grounded.split("INSTRUCTIONS:", 1)[0].strip()

        if grounded:
            lines = [ln.strip(" -") for ln in grounded.splitlines() if ln.strip()]
            q = user_message.lower()
            best = lines[0]
            best_score = -1
            for ln in lines:
                score = sum(1 for token in q.split() if len(token) > 3 and token in ln.lower())
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
