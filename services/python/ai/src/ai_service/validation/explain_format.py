"""Разбор и валидация ответа Explain (причина → следствие → рекомендация)."""
from __future__ import annotations

import re
from dataclasses import dataclass

_MAX_WORDS = 220

_BLOCK_RE = re.compile(
    r"ПРИЧИНА\s*[:.]?\s*(?P<cause>.+?)"
    r"СЛЕДСТВИЕ\s*[:.]?\s*(?P<effect>.+?)"
    r"РЕКОМЕНДАЦИЯ\s*[:.]?\s*(?P<recommendation>.+)",
    re.IGNORECASE | re.DOTALL,
)


class ExplainFormatError(ValueError):
    """Ответ модели не соответствует требуемой структуре."""


@dataclass
class ParsedExplain:
    cause: str
    effect: str
    recommendation: str


def parse_explain(text: str) -> ParsedExplain:
    """Разбирает ответ модели на три обязательных блока."""
    if not text or not text.strip():
        raise ExplainFormatError("Пустой ответ модели")

    match = _BLOCK_RE.search(text)
    if not match:
        raise ExplainFormatError("Ответ не разобран на блоки ПРИЧИНА/СЛЕДСТВИЕ/РЕКОМЕНДАЦИЯ")

    parts = {k: re.sub(r"\s+", " ", v).strip(" *-—\n") for k, v in match.groupdict().items()}
    if not all(parts.values()):
        raise ExplainFormatError("Один из блоков пуст")

    total_words = sum(len(v.split()) for v in parts.values())
    if total_words > _MAX_WORDS:
        raise ExplainFormatError(f"Ответ длиннее лимита: {total_words} слов")

    return ParsedExplain(
        cause=parts["cause"],
        effect=parts["effect"],
        recommendation=parts["recommendation"],
    )
