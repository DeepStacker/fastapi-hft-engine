"""
User Authentication Service Tests

Comprehensive test suite for authentication, preferences, and watchlists.
"""

import pytest
from httpx import AsyncClient
import asyncio

# Mock Firebase token for testing
MOCK_FIREBASE_TOKEN = "mock_firebase_token_123"


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check endpoint."""
    from services.user_auth.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "user-auth"


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint returns API info."""
    from services.user_auth.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "User Authentication Service"
    assert "endpoints" in data
    assert "auth" in data["endpoints"]


@pytest.mark.asyncio
async def test_jwt_token_creation():
    """Test JWT token creation and verification."""
    from services.user_auth.jwt_handler import jwt_handler
    
    # Create access token
    token_data = {
        "user_id": 1,
        "firebase_uid": "test_uid",
        "email": "test@example.com",
        "tier": "free"
    }
    
    access_token = jwt_handler.create_access_token(token_data)
    assert access_token is not None
    assert isinstance(access_token, str)
    
    # Verify token
    payload = jwt_handler.verify_token(access_token, token_type="access")
    assert payload is not None
    assert payload["user_id"] == 1
    assert payload["email"] == "test@example.com"
    assert payload["type"] == "access"


@pytest.mark.asyncio
async def test_refresh_token_creation():
    """Test refresh token creation."""
    from services.user_auth.jwt_handler import jwt_handler
    
    token_data = {"user_id": 1}
    refresh_token = jwt_handler.create_refresh_token(token_data)
    
    assert refresh_token is not None
    
    # Verify it's a refresh token
    payload = jwt_handler.verify_token(refresh_token, token_type="refresh")
    assert payload is not None
    assert payload["type"] == "refresh"


@pytest.mark.asyncio
async def test_password_hashing():
    """Test password hashing and verification."""
    from services.user_auth.jwt_handler import jwt_handler
    
    plain_password = "SecurePassword123!"
    hashed = jwt_handler.hash_password(plain_password)
    
    assert hashed != plain_password
    assert jwt_handler.verify_password(plain_password, hashed) is True
    assert jwt_handler.verify_password("WrongPassword", hashed) is False


@pytest.mark.asyncio  
async def test_pcr_calculation():
    """Test PCR calculation helper function."""
    from services.api_gateway.routers.public_api import _calculate_pcr
    
    # Normal case
    pcr = _calculate_pcr(1200, 1000)
    assert pcr == 1.2
    
    # Zero call value
    pcr_none = _calculate_pcr(1000, 0)
    assert pcr_none is None
    
    # Both zero
    pcr_zero = _calculate_pcr(0, 0)
    assert pcr_zero is None


@pytest.mark.asyncio
async def test_option_data_formatting():
    """Test option data formatting helper."""
    from services.user_auth.routers.public_api import _format_option_data
    
    raw_data = {
        "ltp": 125.50,
        "oi": 500000,
        "oi_change": 50000,
        "volume": 10000,
        "iv": 16.2,
        "delta": 0.52,
        "extra_field": "should be ignored"
    }
    
    formatted = _format_option_data(raw_data)
    
    assert formatted["ltp"] == 125.50
    assert formatted["oi"] == 500000
    assert formatted["delta"] == 0.52
    assert "extra_field" not in formatted
    assert formatted["gamma"] == 0  # Default value


# Integration tests (require database)
@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_model_creation(test_db):
    """Test user model creation in database."""
    from services.user_auth.models import User, UserPreferences
    
    user = User(
        firebase_uid="test_firebase_uid_123",
        email="testuser@example.com",
        display_name="Test User",
        subscription_tier="free"
    )
    
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    
    assert user.id is not None
    assert user.email == "testuser@example.com"
    assert user.subscription_tier == "free"
    assert user.is_active is True


@pytest.mark.integration
@pytest.mark.asyncio
async def test_watchlist_creation(test_db, test_user):
    """Test watchlist creation with items."""
    from services.user_auth.models import Watchlist, WatchlistItem
    
    watchlist = Watchlist(
        user_id=test_user.id,
        name="My Test Watchlist",
        is_default=True
    )
    
    test_db.add(watchlist)
    await test_db.commit()
    await test_db.refresh(watchlist)
    
    # Add items
    item1 = WatchlistItem(watchlist_id=watchlist.id, symbol_id=13)  # NIFTY
    item2 = WatchlistItem(watchlist_id=watchlist.id, symbol_id=26)  # BANKNIFTY
    
    test_db.add_all([item1, item2])
    await test_db.commit()
    
    assert watchlist.id is not None
    assert watchlist.name == "My Test Watchlist"
    assert len(watchlist.items) == 2


# Fixtures
@pytest.fixture
async def test_db():
    """Provide test database session."""
    from core.database.connection import async_session_factory
    
    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def test_user(test_db):
    """Create a test user."""
    from services.user_auth.models import User
    
    user = User(
        firebase_uid="test_uid_fixture",
        email="fixture@test.com",
        display_name="Fixture User",
        subscription_tier="free"
    )
    
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    
    return user


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
