import pytest
from fastapi.testclient import TestClient
from services.gateway.main import app
from services.gateway.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware

@pytest.fixture
def client():
    return TestClient(app)

def test_request_logging_middleware_adds_headers(client):
    """Test that request logging middleware adds correlation ID and process time"""
    response = client.get("/health")
    
    assert "x-correlation-id" in response.headers
    assert "x-process-time" in response.headers
    assert response.headers["x-correlation-id"] != ""

def test_security_headers_middleware(client):
    """Test that security headers are added to all responses"""
    response = client.get("/health")
    
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-xss-protection"] == "1; mode=block"
    assert "strict-transport-security" in response.headers

def test_correlation_id_unique_per_request(client):
    """Test that each request gets a unique correlation ID"""
    response1 = client.get("/health")
    response2 = client.get("/health")
    
    corr_id_1 = response1.headers["x-correlation-id"]
    corr_id_2 = response2.headers["x-correlation-id"]
    
    assert corr_id_1 != corr_id_2

def test_process_time_header_present(client):
    """Test that process time is measured and included"""
    response = client.get("/health")
    
    process_time = float(response.headers["x-process-time"])
    assert process_time >= 0
    assert process_time < 10000  # Should be less than 10 seconds

def test_middleware_on_error_endpoints(client):
    """Test middleware works on error responses too"""
    response = client.get("/nonexistent")
    
    assert "x-correlation-id" in response.headers
    assert "x-content-type-options" in response.headers
