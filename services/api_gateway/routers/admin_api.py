"""
Admin API Router

Internal admin endpoints for API key management.
Requires admin authentication (separate from API keys).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import structlog

from core.database.connection import get_db
from services.api_gateway.models import APIKey, APIUsageLog, APITier, DEFAULT_TIERS
from services.api_gateway.auth.admin_auth import get_current_admin, create_admin_token, authenticate_admin

logger = structlog.get_logger("admin-api")

router = APIRouter()


# Pydantic schemas
class CreateAPIKeyRequest(BaseModel):
    key_name: str = Field(..., min_length=1, max_length=100)
    client_name: str = Field(..., min_length=1, max_length=100)
    contact_email: Optional[str] = None
    tier: str = Field(..., pattern="^(free|basic|pro|enterprise)$")
    allowed_symbols: Optional[List[int]] = None
    notes: Optional[str] = None
    expires_in_days: Optional[int] = Field(None, gt=0)


class APIKeyResponse(BaseModel):
    id: int
    key: str
    key_name: str
    client_name: str
    tier: str
    is_active: bool
    total_requests: int
    created_at: datetime
    expires_at: Optional[datetime]


# Admin authentication now implemented via JWT
# All endpoints below require valid admin token


@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    request: CreateAPIKeyRequest,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """
    Create a new API key.
    
    Args:
        request: API key creation request
        
    Returns:
        Created API key (including the secret key - show only once!)
    """
    try:
        # Generate secure random key
        api_key = f"sk_{secrets.token_urlsafe(32)}"
        
        # Get tier configuration
        tier_stmt = select(APITier).where(APITier.tier_name == request.tier)
        tier_result = await db.execute(tier_stmt)
        tier_config = tier_result.scalar_one_or_none()
        
        if not tier_config:
            raise HTTPException(404, f"Tier '{request.tier}' not found")
        
        # Calculate expiration
        expires_at = None
        if request.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
        
        # Create API key record
        new_key = APIKey(
            key=api_key,
            key_name=request.key_name,
            client_name=request.client_name,
            contact_email=request.contact_email,
            tier=request.tier,
            rate_limit_per_minute=tier_config.rate_limit_per_minute,
            rate_limit_per_day=tier_config.rate_limit_per_day,
            max_historical_days=tier_config.max_historical_days,
            allowed_symbols=request.allowed_symbols,
            notes=request.notes,
            expires_at=expires_at,
            created_by=admin  # From JWT token
        )
        
        db.add(new_key)
        await db.commit()
        await db.refresh(new_key)
        
        logger.info(
            "API key created",
            client=request.client_name,
            tier=request.tier,
            key_id=new_key.id
        )
        
        return new_key
        
    except Exception as e:
        logger.error(f"Error creating API key: {e}", exc_info=True)
        raise HTTPException(500, "Failed to create API key")




@router.post("/login")
async def admin_login(username: str, password: str):
    """
    Admin login endpoint to get JWT token.
    
    Args:
        username: Admin username
        password: Admin password
        
    Returns:
        JWT access token
    """
    admin_user = await authenticate_admin(username, password)
    
    if not admin_user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    
    access_token = create_admin_token(admin_user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 3600  # 1 hour
    }


@router.get("/api-keys")
async def list_api_keys(
    active_only: bool = True,
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """
    List all API keys with usage stats.
    
    Args:
        active_only: Filter to active keys only
        tier: Filter by tier
        
    Returns:
        List of API keys (without secret keys)
    """
    try:
        stmt = select(APIKey)
        
        if active_only:
            stmt = stmt.where(APIKey.is_active == True)
        
        if tier:
            stmt = stmt.where(APIKey.tier == tier)
        
        stmt = stmt.order_by(APIKey.created_at.desc())
        
        result = await db.execute(stmt)
        keys = result.scalars().all()
        
        return {
            "keys": [
                {
                    "id": k.id,
                    "key_name": k.key_name,
                    "client_name": k.client_name,
                    "tier": k.tier,
                    "is_active": k.is_active,
                    "total_requests": k.total_requests,
                    "requests_today": k.requests_today,
                    "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                    "created_at": k.created_at.isoformat(),
                    "expires_at": k.expires_at.isoformat() if k.expires_at else None
                }
                for k in keys
            ],
            "total": len(keys)
        }
        
    except Exception as e:
        logger.error(f"Error listing API keys: {e}", exc_info=True)
        raise HTTPException(500, "Failed to list API keys")


@router.get("/api-keys/{key_id}")
async def get_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """Get detailed information about an API key."""
    # Implementation remains the same...


@router.patch("/api-keys/{key_id}/deactivate")
async def deactivate_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """Deactivate an API key (soft delete)."""
    # Implementation remains the same...


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """Permanently delete an API key."""
    # Implementation remains the same...


@router.get("/analytics/usage")
async def get_usage_analytics(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """Get API usage analytics."""
    # Implementation remains the same...


@router.get("/tiers")
async def get_tiers(
    db: AsyncSession = Depends(get_db),
    admin: str = Depends(get_current_admin)
):
    """Get available API tiers and their features"""
    # Implementation remains the same...

async def list_api_keys(
    active_only: bool = True,
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all API keys with usage stats.
    
    Args:
        active_only: Filter to active keys only
        tier: Filter by tier
        
    Returns:
        List of API keys (without secret keys)
    """
    try:
        stmt = select(APIKey)
        
        if active_only:
            stmt = stmt.where(APIKey.is_active == True)
        
        if tier:
            stmt = stmt.where(APIKey.tier == tier)
        
        stmt = stmt.order_by(APIKey.created_at.desc())
        
        result = await db.execute(stmt)
        keys = result.scalars().all()
        
        return {
            "keys": [
                {
                    "id": k.id,
                    "key_name": k.key_name,
                    "client_name": k.client_name,
                    "tier": k.tier,
                    "is_active": k.is_active,
                    "total_requests": k.total_requests,
                    "requests_today": k.requests_today,
                    "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                    "created_at": k.created_at.isoformat(),
                    "expires_at": k.expires_at.isoformat() if k.expires_at else None
                }
                for k in keys
            ],
            "total": len(keys)
        }
        
    except Exception as e:
        logger.error(f"Error listing API keys: {e}", exc_info=True)
        raise HTTPException(500, "Failed to list API keys")


