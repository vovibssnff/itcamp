"""Env-based конфигурация сервисов (plan §6).

Единая модель настроек, читается из переменных окружения (12-factor). Значения
по умолчанию рассчитаны на docker-compose local dev (см. корневой docker-compose.yml).
Секреты (ключи JWT, пароли) — только из env/Secret, никогда не хардкодятся.
"""
from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel, Field


def _env(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key)
    return val if val is not None and val != "" else default


class Settings(BaseModel):
    """Общие настройки. Сервисы наследуют/расширяют при необходимости."""

    service_name: str = Field(default="unknown")
    environment: str = Field(default="dev")  # dev|prod
    log_level: str = Field(default="INFO")
    api_base_path: str = Field(default="/api/v1")  # plan §5

    # --- Picodata (PG-wire) ---
    picodata_dsn: str = Field(
        default="postgresql://ktk:ktk@localhost:5432/ktk",
        description="DSN для asyncpg (raw SQL, без reflection — plan §1).",
    )
    picodata_pool_min: int = 1
    picodata_pool_max: int = 10

    # --- Radix (Redis-совместимый) ---
    radix_url: str = Field(default="redis://localhost:6379/0")

    # --- NATS JetStream ---
    nats_url: str = Field(default="nats://localhost:4222")

    # --- MinIO / S3 ---
    s3_endpoint: str = Field(default="http://localhost:9000")
    s3_access_key: str = Field(default="minioadmin")
    s3_secret_key: str = Field(default="minioadmin")
    s3_region: str = Field(default="us-east-1")

    # --- JWT (RS256, публичный ключ auth — plan §5) ---
    jwt_public_key: str | None = Field(default=None)
    jwt_public_key_path: str | None = Field(default=None)
    jwt_algorithm: str = Field(default="RS256")
    jwt_issuer: str | None = Field(default="ktk-auth")
    jwt_audience: str | None = Field(default=None)

    @classmethod
    def from_env(cls, service_name: str | None = None) -> "Settings":
        data: dict[str, object] = {
            "service_name": service_name or _env("SERVICE_NAME", "unknown"),
            "environment": _env("ENVIRONMENT", "dev"),
            "log_level": _env("LOG_LEVEL", "INFO"),
            "api_base_path": _env("API_BASE_PATH", "/api/v1"),
            "picodata_dsn": _env("PICODATA_DSN", "postgresql://ktk:ktk@localhost:5432/ktk"),
            "picodata_pool_min": int(_env("PICODATA_POOL_MIN", "1")),
            "picodata_pool_max": int(_env("PICODATA_POOL_MAX", "10")),
            "radix_url": _env("RADIX_URL", "redis://localhost:6379/0"),
            "nats_url": _env("NATS_URL", "nats://localhost:4222"),
            "s3_endpoint": _env("S3_ENDPOINT", "http://localhost:9000"),
            "s3_access_key": _env("S3_ACCESS_KEY", "minioadmin"),
            "s3_secret_key": _env("S3_SECRET_KEY", "minioadmin"),
            "s3_region": _env("S3_REGION", "us-east-1"),
            "jwt_public_key": _env("JWT_PUBLIC_KEY"),
            "jwt_public_key_path": _env("JWT_PUBLIC_KEY_PATH"),
            "jwt_algorithm": _env("JWT_ALGORITHM", "RS256"),
            "jwt_issuer": _env("JWT_ISSUER", "ktk-auth"),
            "jwt_audience": _env("JWT_AUDIENCE"),
        }
        return cls(**data)

    def resolved_jwt_public_key(self) -> str | None:
        """Возвращает PEM публичного ключа из env или из файла."""
        if self.jwt_public_key:
            return self.jwt_public_key
        if self.jwt_public_key_path and os.path.exists(self.jwt_public_key_path):
            with open(self.jwt_public_key_path, encoding="utf-8") as fh:
                return fh.read()
        return None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Кэшированный синглтон настроек из окружения."""
    return Settings.from_env()
