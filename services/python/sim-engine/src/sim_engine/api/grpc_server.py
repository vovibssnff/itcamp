"""gRPC-сервер sim-worker — Model API (основной внутрикластерный транспорт).

Стабы генерируются из proto скриптом ``scripts/gen_proto.sh`` и в
репозиторий не коммитятся. Жизненный цикл инстанса — у sim-manager (Control API).
"""
from __future__ import annotations

import json
import logging
from concurrent import futures

logger = logging.getLogger(__name__)

_STUBS_MISSING = (
    "Не найдены сгенерированные стабы gRPC. Выполните: bash scripts/gen_proto.sh"
)


def _load_stubs():
    try:
        from .generated.ktk.sim.v1 import model_api_pb2 as pb2
        from .generated.ktk.sim.v1 import model_api_pb2_grpc as pb2_grpc
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(_STUBS_MISSING) from exc
    return pb2, pb2_grpc


def _alarm_msg(pb2, alarm):
    return pb2.AlarmEventMsg(
        tag_id=alarm.tag_id,
        priority=alarm.priority,
        raised_at_s=alarm.raised_at_s,
        value=alarm.value,
        limit=alarm.limit,
        ack_at_s=alarm.ack_at_s or 0.0,
        has_ack=alarm.ack_at_s is not None,
        alarm_id=alarm.alarm_id,
    )


def _state_msg(pb2, session_id: str, engine, state):
    session = engine.sessions[session_id]
    return pb2.ProcessStateMsg(
        session_id=session_id,
        model_time_s=state.model_time_s,
        tag_values=dict(state.tag_values),
        equipment_states=dict(state.equipment_states),
        controller_modes=dict(state.controller_modes),
        active_alarms=[_alarm_msg(pb2, a) for a in state.active_alarms.values()],
        active_faults=list(state.active_faults),
        tripped_interlocks=list(state.tripped_interlocks),
        speed=session.speed,
    )


