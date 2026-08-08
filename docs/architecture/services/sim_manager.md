# Сервис: Simulation Manager — `sim-manager`

> Слой: Вычислительный | Namespace: `ktc-sim` (Node Pool `sim`) | Под: `sim-manager`
> Смежно: `sim_worker.md` (движок модели), `Simulation_Engine_модель_namespace_k8s.md`, `Реестр_сервисов...`, `Архитектура_КТК_K8s.drawio`

## 1. Назначение

**Диспетчер (control-plane) Simulation Engine** — управляет жизненным циклом `sim-worker` инстансов. Сам **не** считает модель; его задача — создавать/удалять и контролировать изолированные экземпляры движка под сессии, следить за квотой и утилизацией, поддерживать их «живыми» (self-healing). Отвечает перед `orchestrator` за готовность движка к старту сессии и его корректный стоп.

> Разделение ролей: `sim-worker` — **runtime** (Model API, математика); `sim-manager` — **control-plane** (инстансы, провайдер среды, желаемое состояние). У них разные контракты и жизненные циклы.

## 2. Дизайн: один код, две среды (Путь 1 — RuntimeProvider)

Проекту нужны **два режима развёртывания**, а логика управления инстансами должна быть одна:

- **Target (K8s, для комитета):** sim-manager работает как **Go-оператор** — управляет `sim-worker` через **CRD `SimWorker` + раstage-controller (reconcile)**. Декларативное желаемое состояние, самоисцеление, аудит в etcd.
- **Prototype (локально, Docker Compose):** sim-manager работает через **DockerProvider** — поднимает контейнер движка через Docker API, публикует порт, ведёт map `session_id → port`.

Развязка достигается **интерфейсом `RuntimeProvider`** (общая инфраструктурная логика) с двумя реализациями: `K8sProvider` (target) и `DockerProvider` (prototype). Control API и «желаемое состояние» — одни и те же; различается только провайдер среды.

```
                 ┌──────────────┐
                 │  orchestrator │
                 └──────┬───────┘
                        │ Control API (gRPC)
                        ▼
                 ┌──────────────┐     RuntimeProvider (interface)
                 │  sim-manager │───────────────┬───────────────────────┐
                 └──────────────┘               │                       │
                                                ▼                       ▼
                                       K8sProvider             DockerProvider
                                        (target)                (prototype)
                                              │                       │
                                    CRD SimWorker + reconcile    Docker API/Compose
                                              │                       │
                                              ▼                       ▼
                                        sim-worker pod           sim-worker контейнер
                                            (1 Гц)                    (1 Гц)
```

### 2.1. RuntimeProvider — интерфейс

Операции, абстрагирующие создание/контроль инстанса движка:

| Метод | Назначение |
|---|---|
| `ensureInstance(sessionID, instanceSpec)` | декларативно гарантировать живой инстанс движка (создать, если нет; не трогать, если уже соответствует) |
| `stopInstance(sessionID)` | корректно остановить/удалить инстанс |
| `getStatus(sessionID)` | фактическое состояние инстанса (phase, endpoint Model API, health) |
| `listInstances()` | перечень живых инстансов, утилизация квоты |

`instanceSpec` содержат: `session_id`, `image`, `init_state`/ссылка на него, `cpu`/`mem` requests, `speed`/policy. Точный набор полей — в разделе контрактов.

### 2.2. K8sProvider (target) — CRD + reconcile

Реализация через **controller-runtime**:
- **CRD `SimWorker`** (Namespace `ktc-sim`) — декларативная заявка «для сессии X должен жить движок». Поля `spec`: `sessionId`, `image`, `initStateRef`, ресурсы; `status`: `phase`, `endpoint`, `observedGeneration`, события отказа.
- **Reconcile-цикл** `SimWorkerController` (бесконечный конвергирующий цикл):
  1. читает желаемое (`spec` CRD);
  2. сверяет с фактическим (наличие/состояние Pod, Service);
  3. при расхождении приводит к желаемому: создаёт Pod+Service, пересоздаёт упавший, удаляет лишний;
  4. обновляет `status`.
