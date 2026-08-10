# Тест-кейсы платформы «Конструктор КТК» (негативные и позитивные сценарии)

Спецификация тест-кейсов для функционального тестирования платформы КТК **целиком** —
на уровне API (чёрный ящик). Покрывает каждый сервис системы: слой данных,
слой приложений и ИИ-слой.

Документ отражает:

- контракты сервисов: `helper/*.http`;
- автотесты: `autotests/tests/*.py`;
- архитектуру: `docs/architecture/ARCHITECTURE.md`.

Используется как **руководство для ручного и автоматизированного тестирования**,
а также как baseline для интеграционных/приёмочных проверок.

## 1. Общие сведения

### 1.1 Состав системы и порты (dev-окружение)

| Слой | Сервис | Порт | Файл контракта / тестов |
|------|--------|------|--------------------------|
| data | PostgreSQL, Redis, MinIO, NATS, migrator | 5432/7379/9000/... | `compose/data` |
| app | **auth** | 8082 | `auth.http`, `test_auth.py` |
| app | **gw** (API Gateway/BFF) | 8088 | `gw.http`, `test_gw.py` |
| app | **constructor** | 8083 | `constructor.http`, `test_constructor.py` |
| app | **scenario** | 8084 | `scenario.http`, `test_scenario.py` |
| app | **orchestrator** | 8085 | `orchestrator.http`, `test_orchestrator.py` |
| app | **assessment** | 8081 | `assessment.http`, `test_assessment.py` |
| app | **snapshot** | 8086 | `snapshot.http`, `test_snapshot.py` |
| app | **report** | 8087 | `report.http`, `test_report.py` |
| app | **sim-manager** | 8080 | `sim-manager.http`, `test_sim_manager.py` |
| ai (ktk-ai) | **ai-service** | 8080 (REST), 50051 (gRPC) | `test_ai.py` |

### 1.2 Типы тест-кейсов

- **Позитивные (POS)** — ожидаемый «счастливый путь»: успешная аутентификация,
  создание/чтение/обновление/удаление ресурса с корректными данными.
- **Негативные (NEG)** — проверка обработки ошибок: невалидные данные,
  отсутствие ресурса (404), недостаток прав (403), отсутствие/невалидный токен
  (401), нарушение бизнес-правил (400/422/409).

### 1.3 Trust boundary (важно)

JWT валидирует **только gw** через `POST /introspect`. Внутренние сервисы
(constructor, scenario, orchestrator, assessment, snapshot, report, sim-manager)
токен **не проверяют** — они доверяют заголовкам, которые инжектит gw:

- `X-User-ID`
- `X-Roles` (`admin,instructor`)

Поэтому для прямых вызовов внутренних сервисов в шагах указываются эти заголовки,
а RBAC проверяется через gw либо имитацией ролей.

### 1.4 Конвенция ID

`<СЕРВИС>_<NNN>`:

- `AUTH_*` — auth;
- `GW_*` — gw;
- `CON_*` — constructor;
- `SCN_*` — scenario;
- `ORC_*` — orchestrator;
- `ASS_*` — assessment;
- `SNA_*` — snapshot;
- `RPT_*` — report;
- `SIM_*` — sim-manager;
- `AI_*` — ai-service;
- `INT_*` — интеграционные (взаимодействие пары/цепочки микросервисов);
- `E2E_*` — сквозные (кросс-сервисные) сценарии.

---

## 2. auth (аутентификация и пользователи)

### 2.1 Логин

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-001 | Успешный вход оператора с выдачей токенов | POS | Существует оператор `operator/operator123` | `POST /login {login, password}` | 200; в ответе `access_token`, `refresh_token`, `token_type=Bearer`, `expires_in=900` | Высокий |
| AUTH-002 | Вход привилегированной роли требует MFA | POS | Существуют `admin`, `instructor` | `POST /login` без `mfa_code` для admin | 200; `{"mfa_required": true}` | Высокий |
| AUTH-003 | Вход привилегированной роли с корректным MFA | POS | Настроен MFA у admin | `POST /login {login, password, mfa_code}` с валидным TOTP | 200; выдаются токены | Высокий |
| AUTH-004 | Неверный пароль | NEG | Существует `operator` | `POST /login` с неверным паролем | 401; `code=invalid_credentials` | Высокий |
| AUTH-005 | Несуществующий пользователь | NEG | — | `POST /login` с логином `no-such-user-xyz` | 401; `code=invalid_credentials` | Средний |
| AUTH-006 | Логин чувствителен к регистру | NEG | Существует `operator` | `POST /login` с `OPERATOR` (верхний регистр) | 401; `code=invalid_credentials` | Низкий |
| AUTH-007 | Отсутствуют обязательные поля | NEG | — | `POST /login` только с `login` | 400; `required` в `error` | Высокий |
| AUTH-008 | Пустое тело запроса | NEG | — | `POST /login` с `{}` | 400; `required` в `error` | Высокий |
| AUTH-009 | Битый JSON | NEG | — | `POST /login` с `"{bad json"` | 400; `code=bad_request` | Средний |
| AUTH-010 | Неверный MFA-код | NEG | admin требует MFA | `POST /login` с `mfa_code=000000` | 401; `code=mfa_invalid` | Средний |

