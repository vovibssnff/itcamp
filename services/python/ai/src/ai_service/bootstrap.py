"""Сборка объектного графа приложения.

Единая точка, где конфигурация превращается в готовые сервисы. Позволяет
и API-слою, и тестам получать одинаково настроенное приложение.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from .config import Settings, get_settings
from .llm.base import LlmProvider
from .llm.factory import build_provider
from .rag.store import KnowledgeBase
from .resilience.circuit_breaker import CircuitBreaker
from .services.annotate import AnnotationService
from .services.chat import ChatService
from .services.debrief import DebriefService
from .services.explain import ExplainService
from .services.predict_behaviour import BehaviourService, RiskRule, RuleBasedRiskModel
from .storage.repository import InMemoryInsightRepository, InsightRepository
from .validation.tag_guard import TagGuard

logger = logging.getLogger(__name__)


@dataclass
class TagDictionary:
    template_id: str
    template_name: str
    tag_ids: list[str]
    equipment: set[str]
    #: tag_id -> человекочитаемое описание блокировок и уставок.
    interlocks: dict[str, list[str]]

    @classmethod
    def load(cls, path: str | Path) -> TagDictionary:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        tags = raw.get("tags", []) + raw.get("equipment_tags", [])
        interlocks: dict[str, list[str]] = {}
        for tag in tags:
            limits = tag.get("limits") or []
            if limits:
                interlocks[tag["tag_id"]] = [
                    f"{lim['type']} = {lim['value']} {tag.get('unit', '')}".strip()
                    + (f" — {lim['note']}" if lim.get("note") else "")
                    for lim in limits
                ]
        return cls(
            template_id=raw.get("template_id", ""),
            template_name=raw.get("template_name", ""),
            tag_ids=[t["tag_id"] for t in tags],
            equipment=set(raw.get("equipment", [])),
            interlocks=interlocks,
        )

    def fallback_cards(self) -> dict[str, str]:
        """Карточки для деградированного Explain — из уставок словаря."""
        return {
            tag: "Уставки и блокировки: " + "; ".join(notes)
            for tag, notes in self.interlocks.items()
        }


def load_risk_rules(path: str | Path) -> list[RiskRule]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    rules: list[RiskRule] = []
    for item in raw.get("rules", []):
        condition = item.get("state_condition")
        rules.append(
            RiskRule(
                code=item["code"],
                risk=item["risk"],
                headline=item["headline"],
                regulation_refs=tuple(item.get("regulation_refs", ())),
                alternative=item.get("alternative", ""),
                action_types=tuple(item.get("action_types", ())),
                targets=tuple(item.get("targets", ())),
                value_below=item.get("value_below"),
                value_above=item.get("value_above"),
                relative_drop=item.get("relative_drop"),
                state_condition=(condition[0], condition[1], float(condition[2]))
                if condition
                else None,
            )
        )
    return rules


@dataclass
class Application:
    settings: Settings
    llm: LlmProvider
    knowledge: KnowledgeBase
    tags: TagDictionary
    tag_guard: TagGuard
    explain: ExplainService
    chat: ChatService
    behaviour: BehaviourService
    annotate: AnnotationService
    debrief: DebriefService
    insights: InsightRepository

    def health(self) -> dict[str, object]:
        return {
            "llm_provider": self.llm.name,
            "llm_ready": self.llm.health(),
            "knowledge_chunks": len(self.knowledge),
            "tags_loaded": len(self.tags.tag_ids),
            "template": self.tags.template_name,
        }


def build_application(settings: Settings | None = None) -> Application:
    settings = settings or get_settings()
    data_dir = Path(settings.data_dir)

    tags = TagDictionary.load(data_dir / "tags_demo.json")
    tag_guard = TagGuard(tags.tag_ids)
    knowledge = KnowledgeBase.from_directory(settings.docs_dir)
    if len(knowledge) == 0:
        logger.warning(
            "Справочный корпус пуст: положите файлы регламента в %s "
            "и перезапустите индексацию", settings.docs_dir,
        )

    llm = build_provider(settings)
    breaker = CircuitBreaker(
        settings.breaker_failure_threshold, settings.breaker_reset_timeout_s
    )

    return Application(
        settings=settings,
        llm=llm,
        knowledge=knowledge,
        tags=tags,
        tag_guard=tag_guard,
        explain=ExplainService(
            llm=llm,
            knowledge=knowledge,
            tag_guard=tag_guard,
            settings=settings,
            breaker=breaker,
            fallback_cards=tags.fallback_cards(),
        ),
        chat=ChatService(
            knowledge=knowledge,
            llm=llm,
            settings=settings,
            tag_guard=tag_guard,
            breaker=breaker,
        ),
        behaviour=BehaviourService(
            model=RuleBasedRiskModel(load_risk_rules(data_dir / "risk_rules.json")),
            llm=llm,
        ),
        annotate=AnnotationService(llm=llm, knowledge=knowledge, breaker=breaker),
        debrief=DebriefService(llm=llm),
        insights=InMemoryInsightRepository(),
    )
