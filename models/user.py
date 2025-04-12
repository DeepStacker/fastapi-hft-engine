from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict

# --- Pydantic Models ---

class UserPreferences(BaseModel):
    """Model for user-specific preferences."""
    default_strike_count: int = Field(20, ge=2, le=100, description="Default number of strikes to show")

class UserBase(BaseModel):
    username: str # Can be Firebase UID or chosen username
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone_no: Optional[str] = None
    disabled: Optional[bool] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)

# Restore UserCreate for manual registration
class UserCreate(BaseModel):
    username: str
    email: EmailStr # Make email mandatory for manual registration
    password: str
    phone_no: Optional[str] = None

# Restore Password models
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetPerform(BaseModel):
    token: str
    new_password: str


class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True

# Keep UserInDB to represent DB structure (even if password is null for Firebase)
class UserInDB(UserInDBBase):
    hashed_password: Optional[str] = None # Password is required for manual, null for Firebase

class UserPublic(UserBase): # Data safe to return to clients
    id: int
    preferences: UserPreferences

    class Config:
        from_attributes = True

