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


if __name__ == "__main__":
    unittest.main()
