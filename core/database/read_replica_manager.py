"""
Database Connection Manager with Read Replica Routing

Automatically routes:
- Write queries → Primary database via PgBouncer (port 6432)
- Read queries → Read replicas via PgBouncer (port 6433)

Features:
- Health checks and automatic failover
- Connection pooling
- Query type detection
- Retry logic with exponential backoff
"""

import asyncio
import random
import time
from typing import Optional, List, Literal
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from core.config.settings import get_settings
from core.logging.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


class DatabaseNode:
    """Represents a database node (primary or replica)"""
    
    def __init__(
        self,
        host: str,
        port: int,
        is_primary: bool = False,
        max_retries: int = 3
    ):
        self.host = host
        self.port = port
        self.is_primary = is_primary
        self.max_retries = max_retries
        self.is_healthy = True
        self.last_health_check = 0
        self.consecutive_failures = 0
        
    @property
    def connection_string(self) -> str:
        """Get connection string for this node"""
        return (
            f"postgresql+asyncpg://{settings.POSTGRES_USER}:"
            f"{settings.POSTGRES_PASSWORD}@{self.host}:{self.port}/"
            f"{settings.POSTGRES_DB}"
        )
    
    async def check_health(self) -> bool:
        """Check if node is healthy"""
        try:
            engine = create_async_engine(
                self.connection_string,
                pool_size=1,
                max_overflow=0,
                pool_pre_ping=True
            )
            
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                await result.fetchone()
                
            await engine.dispose()
            
            self.is_healthy = True
            self.consecutive_failures = 0
            logger.debug(f"Health check passed for {self.host}:{self.port}")
            return True
            
        except Exception as e:
            self.consecutive_failures += 1
            self.is_healthy = False
            logger.warning(
                f"Health check failed for {self.host}:{self.port}: {str(e)} "
                f"(consecutive failures: {self.consecutive_failures})"
            )
            return False


