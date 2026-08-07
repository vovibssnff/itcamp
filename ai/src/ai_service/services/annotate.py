"""ИИ-аннотация поверх детерминированной оценки (ADR-001).

Сервис получает уже посчитанный балл и НЕ может его изменить: возвращается
новый объект AnnotatedAssessment, где поле assessment — исходный,
неизменённый результат Assessment Engine. Всё, что добавляет ИИ, носит
совещательный характер и адресовано инструктору (FR-ASSESS-05).
"""
from __future__ import annotations

import json
import logging

from ..analysis.profile import ErrorProfile
from ..domain.models import (
    AiAnnotation,
    AnnotatedAssessment,
    RuleBasedAssessment,
    StepEvaluation,
)
from ..llm.base import LlmError, LlmProvider, LlmRequest
from ..observability import metrics
from ..prompts.templates import EQUIVALENCE_PROMPT, EQUIVALENCE_SYSTEM
from ..rag.store import KnowledgeBase
from ..resilience.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)

_RPC = "annotate"

#: Максимум пропущенных шагов, для которых запрашивается проверка
#: эквивалентности — иначе на плохой сессии сервис уйдёт в десятки вызовов LLM.
_MAX_EQUIVALENCE_CHECKS = 3
_MIN_EQUIVALENCE_CONFIDENCE = 0.6


