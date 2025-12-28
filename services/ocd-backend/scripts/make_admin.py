"""
Script to promote a user to admin role.
Run from the Backend directory:
    python -m scripts.make_admin <email>
"""
import asyncio
import sys
from sqlalchemy import update
from app.config.database import AsyncSessionLocal
from app.models.user import User, UserRole


async def promote_to_admin(email: str):
    """Promote a user to admin role"""
    async with AsyncSessionLocal() as session:
        # Find user by email
        result = await session.execute(
            update(User)
            .where(User.email == email)
            .values(role=UserRole.ADMIN)
            .returning(User.id)
        )
        
        user_id = result.scalar()
        
        if user_id:
            await session.commit()
            print(f"✅ User '{email}' has been promoted to ADMIN")
        else:
            print(f"❌ User '{email}' not found in database")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.make_admin <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(promote_to_admin(email))
