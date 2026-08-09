"""Минимальная реализация BM25 без внешних зависимостей.

Для корпуса объёмом в один технологический регламент (сотни чанков)
полноценный векторный поиск избыточен, а лексический BM25 даёт даже
лучший результат: запросы обучаемых почти всегда содержат позицию прибора
или номер аппарата — точное совпадение здесь важнее семантической близости.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field

#: Атомарные токены — позиции аппаратов (К-1, Н-2А, Т-22/6, К-12/4) и приборов
#: (FRC 408, LRCA-641, TR 55-1). Если их не выделять, «К-1» распадается на
#: стоп-слово «к» и бесполезную цифру «1», и поиск по номеру аппарата не работает.
_EQUIPMENT_ATOM = re.compile(
    r"\b(?:АВЗ|АВГ|КУ|См|ППК|ИПМ|[КНТЭПХАЕРСФ])\s?-\s?\d+(?:[/\\]\d+)?[А-ЯA-Z]?\b"
)
_TAG_ATOM = re.compile(r"\b[A-ZА-Я]{2,6}\s?-?\s?\d{2,5}(?:[-/]\d+)*\b")

_WORD_RE = re.compile(r"[a-zA-Zа-яА-ЯёЁ]+|\d+")
_CYRILLIC = re.compile(r"^[а-яё]+$")

#: Кириллические буквы, визуально совпадающие с латинскими, — в регламенте
#: позиции приборов набраны вперемешку («РRС 221» с кириллическими Р и С).
_HOMOGLYPHS = str.maketrans("АВЕКМНОРСТУХ", "ABEKMHOPCTYX")

_STOPWORDS = frozenset(
    """и в во не что он на я с со как а то все она так его но да ты к у же вы за бы
    по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли
    если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего
    ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего
    раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь
    этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при
    наконец два об другой хоть после над больше тот через эти нас про всего них какая
    много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя
    такой им более всегда конечно всю между поз которого которая которые которых
    осуществляется производится является помощью""".split()
)

#: Окончания для лёгкого стемминга. Порядок важен: сначала длинные.
#: Без стемминга запрос «противогаз» не находит текст со словом «противогазом»,
#: а «уставка блокировки» — фрагмент с «уставки блокировка».
_ENDINGS = tuple(
    sorted(
        (
            # Формы на -ение/-ание сводятся к общей основе: «давление»,
            # «давлению», «давлений», «давлением» -> «давлен».
            "иями", "иях", "иям", "ием", "ими", "ыми",
            "ого", "его", "ому", "ему", "ость", "ести",
            "ешь", "ете", "ует", "уют", "ать", "ять", "ить", "еть",
            "ой", "ей", "ов", "ев", "ий", "ый", "ая", "яя", "ое", "ее",
            "ые", "ие", "ом", "ем", "ам", "ям", "ах", "ях",
            "ию", "ия", "ии", "ую", "юю", "ся", "сь",
            "у", "ю", "а", "я", "ы", "и", "о", "е", "ь",
        ),
        key=len,
        reverse=True,
    )
)
_MIN_STEM = 3

#: Прибавка к релевантности за каждое совпадение позиции аппарата/прибора.
_ATOM_BOOST = 4.0


def _stem(word: str) -> str:
    """Отсекает частотные русские окончания, чтобы совпадали словоформы."""
    if len(word) <= 3 or not _CYRILLIC.match(word):
        return word
    for ending in _ENDINGS:
        if word.endswith(ending) and len(word) - len(ending) >= _MIN_STEM:
            return word[: -len(ending)]
    return word


def _normalize_atom(raw: str) -> str:
    return re.sub(r"[\s\-]", "", raw).upper().translate(_HOMOGLYPHS).lower()


def tokenize(text: str) -> list[str]:
    """Разбивает текст на токены: атомарные позиции + стеммированные слова."""
    if not text:
        return []

    tokens: list[str] = []
    remainder = text
    for pattern in (_TAG_ATOM, _EQUIPMENT_ATOM):
        found = pattern.findall(remainder)
        tokens.extend(_normalize_atom(a) for a in found)
        # Вырезаем найденное, чтобы «К-1» не породил ещё и мусорный токен «1».
        remainder = pattern.sub(" ", remainder)

    for word in _WORD_RE.findall(remainder):
        lowered = word.lower()
        if lowered in _STOPWORDS or len(lowered) < 2:
            continue
        tokens.append(_stem(lowered))
    return tokens


@dataclass
class Chunk:
    """Фрагмент справочного документа с метаданными для фильтрации."""

    chunk_id: str
    text: str
    source: str
    section: str = ""
    equipment: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    tokens: list[str] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        if not self.tokens:
            self.tokens = tokenize(self.text)


class Bm25Index:
    """Индекс BM25 с опциональной фильтрацией по оборудованию."""

    def __init__(self, chunks: list[Chunk], k1: float = 1.5, b: float = 0.75) -> None:
        self.chunks = chunks
        self.k1 = k1
        self.b = b
        self._df: Counter[str] = Counter()
        for chunk in chunks:
            self._df.update(set(chunk.tokens))
        self._n = len(chunks) or 1
        self._avgdl = (
            sum(len(c.tokens) for c in chunks) / self._n if chunks else 1.0
        ) or 1.0
        self._tf: list[Counter[str]] = [Counter(c.tokens) for c in chunks]
        self._atom_cache: dict[str, set[str]] = {}

    def _idf(self, term: str) -> float:
        df = self._df.get(term, 0)
        # Сглаженный IDF: не уходит в минус на очень частых терминах.
        return math.log(1 + (self._n - df + 0.5) / (df + 0.5))

    def score(self, query_tokens: list[str], doc_idx: int) -> float:
        tf = self._tf[doc_idx]
        dl = len(self.chunks[doc_idx].tokens) or 1
        total = 0.0
        for term in query_tokens:
            freq = tf.get(term, 0)
            if not freq:
                continue
            denom = freq + self.k1 * (1 - self.b + self.b * dl / self._avgdl)
            total += self._idf(term) * freq * (self.k1 + 1) / denom
        return total

    def _atoms(self, chunk: Chunk) -> set[str]:
        cached = self._atom_cache.get(chunk.chunk_id)
        if cached is None:
            cached = {
                _normalize_atom(a)
                for a in list(chunk.equipment) + list(chunk.tags)
            }
            self._atom_cache[chunk.chunk_id] = cached
        return cached

    def search(
        self,
        query: str,
        top_k: int = 5,
        equipment_filter: set[str] | None = None,
        min_score: float = 0.0,
    ) -> list[tuple[Chunk, float]]:
        """Возвращает наиболее релевантные фрагменты.

        ``equipment_filter`` — множество аппаратов текущего шаблона установки.
        Фильтрация до ранжирования не даёт подмешивать в ответ разделы про
        оборудование, которого в собранной установке нет.
        """
        query_tokens = tokenize(query)
        if not query_tokens:
            return []
        query_atoms = {
            _normalize_atom(a)
            for pattern in (_TAG_ATOM, _EQUIPMENT_ATOM)
            for a in pattern.findall(query)
        }

        results: list[tuple[Chunk, float]] = []
        for idx, chunk in enumerate(self.chunks):
            if equipment_filter and chunk.equipment:
                if not set(chunk.equipment) & equipment_filter:
                    continue
            value = self.score(query_tokens, idx)
            # Если в запросе названа позиция аппарата или прибора, фрагменты
            # именно про неё поднимаются: «производительность насоса Н-2» должно
            # вести в таблицу насосного оборудования, а не в общий текст.
            if query_atoms:
                overlap = query_atoms & self._atoms(chunk)
                value += _ATOM_BOOST * len(overlap)
            if value > min_score:
                results.append((chunk, value))

        results.sort(key=lambda pair: -pair[1])
        return results[:top_k]
