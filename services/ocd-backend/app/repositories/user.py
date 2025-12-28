"""
User Repository - User data access operations
"""
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model operations"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(db, User)
    
    async def get_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        """Get user by Firebase UID"""
        result = await self.db.execute(
            select(User).where(User.firebase_uid == firebase_uid)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        result = await self.db.execute(
            select(User).where(User.username == username.lower())
        )
        return result.scalar_one_or_none()
    
    async def create(
        self,
        firebase_uid: str,
        email: str,
        username: str,
        is_email_verified: bool = False,
        login_provider: str = "email",
        profile_image: Optional[str] = None,
        role: UserRole = UserRole.USER,
    ) -> User:
        """Create a new user"""
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            username=username.lower(),
            is_email_verified=is_email_verified,
            login_provider=login_provider,
            profile_image=profile_image,
            role=role,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user
    
    async def update_last_login(self, user_id: UUID) -> None:
        """Update user's last login timestamp"""
        user = await self.get_by_id(user_id)
        if user:
            user.last_login = datetime.utcnow()
            await self.db.flush()
    
    async def update_last_logout(self, user_id: UUID) -> None:
        """Update user's last logout timestamp"""
        user = await self.get_by_id(user_id)
        if user:
            user.last_logout = datetime.utcnow()
            await self.db.flush()
    
    async def update_role(self, user_id: UUID, role: UserRole) -> Optional[User]:
        """Update user's role"""
        user = await self.get_by_id(user_id)
        if user:
            user.role = role
            await self.db.flush()
            await self.db.refresh(user)
        return user
    
    async def deactivate(self, user_id: UUID) -> Optional[User]:
        """Deactivate a user"""
        user = await self.get_by_id(user_id)
        if user:
            user.is_active = False
            await self.db.flush()
            await self.db.refresh(user)
        return user
    
    async def activate(self, user_id: UUID) -> Optional[User]:
        """Activate a user"""
        user = await self.get_by_id(user_id)
        if user:
            user.is_active = True
            await self.db.flush()
            await self.db.refresh(user)
        return user
    
    async def search(
        self,
        query: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[User]:
        """Search users by email or username"""
        search_term = f"%{query.lower()}%"
        result = await self.db.execute(
            select(User)
            .where(
                or_(
                    User.email.ilike(search_term),
                    User.username.ilike(search_term)
                )
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_admins(self) -> List[User]:
        """Get all admin users"""
        result = await self.db.execute(
            select(User).where(User.role == UserRole.ADMIN)
        )
        return list(result.scalars().all())
    
    async def email_exists(self, email: str) -> bool:
        """Check if email already exists"""
        user = await self.get_by_email(email)
        return user is not None
    
    async def username_exists(self, username: str) -> bool:
        """Check if username already exists"""
        user = await self.get_by_username(username)
        return user is not None
