"""RFC 7807 problem+json (plan §5, schemas/error.json).

Хелпер строит тело ошибки строго по schemas/error.json и оборачивает его в
FastAPI/Starlette-совместимый JSONResponse с media type application/problem+json.
"""
from __future__ import annotations

from typing import Any

try:  # FastAPI/Starlette присутствуют у всех REST-сервисов
    from starlette.responses import JSONResponse
except Exception:  # pragma: no cover - на случай отсутствия starlette
    JSONResponse = None  # type: ignore[assignment]

PROBLEM_MEDIA_TYPE = "application/problem+json"


class Problem(Exception):
    """Исключение-обёртка RFC 7807. Сервисы поднимают его, middleware рендерит."""

    def __init__(
        self,
        status: int,
        title: str,
        detail: str | None = None,
        type_: str = "about:blank",
        instance: str | None = None,
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(title)
        self.status = status
        self.title = title
        self.detail = detail
        self.type = type_
        self.instance = instance
        self.errors = errors

    def to_dict(self) -> dict[str, Any]:
        return problem_dict(
            status=self.status,
            title=self.title,
            detail=self.detail,
            type_=self.type,
            instance=self.instance,
            errors=self.errors,
        )


def problem_dict(
    status: int,
    title: str,
    detail: str | None = None,
    type_: str = "about:blank",
    instance: str | None = None,
    errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Тело ошибки по schemas/error.json (обязательны title, status)."""
    body: dict[str, Any] = {"type": type_, "title": title, "status": status}
    if detail is not None:
        body["detail"] = detail
    if instance is not None:
        body["instance"] = instance
    if errors:
        body["errors"] = errors
    return body


def problem_response(
    status: int,
    title: str,
    detail: str | None = None,
    type_: str = "about:blank",
    instance: str | None = None,
    errors: list[dict[str, Any]] | None = None,
):
    """JSONResponse с media type application/problem+json."""
    if JSONResponse is None:  # pragma: no cover
        raise RuntimeError("starlette не установлен: problem_response недоступен")
    body = problem_dict(status, title, detail, type_, instance, errors)
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_MEDIA_TYPE)


def install_problem_handlers(app) -> None:
    """Регистрирует обработчик Problem в FastAPI-приложении."""
    from starlette.requests import Request

    @app.exception_handler(Problem)
    async def _handle(_: Request, exc: Problem):  # noqa: ANN202
        return problem_response(
            status=exc.status,
            title=exc.title,
            detail=exc.detail,
            type_=exc.type,
            instance=exc.instance,
            errors=exc.errors,
        )
