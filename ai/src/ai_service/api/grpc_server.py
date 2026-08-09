"""gRPC-сервер ИИ-сервиса (основной внутрикластерный транспорт, §7.6 SRD).

Стабы генерируются из proto скриптом ``scripts/gen_proto.sh`` и в
репозиторий не коммитятся. Если стабов нет, сервер честно об этом сообщает
вместо невнятной ошибки импорта.
"""
from __future__ import annotations

import logging
from concurrent import futures

logger = logging.getLogger(__name__)

_STUBS_MISSING = (
    "Не найдены сгенерированные стабы gRPC. Выполните: bash scripts/gen_proto.sh"
)


def _load_stubs():
    try:
        from .generated.ktk.ai.v1 import ai_service_pb2 as pb2
        from .generated.ktk.ai.v1 import ai_service_pb2_grpc as pb2_grpc
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(_STUBS_MISSING) from exc
    return pb2, pb2_grpc


def build_servicer(application=None):  # pragma: no cover - требует стабов
    pb2, pb2_grpc = _load_stubs()

    from ..bootstrap import build_application
    from ..domain.enums import SessionMode
    from ..domain.models import (
        AlarmEvent,
        ForbiddenAction,
        LimitDef,
        OperatorAction,
        PenaltyRule,
        ReferenceStep,
        ScenarioCriteria,
        TagSeries,
    )
    from ..services.pipeline import review_session
    from ..services.predict_physics import predict, visible_to_operator

    app = application or build_application()

    def _action(msg) -> OperatorAction:
        return OperatorAction(
            model_time_s=msg.model_time_s,
            type=msg.type,
            target=msg.target,
            value_from=msg.value_from if msg.has_value_from else None,
            value_to=msg.value_to if msg.has_value_to else None,
            action_id=msg.action_id,
        )

    class AiServicer(pb2_grpc.AiServiceServicer):
        def Health(self, request, context):
            state = app.health()
            return pb2.HealthResponse(
                ready=True,
                llm_provider=str(state["llm_provider"]),
                llm_ready=bool(state["llm_ready"]),
                knowledge_chunks=int(state["knowledge_chunks"]),
                tags_loaded=int(state["tags_loaded"]),
                template=str(state["template"]),
            )

        def Explain(self, request, context):
            import grpc

            if request.session_mode == SessionMode.EXAM.value:
                context.abort(grpc.StatusCode.PERMISSION_DENIED, "EXAM_MODE_BLOCKED")

            alarm = AlarmEvent(
                tag_id=request.alarm.tag_id,
                priority=request.alarm.priority,
                raised_at_s=request.alarm.raised_at_s,
                value=request.alarm.value,
                limit=request.alarm.limit,
                ack_at_s=request.alarm.ack_at_s if request.alarm.has_ack else None,
            )
            result = app.explain.explain_alarm(
                alarm=alarm,
                series=[
                    TagSeries(
                        tag_id=s.tag_id, values=list(s.values),
                        t0_s=s.t0_s, step_s=s.step_s, unit=s.unit,
                    )
                    for s in request.tag_window
                ],
                actions=[_action(a) for a in request.recent_actions],
                node_label=request.node_label,
                component_type=request.component_type,
                neighbors=list(request.neighbors),
                interlocks=app.tags.interlocks.get(request.alarm.tag_id, []),
                faults=list(request.active_faults),
                template_name=app.tags.template_name,
                equipment_filter=app.tags.equipment or None,
                locale=request.locale or "ru",
            )
            return pb2.ExplainResponse(
                cause=result.cause,
                effect=result.effect,
                recommendation=result.recommendation,
                evidence_tags=result.evidence_tags,
                regulation_refs=result.regulation_refs,
                confidence=result.confidence,
                degraded=result.degraded,
            )

        def PredictPhysics(self, request, context):
            series = [
                TagSeries(
                    tag_id=s.tag_id, values=list(s.values),
                    t0_s=s.t0_s, step_s=s.step_s, unit=s.unit,
                )
                for s in request.series
            ]
            limits = [
                LimitDef(tag_id=lim.tag_id, value=lim.value, limit_type=lim.limit_type)
                for lim in request.limits
            ]
            preds = predict(series, limits, horizon_s=request.horizon_s or 300)
            visible = {p.tag_id for p in visible_to_operator(preds, request.session_mode)}
            return pb2.PredictPhysicsResponse(
                predictions=[
                    pb2.PredictionMsg(
                        tag_id=p.tag_id, current=p.current, target_limit=p.target_limit,
                        limit_type=p.limit_type, eta_s=p.eta_s or 0,
                        has_eta=p.eta_s is not None,
                        eta_ci_low_s=p.eta_ci_low_s or 0, eta_ci_high_s=p.eta_ci_high_s or 0,
                        confidence=p.confidence, trend=p.trend, rate_per_min=p.rate_per_min,
                        visible_to_operator=p.tag_id in visible,
                    )
                    for p in preds
                ],
                degraded=False,
            )

        def PredictBehaviour(self, request, context):
            action = _action(request.pending_action)
            state = {s.tag_id: s.value for s in request.current_state}
            result = app.behaviour.assess(action, state, request.session_mode)
            return pb2.PredictBehaviourResponse(
                risk_level=result.risk_level,
                headline=result.headline,
                detail=result.detail,
                regulation_refs=result.regulation_refs,
                suggested_alternative=result.suggested_alternative,
                visible_to_operator=app.behaviour.visible_to_operator(
                    result, request.session_mode
                ),
                degraded=result.degraded,
            )

        def ReviewSession(self, request, context):
            criteria = ScenarioCriteria(
                pass_score=request.criteria.pass_score or 70,
                ack_deadline_s=request.criteria.ack_deadline_s or 60,
                penalties={
                    k: PenaltyRule(code=k, points=v)
                    for k, v in request.criteria.penalties.items()
                },
                forbidden_actions=[
                    ForbiddenAction(
                        code=f.code, action=f.action, target=f.target,
                        description=f.description,
                        regulation_ref=tuple(f.regulation_refs),
                    )
                    for f in request.criteria.forbidden_actions
                ],
            )
            review = review_session(
                actions=[_action(a) for a in request.actions],
                alarms=[
                    AlarmEvent(
                        tag_id=a.tag_id, priority=a.priority, raised_at_s=a.raised_at_s,
                        value=a.value, limit=a.limit,
                        ack_at_s=a.ack_at_s if a.has_ack else None,
                    )
                    for a in request.alarms
                ],
                reference=[
                    ReferenceStep(
                        step=s.step, action=s.action, target=s.target,
                        within_s=s.within_s if s.has_within else None,
                        value=s.value if s.has_value else None,
                        unit=s.unit, tolerance_pct=s.tolerance_pct or 10.0,
                        note=s.note, optional=s.optional,
                    )
                    for s in request.reference
                ],
                criteria=criteria,
                scenario_name=request.scenario_name,
                annotation_service=app.annotate,
                debrief_service=app.debrief,
                deadline_base_s=request.deadline_base_s,
                state_after=dict(request.state_after),
                with_debrief=request.with_debrief,
            )
            a = review.annotated.assessment
            return pb2.ReviewSessionResponse(
                score=a.score,
                passed=a.passed,
                penalties=[
                    pb2.PenaltyMsg(code=p.code, points=p.points, detail=p.detail)
                    for p in a.penalties
                ],
                critical_errors=[
                    pb2.PenaltyMsg(code=p.code, points=p.points, detail=p.detail)
                    for p in a.critical_errors
                ],
                reactions=[
                    pb2.AlarmReactionMsg(
                        tag_id=r.tag_id, priority=r.priority, raised_at_s=r.raised_at_s,
                        ack_delay_s=r.ack_delay_s or 0, has_ack=r.ack_delay_s is not None,
                        first_corrective_delay_s=r.first_corrective_delay_s or 0,
                        has_corrective=r.first_corrective_delay_s is not None,
                        late=r.late,
                    )
                    for r in a.reaction.reactions
                ],
                steps=[
                    pb2.StepEvaluationMsg(
                        step=s.step, outcome=s.outcome, action=s.reference.action,
                        target=s.reference.target, delay_s=s.delay_s or 0,
                        has_delay=s.delay_s is not None,
                        matched_at_s=s.matched_action.model_time_s if s.matched_action else 0,
                        has_match=s.matched_action is not None,
                    )
                    for s in a.sequence.steps
                ],
                mean_ack_delay_s=a.reaction.mean_ack_delay_s or 0.0,
                has_mean_ack=a.reaction.mean_ack_delay_s is not None,
                annotations=[
                    pb2.AiAnnotationMsg(
                        kind=n.kind, text=n.text, confidence=n.confidence,
                        related_steps=list(n.related_steps),
                        suggested_score_delta=n.suggested_score_delta,
                    )
                    for n in review.annotated.annotations
                ],
                debrief_text=review.debrief_text,
                degraded=review.degraded,
            )

        def Chat(self, request, context):
            answer = app.chat.ask(
                question=request.question,
                session_mode=request.session_mode or SessionMode.TRAINING.value,
                equipment_filter=app.tags.equipment or None,
            )
            return pb2.ChatResponse(
                answer=answer.answer,
                citations=[
                    pb2.CitationMsg(
                        chunk_id=c["chunk_id"], source=c["source"],
                        section=c["section"], score=c["score"],
                    )
                    for c in answer.citations
                ],
                refused=answer.refused,
                refusal_reason=answer.refusal_reason,
                degraded=answer.degraded,
            )

    return AiServicer(), pb2_grpc


def serve(host: str = "0.0.0.0", port: int = 50051, application=None) -> int:  # pragma: no cover
    import grpc

    servicer, pb2_grpc = build_servicer(application)
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16))
    pb2_grpc.add_AiServiceServicer_to_server(servicer, server)
    # TLS терминируется Istio sidecar, поэтому слушаем незащищённый порт
    # внутри пода (mTLS обеспечивается mesh-ом, NFR-SEC-06).
    server.add_insecure_port(f"{host}:{port}")
    server.start()
    logger.info("gRPC-сервер слушает %s:%d", host, port)
    server.wait_for_termination()
    return 0
