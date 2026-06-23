import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any


PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 210_000
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(24)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}${_b64encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = password_hash.split("$", 3)
        if algorithm != PASSWORD_ALGORITHM:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        return hmac.compare_digest(_b64encode(digest), expected_hash)
    except (AttributeError, TypeError, ValueError):
        return False


def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "480")))
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    unsigned_token = f"{_json_b64(header)}.{_json_b64(payload)}"
    signature = _sign(unsigned_token)
    return f"{unsigned_token}.{signature}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        header_b64, payload_b64, signature = token.split(".", 2)
        unsigned_token = f"{header_b64}.{payload_b64}"
        if not hmac.compare_digest(_sign(unsigned_token), signature):
            return None
        header = _json_b64decode(header_b64)
        if header.get("alg") != JWT_ALGORITHM:
            return None
        payload = _json_b64decode(payload_b64)
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return payload
    except (TypeError, ValueError, json.JSONDecodeError):
        return None


def _jwt_secret() -> bytes:
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if secret:
        return secret.encode("utf-8")
    if os.getenv("APP_ENV", "development").strip().lower() in {"production", "prod"}:
        raise RuntimeError("Configure JWT_SECRET_KEY nas variaveis de ambiente em producao.")
    return b"development-only-change-this-secret"


def _sign(value: str) -> str:
    return _b64encode(hmac.new(_jwt_secret(), value.encode("utf-8"), hashlib.sha256).digest())


def _json_b64(value: dict[str, Any]) -> str:
    return _b64encode(json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def _json_b64decode(value: str) -> dict[str, Any]:
    return json.loads(_b64decode(value).decode("utf-8"))


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")
