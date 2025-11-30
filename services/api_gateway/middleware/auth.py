"""
API Gateway Authentication Middleware

Handles API key verification, rate limiting, and usage tracking.
"""

from typing import Any
from fastapi import Security, HTTPException, Request
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from datetime import datetime, timedelta
import structlog

from core.database.connection import get_db
from services.api_gateway.models import APIKey, APIUsageLog

logger = structlog.get_logger("api-gateway-auth")

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class RateLimitExceeded(Exception):
    """Custom exception for rate limit violations"""
    pass


async def verify_api_key(
    request: Request,
    api_key: str = Security(api_key_header),
    db: AsyncSession = None
) -> Any:
    """
    Verify API key and check permissions.
    
    Args:
        request: FastAPI request object
        api_key: API key from header
        db: Database session
        
    Returns:
        APIKey object if valid
        
    Raises:
        HTTPException: 401 if invalid, 403 if forbidden, 429 if rate limited
    """
    if not api_key:
        logger.warning("Missing API key in request")
        raise HTTPException(
            status_code=401,
            detail="API key required. Include 'X-API-Key' header."
        )
    
    try:
        # Verify key exists and is active
        stmt = select(APIKey).where(
            and_(
                APIKey.key == api_key,
                APIKey.is_active == True,
                or_(
                    APIKey.expires_at.is_(None),
                    APIKey.expires_at > datetime.utcnow()
                )
            )
        )
        
        result = await db.execute(stmt)
        key_obj = result.scalar_one_or_none()
        
        if not key_obj:
            logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired API key"
            )
        
        # Check rate limits
        await check_rate_limit(key_obj, db)
        
        # Update usage statistics
        await update_usage_stats(key_obj, request, db)
        
        # Log request
        await log_request(key_obj, request, db)
        
        # Attach to request state for later use
        request.state.api_key = key_obj
        
        logger.info(
            "API request authenticated",
            client=key_obj.client_name,
            tier=key_obj.tier,
            endpoint=str(request.url.path)
        )
        
        return key_obj
        
    except RateLimitExceeded as e:
        logger.warning(
            "Rate limit exceeded",
            client=key_obj.client_name if key_obj else "unknown",
            limit=str(e)
        )
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {str(e)}",
            headers={"Retry-After": "60"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in API key verification: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


async def check_rate_limit(key_obj: APIKey, db: AsyncSession):
    """
    Check if request exceeds rate limits.
    
    Args:
        key_obj: API key object
        db: Database session
        
    Raises:
        RateLimitExceeded: If rate limit is exceeded
    """
    from services.api_gateway.rate_limiter import check_rate_limit as limiter_check
    
    # Check per-minute rate limit
    minute_limit = key_obj.rate_limit_per_minute
    exceeded = await limiter_check(
        key=f"ratelimit:min:{key_obj.key}",
        limit=minute_limit,
        window_seconds=60
    )
    
    if exceeded:
        raise RateLimitExceeded(f"{minute_limit} requests per minute")
    
    # Check daily rate limit (if configured)
    if key_obj.rate_limit_per_day:
        # Reset daily counter if needed
        now = datetime.utcnow()
        if key_obj.last_reset_date.date() < now.date():
            key_obj.requests_today = 0
            key_obj.last_reset_date = now
            await db.commit()
        
        if key_obj.requests_today >= key_obj.rate_limit_per_day:
            raise RateLimitExceeded(f"{key_obj.rate_limit_per_day} requests per day")


async def update_usage_stats(
    key_obj: APIKey,
    request: Request,
    db: AsyncSession
):
    """
    Update usage statistics for API key.
    
    Args:
        key_obj: API key object
        request: FastAPI request
        db: Database session
    """
    key_obj.total_requests += 1
    key_obj.requests_today += 1
    key_obj.last_used_at = datetime.utcnow()
    
    await db.commit()


async def log_request(
    key_obj: APIKey,
    request: Request,
    db: AsyncSession
):
    """
    Log request details for analytics.
    
    Args:
        key_obj: API key object
        request: FastAPI request
        db: Database session
    """
    # Extract request details
    log_entry = APIUsageLog(
        api_key_id=key_obj.id,
        timestamp=datetime.utcnow(),
        endpoint=str(request.url.path),
        method=request.method,
        query_params=dict(request.query_params),
        path_params=dict(request.path_params) if hasattr(request, 'path_params') else {},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent', '')
    )
    
    db.add(log_entry)
    
    # Commit asynchronously (don't wait)
    try:
        await db.commit()
    except Exception as e:
        logger.error(f"Error logging request: {e}")


async def check_endpoint_permission(
    key_obj: APIKey,
    endpoint: str
) -> bool:
    """
    Check if API key has permission to access endpoint.
    
    Args:
        key_obj: API key object
        endpoint: Endpoint path (e.g., 'option-chain', 'analytics')
        
    Returns:
        True if allowed, False otherwise
    """
    # If no restrictions, allow all
    if not key_obj.allowed_endpoints:
        return True
    
    # Check if endpoint is in allowed list
    for allowed in key_obj.allowed_endpoints:
        if endpoint.startswith(allowed):
            return True
    
    return False


async def check_symbol_permission(
    key_obj: APIKey,
    symbol_id: int
) -> bool:
    """
    Check if API key has permission to access symbol.
    
    Args:
        key_obj: API key object
        symbol_id: Symbol ID
        
    Returns:
        True if allowed, False otherwise
    """
    # If no restrictions, allow all
    if not key_obj.allowed_symbols:
        return True
    
    # Check if symbol is in allowed list
    return symbol_id in key_obj.allowed_symbols
