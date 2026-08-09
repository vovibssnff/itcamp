import unittest

import context  # noqa: F401

from ai_service.analysis.sequence import compare_sequence
from ai_service.domain.models import ForbiddenAction, OperatorAction, ReferenceStep


def step(n, act, target, within=None, value=None, **kw):
    return ReferenceStep(step=n, action=act, target=target, within_s=within, value=value, **kw)


def action(t, type_, target, **kw):
    return OperatorAction(model_time_s=t, type=type_, target=target, **kw)


REFERENCE = [
    step(1, "ACK_ALARM", "PRSA-204", within=60),
    step(2, "START", "PUMP-N6A", within=90),
    step(3, "SET_SP", "FRC-408", within=150, value=42, tolerance_pct=10),
]


class TestSequence(unittest.TestCase):
    def test_perfect_run(self):
        actions = [
            action(30, "ACK_ALARM", "PRSA 204"),
            action(70, "START", "PUMP-N6A"),
            action(120, "SET_SP", "FRC 408", value_from=18, value_to=42),
        ]
        report = compare_sequence(REFERENCE, actions)
        self.assertEqual([s.outcome for s in report.steps], ["ON_TIME"] * 3)
        self.assertEqual(report.missed, [])
        self.assertEqual(report.extra, [])

    def test_missed_step(self):
        actions = [
            action(30, "ACK_ALARM", "PRSA 204"),
            action(120, "SET_SP", "FRC 408", value_to=42),
        ]
        report = compare_sequence(REFERENCE, actions)
        outcomes = {s.step: s.outcome for s in report.steps}
        self.assertEqual(outcomes[2], "MISSED")
        self.assertEqual(outcomes[1], "ON_TIME")
        self.assertEqual(outcomes[3], "ON_TIME")

    def test_out_of_order_is_distinct_from_missed(self):
        """Ключевое различие: действие выполнено, но не на своём месте."""
        actions = [
            action(20, "START", "PUMP-N6A"),
            action(40, "SET_SP", "FRC 408", value_to=42),
            action(80, "ACK_ALARM", "PRSA 204"),
        ]
        report = compare_sequence(REFERENCE, actions)
        outcomes = {s.step: s.outcome for s in report.steps}
        self.assertNotIn("MISSED", outcomes.values())
        self.assertIn("OUT_OF_ORDER", outcomes.values())

    def test_late_step(self):
        actions = [
            action(30, "ACK_ALARM", "PRSA 204"),
            action(70, "START", "PUMP-N6A"),
            action(400, "SET_SP", "FRC 408", value_to=42),
        ]
        report = compare_sequence(REFERENCE, actions)
        late = {s.step: s for s in report.steps if s.outcome == "LATE"}
        self.assertIn(3, late)
        self.assertEqual(late[3].delay_s, 250)

    def test_deadline_base_shifts_all_deadlines(self):
        """Дедлайны отсчитываются от срабатывания неисправности, а не от старта."""
        actions = [
            action(1030, "ACK_ALARM", "PRSA 204"),
            action(1070, "START", "PUMP-N6A"),
            action(1120, "SET_SP", "FRC 408", value_to=42),
        ]
        report = compare_sequence(REFERENCE, actions, deadline_base_s=1000)
        self.assertEqual([s.outcome for s in report.steps], ["ON_TIME"] * 3)

    def test_value_tolerance(self):
        inside = compare_sequence(
            [step(1, "SET_SP", "FRC-408", value=42, tolerance_pct=10)],
            [action(10, "SET_SP", "FRC 408", value_to=45)],
        )
        self.assertEqual(inside.steps[0].outcome, "ON_TIME")

        outside = compare_sequence(
            [step(1, "SET_SP", "FRC-408", value=42, tolerance_pct=10)],
            [action(10, "SET_SP", "FRC 408", value_to=20)],
        )
        self.assertEqual(outside.steps[0].outcome, "MISSED")

    def test_forbidden_action(self):
        forbidden = [
            ForbiddenAction(
                code="FUEL_WITHOUT_STEAM_PURGE",
                action="OPEN",
                target="FUEL-P1",
                description="Подача топлива без пара в камеры сгорания",
            )
        ]
        report = compare_sequence(
            REFERENCE, [action(50, "OPEN", "FUEL-P1")], forbidden_actions=forbidden
        )
        self.assertEqual(len(report.forbidden), 1)
        self.assertEqual(report.forbidden[0].forbidden_code, "FUEL_WITHOUT_STEAM_PURGE")

    def test_extra_actions_collected(self):
        actions = [
            action(30, "ACK_ALARM", "PRSA 204"),
            action(50, "SET_SP", "TRC 3", value_from=340, value_to=300),
            action(70, "START", "PUMP-N6A"),
            action(120, "SET_SP", "FRC 408", value_to=42),
        ]
        report = compare_sequence(REFERENCE, actions)
        self.assertEqual(len(report.extra), 1)
        self.assertEqual(report.extra[0].action.target, "TRC 3")

    def test_verify_steps_excluded_from_matching(self):
        reference = REFERENCE + [step(4, "VERIFY", "PRSA-204", within=420)]
        actions = [
            action(30, "ACK_ALARM", "PRSA 204"),
            action(70, "START", "PUMP-N6A"),
            action(120, "SET_SP", "FRC 408", value_to=42),
        ]
        report = compare_sequence(reference, actions)
        self.assertEqual(len(report.steps), 3)

    def test_optional_step_not_penalised_as_missed(self):
        reference = [step(1, "ACK_ALARM", "PRSA-204"), step(2, "STOP", "PUMP-N2", optional=True)]
        report = compare_sequence(reference, [action(10, "ACK_ALARM", "PRSA 204")])
        self.assertEqual(report.steps[1].outcome, "MISSED")
        self.assertTrue(report.steps[1].reference.optional)


if __name__ == "__main__":
    unittest.main()
