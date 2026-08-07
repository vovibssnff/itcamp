"""Детерминированная заглушка LLM.

Нужна, чтобы весь сервис — включая тесты и локальный запуск без GPU —
работал end-to-end. Отдаёт корректные по формату ответы, что позволяет
проверять постобработку и валидацию, а не только «happy path».
"""
from __future__ import annotations

import json

from .base import LlmError, LlmProvider, LlmRequest


class StubProvider(LlmProvider):
    name = "stub"

    def __init__(self, *, fail: bool = False, canned: str | None = None) -> None:
        self.fail = fail
        self.canned = canned
        self.calls: list[LlmRequest] = []

    def generate(self, request: LlmRequest) -> str:
        self.calls.append(request)
        if self.fail:
            raise LlmError("Заглушка сконфигурирована на отказ")
        if self.canned is not None:
            return self.canned
        if request.json_mode:
            return json.dumps(
                {"equivalent": False, "explanation": "Заглушка LLM", "confidence": 0.0},
                ensure_ascii=False,
            )
        return (
            "ПРИЧИНА: Заглушка LLM — модель не подключена.\n"
            "СЛЕДСТВИЕ: Ответ сгенерирован без реальной модели.\n"
            "РЕКОМЕНДАЦИЯ: Подключите провайдера Ollama через конфигурацию."
        )

    def health(self) -> bool:
        return not self.fail
