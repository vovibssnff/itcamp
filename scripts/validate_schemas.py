#!/usr/bin/env python3
"""Самопроверка JSON-схем (plan §4, §5, §9.1, §12.1).

Загружает каждую схему из schemas/, проверяет что она компилируется как
JSON Schema draft 2020-12, и валидирует прикреплённый пример payload из
schemas/examples/ (payload-ы дословно взяты из плана).

Запуск:  python scripts/validate_schemas.py   (или make schemas-validate)
Код возврата 0 — все схемы и примеры валидны.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas"
EXAMPLES_DIR = SCHEMAS_DIR / "examples"

# schema-файл -> пример payload
CASES = {
    "component_type.json": "component_type.example.json",
    "template.graph.json": "template.graph.example.json",
    "sim_state.json": "sim_state.example.json",
    "scenario.json": "scenario.example.json",
    "error.json": "error.example.json",
    "page.json": "page.example.json",
}


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    failures: list[str] = []
    for schema_name, example_name in CASES.items():
        schema_path = SCHEMAS_DIR / schema_name
        example_path = EXAMPLES_DIR / example_name

        if not schema_path.exists():
            failures.append(f"[MISSING SCHEMA] {schema_name}")
            continue

        schema = load(schema_path)

        # 1) схема сама по себе валидна как draft 2020-12
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"[BAD SCHEMA] {schema_name}: {exc}")
            continue

        # 2) пример payload проходит валидацию
        if not example_path.exists():
            failures.append(f"[MISSING EXAMPLE] {example_name}")
            continue

        instance = load(example_path)
        validator = Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
        if errors:
            for err in errors:
                loc = "/".join(str(p) for p in err.path) or "<root>"
                failures.append(f"[INVALID EXAMPLE] {example_name} @ {loc}: {err.message}")
        else:
            print(f"OK  {schema_name:24s} <- {example_name}")

    if failures:
        print("\nFAILURES:")
        for f in failures:
            print("  " + f)
        return 1

    print(f"\nAll {len(CASES)} schemas validated their examples successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
