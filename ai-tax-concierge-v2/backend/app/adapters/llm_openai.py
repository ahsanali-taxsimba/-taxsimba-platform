"""Secure server-side OpenAI adapter with retries and cost controls."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import List, Optional

from app.adapters.base import LLMAdapter
from app.core.errors import ConciergeError, LLMUnavailableError
from app.models.schemas import ChatMessage

logger = logging.getLogger(__name__)


class OpenAIAdapter(LLMAdapter):
    mode = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float = 30.0,
        *,
        max_retries: int = 2,
        max_tokens: int = 700,
        daily_token_budget: int = 250_000,
    ) -> None:
        if not api_key:
            raise ValueError("OpenAIAdapter requires a non-empty api_key")
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds)
        self._model = model
        self._max_retries = max_retries
        self._max_tokens = max_tokens
        self._daily_token_budget = daily_token_budget
        self._tokens_used_today = 0
        self._budget_day = time.strftime("%Y-%m-%d")
        self._api_key_fingerprint = f"sk-...{api_key[-4:]}" if len(api_key) > 4 else "sk-..."
        # Do not retain raw key on a public attribute
        del api_key

    def _roll_budget_day(self) -> None:
        today = time.strftime("%Y-%m-%d")
        if today != self._budget_day:
            self._budget_day = today
            self._tokens_used_today = 0

    def usage_snapshot(self) -> dict:
        self._roll_budget_day()
        return {
            "model": self._model,
            "tokens_used_today": self._tokens_used_today,
            "daily_token_budget": self._daily_token_budget,
            "llm_mode": "openai",
        }

    async def complete(
        self,
        *,
        system_prompt: str,
        messages: List[ChatMessage],
        user_message: str,
    ) -> str:
        self._roll_budget_day()
        if self._tokens_used_today >= self._daily_token_budget:
            raise ConciergeError(
                "AI usage limit reached for today. Please try again later or speak to TaxSimba.",
                code="usage_limit",
                status_code=429,
            )

        payload = [{"role": "system", "content": system_prompt}]
        for msg in messages[-12:]:
            if msg.role == "system":
                continue
            payload.append({"role": msg.role, "content": msg.content})
        payload.append({"role": "user", "content": user_message})

        last_exc: Optional[Exception] = None
        for attempt in range(self._max_retries + 1):
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=payload,
                    temperature=0.2,
                    max_tokens=self._max_tokens,
                )
                usage = getattr(response, "usage", None)
                if usage is not None:
                    total = int(getattr(usage, "total_tokens", 0) or 0)
                    self._tokens_used_today += total
                choice = response.choices[0].message.content if response.choices else None
                if not choice:
                    raise LLMUnavailableError("Empty response from AI service")
                return choice.strip()
            except ConciergeError:
                raise
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning(
                    "OpenAI attempt %s failed (%s): %s",
                    attempt + 1,
                    self._api_key_fingerprint,
                    type(exc).__name__,
                )
                if attempt < self._max_retries:
                    await asyncio.sleep(0.4 * (attempt + 1))
                    continue
        logger.exception("OpenAI completion failed (%s)", self._api_key_fingerprint)
        raise LLMUnavailableError() from last_exc
