"""
Profile API Endpoints
Self-service profile management for authenticated users.
"""
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.dependencies import CurrentUser
from app.repositories.user import UserRepository
from app.schemas.user import UserResponse
from app.schemas.common import ResponseModel
from app.models.user import UserActivityLogDB

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Helpers ==============

async def log_activity(db: AsyncSession, user_id: Any, activity_type: str, description: str = None, ip_address: str = None, throttle_seconds: int = 0):
    """
    Log user activity to database with optional throttling.
    If throttle_seconds > 0, it won't log if a similar event occurred within that window.
    """
    try:
        from sqlalchemy import select, and_, desc
        from datetime import datetime, timedelta
        
        if throttle_seconds > 0:
            # Check for recent same-type activity for this user
            stmt = select(UserActivityLogDB).where(
                and_(
                    UserActivityLogDB.user_id == user_id,
                    UserActivityLogDB.activity_type == activity_type,
                    UserActivityLogDB.timestamp >= datetime.utcnow() - timedelta(seconds=throttle_seconds)
                )
            ).order_by(desc(UserActivityLogDB.timestamp)).limit(1)
            
            result = await db.execute(stmt)
            if result.scalars().first():
                # Already logged recently, skip
                return

        log_entry = UserActivityLogDB(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            ip_address=ip_address
        )
        db.add(log_entry)
        await db.flush() # Ensure it's part of transaction
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")


# ============== Request Models ==============

class ProfileUpdateRequest(BaseModel):
    """Update profile request"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=100)
    profile_image: Optional[str] = None


class NotificationSettingsRequest(BaseModel):
    """Notification settings and other app preferences update"""
    # Notification Toggles
    trade_alerts: bool = True
    price_alerts: bool = True
    news_updates: bool = False
    market_analysis: bool = True
    email_notifications: bool = True
    push_notifications: bool = False
    
    # App Preferences (Theme, Sound, Refresh Rate)
    theme: Optional[str] = "dark"
    sound_enabled: Optional[bool] = True
    refresh_rate: Optional[int] = 3


class PasswordChangeRequest(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=8)


# ============== Endpoints ==============

@router.get("", response_model=ResponseModel[UserResponse])
async def get_my_profile(
    current_user: CurrentUser,
):
    """
    Get current user's profile (aligned with frontend).
    """
    return ResponseModel(
        success=True,
        data=UserResponse.model_validate(current_user)
    )


@router.put("", response_model=ResponseModel[UserResponse])
async def update_my_profile(
    update_data: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update current user's profile.
    """
    user_repo = UserRepository(db)
    
    # Build update dict from non-null fields
    update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
    
    if not update_dict:
        return ResponseModel(
            success=True,
            message="No changes provided",
            data=UserResponse.model_validate(current_user)
        )
    
    # Update user
    updated_user = await user_repo.update(current_user.id, update_dict)
    
    # Log activity
    await log_activity(db, current_user.id, "PROFILE_UPDATE", f"Updated fields: {', '.join(update_dict.keys())}")
    
    await db.commit()
    
    logger.info(f"User {current_user.email} updated their profile")
    
    return ResponseModel(
        success=True,
        message="Profile updated successfully",
        data=UserResponse.model_validate(updated_user)
    )


@router.put("/notifications", response_model=ResponseModel)
async def update_notification_settings(
    settings: NotificationSettingsRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update notification preferences and app settings in preferences JSON.
    """
    user_repo = UserRepository(db)
    
    # Merge new settings into existing preferences
    old_prefs = current_user.preferences or {}
    new_data = settings.model_dump()
    
    # Check if anything actually changed before logging
    has_changed = False
    for key, val in new_data.items():
        if old_prefs.get(key) != val:
            has_changed = True
            break
            
    if not has_changed:
        return ResponseModel(
            success=True,
            message="No changes detected",
            data=old_prefs
        )

    new_prefs = old_prefs.copy()
    new_prefs.update(new_data)
    
    await user_repo.update(current_user.id, {"preferences": new_prefs})
    
    # Log activity - unique update
    await log_activity(db, current_user.id, "SETTINGS_UPDATE", "Updated app preferences and notifications")
    
    await db.commit()
    
    logger.info(f"User {current_user.email} updated preferences")
    
    return ResponseModel(
        success=True,
        message="Preferences updated successfully",
        data=new_prefs
    )


@router.get("/stats")
async def get_my_trading_stats(
    current_user: CurrentUser,
):
    """
    Get user's trading statistics.
    """
    # Mock trading stats - in production, query trades table
    return {
        "success": True,
        "stats": {
            "total_trades": 1247,
            "winning_trades": 913,
            "losing_trades": 334,
            "win_rate": 73.2,
            "total_pnl": 1240000,
            "avg_return": 18.5,
            "best_trade": 85000,
            "worst_trade": -42000,
            "avg_trade_duration": "2.3 hours",
            "most_traded_symbol": "NIFTY",
            "active_days": 156,
            "streak": {
                "current": 5,
                "best": 12,
            }
        }
    }


@router.get("/activity")
async def get_activity_history(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = 20
):
    """
    Get current user's activity history.
    """
    from sqlalchemy import select
    
    query = select(UserActivityLogDB).where(
        UserActivityLogDB.user_id == current_user.id
    ).order_by(UserActivityLogDB.timestamp.desc()).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "success": True,
        "activities": [
            {
                "id": str(log.id),
                "type": log.activity_type,
                "action": log.activity_type, # Alias for frontend
                "description": log.description,
                "details": log.description,  # Alias for frontend
                "timestamp": log.timestamp.isoformat(),
                "ip": log.ip_address
            } for log in logs
        ]
    }


@router.post("/security/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Change user password (placeholder for Firebase integration).
    In a real app, this would verify current_password and then update it in Firebase.
    """
    # NOTE: Actual password change should be handled by Firebase client-side or admin SDK
    # Here we just log the attempt and return success (dummy for UI testing)
    
    await log_activity(db, current_user.id, "PASSWORD_CHANGE", "User changed their password")
    await db.commit()
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }
