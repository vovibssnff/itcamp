"""Неисправности из докс-сценариев и блокировки ПАЗ по регламенту."""
from __future__ import annotations

import unittest

from context import make_engine

from sim_engine.domain.models import OperatorCommand


class TestFaultCatalog(unittest.TestCase):
    EXPECTED = {
        "FLT-ELOU-INTERFACE-LOW",
        "FLT-ELOU-PRESSURE-HIGH",
        "FLT-FEED-FLOW-LOW",
        "FLT-P3-COT-HIGH",
        "FLT-K1-PRESSURE-HIGH",
        "FLT-K1-LEVEL-LOW",
        "FLT-K2-VACUUM-LOSS",
        "FLT-K31-LEVEL-LOW",
        "FLT-K4-PRESSURE-HIGH",
        "FLT-IA-PRESSURE-LOW",
    }

    def test_ten_docx_faults_loaded(self) -> None:
        engine = make_engine()
        self.assertEqual(set(engine.faults_catalog), self.EXPECTED)


class TestScenarioK1Pressure(unittest.TestCase):
    """§4.1: давление верха К-1 → H 4.5 → INTERLOCK 4.8."""

    def test_without_action_reaches_interlock(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=42)
        engine.inject_fault("s", "FLT-K1-PRESSURE-HIGH")
        tripped = False
        for _ in range(400):
            result = engine.step("s", 1.0)
            if any(e.code.startswith("PRSA 204") for e in result.new_interlocks):
                tripped = True
                break
        self.assertTrue(tripped, "ожидалась блокировка PRSA 204 при 4.8")
        self.assertGreaterEqual(engine.get_state("s").tag_values["PRSA 204"], 4.8)

    def test_stabilization_prevents_interlock(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=42)
        engine.inject_fault("s", "FLT-K1-PRESSURE-HIGH")
        for t in range(1, 301):
            if t == 60:
                for target, value in (
                    ("AVZ3_SPEED", 100.0),
                    ("COOLING_WATER_K1", 500.0),
                    ("FRC 408", 80.0),
                ):
                    engine.command(
                        "s",
                        OperatorCommand(t, "SET_SP", target, value_to=value),
                    )
            result = engine.step("s", 1.0)
            if any(e.code.startswith("PRSA 204") for e in result.new_interlocks):
                self.fail(
                    f"ПАЗ сработал на t={result.state.model_time_s} "
                    f"при PV={result.state.tag_values['PRSA 204']:.2f}"
                )
        self.assertLess(engine.get_state("s").tag_values["PRSA 204"], 4.8)


class TestScenarioP3Cot(unittest.TestCase):
    def test_cot_alarm_on_fuel_disturbance(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        engine.inject_fault("s", "FLT-P3-COT-HIGH")
        saw_alarm = False
        for _ in range(120):
            result = engine.step("s", 1.0)
            if any(a.tag_id == "TR 55-9" for a in result.new_alarms):
                saw_alarm = True
                break
        self.assertTrue(saw_alarm)
        self.assertGreaterEqual(engine.get_state("s").tag_values["TR 55-9"], 340.0)


class TestScenarioElouInterface(unittest.TestCase):
    def test_interface_low_trips_voltage(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        engine.inject_fault("s", "FLT-ELOU-INTERFACE-LOW")
        tripped = set()
        for _ in range(900):
            result = engine.step("s", 1.0)
            for e in result.new_interlocks:
                tripped.add(e.tag_id)
            if {"LRCA 641", "LRCA 640", "LRCA 639"} <= tripped:
                break
        self.assertTrue({"LRCA 641"} & tripped, tripped)


class TestScenarioInstrumentAir(unittest.TestCase):
    def test_failsafe_after_buffer_empty(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        # Ускорим расход: уменьшим ёмкость через внутреннее состояние.
        ia = engine.sessions["s"].network.ia_buffer
        ia.capacity_s = 30.0
        ia.remaining_s = 30.0
        engine.inject_fault("s", "FLT-IA-PRESSURE-LOW")
        saw = False
        for _ in range(60):
            result = engine.step("s", 1.0)
            if any(e.code == "IA_FAILSAFE" for e in result.new_interlocks):
                saw = True
                break
        self.assertTrue(saw)
        for f in engine.sessions["s"].network.furnaces.values():
            self.assertAlmostEqual(f.fuel.output, 0.0, places=3)


class TestEsd(unittest.TestCase):
    def test_esd_cuts_fuel_and_stops_pumps(self) -> None:
        engine = make_engine()
        engine.create_session("s", seed=1)
        engine.command("s", OperatorCommand(0, "ESD", "ESD-ATM"))
        state = engine.get_state("s")
        for tag in ("PUMP-N1", "PUMP-N2", "PUMP-N3"):
            self.assertEqual(state.equipment_states[tag], "STOPPED")
        for f in engine.sessions["s"].network.furnaces.values():
            self.assertAlmostEqual(f.fuel.output, 0.0, places=3)


if __name__ == "__main__":
    unittest.main()
