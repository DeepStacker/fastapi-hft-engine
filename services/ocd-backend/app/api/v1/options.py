"""
Options API Endpoints
"""
import logging

from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.dependencies import CurrentUser, Cache
from app.core.exceptions import ValidationException
from app.services.dhan_client import get_dhan_client
from app.services.options import OptionsService
from app.cache.redis import get_redis, RedisCache
from app.schemas.options import (
    ExpiryDateResponse,
    PercentageDataRequest,
    IVDataRequest,
    DeltaDataRequest,
    FuturePriceRequest,
)
from app.schemas.common import ResponseModel

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_options_service(
    cache: RedisCache = Depends(get_redis)
) -> OptionsService:
    """Dependency to get options service"""
    dhan = await get_dhan_client(cache=cache)
    return OptionsService(dhan_client=dhan, cache=cache)


@router.get("/expiry/{symbol}", response_model=ResponseModel)
async def get_expiry_dates(
    symbol: str,
    current_user: CurrentUser,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get available expiry dates for a symbol.
    """
    symbol = symbol.upper()
    
    if len(symbol) < 2:
        raise ValidationException("Invalid symbol")
    
    data = await service.get_expiry_dates(symbol)
    
    return ResponseModel(
        success=True,
        data=data
    )


@router.get("/chain/{symbol}/{expiry}")
async def get_option_chain(
    symbol: str,
    expiry: str,
    current_user: CurrentUser,
    include_greeks: bool = Query(default=True),
    include_reversal: bool = Query(default=True),
    service: OptionsService = Depends(get_options_service),
):
    """
    Get option chain data with Greeks and reversal points.
    """
    symbol = symbol.upper()
    
    data = await service.get_live_data(
        symbol=symbol,
        expiry=expiry,
        include_greeks=include_greeks,
        include_reversal=include_reversal
    )
    
    return data


@router.get("/live")
async def get_live_data(
    symbol: str = Query(..., alias="sid"),
    expiry: str = Query(default=None, alias="exp_sid"),  # Made optional - backend auto-fetches if missing
    current_user: CurrentUser = None,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get live option chain data (REST endpoint).
    Compatible with legacy API.
    If expiry is not provided, the backend will auto-fetch the nearest expiry.
    """
    data = await service.get_live_data(
        symbol=symbol.upper(),
        expiry=expiry,  # Can be None - service handles fallback
        include_greeks=True,
        include_reversal=True
    )
    
    return data


@router.post("/percentage")
async def get_percentage_data(
    request: PercentageDataRequest,
    current_user: CurrentUser,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get percentage/volume analysis for a specific option.
    """
    data = await service.get_percentage_data(
        symbol=request.symbol,
        expiry=request.expiry,
        strike=request.strike,
        option_type=request.option_type
    )
    
    return data


@router.post("/iv")
async def get_iv_data(
    request: IVDataRequest,
    current_user: CurrentUser,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get IV analysis for a specific option.
    """
    data = await service.get_iv_data(
        symbol=request.symbol,
        expiry=request.expiry,
        strike=request.strike,
        option_type=request.option_type
    )
    
    return data


@router.post("/delta")
async def get_delta_data(
    request: DeltaDataRequest,
    current_user: CurrentUser,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get delta analysis for a strike.
    """
    data = await service.get_delta_data(
        symbol=request.symbol,
        expiry=request.expiry,
        strike=request.strike
    )
    
    return data


@router.post("/future")
async def get_future_price_data(
    request: FuturePriceRequest,
    current_user: CurrentUser,
    service: OptionsService = Depends(get_options_service),
):
    """
    Get future price analysis.
    """
    data = await service.get_future_price_data(
        symbol=request.symbol,
        expiry=request.expiry
    )
    
    return data
