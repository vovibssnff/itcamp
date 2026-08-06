"""Проверка JWT RS256 (plan §5, §7).

Подпись проверяется локально публичным ключом auth (не зависит от БД — plan §7).
Claims: sub, login, role, type (access|refresh), iat, exp, jti.
Предоставляет функцию verify_token и FastAPI-middleware/dependency.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import jwt
from jwt import InvalidTokenError

from py_common.problem import Problem

VALID_ROLES = frozenset({"admin", "instructor", "operator"})


@dataclass(frozen=True)
class TokenClaims:
    sub: str
    login: str
    role: str
    type: str  # access|refresh
    exp: int
    iat: int | None = None
    jti: str | None = None

    @classmethod
    def from_payload(cls, payload: dict) -> "TokenClaims":
        return cls(
            sub=str(payload.get("sub", "")),
            login=str(payload.get("login", "")),
            role=str(payload.get("role", "")),
            type=str(payload.get("type", "access")),
            exp=int(payload.get("exp", 0)),
            iat=payload.get("iat"),
            jti=payload.get("jti"),
        )


def verify_token(
    token: str,
    public_key: str,
    algorithm: str = "RS256",
    issuer: str | None = None,
    audience: str | None = None,
    expected_type: str = "access",
) -> TokenClaims:
    """Проверяет подпись и базовые claims. Бросает Problem(401) при ошибке."""
    options = {"require": ["exp", "sub"], "verify_aud": audience is not None}
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[algorithm],
            issuer=issuer,
            audience=audience,
            options=options,
        )
    except InvalidTokenError as exc:
        raise Problem(status=401, title="Unauthorized", detail=f"invalid token: {exc}") from exc

    claims = TokenClaims.from_payload(payload)
    if expected_type and claims.type != expected_type:
        raise Problem(
            status=401,
            title="Unauthorized",
            detail=f"expected token type {expected_type!r}, got {claims.type!r}",
        )
    return claims


def require_role(claims: TokenClaims, allowed: Iterable[str]) -> None:
    """RBAC-проверка (plan §5): 403 при нехватке прав."""
    allowed_set = set(allowed)
    if claims.role not in allowed_set:
        raise Problem(
            status=403,
            title="Forbidden",
            detail=f"role {claims.role!r} not in {sorted(allowed_set)}",
        )


class JWTAuthMiddleware:
    """Starlette-совместимый middleware: проверяет Bearer-токен на всех путях,
    кроме public (login/refresh) и служебных (health/metrics/docs).

    Кладёт TokenClaims в request.state.claims. RBAC делается на роутере/сервисе.
    """

    def __init__(
        self,
        app,
        public_key: str,
        algorithm: str = "RS256",
        issuer: str | None = None,
        audience: str | None = None,
        public_paths: Iterable[str] = (),
    ) -> None:
        self.app = app
        self.public_key = public_key
        self.algorithm = algorithm
        self.issuer = issuer
        self.audience = audience
        self.public_paths = tuple(public_paths) or (
            "/healthz",
            "/readyz",
            "/metrics",
            "/openapi.json",
            "/docs",
            "/redoc",
        )

    def _is_public(self, path: str) -> bool:
        return any(path == p or path.startswith(p) for p in self.public_paths)

    async def __call__(self, scope, receive, send):  # noqa: ANN001
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        if self._is_public(path):
            await self.app(scope, receive, send)
            return

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        auth = headers.get("authorization", "")
        if not auth.lower().startswith("bearer "):
            await self._reject(send, "missing bearer token")
            return
        token = auth.split(" ", 1)[1].strip()
        try:
            claims = verify_token(
                token,
                self.public_key,
                self.algorithm,
                self.issuer,
                self.audience,
            )
        except Problem as exc:
            await self._reject(send, exc.detail or exc.title)
            return
        scope.setdefault("state", {})
        scope["state"]["claims"] = claims
        await self.app(scope, receive, send)

    async def _reject(self, send, detail: str) -> None:  # noqa: ANN001
        import json

        body = json.dumps(
            {"type": "about:blank", "title": "Unauthorized", "status": 401, "detail": detail}
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 401,
                "headers": [
                    (b"content-type", b"application/problem+json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
