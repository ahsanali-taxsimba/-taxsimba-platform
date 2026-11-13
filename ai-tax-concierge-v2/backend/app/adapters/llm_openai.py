"""Secure server-side OpenAI adapter. API key never leaves the server."""

from __future__ import annotations

import logging
from typing import List

from app.adapters.base import LLMAdapter
from app.core.errors import LLMUnavailableError
from app.models.schemas import ChatMessage

logger = logging.getLogger(__name__)


class OpenAIAdapter(LLMAdapter):
    mode = "openai"

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 30.0) -> None:
        if not api_key:
            raise ValueError("OpenAIAdapter requires a non-empty api_key")
        # Import lazily so mock-only environments need not initialise the SDK path
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds)
        self._model = model
        # Ensure key is not accidentally retained in a public attribute
        self._api_key_fingerprint = f"sk-...{api_key[-4:]}" if len(api_key) > 4 else "sk-..."

    async def complete(
        self,
        *,
        system_prompt: str,
        messages: List[ChatMessage],
        user_message: str,
    ) -> str:
        payload = [{"role": "system", "content": system_prompt}]
        for msg in messages[-12:]:
            if msg.role == "system":
                continue
            payload.append({"role": msg.role, "content": msg.content})
        payload.append({"role": "user", "content": user_message})

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=payload,
                temperature=0.2,
                max_tokens=700,
            )
        except Exception as exc:  # noqa: BLE001 — map all upstream failures
            logger.exception("OpenAI completion failed (%s)", self._api_key_fingerprint)
            raise LLMUnavailableError() from exc

        choice = response.choices[0].message.content if response.choices else None
        if not choice:
            raise LLMUnavailableError("Empty response from AI service")
        return choice.strip()
