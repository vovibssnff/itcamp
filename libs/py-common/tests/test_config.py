import os

from py_common.config import Settings, get_settings


def test_defaults():
    s = Settings.from_env("auth")
    assert s.service_name == "auth"
    assert s.api_base_path == "/api/v1"
    assert s.jwt_algorithm == "RS256"


def test_env_override(monkeypatch):
    monkeypatch.setenv("PICODATA_DSN", "postgresql://u:p@db:5432/x")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    s = Settings.from_env("constructor")
    assert s.picodata_dsn.endswith("/x")
    assert s.log_level == "DEBUG"


def test_resolved_jwt_public_key_from_file(tmp_path, monkeypatch):
    key_file = tmp_path / "pub.pem"
    key_file.write_text("PUBLIC-KEY-PEM")
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", str(key_file))
    s = Settings.from_env("gw")
    assert s.resolved_jwt_public_key() == "PUBLIC-KEY-PEM"


def test_get_settings_cached():
    get_settings.cache_clear()
    a = get_settings()
    b = get_settings()
    assert a is b
