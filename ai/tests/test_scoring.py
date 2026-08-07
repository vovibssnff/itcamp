import unittest

import context  # noqa: F401
from ai_service.analysis.reaction_time import evaluate_reaction_times
from ai_service.analysis.scoring import build_assessment
from ai_service.analysis.sequence import compare_sequence
from ai_service.domain.models import (
    AlarmEvent, ForbiddenAction, InterlockEvent, OperatorAction,
    PenaltyRule, ReferenceStep, ScenarioCriteria,
)

REFERENCE = [
    ReferenceStep(step=1, action="ACK_ALARM", target="PRSA-204", within_s=60),
    ReferenceStep(step=2, action="START", target="PUMP-N6A", within_s=90),
    ReferenceStep(step=3, action="SET_SP", target="FRC-408", within_s=150, value=42),
]


def a(t, type_, target, **kw):
    return OperatorAction(model_time_s=t, type=type_, target=target, **kw)


def assess(actions, alarms, criteria=None, interlocks=None):
    criteria = criteria or ScenarioCriteria()
    reaction = evaluate_reaction_times(alarms, actions, criteria.ack_deadline_s)
    sequence = compare_sequence(
        REFERENCE, actions, forbidden_actions=criteria.forbidden_actions
    )
    return build_assessment(reaction, sequence, criteria, interlocks)


class TestScoring(unittest.TestCase):
    def test_clean_run_scores_full(self):
        actions = [
            a(30, "ACK_ALARM", "PRSA 204"),
            a(70, "START", "PUMP-N6A"),
            a(120, "SET_SP", "FRC 408", value_to=42),
        ]
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=0)]
        result = assess(actions, alarms)
        self.assertEqual(result.score, 100)
        self.assertTrue(result.passed)

    def test_interlock_penalty(self):
        actions = [
            a(30, "ACK_ALARM", "PRSA 204"),
            a(70, "START", "PUMP-N6A"),
            a(120, "SET_SP", "FRC 408", value_to=42),
        ]
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=0)]
        result = assess(
            actions, alarms,
            interlocks=[InterlockEvent(code="K1_PRESSURE", tag_id="PRSA 204", at_s=512,
                                       description="Давление К-1 достигло 4,8 кгс/см2")],
        )
        self.assertEqual(result.score, 70)
        self.assertTrue(any(p.code == "INTERLOCK_FIRED" for p in result.penalties))

    def test_critical_error_forces_fail_regardless_of_score(self):
        """Критическая ошибка — незачёт, даже если баллов формально хватает."""
        criteria = ScenarioCriteria(
            pass_score=50,
            penalties={"FORBIDDEN_ACTION": PenaltyRule("FORBIDDEN_ACTION", -5)},
            forbidden_actions=[
                ForbiddenAction(code="LEVEL_BELOW_20PCT", action="SET_SP", target="LRCA-602",
                                description="Уровень в К-1 ниже 20 %")
            ],
        )
        actions = [
            a(30, "ACK_ALARM", "PRSA 204"),
            a(70, "START", "PUMP-N6A"),
            a(120, "SET_SP", "FRC 408", value_to=42),
            a(200, "SET_SP", "LRCA 602", value_to=12),
        ]
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=0)]
        result = assess(actions, alarms, criteria)
        self.assertGreaterEqual(result.score, criteria.pass_score)
        self.assertFalse(result.passed)
        self.assertEqual(result.critical_errors[0].code, "LEVEL_BELOW_20PCT")

    def test_score_never_negative(self):
        alarms = [
            AlarmEvent(tag_id=f"TAG {i}", priority="HH", raised_at_s=i * 10) for i in range(20)
        ]
        result = assess([], alarms)
        self.assertEqual(result.score, 0)

    def test_custom_penalties_override_defaults(self):
        criteria = ScenarioCriteria(penalties={"MISSED_STEP": PenaltyRule("MISSED_STEP", -50)})
        actions = [a(30, "ACK_ALARM", "PRSA 204")]
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=0)]
        result = assess(actions, alarms, criteria)
        missed = [p for p in result.penalties if p.code == "MISSED_STEP"]
        self.assertEqual(len(missed), 2)
        self.assertEqual(missed[0].points, -50)


if __name__ == "__main__":
    unittest.main()
