"""Загрузка каталога неисправностей (data/faults_catalog.json)."""
from __future__ import annotations

import json
from pathlib import Path

from ..domain.models import FaultDef, FaultEffect


def load_faults(path: str | Path) -> dict[str, FaultDef]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    faults: dict[str, FaultDef] = {}
    for item in raw["faults"]:
        effects = tuple(
            FaultEffect(
                node_id=e["node_id"],
                param=e["param"],
                mode=e["mode"],
                target_value=e["target_value"],
                ramp_s=e.get("ramp_s", 0.0),
            )
            for e in item["effects"]
        )
        fault = FaultDef(
            fault_id=item["fault_id"],
            docx_ref=item["docx_ref"],
            group=item["group"],
            title=item["title"],
            equipment=tuple(item.get("equipment", [])),
            early_signs=item["early_signs"],
            stabilization_hint=item["stabilization_hint"],
            regulation_refs=tuple(item.get("regulation_refs", [])),
            effects=effects,
        )
        faults[fault.fault_id] = fault
    return faults
