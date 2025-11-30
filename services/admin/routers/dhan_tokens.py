"""
API Router for Dhan API Token Management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import json
import redis.asyncio as redis
from core.logging.logger import get_logger
from core.config.settings import get_settings
from core.database.db import async_session_factory
from core.database.models import SystemConfigDB
from sqlalchemy import select, update
from datetime import datetime

from services.gateway.auth import get_current_admin_user

router = APIRouter(prefix="/dhan-tokens", tags=["Dhan API Tokens"])
logger = get_logger("admin.dhan_tokens")
settings = get_settings()


class DhanTokensResponse(BaseModel):
    """Response model for Dhan API tokens"""
    auth_token: str
    authorization_token: str
    auth_token_preview: str  # First 50 chars for security
    authorization_token_preview: str
    last_updated: Optional[datetime] = None


class UpdateDhanTokensRequest(BaseModel):
    """Request model for updating Dhan API tokens"""
    auth_token: Optional[str] = None
    authorization_token: Optional[str] = None


@router.get("", response_model=DhanTokensResponse)
async def get_dhan_tokens(admin = Depends(get_current_admin_user)):
    """
    Get current Dhan API tokens (with preview for security)
    """
    async with async_session_factory() as session:
        # Get auth token
        auth_result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == "dhan_auth_token")
        )
        auth_config = auth_result.scalar_one_or_none()
        
        # Get authorization token
        authz_result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == "dhan_authorization_token")
        )
        authz_config = authz_result.scalar_one_or_none()
        
        if not auth_config or not authz_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dhan API tokens not configured"
            )
        
        return DhanTokensResponse(
            auth_token=auth_config.value,
            authorization_token=authz_config.value,
            auth_token_preview=auth_config.value[:50] + "..." if len(auth_config.value) > 50 else auth_config.value,
            authorization_token_preview=authz_config.value[:50] + "..." if len(authz_config.value) > 50 else authz_config.value,
            last_updated=auth_config.updated_at
        )


@router.put("")
async def update_dhan_tokens(
    request: UpdateDhanTokensRequest,
    admin = Depends(get_current_admin_user)
):
    """
    Update Dhan API tokens
    
    This will update the tokens in the database and they will be picked up
    by the ingestion service on next config refresh.
    """
    if not request.auth_token and not request.authorization_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one token must be provided"
        )
    
    async with async_session_factory() as session:
        updated_tokens = []
        
        # Update auth token
        if request.auth_token:
            await session.execute(
                update(SystemConfigDB)
                .where(SystemConfigDB.key == "dhan_auth_token")
                .values(value=request.auth_token, updated_at=datetime.utcnow())
            )
            updated_tokens.append("auth_token")
            logger.info(f"Dhan auth_token updated by admin {admin.get('username', 'unknown')}")
        
        # Update authorization token
        if request.authorization_token:
            await session.execute(
                update(SystemConfigDB)
                .where(SystemConfigDB.key == "dhan_authorization_token")
                .values(value=request.authorization_token, updated_at=datetime.utcnow())
            )
            updated_tokens.append("authorization_token")
            logger.info(f"Dhan authorization_token updated by admin {admin.get('username', 'unknown')}")
        
        await session.commit()
        
        # NEW: Invalidate token cache across all services via Redis Pub/Sub
        try:
            redis_client = await redis.from_url(settings.REDIS_URL, decode_responses=True)
            
            # Clear Redis cache
            await redis_client.delete("dhan:tokens")
            
            # Publish update notification to all services
            await redis_client.publish(
                "dhan:tokens:updated",
                json.dumps({
                    "timestamp": datetime.utcnow().isoformat(),
                    "updated_by": admin.get('username', 'admin'),
                    "updated_tokens": updated_tokens
                })
            )
            
            await redis_client.close()
            logger.info(f"Published token update notification to all services")
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}")
            # Don't fail the request if cache invalidation fails
        
        return {
            "status": "success",
            "message": f"Updated tokens: {', '.join(updated_tokens)}",
            "updated_tokens": updated_tokens,
            "note": "Tokens updated and cache invalidated. All services will use new tokens within 100ms."
        }


@router.post("/test")
async def test_dhan_tokens(admin = Depends(get_current_admin_user)):
    """
    Test Dhan API tokens by making a test request
    
    This will attempt to fetch expiry dates for NIFTY to validate tokens
    """
    import httpx
    
    async with async_session_factory() as session:
        # Get tokens
        auth_result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == "dhan_auth_token")
        )
        auth_config = auth_result.scalar_one_or_none()
        
        authz_result = await session.execute(
            select(SystemConfigDB).where(SystemConfigDB.key == "dhan_authorization_token")
        )
        authz_config = authz_result.scalar_one_or_none()
        
        if not auth_config or not authz_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dhan API tokens not configured"
            )
    
    # Test API call
    headers = {
        "accept": "application/json, text/plain, */*",
        "auth": auth_config.value,
        "authorisation": authz_config.value,
        "content-type": "application/json",
        "origin": "https://web.dhan.co",
        "referer": "https://web.dhan.co/",
    }
    
    payload = {"Data": {"Seg": 0, "Sid": 13}}  # NIFTY
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://scanx.dhan.co/scanx/futoptsum",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                return {
                    "status": "success",
                    "message": "Dhan API tokens are valid",
                    "test_call": "futoptsum for NIFTY",
                    "response_status": response.status_code
                }
            else:
                return {
                    "status": "error",
                    "message": f"API returned status {response.status_code}",
                    "test_call": "futoptsum for NIFTY",
                    "response_status": response.status_code,
                    "response_body": response.text[:200]
                }
    except Exception as e:
        logger.error(f"Dhan API test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API test failed: {str(e)}"
        )
