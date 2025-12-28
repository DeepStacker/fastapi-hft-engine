"""
Enhanced Connection Pool Manager

Centralized connection pool management with health monitoring.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.pool import NullPool, QueuePool
import structlog
from typing import Optional
from core.config.settings import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class ConnectionPoolManager:
    """
    Centralized database connection pool manager
    
    Features:
    - Connection pool health monitoring
    - Automatic pool recycling
    - Pre-ping for connection validation
    - Pool size optimization
    """
    
    def __init__(self):
        """Initialize pool manager"""
        self._engine: Optional[AsyncEngine] = None
        self._pool_stats = {
            "created": 0,
            "recycled": 0,
            "invalidated": 0
        }
        
    def create_engine(
        self,
        database_url: Optional[str] = None,
        pool_size: Optional[int] = None,
        max_overflow: Optional[int] = None,
        pool_pre_ping: bool = True,
        pool_recycle: int = 3600
    ) -> AsyncEngine:
        """
        Create database engine with optimized connection pool
        
        Args:
            database_url: Database connection URL
            pool_size: Number of connections to maintain
            max_overflow: Maximum overflow connections
            pool_pre_ping: Test connections before use
            pool_recycle: Recycle connections after N seconds
            
        Returns:
            Configured AsyncEngine
        """
        if self._engine:
            logger.warning("Engine already exists, returning existing")
            return self._engine
            
        url = database_url or settings.DATABASE_URL
        pool_size = pool_size or settings.DB_POOL_SIZE
        max_overflow = max_overflow or settings.DB_MAX_OVERFLOW
        
        # Create engine with QueuePool
        self._engine = create_async_engine(
            url,
            poolclass=QueuePool,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=pool_pre_ping,
            pool_recycle=pool_recycle,
            echo=False,  # Set True for SQL logging
            future=True
        )
        
        logger.info(
            "Database connection pool created",
            pool_size=pool_size,
            max_overflow=max_overflow,
            pre_ping=pool_pre_ping,
            recycle_seconds=pool_recycle
        )
        
        return self._engine
        
    async def get_pool_status(self) -> dict:
        """
        Get current pool status
        
        Returns:
            Pool statistics dictionary
        """
        if not self._engine:
            return {"status": "not_initialized"}
            
        pool = self._engine.pool
        
        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total_connections": pool.size() + pool.overflow(),
            "stats": self._pool_stats
        }
        
    async def dispose(self):
        """Close all connections and dispose pool"""
        if self._engine:
            await self._engine.dispose()
            logger.info("Connection pool disposed")
            self._engine = None
            
    def get_engine(self) -> Optional[AsyncEngine]:
        """Get current engine instance"""
        return self._engine


# Global pool manager
_pool_manager: Optional[ConnectionPoolManager] = None


def get_pool_manager() -> ConnectionPoolManager:
    """Get or create connection pool manager singleton"""
    global _pool_manager
    if _pool_manager is None:
        _pool_manager = ConnectionPoolManager()
    return _pool_manager
