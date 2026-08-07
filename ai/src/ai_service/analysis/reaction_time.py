"""Оценка времени реакции оператора на сигнализацию (FR-ASSESS-01).

Полностью детерминированный расчёт: разность модельных меток времени.
ИИ здесь не участвует — иначе оценка перестала бы быть воспроизводимой,
а протокол экзамена с HMAC-подписью потерял бы смысл.
"""
from __future__ import annotations

from statistics import mean

from ..domain.enums import ActionType, CORRECTIVE_ACTIONS
from ..domain.models import AlarmEvent, AlarmReaction, OperatorAction, ReactionTimeReport
from .normalize import same_target

_CORRECTIVE = {a.value for a in CORRECTIVE_ACTIONS}


def _first_ack(alarm: AlarmEvent, actions: list[OperatorAction]) -> int | None:
    """Модельное время первого квитирования данного аларма."""
    for action in actions:
        if action.model_time_s < alarm.raised_at_s:
            continue
        if action.type != ActionType.ACK_ALARM.value:
            continue
        if same_target(action.target, alarm.tag_id):
            return action.model_time_s
    return None


def _first_corrective(
    alarm: AlarmEvent,
    actions: list[OperatorAction],
    related_targets: set[str],
) -> int | None:
    """Первое корректирующее действие по аларму или связанному с ним контуру.

    ``related_targets`` задаётся картой ремедиации сценария: какие теги
    считаются относящимися к устранению именно этого аларма. Если карта
    пуста, засчитывается любое корректирующее действие после аларма.
    """
    for action in actions:
        if action.model_time_s < alarm.raised_at_s:
            continue
        if action.type not in _CORRECTIVE:
            continue
        if not related_targets:
            return action.model_time_s
        if any(same_target(action.target, t) for t in related_targets):
            return action.model_time_s
    return None


def evaluate_reaction_times(
    alarms: list[AlarmEvent],
    actions: list[OperatorAction],
    ack_deadline_s: int = 60,
    remediation_map: dict[str, set[str]] | None = None,
) -> ReactionTimeReport:
    """Строит отчёт о времени реакции по всем алармам сессии.

    :param ack_deadline_s: норматив квитирования; превышение помечает реакцию
        как просроченную (основание для штрафа LATE_ACK).
    :param remediation_map: tag_id аларма -> множество тегов, воздействие на
        которые считается устранением причины.
    """
    remediation_map = remediation_map or {}
    ordered = sorted(actions, key=lambda a: a.model_time_s)
    reactions: list[AlarmReaction] = []

    for alarm in sorted(alarms, key=lambda a: a.raised_at_s):
        ack_at = alarm.ack_at_s if alarm.ack_at_s is not None else _first_ack(alarm, ordered)
        ack_delay = ack_at - alarm.raised_at_s if ack_at is not None else None

        related = remediation_map.get(alarm.tag_id) or remediation_map.get(
            alarm.tag_id.replace("-", " ")
        )
        corrective_at = _first_corrective(alarm, ordered, related or set())
        corrective_delay = (
            corrective_at - alarm.raised_at_s if corrective_at is not None else None
        )

        reactions.append(
            AlarmReaction(
                tag_id=alarm.tag_id,
                priority=alarm.priority,
                raised_at_s=alarm.raised_at_s,
                ack_delay_s=ack_delay,
                first_corrective_delay_s=corrective_delay,
                late=ack_delay is None or ack_delay > ack_deadline_s,
            )
        )

    delays = [r.ack_delay_s for r in reactions if r.ack_delay_s is not None]
    return ReactionTimeReport(
        reactions=reactions,
        mean_ack_delay_s=round(mean(delays), 1) if delays else None,
        max_ack_delay_s=max(delays) if delays else None,
        late_count=sum(1 for r in reactions if r.late),
        unacked_count=sum(1 for r in reactions if r.ack_delay_s is None),
    )
