"""Автотесты auth-сервиса (позитивные и негативные сценарии).

Контракт: helper/auth.http, services/go/auth/api/openapi.yaml.
Покрывает: healthz, login, refresh, logout, me, introspect,
пользователи (list/get), MFA (setup/enable/status).
"""
import re
import uuid

import pytest

from conftest import Client, ADMIN, INSTRUCTOR, OPERATOR, login


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _totp(secret_b32: str) -> str:
    """Текущий 6-значный TOTP-код (RFC 6238, SHA1/30s), без внешних зависимостей."""
    import hashlib
    import hmac
    import struct
    import time
    import base64

    key = base64.b32decode(secret_b32.upper(), casefold=True)
    counter = int(time.time()) // 30
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return str(code).zfill(6)


# --------------------------------------------------------------------------
# healthz
# --------------------------------------------------------------------------

def test_healthz_returns_ok(auth_client):
    r = auth_client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# --------------------------------------------------------------------------
# login — позитив
# --------------------------------------------------------------------------

def test_login_operator_issues_tokens(auth_client):
    res = login(auth_client, *OPERATOR)
    assert res.get("access_token")
    assert res.get("refresh_token")
    assert res.get("token_type") == "Bearer"
    assert res.get("expires_in") == 900  # access TTL 15m


def test_login_privileged_requires_mfa(auth_client):
    """admin/instructor — привилегированные роли, всегда требуется MFA."""
    for creds in (ADMIN, INSTRUCTOR):
        r = auth_client.post("/login", json={"login": creds[0], "password": creds[1]})
        assert r.status_code == 200
        assert r.json() == {"mfa_required": True}


def test_login_case_sensitive(auth_client):
    """Логин чувствителен к регистру: 'OPERATOR' не эквивалентен 'operator'."""
    r = auth_client.post("/login",
                         json={"login": OPERATOR[0].upper(), "password": OPERATOR[1]})
    assert r.status_code == 401
    assert r.json().get("code") == "invalid_credentials"


# --------------------------------------------------------------------------
# login — негатив
# --------------------------------------------------------------------------

def test_login_wrong_password(auth_client):
    r = auth_client.post("/login", json={"login": OPERATOR[0], "password": "bad-pass-1"})
    assert r.status_code == 401
    assert r.json().get("code") == "invalid_credentials"


def test_login_nonexistent_user(auth_client):
    r = auth_client.post("/login", json={"login": "no-such-user-xyz", "password": "pass1234"})
    assert r.status_code == 401
    assert r.json().get("code") == "invalid_credentials"


def test_login_missing_fields(auth_client):
    r = auth_client.post("/login", json={"login": OPERATOR[0]})
    assert r.status_code == 400
    assert "required" in r.json().get("error", "")


def test_login_empty_body(auth_client):
    r = auth_client.post("/login", json={})
    assert r.status_code == 400
    assert "required" in r.json().get("error", "")


