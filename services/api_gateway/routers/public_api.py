"""
Public API Router

External-facing API endpoints for data access.
All endpoints require API key authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Security
from fastapi.security import APIKeyHeader
from datetime import datetime, timedelta
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
import httpx

from core.database.connection import get_db, get_db_context
from services.api_gateway.middleware.auth import (
    verify_api_key,
    check_endpoint_permission,
    check_symbol_permission
)
from services.api_gateway.models import APIKey
from core.config.settings import settings

logger = structlog.get_logger("public-api")

router = APIRouter()

# Internal service URLs
HISTORICAL_SERVICE_URL = "http://historical-service:8002"
REALTIME_SERVICE_URL = "http://realtime-service:8004"


async def verify_api_key_wrapper(
    request: Request = None, 
    api_key: str = Security(APIKeyHeader(name="X-API-Key", auto_error=False))
):
    """Wrapper to inject database session for API key verification"""
    from services.api_gateway.middleware.auth import verify_api_key
    from core.database.connection import async_session_factory
    
    # Create session directly from factory for FastAPI dependency
    async with async_session_factory() as db:
        return await verify_api_key(request, api_key, db)

@router.get("/option-chain/latest/{symbol_id}", response_model=None)
async def get_latest_option_chain(
    symbol_id: int,
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get latest option chain for a symbol.
    
    **Authentication:** API Key required  
    **Rate Limit:** Based on tier  
    **Tier Access:** All tiers
    
    Args:
        symbol_id: Symbol ID (13=NIFTY, 26=BANKNIFTY, etc.)
    
    Returns:
        Latest option chain with spot price and options data
    """
    # Check permissions
    if not await check_endpoint_permission(api_key, "option-chain"):
        raise HTTPException(403, "Access denied to option-chain endpoint")
    
    if not await check_symbol_permission(api_key, symbol_id):
        raise HTTPException(403, f"Access denied to symbol {symbol_id}")
    
    try:
        from core.http.client import ResilientHttpClient
        
        # Use resilient HTTP client with timeouts and circuit breaker
        async with ResilientHttpClient(base_url=HISTORICAL_SERVICE_URL) as client:
            response = await client.get(
                f"/oi-change/latest/{symbol_id}/24000",
                params={"option_type": "CE"}
            )
            
            if response.status_code != 200:
                raise HTTPException(response.status_code, "Failed to fetch data")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Request timeout")
    except Exception as e:
        logger.error(f"Error fetching option chain: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error")


@router.get("/historical/oi-change/{symbol_id}/{strike}")
async def get_historical_oi_change(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., pattern="^(CE|PE)$"),
    expiry: str = Query(...),
    from_time: datetime = Query(...),
    to_time: Optional[datetime] = None,
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get historical OI change data.
    
    **Authentication:** API Key required  
    **Rate Limit:** Based on tier  
    **Tier Access:** Basic, Pro, Enterprise (not Free)
    
    Args:
        symbol_id: Symbol ID
        strike: Strike price
        option_type: CE or PE
        expiry: Expiry date (YYYY-MM-DD)
        from_time: Start timestamp
        to_time: End timestamp (optional)
    
    Returns:
        Time-series OI change data for charting
    """
    # Check tier access (no historical for free tier)
    if api_key.tier == 'free':
        raise HTTPException(
            403,
            "Historical data not available in Free tier. Upgrade to Basic or higher."
        )
    
    # Check permissions
    if not await check_endpoint_permission(api_key, "historical"):
        raise HTTPException(403, "Access denied to historical endpoint")
    
    if not await check_symbol_permission(api_key, symbol_id):
        raise HTTPException(403, f"Access denied to symbol {symbol_id}")
    
    # Check date range permission
    # Check date range permission
    from datetime import timezone
    now_utc = datetime.now(timezone.utc)
    if from_time.tzinfo is None:
        from_time = from_time.replace(tzinfo=timezone.utc)
    
    days_ago = (now_utc - from_time).days
    if days_ago > api_key.max_historical_days:
        raise HTTPException(
            403,
            f"Your tier allows {api_key.max_historical_days} days of history. "
            f"You requested {days_ago} days ago."
        )
    
    try:
        from core.http.client import ResilientHttpClient
        
        # Proxy to Historical Service with retry and timeout
        # Proxy to Historical Service with retry and timeout
        async with ResilientHttpClient(base_url=HISTORICAL_SERVICE_URL) as client:
            params = {
                "option_type": option_type,
                "expiry": expiry,
                "from_time": from_time.isoformat()
            }
            if to_time:
                params["to_time"] = to_time.isoformat()
                
            response = await client.get(
                f"/oi-change/{symbol_id}/{strike}",
                params=params
            )
            
            if response.status_code != 200:
                raise HTTPException(response.status_code, "Failed to fetch data")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Request timeout")
    except Exception as e:
        logger.error(f"Error fetching historical OI: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error")


@router.get("/historical/velocity/{symbol_id}/{strike}")
async def get_historical_velocity(
    symbol_id: int,
    strike: float,
    option_type: str = Query(..., pattern="^(CE|PE)$"),
    expiry: str = Query(...),
    from_time: datetime = Query(...),
    to_time: Optional[datetime] = None,
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get historical velocity/momentum data.
    
    **Authentication:** API Key required  
    **Rate Limit:** Based on tier  
    **Tier Access:** Basic, Pro, Enterprise
    """
    if api_key.tier == 'free':
        raise HTTPException(403, "Historical data not available in Free tier")
    
    if not await check_symbol_permission(api_key, symbol_id):
        raise HTTPException(403, f"Access denied to symbol {symbol_id}")
    
    days_ago = (datetime.utcnow() - from_time).days
    if days_ago > api_key.max_historical_days:
        raise HTTPException(403, f"Date range exceeds {api_key.max_historical_days} days limit")
    
    try:
        from core.http.client import ResilientHttpClient
        
        async with ResilientHttpClient(base_url=HISTORICAL_SERVICE_URL) as client:
            response = await client.get(
                f"/velocity/{symbol_id}/{strike}",
                params={
                    "option_type": option_type,
                    "expiry": expiry,
                    "from_time": from_time.isoformat(),
                    "to_time": to_time.isoformat() if to_time else None
                }
            )
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Error fetching velocity data: {e}", exc_info=True)
        raise HTTPException(500, "Internal server error")


