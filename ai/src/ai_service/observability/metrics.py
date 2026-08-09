"""Метрики сервиса. Prometheus-клиент опционален — без него используется no-op."""
from __future__ import annotations

import threading
from collections import defaultdict
from typing import Any

try:  # pragma: no cover - зависит от окружения
    from prometheus_client import Counter, Histogram

    _HAS_PROMETHEUS = True
except ImportError:  # pragma: no cover
    _HAS_PROMETHEUS = False


class _InMemoryMetrics:
    """Счётчики в памяти: работают всегда, используются в тестах."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.counters: dict[tuple[str, tuple[tuple[str, str], ...]], int] = defaultdict(int)
        self.observations: dict[str, list[float]] = defaultdict(list)

    def inc(self, name: str, **labels: str) -> None:
        with self._lock:
            self.counters[(name, tuple(sorted(labels.items())))] += 1

    def observe(self, name: str, value: float) -> None:
        with self._lock:
            self.observations[name].append(value)

    def value(self, name: str, **labels: str) -> int:
        return self.counters.get((name, tuple(sorted(labels.items()))), 0)

    def reset(self) -> None:
        with self._lock:
            self.counters.clear()
            self.observations.clear()


registry = _InMemoryMetrics()

# Any: типы prometheus_client недоступны, если пакет не установлен.
_requests: Any = None
_fallbacks: Any = None
_rejects: Any = None
_duration: Any = None

if _HAS_PROMETHEUS:  # pragma: no cover
    _requests = Counter("ai_requests_total", "Вызовы ИИ-сервиса", ["rpc", "status"])
    _fallbacks = Counter("ai_fallback_total", "Деградации", ["rpc", "reason"])
    _rejects = Counter("ai_validation_reject_total", "Брак постобработки", ["reason"])
    _duration = Histogram("ai_request_duration_seconds", "Латентность", ["rpc"])


def request(rpc: str, status: str) -> None:
    registry.inc("ai_requests_total", rpc=rpc, status=status)
    if _requests is not None:  # pragma: no cover
        _requests.labels(rpc=rpc, status=status).inc()


def fallback(rpc: str, reason: str) -> None:
    registry.inc("ai_fallback_total", rpc=rpc, reason=reason)
    if _fallbacks is not None:  # pragma: no cover
        _fallbacks.labels(rpc=rpc, reason=reason).inc()


def reject(reason: str) -> None:
    registry.inc("ai_validation_reject_total", reason=reason)
    if _rejects is not None:  # pragma: no cover
        _rejects.labels(reason=reason).inc()


def duration(rpc: str, seconds: float) -> None:
    registry.observe(f"ai_request_duration_seconds:{rpc}", seconds)
    if _duration is not None:  # pragma: no cover
        _duration.labels(rpc=rpc).observe(seconds)
