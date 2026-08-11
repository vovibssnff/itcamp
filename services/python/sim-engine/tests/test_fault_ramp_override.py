"""Scenario ramp_s override must shorten catalog ramps (e2e / instructor params)."""
from __future__ import annotations

import unittest

from context import make_engine


class TestFaultRampOverride(unittest.TestCase):
    def test_ramp_override_raises_k1_alarm_sooner(self) -> None:
        eng = make_engine()
        eng.create_session("s", seed=42)
        for _ in range(10):
            eng.step("s", 1.0)
        eng.inject_fault("s", "FLT-K1-PRESSURE-HIGH", magnitude=1.0, ramp_s=30.0)
        alarm_at: float | None = None
        for _ in range(120):
            result = eng.step("s", 1.0)
            if any(a.tag_id == "PRSA 204" for a in result.new_alarms):
                alarm_at = result.state.model_time_s
                break
        self.assertIsNotNone(alarm_at, "expected PRSA 204 H with ramp_s=30")
        # Catalog ramp is 300s → alarm ~226; with 30s override expect well under 150.
        self.assertLess(alarm_at, 150.0)

    def test_rest_accepts_ramp_s(self) -> None:
        try:
            from fastapi.testclient import TestClient
        except ImportError:  # pragma: no cover
            self.skipTest("fastapi not installed")
        from context import make_app

        from sim_engine.api.rest import create_app

        client = TestClient(create_app(make_app()))
        r = client.post("/v1/sessions", json={"session_id": "ramp-rest", "seed": 1})
        self.assertEqual(r.status_code, 200)
        r = client.post(
            "/v1/sessions/ramp-rest/faults",
            json={"fault_id": "FLT-K1-PRESSURE-HIGH", "magnitude": 1.0, "ramp_s": 30},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json().get("ramp_s"), 30.0)
        client.delete("/v1/sessions/ramp-rest")


if __name__ == "__main__":
    unittest.main()
