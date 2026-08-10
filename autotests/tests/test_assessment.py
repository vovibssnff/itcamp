"""Автотесты assessment — оценка действий оператора.

Контракт: helper/assessment.http.
Внутренние сервисы доверяют заголовкам X-User-ID/X-Roles (trust boundary).
"""
import uuid

from conftest import assessment_client  # noqa: F401

ADMIN_H = {"X-Roles": "admin", "X-User-ID": "admin-1"}


def test_healthz(assessment_client):
    r = assessment_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_score_absent_session_404(assessment_client):
    r = assessment_client.get(f"/assessment/session/{uuid.uuid4().hex}/score")
    assert r.status_code == 404
    assert r.json().get("title") == "not_found"


def test_event_no_scenario_returns_404_not_500(assessment_client):
    """Регрессия фикса: событие без существующего scenario_id даёт 404 (не 500).

    Раньше отсутствие сценария у scenario-сервиса превращалось в 500; теперь
    клиент мапит 404 в ErrScenarioNotFound и handler возвращает 404.
    Идентификатор несуществующего сценария генерируем на лету, чтобы не зависеть
    от seeded-данных в dev.
    """
    payload = {"session_id": uuid.uuid4().hex, "scenario_id": uuid.uuid4().hex,
               "type": "action", "user_id": "u1", "target": "t1",
               "action": "valve_open", "value": 1, "tag_id": "tag1", "priority": "H",
               "model_time": 1.0, "server_time": "2026-08-09T10:30:00Z"}
    r = assessment_client.post("/assessment/event", headers=ADMIN_H, json=payload)
    assert r.status_code == 404, r.text
    assert r.json().get("title") == "not_found"


def test_override_requires_body(assessment_client):
    r = assessment_client.post("/assessment/override", headers=ADMIN_H, json={})
    assert r.status_code == 400 or r.status_code == 422


def test_replay_absent_session(assessment_client):
    r = assessment_client.get(f"/assessment/session/{uuid.uuid4().hex}/replay")
    assert r.status_code in (404, 200)
