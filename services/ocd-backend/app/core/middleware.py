"""
Custom Middleware - Request logging, CORS, Rate limiting
"""
import time
import logging
import uuid
import asyncio
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Global Redis connection for rate limiting (initialized lazily)
_rate_limit_redis = None


async def _get_rate_limit_redis():
    """Get Redis connection for rate limiting"""
    global _rate_limit_redis
    if _rate_limit_redis is None:
        try:
            import redis.asyncio as redis
            _rate_limit_redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception as e:
            logger.warning(f"Failed to connect to Redis for rate limiting: {e}")
            return None
    return _rate_limit_redis


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log incoming requests with timing information (reduced noise)"""
    
    # High-frequency polling endpoints to skip logging completely
    QUIET_ENDPOINTS = {"/options/live", "/options/expiry", "/notifications", "/health", "/metrics"}
    # Only log requests slower than 2 seconds (high latency requests worth investigating)
    SLOW_THRESHOLD_MS = 2000
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        # Start timer
        start_time = time.perf_counter()
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - Error: {e}"
            )
            raise
        
        # Calculate duration
        duration = (time.perf_counter() - start_time) * 1000  # ms
        
        # Determine if we should log this request
        path = request.url.path
        is_quiet_endpoint = any(quiet in path for quiet in self.QUIET_ENDPOINTS)
        is_slow = duration > self.SLOW_THRESHOLD_MS
        is_error = response.status_code >= 400
        
        # Log only if: not a quiet endpoint, OR slow request, OR error
        if not is_quiet_endpoint or is_slow or is_error:
            logger.info(
                f"[{request_id}] {request.method} {path} "
                f"- {response.status_code} ({duration:.2f}ms)"
            )
        
        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration:.2f}ms"
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-based distributed rate limiting middleware.
    Uses sliding window algorithm for accurate rate limiting across all workers.
    Falls back to pass-through if Redis is unavailable.
    """
    
    def __init__(
        self, 
        app: ASGIApp, 
        requests_per_minute: int = 100,
        burst_limit: int = 20
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self.window_seconds = 60
        # Fallback in-memory storage (only used if Redis fails)
        self._fallback_requests: dict = {}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks and WebSocket upgrades
        if "/health" in request.url.path or request.headers.get("upgrade") == "websocket":
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        
        # Try Redis-based rate limiting first
        is_limited, remaining, retry_after = await self._check_redis_rate_limit(client_ip)
        
        if is_limited:
            # Return a proper JSON response with CORS headers instead of raising exception
            # This ensures CORS middleware can add headers to the response
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Retry after {retry_after} seconds."
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + self.window_seconds),
                    # Add CORS headers explicitly for rate limit responses
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Credentials": "true",
                }
            )
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + self.window_seconds)
        
        return response
    
    async def _check_redis_rate_limit(self, client_ip: str) -> tuple[bool, int, int]:
        """
        Check rate limit using Redis sliding window.
        Returns: (is_limited, remaining_requests, retry_after_seconds)
        """
        redis_client = await _get_rate_limit_redis()
        
        if redis_client is None:
            # Fallback to in-memory (less accurate but better than no limiting)
            return self._check_fallback_rate_limit(client_ip)
        
        try:
            key = f"ratelimit:{client_ip}"
            current_time = time.time()
            window_start = current_time - self.window_seconds
            
            # Use Redis pipeline for atomic operations
            pipe = redis_client.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Add current request with timestamp as score
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiry on the key
            pipe.expire(key, self.window_seconds + 1)
            
            results = await pipe.execute()
            current_count = results[1]  # zcard result
            
            remaining = self.requests_per_minute - current_count - 1
            is_limited = current_count >= self.requests_per_minute
            
            # Calculate retry-after based on oldest request in window
            retry_after = 0
            if is_limited:
                oldest = await redis_client.zrange(key, 0, 0, withscores=True)
                if oldest:
                    retry_after = int(oldest[0][1] + self.window_seconds - current_time) + 1
            
            return is_limited, remaining, retry_after
            
        except Exception as e:
            logger.warning(f"Redis rate limit check failed: {e}, using fallback")
            return self._check_fallback_rate_limit(client_ip)
    
    def _check_fallback_rate_limit(self, client_ip: str) -> tuple[bool, int, int]:
        """Fallback in-memory rate limiting (less accurate with multiple workers)"""
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # Clean old requests
        if client_ip in self._fallback_requests:
            self._fallback_requests[client_ip] = [
                ts for ts in self._fallback_requests[client_ip] if ts > window_start
            ]
        else:
            self._fallback_requests[client_ip] = []
        
        current_count = len(self._fallback_requests[client_ip])
        
        if current_count >= self.requests_per_minute:
            oldest = min(self._fallback_requests[client_ip])
            retry_after = int(oldest + self.window_seconds - current_time) + 1
            return True, 0, retry_after
        
        # Record request
        self._fallback_requests[client_ip].append(current_time)
        remaining = self.requests_per_minute - current_count - 1
        
        return False, remaining, 0
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP from request, handling proxies"""
        # Check X-Forwarded-For header (set by reverse proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (client IP) and validate it
            client_ip = forwarded.split(",")[0].strip()
            # Basic validation to prevent header spoofing
            if client_ip and len(client_ip) <= 45:  # Max IPv6 length
                return client_ip
        
        # Check X-Real-IP header (nginx)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip and len(real_ip) <= 45:
            return real_ip
        
        return request.client.host if request.client else "unknown"

