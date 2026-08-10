"""Общие фикстуры pytest для автотестов сервисов ktc.

Базовые адреса сервисов задаются пере-менными окружения, иначе используются
дефолты локального dev-окружения (сопоставление host-портов см. compose/app).

Порты по умолчанию:
  assess    8081  auth   8082  constructor 8083  scenario  8084
  orchestr  8085  snaphot 8086  report      8087  gw        8088
  ai        8080 (compose/ai)  sim-manager 8091 (compose/sim)
"""
import os

import pytest
import requests


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _url(port: int) -> str:
    host = _env("AUTHESTS_HOST", "http://localhost")
    return f"{host}:{port}"


# --- базовые адреса -------------------------------------------------------
AUTH_URL = _url(int(_env("AUTH_PORT", "8082")))
GW_URL = _url(int(_env("GW_PORT", "8088")))
CONSTRUCTOR_URL = _url(int(_env("CONSTRUCTOR_PORT", "8083")))
SCENARIO_URL = _url(int(_env("SCENARIO_PORT", "8084")))
ORCHESTRATOR_URL = _url(int(_env("ORCHESTRATOR_PORT", "8085")))
ASSESSMENT_URL = _url(int(_env("ASSESSMENT_PORT", "8081")))
SNAPSHOT_URL = _url(int(_env("SNAPSHOT_PORT", "8086")))
REPORT_URL = _url(int(_env("REPORT_PORT", "8087")))
SIM_MANAGER_URL = _url(int(_env("SIM_MANAGER_PORT", "8091")))
AI_URL = _url(int(_env("AI_PORT", "8080")))

# --- учётные данные stub-пользователей (dev) -----------------------------
OPERATOR = (_env("OPERATOR_LOGIN", "operator"), _env("OPERATOR_PASS", "operator123"))
INSTRUCTOR = (_env("INSTRUCTOR_LOGIN", "instructor"), _env("INSTRUCTOR_PASS", "instructor123"))
ADMIN = (_env("ADMIN_LOGIN", "admin"), _env("ADMIN_PASS", "admin123"))


class Client:
    """Лёгкая обёртка над requests с базовым URL и JSON-ответом."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()

    def url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    def get(self, path, **kw):
        return self.session.get(self.url(path), **kw)

    def post(self, path, **kw):
        return self.session.post(self.url(path), **kw)

    def put(self, path, **kw):
        return self.session.put(self.url(path), **kw)

    def delete(self, path, **kw):
        return self.session.delete(self.url(path), **kw)

    def auth(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}


def login(client: Client, login: str, password: str, mfa_code=None) -> dict:
    """Возвращает ответ /login как dict. Если требуется MFA, вернёт
    {"mfa_required": True}."""
    body = {"login": login, "password": password}
    if mfa_code is not None:
        body["mfa_code"] = mfa_code
    r = client.post("/login", json=body)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


# --- фикстуры -------------------------------------------------------------

@pytest.fixture(scope="session")
def auth_client():
    return Client(AUTH_URL)


@pytest.fixture(scope="session")
def gw_client():
    return Client(GW_URL)


@pytest.fixture(scope="session")
def constructor_client():
    return Client(CONSTRUCTOR_URL)


@pytest.fixture(scope="session")
def scenario_client():
    return Client(SCENARIO_URL)


@pytest.fixture(scope="session")
def orchestrator_client():
    return Client(ORCHESTRATOR_URL)


@pytest.fixture(scope="session")
def assessment_client():
    return Client(ASSESSMENT_URL)


@pytest.fixture(scope="session")
def snapshot_client():
    return Client(SNAPSHOT_URL)


@pytest.fixture(scope="session")
def report_client():
    return Client(REPORT_URL)


@pytest.fixture(scope="session")
def sim_client():
    return Client(SIM_MANAGER_URL)


@pytest.fixture(scope="session")
def ai_client():
    return Client(AI_URL)


@pytest.fixture(scope="session")
def operator_token(auth_client):
    r = login(auth_client, *OPERATOR)
    assert "access_token" in r, f"operator login should issue tokens, got: {r}"
    return r["access_token"]


@pytest.fixture(scope="session")
def operator_refresh(auth_client):
    r = login(auth_client, *OPERATOR)
    assert "refresh_token" in r, f"operator login should issue refresh token, got: {r}"
    return r["refresh_token"]
