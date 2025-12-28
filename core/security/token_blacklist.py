"""
JWT Token Blacklist for Logout

Implements token revocation using Redis for instant logout.
"""
import redis.asyncio as redis
from datetime import datetime, timedelta
import structlog
from typing import Optional
from core.config.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class TokenBlacklist:
    """
    JWT token blacklist using Redis
    
    Revoked tokens are stored in Redis with TTL matching token expiration.
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize token blacklist
        
        Args:
            redis_url: Redis connection URL
        """
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis_client: Optional[redis.Redis] = None
        
    async def init(self):
        """Initialize Redis connection"""
        try:
            self._redis_client = await redis.from_url(self.redis_url)
            logger.info("Token blacklist initialized")
        except Exception as e:
            logger.error(f"Failed to initialize token blacklist: {e}")
            raise
            
    async def close(self):
        """Close Redis connection"""
        if self._redis_client:
            await self._redis_client.close()
            
    async def revoke_token(self, token: str, expires_in_seconds: int):
        """
        Revoke a JWT token
        
        Args:
            token: JWT token string
            expires_in_seconds: Token TTL (from JWT expiration claim)
        """
        if not self._redis_client:
            logger.warning("Token blacklist not initialized")
            return
            
        try:
            key = f"blacklist:token:{token}"
            
            # Store token in blacklist with expiration
            await self._redis_client.setex(
                key,
                expires_in_seconds,
                datetime.utcnow().isoformat()
            )
            
            logger.info(
                "Token revoked",
                token_prefix=token[:10] + "...",
                ttl_seconds=expires_in_seconds
            )
            
        except Exception as e:
            logger.error(f"Failed to revoke token: {e}")
            raise
            
    async def is_token_revoked(self, token: str) -> bool:
        """
        Check if a token has been revoked
        
        Args:
            token: JWT token string
            
        Returns:
            True if token is blacklisted
        """
        if not self._redis_client:
            logger.warning("Token blacklist not initialized, allowing token")
            return False
            
        try:
            key = f"blacklist:token:{token}"
            exists = await self._redis_client.exists(key)
            return bool(exists)
            
        except Exception as e:
            logger.error(f"Failed to check token blacklist: {e}")
            # Fail open for availability
            return False
            
    async def revoke_all_user_tokens(self, username: str):
        """
        Revoke all tokens for a specific user
        
        Useful for:
        - Password changes
        - Account compromise
        - Admin-initiated logout
        
        Args:
            username: Username to revoke tokens for
        """
        if not self._redis_client:
            logger.warning("Token blacklist not initialized")
            return
            
        try:
            # Set user-level revocation flag
            key = f"blacklist:user:{username}"
            
            # Keep for 24 hours (max token lifetime)
            await self._redis_client.setex(
                key,
                86400,  # 24 hours
                datetime.utcnow().isoformat()
            )
            
            logger.info(
                "All tokens revoked for user",
                username=username
            )
            
        except Exception as e:
            logger.error(f"Failed to revoke user tokens: {e}")
            raise
            
    async def is_user_revoked(self, username: str) -> bool:
        """
        Check if all tokens for a user are revoked
        
        Args:
            username: Username to check
            
        Returns:
            True if user-level revocation is active
        """
        if not self._redis_client:
            return False
            
        try:
            key = f"blacklist:user:{username}"
            exists = await self._redis_client.exists(key)
            return bool(exists)
            
        except Exception as e:
            logger.error(f"Failed to check user revocation: {e}")
            return False


# Global blacklist instance
_blacklist: Optional[TokenBlacklist] = None


async def get_token_blacklist(redis_url: Optional[str] = None) -> TokenBlacklist:
    """Get or create token blacklist singleton"""
    global _blacklist
    if _blacklist is None:
        _blacklist = TokenBlacklist(redis_url)
        await _blacklist.init()
    return _blacklist
