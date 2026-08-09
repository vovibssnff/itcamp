"""Сигнализации и блокировки ПАЗ — данные (пороги из шаблона), а не код.

``evaluate()`` сравнивает текущие значения тегов с их ``limits`` (H/HH/L/LL/
INTERLOCK, как в ai/data/tags_demo.json) и поднимает/снимает сигнализации.
При пересечении INTERLOCK применяется набор эффектов из ``INTERLOCK_EFFECTS``
— это единственное место в коде, которое «знает» физику блокировок описанных
в разд. 3/7.7 регламента и докс-сценариях (§4.1, §5.1 и т.д.); новый тег с
блокировкой добавляется правкой шаблона, а не этого модуля, если её эффект
укладывается в уже определённые действия (`cut_furnace_fuel`, `safe_hold`, …).
"""
from __future__ import annotations

import itertools
from collections.abc import Callable
from dataclasses import dataclass

from ..domain.models import AlarmEvent, InterlockEvent, LimitDef, Tag
from .network import Network

_alarm_seq = itertools.count(1)


def _breached(value: float, limit: LimitDef) -> bool:
    if limit.limit_type.value in ("H", "HH"):
        return value >= limit.value
    if limit.limit_type.value in ("L", "LL"):
        return value <= limit.value
    # INTERLOCK: направление задаётся знаком в note-metadata через отдельное
    # поле direction, см. Tag.limits в bootstrap.py (_direction_of).
    return False


def _interlock_breached(value: float, limit: LimitDef, direction: str) -> bool:
    if direction == "above":
        return value >= limit.value
    return value <= limit.value


# ---------------------------------------------------------------------- эффекты

def _cut_furnace_fuel(network: Network) -> tuple[str, ...]:
    applied = []
    for f in network.furnaces.values():
        f.fuel.force_output(0.0)
        applied.append(f"{f.fuel.tag_id}=0")
    return tuple(applied)


def _cut_k2_steam(network: Network) -> tuple[str, ...]:
    if "FRC 421" in network.assists:
        network.assists["FRC 421"].set_value(0.0)
        return ("FRC 421=0",)
    return ()


def _safe_hold(tag_id: str) -> Callable[[Network], tuple[str, ...]]:
    def _apply(network: Network) -> tuple[str, ...]:
        loop = network.loops.get(tag_id)
        if loop is None:
            return ()
        loop.force_output(loop.out_max)
        return (f"{tag_id}: safe-hold output={loop.out_max}",)

    return _apply


def _elou_voltage_trip(tag_id: str) -> Callable[[Network], tuple[str, ...]]:
    def _apply(network: Network) -> tuple[str, ...]:
        loop = network.loops.get(tag_id)
        if loop is None:
            return ()
        loop.force_output(loop.out_max)
        return (f"{tag_id}: снято напряжение ИПМ, дренаж остановлен",)

    return _apply


def _k4_relief(network: Network) -> tuple[str, ...]:
    applied = []
    for tag_id in ("TRC 5", "FR 415", "PRCA 223"):
        assist = network.assists.get(tag_id)
        if assist is None:
            continue
        assist.set_value(assist.lo if tag_id != "PRCA 223" else assist.hi)
        applied.append(f"{tag_id}={assist.current}")
    return tuple(applied)


def _catalyst_cooldown(network: Network) -> tuple[str, ...]:
    loop = network.loops.get("TR 1011")
    if loop is None:
        return ()
    loop.force_output(loop.out_min)
    return ("TR 1011: тепловая нагрузка снята",)


def _ia_failsafe(network: Network) -> tuple[str, ...]:
    return _cut_furnace_fuel(network)


INTERLOCK_EFFECTS: dict[str, Callable[[Network], tuple[str, ...]]] = {
    "PRSA 204": lambda n: _cut_furnace_fuel(n) + _cut_k2_steam(n),
    "PRSA 213": lambda n: _cut_furnace_fuel(n) + _cut_k2_steam(n),
    "LRCA 641": _elou_voltage_trip("LRCA 641"),
    "LRCA 640": _elou_voltage_trip("LRCA 640"),
    "LRCA 639": _elou_voltage_trip("LRCA 639"),
    "LRCA 606": _safe_hold("LRCA 606"),
    "LRCA 4002-1": _safe_hold("LRCA 4002-1"),
    "PRCA 220": _k4_relief,
    "TR 1011": _catalyst_cooldown,
}

