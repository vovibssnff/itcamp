# Сводка по лицензиям зависимостей

Сформировано инструментом `tools/sbom/licenses_summary.py`. Источник — `sbom/*.json` (CycloneDX) и `sbom/fe-frontend-licenses.csv` (лицензии фронтенда из node_modules).

## Разбивка по сервисам

| Сервис | Компонентов | Лицензии (число пакетов) |
|---|---|---|
| `fe-frontend` | 360 | MIT: 295, ISC: 27, Apache-2.0: 12, BSD-2-Clause: 9, BSD-3-Clause: 8, BlueOak-1.0.0: 5, (MIT OR CC0-1.0): 2, Python-2.0: 1, CC-BY-4.0: 1 |
| `go-assessment` | 28 | MIT: 10, BSD-3-Clause: 10, Apache-2.0: 7, ISC: 1 |
| `go-auth` | 35 | MIT: 15, BSD-3-Clause: 11, Apache-2.0: 8, ISC: 1 |
| `go-constructor` | 28 | MIT: 10, BSD-3-Clause: 10, Apache-2.0: 7, ISC: 1 |
| `go-gw` | 16 | BSD-3-Clause: 6, Apache-2.0: 6, MIT: 4 |
| `go-orchestrator` | 36 | MIT: 13, BSD-3-Clause: 10, Apache-2.0: 10, ISC: 2, BSD-2-Clause: 1 |
| `go-report` | 32 | MIT: 11, BSD-3-Clause: 10, Apache-2.0: 10, ISC: 1 |
| `go-scenario` | 28 | MIT: 10, BSD-3-Clause: 10, Apache-2.0: 7, ISC: 1 |
| `go-shared` | 27 | BSD-3-Clause: 10, MIT: 9, Apache-2.0: 7, ISC: 1 |
| `go-sim-manager` | 68 | Apache-2.0: 32, BSD-3-Clause: 22, MIT: 10, NONE: 1, ISC: 1, CC-BY-SA-4.0: 1, BSD-2-Clause: 1 |
| `go-snapshot` | 38 | BSD-3-Clause: 13, MIT: 12, Apache-2.0: 10, NONE: 2, ISC: 1 |
| `py-ai` | 34 | MIT: 12, BSD-3-Clause: 7, OSI Approved :: MIT License: 2, Apache License 2.0: 2, GNU Lesser General Public License v3 (LGPLv3): 2, MIT-0: 1, Apache-2.0 OR BSD-3-Clause: 1, MIT/X: 1, MIT-CMU: 1, Apache Software License 2.0: 1, 3-Clause BSD License: 1, BSD-3-Clause, Apache-2.0, dependency licenses: 1, PSF-2.0: 1, MIT License: 1 |
| `py-sim-engine` | 25 | MIT: 11, BSD-3-Clause: 6, Apache License 2.0: 2, OSI Approved :: MIT License: 1, Copyright (c) 2005-2024, NumPy Developers.: 1, Apache Software License 2.0: 1, 3-Clause BSD License: 1, PSF-2.0: 1, MIT License: 1 |

## Компоненты с потенциально проблемными лицензиями

| Лицензия | Кол-во вхождений по пакетам |
|---|---|
| NONE | 3 |
| GNU Lesser General Public License v3 (LGPLv3) | 2 |
| CC-BY-SA-4.0 | 1 |

### Детали

| Сервис | Пакет | Версия | Лицензия |
|---|---|---|---|
| go-sim-manager | github.com/Microsoft/go-winio | v0.6.2 | NONE |
| go-sim-manager | github.com/opencontainers/go-digest | v1.0.0 | CC-BY-SA-4.0 |
| go-snapshot | github.com/dustin/go-humanize | v1.0.1 | NONE |
| go-snapshot | github.com/klauspost/cpuid/v2 | v2.2.8 | NONE |
| py-ai | psycopg | 3.2.3 | GNU Lesser General Public License v3 (LGPLv3) |
| py-ai | psycopg-binary | 3.2.3 | GNU Lesser General Public License v3 (LGPLv3) |

## Примечания

- Источники лицензий: Go — SBOM (go.mod/go.sum + module info); Python — установленные пакеты (venv, `*-licenses.csv`); фронтенд — node_modules (`fe-frontend-licenses.csv`).
- `NONE`/`UNKNOWN` — пакеты, у которых источник не содержит информации о лицензии;
  обычно это не лишний риск, но требует ручной проверки.
- Полный по-пакетный список — в `licenses-summary.csv`.