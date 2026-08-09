"""Физика L1: контуры, печи, воздух КИП."""
from __future__ import annotations

import unittest

from context import make_engine
from sim_engine.domain.models import OperatorCommand


class TestSteadyState(unittest.TestCase):
    def test_idle_holds_setpoints(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        initial = dict(engine.get_state("s").tag_values)
        for _ in range(120):
            engine.step("s", 1.0)
        after = engine.get_state("s").tag_values
        for tag in ("PRSA 204", "LRCA 602", "PRSA 213", "LRCA 641", "PRCA 220"):
            self.assertAlmostEqual(after[tag], initial[tag], delta=0.5, msg=tag)

    def test_furnace_cot_rises_when_flow_drops(self) -> None:
        """Докс-сценарий 2.1/3.1: падение расхода при том же топливе → рост COT.

        Топливный контур переводим в MANUAL, иначе ПИ снизит газ и удержит COT.
        """
        engine = make_engine()
        engine.create_session("s", seed=1)
        before = engine.get_state("s").tag_values["TR 55-9"]
        fuel_out = engine.sessions["s"].network.furnaces["P3"].fuel.output
        engine.command("s", OperatorCommand(0, "SET_MODE", "TRC 3", value_to=1.0))
        engine.command("s", OperatorCommand(0, "SET_OUT", "TRC 3", value_to=fuel_out))
        engine.command("s", OperatorCommand(0, "SET_SP", "FRCA 416", value_to=20))
        for _ in range(180):
            engine.step("s", 1.0)
        after = engine.get_state("s").tag_values["TR 55-9"]
        self.assertGreater(after, before + 5.0)

    def test_instrument_air_depletes(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        engine.inject_fault("s", "FLT-IA-PRESSURE-LOW")
        for _ in range(100):
            engine.step("s", 1.0)
        pct = engine.get_state("s").tag_values["PRA 700"]
        # capacity 3600 с, за 100 с без питания запас ≈ 97 %
        self.assertLess(pct, 98.0)
        self.assertGreater(pct, 95.0)


class TestControlLoopSaturation(unittest.TestCase):
    def test_pressure_rises_under_uncompensable_disturbance(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        engine.inject_fault("s", "FLT-K1-PRESSURE-HIGH")
        p0 = engine.get_state("s").tag_values["PRSA 204"]
        for _ in range(200):
            engine.step("s", 1.0)
        p1 = engine.get_state("s").tag_values["PRSA 204"]
        self.assertGreater(p1, p0 + 1.0)


if __name__ == "__main__":
    unittest.main()
