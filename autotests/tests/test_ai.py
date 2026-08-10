"""Автотесты ai-service (слой ktk-ai) — ИИ-подсказки, оценка, чат.

Контракт: services/python/ai/src/ai_service/api/rest.py.
В dev ИИ-модуль работает на stub-LLM (детерминированные ответы), поэтому
эндпоинты возвращают 200 с корректной структурой без внешней модели.
"""
import pytest

from conftest import ai_client  # noqa: F401


# --- служебные -------------------------------------------------------------

def test_healthz(ai_client):
    r = ai_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_readyz(ai_client):
    r = ai_client.get("/readyz")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)


def test_metrics(ai_client):
    r = ai_client.get("/metrics")
    assert r.status_code == 200


# --- /v1/explain -----------------------------------------------------------

EXPLAIN_PAYLOAD = {
    "alarm": {"tag_id": "PRA_351", "raised_at_s": 100, "priority": "H"},
    "tag_window": [{"tag_id": "PRA_351", "values": [10, 11, 12], "step_s": 5}],
    "recent_actions": [],
    "node_label": "Сырьевой насос",
    "component_type": "pump",
    "session_mode": "TRAINING",
}


def test_explain_training(ai_client):
    r = ai_client.post("/v1/explain", json=EXPLAIN_PAYLOAD)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("cause"), str)
    assert isinstance(body.get("recommendation"), str)
    assert "latency_ms" in body


def test_explain_exam_blocked(ai_client):
    """FR-AI-06: в экзамене подсказки запрещены — 403 на стороне сервера."""
    payload = dict(EXPLAIN_PAYLOAD, session_mode="EXAM")
    r = ai_client.post("/v1/explain", json=payload)
    assert r.status_code == 403
    assert "EXAM_MODE_BLOCKED" in r.text


def test_explain_pdn_rejected(ai_client):
    """Персональные данные (ПДн) отклоняются — 400."""
    payload = dict(EXPLAIN_PAYLOAD, fio="Иван Иванов", phone="+70000000000")
    r = ai_client.post("/v1/explain", json=payload)
    assert r.status_code == 400


# --- /v1/chat --------------------------------------------------------------

def test_chat_training(ai_client):
    r = ai_client.post("/v1/chat", json={"question": "Как снизить давление?", "session_mode": "TRAINING"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("answer"), str)


# --- /v1/predict/physics ---------------------------------------------------

def test_predict_physics(ai_client):
    r = ai_client.post("/v1/predict/physics", json={
        "series": [{"tag_id": "PRA_351", "values": [10, 11, 12], "step_s": 5}],
        "limits": [{"tag_id": "PRA_351", "value": 16, "limit_type": "H"}],
        "horizon_s": 60,
        "session_mode": "TRAINING",
    })
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("predictions"), list)
    assert body.get("degraded") is False


# --- /v1/predict/behaviour -------------------------------------------------

def test_predict_behaviour(ai_client):
    r = ai_client.post("/v1/predict/behaviour", json={
        "pending_action": {"model_time_s": 100, "type": "OPEN", "target": "VALVE_1"},
        "current_state": [{"tag_id": "PRA_351", "value": 10}],
        "session_mode": "TRAINING",
    })
    assert r.status_code == 200
    body = r.json()
    assert "risk_level" in body
    assert "visible_to_operator" in body
    assert body.get("degraded") is False


# --- /v1/session/review ----------------------------------------------------

def test_session_review(ai_client):
    r = ai_client.post("/v1/session/review", json={
        "actions": [{"model_time_s": 100, "type": "OPEN", "target": "VALVE_1"}],
        "alarms": [{"tag_id": "PRA_351", "raised_at_s": 100}],
        "reference": [{"step": 1, "action": "OPEN", "target": "VALVE_1", "within_s": 60}],
        "criteria": {"pass_score": 70},
        "scenario_name": "Авария давления",
    })
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("score"), (int, float))
    assert isinstance(body.get("passed"), bool)
    assert isinstance(body.get("penalties"), list)
    assert isinstance(body.get("steps"), list)


def test_session_review_degraded_flag(ai_client):
    r = ai_client.post("/v1/session/review", json={
        "actions": [],
        "alarms": [],
        "reference": [],
        "criteria": {"pass_score": 70},
        "with_debrief": True,
    })
    assert r.status_code == 200
    assert "degraded" in r.json()


# --- RBAC/мелочи -----------------------------------------------------------

def test_explain_missing_alarm_expected_4xx(ai_client):
    """Регрессия фикса: нет обязательного поля alarm — 4xx (валидация схемы), не 500."""
    r = ai_client.post("/v1/explain", json={"session_mode": "TRAINING"})
    assert r.status_code in (400, 422)


def test_explain_alarm_without_tag_id_expected_4xx(ai_client):
    """Регрессия фикса: alarm без tag_id — 4xx (валидация схемы), не 500."""
    r = ai_client.post("/v1/explain", json={"alarm": {"raised_at_s": 100}, "session_mode": "TRAINING"})
    assert r.status_code in (400, 422)
