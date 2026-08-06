"""Prometheus-метрики (plan §1, §19): /metrics в формате Пульт.

Базовые HTTP-метрики + хелпер экспозиции. Сервис-специфичные метрики
(tick-lag, WS-соединения, save/restore) регистрируются в самих сервисах.
"""
from __future__ import annotations

import time

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    Counter,
    Histogram,
    generate_latest,
)

HTTP_REQUESTS = Counter(
    "ktk_http_requests_total",
    "Всего HTTP-запросов",
    ["service", "method", "path", "status"],
)
HTTP_LATENCY = Histogram(
    "ktk_http_request_duration_seconds",
    "Латентность HTTP-запросов",
    ["service", "method", "path"],
)


def metrics_body() -> tuple[bytes, str]:
    """Возвращает (тело, content-type) для эндпоинта /metrics."""
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST


class PrometheusMiddleware:
    """ASGI-middleware: считает количество и латентность HTTP-запросов."""

    def __init__(self, app, service_name: str = "unknown") -> None:
        self.app = app
        self.service_name = service_name

    async def __call__(self, scope, receive, send):  # noqa: ANN001
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        method = scope.get("method", "GET")
        path = scope.get("path", "")
        start = time.perf_counter()
        status_holder = {"code": 500}

        async def _send(message):  # noqa: ANN001
            if message["type"] == "http.response.start":
                status_holder["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, _send)
        finally:
            elapsed = time.perf_counter() - start
            HTTP_REQUESTS.labels(
                self.service_name, method, path, str(status_holder["code"])
            ).inc()
            HTTP_LATENCY.labels(self.service_name, method, path).observe(elapsed)


def install_metrics_endpoint(app, service_name: str = "unknown") -> None:
    """Регистрирует /metrics и HTTP-middleware на FastAPI-приложении."""
    from starlette.responses import Response

    app.add_middleware(PrometheusMiddleware, service_name=service_name)

    @app.get("/metrics", include_in_schema=False)
    async def _metrics():  # noqa: ANN202
        body, content_type = metrics_body()
        return Response(content=body, media_type=content_type)
