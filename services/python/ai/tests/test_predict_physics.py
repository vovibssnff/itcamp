import unittest

import context  # noqa: F401

from ai_service.domain.models import LimitDef, TagSeries
from ai_service.services.predict_physics import predict, visible_to_operator


class TestPredictPhysics(unittest.TestCase):
    def test_eta_matches_analytic_within_25pct(self):
        """PRSA 204 растёт на 0,3 кгс/см2 в минуту от 4,0 до блокировки 4,8."""
        step_s = 5
        # 0,005 кгс/см2 в секунду = 0,3 кгс/см2 в минуту; 20 точек по 5 с = 95 с тренда.
        values = [4.0 + 0.005 * step_s * i for i in range(20)]
        series = [TagSeries(tag_id="PRSA 204", values=values, t0_s=0, step_s=step_s, unit="кгс/см2")]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]

        result = predict(series, limits, horizon_s=600)[0]
        current = values[-1]
        expected = (4.8 - current) / 0.005
        self.assertIsNotNone(result.eta_s)
        self.assertLess(abs(result.eta_s - expected) / expected, 0.25)
        self.assertEqual(result.trend, "RISING")
        self.assertGreater(result.confidence, 0.9)

    def test_stable_parameter_gives_no_eta(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.0] * 20, t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        result = predict(series, limits)[0]
        self.assertIsNone(result.eta_s)
        self.assertEqual(result.trend, "STABLE")

    def test_trend_moving_away_from_limit(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.6 - 0.02 * i for i in range(20)],
                            t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        result = predict(series, limits)[0]
        self.assertIsNone(result.eta_s)
        self.assertEqual(result.trend, "AWAY")

    def test_beyond_horizon_returns_no_eta(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.0 + 0.0001 * i for i in range(20)],
                            t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        result = predict(series, limits, horizon_s=300)[0]
        self.assertIsNone(result.eta_s)
        self.assertEqual(result.trend, "RISING")

    def test_falling_level_toward_interlock(self):
        """Уровень в Е-1 падает к блокировке 15 % — прогноз должен сработать."""
        series = [TagSeries(tag_id="LRSA 603B", values=[40 - 0.5 * i for i in range(20)],
                            t0_s=0, step_s=10, unit="%")]
        limits = [LimitDef(tag_id="LRSA 603B", value=15.0, limit_type="INTERLOCK")]
        result = predict(series, limits, horizon_s=600)[0]
        self.assertIsNotNone(result.eta_s)
        self.assertEqual(result.trend, "FALLING")

    def test_deterministic(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.0 + 0.05 * i for i in range(20)],
                            t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        self.assertEqual(predict(series, limits)[0].eta_s, predict(series, limits)[0].eta_s)

    def test_hidden_in_exam_mode(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.0 + 0.05 * i for i in range(20)],
                            t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        preds = predict(series, limits, horizon_s=600)
        self.assertEqual(visible_to_operator(preds, "EXAM"), [])
        self.assertTrue(len(preds) > 0)

    def test_short_series_skipped(self):
        series = [TagSeries(tag_id="PRSA 204", values=[4.0, 4.1], t0_s=0, step_s=10)]
        limits = [LimitDef(tag_id="PRSA 204", value=4.8, limit_type="INTERLOCK")]
        self.assertEqual(predict(series, limits), [])


if __name__ == "__main__":
    unittest.main()
