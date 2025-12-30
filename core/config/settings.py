from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Optional, List
import secrets
import os
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env file (searching parent directories)
load_dotenv(find_dotenv())

class Settings(BaseSettings):
    """
    Unified Settings for all services.
    Consolidates core + ocd-backend configurations.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # ═══════════════════════════════════════════════════════════════════
    # Application Settings
    # ═══════════════════════════════════════════════════════════════════
    PROJECT_NAME: str = "Stockify"
    APP_NAME: str = "Stockify Trading Platform"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    APP_ENV: str = Field(default="development", description="development, staging, production")
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # ═══════════════════════════════════════════════════════════════════
    # Server Settings
    # ═══════════════════════════════════════════════════════════════════
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # ═══════════════════════════════════════════════════════════════════
    # Kafka Settings
    # ═══════════════════════════════════════════════════════════════════
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"
    KAFKA_COMPRESSION_TYPE: str = "gzip"
    KAFKA_TOPIC_MARKET_RAW: str = "market.raw"
    KAFKA_TOPIC_ENRICHED: str = "market.enriched"

    # ═══════════════════════════════════════════════════════════════════
    # Database Settings (PostgreSQL)
    # ═══════════════════════════════════════════════════════════════════
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/stockify"
    DB_POOL_SIZE: int = 20
    DATABASE_POOL_SIZE: int = Field(default=100, description="Base connection pool size")
    DB_MAX_OVERFLOW: int = 10
    DATABASE_MAX_OVERFLOW: int = Field(default=200, description="Max additional connections")
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE: int = 3600
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_ECHO: bool = False
    DATABASE_READ_REPLICA_URL: Optional[str] = None

    # ═══════════════════════════════════════════════════════════════════
    # Redis Settings
    # ═══════════════════════════════════════════════════════════════════
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_POOL_MAX_SIZE: int = 500
    REDIS_CACHE_TTL: int = 300
    REDIS_OPTIONS_CACHE_TTL: int = 0
    REDIS_EXPIRY_CACHE_TTL: int = 3600
    REDIS_CONFIG_CACHE_TTL: int = 3600

    # ═══════════════════════════════════════════════════════════════════
    # Auth & Security Settings
    # ═══════════════════════════════════════════════════════════════════
    SECRET_KEY: str = Field(default="")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    AUTH_RATE_LIMIT_PER_MINUTE: int = 5
    TOKEN_RATE_LIMIT_PER_MINUTE: int = 10
    
    # ═══════════════════════════════════════════════════════════════════
    # CORS Settings
    # ═══════════════════════════════════════════════════════════════════
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"
    CORS_ORIGINS: List[str] = Field(default=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "https://stockify-oc.vercel.app",
    ])
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    # ═══════════════════════════════════════════════════════════════════
    # Firebase Settings
    # ═══════════════════════════════════════════════════════════════════
    FIREBASE_CREDENTIALS_PATH: str = "credentials/firebase_credentials.json"
    FIREBASE_CREDENTIALS_JSON: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = None

    # ═══════════════════════════════════════════════════════════════════
    # Dhan API Settings
    # ═══════════════════════════════════════════════════════════════════
    DHAN_CLIENT_ID: Optional[str] = None
    DHAN_ACCESS_TOKEN: Optional[str] = None
    DHAN_AUTH_TOKEN: Optional[str] = None
    DHAN_API_BASE_URL: str = "https://scanx.dhan.co/scanx"
    DHAN_OPTIONS_CHAIN_ENDPOINT: str = "/optchain"
    DHAN_SPOT_ENDPOINT: str = "/rtscrdt"
    DHAN_FUTURES_ENDPOINT: str = "/futoptsum"
    DHAN_API_TIMEOUT: int = 5
    DHAN_API_RETRY_COUNT: int = 1
    DHAN_API_RETRY_DELAY: float = 0.2

    # ═══════════════════════════════════════════════════════════════════
    # HFT Engine Integration
    # ═══════════════════════════════════════════════════════════════════
    USE_HFT_DATA_SOURCE: bool = False
    HFT_REDIS_URL: str = "redis://localhost:6379/0"
    HFT_KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    HFT_USE_GREEKS: bool = True

    # ═══════════════════════════════════════════════════════════════════
    # Rate Limiting
    # ═══════════════════════════════════════════════════════════════════
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URL: Optional[str] = None
    RATE_LIMIT_PER_MINUTE: int = 200
    RATE_LIMIT_BURST: int = 50

    # ═══════════════════════════════════════════════════════════════════
    # WebSocket Settings
    # ═══════════════════════════════════════════════════════════════════
    MAX_WEBSOCKET_CONNECTIONS_PER_USER: int = 10
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 50000
    WS_BROADCAST_INTERVAL: float = 0.25
    WS_CHARTS_BROADCAST_INTERVAL: float = 0.25

    # ═══════════════════════════════════════════════════════════════════
    # Trading Defaults
    # ═══════════════════════════════════════════════════════════════════
    DEFAULT_RISK_FREE_RATE: float = 0.10
    DEFAULT_SYMBOL: str = "NIFTY"

    # ═══════════════════════════════════════════════════════════════════
    # Monitoring & Observability
    # ═══════════════════════════════════════════════════════════════════
    METRICS_PORT: int = 9090
    PROMETHEUS_URL: str = "http://prometheus:9090"
    SLOW_QUERY_THRESHOLD_MS: int = 1000
    OTEL_ENABLED: bool = True
    OTEL_SERVICE_NAME: str = "stockify-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None

    # ═══════════════════════════════════════════════════════════════════
    # Background Tasks
    # ═══════════════════════════════════════════════════════════════════
    TASK_QUEUE_ENABLED: bool = True
    TASK_QUEUE_WORKERS: int = 2

    # ═══════════════════════════════════════════════════════════════════
    # SMTP Email Configuration
    # ═══════════════════════════════════════════════════════════════════
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "alerts@stockify.local"
    SMTP_USE_TLS: bool = True

    # ═══════════════════════════════════════════════════════════════════
    # File Upload
    # ═══════════════════════════════════════════════════════════════════
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 16 * 1024 * 1024  # 16MB
    
    # ═══════════════════════════════════════════════════════════════════
    # Fallbacks
    # ═══════════════════════════════════════════════════════════════════
    _fallbacks: dict = {
        "DHAN_API_BASE_URL": "https://scanx.dhan.co/scanx",
        "CACHE_TTL": "300",
        "RATE_LIMIT": "100",
        "WS_INTERVAL": "1.0",
    }
    
    def get_fallback(self, key: str) -> Optional[str]:
        return self._fallbacks.get(key)
    
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production" or self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development" or self.ENVIRONMENT == "development"

    # Note: model_config is defined at class level (line 18-23)
    # Do not use class Config with Pydantic V2
    
    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v, info):
        """Ensure SECRET_KEY is set and strong enough"""
        # Always require SECRET_KEY from environment
        if not v or v == "":
            # Try to get from environment directly
            v = os.getenv("SECRET_KEY", "")
            if not v:
                raise ValueError(
                    "SECRET_KEY must be set via environment variable. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
        
        # In production, enforce minimum length
        if info.data.get('ENVIRONMENT') == 'production':
            if len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production. "
                    "Current length: {}".format(len(v))
                )
        else:
            # Even in dev, require reasonable length
            if len(v) < 16:
                raise ValueError(
                    "SECRET_KEY must be at least 16 characters. "
                    "Current length: {}".format(len(v))
                )
        return v
    
    @field_validator('ALLOWED_ORIGINS')
    @classmethod
    def validate_allowed_origins(cls, v):
        """Ensure ALLOWED_ORIGINS doesn't contain wildcards in production"""
        if "*" in v and os.getenv("ENVIRONMENT") == "production":
            raise ValueError(
                "Wildcard CORS origins are not allowed in production. "
                "Specify exact origins: 'https://app.example.com,https://admin.example.com'"
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