### 2.2 Refresh

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-011 | Ротация refresh-токена | POS | Получен refresh-токен оператора | `POST /refresh {refresh_token}` | 200; новые `access_token` и `refresh_token`, refresh отличается от старого | Высокий |
| AUTH-012 | Невалидный refresh-токен | NEG | — | `POST /refresh {refresh_token:"garbage"}` | 401; `code=token_invalid` | Средний |
| AUTH-013 | Отсутствует refresh-токен | NEG | — | `POST /refresh {}` | 400; `required` в `error` | Средний |
| AUTH-014 | Битый JSON | NEG | — | `POST /refresh` с `"["` | 400; `code=bad_request` | Низкий |
| AUTH-015 | Refresh после logout отклоняется | NEG | Получен refresh-токен | 1) logout; 2) `POST /refresh` тем же токеном | 401 (токен отозван) | Высокий |

### 2.3 Logout

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-016 | Успешный logout | POS | Получен refresh-токен | `POST /logout {refresh_token}` | 200 | Высокий |
| AUTH-017 | Logout с невалидным токеном | NEG | — | `POST /logout {refresh_token:"garbage"}` | 401; `code=token_invalid` | Средний |
| AUTH-018 | Logout без токена | NEG | — | `POST /logout {}` | 400 | Средний |

### 2.4 me (текущий пользователь)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-019 | Получение профиля с токеном | POS | Получен access-токен оператора | `GET /me` с `Authorization: Bearer` | 200; в теле `login`, `id`, `roles` | Высокий |
| AUTH-020 | Профиль без токена | NEG | — | `GET /me` | 401 | Высокий |
| AUTH-021 | Профиль с невалидным токеном | NEG | — | `GET /me` с `Bearer garbage` | 401 | Высокий |

### 2.5 introspect

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-022 | Интроспекция валидного токена | POS | Получен access-токен оператора | `POST /introspect {token}` | 200; `active=true`, `login` совпадает | Высокий |
| AUTH-023 | Интроспекция мусорного токена | NEG | — | `POST /introspect {token:"garbage"}` | 200 (не 500); `active=false` | Средний |
| AUTH-024 | Интроспекция пустого токена | NEG | — | `POST /introspect {token:""}` | 200; `active=false` | Низкий |
| AUTH-025 | Интроспекция с битым JSON | NEG | — | `POST /introspect` с `"{"` | 400; `code=bad_request` | Низкий |

### 2.6 Пользователи

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-026 | Список пользователей с токеном | POS | Получен access-токен | `GET /users?limit=50&offset=0` с Bearer | 200; в списке `admin`, `instructor`, `operator` | Высокий |
| AUTH-027 | Список пользователей без токена | NEG | — | `GET /users` | 401 | Средний |
| AUTH-028 | Получение несуществующего пользователя | NEG | — | `GET /users/no-such-user` | 404; `code=user_not_found` | Средний |

### 2.7 MFA

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AUTH-029 | MFA setup возвращает секрет | POS | Есть доступация к users | `POST /users/{id}/mfa/setup` | 200; `secret` — base32 (`[A-Z2-7]{16,}`) | Средний |
| AUTH-030 | MFA setup для несуществующего пользователя | NEG | — | `POST /users/{uuid}/mfa/setup` | 404; `code=user_not_found` | Средний |
| AUTH-031 | MFA enable с корректным кодом | POS | Получен секрет | 1) setup; 2) `POST /users/{id}/mfa/enable {code:TOTP}` | 200; `enabled=true` | Высокий |
| AUTH-032 | MFA enable с неверным кодом | NEG | Получен секрет | `POST /users/{id}/mfa/enable {code:000000}` | 401; `code=mfa_invalid` | Высокий |
| AUTH-033 | MFA enable для несуществующего пользователя | NEG | — | `POST /users/{uuid}/mfa/enable` | 404; `code=user_not_found` | Средний |
| AUTH-034 | Статус MFA | POS | Существует пользователь | `GET /users/{id}/mfa` | 200; в ответе поле `enabled` | Низкий |
| AUTH-035 | Статус MFA для несуществующего пользователя | NEG | — | `GET /users/{uuid}/mfa` | 404; `code=user_not_found` | Низкий |

---

## 3. gw (шлюз)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| GW-001 | healthz | POS | Сервис поднят | `GET /healthz` | 200; `status=ok` | Высокий |
| GW-002 | Обращение к защищённому маршруту без токена | NEG | — | `GET /api/v1/auth/me` без токена | 401 (или 403) | Высокий |
| GW-003 | Admin-маршрут без токена | NEG | — | `GET /api/v1/users` без токена | 401/403 | Высокий |
| GW-004 | Доступ operator к admin-маршруту запрещён | NEG | Получен токен оператора | `GET /api/v1/users` с токеном оператора | 403; в теле признак `forbidden` | Высокий |
| GW-005 | Авторизованный доступ operator к /sessions | POS | Получен токен оператора | `GET /api/v1/sessions` с токеном оператора | 200 (проксируется в orchestrator) | Высокий |
| GW-006 | Отбрасывание невалидного токена | NEG | — | `GET /api/v1/sessions` с `Bearer garbage` | 401/403 | Средний |
| GW-007 | Проксирование несуществующего ресурса к внутреннему сервису | POS | Есть токен | `GET /api/v1/components/{нет-id}` | 404 (проксировано в constructor) | Средний |

