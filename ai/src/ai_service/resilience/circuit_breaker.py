"""Предохранитель на вызовы LLM (AI-CTR-06).

После серии отказов вызовы сразу уходят в fallback, не тратя дедлайн
пользовательского запроса на ожидание недоступного GPU-узла.
"""
from __future__ import annotations

import threading
import time
from enum import Enum


class BreakerState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout_s: float = 60.0) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout_s = reset_timeout_s
        self._failures = 0
        self._opened_at: float | None = None
        self._lock = threading.Lock()

    @property
    def state(self) -> BreakerState:
        with self._lock:
            return self._state_unlocked()

    def _state_unlocked(self) -> BreakerState:
        if self._opened_at is None:
            return BreakerState.CLOSED
        if time.monotonic() - self._opened_at >= self.reset_timeout_s:
            return BreakerState.HALF_OPEN
        return BreakerState.OPEN

    def allows(self) -> bool:
        """Можно ли выполнять вызов прямо сейчас."""
        return self.state is not BreakerState.OPEN

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self.failure_threshold:
                self._opened_at = time.monotonic()

    def reset(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None
