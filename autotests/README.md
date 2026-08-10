# Автотесты сервисов ktc (Python)

Набор API-тестов (чёрный ящик) для сервисов платформы Конструктор КТК.
Пишутся на `pytest` + `requests`, работают против **запущенного** dev-окружения
(docker compose).

## Требования

- Python 3.10+ (проверено на 3.13)
- Запущенное dev-окружение: `compose/data` (БД) + `compose/app` (сервисы)

Установка зависимостей:

```bash
cd autotests
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Запуск

```bash
# все тесты (кроме sim-manager)
pytest

# конкретный сервис
pytest tests/test_auth.py -v

# с выводом в консоль
pytest -s -v

# включая sim-manager (если поднят отдельно)
pytest --markers   # посмотреть маркеры
pytest -m "not sim"
```

## Конфигурация окружения

Базовые адреса и учётные данные задаются переменными окружения (по умолчанию —
значения dev-композа):

| Переменная          | По умолчанию            | Описание              |
|---------------------|-------------------------|-----------------------|
| `AUTHTESTS_HOST`     | `http://localhost`      | хост всех сервисов    |
| `AUTH_PORT`          | `8082`                  | порт auth             |
| `GW_PORT`            | `8088`                  | порт gw               |
| `CONSTRUCTOR_PORT`   | `8083`                  | порт constructor      |
| `SCENARIO_PORT`      | `8084`                  | порт scenario         |
| `ORCHESTRATOR_PORT`  | `8085`                  | порт orchestrator     |
| `ASSESSMENT_PORT`    | `8081`                  | порт assessment       |
| `SNAPSHOT_PORT`      | `8086`                  | порт snapshot         |
| `REPORT_PORT`        | `8087`                  | порт report           |
| `SIM_MANAGER_PORT`   | `8080`                  | порт sim-manager      |
| `OPERATOR_LOGIN`/`OPERATOR_PASS` | `operator`/`operator123` | учётка оператора |
| `INSTRUCTOR_LOGIN`/`INSTRUCTOR_PASS` | `instructor`/`instructor123` | учётка инструктора |
| `ADMIN_LOGIN`/`ADMIN_PASS` | `admin`/`admin123` | учётка админа |

## Тест-модель (как устроены тесты)

### Общая модель

Тесты делятся на **позитивные** (happy path) и **негативные**
(валидация, авторизация, отсутствие ресурса). Для каждого сервиса — отдельный
`test_<service>.py`.

### Trust boundary (важно для внутренних сервисов)

По `auth.md §6` **JWT валидирует только gw** через `POST /introspect`.
Внутренние сервисы (constructor, scenario, orchestrator, assessment, snapshot,
report, sim-manager) **токен не проверяют** — они доверяют заголовкам, которые
инжектит gw:

- `X-User-ID` — идентификатор пользователя
- `X-Roles` — список ролей через запятую (`admin,instructor`)

Поэтому прямые тесты внутренних сервисов **имитируют** эти заголовки, задавая
нужную роль:

```python
ADMIN_H = {"X-Roles": "admin", "X-User-ID": "admin-1"}
```

Так проверяется RBAC без необходимости тащить реальный JWT.

### По сервисам

| Сервис | Файл | Тест-модель |
|--------|------|-------------|
| **auth** | `test_auth.py` | Полноценный JWT-цикл: healthz, login (тукущий пароль / неверный / MFA), refresh (ротация / невалидный / после logout), logout, me (с/без токена), introspect (active/inactive), users (list/get/404), MFA (setup/enable/status, 404 для несуществующего). |
| **gw** | `test_gw.py` | Шлюз как граница доверия: healthz, 401 без токена, 403 для operator на admin-маршруте, проксирование auth-any маршрутов, отбрасывание невалидного токена. |
| **constructor** | `test_constructor.py` | healthz, CRUD компонентов (с ролями), RBAC (нет роли / operator → 403), 404, шаблоны. |
| **scenario** | `test_scenario.py` | healthz, список неисправностей, 404, RBAC на создание сценария. |
| **orchestrator** | `test_orchestrator.py` | healthz, список сессий, 404, RBAC/валидация операций (speed/start). |
| **assessment** | `test_assessment.py` | healthz, оценка (404 для отсутствующей сессии), event (регрессия: 404 вместо 500 при неизвестном scenario), override. |
| **snapshot** | `test_snapshot.py` | healthz, список, 404, удаление snapshot. |
| **report** | `test_report.py` | healthz, список, 404, создание отчёта (async через NATS). |
| **sim-manager** | `test_sim_manager.py` | healthz, список инстансов, 404, создание. Помечен маркером `sim` (сервис вне dev-compose). |
| **ai** | `test_ai.py` | ИИ-слой (ktk-ai): healthz/readyz/metrics, explain (тренировка / экзамен 403 / ПДн 400 / валидация схемы 422), predict/physics, predict/behaviour, session/review, chat. Работает на stub-LLM (без GPU). |

### MFA (auth)

MFA — стандартный TOTP (RFC 6238, SHA1/30s). Секрет отдаёт
`POST /users/{id}/mfa/setup`, код для `enable`/`login` генерируется локально
(функция `_totp` в `test_auth.py`, без внешних зависимостей).

Привилегированные роли (admin/instructor) **всегда** требуют `mfa_code`
(см. `IsPrivileged`), даже без настроенной MFA — это покрыто тестами.

## Известные ограничения / замечания (на момент написания)

- **gw `/api/v1/auth/login` и `/api/v1/auth/me`** возвращают 404 из-за неверного
  `strip_prefix` в `compose/app/config/gw.toml`: `/api/v1/auth` режется до `/auth/...`,
  а auth-хендлеры висят на `/login`, `/me`. Поэтому авторизация через gw в данных
  тестах не покрывается как «работающая» — токен для gw-тестов берётся напрямую
  из auth.
- Многие `X-Roles`-защищённые эндпоинты внутренних сервисов возвращают
  `403` при отсутствии роли — это корректный trust-boundary сценарий.

### Ранее исправленные баги (теперь покрыты тестами)

- constructor `GET /templates` возвращал 500 `can't scan timestamptz into *string` —
  исправлено (`CreatedAt`/`UpdatedAt` → `time.Time`).
- scenario `GET /scenarios` возвращал 500 (та же причина timestamptz) —
  исправлено.
- constructor `DELETE /components/{id}` падал с
  `could not determine data type of parameter $1` — исправлено (`$1::text`
  в `IsUsedInTemplates`).
- report `POST /reports` с пустым телом возвращал 500 «session_id is required» —
  исправлено (теперь 400, добавлен `domain.ErrBadRequest`).
- assessment `/event` с несуществующим `scenario_id` возвращал 500
  «scenario client: status 404» — исправлено: клиент мапит 404 scenario в
  `domain.ErrScenarioNotFound`, handler отдаёт 404 «not_found».
- ai `/v1/explain` без обязательного поля `alarm` (или без `tag_id`) возвращал
  500 (KeyError) — исправлено: добавлена Pydantic-схема `ExplainRequest`/`AlarmIn`,
  теперь 422 (валидация FastAPI).

## Структура

```
autotests/
├── conftest.py        # фикстуры: клиенты сервисов, токены, базовые URL
├── pytest.ini
├── requirements.txt
└── tests/
    ├── test_auth.py
    ├── test_gw.py
    ├── test_constructor.py
    ├── test_scenario.py
    ├── test_orchestrator.py
    ├── test_assessment.py
    ├── test_snapshot.py
    ├── test_report.py
    └── test_sim_manager.py
```
