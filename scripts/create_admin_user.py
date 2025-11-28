"""
Create admin user for dashboard access
"""
import asyncio
from core.database.db import async_session_factory
from core.database.models import UserDB
from services.gateway.auth import get_password_hash

async def create_admin_user():
    async with async_session_factory() as session:
        # Check if admin exists
        from sqlalchemy import select
        result = await session.execute(select(UserDB).where(UserDB.username == "admin"))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("Admin user already exists")
            # Update password just in case
            existing.hashed_password = get_password_hash("admin")
            existing.is_admin = True
            existing.is_active = True
        else:
            # Create new admin user
            admin_user = UserDB(
                username="admin",
                email="admin@stockify.com",
                hashed_password=get_password_hash("admin"),
                is_admin=True,
                is_active=True
            )
            session.add(admin_user)
            print("Created new admin user")
        
        await session.commit()
        print("✅ Admin user ready: username=admin, password=admin")

if __name__ == "__main__":
    asyncio.run(create_admin_user())
