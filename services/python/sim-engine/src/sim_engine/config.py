"""Конфигурация сервиса из переменных окружения (KTC_SIM_*)."""
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


@dataclass
class Settings:
    data_dir: str = field(default_factory=lambda: _env("KTC_SIM_DATA_DIR", "data"))
    template_file: str = field(
        default_factory=lambda: _env("KTC_SIM_TEMPLATE_FILE", "template_atm_demo.json")
    )
    faults_file: str = field(
        default_factory=lambda: _env("KTC_SIM_FAULTS_FILE", "faults_catalog.json")
    )
    tick_hz: float = field(default_factory=lambda: _env_float("KTC_SIM_TICK_HZ", 1.0))
    default_seed: int = field(default_factory=lambda: _env_int("KTC_SIM_DEFAULT_SEED", 42))

    rest_port: int = field(default_factory=lambda: _env_int("KTC_SIM_REST_PORT", 8081))
    grpc_port: int = field(default_factory=lambda: _env_int("KTC_SIM_GRPC_PORT", 50061))


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