#: (насос) -> (тег-датчик, direction, порог): пуск запрещён, если порог нарушен.
STARTUP_GUARDS: dict[str, tuple[str, str, float]] = {
    "PUMP-N4": ("LRCA 604", "below", 15.0),
}

#: (насос) -> (тег-датчик, direction, порог): работающий насос немедленно
#: останавливается при нарушении порога (в отличие от штатного запрета пуска).
TRIP_GUARDS: dict[str, tuple[str, str, float]] = {
    "PUMP-N6": ("LRCSA 603", "below", 15.0),
}


@dataclass
class InterlockState:
    """Состояние сигнализаций/блокировок между тиками (для evaluate())."""

    active_alarms: dict[str, AlarmEvent]
    tripped: set[str]


def evaluate(
    tags: dict[str, Tag],
    values: dict[str, float],
    state: InterlockState,
    model_time_s: float,
    network: Network,
    ia_buffer_tripped_before: bool,
) -> tuple[list[AlarmEvent], list[AlarmEvent], list[InterlockEvent]]:
    new_alarms: list[AlarmEvent] = []
    cleared_alarms: list[AlarmEvent] = []
    new_interlocks: list[InterlockEvent] = []

    for tag_id, tag in tags.items():
        value = values.get(tag_id)
        if value is None:
            continue
        for limit in tag.limits:
            key = f"{tag_id}:{limit.limit_type.value}"
            if limit.limit_type.value == "INTERLOCK":
                direction = getattr(limit, "direction", "above")
                breached = _interlock_breached(value, limit, direction)
                if breached and key not in state.tripped:
                    state.tripped.add(key)
                    effects_fn = INTERLOCK_EFFECTS.get(tag_id)
                    effects = effects_fn(network) if effects_fn else ()
                    new_interlocks.append(
                        InterlockEvent(
                            code=key,
                            tag_id=tag_id,
                            at_s=model_time_s,
                            description=limit.note,
                            effects=effects,
                        )
                    )
                elif not breached and key in state.tripped:
                    state.tripped.discard(key)
                continue

            breached = _breached(value, limit)
            if breached and key not in state.active_alarms:
                alarm = AlarmEvent(
                    tag_id=tag_id,
                    priority=limit.limit_type.value,
                    raised_at_s=model_time_s,
                    value=value,
                    limit=limit.value,
                    alarm_id=f"AL-{next(_alarm_seq)}",
                )
                state.active_alarms[key] = alarm
                new_alarms.append(alarm)
            elif not breached and key in state.active_alarms:
                alarm = state.active_alarms.pop(key)
                alarm.cleared_at_s = model_time_s
                cleared_alarms.append(alarm)

    if network.ia_buffer.remaining_s <= 0.0 and not ia_buffer_tripped_before:
        effects = _ia_failsafe(network)
        new_interlocks.append(
            InterlockEvent(
                code="IA_FAILSAFE",
                tag_id=network.ia_buffer.tag_id,
                at_s=model_time_s,
                description="Запас воздуха КИП исчерпан: отсекатели топлива закрыты",
                effects=effects,
            )
        )

    return new_alarms, cleared_alarms, new_interlocks


def check_start_guard(pump_tag: str, values: dict[str, float]) -> str | None:
    guard = STARTUP_GUARDS.get(pump_tag)
    if guard is None:
        return None
    tag_id, direction, threshold = guard
    value = values.get(tag_id)
    if value is None:
        return None
    blocked = value <= threshold if direction == "below" else value >= threshold
    if blocked:
        op = "<=" if direction == "below" else ">="
        return f"Пуск {pump_tag} запрещён: {tag_id} {op} {threshold}"
    return None


def apply_trip_guards(values: dict[str, float], network: Network) -> list[str]:
    tripped = []
    for pump_tag, (tag_id, direction, threshold) in TRIP_GUARDS.items():
        value = values.get(tag_id)
        if value is None:
            continue
        breach = value <= threshold if direction == "below" else value >= threshold
        if breach:
            pump = network.pump_by_tag(pump_tag)
            if pump.state.value == "RUNNING":
                pump.trip()
                tripped.append(pump_tag)
    return tripped
