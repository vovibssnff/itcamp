"""Сквозной разбор сессии: журнал → оценка → аннотация → разбор.

Это основной сценарий использования модуля по итогам сессии. Порядок
шагов принципиален: балл считается до того, как ИИ вообще вызывается,
поэтому отказ GPU-узла обрезает только текстовую часть результата.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..analysis.profile import ErrorProfile
from ..analysis.reaction_time import evaluate_reaction_times
from ..analysis.scoring import build_assessment
from ..analysis.sequence import compare_sequence
from ..domain.models import (
    AlarmEvent,
    AnnotatedAssessment,
    InterlockEvent,
    OperatorAction,
    ReferenceStep,
    ScenarioCriteria,
)
from ..services.annotate import AnnotationService
from ..services.debrief import DebriefService


@dataclass
class SessionReview:
    annotated: AnnotatedAssessment
    debrief_text: str
    degraded: bool


def review_session(
    *,
    actions: list[OperatorAction],
    alarms: list[AlarmEvent],
    reference: list[ReferenceStep],
    criteria: ScenarioCriteria,
    scenario_name: str,
    annotation_service: AnnotationService,
    debrief_service: DebriefService,
    interlocks: list[InterlockEvent] | None = None,
    deadline_base_s: int = 0,
    remediation_map: dict[str, set[str]] | None = None,
    profile: ErrorProfile | None = None,
    state_after: dict[str, float] | None = None,
    with_debrief: bool = True,
) -> SessionReview:
    # 1. Детерминированный слой — авторитетная оценка.
    reaction = evaluate_reaction_times(
        alarms,
        actions,
        ack_deadline_s=criteria.ack_deadline_s,
        remediation_map=remediation_map,
    )
    sequence = compare_sequence(
        reference,
        actions,
        deadline_base_s=deadline_base_s,
        forbidden_actions=criteria.forbidden_actions,
    )
    assessment = build_assessment(reaction, sequence, criteria, interlocks)

    # 2. ИИ-слой — только аннотации, балл уже зафиксирован.
    annotated = annotation_service.annotate(assessment, profile=profile, state_after=state_after)

    debrief_text, debrief_degraded = "", False
    if with_debrief:
        debrief_text, debrief_degraded = debrief_service.build(
            annotated, scenario_name, criteria.pass_score, profile
        )

    return SessionReview(
        annotated=annotated,
        debrief_text=debrief_text,
        degraded=annotated.degraded or debrief_degraded,
    )