> **Известное ограничение:** `GET /api/v1/auth/login` и `/api/v1/auth/me` на
> текущем `strip_prefix` в `gw.toml` возвращают 404 (маршрут режется некорректно).
> Покрывается напрямую в auth. Не является целью для позитив-кейсов gw.

---

## 4. constructor (компоненты и шаблоны)

### 4.1 Компоненты

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| CON-001 | Список компонентов | POS | Есть компоненты в БД, роль instructor/admin | `GET /components?category=&q=&limit=50&offset=0` | 200; список компонентов | Высокий |
| CON-002 | Создание компонента | POS | Роль instructor/admin | `POST /components` с корректным телом | 200/201; компонент создан | Высокий |
| CON-003 | Получение компонента по ID | POS | Компонент создан | `GET /components/{id}` | 200; поля совпадают | Высокий |
| CON-004 | Обновление компонента | POS | Компонент создан | `PUT /components/{id}` | 200; изменения сохранены | Высокий |
| CON-005 | Удаление компонента | POS | Компонент создан, не используется | `DELETE /components/{id}` | 200; компонент удалён | Средний |
| CON-006 | Загрузка иконки компонента | POS | Компонент создан | `POST /components/{id}/icon` (multipart PNG) | 200; иконка сохранена | Низкий |
| CON-007 | Получение несуществующего компонента | NEG | — | `GET /components/{нет-id}` | 404 | Средний |
| CON-008 | RBAC: компоненты без роли | NEG | Нет заголовков ролей | `GET /components` без `X-Roles` | 403 | Высокий |
| CON-009 | RBAC: operator на создание компонента | NEG | Роль operator | `POST /components` | 403 | Высокий |
| CON-010 | Создание компонента с некорректными данными (без name) | NEG | Роль admin | `POST /components` без `name` | 400/422 | Средний |
| CON-011 | Удаление используемого компонента (force=false) | NEG | Компонент входит в шаблон | `DELETE /components/{id}` без force | 4xx (зависимость) | Средний |

### 4.2 Шаблоны

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| CON-012 | Список шаблонов | POS | Есть шаблоны | `GET /templates?status=&q=&limit=50&offset=0` | 200; список шаблонов | Высокий |
| CON-013 | Создание шаблона | POS | Роль instructor/admin | `POST /templates` с корректным телом (name, description, graph) | 200/201 | Высокий |
| CON-014 | Получение шаблона | POS | Шаблон создан | `GET /templates/{id}` | 200 | Высокий |
| CON-015 | Обновление шаблона | POS | Шаблон создан | `PUT /templates/{id}` | 200 | Высокий |
| CON-016 | Копирование шаблона | POS | Шаблон создан | `POST /templates/{id}/copy {new_name}` | 200; создана копия | Средний |
| CON-017 | Валидация шаблона (валидный) | POS | Шаблон создан | `POST /templates/{id}/validate` | 200; ошибок нет | Средний |
| CON-018 | Экспорт шаблона (init-state для sim) | POS | Шаблон создан | `GET /templates/{id}/export` | 200; возвращается init-state | Низкий |
| CON-019 | Экспорт шаблона файлом | POS | Шаблон создан | `GET /templates/{id}/export-file` | 200/файл | Низкий |
| CON-020 | Импорт шаблона | POS | — | `POST /templates/import` с корректным телом | 200; шаблон импортирован | Низкий |
| CON-021 | Валидация несуществующего шаблона | NEG | — | `POST /templates/{нет-id}/validate` | 404 | Средний |
| CON-022 | Удаление шаблона | POS | Шаблон существует | `DELETE /templates/{id}?force=false` | 200 | Средний |
| CON-023 | RBAC: шаблоны без роли | NEG | — | `POST /templates` без `X-Roles` | 403 | Высокий |
| CON-024 | Создание шаблона с пустым graph | NEG | Роль admin | `POST /templates` с пустым `graph` | 400/422 | Средний |

---

