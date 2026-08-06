"""Пагинация (plan §5, schemas/page.json).

Разбор query-параметров ?limit=&offset= и сборка конверта { items, total, limit, offset }.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

DEFAULT_LIMIT = 50
MAX_LIMIT = 500


@dataclass(frozen=True)
class PageParams:
    limit: int = DEFAULT_LIMIT
    offset: int = 0

    @classmethod
    def parse(cls, limit: int | None = None, offset: int | None = None) -> "PageParams":
        lim = DEFAULT_LIMIT if limit is None else int(limit)
        off = 0 if offset is None else int(offset)
        lim = max(1, min(lim, MAX_LIMIT))
        off = max(0, off)
        return cls(limit=lim, offset=off)


def page_envelope(items: Sequence[Any], total: int, params: PageParams) -> dict[str, Any]:
    """Конверт пагинации по schemas/page.json."""
    return {
        "items": list(items),
        "total": int(total),
        "limit": params.limit,
        "offset": params.offset,
    }
