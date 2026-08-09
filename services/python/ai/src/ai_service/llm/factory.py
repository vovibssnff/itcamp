"""Выбор провайдера LLM по конфигурации."""
from __future__ import annotations

from ..config import Settings
from .base import LlmProvider
from .ollama import OllamaProvider
from .stub import StubProvider


def build_provider(settings: Settings) -> LlmProvider:
    kind = (settings.llm_provider or "stub").lower()
    if kind == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_url,
            model=settings.llm_model,
            timeout_s=settings.llm_timeout_s,
        )
    if kind == "stub":
        return StubProvider()
    raise ValueError(f"Неизвестный провайдер LLM: {settings.llm_provider}")