## 5. scenario (сценарии и неисправности)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| SCN-001 | Список сценариев | POS | Есть сценарии | `GET /scenarios?template_id=&type=&q=&limit=50&offset=0` | 200; список | Высокий |
| SCN-002 | Создание сценария | POS | Роль instructor/admin, есть template | `POST /scenarios` с корректным телом | 200/201 | Высокий |
| SCN-003 | Получение сценария | POS | Сценарий создан | `GET /scenarios/{id}` | 200 | Высокий |
| SCN-004 | Обновление сценария | POS | Сценарий создан | `PUT /scenarios/{id}` | 200 | Высокий |
| SCN-005 | Удаление сценария | POS | Сценарий создан | `DELETE /scenarios/{id}` | 200 | Средний |
| SCN-006 | Клонирование сценария | POS | Сценарий создан | `POST /scenarios/{id}/clone {template_id}` | 200; создан клон | Средний |
| SCN-007 | Полный сценарий (со всеми подресурсами) | POS | Сценарий создан | `GET /scenarios/{id}/full` | 200; все подресурсы | Средний |
| SCN-008 | Экзаменационный сценарий по шаблону | POS | Есть template со сценарием exam | `GET /scenarios/exam?template_id={id}` | 200; exam-сценарий | Средний |
| SCN-009 | Список моделей неисправностей | POS | Данные загружены | `GET /faults?component_type=&severity=` | 200; список неисправностей | Высокий |
| SCN-010 | Модель неисправности по ID | POS | Неисправность существует | `GET /faults/{id}` | 200 | Средний |
| SCN-011 | Получение несуществующего сценария | NEG | — | `GET /scenarios/{нет-id}` | 404 | Средний |
| SCN-012 | RBAC: создание сценария без роли | NEG | — | `POST /scenarios` без `X-Roles` | 403 | Высокий |
| SCN-013 | Создание сценария с несуществующим template_id | NEG | Роль admin | `POST /scenarios {template_id:нет-id}` | 404/400 | Средний |
| SCN-014 | Создание сценария без name | NEG | Роль admin | `POST /scenarios` без `name` | 400/422 | Средний |

---

## 6. orchestrator (сессии)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| ORC-001 | Список сессий | POS | Есть сессии | `GET /sessions?status=&operator_id=` | 200 | Высокий |
| ORC-002 | Создание сессии | POS | Есть template и scenario | `POST /sessions {template_id, scenario_id, operator_ids, mode, speed}` | 200/201; сессия создана | Высокий |
| ORC-003 | Получение сессии | POS | Сессия создана | `GET /sessions/{id}` | 200 | Высокий |
| ORC-004 | Запуск сессии | POS | Сессия в статусе ready | `POST /sessions/{id}/start` | 200; сессия запущена | Высокий |
| ORC-005 | Пауза сессии | POS | Сессия запущена | `POST /sessions/{id}/pause` | 200; сессия на паузе | Средний |
| ORC-006 | Остановка сессии | POS | Сессия запущена | `POST /sessions/{id}/stop` | 200; сессия остановлена | Средний |
| ORC-007 | Изменение скорости | POS | Сессия запущена | `PUT /sessions/{id}/speed {factor:2.0}` | 200; скорость изменена | Средний |
| ORC-008 | Сохранение checkpoint | POS | Сессия запущена | `POST /sessions/{id}/checkpoint {name}` | 200; снапшот создан | Средний |
| ORC-009 | Восстановление из снапшота | POS | Есть snapshot | `POST /sessions/{id}/restore {snapshot_id}` | 200; сессия восстановлена | Средний |
| ORC-010 | Управление исполнительным механизмом | POS | Сессия запущена | `POST /sessions/{id}/actuator {tag, value}` | 200 | Средний |
| ORC-011 | Acknowledgement аларма | POS | У сессии есть аларм | `POST /sessions/{id}/alarms/{alarmId}/ack` | 200 | Низкий |
| ORC-012 | Получение несуществующей сессии | NEG | — | `GET /sessions/{нет-id}` | 404 | Средний |
| ORC-013 | RBAC/валидация: старт без прав | NEG | Нет ролей | `POST /sessions/{id}/start` без `X-Roles` | 403 | Средний |
| ORC-014 | Создание сессии без scenario_id | NEG | — | `POST /sessions` без `scenario_id` | 400/422 | Средний |
| ORC-015 | Смена скорости на незапущенной сессии | NEG | Сессия не запущена | `PUT /sessions/{id}/speed` | 409/400 | Средний |
| ORC-016 | Создание сессии с несуществующим scenario | NEG | — | `POST /sessions {scenario_id:нет-id}` | 404/400 | Средний |

---

## 7. assessment (оценка)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| ASS-001 | Приём события действия оператора | POS | Существует валидный сценарий в БД | `POST /assessment/event` с валидным телом и `X-Roles: admin` | 2xx | Высокий |
| ASS-002 | Получение оценки сессии | POS | Для сессии собраны события | `GET /assessment/session/{id}/score` | 200; структура оценки | Высокий |
| ASS-003 | Формирование финального результата | POS | Сессия завершена | `POST /assessment/session/{id}/result` | 200; итоговый результат | Средний |
| ASS-004 | Переопределение оценки (instructor/admin) | POS | Сессия существует | `POST /assessment/override {session_id, new_score, verdict}` | 200 | Средний |
| ASS-005 | Данные для replay | POS | Сессия существует | `GET /assessment/session/{id}/replay` | 200; данные для replay | Средний |
| ASS-006 | Оценка отсутствующей сессии | NEG | — | `GET /assessment/session/{нет-id}/score` | 404; `title=not_found` | Средний |
| ASS-007 | Событие с несуществующим scenario_id | NEG | — | `POST /assessment/event` с несуществующим `scenario_id` | 404; `title=not_found` (регрессия: раньше 500) | Высокий |
| ASS-008 | Пустое тело события | NEG | — | `POST /assessment/event` с `{}` | 400/422 | Средний |
| ASS-009 | Override без тела | NEG | — | `POST /assessment/override` с `{}` | 400/422 | Средний |
| ASS-010 | Replay отсутствующей сессии | NEG | — | `GET /assessment/session/{нет-id}/replay` | 404 (либо 200 при fallback) | Низкий |
| ASS-011 | RBAC: override без привилегированной роли | NEG | Роль operator | `POST /assessment/override` | 403 | Высокий |

