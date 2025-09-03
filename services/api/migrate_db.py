#!/usr/bin/env python3
"""
Database Migration Runner for TheraVillage
Handles safe database schema updates in production and local development
"""

import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DatabaseMigrator:
    def __init__(self):
        self.engine = None
        self.migrations_dir = Path(__file__).parent / "migrations"
        
    async def get_database_url(self):
        """Get DATABASE_URL from environment or Secret Manager"""
        environment = os.getenv("ENVIRONMENT", "development")
        
        if environment == "production":
            # Production: Get from Secret Manager
            print("🔗 Production environment - fetching DATABASE_URL from Secret Manager")
            try:
                import google.cloud.secretmanager as secretmanager
                client = secretmanager.SecretManagerServiceClient()
                secret_path = f"projects/theravillage-edb89/secrets/DATABASE_URL/versions/latest"
                response = client.access_secret_version(request={"name": secret_path})
                return response.payload.data.decode("UTF-8")
            except Exception as e:
                print(f"Error fetching secret: {e}")
                return ""
        else:
            # Local development: Get from environment variable
            env_url = os.getenv("DATABASE_URL", "")
            if env_url:
                print("🔗 Local development - using DATABASE_URL from environment")
                return env_url
            else:
                print("❌ No DATABASE_URL found in environment")
                return ""

    async def create_engine(self):
        """Create database engine"""
        database_url = await self.get_database_url()
        if not database_url:
            raise Exception("No DATABASE_URL provided")
            
        # Ensure we're using the async driver
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql+asyncpg://")
        elif database_url.startswith("postgresql://") and "asyncpg" not in database_url:
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        
        print(f"🔗 Connecting to database...")
        self.engine = create_async_engine(
            database_url, 
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True
        )
        print(f"✅ Database engine created")

    async def create_migrations_table(self):
        """Create migrations tracking table if it doesn't exist"""
        async with self.engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    migration_name VARCHAR(255) UNIQUE NOT NULL,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    checksum VARCHAR(64),
                    execution_time_ms INTEGER
                )
            """))

    async def get_applied_migrations(self):
        """Get list of already applied migrations"""
        async with self.engine.begin() as conn:
            result = await conn.execute(text("SELECT migration_name FROM migrations ORDER BY applied_at"))
            return [row[0] for row in result.fetchall()]

    async def apply_migration(self, migration_file: Path):
        """Apply a single migration file"""
        migration_name = migration_file.name
        
        print(f"🔄 Applying migration: {migration_name}")
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Read migration file
            with open(migration_file, 'r') as f:
                migration_sql = f.read()
            
            # Apply migration
            async with self.engine.begin() as conn:
                # Split SQL by semicolons and execute each statement
                statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
                
                for i, statement in enumerate(statements):
                    if statement:
                        print(f"   Executing statement {i+1}/{len(statements)}...")
                        await conn.execute(text(statement))
                
                # Record migration as applied
                await conn.execute(text("""
                    INSERT INTO migrations (migration_name, checksum, execution_time_ms)
                    VALUES (:migration_name, :checksum, :execution_time_ms)
                """), {
                    "migration_name": migration_name,
                    "checksum": str(hash(migration_sql)),
                    "execution_time_ms": int((asyncio.get_event_loop().time() - start_time) * 1000)
                })
            
            print(f"✅ Migration applied successfully: {migration_name}")
            
        except Exception as e:
            print(f"❌ Migration failed: {migration_name}")
            print(f"Error: {e}")
            raise

    async def run_migrations(self):
        """Run all pending migrations"""
        print("🚀 Starting database migrations...")
        
        # Create migrations table
        await self.create_migrations_table()
        
        # Get applied migrations
        applied_migrations = await self.get_applied_migrations()
        print(f"📋 Already applied migrations: {applied_migrations}")
        
        # Get all migration files
        migration_files = sorted([
            f for f in self.migrations_dir.glob("*.sql")
        ])
        
        print(f"📁 Found {len(migration_files)} migration files")
        
        # Apply pending migrations
        applied_count = 0
        for migration_file in migration_files:
            migration_name = migration_file.name
            
            if migration_name not in applied_migrations:
                await self.apply_migration(migration_file)
                applied_count += 1
            else:
                print(f"⏭️  Skipping already applied migration: {migration_name}")
        
        print(f"🎉 Migration complete! Applied {applied_count} new migrations")

    async def rollback_migration(self, migration_name: str):
        """Rollback a specific migration (if supported)"""
        print(f"🔄 Rolling back migration: {migration_name}")
        
        # This is a simplified rollback - in production you'd want more sophisticated rollback logic
        async with self.engine.begin() as conn:
            await conn.execute(text("""
                DELETE FROM migrations WHERE migration_name = :migration_name
            """), {"migration_name": migration_name})
        
        print(f"✅ Migration rolled back: {migration_name}")

async def main():
    """Main migration runner"""
    migrator = DatabaseMigrator()
    
    try:
        await migrator.create_engine()
        
        if len(sys.argv) > 1:
            command = sys.argv[1]
            
            if command == "migrate":
                await migrator.run_migrations()
            elif command == "rollback":
                if len(sys.argv) > 2:
                    migration_name = sys.argv[2]
                    await migrator.rollback_migration(migration_name)
                else:
                    print("Usage: python migrate_db.py rollback <migration_name>")
            else:
                print("Unknown command. Use 'migrate' or 'rollback'")
        else:
            # Default: run migrations
            await migrator.run_migrations()
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
