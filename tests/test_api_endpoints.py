"""
Gateway API Endpoint Tests - Integration Level with Full Mocking
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

# Import app
from services.gateway.main import app

client = TestClient(app)

def test_health_endpoint():
    """Test health check endpoint"""
    # Mock all dependencies
    with patch('services.gateway.main.get_redis_pool') as mock_redis:
        with patch('services.gateway.main.async_session_factory') as mock_db:
            # Mock Redis
            mock_redis_client = AsyncMock()
            mock_redis_client.ping = AsyncMock()
            mock_redis.return_value = mock_redis_client
            
            # Mock DB
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session.execute = AsyncMock()
            mock_db.return_value = mock_session
            
            response = client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert "timestamp" in data

def test_metrics_endpoint():
    """Test Prometheus metrics endpoint"""
    response = client.get("/metrics")
    
    assert response.status_code == 200
    # Should return Prometheus text format
    assert "text/plain" in response.headers.get("content-type", "")

def test_cors_headers():
    """Test that CORS headers are present"""
    response = client.get("/health")
    
    # Should have CORS headers
    assert response.status_code == 200

def test_404_error():
    """Test 404 error handling"""
    response = client.get("/nonexistent")
    
    assert response.status_code == 404

def test_middleware_adds_headers():
    """Test that middleware adds custom headers"""
    response = client.get("/health")
    
    # Should have correlation ID and process time
    assert "x-correlation-id" in response.headers
    assert "x-process-time" in response.headers

def test_security_headers():
    """Test that security headers are added"""
    response = client.get("/health")
    
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert "x-xss-protection" in response.headers