@router.get("/analytics/patterns/{symbol_id}")
async def get_patterns(
    symbol_id: int,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    min_confidence: float = Query(50.0, ge=0, le=100),
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get detected patterns and trading signals.
    
    **Authentication:** API Key required  
    **Rate Limit:** Based on tier  
    **Tier Access:** Pro, Enterprise
    
    Args:
        symbol_id: Symbol ID
        from_time: Start time (default: last 24 hours)
        to_time: End time (default: now)
        min_confidence: Minimum confidence threshold (0-100)
        
    Returns:
        Detected patterns with confidence scores
    """
    if api_key.tier in ['free', 'basic']:
        raise HTTPException(
            403,
            "Pattern analytics available in Pro tier and above"
        )
    
    if not await check_symbol_permission(api_key, symbol_id):
        raise HTTPException(403, f"Access denied to symbol {symbol_id}")
    
    # Default time range: last 24 hours
    if not to_time:
        to_time = datetime.utcnow()
    if not from_time:
        from_time = to_time - timedelta(hours=24)
    
    try:
        from sqlalchemy import select, and_
        from services.analytics.models import AnalyticsPatterns
        from core.database.connection import get_db_context
        
        # Query patterns from database
        async with get_db_context() as session:
            stmt = select(AnalyticsPatterns).where(
                and_(
                    AnalyticsPatterns.symbol_id == symbol_id,
                    AnalyticsPatterns.timestamp >= from_time,
                    AnalyticsPatterns.timestamp <= to_time,
                    AnalyticsPatterns.confidence >= min_confidence
                )
            ).order_by(AnalyticsPatterns.confidence.desc(), AnalyticsPatterns.timestamp.desc())
            
            result = await session.execute(stmt)
            patterns = result.scalars().all()
            
            # Format response
            pattern_list = [
                {
                    "type": p.pattern_type,
                    "strike": p.strike_price,
                    "option_type": p.option_type,
                    "confidence": p.confidence,
                    "signal": p.signal,
                    "description": p.description,
                    "timestamp": p.timestamp.isoformat(),
                    "metadata": p.metadata_
                }
                for p in patterns
            ]
            
            return {
                "symbol_id": symbol_id,
                "from": from_time.isoformat(),
                "to": to_time.isoformat(),
                "min_confidence": min_confidence,
                "patterns": pattern_list,
                "total": len(pattern_list)
            }
            
    except Exception as e:
        logger.error(f"Error fetching patterns: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch patterns")


@router.get("/symbols")
async def get_symbols(
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get list of available symbols.
    
    **Authentication:** API Key required  
   **Rate Limit:** Based on tier  
    **Tier Access:** All tiers
    """
    try:
        from sqlalchemy import select, and_
        from core.database.models import InstrumentDB
        from core.database.connection import get_db_context
        
        async with get_db_context() as session:
            # If restricted symbols, filter by those IDs
            if api_key.allowed_symbols:
                stmt = select(InstrumentDB).where(
                    InstrumentDB.symbol_id.in_(api_key.allowed_symbols)
                )
            else:
                # Return all available symbols
                stmt = select(InstrumentDB).where(
                    InstrumentDB.is_active == True
                ).order_by(InstrumentDB.symbol)
            
            result = await session.execute(stmt)
            instruments = result.scalars().all()
            
            symbols = [
                {
                    "id": inst.symbol_id,
                    "name": inst.symbol,
                    "exchange": inst.exchange_segment if hasattr(inst, 'exchange_segment') else "NSE"
                }
                for inst in instruments
            ]
            
            return {"symbols": symbols, "total": len(symbols)}
            
    except Exception as e:
        logger.error(f"Error fetching symbols: {e}", exc_info=True)
        # Fallback to hardcoded if database query fails
        symbols = [
            {"id": 13, "name": "NIFTY", "exchange": "NSE"},
            {"id": 26, "name": "BANKNIFTY", "exchange": "NSE"}
        ]
        return {"symbols": symbols, "total": len(symbols)}


@router.get("/usage")
async def get_usage_stats(
    api_key = Depends(verify_api_key_wrapper)
):
    """
    Get API usage statistics for current key.
    
    **Authentication:** API Key required  
    **Rate Limit:** Based on tier  
    **Tier Access:** All tiers
    """
    return {
        "tier": api_key.tier,
        "rate_limits": {
            "per_minute": api_key.rate_limit_per_minute,
            "per_day": api_key.rate_limit_per_day
        },
        "usage": {
            "total_requests": api_key.total_requests,
            "requests_today": api_key.requests_today,
            "last_used": api_key.last_used_at.isoformat() if api_key.last_used_at else None
        },
        "permissions": {
            "allowed_symbols": api_key.allowed_symbols or "all",
            "max_historical_days": api_key.max_historical_days
        }
    }
