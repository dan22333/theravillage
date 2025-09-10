import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from contextlib import asynccontextmanager
import logging

# Database configuration (same pattern as API service)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://tv_admin:TheraVillage2024!@tv-postgres:5432/theravillage")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Pool configuration (same as API service)
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))         # Smaller pool for scraper
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "5"))   # Smaller overflow for scraper
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600")) # 1 hour (longer for scraper jobs)
POOL_PRE_PING = True

logger = logging.getLogger(__name__)

# Create async engine (same pattern as API service)
engine = create_async_engine(
    DATABASE_URL,
    echo=LOG_LEVEL == "DEBUG",
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_recycle=POOL_RECYCLE,
    pool_pre_ping=POOL_PRE_PING,
    future=True,
)

# Create session maker
async_session_maker = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

async def init_db():
    """Initialize database connection and ensure extensions are installed"""
    try:
        async with engine.begin() as conn:
            # Check if pgvector extension is installed
            result = await conn.execute(
                text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            )
            if not result.fetchone():
                logger.info("Installing pgvector extension...")
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                logger.info("✅ pgvector extension installed")
            
            # Test basic connectivity
            await conn.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
            
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise

@asynccontextmanager
async def get_db():
    """Get database session with proper cleanup"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

async def get_db_session():
    """Get database session for dependency injection"""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise
        finally:
            await session.close()

async def execute_raw_sql(query: str, params: dict = None):
    """Execute raw SQL query"""
    async with get_db() as db:
        result = await db.execute(text(query), params or {})
        return result

async def fetch_one(query: str, params: dict = None):
    """Fetch single row from database"""
    async with get_db() as db:
        result = await db.execute(text(query), params or {})
        return result.fetchone()

async def fetch_all(query: str, params: dict = None):
    """Fetch all rows from database"""
    async with get_db() as db:
        result = await db.execute(text(query), params or {})
        return result.fetchall()

# Health check function
async def check_db_health():
    """Check database health"""
    try:
        async with get_db() as db:
            result = await db.execute(text("SELECT 1 as health_check"))
            row = result.fetchone()
            return row[0] == 1 if row else False
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
