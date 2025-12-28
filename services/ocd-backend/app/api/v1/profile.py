"""
Profile API Endpoints
Self-service profile management for authenticated users.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import get_db
from app.core.dependencies import CurrentUser
from app.repositories.user import UserRepository
from app.schemas.user import UserResponse
from app.schemas.common import ResponseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Request Models ==============

class ProfileUpdateRequest(BaseModel):
    """Update profile request"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=100)
    profile_image: Optional[str] = None


class NotificationSettingsRequest(BaseModel):
    """Notification settings update"""
    trade_alerts: bool = True
    price_alerts: bool = True
    news_updates: bool = False
    market_analysis: bool = True
    email_notifications: bool = True
    push_notifications: bool = False


class ProfileResponse(BaseModel):
    """Profile response with all user data"""
    id: str
    email: str
    username: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    profile_image: Optional[str]
    role: str
    subscription_type: str
    is_email_verified: bool
    created_at: str
    trading_stats: dict
    notification_settings: dict


# ============== Endpoints ==============

@router.get("/me", response_model=ResponseModel[ProfileResponse])
async def get_my_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's profile.
    """
    user_dict = current_user.to_dict()
    
    # Add trading stats (mock for now)
    trading_stats = {
        "total_trades": "1,247",
        "win_rate": "73.2%",
        "total_pnl": "₹12.4L",
        "avg_return": "18.5%",
        "risk_score": "Medium",
        "active_days": "156",
    }
    
    # Add notification settings (would come from user preferences table)
    notification_settings = {
        "trade_alerts": True,
        "price_alerts": True,
        "news_updates": False,
        "market_analysis": True,
        "email_notifications": True,
        "push_notifications": False,
    }
    
    profile_data = ProfileResponse(
        id=str(user_dict.get("id", "")),
        email=user_dict.get("email", ""),
        username=user_dict.get("username", ""),
        phone=user_dict.get("phone", ""),
        bio=user_dict.get("bio", ""),
        location=user_dict.get("location", ""),
        profile_image=user_dict.get("profile_image", ""),
        role=user_dict.get("role", "user"),
        subscription_type=user_dict.get("subscription_type", "free"),
        is_email_verified=user_dict.get("is_email_verified", False),
        created_at=str(user_dict.get("created_at", "")),
        trading_stats=trading_stats,
        notification_settings=notification_settings,
    )
    
    return ResponseModel(
        success=True,
        data=profile_data
    )


@router.put("/me", response_model=ResponseModel[UserResponse])
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
            data=UserResponse.model_validate(current_user.to_dict())
        )
    
    # Update user
    updated_user = await user_repo.update(current_user.id, update_dict)
    await db.commit()
    
    logger.info(f"User {current_user.email} updated their profile")
    
    return ResponseModel(
        success=True,
        message="Profile updated successfully",
        data=UserResponse.model_validate(updated_user.to_dict())
    )


@router.put("/me/notification-settings", response_model=ResponseModel)
async def update_notification_settings(
    settings: NotificationSettingsRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update notification preferences.
    """
    # In production, save to user_preferences table
    # For now, just validate and return success
    
    logger.info(f"User {current_user.email} updated notification settings")
    
    return ResponseModel(
        success=True,
        message="Notification settings updated",
        data=settings.model_dump()
    )


@router.get("/me/stats")
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
