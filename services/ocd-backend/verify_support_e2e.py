
import asyncio
import logging
from uuid import uuid4
from datetime import datetime

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import String

import sys
import os
import shutil

# Add repo root to path for 'core' module
current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.abspath(os.path.join(current_dir, "../../"))
sys.path.append(repo_root)

# Add current dir to path for 'app' module
sys.path.append(current_dir)

@compiles(UUID, "sqlite")
def compile_uuid(type_, compiler, **kw):
    return "VARCHAR(36)"

from app.main import app
from app.config.database import Base, get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_e2e")

# User Mocks
USER_ID = uuid4()
ADMIN_ID = uuid4()

mock_user = User(
    id=USER_ID,
    firebase_uid=str(uuid4()),
    email="user@test.com",
    username="user",
    full_name="Test User",
    role=UserRole.USER,
    is_active=True,
    preferences={} # JSON
)

mock_admin = User(
    id=ADMIN_ID,
    firebase_uid=str(uuid4()),
    email="admin@test.com",
    username="admin",
    full_name="Admin User",
    role=UserRole.ADMIN,
    is_active=True,
    preferences={}
)

# Database Setup
engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

# Auth Override Logic
current_role_override = "user" # 'user' or 'admin'

async def override_get_current_user():
    if current_role_override == "admin":
        return mock_admin
    return mock_user

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        session.add(mock_user)
        session.add(mock_admin)
        await session.commit()

async def run_verification():
    global current_role_override
    logger.info("Starting Support System Verification")
    
    # Ensure static Uploads dir exists (mocking filesystem for upload)
    static_dir = os.path.join(current_dir, "static/uploads")
    os.makedirs(static_dir, exist_ok=True)

    await init_db()
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 1. User: Upload File
        logger.info("[1] User: Uploading File...")
        current_role_override = "user"
        
        test_content = b"Fake PDF Content"
        files = {'file': ('test.pdf', test_content, 'application/pdf')}
        
        res = await client.post("/api/v1/support/tickets/upload", files=files)
        assert res.status_code == 200, f"Upload failed: {res.text}"
        data = res.json()
        uploaded_url = data["url"]
        logger.info(f"    -> File Uploaded: {uploaded_url}")

        # 2. User: Create Ticket with Attachment
        logger.info("[2] User: Creating Ticket with Attachment...")
        create_payload = {
            "subject": "Issue with attachment",
            "category": "issue",
            "message": "See attached file.",
            "priority": "high",
            "attachments": [uploaded_url]
        }
        res = await client.post("/api/v1/support/tickets", json=create_payload)
        assert res.status_code == 200, f"Create failed: {res.text}"
        ticket_data = res.json()
        ticket_id = ticket_data["id"]
        
        # Verify valid attachments persisted
        assert len(ticket_data["messages"][0]["attachments"]) == 1
        assert ticket_data["messages"][0]["attachments"][0] == uploaded_url
        logger.info(f"    -> Ticket Created: {ticket_data['ticket_id']}")
        
        # 3. Admin: View Ticket & Attachment
        logger.info("[3] Admin: Viewing Ticket & Attachment...")
        current_role_override = "admin"
        res = await client.get(f"/api/admin/support/tickets/{ticket_id}")
        assert res.status_code == 200
        detail = res.json()
        assert len(detail["messages"][0]["attachments"]) == 1
        assert detail["messages"][0]["attachments"][0] == uploaded_url
        logger.info("    -> Admin sees attachment")
        
        # 4. Admin: Reply with Attachment
        logger.info("[4] Admin: Replying with Attachment...")
        
        # Upload another file as Admin (admin uses same upload endpoint?)
        # Let's assume Admin also uploads via the same endpoint or pre-uploads
        # For simulation, let's reuse the upload endpoint as admin
        files2 = {'file': ('screenshot.png', b"Fake PNG Content", 'image/png')}
        res = await client.post("/api/v1/support/tickets/upload", files=files2)
        assert res.status_code == 200
        admin_upload_url = res.json()["url"]
        logger.info(f"    -> Admin Uploaded: {admin_upload_url}")

        reply_payload = {
            "message": "Please check this screenshot.",
            "attachments": [admin_upload_url]
        }
        res = await client.post(f"/api/admin/support/tickets/{ticket_id}/messages", json=reply_payload)
        assert res.status_code == 200
        logger.info("    -> Admin Replied with attachment")
        
        # 5. User: Verify Reply
        logger.info("[5] User: Verifying Reply...")
        current_role_override = "user"
        res = await client.get(f"/api/v1/support/tickets/{ticket_id}")
        user_view = res.json()
        last_msg = user_view["messages"][-1]
        assert last_msg["message"] == "Please check this screenshot."
        assert len(last_msg["attachments"]) == 1
        assert last_msg["attachments"][0] == admin_upload_url
        logger.info("    -> User sees admin reply and attachment")

    logger.info("SUCCESS: All Verification Steps Passed!")
    
    # Cleanup (optional, keeping for inspection if needed)
    # shutil.rmtree(static_dir)

if __name__ == "__main__":
    asyncio.run(run_verification())
