"""Нормализация идентификаторов тегов и узлов.

В регламенте позиции пишутся как «FRC 408», «поз. LRCA 641», в SRD и
tag dictionary — как «FRC-408». Без единой нормализации сопоставление
эталона с журналом действий разваливается на ровном месте.
"""
from __future__ import annotations

import re

_PREFIX = re.compile(r"^(поз\.?|pos\.?)\s*", re.IGNORECASE)
_SEPARATORS = re.compile(r"[\s\-_]+")
_TRAILING_PUNCT = re.compile(r"[.,;:]+$")

#: Кириллические буквы, визуально совпадающие с латиницей.
_HOMOGLYPHS = str.maketrans(
    "АВЕКМНОРСТУХ",
    "ABEKMHOPCTYX",
)


def normalize_tag(raw: str | None) -> str:
    """Приводит идентификатор тега к канонической форме.

    >>> normalize_tag("поз. FRC 408")
    'FRC408'
    >>> normalize_tag("frc-408") == normalize_tag("FRC 408")
    True
    """
    if not raw:
        return ""
    text = _TRAILING_PUNCT.sub("", raw.strip())
    text = _PREFIX.sub("", text)
    text = text.upper().translate(_HOMOGLYPHS)
    text = _SEPARATORS.sub("", text)
    return text


def same_target(a: str | None, b: str | None) -> bool:
    """Совпадают ли цели действия и эталонного шага."""
    na, nb = normalize_tag(a), normalize_tag(b)
    return bool(na) and na == nb


def display_tag(raw: str) -> str:
    """Возвращает тег в человекочитаемом виде для текста ответа."""
    return raw.strip()
