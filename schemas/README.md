# schemas/ — канонические JSON-схемы

JSON Schema **draft 2020-12**. Общие модели данных, подключаемые REST-сервисами
через `$ref` и используемые для сериализации графа/состояния (plan §1, §4, §5).

| Файл | Раздел плана | Назначение | `schema_version` |
|---|---|---|---|
| `component_type.json` | §9.1 | Тип компонента библиотеки КТС | — |
| `template.graph.json` | §4 | Граф установки (nodes/edges/layout) | да |
| `sim_state.json` | §4 | Init-state для sim и формат снапшота | да |
| `scenario.json` | §12.1 | Сценарий (faults/triggers/reference/criteria) | — |
| `error.json` | §5 | RFC 7807 problem+json | — |
| `page.json` | §5 | Конверт пагинации | — |

Схемы `template.graph.json` и `sim_state.json` включают поле `schema_version`
(включается в граф и снапшот, plan §1) — оно обязательно.

## Примеры и самопроверка

В `examples/` лежат payload-ы, **дословно** взятые из плана. Скрипт
`scripts/validate_schemas.py` компилирует каждую схему и валидирует её пример:

```bash
python scripts/validate_schemas.py
# или из корня
make schemas-validate
```

Downstream-сервисы должны переиспользовать эти схемы (не дублировать), а
Pydantic-модели генерировать/сверять с ними.
