
import asyncio
import logging
import os
import sys
from uuid import uuid4
from datetime import datetime

# Add repo root to path for 'core' module
current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.abspath(os.path.join(current_dir, "../../"))
sys.path.append(repo_root)
sys.path.append(current_dir)

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles

from app.main import app
from app.config.database import Base, get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.support import SupportTicket, TicketMessage, TicketStatus, TicketCategory
from app.models.notification import NotificationPreference, NotificationPriority

# SQLite UUID Fix
@compiles(UUID, "sqlite")
def compile_uuid(type_, compiler, **kw):
    return "VARCHAR(36)"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_notif")

# Mocks
USER_ID = uuid4()
ADMIN_ID = uuid4()

mock_user = User(
    id=USER_ID,
    firebase_uid=str(uuid4()),
    email="user@test.com",
    username="user",
    full_name="User",
    role=UserRole.USER,
    is_active=True
)

mock_admin = User(
    id=ADMIN_ID,
    firebase_uid=str(uuid4()),
    email="admin@test.com",
    username="admin",
    full_name="Admin",
    role=UserRole.ADMIN,
    is_active=True
)

# DB Setup
engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

# We will swap this dependency in the test to simulate admin login
current_user_mock = mock_admin
async def override_get_current_user():
    return current_user_mock

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        session.add(mock_user)
        session.add(mock_admin)
        # Add notification preferences for user
        prefs = NotificationPreference(
            user_id=mock_user.id,
            enable_in_app=True,
            enable_push=True
        )
        session.add(prefs)
        
        # Create a ticket
        ticket = SupportTicket(
            id=uuid4(),
            user_id=mock_user.id,
            ticket_id="TKT-TEST",
            subject="Test Ticket",
            category=TicketCategory.ISSUE,
            status=TicketStatus.OPEN,
            priority=NotificationPriority.NORMAL,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(ticket)
        await session.commit()
        return str(ticket.id)

async def run_verification():
    logger.info("Starting Notification Verification")
    ticket_id = await init_db()
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # Login as Admin (via dependency mock)
        logger.info("[1] Sending Admin Reply...")
        payload = {"message": "Hello User, this is admin!", "attachments": []}
        
        res = await client.post(
            f"/api/admin/support/tickets/{ticket_id}/messages", 
            json=payload
        )
        
        assert res.status_code == 200, f"Reply failed: {res.text}"
        logger.info("    -> Reply sent successfully")
        
        # Verify notification created in DB
        async with TestingSessionLocal() as session:
            from app.models.notification import Notification
            result = await session.execute(select(Notification).where(Notification.user_id == mock_user.id))
            notif = result.scalar_one_or_none()
            
            assert notif is not None, "Notification not found in DB"
            assert "Hello User" in notif.message
            assert notif.priority == NotificationPriority.HIGH
            logger.info(f"    -> Notification verified: {notif.title}")

    logger.info("SUCCESS: Notification Verification Passed!")

if __name__ == "__main__":
    import sqlalchemy
    # Fix for select() in verify script if needed, but imported correctly.
    from sqlalchemy import select
    asyncio.run(run_verification())