def build_servicer(application=None):  # pragma: no cover - требует стабов
    pb2, pb2_grpc = _load_stubs()

    from ..bootstrap import build_application
    from ..domain.models import OperatorCommand
    from ..engine.model_api import CommandRejected, UnknownSessionError
    from ..observability import metrics

    app = application or build_application()

    class ModelApiServicer(pb2_grpc.ModelApiServicer):
        def Health(self, request, context):
            h = app.health()
            return pb2.HealthResponse(
                ready=True,
                template=str(h["template"]),
                template_id=str(h["template_id"]),
                tags_loaded=int(h["tags_loaded"]),
                faults_loaded=int(h["faults_loaded"]),
                active_sessions=int(h["active_sessions"]),
            )

        def CreateSession(self, request, context):
            import grpc

            if request.session_id in app.engine.sessions:
                context.abort(grpc.StatusCode.ALREADY_EXISTS, "SESSION_EXISTS")
            seed = request.seed or app.settings.default_seed
            state = app.engine.create_session(request.session_id, seed=seed)
            return _state_msg(pb2, request.session_id, app.engine, state)

        def DestroySession(self, request, context):
            app.engine.destroy_session(request.session_id)
            return pb2.DestroySessionResponse(ok=True)

        def GetState(self, request, context):
            import grpc

            try:
                state = app.engine.get_state(request.session_id)
            except UnknownSessionError:
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            return _state_msg(pb2, request.session_id, app.engine, state)

        def SetState(self, request, context):
            import grpc

            internal = None
            if request.internal_state_json:
                internal = json.loads(request.internal_state_json.decode("utf-8"))
            try:
                state = app.engine.set_state(
                    request.session_id,
                    tag_overrides=dict(request.tag_overrides) or None,
                    internal_state=internal,
                    model_time_s=request.model_time_s if request.has_model_time else None,
                )
            except UnknownSessionError:
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            return _state_msg(pb2, request.session_id, app.engine, state)

        def Step(self, request, context):
            import grpc

            try:
                result = app.engine.step(
                    request.session_id,
                    real_dt_s=request.real_dt_s or 1.0,
                )
                metrics.step("ok")
            except UnknownSessionError:
                metrics.step("unknown_session")
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            return pb2.StepResponse(
                state=_state_msg(pb2, request.session_id, app.engine, result.state),
                new_alarms=[_alarm_msg(pb2, a) for a in result.new_alarms],
                cleared_alarms=[_alarm_msg(pb2, a) for a in result.cleared_alarms],
                new_interlocks=[
                    pb2.InterlockEventMsg(
                        code=e.code,
                        tag_id=e.tag_id,
                        at_s=e.at_s,
                        description=e.description,
                        effects=list(e.effects),
                    )
                    for e in result.new_interlocks
                ],
            )

        def InjectFault(self, request, context):
            import grpc

            try:
                instance = app.engine.inject_fault(
                    request.session_id,
                    request.fault_id,
                    magnitude=request.magnitude or 1.0,
                )
            except UnknownSessionError:
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            except KeyError as exc:
                context.abort(grpc.StatusCode.NOT_FOUND, str(exc))
            metrics.fault_injected(request.fault_id)
            return pb2.FaultInstanceMsg(
                fault_id=instance.fault_def.fault_id,
                injected_at_s=instance.injected_at_s,
                magnitude=instance.magnitude,
                active=instance.active,
                title=instance.fault_def.title,
                docx_ref=instance.fault_def.docx_ref,
            )

        def ClearFault(self, request, context):
            import grpc

            try:
                cleared = app.engine.clear_fault(request.session_id, request.fault_id)
            except UnknownSessionError:
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            return pb2.ClearFaultResponse(cleared=cleared)

        def SetSpeed(self, request, context):
            import grpc

            try:
                speed = app.engine.set_speed(request.session_id, request.multiplier)
            except UnknownSessionError:
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            return pb2.SetSpeedResponse(speed=speed)

        def Command(self, request, context):
            import grpc

            cmd = OperatorCommand(
                model_time_s=request.model_time_s,
                type=request.type,
                target=request.target,
                value_from=request.value_from if request.has_value_from else None,
                value_to=request.value_to if request.has_value_to else None,
                action_id=request.action_id,
            )
            try:
                app.engine.command(request.session_id, cmd)
                metrics.command(cmd.type, "ok")
            except UnknownSessionError:
                metrics.command(cmd.type, "unknown_session")
                context.abort(grpc.StatusCode.NOT_FOUND, "UNKNOWN_SESSION")
            except CommandRejected as exc:
                metrics.command(cmd.type, "rejected")
                return pb2.CommandResponse(ok=False, reject_reason=str(exc))
            except KeyError as exc:
                metrics.command(cmd.type, "unknown_target")
                context.abort(grpc.StatusCode.NOT_FOUND, str(exc))
            return pb2.CommandResponse(ok=True)

        def ListFaults(self, request, context):
            return pb2.ListFaultsResponse(
                faults=[
                    pb2.FaultDefMsg(
                        fault_id=f.fault_id,
                        docx_ref=f.docx_ref,
                        group=f.group,
                        title=f.title,
                        equipment=list(f.equipment),
                        early_signs=f.early_signs,
                        stabilization_hint=f.stabilization_hint,
                        regulation_refs=list(f.regulation_refs),
                    )
                    for f in app.engine.faults_catalog.values()
                ]
            )

    return ModelApiServicer()


def serve(application=None, host: str = "0.0.0.0", port: int = 50061) -> int:
    try:
        import grpc
    except ImportError:
        logger.error("grpcio не установлен. pip install -r requirements.txt")
        return 1

    pb2_grpc = _load_stubs()[1]
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    pb2_grpc.add_ModelApiServicer_to_server(build_servicer(application), server)
    server.add_insecure_port(f"{host}:{port}")
    server.start()
    logger.info("gRPC Model API слушает %s:%s", host, port)
    server.wait_for_termination()
    return 0
