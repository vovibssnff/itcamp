import datetime as dt

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from py_common.jwt_verify import require_role, verify_token
from py_common.problem import Problem


@pytest.fixture(scope="module")
def keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


def _make_token(private_pem, **overrides):
    now = dt.datetime.now(tz=dt.timezone.utc)
    payload = {
        "sub": "u-1",
        "login": "ivanov",
        "role": "instructor",
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(minutes=15)).timestamp()),
        "jti": "jti-1",
        "iss": "ktk-auth",
    }
    payload.update(overrides)
    return jwt.encode(payload, private_pem, algorithm="RS256")


def test_verify_valid(keypair):
    priv, pub = keypair
    token = _make_token(priv)
    claims = verify_token(token, pub, issuer="ktk-auth")
    assert claims.sub == "u-1"
    assert claims.role == "instructor"
    assert claims.type == "access"


def test_verify_expired(keypair):
    priv, pub = keypair
    past = int((dt.datetime.now(tz=dt.timezone.utc) - dt.timedelta(minutes=1)).timestamp())
    token = _make_token(priv, exp=past)
    with pytest.raises(Problem) as ei:
        verify_token(token, pub, issuer="ktk-auth")
    assert ei.value.status == 401


def test_verify_wrong_type(keypair):
    priv, pub = keypair
    token = _make_token(priv, type="refresh")
    with pytest.raises(Problem) as ei:
        verify_token(token, pub, issuer="ktk-auth", expected_type="access")
    assert ei.value.status == 401


def test_verify_bad_signature(keypair):
    priv, _pub = keypair
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pub = (
        other.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    token = _make_token(priv)
    with pytest.raises(Problem):
        verify_token(token, other_pub, issuer="ktk-auth")


def test_require_role(keypair):
    priv, pub = keypair
    claims = verify_token(_make_token(priv), pub, issuer="ktk-auth")
    require_role(claims, ["instructor", "admin"])  # no raise
    with pytest.raises(Problem) as ei:
        require_role(claims, ["admin"])
    assert ei.value.status == 403
