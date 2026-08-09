"""Проверка ключевого архитектурного свойства: падение ИИ не ломает оценку."""
import unittest

import context  # noqa: F401
from ai_service.analysis.profile import build_profile
from ai_service.domain.models import (
    AlarmEvent, OperatorAction, ReferenceStep, ScenarioCriteria,
)
from ai_service.llm.stub import StubProvider
from ai_service.rag.store import KnowledgeBase
from ai_service.resilience.circuit_breaker import BreakerState, CircuitBreaker
from ai_service.services.annotate import AnnotationService
from ai_service.services.debrief import DebriefService
from ai_service.services.pipeline import review_session

REFERENCE = [
    ReferenceStep(step=1, action="ACK_ALARM", target="PRSA-204", within_s=60),
    ReferenceStep(step=2, action="START", target="PUMP-N6A", within_s=90),
    ReferenceStep(step=3, action="SET_SP", target="FRC-408", within_s=150, value=42),
]
ALARMS = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=0, value=4.6, limit=4.5)]
ACTIONS = [
    OperatorAction(model_time_s=95, type="ACK_ALARM", target="PRSA 204"),
    OperatorAction(model_time_s=140, type="SET_SP", target="TRC 3",
                   value_from=340, value_to=300),
    OperatorAction(model_time_s=200, type="SET_SP", target="FRC 408",
                   value_from=18, value_to=42),
]


def run(llm):
    return review_session(
        actions=ACTIONS,
        alarms=ALARMS,
        reference=REFERENCE,
        criteria=ScenarioCriteria(),
        scenario_name="Рост давления в К-1",
        annotation_service=AnnotationService(llm=llm, knowledge=KnowledgeBase([])),
        debrief_service=DebriefService(llm),
    )


class TestDegradation(unittest.TestCase):
    def test_score_identical_with_and_without_llm(self):
        """Балл обязан совпасть: ИИ не участвует в его расчёте."""
        healthy = run(StubProvider())
        broken = run(StubProvider(fail=True))
        self.assertEqual(healthy.annotated.assessment.score, broken.annotated.assessment.score)
        self.assertEqual(
            [p.code for p in healthy.annotated.assessment.penalties],
            [p.code for p in broken.annotated.assessment.penalties],
        )

    def test_degraded_flag_set_when_llm_down(self):
        broken = run(StubProvider(fail=True))
        self.assertTrue(broken.degraded)
        self.assertTrue(broken.debrief_text)  # разбор всё равно построен

    def test_debrief_without_llm_contains_facts(self):
        broken = run(StubProvider(fail=True))
        self.assertIn("Рост давления в К-1", broken.debrief_text)
        self.assertIn("PRSA 204", broken.debrief_text)

    def test_annotations_never_change_score(self):
        healthy = run(StubProvider(canned='{"equivalent": true, "explanation": "Снижение нагрева печи П-3 сняло паровую нагрузку", "confidence": 0.8}'))
        before = healthy.annotated.assessment.score
        self.assertTrue(healthy.annotated.annotations)
        self.assertEqual(healthy.annotated.assessment.score, before)
        deltas = [n.suggested_score_delta for n in healthy.annotated.annotations]
        self.assertTrue(any(d > 0 for d in deltas))

    def test_equivalent_strategy_detected(self):
        result = run(StubProvider(
            canned='{"equivalent": true, "explanation": "Цель достигнута снижением TRC 3", "confidence": 0.85}'
        ))
        kinds = [n.kind for n in result.annotated.annotations]
        self.assertIn("EQUIVALENT_STRATEGY", kinds)


class TestCircuitBreaker(unittest.TestCase):
    def test_opens_after_threshold(self):
        breaker = CircuitBreaker(failure_threshold=3, reset_timeout_s=60)
        self.assertTrue(breaker.allows())
        for _ in range(3):
            breaker.record_failure()
        self.assertFalse(breaker.allows())
        self.assertIs(breaker.state, BreakerState.OPEN)

    def test_success_resets(self):
        breaker = CircuitBreaker(failure_threshold=3)
        breaker.record_failure()
        breaker.record_failure()
        breaker.record_success()
        breaker.record_failure()
        self.assertTrue(breaker.allows())

    def test_half_open_after_timeout(self):
        breaker = CircuitBreaker(failure_threshold=1, reset_timeout_s=0.0)
        breaker.record_failure()
        self.assertIs(breaker.state, BreakerState.HALF_OPEN)
        self.assertTrue(breaker.allows())


class TestProfile(unittest.TestCase):
    def test_profile_uses_pseudonym_only(self):
        results = [run(StubProvider()).annotated.assessment for _ in range(3)]
        profile = build_profile("op-7f3a", results)
        self.assertEqual(profile.operator_pseudo_id, "op-7f3a")
        self.assertEqual(profile.sessions_analyzed, 3)
        self.assertTrue(profile.weights)
        self.assertAlmostEqual(sum(profile.weights.values()), 1.0, places=2)

    def test_empty_history(self):
        profile = build_profile("op-1", [])
        self.assertEqual(profile.sessions_analyzed, 0)
        self.assertEqual(profile.top_categories(), [])


if __name__ == "__main__":
    unittest.main()
