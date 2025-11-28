"""
Comprehensive Authentication Tests - Unit Level with Full Isolation
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from services.gateway.auth import (
    verify_password,
    get_password_hash,
    create_access_token
)
from datetime import timedelta

def test_password_hashing():
    """Test password hashing and verification"""
    password = "test_password_123"
    hashed = get_password_hash(password)
    
    # Should not be plaintext
    assert hashed != password
    # Should be bcrypt format
    assert hashed.startswith("$2b$")
    # Should verify correctly
    assert verify_password(password, hashed)
    # Should fail for wrong password
    assert not verify_password("wrong_password", hashed)

def test_create_access_token():
    """Test JWT token creation"""
    data = {"sub": "testuser"}
    token = create_access_token(data)
    
    # Token should be a string
    assert isinstance(token, str)
    # Should have JWT format (3 parts separated by dots)
    assert len(token.split(".")) == 3

def test_create_access_token_with_expiry():
    """Test JWT token creation with custom expiry"""
    data = {"sub": "testuser"}
    expires_delta = timedelta(minutes=15)
    token = create_access_token(data, expires_delta)
    
    assert isinstance(token, str)
    assert len(token.split(".")) == 3

@pytest.mark.asyncio
async def test_authenticate_user_success():
    """Test successful user authentication"""
    from services.gateway.auth import authenticate_user
    
    # Mock database session and user
    with patch('services.gateway.auth.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        # Create mock user
        from core.database.models import UserDB
        mock_user = UserDB(
            id=1,
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("testpass123")
        )
        
        # Mock query result
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = AsyncMock(return_value=mock_user)
        mock_session.execute = AsyncMock(return_value=mock_result)
        
        mock_factory.return_value = mock_session
        
        # Authenticate
        user = await authenticate_user("testuser", "testpass123")
        
        assert user is not None
        assert user.username == "testuser"

@pytest.mark.asyncio
async def test_authenticate_user_wrong_password():
    """Test authentication with wrong password"""
    from services.gateway.auth import authenticate_user
    
    with patch('services.gateway.auth.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        from core.database.models import UserDB
        mock_user = UserDB(
            id=1,
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("correctpass")
        )
        
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = AsyncMock(return_value=mock_user)
        mock_session.execute = AsyncMock(return_value=mock_result)
        
        mock_factory.return_value = mock_session
        
        # Try with wrong password
        user = await authenticate_user("testuser", "wrongpass")
        
        assert user is None

@pytest.mark.asyncio
async def test_authenticate_user_not_found():
    """Test authentication with non-existent user"""
    from services.gateway.auth import authenticate_user
    
    with patch('services.gateway.auth.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        # No user found
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = AsyncMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_result)
        
        mock_factory.return_value = mock_session
        
        user = await authenticate_user("nonexistent", "anypass")
        
        assert user is None
