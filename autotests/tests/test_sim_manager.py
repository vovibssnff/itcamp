"""Автотесты sim-manager — диспетчер Simulation Engine.

Контракт: helper/sim-manager.http.

Примечание: sim-manager НЕ входит в compose/app (поднимается отдельно).
Если сервис недоступен, тесты пропускаются через маркер `sim`.
"""
import uuid

import pytest

from conftest import sim_client  # noqa: F401

pytestmark = pytest.mark.sim


def test_healthz(sim_client):
    r = sim_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_list_sessions(sim_client):
    r = sim_client.get("/sessions")
    assert r.status_code == 200


def test_get_session_not_found(sim_client):
    r = sim_client.get(f"/sessions/{uuid.uuid4().hex}")
    assert r.status_code == 404


def test_create_session_requires_body(sim_client):
    r = sim_client.post("/sessions", json={})
    assert r.status_code in (400, 422)


def test_delete_session_not_found(sim_client):
    r = sim_client.delete(f"/sessions/{uuid.uuid4().hex}")
    assert r.status_code == 404
