import unittest

import context  # noqa: F401

from ai_service.analysis.reaction_time import evaluate_reaction_times
from ai_service.domain.models import AlarmEvent, OperatorAction


def action(t, type_, target, **kw):
    return OperatorAction(model_time_s=t, type=type_, target=target, **kw)


class TestReactionTime(unittest.TestCase):
    def test_ack_delay_is_arithmetic(self):
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=100)]
        actions = [action(147, "ACK_ALARM", "PRSA-204")]
        report = evaluate_reaction_times(alarms, actions, ack_deadline_s=60)
        self.assertEqual(report.reactions[0].ack_delay_s, 47)
        self.assertFalse(report.reactions[0].late)
        self.assertEqual(report.late_count, 0)

    def test_late_ack_is_flagged(self):
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=100)]
        report = evaluate_reaction_times(
            alarms, [action(200, "ACK_ALARM", "PRSA 204")], ack_deadline_s=60
        )
        self.assertEqual(report.reactions[0].ack_delay_s, 100)
        self.assertTrue(report.reactions[0].late)
        self.assertEqual(report.late_count, 1)

    def test_unacked_alarm(self):
        alarms = [AlarmEvent(tag_id="LRCA 602", priority="H", raised_at_s=50)]
        report = evaluate_reaction_times(alarms, [], ack_deadline_s=60)
        self.assertIsNone(report.reactions[0].ack_delay_s)
        self.assertTrue(report.reactions[0].late)
        self.assertEqual(report.unacked_count, 1)

    def test_ack_before_alarm_does_not_count(self):
        """Квитирование до появления аларма не должно засчитываться."""
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=100)]
        report = evaluate_reaction_times(
            alarms, [action(50, "ACK_ALARM", "PRSA 204")], ack_deadline_s=60
        )
        self.assertIsNone(report.reactions[0].ack_delay_s)

    def test_corrective_action_with_remediation_map(self):
        alarms = [AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=100)]
        actions = [
            action(110, "SET_SP", "TRC 3", value_to=300),   # не относится к аларму
            action(160, "SET_SP", "FRC 408", value_to=42),  # относится
        ]
        report = evaluate_reaction_times(
            alarms, actions, remediation_map={"PRSA 204": {"FRC 408", "PUMP-N6A"}}
        )
        self.assertEqual(report.reactions[0].first_corrective_delay_s, 60)

    def test_aggregates(self):
        alarms = [
            AlarmEvent(tag_id="PRSA 204", priority="HH", raised_at_s=100),
            AlarmEvent(tag_id="LRCA 602", priority="H", raised_at_s=200),
        ]
        actions = [
            action(120, "ACK_ALARM", "PRSA 204"),
            action(280, "ACK_ALARM", "LRCA 602"),
        ]
        report = evaluate_reaction_times(alarms, actions, ack_deadline_s=60)
        self.assertEqual(report.mean_ack_delay_s, 50.0)
        self.assertEqual(report.max_ack_delay_s, 80)
        self.assertEqual(report.late_count, 1)


if __name__ == "__main__":
    unittest.main()
