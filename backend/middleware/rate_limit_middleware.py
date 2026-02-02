"""
Phase 1 – Security & Scalability: Rate limiting + request throttling
Enterprise Readiness: X-RateLimit-* headers, Retry-After on 429
"""

import time
import logging
import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from services.rate_limiter import rate_limiter, RateLimitExceeded

logger = logging.getLogger(__name__)

RATE_LIMIT_WINDOW = 3600


def _user_id_from_request(request: Request) -> str:
    """Extract user id from JWT or fallback to client IP."""
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth[7:], options={"verify_signature": False})
            sub = payload.get("sub")
            if sub and sub != "anon":
                return str(sub)
        except Exception:
            pass
    return request.client.host if request.client else "anonymous"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Applies rate limiting per user (from JWT) or IP.
    Sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
    Returns 429 with Retry-After when exceeded.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        user_id = getattr(request.state, "user_id", None) or _user_id_from_request(request)
        role = getattr(request.state, "role", "user") or "user"

        limit = rate_limiter.get_limit_for_user(user_id, role)
        try:
            remaining = await rate_limiter.get_remaining_requests(user_id, role)
            await rate_limiter.check_rate_limit(user_id, role)
        except RateLimitExceeded:
            response = Response(
                content='{"detail":"Rate limit exceeded. Please retry later."}',
                status_code=429,
                media_type="application/json",
            )
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + RATE_LIMIT_WINDOW)
            response.headers["Retry-After"] = str(min(60, RATE_LIMIT_WINDOW))
            return response

        response = await call_next(request)
        remaining_after = await rate_limiter.get_remaining_requests(user_id, role)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining_after - 1))
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + RATE_LIMIT_WINDOW)
        return response
