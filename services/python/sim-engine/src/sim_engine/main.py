"""Точка входа: REST (uvicorn) и/или gRPC-сервер.

`--mode` задаёт, какие транспорты поднять:
  rest — только REST (Model API на ``rest_port``);
  grpc — только gRPC (Model API на ``grpc_port``);
  all  — оба транспорта одновременно (gRPC в фоновом потоке).
"""
from __future__ import annotations

import argparse
import logging
import threading
from collections.abc import Callable


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _serve_grpc(app) -> int:
    """Поднимает gRPC-сервер и блокирует поток до его остановки."""
    from .api.grpc_server import serve
    from .config import get_settings

    return serve(app, host="0.0.0.0", port=get_settings().grpc_port)


def _serve_rest(app) -> Callable[[], int]:
    """Запускает uvicorn REST-сервер (main-поток)."""
    import uvicorn

    from .api.rest import create_app
    from .config import get_settings

    settings = get_settings()

    def _run() -> int:
        uvicorn.run(create_app(app), host="0.0.0.0", port=settings.rest_port)
        return 0

    return _run


def main(argv: list[str] | None = None) -> int:
    _configure_logging()
    parser = argparse.ArgumentParser(description="sim-worker Конструктора КТК (Model API)")
    parser.add_argument("--mode", choices=["rest", "grpc", "all"], default="rest")
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args(argv)

    from .bootstrap import build_application
    from .config import get_settings

    settings = get_settings()
    app = build_application(settings)
    logging.getLogger(__name__).info("Готовность: %s", app.health())

    if args.mode == "grpc":
        return _serve_grpc(app)

    # REST обязателен для rest и all; для all gRPC поднимаем в фоновом потоке.
    if args.mode == "all":
        try:
            threading.Thread(target=_serve_grpc, args=(app,), daemon=True).start()
            logging.getLogger(__name__).info("gRPC Model API запущен в фоновом потоке")
        except Exception as exc:  # pragma: no cover
            logging.getLogger(__name__).error("gRPC-сервер не стартовал: %s", exc)
            return 1

    return _serve_rest(app)()


if __name__ == "__main__":
    raise SystemExit(main())
