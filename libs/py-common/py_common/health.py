"""Health/readiness пробы (plan §1: у всех сервисов /healthz, /readyz).

/healthz  — liveness (процесс жив).
/readyz   — readiness (зависимости — БД/кэш/брокер — доступны).
Готовность собирается из зарегистрированных async-проверок.
"""
from __future__ import annotations

from typing import Awaitable, Callable

ReadinessCheck = Callable[[], Awaitable[bool]]


class HealthRegistry:
    """Реестр readiness-проверок зависимостей сервиса."""

    def __init__(self) -> None:
        self._checks: dict[str, ReadinessCheck] = {}

    def add(self, name: str, check: ReadinessCheck) -> None:
        self._checks[name] = check

    async def readiness(self) -> tuple[bool, dict[str, bool]]:
        results: dict[str, bool] = {}
        ok = True
        for name, check in self._checks.items():
            try:
                res = bool(await check())
            except Exception:  # noqa: BLE001 — недоступность зависимости = not ready
                res = False
            results[name] = res
            ok = ok and res
        return ok, results


def install_health_endpoints(app, registry: "HealthRegistry | None" = None) -> HealthRegistry:
    """Регистрирует /healthz и /readyz на FastAPI-приложении."""
    from starlette.responses import JSONResponse

    reg = registry or HealthRegistry()

    @app.get("/healthz", include_in_schema=False)
    async def _healthz():  # noqa: ANN202
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False)
    async def _readyz():  # noqa: ANN202
        ok, checks = await reg.readiness()
        status = 200 if ok else 503
        return JSONResponse(
            status_code=status,
            content={"status": "ready" if ok else "not_ready", "checks": checks},
        )

    return reg
