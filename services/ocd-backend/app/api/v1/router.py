"""
API v1 Router - Aggregates all API endpoints
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from typing import List
from pydantic import BaseModel
import logging

from app.core.exceptions import ExternalAPIException, NotFoundException
from app.services.options import get_options_service, OptionsService
from app.api.v1 import auth, users, options, health, charts, monitoring, historical, screeners, calculators, notifications, profile, sse, symbols, support, community
from app.api.v1.analytics import router as analytics_router  # Use split analytics package

api_router = APIRouter()


# Include all route modules
api_router.include_router(
    health.router,
    tags=["Health"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

# The following endpoints are added directly to the api_router,
# but logically belong to options. For simplicity of this edit,
# they are placed here. In a real application, these would likely
# be in the options.py router file.

@api_router.get("/live/{symbol}/{expiry}", response_model=None)
async def get_live_data(
    symbol: str, 
    expiry: str, 
    request: Request,
    include_greeks: bool = True,
    include_reversal: bool = True,
    options_service: OptionsService = Depends(get_options_service)
):
    """
    Get live options data for a specific symbol/expiry.
    """
    try:
        data = await options_service.get_live_data(
            symbol=symbol,
            expiry=expiry,
            include_greeks=include_greeks,
            include_reversal=include_reversal
        )
        return data
    except ExternalAPIException as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching live data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BatchRequest(BaseModel):
    symbols: List[str]
    include_greeks: bool = True
    include_reversal: bool = True

@api_router.post("/options/batch", response_model=None)
async def get_batch_data(
    request: BatchRequest,
    options_service: OptionsService = Depends(get_options_service)
):
    """
    Get live options data for multiple symbols in one request.
    """
    try:
        data = await options_service.get_batch_live_data(
            symbols=request.symbols,
            include_greeks=request.include_greeks,
            include_reversal=request.include_reversal
        )
        return data
    except Exception as e:
        logger.error(f"Error serving batch request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

api_router.include_router(
    options.router,
    prefix="/options",
    tags=["Options"]
)

api_router.include_router(
    analytics_router,
    prefix="/analytics",
    tags=["Analytics"]
)

api_router.include_router(
    historical.router,
    prefix="/historical",
    tags=["Historical"]
)



api_router.include_router(
    monitoring.router,
    # Note: monitoring.router already has prefix="/admin/monitoring" defined
    tags=["Monitoring"]
)

api_router.include_router(
    charts.router,
    prefix="/charts",
    tags=["Charts"]
)

api_router.include_router(
    screeners.router,
    prefix="/screeners",
    tags=["Screeners"]
)

api_router.include_router(
    calculators.router,
    prefix="/calculators",
    tags=["Calculators"]
)

api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["Notifications"]
)

api_router.include_router(
    profile.router,
    prefix="/profile",
    tags=["Profile"]
)

# SSE fallback for WebSocket alternatives
api_router.include_router(
    sse.router,
    prefix="/sse",
    tags=["SSE Fallback"]
)

# Dynamic symbols from database
api_router.include_router(
    symbols.router,
    tags=["Symbols"]
)

api_router.include_router(
    support.router,
    prefix="/support",
    tags=["Support"]
)

api_router.include_router(
    community.router,
    tags=["Community"]
)
