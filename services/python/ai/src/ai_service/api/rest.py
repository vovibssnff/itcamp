"""REST-фасад ИИ-сервиса.

Внутри кластера основной транспорт — gRPC (§7.6 SRD). REST оставлен для
BFF Angie, отладки и smoke-тестов: он даёт ту же функциональность и
позволяет проверить сервис curl-ом без генерации стабов.
"""
from __future__ import annotations

import logging
import time
from typing import Any

try:
    from fastapi import FastAPI, HTTPException
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Для REST-слоя нужен fastapi: pip install -r requirements.txt"
    ) from exc

from ..bootstrap import Application, build_application
from ..domain.enums import SessionMode
from ..observability import metrics
from ..services.pipeline import review_session
from ..services.predict_physics import predict, visible_to_operator
from ..storage.repository import AiInsight, to_dict
from ..validation.pdn import PdnViolation, assert_no_pdn_fields
from . import mappers

logger = logging.getLogger(__name__)


def create_app(application: Application | None = None) -> "FastAPI":
    app = FastAPI(title="КТК — ИИ-сервис", version="1.0.0")
    state: dict[str, Application] = {}

    @app.on_event("startup")
    def _startup() -> None:
        state["app"] = application or build_application()
        logger.info("ИИ-сервис запущен: %s", state["app"].health())

    def current() -> Application:
        if "app" not in state:
            state["app"] = application or build_application()
        return state["app"]

    # -- служебные ----------------------------------------------------------

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz() -> dict[str, Any]:
        return current().health()

    @app.get("/metrics")
    def prometheus_metrics() -> Any:
        try:
            from fastapi.responses import Response
            from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

            return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
        except ImportError:
            return {
                "counters": {
                    f"{name}{dict(labels)}": value
                    for (name, labels), value in metrics.registry.counters.items()
                }
            }

    # -- бизнес-эндпоинты ---------------------------------------------------

    @app.post("/v1/explain")
    def explain(payload: dict[str, Any]) -> dict[str, Any]:
        _guard_pdn(payload)
        app_ = current()

        if payload.get("session_mode") == SessionMode.EXAM.value:
            # Запрет реализован на сервере, а не скрытием кнопки в UI:
            # прямой запрос к API должен получать отказ (TS-EXM-02).
            metrics.registry.inc("ai_exam_block_total", rpc="explain")
            raise HTTPException(status_code=403, detail="EXAM_MODE_BLOCKED")

        started = time.monotonic()
        result = app_.explain.explain_alarm(
            alarm=mappers.to_alarm(payload["alarm"]),
            series=[mappers.to_series(s) for s in payload.get("tag_window", [])],
            actions=[mappers.to_action(a) for a in payload.get("recent_actions", [])],
            node_label=payload.get("node_label", ""),
            component_type=payload.get("component_type", ""),
            neighbors=payload.get("neighbors", []),
            interlocks=_interlocks_for(app_, payload["alarm"]["tag_id"]),
            faults=payload.get("active_faults", []),
            template_name=app_.tags.template_name,
            equipment_filter=app_.tags.equipment or None,
            locale=payload.get("locale", "ru"),
        )
        body = to_dict(result)
        body["latency_ms"] = int((time.monotonic() - started) * 1000)
        body["insight_id"] = _save_insight(app_, payload, body, "explain")
        return body

    @app.post("/v1/predict/physics")
    def predict_physics(payload: dict[str, Any]) -> dict[str, Any]:
        series = [mappers.to_series(s) for s in payload.get("series", [])]
        limits = [mappers.to_limit(l) for l in payload.get("limits", [])]
        predictions = predict(series, limits, horizon_s=int(payload.get("horizon_s", 300)))
        mode = payload.get("session_mode", SessionMode.TRAINING.value)
        visible = {p.tag_id for p in visible_to_operator(predictions, mode)}
        return {
            "predictions": [
                {**to_dict(p), "visible_to_operator": p.tag_id in visible} for p in predictions
            ],
            "degraded": False,
        }

    @app.post("/v1/predict/behaviour")
    def predict_behaviour(payload: dict[str, Any]) -> dict[str, Any]:
        _guard_pdn(payload)
        app_ = current()
        action = mappers.to_action(payload["pending_action"])
        state_map = {
            s["tag_id"]: float(s["value"]) for s in payload.get("current_state", [])
        }
        mode = payload.get("session_mode", SessionMode.TRAINING.value)
        result = app_.behaviour.assess(action, state_map, mode)
        body = to_dict(result)
        body["visible_to_operator"] = app_.behaviour.visible_to_operator(result, mode)
        return body

    @app.post("/v1/session/review")
    def session_review(payload: dict[str, Any]) -> dict[str, Any]:
        _guard_pdn(payload)
        app_ = current()
        review = review_session(
            actions=[mappers.to_action(a) for a in payload.get("actions", [])],
            alarms=[mappers.to_alarm(a) for a in payload.get("alarms", [])],
            reference=[mappers.to_step(s) for s in payload.get("reference", [])],
            criteria=mappers.to_criteria(payload.get("criteria")),
            scenario_name=payload.get("scenario_name", "сценарий"),
            annotation_service=app_.annotate,
            debrief_service=app_.debrief,
            interlocks=[mappers.to_interlock(i) for i in payload.get("interlocks", [])],
            deadline_base_s=int(payload.get("deadline_base_s", 0)),
            state_after=payload.get("state_after"),
            with_debrief=bool(payload.get("with_debrief", True)),
        )
        a = review.annotated.assessment
        return {
            "score": a.score,
            "passed": a.passed,
            "penalties": [to_dict(p) for p in a.penalties],
            "critical_errors": [to_dict(p) for p in a.critical_errors],
            "reactions": [to_dict(r) for r in a.reaction.reactions],
            "mean_ack_delay_s": a.reaction.mean_ack_delay_s,
            "steps": [
                {
                    "step": s.step,
                    "outcome": s.outcome,
                    "action": s.reference.action,
                    "target": s.reference.target,
                    "delay_s": s.delay_s,
                    "matched_at_s": s.matched_action.model_time_s if s.matched_action else None,
                }
                for s in a.sequence.steps
            ],
            "annotations": [to_dict(n) for n in review.annotated.annotations],
            "debrief_text": review.debrief_text,
            "degraded": review.degraded,
        }

    @app.post("/v1/chat")
    def chat(payload: dict[str, Any]) -> dict[str, Any]:
        _guard_pdn(payload)
        app_ = current()
        answer = app_.chat.ask(
            question=payload.get("question", ""),
            session_mode=payload.get("session_mode", SessionMode.TRAINING.value),
            equipment_filter=app_.tags.equipment or None,
        )
        return to_dict(answer)

    return app


def _guard_pdn(payload: dict[str, Any]) -> None:
    try:
        assert_no_pdn_fields(payload)
    except PdnViolation as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _interlocks_for(app_: Application, tag_id: str) -> list[str]:
    return app_.tags.interlocks.get(tag_id, [])


def _save_insight(
    app_: Application, payload: dict[str, Any], body: dict[str, Any], type_: str
) -> str:
    insight = AiInsight(
        session_id=payload.get("session_id", ""),
        type=type_,
        input={k: v for k, v in payload.items() if k != "tag_window"},
        output=body,
        model_time_s=int(payload.get("model_time_s", 0)),
        degraded=bool(body.get("degraded", False)),
    )
    return app_.insights.save(insight)


app = None  # заполняется в main.py, чтобы избежать построения при импорте
