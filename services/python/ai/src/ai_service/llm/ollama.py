"""Провайдер Ollama (локальный GPU-узел ktk-ai).

Реализован на urllib из стандартной библиотеки — сервис должен
подниматься без внешних зависимостей, а httpx нужен только API-слою.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from .base import LlmError, LlmProvider, LlmRequest


class OllamaProvider(LlmProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen2.5:14b-instruct",
        timeout_s: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s

    def generate(self, request: LlmRequest) -> str:
        payload: dict[str, object] = {
            "model": self.model,
            "prompt": request.prompt,
            "system": request.system,
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            },
        }
        if request.json_mode:
            payload["format"] = "json"

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise LlmError(f"Ollama недоступна: {exc}") from exc

        text = body.get("response")
        if not isinstance(text, str) or not text.strip():
            raise LlmError("Ollama вернула пустой ответ")
        return text.strip()

    def health(self) -> bool:
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=3.0) as resp:
                return resp.status == 200
        except OSError:
            return False
