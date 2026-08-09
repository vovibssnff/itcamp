"""Детерминизм Model API и базовый жизненный цикл сессии."""
from __future__ import annotations

import unittest

from context import make_engine


class TestSessionLifecycle(unittest.TestCase):
    def test_create_get_destroy(self) -> None:
        engine = make_engine()
        state = engine.create_session("s1", seed=7)
        self.assertEqual(state.model_time_s, 0.0)
        self.assertIn("PRSA 204", state.tag_values)
        self.assertAlmostEqual(state.tag_values["PRSA 204"], 2.5, places=1)

        again = engine.get_state("s1")
        self.assertEqual(again.tag_values["PRSA 204"], state.tag_values["PRSA 204"])

        engine.destroy_session("s1")
        with self.assertRaises(KeyError):
            engine.get_state("s1")

    def test_determinism_same_seed(self) -> None:
        a = make_engine()
        b = make_engine()
        a.create_session("a", seed=42)
        b.create_session("b", seed=42)
        a.inject_fault("a", "FLT-K1-PRESSURE-HIGH")
        b.inject_fault("b", "FLT-K1-PRESSURE-HIGH")
        for _ in range(120):
            a.step("a", 1.0)
            b.step("b", 1.0)
        sa = a.get_state("a").tag_values
        sb = b.get_state("b").tag_values
        for tag in ("PRSA 204", "LRCA 602", "TR 55-9", "PRA 700"):
            self.assertAlmostEqual(sa[tag], sb[tag], places=9, msg=tag)

    def test_set_speed_clamped(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        self.assertEqual(engine.set_speed("s", 100.0), 10.0)
        self.assertEqual(engine.set_speed("s", 0.01), 0.1)


class TestDeterminismSetState(unittest.TestCase):
    def test_set_state_roundtrip(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=3)
        engine.inject_fault("s", "FLT-P3-COT-HIGH")
        for _ in range(50):
            engine.step("s", 1.0)
        snap = engine.sessions["s"].network.export_internal()
        t = engine.get_state("s").model_time_s
        values = dict(engine.get_state("s").tag_values)

        engine2 = make_engine()
        engine2.create_session("s2", seed=3)
        engine2.set_state("s2", internal_state=snap, model_time_s=t)
        restored = engine2.get_state("s2").tag_values
        for tag, value in values.items():
            self.assertAlmostEqual(restored[tag], value, places=6, msg=tag)


if __name__ == "__main__":
    unittest.main()
