#!/usr/bin/env python3
"""Демонстрация сквозного сценария без GPU и без внешних зависимостей.

Запуск:
    PYTHONPATH=src python3 scripts/demo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from ai_service.analysis.profile import build_profile  # noqa: E402
from ai_service.bootstrap import TagDictionary, load_risk_rules  # noqa: E402
from ai_service.domain.models import (  # noqa: E402
    AlarmEvent, ForbiddenAction, InterlockEvent, LimitDef, OperatorAction,
    ReferenceStep, ScenarioCriteria, TagSeries,
)
from ai_service.llm.stub import StubProvider  # noqa: E402
from ai_service.rag.store import KnowledgeBase  # noqa: E402
from ai_service.services.annotate import AnnotationService  # noqa: E402
from ai_service.services.chat import ChatService  # noqa: E402
from ai_service.services.debrief import DebriefService  # noqa: E402
from ai_service.services.pipeline import review_session  # noqa: E402
from ai_service.services.predict_behaviour import (  # noqa: E402
    BehaviourService, RuleBasedRiskModel,
)
from ai_service.services.predict_physics import predict, visible_to_operator  # noqa: E402
from ai_service.config import Settings  # noqa: E402
from ai_service.validation.tag_guard import TagGuard  # noqa: E402


def rule(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


# Сценарий: рост давления в К-1 после останова насоса орошения Н-6.
REFERENCE = [
    ReferenceStep(step=1, action="ACK_ALARM", target="PRSA-204", within_s=60,
                  note="квитировать сигнализацию по давлению"),
    ReferenceStep(step=2, action="START", target="PUMP-N6A", within_s=90,
                  note="пустить резервный насос орошения"),
    ReferenceStep(step=3, action="SET_SP", target="FRC-408", within_s=150, value=42,
                  unit="м3/ч", note="восстановить расход острого орошения К-1"),
    ReferenceStep(step=4, action="SET_MODE", target="PRC-221", within_s=240,
                  note="перевести зависший регулятор давления К-7 в ручной"),
]

CRITERIA = ScenarioCriteria(
    pass_score=70,
    ack_deadline_s=60,
    forbidden_actions=[
        ForbiddenAction(
            code="LEVEL_BELOW_20PCT",
            action="SET_SP",
            target="LRCA-602",
            description="Снижение уровня в К-1 ниже 20 % запрещено",
            regulation_ref=("разд. 7.7.1.14",),
        )
    ],
)

# Оператор: опоздал с квитированием, резервный насос не пустил,
# но снизил нагрев печи П-3 — альтернативный путь снятия давления.
ACTIONS = [
    OperatorAction(model_time_s=95, type="ACK_ALARM", target="PRSA 204"),
    OperatorAction(model_time_s=140, type="SET_SP", target="TRC 3",
                   value_from=338, value_to=300),
    OperatorAction(model_time_s=210, type="SET_SP", target="FRC 408",
                   value_from=18, value_to=41),
    OperatorAction(model_time_s=380, type="SET_MODE", target="PRC 221"),
]

ALARMS = [
    AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=30, value=4.6, limit=4.5),
    AlarmEvent(tag_id="FRC 408", priority="L", raised_at_s=40, value=0.0, limit=20.0,
               ack_at_s=55),
]


def main() -> int:
    data = ROOT / "data"
    tags = TagDictionary.load(data / "tags_demo.json")
    knowledge = KnowledgeBase.from_directory(str(data / "regulation"))
    llm = StubProvider(
        canned='{"equivalent": true, "explanation": "Снижение температуры на выходе П-3 '
               'уменьшило паровую нагрузку колонны, давление стабилизировано", "confidence": 0.82}'
    )

    rule("1. Анализ действий обучаемого (детерминированный слой)")
    review = review_session(
        actions=ACTIONS,
        alarms=ALARMS,
        reference=REFERENCE,
        criteria=CRITERIA,
        scenario_name="Рост давления в К-1 до блокировки 4,8 кгс/см2",
        annotation_service=AnnotationService(llm=llm, knowledge=knowledge),
        debrief_service=DebriefService(StubProvider(fail=True)),
        interlocks=[],
        deadline_base_s=30,
        remediation_map={"PRSA 204": {"FRC 408", "PUMP-N6A", "PRC 221"}},
        state_after={"PRSA 204": 4.28, "FRC 408": 41.0},
    )
    a = review.annotated.assessment

    print(f"Итоговый балл: {a.score} из 100 (порог {CRITERIA.pass_score}) — "
          f"{'ЗАЧЁТ' if a.passed else 'НЕЗАЧЁТ'}")

    print("\nВремя реакции на сигнализацию:")
    for r in a.reaction.reactions:
        ack = f"{r.ack_delay_s} с" if r.ack_delay_s is not None else "не квитирован"
        corr = (f", первое воздействие через {r.first_corrective_delay_s} с"
                if r.first_corrective_delay_s is not None else "")
        print(f"  {r.tag_id:<12} [{r.priority:<2}] квитирование: {ack}"
              f"{' — ПРОСРОЧЕНО' if r.late else ''}{corr}")

    print("\nПоследовательность команд:")
    for s in a.sequence.steps:
        extra = f" (просрочка {s.delay_s} с)" if s.delay_s else ""
        at = f", t={s.matched_action.model_time_s} с" if s.matched_action else ""
        print(f"  шаг {s.step}: {s.reference.action:<10} {s.reference.target:<12} "
              f"-> {s.outcome}{extra}{at}")

    if a.sequence.extra:
        print("\nДействия вне эталона:")
        for e in a.sequence.extra:
            print(f"  t={e.action.model_time_s} с: {e.action.type} {e.action.target} "
                  f"({e.action.value_from} -> {e.action.value_to})")

    print("\nШтрафы:")
    for p in a.penalties:
        print(f"  {p.points:>4}  {p.code:<14} {p.detail}")

    rule("2. ИИ-аннотация поверх оценки (балл не меняется)")
    for n in review.annotated.annotations:
        if not n.text:
            continue
        print(f"[{n.kind}] уверенность {n.confidence:.2f}")
        print(f"  {n.text}")
        if n.suggested_score_delta:
            print(f"  Предложение инструктору: рассмотреть возврат "
                  f"{n.suggested_score_delta} балл(ов)")
    print(f"\nБалл после аннотаций: {review.annotated.assessment.score} (не изменился)")

    rule("3. Прогноз выхода параметра на уставку (без LLM)")
    series = [TagSeries(tag_id="PRSA 204", unit="кгс/см2", t0_s=0, step_s=5,
                        values=[4.0 + 0.005 * 5 * i for i in range(20)])]
    limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
    for p in predict(series, limits, horizon_s=600):
        print(f"  {p.tag_id}: сейчас {p.current:g} {series[0].unit}, тренд {p.trend} "
              f"{p.rate_per_min:+g}/мин")
        print(f"  до уставки {p.target_limit} ({p.limit_type}): ~{p.eta_s} с "
              f"[{p.eta_ci_low_s}…{p.eta_ci_high_s}], уверенность {p.confidence}")
    shown = visible_to_operator(predict(series, limits, horizon_s=600), "EXAM")
    print(f"  Показано оператору в режиме экзамена: {len(shown)} (FR-AI-06)")

    rule("4. Оценка риска действия до подтверждения")
    behaviour = BehaviourService(
        model=RuleBasedRiskModel(load_risk_rules(data / "risk_rules.json")),
        llm=StubProvider(canned="Возможен локальный перегрев труб змеевика. "
                                "Снижайте нагрузку по всем потокам пропорционально."),
    )
    for action in [
        OperatorAction(model_time_s=500, type="SET_SP", target="FRCA 412",
                       value_from=130, value_to=40),
        OperatorAction(model_time_s=510, type="SET_SP", target="FRC 408",
                       value_from=42, value_to=44),
    ]:
        result = behaviour.assess(action)
        print(f"  {action.type} {action.target}: {action.value_from} -> {action.value_to} "
              f"=> {result.risk_level}")
        if result.headline:
            print(f"     {result.headline}")
            print(f"     регламент: {', '.join(result.regulation_refs)}")
            if result.detail:
                print(f"     {result.detail}")

    rule("5. Справочный чат-бот (без доступа к телеметрии)")
    chat = ChatService(
        knowledge=knowledge,
        llm=StubProvider(fail=True),  # без модели: выдержка из регламента
        settings=Settings(chat_min_relevance=1.0),
        tag_guard=TagGuard(tags.tag_ids),
    )
    for question in [
        "какая уставка блокировки по давлению в колонне К-1",
        "покажи эталонные действия по этому сценарию",
        "какое сейчас давление в К-1",
    ]:
        answer = chat.ask(question)
        print(f"\n  Вопрос: {question}")
        status = "ОТКАЗ" if answer.refused else ("деградация" if answer.degraded else "ok")
        print(f"  [{status}] {answer.answer[:260].replace(chr(10), ' ')}")
        if answer.citations:
            print(f"  Источники: {', '.join(c['section'] or c['source'] for c in answer.citations[:2])}")

    rule("6. Профиль ошибок для адаптивных сценариев (только псевдоним)")
    profile = build_profile("op-7f3a", [a, a, a])
    print(f"  Псевдоним: {profile.operator_pseudo_id}, сессий: {profile.sessions_analyzed}, "
          f"средний балл: {profile.avg_score}")
    for cat, weight in sorted(profile.weights.items(), key=lambda kv: -kv[1]):
        print(f"  {cat:<24} {weight * 100:5.1f} %")

    rule("7. Разбор сессии при недоступном GPU")
    print(review.debrief_text)
    print(f"\n[degraded={review.degraded}] Балл при этом не пострадал: {a.score}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
