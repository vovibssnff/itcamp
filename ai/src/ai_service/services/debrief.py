"""Разбор сессии и текстовый блок для PDF-отчёта (UC-EXP-04, UC-EXP-05)."""
from __future__ import annotations

import logging

from ..analysis.profile import ErrorProfile
from ..domain.models import AnnotatedAssessment
from ..llm.base import LlmError, LlmProvider, LlmRequest
from ..observability import metrics
from ..prompts.templates import DEBRIEF_PROMPT, DEBRIEF_SYSTEM
from ..validation.pdn import scrub

logger = logging.getLogger(__name__)

_RPC = "debrief"


class DebriefService:
    def __init__(self, llm: LlmProvider) -> None:
        self.llm = llm

    def build(
        self,
        annotated: AnnotatedAssessment,
        scenario_name: str,
        pass_score: int = 70,
        profile: ErrorProfile | None = None,
    ) -> tuple[str, bool]:
        """Возвращает (текст разбора, признак деградации)."""
        a = annotated.assessment
        prompt = DEBRIEF_PROMPT.format(
            scenario_name=scenario_name,
            score=a.score,
            pass_score=pass_score,
            verdict="зачёт" if a.passed else "незачёт",
            reactions=_format_reactions(a),
            steps=_format_steps(a),
            penalties="\n".join(f"- {p.code} ({p.points}): {p.detail}" for p in a.penalties)
            or "нет",
            critical="\n".join(f"- {p.code}: {p.detail}" for p in a.critical_errors) or "нет",
            profile=_format_profile(profile),
        )
        try:
            text = self.llm.generate(
                LlmRequest(system=DEBRIEF_SYSTEM, prompt=prompt, temperature=0.3, max_tokens=900)
            )
            metrics.request(_RPC, "ok")
            return scrub(text.strip()), False
        except LlmError as exc:
            logger.warning("Разбор: отказ LLM (%s), выдаю структурный разбор", exc)
            metrics.fallback(_RPC, "llm_error")
            metrics.request(_RPC, "degraded")
            return _deterministic_debrief(annotated, scenario_name, pass_score), True


def _format_reactions(a) -> str:
    if not a.reaction.reactions:
        return "алармов не было"
    lines = [
        f"- {r.tag_id} ({r.priority}): квитирование "
        + (f"{r.ack_delay_s} с" if r.ack_delay_s is not None else "не выполнено")
        + (" — просрочено" if r.late else "")
        for r in a.reaction.reactions
    ]
    return "\n".join(lines)


def _format_steps(a) -> str:
    if not a.sequence.steps:
        return "эталон не задан"
    return "\n".join(
        f"- шаг {s.step} ({s.reference.action} {s.reference.target}): {s.outcome}"
        + (f", просрочка {s.delay_s} с" if s.delay_s else "")
        for s in a.sequence.steps
    )


def _format_profile(profile: ErrorProfile | None) -> str:
    if profile is None or not profile.weights:
        return "истории обучения нет"
    return ", ".join(
        f"{cat} — {weight * 100:.0f} %"
        for cat, weight in sorted(profile.weights.items(), key=lambda kv: -kv[1])[:4]
    )


def _deterministic_debrief(
    annotated: AnnotatedAssessment, scenario_name: str, pass_score: int
) -> str:
    """Разбор без LLM: факты из журнала, собранные в читаемый текст."""
    a = annotated.assessment
    parts = [
        f"Сценарий «{scenario_name}». Итог: {a.score} из 100 при пороге {pass_score} — "
        f"{'зачёт' if a.passed else 'незачёт'}.",
        "",
        "Время реакции на сигнализацию:",
        _format_reactions(a),
        "",
        "Выполнение эталонной последовательности:",
        _format_steps(a),
    ]
    if a.critical_errors:
        parts += ["", "Критические ошибки:"] + [
            f"- {p.code}: {p.detail}" for p in a.critical_errors
        ]
    if annotated.annotations:
        parts += ["", "Замечания системы:"] + [
            f"- {n.text}" for n in annotated.annotations if n.text
        ]
    parts += ["", "Развёрнутый разбор ИИ временно недоступен."]
    return "\n".join(parts)
