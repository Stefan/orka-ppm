"""
JWKS (JSON Web Key Set) client for JWT verification with Supabase.

Fetches public keys from SUPABASE_URL/auth/v1/.well-known/jwks.json,
caches them by key id (kid), and verifies tokens signed with RS256 or ES256.
Used as the preferred method over the legacy HS256 JWT secret.
"""

import json
import time
from typing import Any, Dict, Optional

import jwt
from jwt import algorithms

# Cache: kid -> (public_key, alg). TTL in seconds.
_JWKS_CACHE: Dict[str, tuple[Any, str]] = {}
_JWKS_RAW_CACHE: Optional[Dict[str, Any]] = None
_JWKS_CACHE_TIME: float = 0
JWKS_CACHE_TTL_SECONDS = 600  # 10 minutes

# Allowed algorithms when using JWKS (asymmetric only)
JWKS_ALLOWED_ALGS = ("RS256", "ES256")


def _jwks_url_from_supabase_url(supabase_url: str) -> str:
    base = (supabase_url or "").rstrip("/")
    if not base:
        return ""
    return f"{base}/auth/v1/.well-known/jwks.json"


def _fetch_jwks(jwks_url: str) -> Dict[str, Any]:
    import urllib.request
    req = urllib.request.Request(jwks_url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def _key_from_jwk(jwk: Dict[str, Any]) -> tuple[Any, str]:
    kty = (jwk.get("kty") or "").upper()
    alg = (jwk.get("alg") or "RS256").upper()
    if kty == "RSA":
        key = algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
        return (key, alg if alg in ("RS256", "RS384", "RS512") else "RS256")
    if kty == "EC":
        key = algorithms.ECAlgorithm.from_jwk(json.dumps(jwk))
        return (key, alg if alg in ("ES256", "ES384", "ES512") else "ES256")
    raise ValueError(f"Unsupported JWK kty: {kty}")


def get_cached_jwks_keys(jwks_url: str) -> Dict[str, tuple[Any, str]]:
    """Load JWKS from URL and return a map kid -> (public_key, alg). Cached for JWKS_CACHE_TTL_SECONDS."""
    global _JWKS_RAW_CACHE, _JWKS_CACHE_TIME, _JWKS_CACHE
    now = time.monotonic()
    if _JWKS_RAW_CACHE is not None and (now - _JWKS_CACHE_TIME) < JWKS_CACHE_TTL_SECONDS:
        return _JWKS_CACHE
    jwks = _fetch_jwks(jwks_url)
    _JWKS_CACHE.clear()
    for key_data in jwks.get("keys", []):
        kid = key_data.get("kid")
        if not kid:
            continue
        try:
            _JWKS_CACHE[kid] = _key_from_jwk(key_data)
        except Exception:
            continue
    _JWKS_RAW_CACHE = jwks
    _JWKS_CACHE_TIME = now
    return _JWKS_CACHE


def verify_token_with_jwks(token: str, jwks_url: str) -> Optional[Dict[str, Any]]:
    """
    Verify JWT with JWKS. Returns payload dict if valid, None otherwise.
    Only allows RS256/ES256 (from token header).
    """
    if not token or not jwks_url:
        return None
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception:
        return None
    kid = unverified.get("kid")
    alg = (unverified.get("alg") or "").upper()
    if not kid or alg not in JWKS_ALLOWED_ALGS:
        return None
    try:
        keys = get_cached_jwks_keys(jwks_url)
    except Exception:
        return None
    key_and_alg = keys.get(kid)
    if not key_and_alg:
        return None
    key, _ = key_and_alg
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            options={"verify_aud": False, "verify_iss": False},
        )
        return payload
    except jwt.InvalidTokenError:
        return None


def get_supabase_jwks_url(supabase_url: str) -> str:
    """Return the JWKS URL for the given Supabase base URL."""
    return _jwks_url_from_supabase_url(supabase_url)
