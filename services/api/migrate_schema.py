#!/usr/bin/env python3
"""
Database Migration Script for TheraVillage Schema Changes

This script migrates from the old schema (with guardians/parents) to the new schema
where clients are users and therapists work at agencies.
"""

import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from datetime import datetime

async def get_database_url() -> str:
    """Get DATABASE_URL from environment"""
    return os.getenv("DATABASE_URL", "")

async def migrate_schema():
    """Migrate the database schema"""
    database_url = await get_database_url()
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return
    
    # Ensure we're using the async driver
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://")
    elif database_url.startswith("postgresql://") and "asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    print(f"🔗 Connecting to database: {database_url}")
    
    engine = create_async_engine(database_url, echo=True)
    
    async with engine.begin() as conn:
        print("🚀 Starting schema migration...")
        
        # Step 1: Check if old tables exist
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN ('guardian_links', 'parent_profiles', 'clients')
        """))
        existing_tables = [row[0] for row in result.fetchall()]
        
        print(f"📋 Found existing tables: {existing_tables}")
        
        # Step 2: Create new tables if they don't exist
        print("🔧 Creating new tables...")
        
        # Create client_profiles table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS client_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                dob DATE,
                address JSONB,
                school VARCHAR(255),
                diagnosis_codes JSONB,
                payer_id VARCHAR(100),
                auth_lims_json JSONB,
                goals_json JSONB,
                preferred_language VARCHAR(10) DEFAULT 'en',
                notification_prefs JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Create therapist_agency_assignments table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS therapist_agency_assignments (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                agency_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Step 3: Migrate data if old tables exist
        if 'clients' in existing_tables:
            print("🔄 Migrating clients data...")
            
            # Get all clients
            result = await conn.execute(text("SELECT * FROM clients"))
            clients = result.fetchall()
            
            for client in clients:
                client_id, org_id, name, dob, address, school, diagnosis_codes, payer_id, auth_lims_json, goals_json, status, created_at, updated_at = client
                
                # Create user for this client
                result = await conn.execute(text("""
                    INSERT INTO users (org_id, name, email, role, status, created_at, updated_at)
                    VALUES (:org_id, :name, :email, 'client', :status, :created_at, :updated_at)
                    RETURNING id
                """), {
                    "org_id": org_id,
                    "name": name,
                    "email": f"{name.lower().replace(' ', '.')}@client.theravillage.com",  # Generate email
                    "status": status,
                    "created_at": created_at,
                    "updated_at": updated_at
                })
                
                new_user_id = result.fetchone()[0]
                
                # Create client profile
                await conn.execute(text("""
                    INSERT INTO client_profiles (user_id, dob, address, school, diagnosis_codes, payer_id, auth_lims_json, goals_json, created_at, updated_at)
                    VALUES (:user_id, :dob, :address, :school, :diagnosis_codes, :payer_id, :auth_lims_json, :goals_json, :created_at, :updated_at)
                """), {
                    "user_id": new_user_id,
                    "dob": dob,
                    "address": address,
                    "school": school,
                    "diagnosis_codes": diagnosis_codes,
                    "payer_id": payer_id,
                    "auth_lims_json": auth_lims_json,
                    "goals_json": goals_json,
                    "created_at": created_at,
                    "updated_at": updated_at
                })
                
                # Update therapist_assignments to use new user_id
                await conn.execute(text("""
                    UPDATE therapist_assignments 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
                
                # Update appointments to use new user_id
                await conn.execute(text("""
                    UPDATE appointments 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
                
                # Update waitlist to use new user_id
                await conn.execute(text("""
                    UPDATE waitlist 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
                
                # Update homework_plans to use new user_id
                await conn.execute(text("""
                    UPDATE homework_plans 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
                
                # Update threads to use new user_id
                await conn.execute(text("""
                    UPDATE threads 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
                
                # Update files to use new user_id
                await conn.execute(text("""
                    UPDATE files 
                    SET client_id = :new_user_id 
                    WHERE client_id = :old_client_id
                """), {
                    "new_user_id": new_user_id,
                    "old_client_id": client_id
                })
            
            print(f"✅ Migrated {len(clients)} clients")
        
        # Step 4: Update foreign key constraints
        print("🔧 Updating foreign key constraints...")
        
        # Update therapist_assignments client_id to reference users
        await conn.execute(text("""
            ALTER TABLE therapist_assignments 
            DROP CONSTRAINT IF EXISTS therapist_assignments_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE therapist_assignments 
            ADD CONSTRAINT therapist_assignments_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
        """))
        
        # Update appointments client_id to reference users
        await conn.execute(text("""
            ALTER TABLE appointments 
            DROP CONSTRAINT IF EXISTS appointments_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE appointments 
            ADD CONSTRAINT appointments_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id)
        """))
        
        # Update waitlist client_id to reference users
        await conn.execute(text("""
            ALTER TABLE waitlist 
            DROP CONSTRAINT IF EXISTS waitlist_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE waitlist 
            ADD CONSTRAINT waitlist_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
        """))
        
        # Update homework_plans client_id to reference users
        await conn.execute(text("""
            ALTER TABLE homework_plans 
            DROP CONSTRAINT IF EXISTS homework_plans_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE homework_plans 
            ADD CONSTRAINT homework_plans_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
        """))
        
        # Update threads client_id to reference users
        await conn.execute(text("""
            ALTER TABLE threads 
            DROP CONSTRAINT IF EXISTS threads_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE threads 
            ADD CONSTRAINT threads_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id)
        """))
        
        # Update files client_id to reference users
        await conn.execute(text("""
            ALTER TABLE files 
            DROP CONSTRAINT IF EXISTS files_client_id_fkey
        """))
        
        await conn.execute(text("""
            ALTER TABLE files 
            ADD CONSTRAINT files_client_id_fkey 
            FOREIGN KEY (client_id) REFERENCES users(id)
        """))
        
        # Step 5: Update sessions table
        print("🔧 Updating sessions table...")
        
        # Rename parent_signature_ts to client_signature_ts
        await conn.execute(text("""
            ALTER TABLE sessions 
            RENAME COLUMN parent_signature_ts TO client_signature_ts
        """))
        
        # Step 6: Update homework_plans table
        print("🔧 Updating homework_plans table...")
        
        # Rename parent_comments to client_comments
        await conn.execute(text("""
            ALTER TABLE homework_plans 
            RENAME COLUMN parent_comments TO client_comments
        """))
        
        # Step 7: Create indexes
        print("🔧 Creating indexes...")
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_agency_assignments_therapist ON therapist_agency_assignments(therapist_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_agency_assignments_agency ON therapist_agency_assignments(agency_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_assignments_therapist ON therapist_assignments(therapist_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_assignments_client ON therapist_assignments(client_id);
        """))
        
        # Step 8: Drop old tables (optional - comment out if you want to keep them for backup)
        print("🗑️  Dropping old tables...")
        
        # Drop guardian_links table
        await conn.execute(text("DROP TABLE IF EXISTS guardian_links CASCADE"))
        
        # Drop parent_profiles table
        await conn.execute(text("DROP TABLE IF EXISTS parent_profiles CASCADE"))
        
        # Drop clients table (after migration)
        if 'clients' in existing_tables:
            await conn.execute(text("DROP TABLE IF EXISTS clients CASCADE"))
        
        print("✅ Schema migration completed successfully!")
        
        # Step 9: Update user roles constraint
        print("🔧 Updating user roles constraint...")
        
        await conn.execute(text("""
            ALTER TABLE users 
            DROP CONSTRAINT IF EXISTS users_role_check
        """))
        
        await conn.execute(text("""
            ALTER TABLE users 
            ADD CONSTRAINT users_role_check 
            CHECK (role IN ('therapist', 'client', 'admin', 'agency', 'pending'))
        """))
        
        await conn.commit()

if __name__ == "__main__":
    print("🚀 TheraVillage Database Schema Migration")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("app"):
        print("❌ Please run this script from the services/api directory")
        sys.exit(1)
    
    # Run the migration
    asyncio.run(migrate_schema())
    
    print("✅ Migration script completed!")
