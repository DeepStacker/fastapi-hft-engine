from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict # Added Dict

# --- Pydantic Models ---

class UserPreferences(BaseModel):
    """Model for user-specific preferences."""
    default_strike_count: int = Field(20, ge=2, le=500, description="Default number of strikes to show")
    # Add other preferences here, e.g.:
    # preferred_expiry_format: str = "timestamp" # e.g., "timestamp", "YYYY-MM-DD"
    # default_symbol_seg: Optional[int] = None

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None # Keep for profile, but remove from UserCreate
    phone_no: Optional[str] = None # Added phone number
    disabled: Optional[bool] = None
    preferences: UserPreferences = Field(default_factory=UserPreferences)

# Simplified UserCreate for registration
class UserCreate(BaseModel):
    username: str
    email: EmailStr # Make email mandatory for registration
    password: str
    phone_no: Optional[str] = None # Optional phone number

# Added model for password change by logged-in user
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Added models for forgot password flow
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetPerform(BaseModel):
    token: str
    new_password: str

class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True # Replaces orm_mode

# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str
    # In a real DB, preferences might be stored as JSONB or in a separate table
    preferences: UserPreferences # Store the model directly in fake DB

class UserPublic(UserBase): # Data safe to return to clients
    id: int
    preferences: UserPreferences # Include preferences in public data

    # Add Config here to allow validation from attributes
    class Config:
        from_attributes = True


