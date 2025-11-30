from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Optional, List
import secrets
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file (searching parent directories)
load_dotenv(find_dotenv())

class Settings(BaseSettings):
    PROJECT_NAME: str = "Stockify"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"  # Docker internal network
    KAFKA_COMPRESSION_TYPE: str = "gzip"  # Using gzip (no extra deps needed)
    KAFKA_TOPIC_MARKET_RAW: str = "market.raw"
    KAFKA_TOPIC_ENRICHED: str = "market.enriched"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE: int = 3600

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # Auth - FIXED: SECRET_KEY must come from environment in production
    SECRET_KEY: str = Field(
        default_factory=lambda: os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Dhan API - FIXED: Removed hardcoded token
    DHAN_CLIENT_ID: Optional[str] = None
    DHAN_ACCESS_TOKEN: Optional[str] = None  # MUST be loaded from environment
    
    # Monitoring
    METRICS_PORT: int = 9090
    PROMETHEUS_URL: str = "http://prometheus:9090"
    
    # Security
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # Performance
    SLOW_QUERY_THRESHOLD_MS: int = 1000  # Log queries slower than 1s
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URL: Optional[str] = None  # Redis URL for distributed rate limiting
    
    # WebSocket
    MAX_WEBSOCKET_CONNECTIONS_PER_USER: int = 10
    
    # Admin
    DEFAULT_ADMIN_PASSWORD: str = "ChangeMe123!"
    
    # SMTP Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "alerts@stockify.local"
    SMTP_USE_TLS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"
    
    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v, info):
        """Ensure SECRET_KEY is strong enough for production"""
        if info.data.get('ENVIRONMENT') == 'production':
            if len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
        return v

@lru_cache()
def get_settings():
    """Get cached settings instance"""
    settings = Settings()
    
    # Validate required fields in production
    if settings.ENVIRONMENT == "production":
        if not settings.DHAN_CLIENT_ID or not settings.DHAN_ACCESS_TOKEN:
            raise ValueError(
                "DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN must be set in production. "
                "Never hardcode credentials in source code."
            )
        
        # Ensure SECRET_KEY comes from environment
        if "SECRET_KEY" not in os.environ:
            raise ValueError(
                "SECRET_KEY must be set via environment variable in production. "
                "Do not rely on auto-generated keys."
            )
    
    return settings

# Export settings instance for easy import
settings = get_settings()
