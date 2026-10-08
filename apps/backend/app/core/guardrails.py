"""
App-wide guardrails: rate limiting, security headers, request size limits and
start-up configuration checks.

The rate limiter is in-memory (one backend process, as deployed in Docker).
If the API is ever scaled to several processes, move the counters to a shared
store such as Redis — the `rate_limit` dependency interface stays the same.
"""

import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger("moneymitra")


class RateLimiter:
    """Sliding-window counter: at most `limit` hits per `window` seconds per key."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: int) -> int | None:
        """Records a hit; returns seconds to wait if the key is over its limit."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, int(hits[0] + window - now) + 1)
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()

# scope -> (requests, window seconds, what it limits per)
LIMITS: dict[str, tuple[int, int, str]] = {
    "login": (10, 15 * 60, "ip"),
    "signup": (5, 60 * 60, "ip"),
    "refresh": (60, 15 * 60, "ip"),
    "ai_chat": (30, 60 * 60, "user"),
    "ai_explain": (60, 60 * 60, "user"),
    "upload": (40, 60 * 60, "user"),
    "export": (60, 60 * 60, "user"),
    "reread": (20, 60 * 60, "user"),
}

_MESSAGES = {
    "login": "Too many sign-in attempts. Please wait {wait} and try again.",
    "signup": "Too many accounts created from this network. Please wait {wait}.",
    "ai_chat": "You've reached the tax assistant's limit for now. Please try again in {wait}.",
    "ai_explain": "Too many explanation requests. Please try again in {wait}.",
}


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _human(seconds: int) -> str:
    minutes = (seconds + 59) // 60
    return f"{minutes} minute{'s' if minutes != 1 else ''}" if seconds >= 60 else f"{seconds} seconds"


def enforce(scope: str, key: str) -> None:
    if not get_settings().rate_limit_enabled:
        return
    limit, window, _ = LIMITS[scope]
    wait = limiter.hit(f"{scope}:{key}", limit, window)
    if wait is not None:
        message = _MESSAGES.get(scope, "Too many requests. Please try again in {wait}.").format(wait=_human(wait))
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, message, headers={"Retry-After": str(wait)})


def rate_limit_ip(scope: str):
    """FastAPI dependency limiting a route per client IP."""

    def dependency(request: Request) -> None:
        enforce(scope, client_ip(request))

    return dependency


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-site",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        # API responses carry personal tax data: never cache them.
        response.headers.setdefault("Cache-Control", "no-store")
        if get_settings().environment == "production":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


MAX_JSON_BODY = 2 * 1024 * 1024


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects oversized requests before they are read: uploads are capped by
    the document size limit, everything else at 2 MB."""

    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit():
            is_upload = request.headers.get("content-type", "").startswith("multipart/form-data")
            cap = get_settings().max_document_bytes + 64 * 1024 if is_upload else MAX_JSON_BODY
            if int(length) > cap:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "This request is too large."},
                )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Start-up checks
# ---------------------------------------------------------------------------


def check_configuration() -> None:
    """Refuses to start in production with unsafe settings; warns in development."""
    settings = get_settings()
    problems = []
    if len(settings.jwt_secret or "") < 32:
        problems.append("JWT_SECRET must be at least 32 characters (generate one with secrets.token_urlsafe(48)).")
    if settings.environment == "production":
        if not settings.pii_encryption_key:
            problems.append("PII_ENCRYPTION_KEY must be set in production.")
        if any(origin.startswith("http://") and "localhost" not in origin for origin in settings.cors_origins):
            problems.append("CORS_ORIGINS must use https in production.")
        if settings.itr_software_id == "SW00000000":
            problems.append("ITR_SOFTWARE_ID is still the placeholder; set the ID issued by the Income Tax Department.")
    for problem in problems:
        logger.warning("Configuration: %s", problem)
    if problems and settings.environment == "production":
        raise RuntimeError("Unsafe configuration: " + " ".join(problems))
