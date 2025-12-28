"""
Rate Limiter for Authentication Endpoints

Prevents brute force attacks on login endpoints.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import redis.asyncio as redis
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

class AuthRateLimiter:
    """Rate limiter specifically for authentication endpoints"""
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize rate limiter
        
        Args:
            redis_url: Redis connection URL for distributed rate limiting
        """
        self.limiter = Limiter(
            key_func=get_remote_address,
            storage_uri=redis_url if redis_url else "memory://"
        )
        self.redis_url = redis_url
        self._redis_client: Optional[redis.Redis] = None
        
    async def init_redis(self):
        """Initialize Redis client for account lockout tracking"""
        if self.redis_url:
            try:
                self._redis_client = await redis.from_url(self.redis_url)
                logger.info("Auth rate limiter connected to Redis")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis for rate limiting: {e}")
                
    async def close(self):
        """Close Redis connection"""
        if self._redis_client:
            await self._redis_client.close()
            
    async def record_failed_login(self, ip_address: str, username: str) -> int:
        """
        Record a failed login attempt
        
        Args:
            ip_address: Client IP address
            username: Username attempted
            
        Returns:
            Number of failed attempts for this IP
        """
        if not self._redis_client:
            return 0
            
        key = f"auth:failed:{ip_address}"
        try:
            # Increment counter
            count = await self._redis_client.incr(key)
            
            # Set expiry to 15 minutes on first attempt
            if count == 1:
                await self._redis_client.expire(key, 900)
                
            # Log suspicious activity
            if count >= 3:
                logger.warning(
                    "Multiple failed login attempts",
                    ip_address=ip_address,
                    username=username,
                    attempt_count=count
                )
                
            return count
        except Exception as e:
            logger.error(f"Failed to record login attempt: {e}")
            return 0
            
    async def is_locked_out(self, ip_address: str) -> bool:
        """
        Check if IP is locked out due to too many failed attempts
        
        Args:
            ip_address: Client IP address
            
        Returns:
            True if locked out (>= 5 failed attempts)
        """
        if not self._redis_client:
            return False
            
        key = f"auth:failed:{ip_address}"
        try:
            count = await self._redis_client.get(key)
            if count and int(count) >= 5:
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to check lockout status: {e}")
            return False
            
    async def clear_failed_attempts(self, ip_address: str):
        """Clear failed attempt counter after successful login"""
        if not self._redis_client:
            return
            
        key = f"auth:failed:{ip_address}"
        try:
            await self._redis_client.delete(key)
        except Exception as e:
            logger.error(f"Failed to clear attempts: {e}")
            

# Singleton instance
_limiter: Optional[AuthRateLimiter] = None

def get_auth_limiter(redis_url: Optional[str] = None) -> AuthRateLimiter:
    """Get or create AuthRateLimiter singleton"""
    global _limiter
    if _limiter is None:
        _limiter = AuthRateLimiter(redis_url)
    return _limiter
