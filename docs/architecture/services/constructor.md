# Сервис: Constructor Service — `constructor`

> Слой: Прикладной | Namespace: `ktc-app` | Под: `constructor`

## 1. Назначение

**Ядро конструктора КТК** — управление библиотекой компонентов и шаблонами установок. Хранит типы оборудования, их параметры/порты, графы собранных установок и layout мнемосхем. Обеспечивает валидацию топологии и экспорт конфигурации для Simulation Engine.

## 2. Основные функции

- **CRUD библиотеки компонентов**: типы оборудования (насос, колонна, печь, электродегидратор, реактор и т.д.) с портами, параметрами, иконками, категориями (ЭЛОУ / Атмосфера / ГДМ / Общие).
- **CRUD шаблонов установок**: граф (узлы + рёбра + параметры экземпляров + layout мнемосхемы).
- **Валидация графа**: проверка типов портов (жидкость↔жидкость, сигнал↔сигнал), связность, наличие источника и стока, отсутствие «висячих» обязательных портов.
- **Копирование шаблонов** (deep clone с новым ID).
- **Экспорт**: генерация init-конфигурации для sim (Model API `set_state` начального состояния).
- **Поиск и фильтрация**: каталог компонентов по категориям, тегам, полнотекстовый поиск.

## 3. Технологии

Python/FastAPI. Picodata (метаданные + графы в JSONB), S3 (иконки/SVG компонентов).

## 4. Внутренняя структура

- **Каталог компонентов** (ComponentType): CRUD, категоризация, поиск.
- **Менеджер шаблонов** (InstallationTemplate): CRUD, копирование, привязка к компонентам.
- **Валидатор графа**: проверка топологии, типов связей, ограничений портов.
- **Экспортёр**: преобразование графа → init state для sim.
- **S3-клиент**: хранение/отдача иконок и SVG-символов.

## 5. API / контракты

| Направление | Протокол | Методы |
|---|---|---|
| от `gw` | HTTPS/REST | **Компоненты:** `GET /components`, `GET /components/{id}`, `POST /components`, `PUT /components/{id}`, `DELETE /components/{id}` |
| от `gw` | HTTPS/REST | **Шаблоны:** `GET /templates`, `GET /templates/{id}`, `POST /templates`, `PUT /templates/{id}`, `DELETE /templates/{id}`, `POST /templates/{id}/copy` |
| от `gw` | HTTPS/REST | **Валидация:** `POST /templates/{id}/validate` |
| от `gw` | HTTPS/REST | **Экспорт:** `GET /templates/{id}/export` (init state для sim) |
| от `scenario` | HTTPS/REST | `GET /templates/{id}` (привязка сценария к шаблону) |
| от `orchestrator` | HTTPS/REST | `GET /templates/{id}/export` (при старте сессии) |

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| API Gateway (`gw`) | микросервис | HTTPS/REST, mTLS |
| Scenario Catalog (`scenario`) | микросервис | HTTPS/REST, mTLS |
| Session Orchestrator (`orchestrator`) | микросервис | HTTPS/REST, mTLS |
| Picodata (`db`) | СУБД | SQL (PostgreSQL-wire), TCP/mTLS |
| S3 / MinIO | хранилище | S3 API (HTTPS) |
| Fluent Bit / Пульт | observability | логи, `/metrics` |

## 7. Данные

### Picodata:

**Таблица `component_types`:**
- id, name, category (ЭЛОУ/Атмосфера/ГДМ/Общие), description
- ports (JSONB): `[{id, name, type: liquid|gas|signal|electric, direction: in|out, required: bool}]`
- parameters (JSONB): `[{id, name, unit, default, min, max, type: float|int|enum}]`
- icon_s3_key

**Таблица `installation_templates`:**
- id, name, description, author_id, created_at, updated_at
- graph (JSONB): `{nodes: [...], edges: [...]}`
- layout (JSONB): `{positions: {node_id: {x, y}}, labels: {...}}`

### S3 (MinIO):
- Bucket `component-icons`: SVG/PNG иконки типов

## 8. Объекты Kubernetes (namespace `ktc-app`)

| Объект | Описание |
|---|---|
| Deployment `constructor` | N≥2 реплики, HPA |
| Service `constructor` | ClusterIP |
| NetworkPolicy | accept от `gw`, `scenario`, `orchestrator`; egress к `db`, `s3` |
| Pod + sidecar `istio-proxy` | mTLS |

## 9. Метрики (в Пульт + Графиня)

- Число компонентов в библиотеке, число шаблонов.
- CRUD-операции/сек, латентность.
- Ошибки валидации (частота невалидных графов).
- Время экспорта шаблона.

## 10. Отказоустойчивость / масштабирование

- Stateless, HPA.
- Данные — в Picodata (реплицированная); потеря пода не теряет данные.
- Копирование шаблона — атомарная транзакция в Picodata.

## 11. Открытые вопросы

1. Формат экспорта для sim: JSON-схема init state (согласовать с Model API).
2. Ограничения на размер графа (макс. число узлов/рёбер).
3. Импорт/экспорт шаблонов между инстансами (JSON-файл).
