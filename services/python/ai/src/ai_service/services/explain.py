"""Explain: причина → следствие → рекомендация (FR-AI-02)."""
from __future__ import annotations

import logging
import time

from ..config import Settings, get_settings
from ..domain.models import AlarmEvent, Explanation, OperatorAction, TagSeries
from ..llm.base import LlmError, LlmProvider, LlmRequest
from ..observability import metrics
from ..prompts.templates import EXPLAIN_PROMPT, EXPLAIN_SYSTEM
from ..rag.store import KnowledgeBase
from ..resilience.circuit_breaker import CircuitBreaker
from ..validation.explain_format import ExplainFormatError, parse_explain
from ..validation.pdn import scrub
from ..validation.tag_guard import TagGuard

logger = logging.getLogger(__name__)

_RPC = "explain"
_MAX_RETRIES = 1


class ExplainService:
    def __init__(
        self,
        llm: LlmProvider,
        knowledge: KnowledgeBase,
        tag_guard: TagGuard,
        settings: Settings | None = None,
        breaker: CircuitBreaker | None = None,
        fallback_cards: dict[str, str] | None = None,
    ) -> None:
        self.llm = llm
        self.knowledge = knowledge
        self.tag_guard = tag_guard
        self.settings = settings or get_settings()
        self.breaker = breaker or CircuitBreaker(
            self.settings.breaker_failure_threshold,
            self.settings.breaker_reset_timeout_s,
        )
        #: Карточки неисправностей — детерминированный резерв (FR-LIB-05).
        self.fallback_cards = fallback_cards or {}

    def explain_alarm(
        self,
        alarm: AlarmEvent,
        series: list[TagSeries],
        actions: list[OperatorAction],
        node_label: str = "",
        component_type: str = "",
        neighbors: list[str] | None = None,
        interlocks: list[str] | None = None,
        faults: list[str] | None = None,
        template_name: str = "",
        equipment_filter: set[str] | None = None,
        locale: str = "ru",
    ) -> Explanation:
        started = time.monotonic()
        try:
            return self._explain(
                alarm, series, actions, node_label, component_type,
                neighbors or [], interlocks or [], faults or [],
                template_name, equipment_filter, locale,
            )
        finally:
            metrics.duration(_RPC, time.monotonic() - started)

    # -- внутреннее ---------------------------------------------------------

    def _explain(
        self, alarm, series, actions, node_label, component_type,
        neighbors, interlocks, faults, template_name, equipment_filter, locale,
    ) -> Explanation:
        if not self.breaker.allows():
            metrics.fallback(_RPC, "breaker_open")
            return self._fallback(alarm, "breaker_open")

        query = f"{node_label} {alarm.tag_id} давление уровень температура блокировка"
        hits = self.knowledge.search(query, top_k=3, equipment_filter=equipment_filter)
        rag_block = "\n\n".join(
            f"[{c.source}, {c.section}] {c.text}" for c, _ in hits
        ) or "нет данных"

        prompt = EXPLAIN_PROMPT.format(
            template_name=template_name or "не указана",
            node_label=node_label or "не указан",
            component_type=component_type or "не указан",
            neighbors=", ".join(neighbors) or "нет",
            alarm_tag=alarm.tag_id,
            alarm_value=alarm.value if alarm.value is not None else "н/д",
            unit="",
            alarm_limit=alarm.limit if alarm.limit is not None else "н/д",
            priority=alarm.priority,
            interlocks="\n".join(f"- {i}" for i in interlocks) or "не заданы",
            window_s=_window_seconds(series),
            series=_format_series(series),
            actions=_format_actions(actions),
            faults="\n".join(f"- {f}" for f in faults) or "нет",
            rag=rag_block,
        )
        system = EXPLAIN_SYSTEM.format(locale=locale)

        for attempt in range(_MAX_RETRIES + 1):
            try:
                raw = self.llm.generate(
                    LlmRequest(
                        system=system,
                        prompt=prompt,
                        # На повторе температура нулевая: первая попытка не
                        # уложилась в формат, вариативность больше не нужна.
                        temperature=0.2 if attempt == 0 else 0.0,
                        max_tokens=400,
                    )
                )
                self.breaker.record_success()
            except LlmError as exc:
                self.breaker.record_failure()
                logger.warning("Explain: отказ LLM (%s)", exc)
                metrics.fallback(_RPC, "llm_error")
                return self._fallback(alarm, "llm_error")

            try:
                parsed = parse_explain(raw)
            except ExplainFormatError as exc:
                logger.info("Explain: неверный формат (%s), попытка %d", exc, attempt + 1)
                metrics.reject("bad_format")
                continue

            text = " ".join([parsed.cause, parsed.effect, parsed.recommendation])
            guard = self.tag_guard.check(text)
            if not guard.ok:
                logger.warning("Explain: неизвестные теги %s", guard.unknown_tags)
                metrics.reject("unknown_tag")
                continue

            metrics.request(_RPC, "ok")
            return Explanation(
                cause=scrub(parsed.cause),
                effect=scrub(parsed.effect),
                recommendation=scrub(parsed.recommendation),
                evidence_tags=guard.known_tags,
                regulation_refs=[f"{c.source}, {c.section}" for c, _ in hits],
                confidence=0.7,
            )

        metrics.fallback(_RPC, "validation_failed")
        return self._fallback(alarm, "validation_failed")

    def _fallback(self, alarm: AlarmEvent, reason: str) -> Explanation:
        """Детерминированная карточка вместо ИИ-ответа (NFR-REL-03)."""
        card = self.fallback_cards.get(alarm.tag_id)
        if card:
            cause = card
        else:
            limit = alarm.limit if alarm.limit is not None else "уставки"
            cause = (
                f"Параметр {alarm.tag_id} достиг значения "
                f"{alarm.value if alarm.value is not None else 'н/д'} "
                f"при уставке {limit}."
            )
        metrics.request(_RPC, "degraded")
        return Explanation(
            cause=cause,
            effect="Развёрнутое объяснение временно недоступно.",
            recommendation=(
                "Обратитесь к карточке аппарата и технологическому регламенту; "
                "при необходимости запросите разбор у инструктора."
            ),
            evidence_tags=[alarm.tag_id],
            confidence=0.0,
            degraded=True,
        )


# -- форматирование контекста ----------------------------------------------


def _window_seconds(series: list[TagSeries]) -> int:
    if not series:
        return 0
    return max(len(s.values) * s.step_s for s in series)


def _format_series(series: list[TagSeries], max_points: int = 12) -> str:
    if not series:
        return "нет данных"
    lines = []
    for s in series:
        values = s.values[-max_points:]
        rendered = ", ".join(f"{v:g}" for v in values)
        lines.append(f"- {s.tag_id} ({s.unit or 'ед. не задана'}): {rendered}")
    return "\n".join(lines)


def _format_actions(actions: list[OperatorAction], limit: int = 10) -> str:
    if not actions:
        return "действий не было"
    recent = sorted(actions, key=lambda a: a.model_time_s)[-limit:]
    lines = []
    for a in recent:
        change = ""
        if a.value_from is not None or a.value_to is not None:
            change = f" с {a.value_from if a.value_from is not None else '?'} на {a.value_to if a.value_to is not None else '?'}"
        lines.append(f"- t={a.model_time_s} с: {a.type} {a.target}{change}")
    return "\n".join(lines)