---

## 8. snapshot (снапшоты)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| SNA-001 | Список снапшотов | POS | Есть снапшоты | `GET /snapshots?session_id=&is_preset=&limit=50&offset=0` | 200; список метаданных | Высокий |
| SNA-002 | Получение снапшота по ID | POS | Снапшот создан | `GET /snapshots/{id}` | 200 | Средний |
| SNA-003 | Удаление снапшота (не preset) | POS | Снапшот не является preset | `DELETE /snapshots/{id}` | 200 | Средний |
| SNA-004 | Получение несуществующего снапшота | NEG | — | `GET /snapshots/{нет-id}` | 404 | Средний |
| SNA-005 | Удаление preset-снапшота | NEG | Снапшот является preset | `DELETE /snapshots/{id}` (preset) | 4xx (удалять preset нельзя) | Средний |
| SNA-006 | RBAC: снапшоты без роли | NEG | — | `GET /snapshots` без `X-Roles` | 403 | Средний |

---

## 9. report (отчёты)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| RPT-001 | Запрос отчёта | POS | Сессия завершена | `POST /reports {session_id, type:"exam"}` | 202 Accepted; задача в NATS, затем отчёт создаётся | Высокий |
| RPT-002 | Список отчётов | POS | Отчёты созданы | `GET /reports?session_id=` | 200; список | Средний |
| RPT-003 | Получение отчёта по ID | POS | Отчёт создан | `GET /reports/{id}` | 200 | Средний |
| RPT-004 | Скачивание отчёта | POS | Отчёт готов | `GET /reports/{id}/download` | 302 redirect на storage | Средний |
| RPT-005 | Запрос отчёта с пустым телом | NEG | — | `POST /reports` с `{}` | 400 (регрессия: раньше 500) | Высокий |
| RPT-006 | Получение несуществующего отчёта | NEG | — | `GET /reports/{нет-id}` | 404 | Средний |
| RPT-007 | Запрос отчёта с несуществующей сессией | NEG | — | `POST /reports {session_id:нет-id}` | 404/400 | Средний |
| RPT-008 | Скачивание несуществующего отчёта | NEG | — | `GET /reports/{нет-id}/download` | 404 | Низкий |
| RPT-009 | Запрос отчёта без type | NEG | — | `POST /reports {session_id}` без `type` | 400/422 | Средний |

---

## 10. sim-manager (диспетчер simulation engine)

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| SIM-001 | Создание инстанса sim-worker под сессию | POS | Есть сессия | `POST /sessions {session_id, image, init_state_ref}` | 200/201; инстанс создан (1 сессия = 1 инстанс) | Высокий |
| SIM-002 | Список инстансов и квота | POS | Инстансы созданы | `GET /sessions` | 200; список и квота | Средний |
| SIM-003 | Статус инстанса сессии | POS | Инстанс создан | `GET /sessions/{session_id}` | 200; статус | Средний |
| SIM-004 | Остановка (удаление) инстанса | POS | Инстанс существует | `DELETE /sessions/{session_id}` | 200; инстанс удалён | Средний |
| SIM-005 | Статус несуществующего инстанса | NEG | — | `GET /sessions/{нет-id}` | 404 | Средний |
| SIM-006 | Создание инстанса без session_id | NEG | — | `POST /sessions` без `session_id` | 400/422 | Средний |
| SIM-007 | Удаление несуществующего инстанса | NEG | — | `DELETE /sessions/{нет-id}` | 404 | Низкий |

> Сервис вне dev-compose; помечен маркером `sim` в автотестах.

---

## 11. ai-service (ИИ-слой, ктk-ai)

### 11.1 Служебные

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AI-001 | healthz | POS | Сервис поднят | `GET /healthz` | 200; `status=ok` | Высокий |
| AI-002 | readyz | POS | Сервис поднят | `GET /readyz` | 200; dict | Высокий |
| AI-003 | metrics | POS | Сервис поднят | `GET /metrics` | 200 (Prometheus-формат) | Низкий |

### 11.2 /v1/explain

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AI-004 | Тренинговая подсказка | POS | stub-LLM | `POST /v1/explain` с `alarm`, `tag_window`, `session_mode=TRAINING` | 200; `cause`, `recommendation`, `latency_ms` | Высокий |
| AI-005 | Экзамен: подсказки запрещены | NEG | stub-LLM | `POST /v1/explain` с `session_mode=EXAM` | 403; `EXAM_MODE_BLOCKED` | Высокий |
| AI-006 | ПДн в теле отклоняются | NEG | stub-LLM | добавить `fio`, `phone` в тело | 400 | Высокий |
| AI-007 | Отсутствует обязательное поле alarm | NEG | stub-LLM | `POST /v1/explain` без `alarm` | 400/422 (регрессия: раньше 500) | Высокий |
| AI-008 | alarm без tag_id | NEG | stub-LLM | `alarm` без `tag_id` | 400/422 (регрессия: раньше 500) | Средний |

