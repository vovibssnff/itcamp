"""NATS JetStream pub/sub хелперы (plan §17).

Субъекты/стримы шины из плана §17. nats-py импортируется лениво.

| Subject / stream        | Продюсер → Потребитель                | Retention |
|-------------------------|---------------------------------------|-----------|
| report.tasks            | gw/orchestrator → report              | work queue|
| ai.tasks                | orchestrator → ai                     | work queue|
| ai.results.{task_id}    | ai → orchestrator/assessment          | interest  |
| session.events          | orchestrator → assessment/аудит       | limits    |
| assessment.events       | assessment → аудит                    | limits    |
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Awaitable, Callable


# --- Каталог субъектов (единый источник истины, plan §17) ---
class Subjects:
    REPORT_TASKS = "report.tasks"
    AI_TASKS = "ai.tasks"
    AI_RESULTS = "ai.results"  # + .{task_id}
    SESSION_EVENTS = "session.events"
    ASSESSMENT_EVENTS = "assessment.events"

    @staticmethod
    def ai_result(task_id: str) -> str:
        return f"{Subjects.AI_RESULTS}.{task_id}"


@dataclass(frozen=True)
class StreamSpec:
    name: str
    subjects: tuple[str, ...]
    retention: str  # workqueue|interest|limits


# Рекомендуемые стримы JetStream (создаются при бутстрапе кластера / сервисом).
STREAMS: tuple[StreamSpec, ...] = (
    StreamSpec("REPORT_TASKS", ("report.tasks",), "workqueue"),
    StreamSpec("AI_TASKS", ("ai.tasks",), "workqueue"),
    StreamSpec("AI_RESULTS", ("ai.results.*",), "interest"),
    StreamSpec("SESSION_EVENTS", ("session.events",), "limits"),
    StreamSpec("ASSESSMENT_EVENTS", ("assessment.events",), "limits"),
)


class NatsHelper:
    """Обёртка над nats-py: connect, JetStream publish/subscribe, ensure streams."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._nc: Any | None = None
        self._js: Any | None = None

    async def connect(self) -> None:
        if self._nc is not None:
            return
        import nats  # ленивый импорт

        self._nc = await nats.connect(self.url)
        self._js = self._nc.jetstream()

    async def close(self) -> None:
        if self._nc is not None:
            await self._nc.drain()
            self._nc = None
            self._js = None

    @property
    def js(self) -> Any:
        if self._js is None:
            raise RuntimeError("NatsHelper.connect() не был вызван")
        return self._js

    async def ensure_streams(self, specs: "tuple[StreamSpec, ...] | None" = None) -> None:
        from nats.js.api import RetentionPolicy, StreamConfig

        retention_map = {
            "workqueue": RetentionPolicy.WORK_QUEUE,
            "interest": RetentionPolicy.INTEREST,
            "limits": RetentionPolicy.LIMITS,
        }
        for spec in specs or STREAMS:
            cfg = StreamConfig(
                name=spec.name,
                subjects=list(spec.subjects),
                retention=retention_map[spec.retention],
            )
            try:
                await self.js.add_stream(cfg)
            except Exception:  # noqa: BLE001 — уже существует / обновление вне scope MVP
                pass

    async def publish_json(self, subject: str, payload: dict[str, Any]) -> None:
        await self.js.publish(subject, json.dumps(payload, ensure_ascii=False).encode())

    async def subscribe_json(
        self,
        subject: str,
        handler: Callable[[dict[str, Any]], Awaitable[None]],
        durable: str | None = None,
    ) -> Any:
        async def _cb(msg):  # noqa: ANN001
            try:
                data = json.loads(msg.data.decode())
                await handler(data)
                await msg.ack()
            except Exception:  # noqa: BLE001
                # Без ack сообщение будет доставлено повторно (retry, plan §15/§16).
                pass

        return await self.js.subscribe(subject, durable=durable, cb=_cb)

    async def ping(self) -> bool:
        return self._nc is not None and self._nc.is_connected
