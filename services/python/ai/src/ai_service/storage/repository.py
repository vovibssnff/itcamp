"""Хранилище AIInsight (§6.1 SRD).

Интерфейс отделён от реализации: прототип работает в памяти, продуктив —
на Picodata. Реализация под Picodata использует raw SQL: системные каталоги
PostgreSQL там поддержаны частично, поэтому reflection в SQLAlchemy
неприменим (см. §7.4 SRD).
"""
from __future__ import annotations

import abc
import json
import threading
import uuid
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class AiInsight:
    session_id: str
    type: str
    input: dict[str, Any]
    output: dict[str, Any]
    model_time_s: int
    insight_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )
    degraded: bool = False


class InsightRepository(abc.ABC):
    @abc.abstractmethod
    def save(self, insight: AiInsight) -> str: ...

    @abc.abstractmethod
    def list_by_session(self, session_id: str) -> list[AiInsight]: ...

    @abc.abstractmethod
    def find_cached(self, session_id: str, type_: str, model_time_s: int) -> AiInsight | None:
        """Идемпотентность вызовов (AI-CTR-01)."""


class InMemoryInsightRepository(InsightRepository):
    def __init__(self) -> None:
        self._items: list[AiInsight] = []
        self._lock = threading.Lock()

    def save(self, insight: AiInsight) -> str:
        with self._lock:
            self._items.append(insight)
        return insight.insight_id

    def list_by_session(self, session_id: str) -> list[AiInsight]:
        with self._lock:
            return [i for i in self._items if i.session_id == session_id]

    def find_cached(self, session_id: str, type_: str, model_time_s: int) -> AiInsight | None:
        with self._lock:
            for item in reversed(self._items):
                if (
                    item.session_id == session_id
                    and item.type == type_
                    and item.model_time_s == model_time_s
                ):
                    return item
        return None


class PicodataInsightRepository(InsightRepository):  # pragma: no cover - нужен кластер
    """Реализация на Picodata через PG-совместимый протокол (asyncpg/psycopg).

    Схема создаётся миграционным скриптом, не автогенерацией ORM.
    """

    DDL = """
    CREATE TABLE IF NOT EXISTS ai_insight (
        insight_id   TEXT PRIMARY KEY,
        session_id   TEXT NOT NULL,
        type         TEXT NOT NULL,
        input        TEXT NOT NULL,
        output       TEXT NOT NULL,
        model_time_s INTEGER NOT NULL,
        degraded     BOOLEAN NOT NULL,
        created_at   TEXT NOT NULL
    );
    """

    def __init__(self, connection: Any) -> None:
        self._conn = connection

    def save(self, insight: AiInsight) -> str:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ai_insight (insight_id, session_id, type, input, output, "
                "model_time_s, degraded, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    insight.insight_id,
                    insight.session_id,
                    insight.type,
                    json.dumps(insight.input, ensure_ascii=False),
                    json.dumps(insight.output, ensure_ascii=False),
                    insight.model_time_s,
                    insight.degraded,
                    insight.created_at,
                ),
            )
        return insight.insight_id

    def list_by_session(self, session_id: str) -> list[AiInsight]:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT insight_id, session_id, type, input, output, model_time_s, "
                "degraded, created_at FROM ai_insight WHERE session_id = %s "
                "ORDER BY model_time_s",
                (session_id,),
            )
            return [_row_to_insight(row) for row in cur.fetchall()]

    def find_cached(self, session_id: str, type_: str, model_time_s: int) -> AiInsight | None:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT insight_id, session_id, type, input, output, model_time_s, "
                "degraded, created_at FROM ai_insight WHERE session_id = %s AND type = %s "
                "AND model_time_s = %s LIMIT 1",
                (session_id, type_, model_time_s),
            )
            row = cur.fetchone()
            return _row_to_insight(row) if row else None


def _row_to_insight(row: tuple) -> AiInsight:  # pragma: no cover
    return AiInsight(
        insight_id=row[0],
        session_id=row[1],
        type=row[2],
        input=json.loads(row[3]),
        output=json.loads(row[4]),
        model_time_s=row[5],
        degraded=bool(row[6]),
        created_at=row[7],
    )


def to_dict(obj: Any) -> Any:
    """Рекурсивно превращает dataclass в словарь для сохранения и JSON-ответа."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: to_dict(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_dict(v) for v in obj]
    return obj