class AnnotationService:
    def __init__(
        self,
        llm: LlmProvider,
        knowledge: KnowledgeBase | None = None,
        breaker: CircuitBreaker | None = None,
    ) -> None:
        self.llm = llm
        self.knowledge = knowledge
        self.breaker = breaker or CircuitBreaker()

    def annotate(
        self,
        assessment: RuleBasedAssessment,
        profile: ErrorProfile | None = None,
        state_after: dict[str, float] | None = None,
    ) -> AnnotatedAssessment:
        annotations: list[AiAnnotation] = []
        degraded = False

        # 1. Паттерны ошибок — детерминированно, LLM не нужна.
        annotations.extend(self._pattern_annotations(assessment, profile))

        # 2. Эквивалентные стратегии — здесь ИИ действительно нужен.
        if self.breaker.allows():
            for step in assessment.sequence.missed[:_MAX_EQUIVALENCE_CHECKS]:
                note = self._check_equivalence(step, assessment, state_after or {})
                if note is None:
                    degraded = True
                    break
                if note.confidence >= _MIN_EQUIVALENCE_CONFIDENCE:
                    annotations.append(note)
        else:
            degraded = True
            metrics.fallback(_RPC, "breaker_open")

        metrics.request(_RPC, "degraded" if degraded else "ok")
        return AnnotatedAssessment(
            assessment=assessment, annotations=annotations, degraded=degraded
        )

    # -- детерминированные аннотации ----------------------------------------

    def _pattern_annotations(
        self, assessment: RuleBasedAssessment, profile: ErrorProfile | None
    ) -> list[AiAnnotation]:
        notes: list[AiAnnotation] = []
        reaction = assessment.reaction

        # Реакция на алармы высокого приоритета медленнее, чем на низкий,
        # — типичный признак того, что оператор не считывает приоритет.
        high = [
            r.ack_delay_s
            for r in reaction.reactions
            if r.priority in {"HH", "H"} and r.ack_delay_s is not None
        ]
        low = [
            r.ack_delay_s
            for r in reaction.reactions
            if r.priority in {"L", "LL"} and r.ack_delay_s is not None
        ]
        if high and low and sum(high) / len(high) > sum(low) / len(low) * 1.5:
            notes.append(
                AiAnnotation(
                    kind="ERROR_PATTERN",
                    text=(
                        "На сигнализацию высокого приоритета оператор реагирует медленнее, "
                        "чем на низкоприоритетную. Вероятно, приоритет аларма не считывается "
                        "— стоит отработать чтение журнала алармов."
                    ),
                    confidence=0.8,
                )
            )

        ooo = assessment.sequence.out_of_order
        if len(ooo) >= 2:
            notes.append(
                AiAnnotation(
                    kind="ERROR_PATTERN",
                    text=(
                        f"Нарушена очерёдность {len(ooo)} шагов при том, что сами действия "
                        "выполнены верно. Оператор знает состав операций, но не соблюдает "
                        "регламентную последовательность."
                    ),
                    confidence=0.85,
                    related_steps=tuple(s.step for s in ooo),
                )
            )

        if profile and profile.sessions_analyzed >= 3:
            top = profile.top_categories(1)
            if top and profile.weights.get(top[0], 0) >= 0.35:
                notes.append(
                    AiAnnotation(
                        kind="COACHING_NOTE",
                        text=(
                            f"Категория «{top[0]}» составляет "
                            f"{profile.weights[top[0]] * 100:.0f} % ошибок за последние "
                            f"{profile.sessions_analyzed} сессий — рекомендуется сценарий "
                            "с акцентом на эту тему."
                        ),
                        confidence=0.75,
                    )
                )
        return notes

    # -- ИИ-аннотация -------------------------------------------------------

    def _check_equivalence(
        self,
        step: StepEvaluation,
        assessment: RuleBasedAssessment,
        state_after: dict[str, float],
    ) -> AiAnnotation | None:
        """Проверяет, достиг ли оператор цели пропущенного шага иначе.

        Возвращает None при отказе LLM — вызывающий код помечает результат
        как degraded, но оценка остаётся в силе.
        """
        extra = assessment.sequence.extra
        if not extra:
            return AiAnnotation(
                kind="EQUIVALENT_STRATEGY",
                text="",
                confidence=0.0,
                related_steps=(step.step,),
            )

        rag_block = ""
        if self.knowledge is not None:
            hits = self.knowledge.search(f"{step.reference.target} регулирование", top_k=2)
            rag_block = "\n".join(f"[{c.source}] {c.text[:400]}" for c, _ in hits)

        prompt = EQUIVALENCE_PROMPT.format(
            missed_step=f"{step.reference.action} {step.reference.target} "
                        f"{step.reference.value if step.reference.value is not None else ''}",
            step_goal=step.reference.note or "цель не описана",
            extra_actions="\n".join(
                f"- t={a.action.model_time_s} с: {a.action.type} {a.action.target} "
                f"({a.action.value_from} -> {a.action.value_to})"
                for a in extra
            ),
            outcome_tags=", ".join(f"{k}={v:g}" for k, v in state_after.items()) or "нет данных",
            rag=rag_block or "нет данных",
        )

        try:
            raw = self.llm.generate(
                LlmRequest(
                    system=EQUIVALENCE_SYSTEM,
                    prompt=prompt,
                    temperature=0.2,
                    max_tokens=300,
                    json_mode=True,
                )
            )
            self.breaker.record_success()
        except LlmError as exc:
            self.breaker.record_failure()
            logger.warning("Аннотация: отказ LLM (%s)", exc)
            metrics.fallback(_RPC, "llm_error")
            return None

        try:
            payload = json.loads(_extract_json(raw))
            equivalent = bool(payload["equivalent"])
            explanation = _ensure_sentence(str(payload.get("explanation", "")))
            confidence = float(payload.get("confidence", 0.0))
        except (ValueError, KeyError, TypeError) as exc:
            logger.info("Аннотация: неразбираемый JSON (%s)", exc)
            metrics.reject("bad_json")
            return AiAnnotation(
                kind="EQUIVALENT_STRATEGY", text="", confidence=0.0, related_steps=(step.step,)
            )

        if not equivalent:
            return AiAnnotation(
                kind="EQUIVALENT_STRATEGY", text="", confidence=0.0, related_steps=(step.step,)
            )

        return AiAnnotation(
            kind="EQUIVALENT_STRATEGY",
            text=(
                f"Шаг {step.step} ({step.reference.action} {step.reference.target}) "
                f"формально не выполнен, но цель, возможно, достигнута иначе. {explanation} "
                "Решение о снятии штрафа принимает инструктор."
            ),
            confidence=max(0.0, min(1.0, confidence)),
            related_steps=(step.step,),
            # Предложение, а не применённая правка: балл меняет только инструктор.
            suggested_score_delta=abs(
                next(
                    (p.points for p in assessment.penalties if p.code == "MISSED_STEP"),
                    0,
                )
            ),
        )


def _ensure_sentence(text: str) -> str:
    """Дополняет фразу модели точкой, чтобы аннотация читалась связно."""
    text = text.strip()
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _extract_json(text: str) -> str:
    """Вырезает JSON-объект из ответа, если модель добавила текст вокруг."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return text
    return text[start : end + 1]