### 11.3 /v1/chat

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AI-009 | Чат в тренировке | POS | stub-LLM | `POST /v1/chat {question, session_mode:TRAINING}` | 200; `answer` | Высокий |
| AI-010 | Чат без question | NEG | stub-LLM | `POST /v1/chat {session_mode:TRAINING}` | 422 (валидация схемы) | Средний |

### 11.4 /v1/predict

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AI-011 | Прогноз по физике | POS | stub-LLM | `POST /v1/predict/physics` с серией и пределами | 200; `predictions`, `degraded=false` | Высокий |
| AI-012 | Прогноз поведения | POS | stub-LLM | `POST /v1/predict/behaviour` с действием и состоянием | 200; `risk_level`, `visible_to_operator` | Высокий |
| AI-013 | Прогноз без series | NEG | stub-LLM | `POST /v1/predict/physics` без `series` | 422 | Средний |
| AI-014 | ПДн в predict/behaviour | NEG | stub-LLM | добавить ПДн-поле | 400 | Средний |

### 11.5 /v1/session/review

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| AI-015 | Итоговая оценка сессии | POS | stub-LLM | `POST /v1/session/review` с actions/alarms/reference/criteria | 200; `score`, `passed`, `penalties`, `steps` | Высокий |
| AI-016 | Оценка с флагом degraded | POS | stub-LLM | `POST /v1/session/review` без reference, `with_debrief=true` | 200; `degraded` в ответе | Средний |
| AI-017 | Оценка без criteria | NEG | stub-LLM | `POST /v1/session/review` без `criteria` | 422 | Средний |

---

## 12. Интеграционные сценарии (взаимодействие микросервисов)

Проверяют **связки** между сервисами: клиент → сервис, пары/цепочки,
асинхронные потоки (NATS), общий слой данных (PostgreSQL/Picodata), блочное
хранилище (MinIO) и MFA-интроспекцию. В отличие от E2E (бизнес-потоки сверху
вниз), здесь каждый кейс адресует **конкретную интеграционную точку** и то,
что происходит на стыке при успехе и при сбое.

Схема основных зависимостей (по `internal/client` и `compose/app`):

```
             ┌─────────────── gw (BFF) ───────────────┐
             │  introspect JWT → auth                  │
             ▼                                        ▼
  auth ◄── introspection            constructor ◄── orchestrator (ExportTemplate)
  assessment ◄── scenario (GetScenario)              scenario ◄── orchestrator (GetFullScenario/Exam)
  orchestrator ──► assessment (SendEvent/Score/Finalize)
  orchestrator ──► snapshot (Save/Restore)
  orchestrator/sim-manager ── NATS (sim.tasks / ai.tasks) ──► sim-engine / ai-service
  report ◄── NATS (report.tasks); report → MinIO (скачивание PDF)
  все ──► PostgreSQL (Picodata) / Redis
```

### 12.1 Кросс-сервисные пары (синхронные HTTP)

| ID | Название | Тип | Связка | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|--------|-------------|------|----------------------|-----------|
| INT-001 | gw валидирует JWT через auth при проксировании | POS | gw → auth (`/introspect`) | Подняты gw+auth+сервис назначения | 1) login в auth; 2) запрос через gw к защищённому маршруту с токеном | gw проксирует к сервису; ответ 2xx; интроспекция прошла (`active=true`) | Высокий |
| INT-002 | gw отклоняет запрос при неактивном токене auth | NEG | gw → auth | Токен отозван (logout) или мусорный | Запрос через gw с невалидным/отозванным токеном | 401/403 на gw; к внутреннему сервису запрос НЕ дошёл | Высокий |
| INT-003 | Аутентификация admin через gw с MFA | POS | gw → auth (login+MFA) | admin требует MFA | `POST /api/v1/auth/login` с `mfa_code` через gw | 200; токены; далее 2xx на защищённые маршруты | Высокий |
| INT-004 | assessment получает сценарий из scenario | POS | assessment → scenario (`GetScenario`) | Существует сценарий в scenario | `POST /assessment/event` с валидным `scenario_id` и `X-Roles: admin` | 2xx; assessment успешно загрузил сценарий | Высокий |
| INT-005 | assessment при отсутствии сценария в scenario | NEG | assessment → scenario | Сценария нет | `POST /assessment/event` с несуществующим `scenario_id` | **404** (не 500); клиент мапит 404 в `ErrScenarioNotFound` | Высокий |
| INT-006 | orchestrator экспортирует init-state из constructor | POS | orchestrator → constructor (`ExportTemplate`) | Есть шаблон в constructor | Создать/запустить сессию, требующую init-state шаблона | orchestrator получил данные шаблона; сессия создана 2xx | Высокий |
| INT-007 | orchestrator загружает сценарий из scenario при старте | POS | orchestrator → scenario (`GetFullScenario`) | Есть сценарий | `POST /sessions/{id}/start` | 2xx; сессия стартовала с полным сценарием | Высокий |
| INT-008 | orchestrator берёт экзаменационный сценарий по шаблону | POS | orchestrator → scenario (`GetRandomExam`) | Есть шаблон с exam-сценарием | Запуск экзаменационной сессии по `template_id` | 2xx; выбран случайный exam-сценарий | Средний |
| INT-009 | orchestrator отправляет события в assessment | POS | orchestrator → assessment (`SendEvent`) | Сессия запущена | Действие оператора в session → orchestrator фиксирует событие | assessment получает событие; далее score учитывает его | Высокий |
| INT-010 | orchestrator финализирует оценку в assessment | POS | orchestrator → assessment (`Finalize`) | Сессия завершена | Остановить сессию → orchestrator вызывает финализацию | assessment формирует итог; 2xx | Высокий |
| INT-011 | orchestrator снимает checkpoint в snapshot | POS | orchestrator → snapshot (`Save`) | Сессия запущена | `POST /sessions/{id}/checkpoint` | 2xx; снапшот сохранён (id, sha256) | Средний |
| INT-012 | orchestrator восстанавливает сессию из snapshot | POS | orchestrator → snapshot (`Restore`) | Есть снапшот | `POST /sessions/{id}/restore` | 2xx; состояние восстановлено | Средний |
| INT-013 | orchestrator при недоступности snapshot | NEG | orchestrator → snapshot | snapshot не отвечает | `POST /sessions/{id}/checkpoint` / `restore` | 5xx/таймаут НЕ повисает; понятная ошибка, нет полу-записанного состояния | Средний |
| INT-014 | orchestrator при недоступности scenario | NEG | orchestrator → scenario | scenario не отвечает | `POST /sessions/{id}/start` | понятная ошибка (не висящий клиент); сессия не запущена частично | Средний |

