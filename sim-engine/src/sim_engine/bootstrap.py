"""Сборка объектного графа приложения: конфигурация -> готовый SimulationEngine."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from .config import Settings, get_settings
from .domain.enums import LimitType
from .domain.models import LimitDef, Tag
from .engine.model_api import SimulationEngine
from .faults.catalog import load_faults

logger = logging.getLogger(__name__)


def load_tags(template: dict) -> dict[str, Tag]:
    tags: dict[str, Tag] = {}
    for item in template.get("tags", []) + template.get("equipment_tags", []):
        limits = tuple(
            LimitDef(
                tag_id=item["tag_id"],
                limit_type=LimitType(lim["type"]),
                value=lim["value"],
                note=lim.get("note", ""),
                direction=lim.get("direction", "above"),
            )
            for lim in item.get("limits", [])
        )
        tags[item["tag_id"]] = Tag(
            tag_id=item["tag_id"],
            description=item.get("description", ""),
            unit=item.get("unit", ""),
            kind=item.get("kind", ""),
            equipment=item.get("equipment", ""),
            limits=limits,
        )
    return tags


@dataclass
class Application:
    settings: Settings
    engine: SimulationEngine

    def health(self) -> dict[str, object]:
        return {
            "template": self.engine.template.get("template_name", ""),
            "template_id": self.engine.template.get("template_id", ""),
            "tags_loaded": len(self.engine.tags),
            "faults_loaded": len(self.engine.faults_catalog),
            "active_sessions": len(self.engine.sessions),
        }


def build_application(settings: Settings | None = None) -> Application:
    settings = settings or get_settings()
    data_dir = Path(settings.data_dir)

    template = json.loads((data_dir / settings.template_file).read_text(encoding="utf-8"))
    tags = load_tags(template)
    faults = load_faults(data_dir / settings.faults_file)

    logger.info(
        "Шаблон '%s' загружен: %d тегов, %d неисправностей",
        template.get("template_id"),
        len(tags),
        len(faults),
    )

    engine = SimulationEngine(template=template, tags=tags, faults_catalog=faults)
    return Application(settings=settings, engine=engine)
