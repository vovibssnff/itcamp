"""Загрузка и хранение справочного корпуса (регламент, карточки оборудования)."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from .bm25 import Bm25Index, Chunk
from .chunker import chunk_document

logger = logging.getLogger(__name__)


class KnowledgeBase:
    """Корпус справочных материалов с поиском BM25.

    Индекс перестраивается из каталога документов, поэтому добавление
    недостающих разделов регламента (пуск/останов, нормы техрежима,
    возможные неполадки) не требует правки кода.
    """

    def __init__(self, chunks: list[Chunk] | None = None) -> None:
        self.chunks: list[Chunk] = chunks or []
        self.index = Bm25Index(self.chunks)

    # -- построение ---------------------------------------------------------

    @classmethod
    def from_directory(cls, directory: str | Path) -> "KnowledgeBase":
        """Индексирует .txt и .md из каталога; .pdf — если доступен pdfplumber."""
        path = Path(directory)
        chunks: list[Chunk] = []
        if not path.exists():
            logger.warning("Каталог справочных материалов не найден: %s", path)
            return cls(chunks)

        for file in sorted(path.rglob("*")):
            if file.suffix.lower() in {".txt", ".md"}:
                text = file.read_text(encoding="utf-8", errors="ignore")
            elif file.suffix.lower() == ".pdf":
                text = _extract_pdf(file)
                if text is None:
                    continue
            else:
                continue
            chunks.extend(chunk_document(text, source=file.name))

        logger.info("Проиндексировано фрагментов: %d", len(chunks))
        return cls(chunks)

    @classmethod
    def from_jsonl(cls, file: str | Path) -> "KnowledgeBase":
        """Загружает заранее подготовленный индекс (артефакт сборки образа)."""
        chunks: list[Chunk] = []
        for line in Path(file).read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            raw = json.loads(line)
            chunks.append(
                Chunk(
                    chunk_id=raw["chunk_id"],
                    text=raw["text"],
                    source=raw["source"],
                    section=raw.get("section", ""),
                    equipment=tuple(raw.get("equipment", ())),
                    tags=tuple(raw.get("tags", ())),
                )
            )
        return cls(chunks)

    def to_jsonl(self, file: str | Path) -> None:
        with Path(file).open("w", encoding="utf-8") as fh:
            for c in self.chunks:
                fh.write(
                    json.dumps(
                        {
                            "chunk_id": c.chunk_id,
                            "text": c.text,
                            "source": c.source,
                            "section": c.section,
                            "equipment": list(c.equipment),
                            "tags": list(c.tags),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )

    # -- поиск --------------------------------------------------------------

    def search(
        self,
        query: str,
        top_k: int = 4,
        equipment_filter: set[str] | None = None,
        min_score: float = 0.0,
    ) -> list[tuple[Chunk, float]]:
        return self.index.search(
            query, top_k=top_k, equipment_filter=equipment_filter, min_score=min_score
        )

    def __len__(self) -> int:
        return len(self.chunks)


def _extract_pdf(file: Path) -> str | None:
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        logger.warning("pdfplumber не установлен, PDF пропущен: %s", file.name)
        return None
    try:
        with pdfplumber.open(file) as pdf:
            return "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception as exc:  # noqa: BLE001 — индексация не должна ронять сервис
        logger.error("Не удалось разобрать PDF %s: %s", file.name, exc)
        return None
