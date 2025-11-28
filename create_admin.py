import asyncio
from core.database.db import get_db_session
from core.database.models import UserDB
from passlib.context import CryptContext
from sqlalchemy import select

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    async for db in get_db_session():
        # Check if admin exists
        result = await db.execute(select(UserDB).where(UserDB.username == "admin"))
        user = result.scalar_one_or_none()
        
        if user:
            print(f"Admin user already exists: {user.username}")
            return
        
        # Create admin user
        hashed_password = pwd_context.hash("ChangeMe123!")
        admin_user = UserDB(
            username="admin",
            email="admin@stockify.com",
            hashed_password=hashed_password,
            is_active=True,
            is_admin=True,
            api_calls_limit=10000,
            websocket_limit=100
        )
        
        db.add(admin_user)
        await db.commit()
        await db.refresh(admin_user)
        
        print(f"Admin user created: {admin_user.username}")
        break

if __name__ == "__main__":
    asyncio.run(create_admin())
