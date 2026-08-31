"""Модели данных sim-worker (Model API / матмодель L1).

На dataclasses (stdlib), как и в ai_service — детерминированное ядро
(physics/, faults/, engine/) должно запускаться и тестироваться без
внешних зависимостей, кроме numpy в интеграторе (см. README, ADR-СЕ-01).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .enums import CommandType, ControllerMode, LimitType

# --------------------------------------------------------------------------
# Статическое описание шаблона (из template_*.json)
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class LimitDef:
    tag_id: str
    limit_type: LimitType
    value: float
    note: str = ""
    #: для INTERLOCK — направление нарушения: "above" (>=) или "below" (<=).
    #: Для H/HH/L/LL направление фиксировано типом и не используется.
    direction: str = "above"


@dataclass(frozen=True)
class Tag:
    tag_id: str
    description: str
    unit: str
    kind: str
    equipment: str
    limits: tuple[LimitDef, ...] = ()


# --------------------------------------------------------------------------
# Динамическое состояние
# --------------------------------------------------------------------------


@dataclass
class AlarmEvent:
    """Активная сигнализация. Форма совместима с AlarmEvent ai_service."""

    tag_id: str
    priority: str  # L | LL | H | HH
    raised_at_s: float
    value: float
    limit: float
    ack_at_s: float | None = None
    cleared_at_s: float | None = None
    alarm_id: str = ""


@dataclass
class InterlockEvent:
    """Факт срабатывания блокировки ПАЗ (см. physics/interlocks.py)."""

    code: str
    tag_id: str
    at_s: float
    description: str = ""
    effects: tuple[str, ...] = ()


@dataclass(frozen=True)
class OperatorCommand:
    """Команда оператора. Форма совместима с OperatorAction ai_service —
    журнал, снятый с sim-сессии, идёт на ReviewSession без преобразования.
    """

    model_time_s: float
    type: str  # CommandType
    target: str
    value_from: float | None = None
    value_to: float | None = None
    action_id: str = ""

    @property
    def command_type(self) -> CommandType:
        return CommandType(self.type)


@dataclass
class ProcessState:
    """Полный снимок технологического состояния сессии."""

    model_time_s: float
    tag_values: dict[str, float] = field(default_factory=dict)
    equipment_states: dict[str, str] = field(default_factory=dict)
    controller_modes: dict[str, str] = field(default_factory=dict)
    # SP/OUT per controller tag — required by HMI faceplates (PV alone is not enough).
    controller_setpoints: dict[str, float] = field(default_factory=dict)
    controller_outputs: dict[str, float] = field(default_factory=dict)
    active_alarms: dict[str, AlarmEvent] = field(default_factory=dict)
    active_faults: list[str] = field(default_factory=list)
    tripped_interlocks: list[str] = field(default_factory=list)

    def snapshot(self) -> dict[str, Any]:
        return {
            "model_time_s": self.model_time_s,
            "tag_values": dict(self.tag_values),
            "equipment_states": dict(self.equipment_states),
            "controller_modes": dict(self.controller_modes),
            "controller_setpoints": dict(self.controller_setpoints),
            "controller_outputs": dict(self.controller_outputs),
            "active_alarms": {
                k: {
                    "tag_id": a.tag_id,
                    "priority": a.priority,
                    "raised_at_s": a.raised_at_s,
                    "value": a.value,
                    "limit": a.limit,
                    "ack_at_s": a.ack_at_s,
                }
                for k, a in self.active_alarms.items()
            },
            "active_faults": list(self.active_faults),
            "tripped_interlocks": list(self.tripped_interlocks),
        }


# --------------------------------------------------------------------------
# Неисправности
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class FaultEffect:
    """Одно возмущение физического параметра узла."""

    node_id: str
    param: str
    #: множитель (0.4 = «расход упал до 40 % от номинала») либо приращение —
    #: интерпретация зависит от параметра, см. faults/engine.py.
    mode: str  # MULTIPLY | ADD | SET
    target_value: float
    #: время выхода на полное значение возмущения, с (рампа, а не скачок).
    ramp_s: float = 0.0


@dataclass(frozen=True)
class FaultDef:
    fault_id: str
    docx_ref: str  # напр. "1.1"
    group: str
    title: str
    equipment: tuple[str, ...]
    early_signs: str
    stabilization_hint: str
    regulation_refs: tuple[str, ...]
    effects: tuple[FaultEffect, ...]


@dataclass
class FaultInstance:
    fault_def: FaultDef
    injected_at_s: float
    magnitude: float = 1.0
    active: bool = True


# --------------------------------------------------------------------------
# Результат тика
# --------------------------------------------------------------------------


@dataclass
class StepResult:
    state: ProcessState
    new_alarms: list[AlarmEvent] = field(default_factory=list)
    cleared_alarms: list[AlarmEvent] = field(default_factory=list)
    new_interlocks: list[InterlockEvent] = field(default_factory=list)


@dataclass
class ControllerParams:
    kp: float
    ki: float
    out_min: float
    out_max: float
    setpoint: float
    mode: ControllerMode = ControllerMode.AUTO