- **OwnerReferences:** `Pod → SimWorker`, `SimWorker → сессия` — цепочка владения. При удалении CRD/сессии K8s сам чистит Pod; сирот не остаётся.
- **Restore ≠ задача sim-manager:** sim-manager гарантирует только «под создан, достижим Model API». Наполнение состояния (restore из снапшота) выполняет `orchestrator` через Model API `set_state` (см. `sim_worker.md`). sim-manager участие принимает лишь пересозданием пода и выдачей endpoint.

### 2.3. DockerProvider (prototype)

Реализация для локального Docker Compose:
- Поднимает контейнер `sim-worker` через **Docker API** (образ, порт), публикует порт на `localhost`, хранит `map[session_id] → {containerID, port}`.
- `stopInstance` — остановка/удаление контейнера.
- Возвращает endpoint Model API как `localhost:<port>`.
- Механизм `reconcile` локально опциональен (нет etcd/orchestrator-истины в кластере); достаточно «ensure→создать/проверить статус». Желаемое состояние в прототипе задаётся императивно из Control API.

### 2.4. Обоснование для комитета (почему operator — не overengineering)

- **Идентичность per-session:** каждая сессия — свой движок с `session_id`, своим снапшотом и квотами. `ReplicaSet`/HPA масштабирует одинаковые реплики **без идентичности**, а нам нужно управление **по ключу сессии** (создать/остановить именно этот движок, restore именно его). Это легитимный кейс оператора.
- **Динамика + self-healing:** поды создаются/удаляются на лету; reconcile автоматически чинит падение движка и связывает с restore. Декларативная модель (CRD) + исцеление (reconcile) = промышленное использование K8s, аудит желаемого состояния в etcd.
- **Restore из чекпоинтов (≤15 с)** — нетривиальный жизненный цикл, где контроль-плейн оправдан.
- **Один код две среды:** абстракция `RuntimeProvider`, единое желаемое состояние; различается только провайдер. Демо MVП локально, адаптация под K8s — без переписывания логики.

## 3. Технологии

- **Язык:** Go (единый для sim-manager в обеих средах).
  - Target: Kubernetes client + **controller-runtime** (operator pattern).
  - Prototype: **docker SDK** (клиент Docker API) для DockerProvider.
- gRPC для Control API (как и Model API у `sim-worker`, единый ARCH-04).
- Совместимо с Deckhouse (K8s-совместимо) и локальным Docker.

## 4. Внутренняя структура

- **Impl `SimWorkerController`** (reconcile-цикл) — логика приведения к желаемому состоянию. **Выносится как чистая функция/сервис**, не зависящая от controller-runtime, чтобы юнит-тестироваться отдельно (по AGENTS.md).
- **Идемпотентные операции инстанса** через `RuntimeProvider` (ensure/stop/status/list).
- **Пулы сессий:** `map[session_id] → инстанс` (endpoint, phase).
- **Квота:** счётчик активных инстансов (до 50), отказ при переполнении.
- `/metrics` (квота, число инстансов, время старта, ошибки reconcile).

## 5. API / контракты (Control API)

Методы `orchestrator → sim-manager` (не путать с Model API `sim-worker`):

| Метод | Протокол | Назначение |
|---|---|---|
| `create_session(session_id, instance_spec)` | gRPC | заявить «движок для сессии должен жить» → подтверждение заявки |
| `stop_session(session_id)` | gRPC | удалить заявку/остановить движок после завершения сессии |
| `get_status(session_id)` | gRPC | фазы/phases и endpoint: `created / pending / ready / failed` |
| `list_sessions()` | gRPC | перечень живых инстансов, утилизация квоты |

**Семантика создания (критично):**
- `create_session` — **декларативная заявка**: регистрирует намерение, но доводит до готовности **reconcile/async**; метод **не блокируется** до полной готовности.
- Готовность оркестратор опрашивает через `get_status` (этапы), а не во время `create_session`.
- Возможные ошибки: `QuotaExceeded` (>=50), `AlreadyExists` (session уже есть), `InvalidSpec`, `InstanceFailed` (движок не смог подняться/стать ready за лимит времени, причину отдаёт status).
- **Идемпотентность:** повторный `create_session` для той же сессии возвращает текущий статус без сайд-эффекта.

