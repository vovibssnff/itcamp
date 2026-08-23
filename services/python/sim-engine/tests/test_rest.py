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
        # Step responses stay lean — no full network snapshot on every tick.
        self.assertNotIn("internal_state", r.json()["state"])

        r = self.client.get("/v1/faults")
        self.assertEqual(len(r.json()["faults"]), 10)

        r = self.client.delete("/v1/sessions/rest-1")
        self.assertEqual(r.status_code, 200)

    def test_get_state_includes_internal_for_restore(self) -> None:
        self.client.post("/v1/sessions", json={"session_id": "rest-cp", "seed": 3})
        # Mutate a pump so restore must bring it back.
        session = self.app_obj.engine.sessions["rest-cp"]
        pump_id = next(iter(session.network.pumps))
        from sim_engine.domain.enums import EquipmentState

        session.network.pumps[pump_id].state = EquipmentState.STOPPED
        session.model_time_s = 15.0

        r = self.client.get("/v1/sessions/rest-cp/state")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("internal_state", body)
        self.assertEqual(body["internal_state"]["pumps"][pump_id]["state"], "STOPPED")
        self.assertEqual(body["model_time_s"], 15.0)
        self.assertEqual(body["seed"], 3)

        # Fresh session + restore via internal_state must recover pump + time.
        self.client.post("/v1/sessions", json={"session_id": "rest-cp-2", "seed": 3})
        r = self.client.put(
            "/v1/sessions/rest-cp-2/state",
            json={
                "internal_state": body["internal_state"],
                "model_time_s": body["model_time_s"],
            },
        )
        self.assertEqual(r.status_code, 200)
        restored = self.app_obj.engine.sessions["rest-cp-2"]
        self.assertEqual(restored.network.pumps[pump_id].state, EquipmentState.STOPPED)
        self.assertEqual(restored.model_time_s, 15.0)

        self.client.delete("/v1/sessions/rest-cp")
        self.client.delete("/v1/sessions/rest-cp-2")


if __name__ == "__main__":
    unittest.main()
