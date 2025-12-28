"""
Application Settings - Centralized configuration management using Pydantic Settings
All environment variables and configuration are managed here.
"""
from functools import lru_cache
from typing import List, Optional, Any
from pydantic import Field, field_validator, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # Application Settings
    # ═══════════════════════════════════════════════════════════════════
    APP_NAME: str = "Stockify Trading Platform"
    APP_VERSION: str = "2.0.0"
    APP_ENV: str = Field(default="development", description="development, staging, production")
    DEBUG: bool = Field(default=False, description="Debug mode - set to True in .env for development")
    
    # ═══════════════════════════════════════════════════════════════════
    # Server Settings
    # ═══════════════════════════════════════════════════════════════════
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    WORKERS: int = Field(default=1)
    
    # ═══════════════════════════════════════════════════════════════════
    # Security Settings
    # ═══════════════════════════════════════════════════════════════════
    SECRET_KEY: str = Field(..., description="Secret key for token signing - MUST be set in environment")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)  # 24 hours
    ALGORITHM: str = Field(default="HS256")
    
    # ═══════════════════════════════════════════════════════════════════
    # CORS Settings
    # ═══════════════════════════════════════════════════════════════════
    CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "https://stockify-oc.vercel.app",
            "https://main.dtruazmd8dsaa.amplifyapp.com",
        ]
    )
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # ═══════════════════════════════════════════════════════════════════
    # Database Settings (PostgreSQL)
    # ═══════════════════════════════════════════════════════════════════
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/stockify",
        description="PostgreSQL connection URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=100, description="Base connection pool size (increased for million-user scale)")
    DATABASE_MAX_OVERFLOW: int = Field(default=200, description="Maximum additional connections under load (doubled for scale)")
    DATABASE_POOL_TIMEOUT: int = Field(default=30)
    DATABASE_ECHO: bool = Field(default=False, description="Log SQL queries")
    DATABASE_READ_REPLICA_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL read replica URL for read-heavy queries (optional)"
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # Redis Settings
    # ═══════════════════════════════════════════════════════════════════
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_CACHE_TTL: int = Field(default=300, description="Default cache TTL in seconds")
    REDIS_POOL_MAX_SIZE: int = Field(default=500, description="Max Redis connections per pod (increased for scale)")
    REDIS_OPTIONS_CACHE_TTL: int = Field(default=0, description="Options data cache TTL (0 = no cache for real-time, bypasses stale data)")
    REDIS_EXPIRY_CACHE_TTL: int = Field(default=3600, description="Expiry dates cache TTL")
    REDIS_CONFIG_CACHE_TTL: int = Field(default=3600, description="Config cache TTL")
    
    # ═══════════════════════════════════════════════════════════════════
    # Firebase Settings
    # ═══════════════════════════════════════════════════════════════════
    FIREBASE_CREDENTIALS_PATH: str = Field(
        default="credentials/firebase_credentials.json",
        description="Path to Firebase service account credentials"
    )
    FIREBASE_CREDENTIALS_JSON: Optional[str] = Field(
        default=None,
        description="Firebase credentials as JSON string (overrides path if set)"
    )
    FIREBASE_PROJECT_ID: Optional[str] = None
    
    # ═══════════════════════════════════════════════════════════════════
    # Dhan API Settings (Defaults - can be overridden from Admin UI)
    # ═══════════════════════════════════════════════════════════════════
    DHAN_API_BASE_URL: str = Field(default="https://scanx.dhan.co/scanx")
    DHAN_OPTIONS_CHAIN_ENDPOINT: str = Field(default="/optchain")
    DHAN_SPOT_ENDPOINT: str = Field(default="/rtscrdt")
    DHAN_FUTURES_ENDPOINT: str = Field(default="/futoptsum")
    DHAN_API_TIMEOUT: int = Field(default=5, description="API timeout in seconds (reduced for real-time)")
    DHAN_API_RETRY_COUNT: int = Field(default=1, description="Single retry for faster failover")
    DHAN_API_RETRY_DELAY: float = Field(default=0.2, description="Retry delay in seconds (minimal for speed)")
    DHAN_AUTH_TOKEN: Optional[str] = Field(default=None, description="Dhan API Auth Token")
    
    # ═══════════════════════════════════════════════════════════════════
    # HFT Engine Integration
    # ═══════════════════════════════════════════════════════════════════
    USE_HFT_DATA_SOURCE: bool = Field(
        default=False, 
        description="Use HFT Engine as data source instead of direct Dhan API"
    )
    HFT_REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="HFT Engine's Redis URL for consuming enriched data"
    )
    HFT_KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:9092",
        description="HFT Engine's Kafka servers for direct stream consumption"
    )
    HFT_USE_GREEKS: bool = Field(
        default=True,
        description="Use pre-calculated Greeks from HFT Engine (faster) vs recalculate locally"
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # Rate Limiting
    # ═══════════════════════════════════════════════════════════════════
    RATE_LIMIT_PER_MINUTE: int = Field(default=200, description="API rate limit (increased for scale)")
    RATE_LIMIT_BURST: int = Field(default=50, description="Burst limit (increased)")
    
    # ═══════════════════════════════════════════════════════════════════
    # WebSocket Settings
    # ═══════════════════════════════════════════════════════════════════
    WS_HEARTBEAT_INTERVAL: int = Field(default=30)
    WS_MAX_CONNECTIONS: int = Field(default=50000, description="Max WebSocket connections per server (increased for scale)")
    WS_BROADCAST_INTERVAL: float = Field(default=0.25, description="Live data broadcast interval (250ms for faster updates)")
    WS_CHARTS_BROADCAST_INTERVAL: float = Field(default=0.25, description="Charts data broadcast interval (250ms for real-time)")
    
    # ═══════════════════════════════════════════════════════════════════
    # Trading Defaults
    # ═══════════════════════════════════════════════════════════════════
    DEFAULT_RISK_FREE_RATE: float = Field(default=0.10, description="Risk-free rate for BSM")
    DEFAULT_SYMBOL: str = Field(default="NIFTY")
    
    # ═══════════════════════════════════════════════════════════════════
    # Logging
    # ═══════════════════════════════════════════════════════════════════
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FORMAT: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # OpenTelemetry Settings (Distributed Tracing)
    # ═══════════════════════════════════════════════════════════════════
    OTEL_ENABLED: bool = Field(default=True, description="Enable OpenTelemetry tracing")
    OTEL_SERVICE_NAME: str = Field(default="stockify-backend", description="Service name for tracing")
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = Field(
        default=None,
        description="OTLP endpoint (e.g., http://jaeger:4317). If None, console exporter in debug mode."
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # Background Task Queue Settings
    # ═══════════════════════════════════════════════════════════════════
    TASK_QUEUE_ENABLED: bool = Field(default=True, description="Enable background task processing")
    TASK_QUEUE_WORKERS: int = Field(default=2, description="Number of background task workers")
    
    # ═══════════════════════════════════════════════════════════════════
    # File Upload
    # ═══════════════════════════════════════════════════════════════════
    UPLOAD_DIR: str = Field(default="uploads")
    MAX_UPLOAD_SIZE: int = Field(default=16 * 1024 * 1024, description="16MB")
    
    # ═══════════════════════════════════════════════════════════════════
    # Fallback Configuration Values
    # ═══════════════════════════════════════════════════════════════════
    _fallbacks: dict = {
        "DHAN_API_BASE_URL": "https://scanx.dhan.co/scanx",
        "CACHE_TTL": "300",
        "RATE_LIMIT": "100",
        "WS_INTERVAL": "1.0",
    }
    
    def get_fallback(self, key: str) -> Optional[str]:
        """Get fallback value for a configuration key"""
        return self._fallbacks.get(key)
    
    @field_validator("APP_ENV")
    @classmethod
    def validate_env(cls, v: str) -> str:
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}")
        return v
    
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"
    
    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
