"""Профиль ошибок обучаемого — вход для адаптивных сценариев (FR-AI-05)."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from ..domain.models import RuleBasedAssessment

#: Соответствие кодов штрафов методическим категориям ошибок.
CATEGORY_MAP: dict[str, str] = {
    "LATE_ACK": "late_alarm_response",
    "NO_ACK": "late_alarm_response",
    "MISSED_STEP": "incomplete_procedure",
    "OUT_OF_ORDER": "procedure_order",
    "LATE_STEP": "slow_execution",
    "INTERLOCK_FIRED": "regime_control",
    "FORBIDDEN_ACTION": "safety_violation",
}


@dataclass
class ErrorProfile:
    """Агрегированный профиль ошибок. Содержит только псевдоним (FR-AI-07)."""

    operator_pseudo_id: str
    sessions_analyzed: int = 0
    categories: dict[str, int] = field(default_factory=dict)
    weights: dict[str, float] = field(default_factory=dict)
    avg_score: float = 0.0
    avg_ack_delay_s: float | None = None
    critical_error_codes: dict[str, int] = field(default_factory=dict)

    def top_categories(self, n: int = 3) -> list[str]:
        return [c for c, _ in sorted(self.weights.items(), key=lambda kv: -kv[1])[:n]]


def build_profile(
    operator_pseudo_id: str, assessments: list[RuleBasedAssessment]
) -> ErrorProfile:
    """Строит профиль ошибок по истории оценок обучаемого."""
    if not assessments:
        return ErrorProfile(operator_pseudo_id=operator_pseudo_id)

    counter: Counter[str] = Counter()
    critical: Counter[str] = Counter()
    delays: list[float] = []

    for a in assessments:
        for p in a.penalties:
            counter[CATEGORY_MAP.get(p.code, p.code.lower())] += 1
        for c in a.critical_errors:
            critical[c.code] += 1
            counter["safety_violation"] += 1
        if a.reaction.mean_ack_delay_s is not None:
            delays.append(a.reaction.mean_ack_delay_s)

    total = sum(counter.values())
    weights = {k: round(v / total, 3) for k, v in counter.items()} if total else {}

    return ErrorProfile(
        operator_pseudo_id=operator_pseudo_id,
        sessions_analyzed=len(assessments),
        categories=dict(counter),
        weights=weights,
        avg_score=round(sum(a.score for a in assessments) / len(assessments), 1),
        avg_ack_delay_s=round(sum(delays) / len(delays), 1) if delays else None,
        critical_error_codes=dict(critical),
    )
