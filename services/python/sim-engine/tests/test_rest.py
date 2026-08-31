"""Интеграционные проверки REST-фасада (без uvicorn — TestClient)."""
from __future__ import annotations

import unittest

from context import make_app

try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    TestClient = None  # type: ignore


@unittest.skipIf(TestClient is None, "fastapi не установлен")
class TestRestApi(unittest.TestCase):
    def setUp(self) -> None:
        from sim_engine.api.rest import create_app

        self.app_obj = make_app()
        self.client = TestClient(create_app(self.app_obj))

    def test_health(self) -> None:
        r = self.client.get("/healthz")
        self.assertEqual(r.status_code, 200)
        r = self.client.get("/readyz")
        self.assertEqual(r.status_code, 200)
        self.assertGreater(r.json()["tags_loaded"], 50)
        self.assertEqual(r.json()["faults_loaded"], 10)

    def test_session_step_fault(self) -> None:
        r = self.client.post("/v1/sessions", json={"session_id": "rest-1", "seed": 1})
        self.assertEqual(r.status_code, 200)
        self.assertIn("PRSA 204", r.json()["tag_values"])

        r = self.client.post(
            "/v1/sessions/rest-1/faults",
            json={"fault_id": "FLT-K1-PRESSURE-HIGH"},
        )
        self.assertEqual(r.status_code, 200)

        r = self.client.post("/v1/sessions/rest-1/step", json={"real_dt_s": 1.0})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["state"]["model_time_s"], 1.0)

        r = self.client.get("/v1/faults")
        self.assertEqual(len(r.json()["faults"]), 10)

        r = self.client.delete("/v1/sessions/rest-1")
        self.assertEqual(r.status_code, 200)

    def test_state_exposes_controller_sp_and_out(self) -> None:
        sid = "rest-sp-out"
        r = self.client.post("/v1/sessions", json={"session_id": sid, "seed": 1})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("controller_setpoints", body)
        self.assertIn("controller_outputs", body)
        self.assertIn("LRCA 602", body["controller_setpoints"])
        self.assertIn("LRCA 602", body["controller_outputs"])

        # Change SP without waiting for PV to catch up — SP must differ from PV.
        before_pv = body["tag_values"]["LRCA 602"]
        new_sp = before_pv + 5.0
        r = self.client.post(
            f"/v1/sessions/{sid}/command",
            json={"type": "SET_SP", "target": "LRCA 602", "value_to": new_sp},
        )
        self.assertEqual(r.status_code, 200)

        r = self.client.get(f"/v1/sessions/{sid}/state")
        self.assertEqual(r.status_code, 200)
        state = r.json()
        self.assertAlmostEqual(state["controller_setpoints"]["LRCA 602"], new_sp, places=3)
        self.assertNotAlmostEqual(
            state["controller_setpoints"]["LRCA 602"],
            state["tag_values"]["LRCA 602"],
            places=2,
        )
        # OUT is a real actuator signal, not a copy of PV.
        self.assertNotAlmostEqual(
            state["controller_outputs"]["LRCA 602"],
            state["tag_values"]["LRCA 602"],
            places=1,
        )

        r = self.client.delete(f"/v1/sessions/{sid}")
        self.assertEqual(r.status_code, 200)


if __name__ == "__main__":
    unittest.main()
