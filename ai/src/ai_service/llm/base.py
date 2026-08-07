"""Абстракция провайдера LLM.

Модель меняется конфигом, а не правкой кода: на демо-стенде это Ollama с
русскоязычной открытой моделью, в тестах — детерминированная заглушка.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass


class LlmError(RuntimeError):
    """Провайдер не смог выдать ответ. Всегда приводит к fallback."""


@dataclass
class LlmRequest:
    system: str
    prompt: str
    temperature: float = 0.2
    max_tokens: int = 400
    #: Просить модель вернуть строгий JSON (если провайдер это умеет).
    json_mode: bool = False


class LlmProvider(abc.ABC):
    """Контракт провайдера. Синхронный — вызовы идут из пула воркеров."""

    name: str = "base"

    @abc.abstractmethod
    def generate(self, request: LlmRequest) -> str:
        """Возвращает текст ответа модели или бросает LlmError."""

    def health(self) -> bool:
        """Готовность провайдера. Используется для /readyz и метрик."""
        return True
