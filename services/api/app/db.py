from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import os
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Ensure we're using the async driver
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    
    print(f"🔗 Database URL configured: {DATABASE_URL}")

POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))        # persistent conns per instance
MAX_OVER = int(os.getenv("DB_MAX_OVERFLOW", "10"))      # burst above pool_size
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))# seconds; avoid stale conns
POOL_PRE_PING = True

# Only create engine if DATABASE_URL is provided
if DATABASE_URL:
    try:
        engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            pool_size=POOL_SIZE,
            max_overflow=MAX_OVER,
            pool_recycle=POOL_RECYCLE,
            pool_pre_ping=POOL_PRE_PING,
            future=True,
        )
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        print("✅ Async database engine created successfully")
    except Exception as e:
        print(f"❌ Failed to create async database engine: {e}")
        print("💡 Make sure asyncpg is installed and DATABASE_URL is correct")
        engine = None
        SessionLocal = None
else:
    print("⚠️  No DATABASE_URL provided, database features will be disabled")
    engine = None
    SessionLocal = None

async def get_db() -> AsyncSession:
    if not SessionLocal:
        raise Exception("Database not configured - DATABASE_URL not set")
    async with SessionLocal() as session:
        yield session

async def init_db():
    """Initialize database tables"""
    if not engine:
        print("Warning: Database not configured, skipping initialization")
        return
        
    async with engine.begin() as conn:
        # Create users table if it doesn't exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                firebase_uid VARCHAR(128) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                disabled BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE
            )
        """))
        
        # Create admin audit log table for security tracking
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id SERIAL PRIMARY KEY,
                admin_uid VARCHAR(128) NOT NULL,
                action VARCHAR(100) NOT NULL,
                target_uid VARCHAR(128) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Create admin user if it doesn't exist
        await conn.execute(text("""
            INSERT INTO users (firebase_uid, email, name, is_admin, disabled)
            VALUES ('admin', 'admin@theravillage.com', 'System Admin', true, false)
            ON CONFLICT (firebase_uid) DO NOTHING
        """))
        
        # Add daniel.nurieli@gmail.com as admin ONLY in development/local
        environment = os.getenv("ENVIRONMENT", "production")
        if environment.lower() in ["development", "local"]:
            print("🔧 Development mode: Adding daniel.nurieli@gmail.com as admin")
            await conn.execute(text("""
                INSERT INTO users (firebase_uid, email, name, is_admin, disabled)
                VALUES ('daniel_admin', 'daniel.nurieli@gmail.com', 'Daniel Nurieli', true, false)
                ON CONFLICT (email) DO UPDATE SET is_admin = true
            """))
        else:
            print("🚀 Production mode: Skipping development admin user creation")
        
        await conn.commit()
