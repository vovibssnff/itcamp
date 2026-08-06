"""Клиент Picodata через PG-wire (plan §1: raw SQL / без reflection).

Picodata реализует системные каталоги PG частично, поэтому ORM-reflection и
Alembic autogenerate неприменимы (plan §1, §23). Работаем сырым SQL через
asyncpg-пул. Миграции — SQL-скрипты (services/*/migrations/*.sql).

asyncpg импортируется лениво, чтобы пакет py_common импортировался и без него.
"""
from __future__ import annotations

from typing import Any, Iterable, Sequence


class PicodataClient:
    """Тонкая обёртка над asyncpg.Pool: raw SQL, connection pool, без reflection."""

    def __init__(self, dsn: str, min_size: int = 1, max_size: int = 10) -> None:
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self._pool: Any | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        import asyncpg  # ленивый импорт

        self._pool = await asyncpg.create_pool(
            dsn=self.dsn,
            min_size=self.min_size,
            max_size=self.max_size,
            # Picodata: не полагаемся на серверные prepared statements/introspection
            statement_cache_size=0,
        )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @property
    def pool(self) -> Any:
        if self._pool is None:
            raise RuntimeError("PicodataClient.connect() не был вызван")
        return self._pool

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row is not None else None

    async def fetchval(self, sql: str, *args: Any) -> Any:
        async with self.pool.acquire() as conn:
            return await conn.fetchval(sql, *args)

    async def execute(self, sql: str, *args: Any) -> str:
        async with self.pool.acquire() as conn:
            return await conn.execute(sql, *args)

    async def executemany(self, sql: str, args_seq: Iterable[Sequence[Any]]) -> None:
        async with self.pool.acquire() as conn:
            await conn.executemany(sql, list(args_seq))

    async def ping(self) -> bool:
        """Readiness-проба для health.py."""
        try:
            return await self.fetchval("SELECT 1") == 1
        except Exception:  # noqa: BLE001
            return False


def build_placeholders(count: int, start: int = 1) -> str:
    """Генерирует '$1, $2, ...' для asyncpg-параметров (без string-interpolation значений)."""
    return ", ".join(f"${i}" for i in range(start, start + count))
