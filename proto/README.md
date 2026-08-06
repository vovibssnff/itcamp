# proto/ — gRPC-контракты

Стабильные внутренние gRPC-контракты hot-path (plan §5, §10, §16).

| Файл | Пакет | Сервис | Назначение |
|---|---|---|---|
| `model_api.proto` | `ktk.sim.v1` | `sim` | Model API + SimManager (жизненный цикл sim-worker, шаги интегрирования, состояние, инъекция неисправностей, телеметрия) |
| `ai_api.proto` | `ktk.ai.v1` | `ai` | AI API (Explain / PredictPhysics / PredictBehaviour / GenerateScenario / Analyze) |

## Генерация Python-стабов

Стабы генерируются в пакет `libs/py-common/ktk_contracts/` и импортируются как
`from ktk_contracts import model_api_pb2, model_api_pb2_grpc`.

Через grpcio-tools (по умолчанию в CI и локально):

```bash
./proto/gen.sh
# или из корня:
make proto
```

Через buf (если установлен `buf`):

```bash
cd proto && buf generate
```

## Линт / breaking-change

```bash
cd proto
buf lint
buf breaking --against '.git#branch=main,subdir=proto'
```

Конфигурация — `buf.yaml` (lint STANDARD, breaking FILE). Пакеты уже имеют суффикс
версии (`.v1`), поэтому правило `PACKAGE_VERSION_SUFFIX` исключено.

## Конвенции

- Именование пакетов: `ktk.<service>.v<major>` (plan §5).
- Обратная совместимость проверяется `buf breaking` в CI (стадия `proto`).
- Изменять номера полей нельзя; только добавлять новые с возрастающими тегами.
