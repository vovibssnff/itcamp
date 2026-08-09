"""Точка входа: REST (uvicorn) и/или gRPC-сервер."""
from __future__ import annotations

import argparse
import logging
import sys

from .bootstrap import build_application
from .config import get_settings


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def main(argv: list[str] | None = None) -> int:
    _configure_logging()
    parser = argparse.ArgumentParser(description="ИИ-сервис Конструктора КТК")
    parser.add_argument("--mode", choices=["rest", "grpc"], default="rest")
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args(argv)

    settings = get_settings()

    if args.mode == "grpc":
        from .api.grpc_server import serve

        return serve(host=args.host, port=settings.grpc_port)

    try:
        import uvicorn
    except ImportError:
        print(
            "uvicorn не установлен. Установите зависимости: pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1

    from .api.rest import create_app

    application = build_application(settings)
    logging.getLogger(__name__).info("Готовность: %s", application.health())
    uvicorn.run(create_app(application), host=args.host, port=settings.rest_port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
