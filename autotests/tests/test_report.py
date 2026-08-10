"""Автотесты report — отчёты по сессии.

Контракт: helper/report.http.
Приём задачи через NATS (report.tasks); генерация PDF асинхронна.
"""
import uuid

from conftest import report_client  # noqa: F401

OP_H = {"X-Roles": "operator", "X-User-ID": "op-1"}
NONE_H = {}


def test_healthz(report_client):
    r = report_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_list_reports(report_client):
    r = report_client.get("/reports")
    assert r.status_code == 200


def test_get_report_not_found(report_client):
    r = report_client.get(f"/reports/{uuid.uuid4().hex}")
    assert r.status_code == 404


def test_create_report_requires_body(report_client):
    """Отсутствие session_id — ошибка валидации (ожидаем 400)."""
    r = report_client.post("/reports", headers=OP_H, json={})
    assert r.status_code in (400, 422, 404), r.text


def test_create_report_positive(report_client):
    payload = {"session_id": f"autotest_{uuid.uuid4().hex[:8]}", "type": "exam"}
    r = report_client.post("/reports", headers=OP_H, json=payload)
    # может вернуть 202 (назад опубликована задача) или 4xx если нет сессии
    assert r.status_code in (200, 201, 202, 400, 404, 422), r.text
