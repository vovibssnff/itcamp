"""REST-фасад sim-worker (Model API).

Внутри кластера основной транспорт — gRPC (§7 ARCHITECTURE). REST оставлен
для отладки, smoke-тестов и локального запуска без sim-manager / стабов.
"""
from __future__ import annotations

import json
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
from ..domain.models import OperatorCommand
from ..engine.model_api import CommandRejected, UnknownSessionError
from ..observability import metrics

logger = logging.getLogger(__name__)


def _state_body(
    session_id: str,
    engine,
    state,
    *,
    include_internal: bool = False,
) -> dict[str, Any]:
    session = engine.sessions[session_id]
    body = state.snapshot()
    body["session_id"] = session_id
    body["speed"] = session.speed
    body["active_alarms"] = [
        {
            "tag_id": a.tag_id,
            "priority": a.priority,
            "raised_at_s": a.raised_at_s,
            "value": a.value,
            "limit": a.limit,
            "ack_at_s": a.ack_at_s,
            "alarm_id": a.alarm_id,
        }
        for a in state.active_alarms.values()
    ]
    # Full Network.export_internal snapshot is required for checkpoint/restore.
    # Omit on high-frequency step responses to keep tick payloads small.
    if include_internal:
        body["internal_state"] = session.network.export_internal()
        body["seed"] = session.seed
    return body


def create_app(application: Application | None = None) -> FastAPI:
    state: dict[str, Application] = {}

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        state["app"] = application or build_application()
        logger.info("sim-worker запущен: %s", state["app"].health())
        yield

    app = FastAPI(title="КТК — sim-worker", version="1.0.0", lifespan=lifespan)

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

    # -- Model API ----------------------------------------------------------

    @app.post("/v1/sessions")
    def create_session(payload: dict[str, Any]) -> dict[str, Any]:
        app_ = current()
        session_id = payload.get("session_id") or f"sess-{int(time.time())}"
        seed = int(payload.get("seed", app_.settings.default_seed))
        if session_id in app_.engine.sessions:
            raise HTTPException(status_code=409, detail="SESSION_EXISTS")
        ps = app_.engine.create_session(session_id, seed=seed)
        return _state_body(session_id, app_.engine, ps)

    @app.delete("/v1/sessions/{session_id}")
    def destroy_session(session_id: str) -> dict[str, Any]:
        current().engine.destroy_session(session_id)
        return {"ok": True}

    @app.get("/v1/sessions/{session_id}/state")
    def get_state(session_id: str) -> dict[str, Any]:
        try:
            ps = current().engine.get_state(session_id)
        except UnknownSessionError:
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        return _state_body(session_id, current().engine, ps, include_internal=True)

    @app.put("/v1/sessions/{session_id}/state")
    def set_state(session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        engine = current().engine
        try:
            internal = payload.get("internal_state")
            if isinstance(internal, str):
                internal = json.loads(internal)
            ps = engine.set_state(
                session_id,
                tag_overrides=payload.get("tag_overrides"),
                internal_state=internal,
                model_time_s=payload.get("model_time_s"),
            )
        except UnknownSessionError:
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        return _state_body(session_id, engine, ps, include_internal=True)

    @app.post("/v1/sessions/{session_id}/step")
    def step(session_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = payload or {}
        engine = current().engine
        started = time.monotonic()
        try:
            result = engine.step(session_id, real_dt_s=float(payload.get("real_dt_s", 1.0)))
            metrics.step("ok")
        except UnknownSessionError:
            metrics.step("unknown_session")
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        metrics.step_duration(time.monotonic() - started)
        return {
            "state": _state_body(session_id, engine, result.state),
            "new_alarms": [
                {
                    "tag_id": a.tag_id,
                    "priority": a.priority,
                    "raised_at_s": a.raised_at_s,
                    "value": a.value,
                    "limit": a.limit,
                    "alarm_id": a.alarm_id,
                }
                for a in result.new_alarms
            ],
            "cleared_alarms": [
                {"tag_id": a.tag_id, "priority": a.priority, "alarm_id": a.alarm_id}
                for a in result.cleared_alarms
            ],
            "new_interlocks": [
                {
                    "code": e.code,
                    "tag_id": e.tag_id,
                    "at_s": e.at_s,
                    "description": e.description,
                    "effects": list(e.effects),
                }
                for e in result.new_interlocks
            ],
        }

    @app.post("/v1/sessions/{session_id}/faults")
    def inject_fault(session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        engine = current().engine
        fault_id = payload.get("fault_id", "")
        magnitude = float(payload.get("magnitude", 1.0))
        ramp_raw = payload.get("ramp_s")
        ramp_s = float(ramp_raw) if ramp_raw is not None else None
        try:
            instance = engine.inject_fault(
                session_id, fault_id, magnitude=magnitude, ramp_s=ramp_s
            )
        except UnknownSessionError:
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        metrics.fault_injected(fault_id)
        ramp_applied = (
            instance.fault_def.effects[0].ramp_s if instance.fault_def.effects else None
        )
        return {
            "fault_id": instance.fault_def.fault_id,
            "injected_at_s": instance.injected_at_s,
            "magnitude": instance.magnitude,
            "active": instance.active,
            "title": instance.fault_def.title,
            "docx_ref": instance.fault_def.docx_ref,
            "ramp_s": ramp_applied,
        }

    @app.delete("/v1/sessions/{session_id}/faults/{fault_id}")
    def clear_fault(session_id: str, fault_id: str) -> dict[str, Any]:
        try:
            cleared = current().engine.clear_fault(session_id, fault_id)
        except UnknownSessionError:
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        return {"cleared": cleared}

    @app.post("/v1/sessions/{session_id}/speed")
    def set_speed(session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            speed = current().engine.set_speed(
                session_id, float(payload.get("multiplier", 1.0))
            )
        except UnknownSessionError:
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        return {"speed": speed}

    @app.post("/v1/sessions/{session_id}/command")
    def command(session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        cmd = OperatorCommand(
            model_time_s=float(payload.get("model_time_s", 0.0)),
            type=payload.get("type", ""),
            target=payload.get("target", ""),
            value_from=payload.get("value_from"),
            value_to=payload.get("value_to"),
            action_id=payload.get("action_id", ""),
        )
        try:
            current().engine.command(session_id, cmd)
            metrics.command(cmd.type, "ok")
        except UnknownSessionError:
            metrics.command(cmd.type, "unknown_session")
            raise HTTPException(status_code=404, detail="UNKNOWN_SESSION") from None
        except CommandRejected as exc:
            metrics.command(cmd.type, "rejected")
            raise HTTPException(status_code=409, detail=str(exc)) from None
        except KeyError as exc:
            metrics.command(cmd.type, "unknown_target")
            raise HTTPException(status_code=404, detail=str(exc)) from None
        except ValueError as exc:
            # Неподдерживаемый тип команды: CommandType(cmd.type) -> ValueError.
            metrics.command(cmd.type, "invalid_type")
            raise HTTPException(status_code=400, detail=str(exc)) from None
        return {"ok": True}

    @app.get("/v1/faults")
    def list_faults() -> dict[str, Any]:
        faults = current().engine.faults_catalog
        return {
            "faults": [
                {
                    "fault_id": f.fault_id,
                    "docx_ref": f.docx_ref,
                    "group": f.group,
                    "title": f.title,
                    "equipment": list(f.equipment),
                    "early_signs": f.early_signs,
                    "stabilization_hint": f.stabilization_hint,
                    "regulation_refs": list(f.regulation_refs),
                }
                for f in faults.values()
            ]
        }

    return app
