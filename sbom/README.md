# SBOM и лицензионный анализ

Результат генерации SBOM (Software Bill of Materials) для всех сервисов и фронтенда
платформы «Конструктор КТК». Цель — понять, какие библиотеки используются и какие у них
**лицензии**, чтобы оценить возможность использования (в т.ч. в закрытом/корпоративном
контуре).

## Что здесь лежит

| Файл | Назначение |
|---|---|
| `go-*.json` | SBOM (CycloneDX JSON) по каждому Go-сервису (`services/go/*`) |
| `py-ai.json`, `py-sim-engine.json` | SBOM Python-сервисов (`services/python/*`) |
| `fe-frontend.json` | SBOM фронтенда (`frontend`) |
| `py-*-licenses.csv` | Лицензии Python-пакетов (из установленных пакетов/venv) |
| `fe-frontend-licenses.csv` | Лицензии Node-пакетов фронтенда (из node_modules) |
| `licenses-summary.csv` | **Полный** по-пакетный список: сервис, пакет, версия, лицензия |
| `licenses-summary.md` | Сводка по лицензиям (человекочитаемый отчёт) |

## Краткое резюме по лицензиям

Подавляющее большинство зависимостей — **permissive** (без ограничений на использование
даже в закрытом коде):

- **MIT** — 422
- **BSD (2/3-Clause)** — 144
- **Apache-2.0** — 116
- **ISC** — 37
- прочие permissive (BlueOak, PSF, Python, MIT-0, MIT/X, MIT-CMU и т.п.) — единичные

**Проблемные / требующие ручной проверки (6 вхождений):**

| Сервис | Пакет | Лицензия | Что делать |
|---|---|---|---|
| `py-ai` | `psycopg` 3.2.3 | **LGPLv3** | Copyleft. Python подключает динамически (import) — обычно приемлемо, но требует комплаенса LGPL. Проверить политику использования в закрытом контуре. |
| `py-ai` | `psycopg-binary` 3.2.3 | **LGPLv3** | То же, что выше. |
| `go-sim-manager` | `opencontainers/go-digest` v1.0.0 | **CC-BY-SA-4.0** | Фактически пакет Apache-2.0 (double-licensed); syft показал CC-BY-SA (share-alike). Проверить фактическую лицензию. |
| `go-sim-manager` | `Microsoft/go-winio` v0.6.2 | NONE | Фактически MIT (Windows-only зависимость). |
| `go-snapshot` | `dustin/go-humanize` v1.0.1 | NONE | Фактически MIT. |
| `go-snapshot` | `klauspost/cpuid/v2` v2.2.8 | NONE | Фактически MIT. |

> NONE — просто не распознана syft, но по факту у пакетов есть лицензия (обычно MIT).

**Вывод:** серьёзных блокирующих лицензий (GPL/AGPL/проприетарных) **нет**. Единственное,
что стоит юридически подтвердить, — **LGPLv3 у `psycopg`** (Python-драйвер Picodata) и
двойную лицензию `go-digest`.

## Как перегенерировать

Требования: [Syft](https://github.com/anchore/syft) (установка: `brew install syft`), Python 3.

```bash
# Go + Python + frontend (если есть node_modules):
tools/sbom/gen-sbom.sh
```

⚠️ Для корректных лицензий **Python** и **frontend** нужны установленные зависимости
(иначе лицензии недоопределяются из lock-файлов):

```bash
# Python (лицензии из установленных пакетов):
python3 -m venv /tmp/venv_ai && /tmp/venv_ai/bin/pip install -r services/python/ai/requirements.txt
python3 -m venv /tmp/venv_sim && /tmp/venv_sim/bin/pip install -r services/python/sim-engine/requirements.txt
tools/sbom/py_licenses.py /tmp/venv_ai/lib/python3.13/site-packages -o sbom/py-ai-licenses.csv
tools/sbom/py_licenses.py /tmp/venv_sim/lib/python3.13/site-packages -o sbom/py-sim-engine-licenses.csv

# Frontend (лицензии из node_modules):
cd frontend && corepack pnpm install   # или npx pnpm install
cd ..
tools/sbom/node_licenses.py frontend -o sbom/fe-frontend-licenses.csv
```

Затем пересобрать сводку:

```bash
python3 tools/sbom/licenses_summary.py sbom
```

## Инструменты

- `tools/sbom/gen-sbom.sh` — генерация всех SBOM (Syft, CycloneDX JSON) + сводки.
- `tools/sbom/licenses_summary.py` — сводка по лицензиям из SBOM/CSV, выявление проблемных.
- `tools/sbom/py_licenses.py` — лицензии Python-пакетов из venv/site-packages.
- `tools/sbom/node_licenses.py` — лицензии Node-пакетов из node_modules (pnpm .pnpm).
