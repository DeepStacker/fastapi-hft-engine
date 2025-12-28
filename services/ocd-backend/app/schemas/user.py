"""
User Schemas - Request/Response models for user endpoints
"""
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=80)


class UserCreate(UserBase):
    """Schema for creating a new user"""
    firebase_uid: str = Field(..., min_length=1, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)
    profile_image: Optional[str] = None
    is_email_verified: bool = False
    login_provider: str = "email"
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        # Remove special characters except underscore
        if not v.replace("_", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v.lower()


class UserUpdate(BaseModel):
    """Schema for updating user by admin"""
    username: Optional[str] = Field(None, min_length=3, max_length=80)
    full_name: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, pattern="^(user|premium|admin)$")
    is_active: Optional[bool] = None
    is_email_verified: Optional[bool] = None
    subscription_expires: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    """Schema for user updating their own profile"""
    username: Optional[str] = Field(None, min_length=3, max_length=80)
    full_name: Optional[str] = Field(None, max_length=255)
    profile_image: Optional[str] = None
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.replace("_", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v.lower()


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    role: str
    is_active: bool
    is_email_verified: bool
    is_premium: bool
    login_provider: str
    subscription_expires: Optional[datetime] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Response for listing users"""
    id: UUID
    email: EmailStr
    username: str
    role: str
    is_active: bool
    is_premium: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthVerifyRequest(BaseModel):
    """Request schema for token verification"""
    id_token: str = Field(..., min_length=10)


class AuthVerifyResponse(BaseModel):
    """Response schema for token verification"""
    user: UserResponse
    token_valid: bool = True
    message: str = "Authentication successful"


class UpgradeSubscriptionRequest(BaseModel):
    """Request to upgrade to premium"""
    plan: str = Field(..., pattern="^(monthly|yearly)$")
    payment_id: Optional[str] = None
