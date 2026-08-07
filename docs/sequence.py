"""Сравнение последовательности команд оператора с эталоном (FR-ASSESS-02).

Алгоритм детерминированный. Идея: эталон и журнал действий выравниваются
как две последовательности (LCS), что позволяет отличить три разных
ситуации, которые наивное сравнение «шаг за шагом» смешивает в одну:

* шаг выполнен вовремя и в правильном порядке;
* шаг выполнен, но не на своём месте (OUT_OF_ORDER) — оператор знает, что
  делать, но нарушает регламентную очерёдность;
* шаг не выполнен вовсе (MISSED).

Различать их важно: нарушение очерёдности на реальном объекте и пропуск
шага — ошибки разной тяжести.
"""
from __future__ import annotations

from ..domain.enums import ActionType, ActionVerdict, StepOutcome
from ..domain.models import (
    ActionEvaluation,
    ForbiddenAction,
    OperatorAction,
    ReferenceStep,
    SequenceReport,
    StepEvaluation,
)
from .normalize import same_target

#: Шаги этого типа проверяют состояние модели, а не действие оператора,
#: поэтому в выравнивании последовательности не участвуют.
_NON_ACTION_STEPS = {ActionType.VERIFY.value}

#: Минимальный абсолютный допуск на уставку, когда целевое значение близко к нулю.
_MIN_ABS_TOLERANCE = 1e-6


def step_matches(step: ReferenceStep, action: OperatorAction) -> bool:
    """Соответствует ли действие оператора эталонному шагу."""
    if step.action != action.type:
        return False
    if not same_target(step.target, action.target):
        return False
    if step.value is None:
        return True
    if action.value_to is None:
        return False
    tolerance = max(abs(step.value) * step.tolerance_pct / 100.0, _MIN_ABS_TOLERANCE)
    return abs(action.value_to - step.value) <= tolerance


def _lcs_alignment(
    steps: list[ReferenceStep], actions: list[OperatorAction]
) -> dict[int, int]:
    """Наибольшая общая подпоследовательность шагов и действий.

    Возвращает отображение «индекс шага -> индекс действия» для шагов,
    выполненных в правильном относительном порядке.
    """
    n, m = len(steps), len(actions)
    # dp[i][j] — длина LCS для первых i шагов и первых j действий.
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if step_matches(steps[i - 1], actions[j - 1]):
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    alignment: dict[int, int] = {}
    i, j = n, m
    while i > 0 and j > 0:
        if step_matches(steps[i - 1], actions[j - 1]) and dp[i][j] == dp[i - 1][j - 1] + 1:
            alignment[i - 1] = j - 1
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return alignment


def _classify_forbidden(
    action: OperatorAction, forbidden: list[ForbiddenAction]
) -> ForbiddenAction | None:
    for rule in forbidden:
        if rule.action and rule.action != action.type:
            continue
        if rule.target and not same_target(rule.target, action.target):
            continue
        return rule
    return None


def compare_sequence(
    reference: list[ReferenceStep],
    actions: list[OperatorAction],
    deadline_base_s: int = 0,
    forbidden_actions: list[ForbiddenAction] | None = None,
) -> SequenceReport:
    """Сопоставляет журнал действий оператора с эталоном сценария.

    :param deadline_base_s: модельное время, от которого отсчитываются
        дедлайны ``within_s`` эталонных шагов (обычно — момент срабатывания
        первой неисправности, а не начало сессии).
    """
    forbidden_actions = forbidden_actions or []
    ordered_actions = sorted(actions, key=lambda a: a.model_time_s)
    action_steps = [s for s in reference if s.action not in _NON_ACTION_STEPS]
    action_steps.sort(key=lambda s: s.step)

    alignment = _lcs_alignment(action_steps, ordered_actions)
    used_action_idx: set[int] = set(alignment.values())

    step_evals: list[StepEvaluation] = []
    for idx, step in enumerate(action_steps):
        deadline = deadline_base_s + step.within_s if step.within_s is not None else None

        if idx in alignment:
            action = ordered_actions[alignment[idx]]
            if deadline is not None and action.model_time_s > deadline:
                outcome = StepOutcome.LATE
                delay = action.model_time_s - deadline
            else:
                outcome = StepOutcome.ON_TIME
                delay = None
            step_evals.append(
                StepEvaluation(
                    step=step.step,
                    outcome=outcome.value,
                    reference=step,
                    matched_action=action,
                    delay_s=delay,
                    deadline_s=deadline,
                )
            )
            continue

        # Шага нет в согласованном выравнивании: либо он выполнен не по порядку,
        # либо не выполнен совсем.
        off_order = next(
            (
                k
                for k, action in enumerate(ordered_actions)
                if k not in used_action_idx and step_matches(step, action)
            ),
            None,
        )
        if off_order is not None:
            used_action_idx.add(off_order)
            action = ordered_actions[off_order]
            step_evals.append(
                StepEvaluation(
                    step=step.step,
                    outcome=StepOutcome.OUT_OF_ORDER.value,
                    reference=step,
                    matched_action=action,
                    delay_s=(
                        action.model_time_s - deadline
                        if deadline is not None and action.model_time_s > deadline
                        else None
                    ),
                    deadline_s=deadline,
                )
            )
        else:
            step_evals.append(
                StepEvaluation(
                    step=step.step,
                    outcome=StepOutcome.MISSED.value,
                    reference=step,
                    deadline_s=deadline,
                )
            )

    action_evals: list[ActionEvaluation] = []
    for k, action in enumerate(ordered_actions):
        rule = _classify_forbidden(action, forbidden_actions)
        if rule is not None:
            action_evals.append(
                ActionEvaluation(
                    action=action,
                    verdict=ActionVerdict.FORBIDDEN.value,
                    forbidden_code=rule.code,
                    description=rule.description,
                )
            )
        elif k in used_action_idx:
            action_evals.append(
                ActionEvaluation(action=action, verdict=ActionVerdict.MATCHED.value)
            )
        else:
            action_evals.append(
                ActionEvaluation(action=action, verdict=ActionVerdict.EXTRA.value)
            )

    step_evals.sort(key=lambda s: s.step)
    return SequenceReport(steps=step_evals, actions=action_evals)
