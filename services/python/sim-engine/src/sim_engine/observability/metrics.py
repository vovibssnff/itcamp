"""Метрики sim-worker. Prometheus опционален — без него in-memory."""
from __future__ import annotations

import threading
from collections import defaultdict

try:  # pragma: no cover
    from prometheus_client import Counter, Histogram

    _HAS_PROMETHEUS = True
except ImportError:  # pragma: no cover
    _HAS_PROMETHEUS = False


class _InMemoryMetrics:
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

if _HAS_PROMETHEUS:  # pragma: no cover
    _steps = Counter("sim_steps_total", "Тики Model API", ["status"])
    _faults = Counter("sim_fault_injections_total", "Инъекции неисправностей", ["fault_id"])
    _commands = Counter("sim_commands_total", "Команды оператора", ["type", "status"])
    _duration = Histogram("sim_step_duration_seconds", "Длительность step()")
else:  # pragma: no cover
    _steps = _faults = _commands = _duration = None


def step(status: str) -> None:
    registry.inc("sim_steps_total", status=status)
    if _steps is not None:  # pragma: no cover
        _steps.labels(status=status).inc()


def fault_injected(fault_id: str) -> None:
    registry.inc("sim_fault_injections_total", fault_id=fault_id)
    if _faults is not None:  # pragma: no cover
        _faults.labels(fault_id=fault_id).inc()


def command(cmd_type: str, status: str) -> None:
    registry.inc("sim_commands_total", type=cmd_type, status=status)
    if _commands is not None:  # pragma: no cover
        _commands.labels(type=cmd_type, status=status).inc()


def step_duration(seconds: float) -> None:
    registry.observe("sim_step_duration_seconds", seconds)
    if _duration is not None:  # pragma: no cover
        _duration.observe(seconds)