### 12.2 Асинхронные потоки (NATS JetStream)

| ID | Название | Тип | Связка | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|--------|-------------|------|----------------------|-----------|
| INT-015 | Запрос отчёта публикует задачу и генерируется PDF | POS | report ← NATS (`report.tasks`) | NATS поднят, MinIO готов | 1) `POST /reports`; 2) подождать; 3) `GET /reports/{id}`; 4) `GET /reports/{id}/download` | 202 → отчёт появляется → download 302 redirect на MinIO | Высокий |
| INT-016 | Очередь отчётов не теряет задачу при однократном сбое | POS | report ← NATS | NATS поднят | Публикация задачи; потребитель временно недоступен, затем поднимается | задача обрабатывается повторно/не теряется (redelivery) | Средний |
| INT-017 | Публикация в несуществующий stream | NEG | report ← NATS | Stream `report.tasks` не создан | `POST /reports` | 5xx/ошибка публикации, но сервис не падает; понятное сообщение | Средний |
| INT-018 | Отчёт по сессии, файл отсутствует в MinIO | NEG | report → MinIO | Отчёт есть в БД, файла нет в бакете | `GET /reports/{id}/download` | 404/ошибка storage (не 500-креш генератора) | Средний |

### 12.3 Общий слой данных (PostgreSQL/Redis)

| ID | Название | Тип | Связка | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|--------|-------------|------|----------------------|-----------|
| INT-019 | Данные, созданные в constructor, видит scenario (БД) | POS | constructor ↔ scenario (общая БД) | PostgreSQL поднят | 1) создать шаблон в constructor; 2) создать сценарий в scenario с `template_id` этого шаблона | сценарий создан; внешний ключ по шаблону совпал | Высокий |
| INT-020 | Сценарий с несуществующим template в БД | NEG | constructor ↔ scenario (общая БД) | template_id не существует | `POST /scenarios` с чужим `template_id` | 400/404; нет частичной записи | Средний |
| INT-021 | Перезапуск слоя данных не теряет постоянные сущности | POS | все → PostgreSQL/Redis | сервисы и БД подняты | 1) создать данные; 2) `docker compose restart` для data; 3) прочитать данные | данные сохранились (volume), чтение 2xx | Средний |
| INT-022 | MFA-секрет хранится в shared-хранилище и сохраняется | POS | auth → хранилище | MFA настроен | 1) setup; 2) enable; 3) перезапуск auth; 4) логин с тем же секретом | TOTP продолжает работать | Средний |

### 12.4 ИИ-слой в связке

| ID | Название | Тип | Связка | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|--------|-------------|------|----------------------|-----------|
| INT-023 | orchestrator направляет ИИ-задачу и получает результат | POS | orchestrator → ai-service (NATS/`ai.tasks`) | ai поднят, stub-LLM | Эскалация ИИ-задачи из сессии | ai-service обрабатывает, результат возвращается/сохраняется; 2xx | Средний |
| INT-024 | ИИ-сервис недоступен — сессия продолжается (degraded) | NEG | orchestrator → ai-service | ai-service остановлен | Действие в сессии, требующее ИИ-подсказки | система деградирует (degraded-флаг), но НЕ 500-крепл сессию | Высокий |
| INT-025 | Связка assessment score и ИИ session/review согласованы | POS | assessment ↔ ai-service | обе оценки воспроизводимы | Прогнать одни события в assessment и в `ai /v1/session/review` | обе структуры валидны; при идентичных данных тенденция совпадает | Низкий |

---

## 13. Сквозные (E2E) сценарии

Кросс-сервисные бизнес-потоки через gw или напрямую (верхнеуровневые сценарии,
использующие интеграционные связки из раздела 12).

