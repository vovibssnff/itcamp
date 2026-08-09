"""Predict-behaviour: оценка риска действия оператора (FR-AI-04).

Уровень риска определяется детерминированным правиловым движком по
каталогу опасных действий, извлечённому из регламента. LLM привлекается
только для словесной формулировки при высоком риске — и её отказ не мешает
выдать предупреждение, потому что заголовок берётся из правила.

Интерфейс ``RiskModel`` оставлен для замены правил на обученный
классификатор без изменения вызывающего кода.
"""
from __future__ import annotations

import abc
import logging
from dataclasses import dataclass, field

from ..analysis.normalize import same_target
from ..domain.enums import RiskLevel, SessionMode
from ..domain.models import OperatorAction, RiskAssessment
from ..llm.base import LlmError, LlmProvider, LlmRequest
from ..observability import metrics
from ..prompts.templates import BEHAVIOUR_PROMPT, BEHAVIOUR_SYSTEM

logger = logging.getLogger(__name__)

_RPC = "predict_behaviour"


@dataclass
class RiskRule:
    """Правило опасного действия, привязанное к пункту регламента."""

    code: str
    risk: str
    headline: str
    regulation_refs: tuple[str, ...] = ()
    alternative: str = ""
    action_types: tuple[str, ...] = ()
    targets: tuple[str, ...] = ()
    #: Порог по новому значению уставки: (оператор, значение).
    value_below: float | None = None
    value_above: float | None = None
    #: Относительное изменение, доля (0.5 = снижение вдвое).
    relative_drop: float | None = None
    #: Дополнительное условие по состоянию модели: тег -> (оператор, порог).
    state_condition: tuple[str, str, float] | None = None

    def matches(self, action: OperatorAction, state: dict[str, float]) -> bool:
        if self.action_types and action.type not in self.action_types:
            return False
        if self.targets and not any(same_target(t, action.target) for t in self.targets):
            return False
        if self.value_below is not None:
            if action.value_to is None or action.value_to >= self.value_below:
                return False
        if self.value_above is not None:
            if action.value_to is None or action.value_to <= self.value_above:
                return False
        if self.relative_drop is not None:
            if action.value_from is None or action.value_to is None or action.value_from == 0:
                return False
            if action.value_to / action.value_from > (1 - self.relative_drop):
                return False
        if self.state_condition is not None:
            tag, op, threshold = self.state_condition
            value = state.get(tag)
            if value is None:
                return False
            if op == "<" and not value < threshold:
                return False
            if op == ">" and not value > threshold:
                return False
        return True


class RiskModel(abc.ABC):
    """Контракт модели оценки риска (правила сегодня, ML завтра)."""

    @abc.abstractmethod
    def assess(
        self, action: OperatorAction, state: dict[str, float]
    ) -> tuple[str, RiskRule | None, list[str]]:
        """Возвращает (уровень риска, сработавшее правило, значимые признаки)."""


class RuleBasedRiskModel(RiskModel):
    _ORDER = {
        RiskLevel.LOW.value: 0,
        RiskLevel.MEDIUM.value: 1,
        RiskLevel.HIGH.value: 2,
        RiskLevel.CRITICAL.value: 3,
    }

    def __init__(self, rules: list[RiskRule]) -> None:
        self.rules = rules

    def assess(self, action, state):
        best: RiskRule | None = None
        for rule in self.rules:
            if not rule.matches(action, state):
                continue
            if best is None or self._ORDER[rule.risk] > self._ORDER[best.risk]:
                best = rule
        if best is None:
            return RiskLevel.LOW.value, None, []
        features = [f"правило {best.code}", f"действие {action.type} на {action.target}"]
        return best.risk, best, features


@dataclass
class BehaviourService:
    model: RiskModel
    llm: LlmProvider | None = None
    #: Формулировать текст через LLM начиная с этого уровня.
    verbalize_from: str = RiskLevel.HIGH.value
    _order: dict[str, int] = field(
        default_factory=lambda: {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 1,
            RiskLevel.HIGH.value: 2,
            RiskLevel.CRITICAL.value: 3,
        },
        repr=False,
    )

    def assess(
        self,
        action: OperatorAction,
        state: dict[str, float] | None = None,
        session_mode: str = SessionMode.TRAINING.value,
    ) -> RiskAssessment:
        risk, rule, features = self.model.assess(action, state or {})

        if rule is None:
            metrics.request(_RPC, "ok")
            return RiskAssessment(risk_level=risk, headline="", detail="")

        result = RiskAssessment(
            risk_level=risk,
            headline=rule.headline,
            regulation_refs=list(rule.regulation_refs),
            suggested_alternative=rule.alternative,
        )

        needs_text = self._order[risk] >= self._order[self.verbalize_from]
        if needs_text and self.llm is not None:
            try:
                result.detail = self.llm.generate(
                    LlmRequest(
                        system=BEHAVIOUR_SYSTEM,
                        prompt=BEHAVIOUR_PROMPT.format(
                            action_type=action.type,
                            target=action.target,
                            value_from=action.value_from,
                            value_to=action.value_to,
                            risk_level=risk,
                            features=", ".join(features),
                            rule=rule.headline,
                        ),
                        temperature=0.1,
                        max_tokens=120,
                    )
                ).strip()
            except LlmError as exc:
                # Заголовок правила уже несёт суть предупреждения,
                # поэтому отказ LLM не лишает оператора информации.
                logger.info("Behaviour: LLM недоступна (%s), выдаю правило без пояснения", exc)
                metrics.fallback(_RPC, "llm_error")
                result.degraded = True

        metrics.request(_RPC, "ok")
        return result

    def visible_to_operator(self, result: RiskAssessment, session_mode: str) -> bool:
        """В экзамене подсказка не показывается (FR-AI-06)."""
        if session_mode == SessionMode.EXAM.value:
            return False
        return self._order[result.risk_level] >= self._order[RiskLevel.HIGH.value]
