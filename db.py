import asyncio
import aiomysql
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from config import DATABASE_URL
import logging
from models import Base

logger = logging.getLogger(__name__)

# Create the async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True
)

# Create async session maker
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    """Dependency to get a database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_database():
    """Create database and tables."""
    conn = None
    try:
        # Parse the database URL
        parts = DATABASE_URL.replace("mysql+aiomysql://", "").split("@")
        auth = parts[0].split(":")
        host_port = parts[1].split("/")[0].split(":")
        dbname = parts[1].split("/")[1].split("?")[0]
        
        user = auth[0]
        password = auth[1].replace("%40", "@")
        host = host_port[0]
        port = int(host_port[1]) if len(host_port) > 1 else 3306

        # Create initial connection
        conn = await aiomysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4'
        )
        
        try:
            async with conn.cursor() as cur:
                await cur.execute(f"CREATE DATABASE IF NOT EXISTS {dbname}")
                logger.info(f"Database {dbname} exists or was created")
                await cur.execute(f"USE {dbname}")
        finally:
            if conn:
                conn.close()  # Regular close is sufficient for aiomysql

        # Create tables using SQLAlchemy
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Tables created successfully")

    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        raise

async def init_db():
    """Initialize database and tables."""
    await create_database()

async def get_session():
    """Get a database session."""
    return async_session()
