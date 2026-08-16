"""Authentication & authorization (mirror of auth.service.ts + middleware).

- Email OTP: SHA-256 (salt) hashed codes with TTL and rate limiting; on verify
  an HS256 app JWT is issued as the Bearer token.
- Entra ID: RS256 Bearer tokens validated against the tenant JWKS endpoint.
"""
import hashlib
import hmac
import secrets
import time
from typing import Dict, List

import jwt
from fastapi import Depends, Request

from . import users_service
from .config import CONFIG, entra_authority, entra_jwks_uri
from .email_service import send_otp_email
from .errors import ApiError
from .rbac import has_capability

_otp_store: Dict[str, Dict] = {}
_rate_buckets: Dict[str, List[float]] = {}
_jwks_client = None


def _is_internal_email(email: str) -> bool:
    domain = (email.split("@")[1] if "@" in email else "").lower()
    return any(d.lower() == domain for d in CONFIG["api"]["auth"]["internalDomains"])


def _generate_otp(length: int) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def _hash_code(email: str, code: str, salt: str) -> str:
    return hashlib.sha256(f"{email}|{code}|{salt}".encode()).hexdigest()


def _to_auth_user(user: Dict, provider: str) -> Dict:
    return {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "provider": provider,
        "isInternal": _is_internal_email(user["email"]),
        "role": user["role"],
    }


# ---------------------------------------------------------------------------
# OTP flow
# ---------------------------------------------------------------------------

def request_otp(email: str) -> Dict:
    key = email.strip().lower()
    now = time.time()
    ext = CONFIG["api"]["auth"]["external"]

    bucket = [t for t in _rate_buckets.get(key, []) if t > now - 3600]
    if len(bucket) >= ext["maxCodesPerEmailPerHour"]:
        raise ApiError(429, "Too many OTP requests. Try again later.")
    bucket.append(now)
    _rate_buckets[key] = bucket

    code = _generate_otp(ext["otpLength"])
    salt = secrets.token_hex(16)
    _otp_store[key] = {
        "hash": _hash_code(key, code, salt),
        "salt": salt,
        "expiresAt": now + ext["otpTtlSeconds"],
        "attempts": 0,
    }
    delivered = send_otp_email(key, code)
    return {"delivered": delivered}


def verify_otp(email: str, code: str) -> Dict:
    key = email.strip().lower()

    if CONFIG["flags"]["otpDevBypass"] and code == "000000":
        return _issue_for_otp_user(key)

    entry = _otp_store.get(key)
    if not entry:
        raise ApiError(400, "No active code. Request a new one.")
    if time.time() > entry["expiresAt"]:
        _otp_store.pop(key, None)
        raise ApiError(400, "Code expired. Request a new one.")
    if entry["attempts"] >= CONFIG["api"]["auth"]["external"]["maxAttemptsPerCode"]:
        _otp_store.pop(key, None)
        raise ApiError(429, "Too many attempts. Request a new one.")
    entry["attempts"] += 1
    candidate = _hash_code(key, code, entry["salt"])
    if not hmac.compare_digest(candidate, entry["hash"]):
        raise ApiError(401, "Invalid code.")
    _otp_store.pop(key, None)
    return _issue_for_otp_user(key)


def _issue_for_otp_user(email: str) -> Dict:
    record = users_service.resolve_for_login(email, email.split("@")[0], "email-otp")
    auth_user = _to_auth_user(record, "email-otp")
    jwt_cfg = CONFIG["api"]["auth"]["jwt"]
    expires_in = jwt_cfg["accessTokenTtlSeconds"]
    payload = {
        "sub": auth_user["sub"],
        "email": auth_user["email"],
        "name": auth_user["name"],
        "role": auth_user["role"],
        "provider": "email-otp",
        "iss": jwt_cfg["issuer"],
        "aud": jwt_cfg["audience"],
        "exp": int(time.time()) + expires_in,
    }
    token = jwt.encode(payload, CONFIG["secrets"]["jwtSigningKey"], algorithm="HS256")
    return {"token": token, "expiresIn": expires_in, "user": auth_user}