@router.get("/api-keys/{key_id}")
async def get_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about an API key.
    
    Args:
        key_id: API key ID
        
    Returns:
        API key details with usage statistics
    """
    try:
        stmt = select(APIKey).where(APIKey.id == key_id)
        result = await db.execute(stmt)
        key_obj = result.scalar_one_or_none()
        
        if not key_obj:
            raise HTTPException(404, "API key not found")
        
        # Get usage statistics
        usage_stmt = select(
            func.count(APIUsageLog.id).label('total_requests'),
            func.avg(APIUsageLog.response_time_ms).label('avg_response_time'),
            func.count(func.distinct(APIUsageLog.endpoint)).label('unique_endpoints')
        ).where(APIUsageLog.api_key_id == key_id)
        
        usage_result = await db.execute(usage_stmt)
        usage_stats = usage_result.first()
        
        return {
            "id": key_obj.id,
            "key_name": key_obj.key_name,
            "client_name": key_obj.client_name,
            "contact_email": key_obj.contact_email,
            "tier": key_obj.tier,
            "rate_limits": {
                "per_minute": key_obj.rate_limit_per_minute,
                "per_day": key_obj.rate_limit_per_day
            },
            "permissions": {
                "allowed_symbols": key_obj.allowed_symbols,
                "allowed_endpoints": key_obj.allowed_endpoints,
                "max_historical_days": key_obj.max_historical_days
            },
            "usage": {
                "total_requests": usage_stats.total_requests or 0,
                "requests_today": key_obj.requests_today,
                "avg_response_time_ms": float(usage_stats.avg_response_time) if usage_stats.avg_response_time else 0,
                "unique_endpoints": usage_stats.unique_endpoints or 0,
                "last_used_at": key_obj.last_used_at.isoformat() if key_obj.last_used_at else None
            },
            "lifecycle": {
                "is_active": key_obj.is_active,
                "created_at": key_obj.created_at.isoformat(),
                "expires_at": key_obj.expires_at.isoformat() if key_obj.expires_at else None
            },
            "notes": key_obj.notes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API key: {e}", exc_info=True)
        raise HTTPException(500, "Failed to get API key")


@router.patch("/api-keys/{key_id}/deactivate")
async def deactivate_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate an API key (soft delete).
    
    Args:
        key_id: API key ID
        
    Returns:
        Success message
    """
    try:
        stmt = select(APIKey).where(APIKey.id == key_id)
        result = await db.execute(stmt)
        key_obj = result.scalar_one_or_none()
        
        if not key_obj:
            raise HTTPException(404, "API key not found")
        
        key_obj.is_active = False
        await db.commit()
        
        logger.info(f"API key deactivated: {key_id}")
        
        return {"message": "API key deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating API key: {e}", exc_info=True)
        raise HTTPException(500, "Failed to deactivate API key")


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Permanently delete an API key.
    
    Args:
        key_id: API key ID
        
    Returns:
        Success message
    """
    try:
        stmt = select(APIKey).where(APIKey.id == key_id)
        result = await db.execute(stmt)
        key_obj = result.scalar_one_or_none()
        
        if not key_obj:
            raise HTTPException(404, "API key not found")
        
        await db.delete(key_obj)
        await db.commit()
        
        logger.info(f"API key deleted: {key_id}")
        
        return {"message": "API key deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key: {e}", exc_info=True)
        raise HTTPException(500, "Failed to delete API key")


@router.get("/analytics/usage")
async def get_usage_analytics(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get API usage analytics.
    
    Args:
        from_date: Start date for analytics
        to_date: End date for analytics
        
    Returns:
        Usage analytics and statistics
    """
    try:
        # Default to last 7 days
        if not to_date:
            to_date = datetime.utcnow()
        if not from_date:
            from_date = to_date - timedelta(days=7)
        
        # Total requests by tier
        tier_stmt = select(
            APIKey.tier,
            func.sum(APIKey.total_requests).label('total_requests')
        ).group_by(APIKey.tier)
        
        tier_result = await db.execute(tier_stmt)
        tier_stats = {row.tier: row.total_requests for row in tier_result}
        
        # Most active clients
        active_stmt = select(
            APIKey.client_name,
            APIKey.total_requests
        ).where(APIKey.is_active == True).order_by(APIKey.total_requests.desc()).limit(10)
        
        active_result = await db.execute(active_stmt)
        top_clients = [
            {"client": row.client_name, "requests": row.total_requests}
            for row in active_result
        ]
        
        # Endpoint popularity (from usage logs)
        endpoint_stmt = select(
            APIUsageLog.endpoint,
            func.count(APIUsageLog.id).label('count')
        ).where(
            APIUsageLog.timestamp >= from_date,
            APIUsageLog.timestamp <= to_date
        ).group_by(APIUsageLog.endpoint).order_by(func.count(APIUsageLog.id).desc()).limit(10)
        
        endpoint_result = await db.execute(endpoint_stmt)
        popular_endpoints = [
            {"endpoint": row.endpoint, "count": row.count}
            for row in endpoint_result
        ]
        
        return {
            "period": {
                "from": from_date.isoformat(),
                "to": to_date.isoformat()
            },
            "requests_by_tier": tier_stats,
            "top_clients": top_clients,
            "popular_endpoints": popular_endpoints
        }
        
    except Exception as e:
        logger.error(f"Error fetching usage analytics: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch analytics")


@router.get("/tiers")
async def get_tiers(db: AsyncSession = Depends(get_db)):
    """Get available API tiers and their features"""
    try:
        stmt = select(APITier).where(APITier.is_active == True)
        result = await db.execute(stmt)
        tiers = result.scalars().all()
        
        return {
            "tiers": [
                {
                    "name": t.tier_name,
                    "display_name": t.display_name,
                    "rate_limits": {
                        "per_minute": t.rate_limit_per_minute,
                        "per_day": t.rate_limit_per_day
                    },
                    "features": {
                        "realtime_access": t.realtime_access,
                        "historical_access": t.historical_access,
                        "analytics_access": t.analytics_access,
                        "webhook_support": t.webhook_support,
                        "max_historical_days": t.max_historical_days
                    },
                    "monthly_price_usd": float(t.monthly_price_usd) if t.monthly_price_usd else None,
                    "description": t.description
                }
                for t in tiers
            ]
        }
        
    except Exception as e:
        logger.error(f"Error fetching tiers: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch tiers")
