"""Чат-бот обучаемого: справочник по регламенту.

Архитектурное решение (ADR-002): бот НЕ имеет доступа к телеметрии сессии.
Это убирает целый класс злоупотреблений — через бота нельзя получить
подсказку по текущей ситуации, поэтому его не нужно полностью отключать
на экзамене: он работает как открытый справочник, что соответствует
практике реальной аттестации.
"""
from __future__ import annotations

import logging
import re
import time

from ..config import Settings, get_settings
from ..domain.enums import SessionMode
from ..domain.models import ChatAnswer
from ..llm.base import LlmError, LlmProvider, LlmRequest
from ..observability import metrics
from ..prompts.templates import CHAT_PROMPT, CHAT_SYSTEM
from ..rag.store import KnowledgeBase
from ..resilience.circuit_breaker import CircuitBreaker
from ..validation.pdn import scrub
from ..validation.tag_guard import TagGuard

logger = logging.getLogger(__name__)

_RPC = "chat"

#: Попытки вытянуть из бота решение сценария вместо знаний о процессе.
#: Фильтр на входе, а не инструкция в промпте: инструкции обходятся.
_SOLUTION_SEEKING = re.compile(
    r"(эталон\w*"
    r"|правильн\w+\s+(последовательн\w+|порядок|действ\w+|ответ\w*)"
    r"|как\s+(пройти|сдать|решить)\s+(сценар\w+|экзамен\w*|задан\w+)"
    r"|что\s+(мне\s+)?(сейчас\s+)?(нажать|делать)\b"
    r"|подскажи\s+решение"
    r"|критери\w+\s+оценк\w+"
    r"|за\s+что\s+(снимают|снимут|штраф\w*)"
    r")",
    re.IGNORECASE,
)

#: Попытки перехватить системную инструкцию.
_INJECTION = re.compile(
    r"(игнорир\w+\s+(все\s+)?(предыдущ\w+|прежн\w+|свои)\s+(инструкц\w+|правил\w+)"
    r"|забудь\s+(все\s+)?(инструкц\w+|правил\w+)"
    r"|ignore\s+(all\s+)?(previous|prior)\s+instructions"
    r"|ты\s+больше\s+не\s+справочник"
    r"|покажи\s+(свой\s+)?систем\w+\s+промпт"
    r"|system\s+prompt)",
    re.IGNORECASE,
)

_REFUSAL_SOLUTION = (
    "Готовую последовательность действий по сценарию я не подсказываю — это часть "
    "учебного задания. Могу разобрать физику процесса: как связаны параметры, "
    "какие уставки и блокировки предусмотрены регламентом. Спросите об этом."
)
_REFUSAL_INJECTION = (
    "Я отвечаю только по технологическому регламенту установки. "
    "Задайте вопрос по процессу или оборудованию."
)
_NO_SOURCES = (
    "В предоставленных материалах регламента ответа на этот вопрос нет. "
    "Уточните вопрос или обратитесь к инструктору."
)
_EXAM_DISABLED = (
    "Во время экзамена справочный чат отключён администратором."
)

_MAX_QUESTION_LEN = 500


