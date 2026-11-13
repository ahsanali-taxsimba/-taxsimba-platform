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
            first_line = grounded.splitlines()[0].strip(" -")
            return (
                f"Based on verified HMRC / GOV.UK guidance: {first_line}\n\n"
                "This is general information, not personal tax advice. "
                "If your situation is complex, TaxSimba can arrange a £99 "
                "accountant consultation."
            )

        return (
            "I could not find a verified HMRC source in my knowledge base for "
            "that specific question. I recommend checking GOV.UK or booking a "
            "£99 TaxSimba accountant consultation for tailored guidance."
        )