| ID | Название | Тип | Предусловия | Шаги | Ожидаемый результат | Приоритет |
|----|----------|-----|-------------|------|----------------------|-----------|
| E2E-001 | Полный цикл авторизации через gw | POS | Подняты auth+gw | 1) login через gw; 2) GET /api/v1/auth/me; 3) logout | login→200, me→200, logout→200 | Высокий |
| E2E-002 | Аутентификация без токена и последующий доступ | NEG | Подняты gw | 1) запрос без токена; 2) login; 3) повтор запроса | 1) 401/403; 2) 200 токены; 3) 200 | Высокий |
| E2E-003 | Создание установки от компонента до сценария | POS | Роли instructor/admin, БД | 1) создать компонент (constructor); 2) создать шаблон; 3) создать сценарий (scenario) | каждый шаг 2xx, ресурсы созданы | Высокий |
| E2E-004 | Запуск тренировочной сессии и эскалация в assessment | POS | Есть сценарий+шаблон | 1) POST session (orchestrator); 2) start; 3) event (assessment); 4) score | 1-3 → 2xx, 4 → 200 с оценкой | Высокий |
| E2E-005 | session/review ИИ vs assessment score | POS | stub-LLM, сценарий | 1) собрать события; 2) AI session/review; 3) assessment score | обе оценки 2xx с валидной структурой | Средний |
| E2E-006 | Несуществующий ресурс сквозь шлюз | NEG | Поднят gw | `GET /api/v1/components/нет-id` с токеном | 404, без 500 | Средний |
| E2E-007 | RBAC: operator на сценарии через шлюз | NEG | Токен operator, gw | `POST /api/v1/scenarios` с токеном operator | 403 | Высокий |
| E2E-008 | Снятие checkpoint → snapshot → restore | POS | Сессия запущена | 1) checkpoint (orchestrator); 2) список snapshot; 3) restore | все 2xx; снапшот создан и применён | Средний |
| E2E-009 | Отчёт по завершённой сессии | POS | Сессия завершена | 1) POST /reports; 2) дождаться генерации; 3) download | 202 → отчёт готов → 302 redirect | Средний |
| E2E-010 | Сквозной негатив: сломанный токен во всех сервисах | NEG | Подняты сервисы | обратиться к каждому защищённому эндпоинту с `Bearer garbage` | 401/403, нигде 500 | Высокий |

---

## 14. Матрица покрытия

| Сервис / группа | Позитив | Негатив | Итого кейсов |
|--------|:-------:|:-------:|:------------:|
| auth | 11 | 24 | 35 |
| gw | 3 | 4 | 7 |
| constructor | 16 | 8 | 24 |
| scenario | 10 | 4 | 14 |
| orchestrator | 11 | 5 | 16 |
| assessment | 5 | 6 | 11 |
| snapshot | 3 | 3 | 6 |
| report | 4 | 5 | 9 |
| sim-manager | 4 | 3 | 7 |
| ai-service | 9 | 8 | 17 |
| интеграция (INT_*) | 17 | 8 | 25 |
| E2E | 6 | 4 | 10 |
| **Итого** | **99** | **82** | **181** |

---

## 15. Сопоставление с автотестами

Каждый тест-кейс выше либо уже покрыт, либо готов к покрытию в
`autotests/tests/*.py`. Ключевые регрессии, закрытые ранее исправленными багами:

- **ASS-007 / INT-005** — assessment `/event` с несуществующим scenario → 404 (было 500).
- **AI-007/AI-008** — `/v1/explain` без `alarm`/`tag_id` → 422 (было 500).
- **RPT-005** — `POST /reports` с пустым телом → 400 (было 500).
- **CON-011 / timestamptz** — constructor/scenario список: исправлены 500 на чтении `timestamptz`.

### Интеграционные кейсы (INT_*)

Раздел 12 описывает **взаимодействие микросервисов** по реальным зависимостям
из `internal/client` и `compose/app`:

- **связки «клиент → сервис»** и их поведение при успехе/сбое (INT-001…INT-014);
- **асинхронные потоки** через NATS JetStream: `report.tasks` (отчёт), `ai.tasks`
  (ИИ-эскалация), `sim.tasks` (симуляция) — INT-015…INT-018;
- **общий слой данных** (PostgreSQL, Redis, MinIO) между сервисами — INT-019…INT-022;
- **связка с ИИ-слоем**, включая degraded-режим — INT-023…INT-025.

На текущий момент часть INT-кейсов (например INT-005) уже закрыта регрессионными
тестами; остальные требуют **интеграционного стенда** (несколько сервисов сразу)
и готовы к автоматизации в `autotests`.

Источники ожидаемых результатов:

- `autotests/tests/test_auth.py`, `test_gw.py`, `test_ai.py`, `test_assessment.py` и др.
- `helper/*.http` — готовые запросы для ручного прогона.
- `services/go/*/internal/client/*.go` — реальные клиенты и связки микросервисов.

---

## 16. Команды для прогона

```bash
# все автотесты (кроме sim)
cd autotests && python3 -m pytest -m "not sim"

# конкретный сервис
python3 -m pytest tests/test_auth.py -v

# включая sim-manager (если поднят)
python3 -m pytest
```