class ChatService:
    def __init__(
        self,
        knowledge: KnowledgeBase,
        llm: LlmProvider,
        settings: Settings | None = None,
        tag_guard: TagGuard | None = None,
        breaker: CircuitBreaker | None = None,
    ) -> None:
        self.knowledge = knowledge
        self.llm = llm
        self.settings = settings or get_settings()
        self.tag_guard = tag_guard
        self.breaker = breaker or CircuitBreaker(
            self.settings.breaker_failure_threshold,
            self.settings.breaker_reset_timeout_s,
        )

    def ask(
        self,
        question: str,
        session_mode: str = SessionMode.TRAINING.value,
        equipment_filter: set[str] | None = None,
    ) -> ChatAnswer:
        started = time.monotonic()
        try:
            return self._ask(question, session_mode, equipment_filter)
        finally:
            metrics.duration(_RPC, time.monotonic() - started)

    # -- внутреннее ---------------------------------------------------------

    def _ask(
        self, question: str, session_mode: str, equipment_filter: set[str] | None
    ) -> ChatAnswer:
        question = (question or "").strip()[:_MAX_QUESTION_LEN]
        if not question:
            metrics.request(_RPC, "empty")
            return ChatAnswer(answer="Вопрос пустой.", refused=True, refusal_reason="empty")

        if session_mode == SessionMode.EXAM.value and not self.settings.chat_enabled_in_exam:
            metrics.request(_RPC, "exam_blocked")
            metrics.registry.inc("ai_exam_block_total", rpc=_RPC)
            return ChatAnswer(
                answer=_EXAM_DISABLED, refused=True, refusal_reason="exam_mode_disabled"
            )

        if _INJECTION.search(question):
            metrics.request(_RPC, "refused")
            metrics.reject("prompt_injection")
            return ChatAnswer(
                answer=_REFUSAL_INJECTION, refused=True, refusal_reason="prompt_injection"
            )

        if _SOLUTION_SEEKING.search(question):
            metrics.request(_RPC, "refused")
            metrics.reject("solution_seeking")
            return ChatAnswer(
                answer=_REFUSAL_SOLUTION, refused=True, refusal_reason="solution_seeking"
            )

        hits = self.knowledge.search(
            question,
            top_k=self.settings.chat_top_k,
            equipment_filter=equipment_filter,
            min_score=self.settings.chat_min_relevance,
        )
        if not hits:
            metrics.request(_RPC, "no_sources")
            return ChatAnswer(answer=_NO_SOURCES, refused=False, refusal_reason="no_sources")

        citations = [
            {
                "chunk_id": chunk.chunk_id,
                "source": chunk.source,
                "section": chunk.section,
                "score": round(score, 2),
            }
            for chunk, score in hits
        ]
        sources_block = "\n\n".join(
            f"[{i + 1}] {chunk.source}, {chunk.section or 'раздел не определён'}\n{chunk.text}"
            for i, (chunk, _) in enumerate(hits)
        )

        if not self.breaker.allows():
            metrics.fallback(_RPC, "breaker_open")
            return self._extractive_answer(hits, citations)

        try:
            raw = self.llm.generate(
                LlmRequest(
                    system=CHAT_SYSTEM,
                    prompt=CHAT_PROMPT.format(sources=sources_block, question=question),
                    temperature=0.2,
                    max_tokens=350,
                )
            )
            self.breaker.record_success()
        except LlmError as exc:
            self.breaker.record_failure()
            logger.warning("Чат: LLM недоступна (%s), выдаю выдержку из регламента", exc)
            metrics.fallback(_RPC, "llm_error")
            return self._extractive_answer(hits, citations)

        answer = scrub(raw.strip())

        if self.tag_guard is not None:
            guard = self.tag_guard.check(answer)
            if not guard.ok:
                logger.warning("Чат: ответ забракован, неизвестные теги %s", guard.unknown_tags)
                metrics.reject("unknown_tag")
                metrics.fallback(_RPC, "unknown_tag")
                return self._extractive_answer(hits, citations)

        metrics.request(_RPC, "ok")
        return ChatAnswer(answer=answer, citations=citations)

    def _extractive_answer(self, hits, citations) -> ChatAnswer:
        """Fallback без LLM: цитата наиболее релевантного фрагмента регламента.

        Хуже по форме, но фактически корректно — обучаемый получает
        первоисточник, а не отказ.
        """
        chunk, _ = hits[0]
        head = f"{chunk.source}, {chunk.section}".strip(", ")
        body = chunk.text if len(chunk.text) <= 900 else chunk.text[:900].rsplit(" ", 1)[0] + "…"
        return ChatAnswer(
            answer=f"Выдержка из регламента ({head}):\n\n{body}",
            citations=citations,
            degraded=True,
        )
