import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

async def get_secret(secret_name: str) -> str:
    """Get secret from Google Cloud Secret Manager"""
    try:
        import google.cloud.secretmanager as secretmanager
        client = secretmanager.SecretManagerServiceClient()
        secret_path = f"projects/theravillage-edb89/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": secret_path})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"Error fetching secret {secret_name}: {e}")
        return ""

async def get_database_url() -> str:
    """Get DATABASE_URL from environment or Secret Manager"""
    # First try environment variable (for local development)
    env_url = os.getenv("DATABASE_URL", "")
    if env_url:
        print("🔗 Using DATABASE_URL from environment (local development)")
        return env_url
    
    # Fall back to Secret Manager (for production or when env var not set)
    print("🔗 Fetching DATABASE_URL from Secret Manager (production)")
    return await get_secret("DATABASE_URL")

# Initialize database URL as empty, will be set when needed
DATABASE_URL = ""

# Ensure we're using the async driver
async def configure_database():
    global DATABASE_URL, engine, SessionLocal
    
    if not DATABASE_URL:
        DATABASE_URL = await get_database_url()
    
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

# Initialize engine and SessionLocal as None
engine = None
SessionLocal = None

async def create_database_engine():
    """Create the database engine using environment or Secret Manager config"""
    global engine, SessionLocal
    
    await configure_database()
    
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
        # Try to create engine if not already created
        await create_database_engine()
        if not SessionLocal:
            raise Exception("Database not configured - DATABASE_URL not set")
    
    async with SessionLocal() as session:
        yield session

async def init_db():
    """Initialize database tables"""
    if not engine:
        # Try to create engine if not already created
        await create_database_engine()
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
