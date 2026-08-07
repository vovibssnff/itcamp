"""Модели данных ИИ-модуля.

Реализованы на dataclasses (stdlib), чтобы ядро анализа запускалось
без внешних зависимостей — это требование к тестируемости и к работе
сервиса в деградированном режиме (FR-AI-01).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# --------------------------------------------------------------------------
# Вход: журнал сессии
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class OperatorAction:
    """Действие оператора. Соответствует сущности OperatorAction (§6.1 SRD)."""

    model_time_s: int
    type: str
    target: str
    value_from: float | None = None
    value_to: float | None = None
    action_id: str = ""
    server_time: str | None = None


@dataclass(frozen=True)
class AlarmEvent:
    """Событие сигнализации. Соответствует AlarmEvent (§6.1 SRD)."""

    tag_id: str
    priority: str
    raised_at_s: int
    value: float | None = None
    limit: float | None = None
    ack_at_s: int | None = None
    cleared_at_s: int | None = None
    alarm_id: str = ""


@dataclass(frozen=True)
class InterlockEvent:
    """Факт срабатывания блокировки ПАЗ в ходе сессии."""

    code: str
    tag_id: str
    at_s: int
    description: str = ""


# --------------------------------------------------------------------------
# Вход: эталон сценария
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ReferenceStep:
    """Эталонный шаг сценария (FR-SCEN-05, FR-ASSESS-02)."""

    step: int
    action: str
    target: str
    within_s: int | None = None
    value: float | None = None
    unit: str | None = None
    tolerance_pct: float = 10.0
    note: str = ""
    optional: bool = False


@dataclass(frozen=True)
class ForbiddenAction:
    """Запрещённое действие — основание для критической ошибки (FR-ASSESS-04)."""

    code: str
    action: str
    target: str
    description: str = ""
    regulation_ref: tuple[str, ...] = ()
    #: Условие по состоянию модели, при котором действие становится запрещённым.
    condition: str | None = None


@dataclass(frozen=True)
class PenaltyRule:
    code: str
    points: int
    note: str = ""


@dataclass
class ScenarioCriteria:
    """Критерии оценки сценария."""

    pass_score: int = 70
    ack_deadline_s: int = 60
    penalties: dict[str, PenaltyRule] = field(default_factory=dict)
    forbidden_actions: list[ForbiddenAction] = field(default_factory=list)


# --------------------------------------------------------------------------
# Выход: детерминированная оценка
# --------------------------------------------------------------------------


@dataclass
class StepEvaluation:
    step: int
    outcome: str
    reference: ReferenceStep
    matched_action: OperatorAction | None = None
    delay_s: int | None = None
    deadline_s: int | None = None


@dataclass
class ActionEvaluation:
    action: OperatorAction
    verdict: str
    forbidden_code: str | None = None
    description: str = ""


@dataclass
class AlarmReaction:
    tag_id: str
    priority: str
    raised_at_s: int
    ack_delay_s: int | None
    first_corrective_delay_s: int | None
    late: bool


@dataclass
class ReactionTimeReport:
    reactions: list[AlarmReaction] = field(default_factory=list)
    mean_ack_delay_s: float | None = None
    max_ack_delay_s: int | None = None
    late_count: int = 0
    unacked_count: int = 0


@dataclass
class SequenceReport:
    steps: list[StepEvaluation] = field(default_factory=list)
    actions: list[ActionEvaluation] = field(default_factory=list)

    @property
    def missed(self) -> list[StepEvaluation]:
        return [s for s in self.steps if s.outcome == "MISSED"]

    @property
    def late(self) -> list[StepEvaluation]:
        return [s for s in self.steps if s.outcome == "LATE"]

    @property
    def out_of_order(self) -> list[StepEvaluation]:
        return [s for s in self.steps if s.outcome == "OUT_OF_ORDER"]

    @property
    def forbidden(self) -> list[ActionEvaluation]:
        return [a for a in self.actions if a.verdict == "FORBIDDEN"]

    @property
    def extra(self) -> list[ActionEvaluation]:
        return [a for a in self.actions if a.verdict == "EXTRA"]


@dataclass
class Penalty:
    code: str
    points: int
    detail: str


@dataclass
class RuleBasedAssessment:
    """Авторитетная оценка. Считается только детерминированным кодом.

    ИИ не может изменить ни одно поле этого объекта (ARCH-02).
    """

    score: int
    passed: bool
    penalties: list[Penalty] = field(default_factory=list)
    critical_errors: list[Penalty] = field(default_factory=list)
    reaction: ReactionTimeReport = field(default_factory=ReactionTimeReport)
    sequence: SequenceReport = field(default_factory=SequenceReport)


# --------------------------------------------------------------------------
# Выход: ИИ-аннотация поверх оценки
# --------------------------------------------------------------------------


@dataclass
class AiAnnotation:
    """Совещательная пометка ИИ. На балл не влияет."""

    kind: str  # EQUIVALENT_STRATEGY | ERROR_PATTERN | COACHING_NOTE
    text: str
    confidence: float = 0.0
    related_steps: tuple[int, ...] = ()
    suggested_score_delta: int = 0  # предложение инструктору, не применяется


@dataclass
class AnnotatedAssessment:
    assessment: RuleBasedAssessment
    annotations: list[AiAnnotation] = field(default_factory=list)
    degraded: bool = False


# --------------------------------------------------------------------------
# Прочее
# --------------------------------------------------------------------------


@dataclass
class TagSeries:
    tag_id: str
    values: list[float]
    t0_s: int
    step_s: int
    unit: str = ""


@dataclass
class LimitDef:
    tag_id: str
    value: float
    limit_type: str  # H | HH | L | LL | INTERLOCK


@dataclass
class Prediction:
    tag_id: str
    current: float
    target_limit: float
    limit_type: str
    eta_s: int | None
    eta_ci_low_s: int | None
    eta_ci_high_s: int | None
    confidence: float
    trend: str
    rate_per_min: float


@dataclass
class Explanation:
    cause: str
    effect: str
    recommendation: str
    evidence_tags: list[str] = field(default_factory=list)
    regulation_refs: list[str] = field(default_factory=list)
    confidence: float = 0.0
    degraded: bool = False


@dataclass
class ChatAnswer:
    answer: str
    citations: list[dict[str, Any]] = field(default_factory=list)
    refused: bool = False
    refusal_reason: str = ""
    degraded: bool = False


@dataclass
class RiskAssessment:
    risk_level: str
    headline: str
    detail: str = ""
    regulation_refs: list[str] = field(default_factory=list)
    suggested_alternative: str = ""
    degraded: bool = False
