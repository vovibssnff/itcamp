"""Конфигурация сервиса. Значения читаются из переменных окружения.

Секреты в образ и репозиторий не попадают (NFR-SEC-07): всё, что чувствительно,
подставляется через Kubernetes Secrets.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "да"}


@dataclass
class Settings:
    # --- LLM ---
    llm_provider: str = field(default_factory=lambda: _env("KTK_LLM_PROVIDER", "stub"))
    llm_model: str = field(default_factory=lambda: _env("KTK_LLM_MODEL", "qwen2.5:14b-instruct"))
    ollama_url: str = field(default_factory=lambda: _env("KTK_OLLAMA_URL", "http://localhost:11434"))
    llm_timeout_s: float = field(default_factory=lambda: _env_float("KTK_LLM_TIMEOUT_S", 30.0))

    # --- Дедлайны вызовов (AI-CTR-02) ---
    explain_deadline_s: float = field(default_factory=lambda: _env_float("KTK_EXPLAIN_DEADLINE_S", 12.0))
    behaviour_deadline_s: float = field(default_factory=lambda: _env_float("KTK_BEHAVIOUR_DEADLINE_S", 0.5))
    chat_deadline_s: float = field(default_factory=lambda: _env_float("KTK_CHAT_DEADLINE_S", 15.0))

    # --- Данные ---
    data_dir: str = field(default_factory=lambda: _env("KTK_DATA_DIR", "data"))
    docs_dir: str = field(default_factory=lambda: _env("KTK_DOCS_DIR", "data/regulation"))

    # --- Чат-бот ---
    #: Бот не имеет доступа к телеметрии, поэтому на экзамене работает
    #: как открытый справочник. Отключается одним флагом, если методика
    #: требует закрытой аттестации.
    chat_enabled_in_exam: bool = field(default_factory=lambda: _env_bool("KTK_CHAT_IN_EXAM", True))
    chat_min_relevance: float = field(default_factory=lambda: _env_float("KTK_CHAT_MIN_RELEVANCE", 1.0))
    chat_top_k: int = field(default_factory=lambda: _env_int("KTK_CHAT_TOP_K", 4))

    # --- Устойчивость (AI-CTR-06) ---
    breaker_failure_threshold: int = field(default_factory=lambda: _env_int("KTK_BREAKER_FAILURES", 5))
    breaker_reset_timeout_s: float = field(default_factory=lambda: _env_float("KTK_BREAKER_RESET_S", 60.0))

    # --- Сеть ---
    rest_port: int = field(default_factory=lambda: _env_int("KTK_REST_PORT", 8080))
    grpc_port: int = field(default_factory=lambda: _env_int("KTK_GRPC_PORT", 50051))


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings() -> None:
    """Сброс кеша конфигурации (используется в тестах)."""
    global _settings
    _settings = None
