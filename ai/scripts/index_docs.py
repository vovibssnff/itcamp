#!/usr/bin/env python3
"""Построение поискового индекса по справочным материалам.

Запуск:
    python scripts/index_docs.py data/regulation data/index.jsonl

Индекс складывается в JSONL и может быть вшит в образ на этапе сборки,
чтобы под не тратил время на разбор PDF при старте.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from ai_service.rag.store import KnowledgeBase  # noqa: E402


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    kb = KnowledgeBase.from_directory(src)
    if not len(kb):
        print(f"В каталоге {src} не найдено документов для индексации")
        return 1
    kb.to_jsonl(dst)
    sources = sorted({c.source for c in kb.chunks})
    print(f"Проиндексировано фрагментов: {len(kb)}")
    for s in sources:
        count = sum(1 for c in kb.chunks if c.source == s)
        print(f"  {s}: {count}")
    print(f"Индекс сохранён: {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
