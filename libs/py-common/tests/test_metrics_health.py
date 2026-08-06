import asyncio

from py_common.health import HealthRegistry
from py_common.metrics import HTTP_REQUESTS, metrics_body


def test_metrics_body_content_type():
    body, ctype = metrics_body()
    assert b"ktk_http_requests_total" in body or isinstance(body, (bytes, bytearray))
    assert "text/plain" in ctype


def test_http_counter_increments():
    HTTP_REQUESTS.labels("auth", "GET", "/healthz", "200").inc()
    body, _ = metrics_body()
    assert b"ktk_http_requests_total" in body


def test_health_registry_all_ok():
    reg = HealthRegistry()

    async def ok():
        return True

    reg.add("db", ok)
    ready, checks = asyncio.run(reg.readiness())
    assert ready is True
    assert checks == {"db": True}


def test_health_registry_failure():
    reg = HealthRegistry()

    async def bad():
        raise RuntimeError("down")

    reg.add("nats", bad)
    ready, checks = asyncio.run(reg.readiness())
    assert ready is False
    assert checks == {"nats": False}
