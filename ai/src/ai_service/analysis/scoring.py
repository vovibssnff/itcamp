"""Сборка авторитетной (rule-based) оценки сессии.

Единственный источник итогового балла. ИИ-модуль не имеет доступа на
запись к результату этой функции — см. ADR-001 в README: падение GPU-узла
не должно влиять ни на балл, ни на воспроизводимость протокола экзамена
(NFR-REL-03, ARCH-02).
"""
from __future__ import annotations

from ..domain.enums import StepOutcome
from ..domain.models import (
    InterlockEvent,
    Penalty,
    ReactionTimeReport,
    RuleBasedAssessment,
    ScenarioCriteria,
    SequenceReport,
)

#: Штрафы по умолчанию, если сценарий не задал свои.
DEFAULT_PENALTIES: dict[str, int] = {
    "LATE_ACK": -10,
    "NO_ACK": -15,
    "MISSED_STEP": -20,
    "OUT_OF_ORDER": -10,
    "LATE_STEP": -10,
    "INTERLOCK_FIRED": -30,
    "FORBIDDEN_ACTION": -40,
}

_MAX_SCORE = 100
_MIN_SCORE = 0


def _points(criteria: ScenarioCriteria, code: str) -> int:
    rule = criteria.penalties.get(code)
    if rule is not None:
        return rule.points
    return DEFAULT_PENALTIES.get(code, 0)


def build_assessment(
    reaction: ReactionTimeReport,
    sequence: SequenceReport,
    criteria: ScenarioCriteria,
    interlocks: list[InterlockEvent] | None = None,
) -> RuleBasedAssessment:
    """Считает итоговый балл по детерминированным правилам."""
    interlocks = interlocks or []
    penalties: list[Penalty] = []
    critical: list[Penalty] = []

    for r in reaction.reactions:
        if r.ack_delay_s is None:
            penalties.append(
                Penalty(
                    code="NO_ACK",
                    points=_points(criteria, "NO_ACK"),
                    detail=f"Аларм {r.tag_id} ({r.priority}) не квитирован",
                )
            )
        elif r.late:
            penalties.append(
                Penalty(
                    code="LATE_ACK",
                    points=_points(criteria, "LATE_ACK"),
                    detail=(
                        f"Квитирование {r.tag_id} через {r.ack_delay_s} с "
                        f"при нормативе {criteria.ack_deadline_s} с"
                    ),
                )
            )

    for s in sequence.steps:
        if s.reference.optional and s.outcome == StepOutcome.MISSED.value:
            continue
        if s.outcome == StepOutcome.MISSED.value:
            penalties.append(
                Penalty(
                    code="MISSED_STEP",
                    points=_points(criteria, "MISSED_STEP"),
                    detail=f"Шаг {s.step} не выполнен: {s.reference.action} {s.reference.target}",
                )
            )
        elif s.outcome == StepOutcome.OUT_OF_ORDER.value:
            penalties.append(
                Penalty(
                    code="OUT_OF_ORDER",
                    points=_points(criteria, "OUT_OF_ORDER"),
                    detail=f"Шаг {s.step} выполнен с нарушением очерёдности",
                )
            )
        elif s.outcome == StepOutcome.LATE.value:
            penalties.append(
                Penalty(
                    code="LATE_STEP",
                    points=_points(criteria, "LATE_STEP"),
                    detail=f"Шаг {s.step} выполнен с просрочкой {s.delay_s} с",
                )
            )

    for a in sequence.forbidden:
        critical.append(
            Penalty(
                code=a.forbidden_code or "FORBIDDEN_ACTION",
                points=_points(criteria, "FORBIDDEN_ACTION"),
                detail=a.description
                or f"Запрещённое действие: {a.action.type} {a.action.target}",
            )
        )

    for event in interlocks:
        penalties.append(
            Penalty(
                code="INTERLOCK_FIRED",
                points=_points(criteria, "INTERLOCK_FIRED"),
                detail=event.description
                or f"Сработала блокировка {event.code} по тегу {event.tag_id}",
            )
        )

    total = _MAX_SCORE + sum(p.points for p in penalties) + sum(p.points for p in critical)
    score = max(_MIN_SCORE, min(_MAX_SCORE, total))

    return RuleBasedAssessment(
        score=score,
        # Наличие критической ошибки — безусловный незачёт независимо от балла.
        passed=score >= criteria.pass_score and not critical,
        penalties=penalties,
        critical_errors=critical,
        reaction=reaction,
        sequence=sequence,
    )
