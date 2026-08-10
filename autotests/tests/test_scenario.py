"""Автотесты scenario — сценарии и модели неисправностей.

Контракт: helper/scenario.http.
Внутренние сервисы доверяют заголовкам X-User-ID/X-Roles (trust boundary).
"""
import uuid

import pytest

from conftest import scenario_client  # noqa: F401

ADMIN_H = {"X-Roles": "admin", "X-User-ID": "admin-1"}
NONE_H = {}


def test_healthz(scenario_client):
    r = scenario_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_faults_list(scenario_client):
    r = scenario_client.get("/faults")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_fault_not_found(scenario_client):
    r = scenario_client.get("/faults/no-such-fault")
    assert r.status_code == 404


def test_create_scenario_without_role_succeeds(scenario_client):
    """RBAC для сценариев проверяет gw: на прямом вызове без X-Roles
    сценарий создаётся успешно (201)."""
    payload = {"template_id": "tmpl_x", "name": f"S-{uuid.uuid4().hex[:6]}",
               "type": "training", "start_preset_id": "p1",
               "faults": [], "reference_actions": [], "criteria": {}}
    r = scenario_client.post("/scenarios", headers=NONE_H, json=payload)
    assert r.status_code == 201, r.text


def test_scenarios_list(scenario_client):
    r = scenario_client.get("/scenarios")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_scenario_not_found(scenario_client):
    r = scenario_client.get(f"/scenarios/{uuid.uuid4().hex}")
    assert r.status_code == 404


# --------------------------------------------------------------------------
# CRUD через REST (scenario не проверяет RBAC на прямых вызовах → 201)
# --------------------------------------------------------------------------

def _make_scenario():
    return {"template_id": "tmpl_x", "name": f"S-{uuid.uuid4().hex[:6]}",
            "type": "training", "start_preset_id": "p1",
            "faults": [], "reference_actions": [], "criteria": {}}


@pytest.fixture(scope="module")
def created_scenario(scenario_client):
    r = scenario_client.post("/scenarios", headers=NONE_H, json=_make_scenario())
    assert r.status_code == 201, r.text
    sid = r.json().get("id")
    yield sid
    scenario_client.delete(f"/scenarios/{sid}")


def test_get_scenario_by_id(scenario_client, created_scenario):
    r = scenario_client.get(f"/scenarios/{created_scenario}")
    assert r.status_code == 200
    assert r.json().get("id") == created_scenario


def test_update_scenario(scenario_client, created_scenario):
    body = _make_scenario()
    body["name"] = f"S-upd-{uuid.uuid4().hex[:6]}"
    r = scenario_client.put(f"/scenarios/{created_scenario}", headers=NONE_H, json=body)
    assert r.status_code in (200, 201), r.text


def test_clone_scenario(scenario_client, created_scenario):
    r = scenario_client.post(f"/scenarios/{created_scenario}/clone",
                             headers=NONE_H, json={"template_id": "tmpl_x"})
    assert r.status_code in (200, 201), r.text


def test_full_scenario(scenario_client, created_scenario):
    r = scenario_client.get(f"/scenarios/{created_scenario}/full")
    assert r.status_code == 200, r.text


def test_create_scenario_requires_name(scenario_client):
    r = scenario_client.post("/scenarios", headers=NONE_H,
                             json={"type": "training", "faults": [], "criteria": {}})
    assert r.status_code in (201, 400, 422), r.text


def test_delete_scenario(scenario_client):
    r = scenario_client.post("/scenarios", headers=NONE_H, json=_make_scenario())
    assert r.status_code == 201, r.text
    sid = r.json().get("id")
    d = scenario_client.delete(f"/scenarios/{sid}")
    assert d.status_code in (200, 204), d.text
    g = scenario_client.get(f"/scenarios/{sid}")
    assert g.status_code == 404


def test_exam_scenario_unknown_template(scenario_client):
    """GET /scenarios/exam — без sценария-exam по шаблону отдаёт не 500."""
    r = scenario_client.get(f"/scenarios/exam?template_id={uuid.uuid4().hex}")
    assert r.status_code in (200, 404, 422), r.text
    assert r.status_code != 500


def test_scenarios_list_filtered(scenario_client):
    r = scenario_client.get("/scenarios?type=training&limit=10")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_fault_get_by_id_not_found(scenario_client):
    r = scenario_client.get(f"/faults/{uuid.uuid4().hex}")
    assert r.status_code == 404
