"""Predict-physics: прогноз выхода параметра на уставку (FR-AI-03).

Реализовано на взвешенной линейной регрессии по окну тренда — без LLM.
Экстраполяция тренда не требует языковой модели, зато требует
воспроизводимости: один и тот же тренд обязан давать один и тот же прогноз.
"""
from __future__ import annotations

import math

from ..domain.models import LimitDef, Prediction, TagSeries
from ..observability import metrics

_RPC = "predict_physics"

#: Минимум точек для оценки тренда.
_MIN_POINTS = 4
#: Прогноз не показывается оператору при уверенности ниже порога.
_MIN_CONFIDENCE = 0.6
#: Горизонт прогноза по умолчанию, с модельного времени.
_DEFAULT_HORIZON_S = 300


def _linear_fit(values: list[float], step_s: int) -> tuple[float, float, float]:
    """Возвращает (наклон в ед/с, свободный член, R²).

    Точки взвешены линейно — свежие важнее: процесс нестационарный, и
    поведение параметра минуту назад информативнее, чем пять минут назад.
    """
    n = len(values)
    xs = [i * step_s for i in range(n)]
    weights = [(i + 1) / n for i in range(n)]
    w_sum = sum(weights)

    mean_x = sum(w * x for w, x in zip(weights, xs, strict=False)) / w_sum
    mean_y = sum(w * y for w, y in zip(weights, values, strict=False)) / w_sum

    sxx = sum(w * (x - mean_x) ** 2 for w, x in zip(weights, xs, strict=False))
    sxy = sum(w * (x - mean_x) * (y - mean_y) for w, x, y in zip(weights, xs, values, strict=False))
    if sxx == 0:
        return 0.0, mean_y, 0.0

    slope = sxy / sxx
    intercept = mean_y - slope * mean_x

    ss_tot = sum(w * (y - mean_y) ** 2 for w, y in zip(weights, values, strict=False))
    ss_res = sum(
        w * (y - (slope * x + intercept)) ** 2 for w, x, y in zip(weights, xs, values, strict=False)
    )
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else 0.0
    return slope, intercept, max(0.0, min(1.0, r2))


def predict(
    series: list[TagSeries],
    limits: list[LimitDef],
    horizon_s: int = _DEFAULT_HORIZON_S,
    min_confidence: float = _MIN_CONFIDENCE,
) -> list[Prediction]:
    """Прогнозирует время достижения уставок по трендам тегов."""
    by_tag = {s.tag_id: s for s in series}
    results: list[Prediction] = []

    for limit in limits:
        s = by_tag.get(limit.tag_id)
        if s is None or len(s.values) < _MIN_POINTS:
            continue

        slope, _, r2 = _linear_fit(s.values, s.step_s)
        current = s.values[-1]
        gap = limit.value - current

        # Тренд направлен от уставки или параметр стабилен.
        rate_per_min = slope * 60.0
        if abs(rate_per_min) < 1e-6 or (gap != 0 and math.copysign(1, gap) != math.copysign(1, slope)):
            results.append(
                Prediction(
                    tag_id=limit.tag_id,
                    current=round(current, 4),
                    target_limit=limit.value,
                    limit_type=limit.limit_type,
                    eta_s=None,
                    eta_ci_low_s=None,
                    eta_ci_high_s=None,
                    confidence=round(r2, 2),
                    trend="STABLE" if abs(rate_per_min) < 1e-6 else "AWAY",
                    rate_per_min=round(rate_per_min, 4),
                )
            )
            continue

        eta = gap / slope
        if eta < 0 or eta > horizon_s:
            trend = "RISING" if slope > 0 else "FALLING"
            results.append(
                Prediction(
                    tag_id=limit.tag_id,
                    current=round(current, 4),
                    target_limit=limit.value,
                    limit_type=limit.limit_type,
                    eta_s=None,
                    eta_ci_low_s=None,
                    eta_ci_high_s=None,
                    confidence=round(r2, 2),
                    trend=trend,
                    rate_per_min=round(rate_per_min, 4),
                )
            )
            continue

        # Ширина интервала обратна качеству подгонки: шумный тренд даёт
        # широкий разброс, и оператор видит это по интервалу.
        spread = (1.0 - r2) * 0.6 + 0.1
        results.append(
            Prediction(
                tag_id=limit.tag_id,
                current=round(current, 4),
                target_limit=limit.value,
                limit_type=limit.limit_type,
                eta_s=int(round(eta)),
                eta_ci_low_s=max(0, int(round(eta * (1 - spread)))),
                eta_ci_high_s=int(round(eta * (1 + spread))),
                confidence=round(r2, 2),
                trend="RISING" if slope > 0 else "FALLING",
                rate_per_min=round(rate_per_min, 4),
            )
        )

    metrics.request(_RPC, "ok")
    return results


def visible_to_operator(
    predictions: list[Prediction],
    session_mode: str,
    max_eta_s: int = 180,
    min_confidence: float = _MIN_CONFIDENCE,
) -> list[Prediction]:
    """Фильтр показа прогноза оператору.

    В экзамене прогноз не показывается никогда (FR-AI-06), но продолжает
    считаться и писаться в AIInsight для последующего разбора.
    """
    if session_mode == "EXAM":
        return []
    return [
        p
        for p in predictions
        if p.eta_s is not None and p.eta_s <= max_eta_s and p.confidence >= min_confidence
    ]
