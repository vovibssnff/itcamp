"""py_common — общие модули микросервисов КТК (plan §1, §5, §6).

Лёгкие модули (config, logging, problem, pagination, health, metrics, jwt_verify)
импортируются напрямую. Тяжёлые клиенты (picodata_client, nats_helpers) держат
свои зависимости (asyncpg / nats-py) лениво, поэтому импорт пакета не требует их
наличия.
"""
from __future__ import annotations

__version__ = "0.1.0"
SCHEMA_VERSION = "2.0"  # версия формата графа/снапшота (plan §1)

from py_common import (  # noqa: E402,F401
    config,
    health,
    logging,
    metrics,
    pagination,
    problem,
)

__all__ = [
    "config",
    "logging",
    "problem",
    "pagination",
    "health",
    "metrics",
    "__version__",
    "SCHEMA_VERSION",
]
