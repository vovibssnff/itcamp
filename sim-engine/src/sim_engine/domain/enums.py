"""Перечисления доменной модели sim-worker."""
from __future__ import annotations

from enum import Enum


class LimitType(str, Enum):
    L = "L"
    LL = "LL"
    H = "H"
    HH = "HH"
    INTERLOCK = "INTERLOCK"


class AlarmPriority(str, Enum):
    L = "L"
    LL = "LL"
    H = "H"
    HH = "HH"


class EquipmentState(str, Enum):
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"
    TRIPPED = "TRIPPED"


class ControllerMode(str, Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"


class CommandType(str, Enum):
    """Совпадает по набору значений с типами OperatorAction в ai_service."""

    SET_SP = "SET_SP"
    SET_MODE = "SET_MODE"
    SET_OUT = "SET_OUT"
    ACK_ALARM = "ACK_ALARM"
    START = "START"
    STOP = "STOP"
    OPEN = "OPEN"
    CLOSE = "CLOSE"
    ESD = "ESD"


class SessionMode(str, Enum):
    TRAINING = "TRAINING"
    SELF_STUDY = "SELF_STUDY"
    EXAM = "EXAM"
    DEMO = "DEMO"
