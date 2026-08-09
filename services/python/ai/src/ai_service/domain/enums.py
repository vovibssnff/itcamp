"""Перечисления предметной области ИИ-модуля КТК."""
from enum import Enum


class ActionType(str, Enum):
    """Типы действий оператора (совместимо с OperatorAction, §6.1 SRD)."""

    ACK_ALARM = "ACK_ALARM"
    SET_SP = "SET_SP"
    SET_MODE = "SET_MODE"
    SET_OUT = "SET_OUT"
    START = "START"
    STOP = "STOP"
    OPEN = "OPEN"
    CLOSE = "CLOSE"
    ESD = "ESD"
    VERIFY = "VERIFY"  # только в эталоне: проверка параметра, не действие оператора


#: Действия, которые считаются корректирующим вмешательством в режим.
CORRECTIVE_ACTIONS = frozenset(
    {
        ActionType.SET_SP,
        ActionType.SET_MODE,
        ActionType.SET_OUT,
        ActionType.START,
        ActionType.STOP,
        ActionType.OPEN,
        ActionType.CLOSE,
        ActionType.ESD,
    }
)


class StepOutcome(str, Enum):
    """Результат сопоставления эталонного шага с журналом действий."""

    ON_TIME = "ON_TIME"
    LATE = "LATE"
    OUT_OF_ORDER = "OUT_OF_ORDER"
    MISSED = "MISSED"


class ActionVerdict(str, Enum):
    """Классификация действия оператора, не попавшего в эталон."""

    MATCHED = "MATCHED"
    EXTRA = "EXTRA"
    FORBIDDEN = "FORBIDDEN"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SessionMode(str, Enum):
    TRAINING = "TRAINING"
    SELF_STUDY = "SELF_STUDY"
    EXAM = "EXAM"
    DEMO = "DEMO"


class AlarmPriority(str, Enum):
    L = "L"
    LL = "LL"
    H = "H"
    HH = "HH"