# ---------------------------------------------------------------------------
# Bearer verification
# ---------------------------------------------------------------------------

def _fallback_user(payload: Dict) -> Dict:
    from .util import now_iso

    email = str(payload.get("email", ""))
    now = now_iso()
    return {
        "id": str(payload.get("sub", email)),
        "email": email,
        "name": str(payload.get("name", email)),
        "role": "business_user",
        "provider": "email-otp",
        "authenticationMethod": "OTP",
        "createdAt": now,
        "updatedAt": now,
    }


def verify_bearer(token: str) -> Dict:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg")
    jwt_cfg = CONFIG["api"]["auth"]["jwt"]

    if alg == "HS256":
        payload = jwt.decode(
            token,
            CONFIG["secrets"]["jwtSigningKey"],
            algorithms=["HS256"],
            issuer=jwt_cfg["issuer"],
            audience=jwt_cfg["audience"],
        )
        record = users_service.get_by_email(str(payload.get("email")))
        return _to_auth_user(record or _fallback_user(payload), "email-otp")

    return _verify_entra_token(token)


def _verify_entra_token(token: str) -> Dict:
    global _jwks_client
    jwks_uri = entra_jwks_uri()
    if not jwks_uri:
        raise ApiError(401, "Entra ID not configured")
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(jwks_uri)
    signing_key = _jwks_client.get_signing_key_from_jwt(token)
    allowed_issuers = [
        f"{entra_authority()}/v2.0",
        f'https://sts.windows.net/{CONFIG["secrets"]["entraTenantId"]}/',
    ]
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        options={"verify_aud": False, "verify_iss": False},
    )
    if payload.get("iss") not in allowed_issuers:
        raise ApiError(401, "Untrusted token issuer")
    email = str(payload.get("preferred_username") or payload.get("email") or payload.get("upn") or "")
    name = str(payload.get("name") or (email.split("@")[0] if email else ""))
    record = users_service.resolve_for_login(email, name, "entra-id")
    auth_user = _to_auth_user(record, "entra-id")
    auth_user["tenantId"] = CONFIG["secrets"]["entraTenantId"]
    return auth_user


def auth_meta() -> Dict:
    return {
        "tenantId": CONFIG["secrets"]["entraTenantId"],
        "uiClientId": CONFIG["secrets"]["entraUiClientId"],
        "apiClientId": CONFIG["secrets"]["entraApiClientId"],
        "apiAppIdUri": CONFIG["secrets"]["entraApiAppIdUri"],
        "authority": entra_authority(),
        "apiScopeName": CONFIG["api"]["auth"]["internal"]["apiScopeName"],
        "internalDomains": CONFIG["api"]["auth"]["internalDomains"],
        "otpEnabled": True,
        "otpDevBypass": CONFIG["flags"]["otpDevBypass"],
    }


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(request: Request) -> Dict:
    header = request.headers.get("authorization") or ""
    parts = header.split(" ")
    scheme = parts[0] if parts else ""
    token = parts[1] if len(parts) > 1 else ""

    if (not token or scheme.lower() != "bearer") and CONFIG["flags"]["allowAnonymous"]:
        return {
            "sub": "anonymous",
            "email": "anonymous@localhost",
            "name": "Anonymous (dev)",
            "provider": "email-otp",
            "isInternal": False,
            "role": "app_owner",
        }

    if not token or scheme.lower() != "bearer":
        raise ApiError(401, "Missing bearer token")

    try:
        return verify_bearer(token)
    except ApiError:
        raise
    except Exception:
        raise ApiError(401, "Invalid or expired token")


def require(*capabilities: str):
    def dependency(user: Dict = Depends(get_current_user)) -> Dict:
        if not all(has_capability(user["role"], c) for c in capabilities):
            raise ApiError(403, "Forbidden: insufficient role")
        return user

    return dependency


def correlation_id(request: Request) -> str:
    return getattr(request.state, "correlation_id", "")
