import json
from fastapi import APIRouter, HTTPException, Query, Depends, Request, status
from typing import Optional, Dict, Any
import time 
import logging
# Keep limiter and auth dependency imports
from core.limiter import limiter
from api.auth import get_current_user_dependency

# Keep DB imports
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db

# Keep model imports
from models.user import UserPreferences
from models.db_models import User as UserInDBModel

# Import Service functions
from services.option_chain_service import fetch_and_process_option_chain
from services.expiry_service import fetch_and_process_expiry_dates
from services.settings_service import update_user_settings
# Import OptionChainError if needed for specific handling
from Get_oc_data import OptionChainError


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# --- Settings Endpoint ---

@router.put("/api/settings", response_model=UserPreferences)
async def update_settings_route( # Renamed route function slightly
    preferences: UserPreferences,
    db: AsyncSession = Depends(get_db),
    current_user: UserInDBModel = Depends(get_current_user_dependency)
):
    """Updates preferences for the currently authenticated user."""
    try:
        updated_prefs = await update_user_settings(
            db=db, current_user=current_user, preferences=preferences
        )
        return updated_prefs
    except Exception as e:
        # Handle potential DB errors or other issues from the service
        logger.error(f"Error in update_settings route for user '{current_user.username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user settings."
        )


# --- Option Chain / Expiry Endpoints ---

@router.get("/api/option-chain", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_option_chain_route( # Renamed route function slightly
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID"),
    symbol_exp: Optional[int] = Query(None, description="Expiry timestamp"),
    strike_count: Optional[int] = Query(
        None, description="Number of strikes around ATM to return (defaults to user preference)", ge=2, le=500
    ),
    current_user: UserInDBModel = Depends(get_current_user_dependency)
):
    """Get option chain data for a symbol with Redis caching (Requires Auth)"""
    logger.info(f"User '{current_user.username}' requested option chain route.")
    # Overall request timer can still be useful
    request_start_time = time.time()

    # Parse preferences from the DB model
    try:
        user_prefs = UserPreferences(**current_user.preferences) if isinstance(current_user.preferences, dict) else UserPreferences()
    except Exception: # Handle potential parsing error
        logger.warning(f"Could not parse preferences for user '{current_user.username}', using defaults.")
        user_prefs = UserPreferences()

    effective_strike_count = strike_count if strike_count is not None else user_prefs.default_strike_count
    logger.debug(f"Route using effective strike count: {effective_strike_count}")

    http_session = request.app.state.http_session
    redis_client = request.app.state.redis

    if not http_session:
        logger.error("HTTP session not available in application state.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal configuration error: HTTP session missing",
        )

    try:
        response_data, from_cache = await fetch_and_process_option_chain(
            http_session=http_session,
            redis_client=redis_client,
            symbol_seg=symbol_seg,
            symbol_sid=symbol_sid,
            symbol_exp=symbol_exp, # Pass None if not provided, service handles detection
            effective_strike_count=effective_strike_count
        )
        # Add overall request processing time if desired (optional)
        response_data["metadata"]["overall_request_time"] = f"{time.time() - request_start_time:.3f}s"
        return response_data

    except OptionChainError as e:
        logger.error(f"Option Chain Service Error for {symbol_seg}:{symbol_sid}: {e}")
        # Determine status code based on error message from service
        if "Could not determine expiry" in str(e):
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        elif "upstream service" in str(e).lower():
             raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        else: # Default to 503 for other service availability issues
             raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except HTTPException as e:
        # Re-raise HTTPExceptions that might originate from dependencies called by service
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in option chain route: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error processing option chain request.",
        )


@router.get("/api/expiry-dates", response_model=Dict[str, Any])
@limiter.limit("100/minute")
async def get_expiry_dates_route( # Renamed route function slightly
    request: Request,
    symbol_seg: int = Query(..., description="Symbol segment"),
    symbol_sid: int = Query(..., description="Symbol ID"),
    current_user: UserInDBModel = Depends(get_current_user_dependency)
):
    """Get expiry dates for a symbol with Redis caching (Requires Auth)"""
    logger.info(f"User '{current_user.username}' requested expiry dates route.")
    request_start_time = time.time()

    http_session = request.app.state.http_session
    redis_client = request.app.state.redis

    if not http_session:
        logger.error("HTTP session not available in application state.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal configuration error: HTTP session missing",
        )

    try:
        response_data, from_cache = await fetch_and_process_expiry_dates(
            http_session=http_session,
            redis_client=redis_client,
            symbol_seg=symbol_seg,
            symbol_sid=symbol_sid
        )

        # Check if service returned empty data (which might imply 404)
        if not response_data["data"]:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No expiry data found for the symbol.",
            )

        response_data["metadata"]["overall_request_time"] = f"{time.time() - request_start_time:.3f}s"
        return response_data

    except OptionChainError as e:
        logger.error(f"Expiry Service Error for {symbol_seg}:{symbol_sid}: {e}")
        if "upstream service" in str(e).lower():
             raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        else: # Default to 503
             raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in expiry dates route: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error processing expiry dates request.",
        )
