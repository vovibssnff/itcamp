"""Отсев галлюцинаций по тегам и уставкам.

Ключевая защита ИИ-модуля тренажёра: языковая модель охотно «вспоминает»
позиции приборов, которых в собранной установке нет, и уставки, которых
нет в модели. Обучаемый принимает такой ответ за истину. Поэтому любой
тег в ответе сверяется со словарём тегов шаблона, и ответ с неизвестным
тегом бракуется целиком, а не правится.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..analysis.normalize import normalize_tag

#: Кандидаты в теги: буквенный префикс + число (FRC 408, LRCA-641, TR 55-1).
_TAG_CANDIDATE_RE = re.compile(r"\b[A-ZА-Я]{2,6}\s?-?\s?\d{2,5}(?:[-/]\d+)*\b")


@dataclass
class GuardResult:
    ok: bool
    unknown_tags: list[str] = field(default_factory=list)
    known_tags: list[str] = field(default_factory=list)
    reason: str = ""


class TagGuard:
    """Проверяет, что все упомянутые теги есть в словаре шаблона."""

    def __init__(self, known_tags: list[str]) -> None:
        self._known = {normalize_tag(t) for t in known_tags if t}

    def extract(self, text: str) -> list[str]:
        return [m.group(0) for m in _TAG_CANDIDATE_RE.finditer(text or "")]

    def check(self, text: str) -> GuardResult:
        if not self._known:
            # Словарь не загружен — проверять нечем; пропускаем, но честно
            # сообщаем об этом вызывающему коду через reason.
            return GuardResult(ok=True, reason="tag_dictionary_empty")

        unknown: list[str] = []
        known: list[str] = []
        for candidate in self.extract(text):
            if normalize_tag(candidate) in self._known:
                known.append(candidate)
            else:
                unknown.append(candidate)

        if unknown:
            return GuardResult(
                ok=False,
                unknown_tags=sorted(set(unknown)),
                known_tags=sorted(set(known)),
                reason="unknown_tag",
            )
        return GuardResult(ok=True, known_tags=sorted(set(known)))
