"""Преобразование JSON-запросов в объекты предметной области."""
from __future__ import annotations

from typing import Any

from ..domain.models import (
    AlarmEvent,
    ForbiddenAction,
    InterlockEvent,
    LimitDef,
    OperatorAction,
    PenaltyRule,
    ReferenceStep,
    ScenarioCriteria,
    TagSeries,
)


def to_action(raw: dict[str, Any]) -> OperatorAction:
    return OperatorAction(
        model_time_s=int(raw["model_time_s"]),
        type=str(raw["type"]),
        target=str(raw["target"]),
        value_from=_opt_float(raw.get("value_from")),
        value_to=_opt_float(raw.get("value_to")),
        action_id=str(raw.get("action_id", "")),
        server_time=raw.get("server_time"),
    )


def to_alarm(raw: dict[str, Any]) -> AlarmEvent:
    return AlarmEvent(
        tag_id=str(raw["tag_id"]),
        priority=str(raw.get("priority", "H")),
        raised_at_s=int(raw["raised_at_s"]),
        value=_opt_float(raw.get("value")),
        limit=_opt_float(raw.get("limit")),
        ack_at_s=_opt_int(raw.get("ack_at_s")),
        cleared_at_s=_opt_int(raw.get("cleared_at_s")),
        alarm_id=str(raw.get("alarm_id", "")),
    )


def to_step(raw: dict[str, Any]) -> ReferenceStep:
    return ReferenceStep(
        step=int(raw["step"]),
        action=str(raw["action"]),
        target=str(raw["target"]),
        within_s=_opt_int(raw.get("within_s")),
        value=_opt_float(raw.get("value")),
        unit=raw.get("unit"),
        tolerance_pct=float(raw.get("tolerance_pct", 10.0)),
        note=str(raw.get("note", "")),
        optional=bool(raw.get("optional", False)),
    )


def to_criteria(raw: dict[str, Any] | None) -> ScenarioCriteria:
    raw = raw or {}
    penalties = {
        code: PenaltyRule(code=code, points=int(points))
        for code, points in (raw.get("penalties") or {}).items()
    }
    forbidden = [
        ForbiddenAction(
            code=str(f["code"]),
            action=str(f.get("action", "")),
            target=str(f.get("target", "")),
            description=str(f.get("description", "")),
            regulation_ref=tuple(f.get("regulation_ref", ())),
            condition=f.get("condition"),
        )
        for f in (raw.get("forbidden_actions") or [])
    ]
    return ScenarioCriteria(
        pass_score=int(raw.get("pass_score", 70)),
        ack_deadline_s=int(raw.get("ack_deadline_s", 60)),
        penalties=penalties,
        forbidden_actions=forbidden,
    )


def to_series(raw: dict[str, Any]) -> TagSeries:
    return TagSeries(
        tag_id=str(raw["tag_id"]),
        values=[float(v) for v in raw.get("values", [])],
        t0_s=int(raw.get("t0_s", 0)),
        step_s=int(raw.get("step_s", 5)),
        unit=str(raw.get("unit", "")),
    )


def to_limit(raw: dict[str, Any]) -> LimitDef:
    return LimitDef(
        tag_id=str(raw["tag_id"]),
        value=float(raw["value"]),
        limit_type=str(raw.get("limit_type", "H")),
    )


def to_interlock(raw: dict[str, Any]) -> InterlockEvent:
    return InterlockEvent(
        code=str(raw["code"]),
        tag_id=str(raw.get("tag_id", "")),
        at_s=int(raw.get("at_s", 0)),
        description=str(raw.get("description", "")),
    )


def _opt_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _opt_int(value: Any) -> int | None:
    return None if value is None else int(value)
