# Сервис: AI Service — `ai`

> Слой: Машинное обучение | Namespace: `ktc-ai` (GPU Node Pool `ai`) | Под: `ai`
> Смежно: `Реестр_сервисов...`, `Сценарии_экзамен...`, `Архитектура_КТК_K8s.drawio`, `Сценарии_использования_ИИ.md`

## 1. Назначение

**«Умный помощник»**: интеллектуальный анализ и генерация (Explain / Predict / Adaptive). Требует **GPU**, изолированный сервисный аккаунт, без сетевого доступа вовне; должен **деградировать** (его падение не останавливает симуляцию и rule-based оценку).

## 2. Основные функции

- **Explain** — объяснение решений/отклонений параметров (Smart Hint).
- **Predict** (physics/behaviour) — предсказание развития ситуации (Predictive Alert).
- **Adaptive** — адаптация сложности/рекомендации (персональный план тренировок).
- Оценка риска (Preemptive Risk), генерация/What-If сценариев.
- **Post-exam разбор** (в экзамене подсказки ИИ во время сессии отключены, FR-AI-06).

## 3. Технологии

GPU-хост: vLLM/Ollama (LLM), PyTorch/scikit-learn. DCGM-exporter / nvidia-exporter для GPU-метрик.

## 4. Внутренняя структура

- Инференс-сервер (LLM/ML) на GPU.
- Адаптеры задач: explain, predict_physics, predict_behaviour, generate_scenario, analyze.
- Очередь инференса (через broker), асинхронность.
- `/metrics` для GPU/очереди.

## 5. API / контракты (AI API)

| Направление | Протокол | Методы |
|---|---|---|
| от `orchestrator`/`assessment` | HTTPS/gRPC + mTLS | `explain`, `predict_physics`, `predict_behaviour`, `generate_scenario`, `analyze` |
| из `broker` | NATS JetStream | очереди задач инференса |

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| Session Orchestrator (`orchestrator`) | микросервис | AI API — HTTPS/gRPC + mTLS |
| Assessment Engine (`assessment`) | микросервис | HTTPS/gRPC + mTLS (статистика для разбора) |
| Брокер сообщений (`broker`) | инфраструктура | очередь инференса — NATS JetStream |
| Пульт / DCGM | observability | метрики GPU/VRAM/очереди, `/metrics` |
| Picodata (`db`) | СУБД | SQL (чтение истории/результатов, опционально) |

**Не имеет**: внешнего сетевого доступа (egress запрещён), изолированный serviceAccount.

## 7. Данные

- Пикодата: (опционально) кэш результатов/метаданных разбора.
- Не хранит пользовательские ПДн без необходимости; работает с тегами/данными сессии.

## 8. Объекты Kubernetes (namespace `ktc-ai`)

| Объект | Описание |
|---|---|
| Deployment `ai` | GPU-scheduler, `nodeSelector`/taint для GPU-узлов |
| Service `ai` | ClusterIP (mTLS) |
| Node Pool `ai` | GPU-узлы |
| ResourceQuota/LimitRange | GPU-ресурсы |
| NetworkPolicy | accept только от `orchestrator`/`assessment`; egress запрещён |
| Secret / serviceAccount | изолирован от других сервисов |
| Pod + sidecar `istio-proxy` | mTLS (если в сетке; возможен вариант вне mesh) |

## 9. Метрики (в Пульт + Графиня)

- GPU utilization, VRAM, температура, очередь инференса.
- Время ответа explain/predict, ошибки ИИ.
- Число запросов.

## 10. Отказоустойчивость / деградация

- Падение ИИ **не** останавливает симуляцию и rule-based оценку (fallback).
- Async через очередь (не блокирует контур управления, NFR-PERF-06).
- Изоляция GPU: сбой одного инференса не влияет на другие.

## 11. Открытые вопросы

1. Использование LLM (vLLM/Ollama) vs классический ML (sk-learn) для Predict/Explain — баланс качества/ресурсов.
2. Внедрение GPU-пула и изолированного serviceAccount — в mesh или вне mesh.
3. Правила «какие подсказки разрешены в тренировке, запрещены в экзамене».
4. Хранение/обновление моделей (из доверенного репозитория), версионирование.
