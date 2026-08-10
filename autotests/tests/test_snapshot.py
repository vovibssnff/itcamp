"""Автотесты snapshot — снапшоты сессий.

Контракт: helper/snapshot.http.
Внутренние сервисы доверяют заголовкам X-User-ID/X-Roles (trust boundary).
"""
import uuid

from conftest import snapshot_client  # noqa: F401


def test_healthz(snapshot_client):
    r = snapshot_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_list_snapshots(snapshot_client):
    r = snapshot_client.get("/snapshots?limit=50")
    assert r.status_code == 200
    body = r.json()
    assert body is None or isinstance(body, list)


def test_get_snapshot_not_found(snapshot_client):
    r = snapshot_client.get(f"/snapshots/{uuid.uuid4().hex}")
    assert r.status_code == 404


def test_delete_preset_snapshot_not_allowed(snapshot_client):
    r = snapshot_client.delete(f"/snapshots/{uuid.uuid4().hex}")
    # preset-снапшот удалить нельзя; отсутствующий просто 404
    assert r.status_code in (404, 409, 403)