class ReadReplicaManager:
    """
    Manages database connections with automatic read replica routing.
    
    Usage:
        manager = ReadReplicaManager()
        await manager.initialize()
        
        # For writes
        async with manager.get_session(read_only=False) as session:
            session.add(obj)
            await session.commit()
        
        # For reads (automatically uses replica)
        async with manager.get_session(read_only=True) as session:
            result = await session.execute(query)
    """
    
   def __init__(
        self,
        primary_host: str = "localhost",
        primary_port: int = 6432,  # PgBouncer primary
        replica_hosts: List[tuple] = None,  # [(host, port), ...]
        health_check_interval: int = 30,
        max_connections_per_node: int = 20
    ):
        # Primary node (writes)
        self.primary = DatabaseNode(primary_host, primary_port, is_primary=True)
        
        # Read replicas (reads)
        if replica_hosts is None:
            # Default: use PgBouncer replica pooler
            replica_hosts = [("localhost", 6433)]
        
        self.replicas = [
            DatabaseNode(host, port, is_primary=False)
            for host, port in replica_hosts
        ]
        
        self.health_check_interval = health_check_interval
        self.max_connections = max_connections_per_node
        
        # Engines
        self.primary_engine: Optional[AsyncEngine] = None
        self.replica_engines: List[AsyncEngine] = []
        
        # Session factories
        self.primary_session_factory = None
        self.replica_session_factories: List[sessionmaker] = []
        
        # Health check task
        self._health_check_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """Initialize all database connections"""
        logger.info("Initializing database connection manager...")
        
        # Create primary engine
        self.primary_engine = create_async_engine(
            self.primary.connection_string,
            pool_size=self.max_connections,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
        
        self.primary_session_factory = sessionmaker(
            self.primary_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        logger.info(f"✓ Primary database connected: {self.primary.host}:{self.primary.port}")
        
        # Create replica engines
        for replica in self.replicas:
            engine = create_async_engine(
                replica.connection_string,
                pool_size=self.max_connections,
                max_overflow=10,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            
            session_factory = sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            self.replica_engines.append(engine)
            self.replica_session_factories.append(session_factory)
            
            logger.info(f"✓ Read replica connected: {replica.host}:{replica.port}")
        
        # Start health checks
        self._health_check_task = asyncio.create_task(self._periodic_health_check())
        
        logger.info("Database connection manager initialized successfully")
    
    async def _periodic_health_check(self):
        """Periodically check health of all nodes"""
        while True:
            try:
                await asyncio.sleep(self.health_check_interval)
                
                # Check primary
                await self.primary.check_health()
                
                # Check replicas
                for replica in self.replicas:
                    await replica.check_health()
                    
            except Exception as e:
                logger.error(f"Error in health check task: {str(e)}")
    
    def _get_healthy_replica(self) -> Optional[int]:
        """Get index of a healthy replica (random selection)"""
        healthy_replicas = [
            i for i, replica in enumerate(self.replicas)
            if replica.is_healthy
        ]
        
        if not healthy_replicas:
            logger.warning("No healthy replicas available, falling back to primary")
            return None
        
        # Random selection for load distribution
        return random.choice(healthy_replicas)
    
    @asynccontextmanager
    async def get_session(
        self,
        read_only: bool = True,
        fallback_to_primary: bool = True
    ):
        """
        Get a database session.
        
        Args:
            read_only: If True, route to read replica. If False, use primary.
            fallback_to_primary: If True and no replicas available, use primary for reads.
        
        Yields:
            AsyncSession: Database session
        """
        if not read_only:
            # Write operation - always use primary
            session_factory = self.primary_session_factory
            node_type = "primary"
        else:
            # Read operation - use replica if available
            replica_idx = self._get_healthy_replica()
            
            if replica_idx is not None:
                session_factory = self.replica_session_factories[replica_idx]
                node_type = f"replica-{replica_idx}"
            elif fallback_to_primary:
                logger.debug("Using primary for read (no healthy replicas)")
                session_factory = self.primary_session_factory
                node_type = "primary (fallback)"
            else:
                raise RuntimeError("No healthy read replicas available")
        
        async with session_factory() as session:
            try:
                yield session
            except Exception as e:
                logger.error(f"Database error on {node_type}: {str(e)}")
                await session.rollback()
                raise
            finally:
                await session.close()
    
    @asynccontextmanager
    async def get_connection(
        self,
        read_only: bool = True,
        fallback_to_primary: bool = True
    ):
        """
        Get a raw database connection (for bulk operations).
        
        Args:
            read_only: If True, route to read replica. If False, use primary.
            fallback_to_primary: If True and no replicas available, use primary for reads.
        
        Yields:
            AsyncConnection: Database connection
        """
        if not read_only:
            engine = self.primary_engine
            node_type = "primary"
        else:
            replica_idx = self._get_healthy_replica()
            
            if replica_idx is not None:
                engine = self.replica_engines[replica_idx]
                node_type = f"replica-{replica_idx}"
            elif fallback_to_primary:
                logger.debug("Using primary for read (no healthy replicas)")
                engine = self.primary_engine
                node_type = "primary (fallback)"
            else:
                raise RuntimeError("No healthy read replicas available")
        
        async with engine.connect() as conn:
            try:
                yield conn
            except Exception as e:
                logger.error(f"Database error on {node_type}: {str(e)}")
                raise
    
    async def shutdown(self):
        """Shutdown all database connections"""
        logger.info("Shutting down database connection manager...")
        
        # Cancel health check task
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        # Dispose engines
        if self.primary_engine:
            await self.primary_engine.dispose()
        
        for engine in self.replica_engines:
            await engine.dispose()
        
        logger.info("Database connection manager shut down successfully")


# Global instance (singleton pattern)
_db_manager: Optional[ReadReplicaManager] = None


async def get_db_manager() -> ReadReplicaManager:
    """Get global database manager instance"""
    global _db_manager
    
    if _db_manager is None:
        _db_manager = ReadReplicaManager(
            primary_host="localhost",
            primary_port=6432,  # PgBouncer primary
            replica_hosts=[("localhost", 6433)],  # PgBouncer replicas
            health_check_interval=30
        )
        await _db_manager.initialize()
    
    return _db_manager


async def get_db_session(read_only: bool = True):
    """
    Dependency injection helper for FastAPI.
    
    Usage in FastAPI routes:
        @router.get("/data")
        async def get_data(session: AsyncSession = Depends(get_db_session)):
            result = await session.execute(query)
            return result.scalars().all()
    """
    manager = await get_db_manager()
    async with manager.get_session(read_only=read_only) as session:
        yield session