> Модель внутри инстанса управляется напрямую `orchestrator` через **Model API** (`sim_worker.md`), а не через `sim-manager`.

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| Session Orchestrator (`orchestrator`) | микросервис | Control API (gRPC), mTLS |
| Kubernetes API / etcd (target) | инфраструктура | K8s API (CRD `SimWorker`, Pod, Service) |
| Docker Engine (prototype) | инфраструктура | Docker API (create/stop container) |
| Constructor Service (`constructor`) | микросервис | HTTPS/REST (`GET /templates/{id}/export` → init-state) |
| Пульт / Fluent Bit | observability | `/metrics`, stdout |

**Не связан** с фронтом, ИИ, assessment, репортом, S3, снапшотами напрямую.

## 7. Данные

- Не хранит бизнес-данные и состояние модели.
- Target: желаемое состояние — CRD `SimWorker` в K8s; фактическое — в данный момент в кластере.
- Prototype: `map[session_id] → контейнер/порт` в памяти процесса.
- Вся «истина» модели — в `sim-worker` (RAM), её снапшоты — через `snapshot`.

## 8. Объекты Kubernetes (namespace `ktc-sim`, target)

| Объект | Описание |
|---|---|
| Deployment `sim-manager` | оператор (1 реплика) + контроллер RBO |
| Service `sim-manager` | точка доступа Control API |
| CRD `SimWorker` | групповой тип `sim.example.com/v1` |
| Namespace `ktc-sim` | выделенный сегмент движков |
| Node Pool `sim` | выделенные CPU-узлы, taint `sim=true` |
| ResourceQuota/LimitRange | жёсткие лимиты на всё namespace (движки) |
| NetworkPolicy | только от `orchestrator`/`snapshot`; egress к K8s API, `constructor` |
| ServiceAccount + RBAC | права оператора на CRUD CRD/Pod/Service |
| PDB | защита диспетчера |

В прототипе (Docker Compose) вместо этого: сервис `sim-manager` + контейнеры `sim-worker-*`, порты публикуются локально.

## 9. Метрики (Пульт + Графиня)

- Число активных сессий (инстансов), остаток квоты (до 50).
- Время создания/удаления инстанса, ошибки reconcile.
- Фазы инстансов (pending/ready/failed), CPU/RAM Node Pool `sim`.

## 10. Отказоустойчивость / масштабирование

- **Target:** оператор — control-plane; при его падении активные `sim-worker` **продолжают** работать (рабочие поды переживают оператор). Reconcile восстанавливает контроль после рестарта.
- **Prototype:** падение sim-manager → активные контейнеры движков продолжают; связь `map` восстанавливается перечислением контейнеров (reconcile локально).
- Квота 50 сессий; при переполнении — отклонение `create_session` (`QuotaExceeded`).
- Сбой `sim-worker` → пересоздание пода/контейнера (ensure); восстановление состояния сессии (restore ≤15 с, обрыв ≤3 мин) — через `orchestrator` + Model API (`sim_worker.md`), sim-manager отвечает лишь за живой инстанс.

## 11. Открытые вопросы

1. Точная схема CRD `SimWorker` (поля `spec`/`status`, версии) — детализировать при реализации.
2. Каналы управления в прототипе: Docker API напрямую vs генерация `docker-compose.yml` как артефакта (рекомендация: Docker API для динамики).
3. Механизм reconcile в прототипе (необязателен: достаточно ensure+status), глубина автономии.
4. Куда фиксировать лимит 50 и лимиты ресурсов пода (конфиг sim-manager vs CRD default) — по конвенции TOML+env.
5. Учебная «оценка» и видимость остановки сессии локально: связка control-API callback в prototype (готовность/конец сессии) — согласовать с `assessment`/`report`.
