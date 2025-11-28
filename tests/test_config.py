"""
Fixed configuration tests to match new settings structure
"""
import pytest
import os
from core.config.settings import Settings, get_settings


def test_password_hashing():
    """Test password hashing works from auth module"""
    from services.gateway.auth import get_password_hash, verify_password
    
    password = "test123"
    hashed = get_password_hash(password)
    
    assert hashed != password
    assert verify_password(password, hashed)


def test_settings_validation():
    """Test that settings validates properly"""
    # Create settings without environment
    settings = Settings()
    
    assert settings.PROJECT_NAME == "Stockify"
    assert settings.ENVIRONMENT == "development"
    assert settings.KAFKA_COMPRESSION_TYPE == "lz4"
    assert settings.DB_POOL_SIZE == 20


def test_settings_database_config():
    """Test database configuration"""
    settings = Settings()
    
    assert settings.DB_POOL_SIZE == 20
    assert settings.DB_MAX_OVERFLOW == 10
    assert settings.DB_POOL_PRE_PING == True
    assert settings.DB_POOL_RECYCLE == 3600


def test_settings_kafka_compression():
    """Test Kafka compression is enabled"""
    settings = Settings()
    
    assert settings.KAFKA_COMPRESSION_TYPE == "lz4"


def test_settings_security():
    """Test security settings"""
    settings = Settings()
    
    assert settings.MAX_WEBSOCKET_CONNECTIONS_PER_USER == 10
    assert settings.SLOW_QUERY_THRESHOLD_MS == 1000
    assert settings.RATE_LIMIT_ENABLED == True


def test_settings_redis():
    """Test Redis configuration"""
    settings = Settings()
    
    assert settings.REDIS_MAX_CONNECTIONS == 50


def test_secret_key_length():
    """Test SECRET_KEY is long enough"""
    settings = Settings()
    
    # In development, auto-generated key should be 32+ chars
    assert len(settings.SECRET_KEY) >= 32


def test_settings_caching():
    """Test settings are cached"""
    settings1 = get_settings()
    settings2 = get_settings()
    
    # Should be the same object (cached)
    assert settings1 is settings2
