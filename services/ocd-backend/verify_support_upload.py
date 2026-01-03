
import asyncio
import logging
import os
import shutil
from uuid import uuid4
import sys

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

# SQLite UUID Fix
@compiles(UUID, "sqlite")
def compile_uuid(type_, compiler, **kw):
    return "VARCHAR(36)"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_upload")

# User Mocks
USER_ID = uuid4()
mock_user = User(
    id=USER_ID,
    firebase_uid=str(uuid4()),
    email="user@test.com",
    username="user",
    full_name="Test User",
    role=UserRole.USER,
    is_active=True,
    preferences={}
)

# DB Setup
engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

async def override_get_current_user():
    return mock_user

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        session.add(mock_user)
        await session.commit()

async def run_verification():
    logger.info("Starting Support Upload Verification")
    await init_db()
    
    # Clean uploads dir
    if os.path.exists("static/uploads"):
        for f in os.listdir("static/uploads"):
             if f.endswith(".txt"): # Cleanup test files
                 os.remove(os.path.join("static/uploads", f))
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 1. Test File Upload
        logger.info("[1] Uploading File...")
        files = {'file': ('test.txt', b'Hello World Content', 'text/plain')}
        res = await client.post("/api/v1/support/tickets/upload", files=files)
        assert res.status_code == 200, f"Upload failed: {res.text}"
        upload_data = res.json()
        file_url = upload_data["url"]
        logger.info(f"    -> File uploaded: {file_url}")
        
        # 2. Create Ticket with Attachment
        logger.info("[2] Creating Ticket with Attachment...")
        create_payload = {
            "subject": "Missing Charts",
            "category": "issue",
            "message": "See attached screenshot.",
            "priority": "normal",
            "attachments": [file_url]
        }
        res = await client.post("/api/v1/support/tickets", json=create_payload)
        assert res.status_code == 200
        ticket_data = res.json()
        
        # Verify attachments in response
        msg = ticket_data["messages"][0]
        assert len(msg["attachments"]) == 1
        assert msg["attachments"][0] == file_url
        logger.info("    -> Ticket created with attachment verified")
        
        # 3. Retrieve Ticket and verify attachments persistence
        logger.info("[3] Retrieving Ticket...")
        res = await client.get(f"/api/v1/support/tickets/{ticket_data['id']}")
        assert res.status_code == 200
        data = res.json()
        assert data["messages"][0]["attachments"][0] == file_url
        logger.info("    -> Persistence verified")

    logger.info("SUCCESS: Upload Verification Passed!")

if __name__ == "__main__":
    asyncio.run(run_verification())
