"""Нарезка технологического регламента на фрагменты для поиска."""
from __future__ import annotations

import re

from .bm25 import Chunk

#: Позиции аппаратов: К-1, Н-2А, Т-22/6, Э-1, П-3, Е-15, Х-1/3, АВЗ-3, К-12/4.
_EQUIPMENT_RE = re.compile(
    r"\b(?:АВЗ|АВГ|КУ|См|[КНТЭПХАЕРСФ])-\s?\d+(?:[/\d]+)?[А-ЯA-Z]?\b"
)

#: Позиции КИП и регуляторов: FRC 408, LRCA 641, PRSA 204, TR 55-1, FQRC 3001.
_TAG_RE = re.compile(r"\b[A-Z]{2,6}\s?-?\s?\d{2,5}(?:[-/]\d+)*\b")

#: Заголовки подразделов регламента: «3.4.Подогрев обессоленной нефти…».
#: Номер обязан содержать точку — иначе номера страниц («33 Постоянство уровня…»)
#: распознаются как заголовки, и ссылка на раздел в ответе бота становится ложной.
_SECTION_RE = re.compile(
    r"^\s*(\d+(?:\.\d+){1,3})\.?\s+([А-ЯЁ][^\n]{5,90})$", re.MULTILINE
)

_DEFAULT_TARGET = 900
_DEFAULT_OVERLAP = 150


def dehyphenate(text: str) -> str:
    """Склеивает слова, разорванные переносом при извлечении из PDF.

    Без этого «электродегидра-\\nторе» превращается в два мусорных токена,
    и поиск по слову «электродегидратор» перестаёт находить нужный абзац.
    """
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    return text


def _normalize_equipment(raw: str) -> str:
    return re.sub(r"\s+", "", raw).upper().replace("—", "-")


def _split_sections(text: str) -> list[tuple[str, str]]:
    """Делит документ на (заголовок раздела, тело)."""
    matches = list(_SECTION_RE.finditer(text))
    if not matches:
        return [("", text)]
    sections: list[tuple[str, str]] = []
    if matches[0].start() > 0:
        sections.append(("", text[: matches[0].start()]))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        title = f"{m.group(1)} {m.group(2).strip()}"
        sections.append((title, text[m.end() : end]))
    return sections


def _split_body(body: str, target: int, overlap: int) -> list[str]:
    """Режет тело раздела по абзацам, не разрывая предложения."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}|\n(?=[А-ЯЁ])", body) if p.strip()]
    pieces: list[str] = []
    buf = ""
    for para in paragraphs:
        if len(buf) + len(para) + 1 <= target:
            buf = f"{buf}\n{para}".strip()
            continue
        if buf:
            pieces.append(buf)
            tail = buf[-overlap:] if overlap else ""
            buf = f"{tail}\n{para}".strip()
        else:
            pieces.append(para[:target])
            buf = para[target:]
    if buf.strip():
        pieces.append(buf.strip())
    return pieces or [body.strip()]


def chunk_document(
    text: str,
    source: str,
    target_chars: int = _DEFAULT_TARGET,
    overlap_chars: int = _DEFAULT_OVERLAP,
) -> list[Chunk]:
    """Превращает текст документа в набор проиндексированных фрагментов."""
    clean = dehyphenate(text)
    chunks: list[Chunk] = []
    counter = 0

    for section_title, body in _split_sections(clean):
        for piece in _split_body(body, target_chars, overlap_chars):
            if len(piece.strip()) < 60:
                continue
            equipment = tuple(
                sorted({_normalize_equipment(m) for m in _EQUIPMENT_RE.findall(piece)})
            )
            tags = tuple(
                sorted({re.sub(r"\s+", " ", m).strip() for m in _TAG_RE.findall(piece)})
            )
            counter += 1
            chunks.append(
                Chunk(
                    chunk_id=f"{source}#{counter}",
                    text=piece.strip(),
                    source=source,
                    section=section_title,
                    equipment=equipment,
                    tags=tags,
                )
            )
    return chunks
