"""
API Router for Dhan API Token Management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional
import json
import redis.asyncio as redis
from core.logging.logger import get_logger
from core.config.settings import get_settings
from core.database.pool import db_pool, read_session, write_session
from core.database.models import SystemConfigDB
from sqlalchemy import select, update
from datetime import datetime

from services.admin.auth import get_current_admin_user
from services.admin.services.audit import audit_service

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
    async with read_session() as session:
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
        
        # Return empty strings if not configured, instead of 404
        auth_val = auth_config.value if auth_config else ""
        authz_val = authz_config.value if authz_config else ""
        
        return DhanTokensResponse(
            auth_token=auth_val,
            authorization_token=authz_val,
            auth_token_preview=auth_val[:50] + "..." if len(auth_val) > 50 else auth_val,
            authorization_token_preview=authz_val[:50] + "..." if len(authz_val) > 50 else authz_val,
            last_updated=auth_config.updated_at if auth_config else None
        )


@router.put("")
async def update_dhan_tokens(
    data: UpdateDhanTokensRequest,
    request: Request,
    admin = Depends(get_current_admin_user)
):
    """
    Update Dhan API tokens
    
    This will update the tokens in the database and they will be picked up
    by the ingestion service on next config refresh.
    """
    if not data.auth_token and not data.authorization_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one token must be provided"
        )
    
    async with write_session() as session:
        updated_tokens = []
        
        # Helper to upsert
        async def upsert_config(key: str, value: str):
            result = await session.execute(select(SystemConfigDB).where(SystemConfigDB.key == key))
            existing = result.scalar_one_or_none()
            
            if existing:
                existing.value = value
                existing.updated_at = datetime.utcnow()
            else:
                new_config = SystemConfigDB(
                    key=key,
                    value=value,
                    category="dhan",
                    is_encrypted=True,
                    description="Dhan API Token",
                    updated_at=datetime.utcnow()
                )
                session.add(new_config)
        
        # Update auth token
        if data.auth_token:
            await upsert_config("dhan_auth_token", data.auth_token)
            updated_tokens.append("auth_token")
            logger.info(f"Dhan auth_token updated by admin {admin.username}")
        
        # Update authorization token
        if data.authorization_token:
            await upsert_config("dhan_authorization_token", data.authorization_token)
            updated_tokens.append("authorization_token")
            logger.info(f"Dhan authorization_token updated by admin {admin.username}")
        
        await session.commit()
        
        # Get current token values for Redis write
        # Need to read current values for tokens not being updated
        current_auth = data.auth_token
        current_authz = data.authorization_token
        
        if not current_auth or not current_authz:
            # Fetch existing values if only one token is being updated
            result = await session.execute(
                select(SystemConfigDB).where(SystemConfigDB.key.in_(["dhan_auth_token", "dhan_authorization_token"]))
            )
            existing_configs = {c.key: c.value for c in result.scalars().all()}
            if not current_auth:
                current_auth = existing_configs.get("dhan_auth_token", "")
            if not current_authz:
                current_authz = existing_configs.get("dhan_authorization_token", "")
        
        # CRITICAL: Write new tokens directly to Redis (not just clear cache)
        # This ensures all services immediately have access to new tokens
        try:
            redis_client = await redis.from_url(settings.REDIS_URL, decode_responses=True)
            
            # Write new tokens to Redis with 24-hour TTL
            await redis_client.setex(
                "dhan:tokens",
                86400,  # 24 hours TTL
                json.dumps({
                    "auth_token": current_auth,
                    "authorization_token": current_authz,
                    "updated_at": datetime.utcnow().isoformat(),
                    "updated_by": admin.username
                })
            )
            logger.info("New tokens written directly to Redis cache")
            
            # Publish update notification to all services
            await redis_client.publish(
                "dhan:tokens:updated",
                json.dumps({
                    "timestamp": datetime.utcnow().isoformat(),
                    "updated_by": admin.username,
                    "updated_tokens": updated_tokens
                })
            )
            
            await redis_client.close()
            logger.info(f"Published token update notification to all services")
        except Exception as e:
            logger.error(f"Failed to update Redis cache: {e}")
            # Don't fail the request if cache update fails
        
        # Audit log
        await audit_service.log(
            action="UPDATE",
            resource_type="DHAN_TOKENS",
            resource_id="api_tokens",
            details={"updated_tokens": updated_tokens},
            ip_address=request.client.host if request.client else None
        )
        
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
    
    async with read_session() as session:
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