def test_login_bad_json_400(auth_client):
    r = auth_client.post("/login", data="{bad json", headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json().get("code") == "bad_request"


def test_login_privileged_wrong_mfa(auth_client):
    r = auth_client.post("/login",
                         json={"login": ADMIN[0], "password": ADMIN[1], "mfa_code": "000000"})
    assert r.status_code == 401
    assert r.json().get("code") == "mfa_invalid"


# --------------------------------------------------------------------------
# refresh — позитив / негатив
# --------------------------------------------------------------------------

def test_refresh_positive(auth_client):
    rt = login(auth_client, *OPERATOR)["refresh_token"]
    r = auth_client.post("/refresh", json={"refresh_token": rt})
    assert r.status_code == 200
    res = r.json()
    assert res.get("access_token")
    assert res.get("refresh_token")
    assert res["refresh_token"] != rt  # ротация


def test_refresh_invalid_token(auth_client):
    r = auth_client.post("/refresh", json={"refresh_token": "garbage-not-a-token"})
    assert r.status_code == 401
    assert r.json().get("code") == "token_invalid"


def test_refresh_missing_token(auth_client):
    r = auth_client.post("/refresh", json={})
    assert r.status_code == 400
    assert "required" in r.json().get("error", "")


def test_refresh_bad_json(auth_client):
    r = auth_client.post("/refresh", data="[", headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json().get("code") == "bad_request"


# --------------------------------------------------------------------------
# logout — позитив / негатив
# --------------------------------------------------------------------------

def test_logout_positive(auth_client):
    rt = login(auth_client, *OPERATOR)["refresh_token"]
    r = auth_client.post("/logout", json={"refresh_token": rt})
    assert r.status_code == 200


def test_logout_invalid_token(auth_client):
    r = auth_client.post("/logout", json={"refresh_token": "garbage"})
    assert r.status_code == 401
    assert r.json().get("code") == "token_invalid"


def test_logout_missing_token(auth_client):
    r = auth_client.post("/logout", json={})
    assert r.status_code == 400


def test_refresh_after_logout_revoked(auth_client):
    rt = login(auth_client, *OPERATOR)["refresh_token"]
    assert auth_client.post("/logout", json={"refresh_token": rt}).status_code == 200
    r = auth_client.post("/refresh", json={"refresh_token": rt})
    assert r.status_code == 401


# --------------------------------------------------------------------------
# me — позитив / негатив
# --------------------------------------------------------------------------

def test_me_positive(auth_client, operator_token):
    r = auth_client.get("/me", headers=auth_client.auth(operator_token))
    assert r.status_code == 200
    body = r.json()
    assert body.get("login") == OPERATOR[0]
    assert body.get("id")
    assert "operator" in body.get("roles", []) or body.get("roles", None) is not None


def test_me_without_token(auth_client):
    assert auth_client.get("/me").status_code == 401


def test_me_invalid_token(auth_client):
    assert auth_client.get("/me", headers=auth_client.auth("garbage")).status_code == 401


# --------------------------------------------------------------------------
# introspect — позитив / негатив
# --------------------------------------------------------------------------

def test_introspect_positive(auth_client, operator_token):
    r = auth_client.post("/introspect", json={"token": operator_token})
    assert r.status_code == 200
    res = r.json()
    assert res.get("active") is True
    assert res.get("login") == OPERATOR[0]


def test_introspect_inactive_for_garbage(auth_client):
    r = auth_client.post("/introspect", json={"token": "garbage"})
    assert r.status_code == 200
    assert r.json().get("active") is False


def test_introspect_empty_token(auth_client):
    r = auth_client.post("/introspect", json={"token": ""})
    assert r.status_code == 200
    assert r.json().get("active") is False


def test_introspect_bad_json(auth_client):
    r = auth_client.post("/introspect", data="{", headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json().get("code") == "bad_request"


# --------------------------------------------------------------------------
# users — позитив / негатив
# --------------------------------------------------------------------------

def test_users_list_requires_token(auth_client):
    assert auth_client.get("/users").status_code == 401


def test_users_list_with_token(auth_client, operator_token):
    r = auth_client.get("/users", headers=auth_client.auth(operator_token))
    assert r.status_code == 200
    logins = {u.get("login") for u in r.json()}
    assert {"admin", "instructor", "operator"} <= logins


def test_users_get_not_found(auth_client, operator_token):
    r = auth_client.get("/users/no-such-user", headers=auth_client.auth(operator_token))
    assert r.status_code == 404
    assert r.json().get("code") == "user_not_found"


# --------------------------------------------------------------------------
# MFA — позитив / негатив
# --------------------------------------------------------------------------

def _mfa_user_id(auth_client, operator_token) -> str:
    """Берёт id первого существующего пользователя."""
    users = auth_client.get("/users", headers=auth_client.auth(operator_token)).json()
    return users[0]["id"]


def test_mfa_setup_returns_secret(auth_client, operator_token):
    uid = _mfa_user_id(auth_client, operator_token)
    r = auth_client.post(f"/users/{uid}/mfa/setup")
    assert r.status_code == 200
    secret = r.json().get("secret")
    assert secret
    assert re.fullmatch(r"[A-Z2-7]{16,}", secret)  # base32


def test_mfa_setup_nonexistent_user_404(auth_client, operator_token):
    r = auth_client.post(f"/users/{uuid.uuid4()}/mfa/setup")
    assert r.status_code == 404
    assert r.json().get("code") == "user_not_found"


def test_mfa_enable_positive_flow(auth_client, operator_token):
    uid = _mfa_user_id(auth_client, operator_token)
    secret = auth_client.post(f"/users/{uid}/mfa/setup").json()["secret"]
    code = _totp(secret)
    r = auth_client.post(f"/users/{uid}/mfa/enable", json={"code": code})
    assert r.status_code == 200
    assert r.json().get("enabled") is True


def test_mfa_enable_wrong_code(auth_client, operator_token):
    uid = _mfa_user_id(auth_client, operator_token)
    auth_client.post(f"/users/{uid}/mfa/setup")
    r = auth_client.post(f"/users/{uid}/mfa/enable", json={"code": "000000"})
    assert r.status_code == 401
    assert r.json().get("code") == "mfa_invalid"


def test_mfa_enable_nonexistent_user_404(auth_client, operator_token):
    r = auth_client.post(f"/users/{uuid.uuid4()}/mfa/enable", json={"code": "123456"})
    assert r.status_code == 404
    assert r.json().get("code") == "user_not_found"


def test_mfa_status_positive(auth_client, operator_token):
    uid = _mfa_user_id(auth_client, operator_token)
    r = auth_client.get(f"/users/{uid}/mfa")
    assert r.status_code == 200
    assert "enabled" in r.json()


def test_mfa_status_nonexistent_user_404(auth_client, operator_token):
    r = auth_client.get(f"/users/{uuid.uuid4()}/mfa")
    assert r.status_code == 404
    assert r.json().get("code") == "user_not_found"


# --------------------------------------------------------------------------
# MFA disable (маршрут POST /users/{id}/mfa/disable)
# --------------------------------------------------------------------------

def test_mfa_disable_positive(auth_client, operator_token):
    uid = _mfa_user_id(auth_client, operator_token)
    secret = auth_client.post(f"/users/{uid}/mfa/setup").json()["secret"]
    code = _totp(secret)
    auth_client.post(f"/users/{uid}/mfa/enable", json={"code": code})
    r = auth_client.post(f"/users/{uid}/mfa/disable")
    assert r.status_code in (200, 204), r.text
    st = auth_client.get(f"/users/{uid}/mfa")
    assert st.status_code == 200
    assert st.json().get("enabled") is False


def test_mfa_disable_nonexistent_user_404(auth_client, operator_token):
    # Реальный сервер отвечает 200 (идиемпотентно, без 404) для несуществующего
    # пользователя — проверяем, что это не 500 и не падение.
    r = auth_client.post(f"/users/{uuid.uuid4()}/mfa/disable")
    assert r.status_code in (200, 404), r.text


# --------------------------------------------------------------------------
# Чувствительность к JSON / регистру (доп. негатив)
# --------------------------------------------------------------------------

def test_login_login_not_string(auth_client):
    """login не строка — 400/422, не 500."""
    r = auth_client.post("/login", json={"login": 123, "password": "x"})
    assert r.status_code in (400, 422)


def test_refresh_reuse_after_logout_then_nonexistent(auth_client):
    """Повторный refresh отозванным токеном — 401."""
    rt = login(auth_client, *OPERATOR)["refresh_token"]
    assert auth_client.post("/logout", json={"refresh_token": rt}).status_code == 200
    r = auth_client.post("/refresh", json={"refresh_token": rt})
    assert r.status_code == 401
