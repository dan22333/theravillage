import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
    """Initialize database tables for TheraVillage MVP"""
    # Create database engine if it doesn't exist
    if not engine:
        await create_database_engine()
        if not engine:
            print("⚠️  Database not configured, skipping initialization")
            return
    
    print("🔧 Initializing database tables...")
        
    async with engine.begin() as conn:
        # Install pgvector extension for vector operations
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        print("✅ pgvector extension installed")
        # 1. Organizations (must be created BEFORE users due to foreign key constraint)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                logo_url TEXT,
                settings_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 2. Users & Roles
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                org_id INTEGER,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                role VARCHAR(20) NOT NULL CHECK (role IN ('therapist', 'client', 'admin', 'agency', 'pending')),
                status VARCHAR(20) DEFAULT 'active',
                firebase_uid VARCHAR(255),
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Add org_id column if it doesn't exist (for existing databases)
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name='users' AND column_name='org_id'
            ) THEN
                ALTER TABLE users ADD COLUMN org_id INTEGER;
            END IF;
        END $$;
        """))

        # 2. User Profiles
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS therapist_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                npi VARCHAR(20),
                license_state VARCHAR(2),
                license_number VARCHAR(50),
                credentials JSONB,
                specialties JSONB,
                years_experience INTEGER,
                bio TEXT,
                avatar_url TEXT,
                base_location JSONB,
                travel_radius_km INTEGER DEFAULT 20,
                timezone VARCHAR(50) DEFAULT 'America/New_York',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Add timezone column if it doesn't exist (for existing databases)
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='therapist_profiles' AND column_name='timezone'
            ) THEN
                ALTER TABLE therapist_profiles ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';
            END IF;
        END $$;
        """))

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
                initial_analysis TEXT,
                preferred_language VARCHAR(10) DEFAULT 'en',
                notification_prefs JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Backfill: add column if missing in existing DBs
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name='client_profiles' AND column_name='initial_analysis'
            ) THEN
                ALTER TABLE client_profiles ADD COLUMN initial_analysis TEXT;
            END IF;
        END $$;
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(100),
                permissions JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agency_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                agency_name VARCHAR(255),
                npi VARCHAR(20),
                address JSONB,
                contact_info JSONB,
                specialties JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 3. Therapist-Agency Assignments (NEW)
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

        # 5. Therapist-Client Assignments (UPDATED - now therapist to client_user)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS therapist_assignments (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE,
                capacity_pct INTEGER DEFAULT 100,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(client_id, therapist_id)
            )
        """))
        
        # Add unique index to ensure only one active assignment per client
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment_per_client 
            ON therapist_assignments (client_id) 
            WHERE status = 'active'
        """))

        # 6. Availability
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS availability (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                travel_radius_km INTEGER DEFAULT 20,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 7. Appointments (UPDATED - now client_id references users table)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                location JSONB,
                start_ts TIMESTAMP WITH TIME ZONE NOT NULL,
                end_ts TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
                recurring_rule TEXT,
                drive_buffer_before INTEGER DEFAULT 20,
                drive_buffer_after INTEGER DEFAULT 20,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 8. Pending Clients (NEW - for client invitations)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pending_clients (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                dob DATE,
                guardian_first_name VARCHAR(255),
                guardian_last_name VARCHAR(255),
                patient_first_name VARCHAR(255),
                patient_last_name VARCHAR(255),
                address JSONB,
                school VARCHAR(255),
                diagnosis_codes JSONB,
                payer_id VARCHAR(100),
                auth_lims_json JSONB,
                goals_json JSONB,
                invitation_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 9. Waitlist (UPDATED - now client_id references users table)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS waitlist (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                preferred_timeslots JSONB,
                priority INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 9. Sessions (Updated schema)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                duration_minutes INTEGER DEFAULT 60,
                treatment_codes JSONB,
                note_status VARCHAR(20) DEFAULT 'draft' CHECK (note_status IN ('draft', 'in_progress', 'signed', 'exported')),
                therapist_signature_ts TIMESTAMP WITH TIME ZONE,
                client_signature_ts TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Migrate existing sessions table if needed
        await conn.execute(text("""
        DO $$
        BEGIN
            -- Add new columns if they don't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='client_id'
            ) THEN
                ALTER TABLE sessions ADD COLUMN client_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='therapist_id'
            ) THEN
                ALTER TABLE sessions ADD COLUMN therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='start_time'
            ) THEN
                ALTER TABLE sessions ADD COLUMN start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='duration_minutes'
            ) THEN
                ALTER TABLE sessions ADD COLUMN duration_minutes INTEGER DEFAULT 60;
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='treatment_codes'
            ) THEN
                ALTER TABLE sessions ADD COLUMN treatment_codes JSONB;
            END IF;
            
            -- Rename old columns if they exist
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='cpt_codes'
            ) THEN
                ALTER TABLE sessions RENAME COLUMN cpt_codes TO treatment_codes_old;
            END IF;
        END $$;
        """))

        # 10. Notes
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                type VARCHAR(20) DEFAULT 'soap' CHECK (type IN ('soap', 'progress', 'eval', 'reeval')),
                soap JSONB,
                goals_checked JSONB,
                treatment_codes JSONB,
                attachments JSONB,
                generated_by_ai_json JSONB,
                final_text TEXT,
                export_urls JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 11. Exercises
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                tags JSONB,
                difficulty VARCHAR(20),
                media_urls JSONB,
                instructions_richtext TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 12. Homework Plans (UPDATED - now client_id references users table)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS homework_plans (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assigned_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                items JSONB,
                status_per_day JSONB,
                client_comments JSONB,
                completion_rate DECIMAL(5,2),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 13. Messaging Threads
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS threads (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                participants JSONB,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 14. Messages
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                attachments JSONB,
                read_by JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 15. Files
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50),
                url TEXT NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 16. Credentials
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS credentials (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                doc_url TEXT,
                issued_at DATE,
                expires_at DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'expiring_soon')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 17. Claim Checks
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS claim_checks (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                checks JSONB,
                score INTEGER,
                ready_for_export BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 18. Audit Logs
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                entity VARCHAR(50),
                entity_id INTEGER,
                payload JSONB,
                ip_address INET,
                user_agent TEXT,
                ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # 19. Notifications
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                payload JSONB,
                channel VARCHAR(20) DEFAULT 'inapp' CHECK (channel IN ('inapp', 'email', 'sms')),
                sent_ts TIMESTAMP WITH TIME ZONE,
                read_ts TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # -------------------------------
        # Constraints and Indexes
        # -------------------------------
        # Foreign key: users.org_id -> organizations(id)
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org') THEN
                ALTER TABLE users
                ADD CONSTRAINT fk_users_org
                FOREIGN KEY (org_id)
                REFERENCES organizations(id)
                ON DELETE SET NULL;
            END IF;
        END $$;
        """))

        # Uniqueness: one profile per user
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_therapist_profiles_user ON therapist_profiles(user_id);
        """))
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_profiles_user ON client_profiles(user_id);
        """))
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_profiles_user ON admin_profiles(user_id);
        """))
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_agency_profiles_user ON agency_profiles(user_id);
        """))

        # Avoid duplicate therapist-agency assignments
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_therapist_agency_assignments
            ON therapist_agency_assignments(therapist_id, agency_id, start_date);
        """))

        # Therapist assignment uniqueness across periods (by start_date)
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_therapist_assignments_triplet
            ON therapist_assignments(therapist_id, client_id, start_date);
        """))

        # Checks for data integrity
        # capacity within 0..100
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_therapist_assignments_capacity') THEN
                ALTER TABLE therapist_assignments
                ADD CONSTRAINT chk_therapist_assignments_capacity
                CHECK (capacity_pct >= 0 AND capacity_pct <= 100);
            END IF;
        END $$;
        """))

        # availability time window
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_availability_time') THEN
                ALTER TABLE availability
                ADD CONSTRAINT chk_availability_time
                CHECK (start_time < end_time);
            END IF;
        END $$;
        """))

        # appointment time window
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_time') THEN
                ALTER TABLE appointments
                ADD CONSTRAINT chk_appointments_time
                CHECK (start_ts < end_ts);
            END IF;
        END $$;
        """))

        # homework completion rate 0..100
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_homework_plans_rate') THEN
                ALTER TABLE homework_plans
                ADD CONSTRAINT chk_homework_plans_rate
                CHECK (completion_rate IS NULL OR (completion_rate >= 0 AND completion_rate <= 100));
            END IF;
        END $$;
        """))

        # credential expiration not before issue date
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_credentials_dates') THEN
                ALTER TABLE credentials
                ADD CONSTRAINT chk_credentials_dates
                CHECK (issued_at IS NULL OR expires_at >= issued_at);
            END IF;
        END $$;
        """))

        # Helpful indexes for joins and filters
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_appointments_therapist_start ON appointments(therapist_id, start_ts);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_appointments_client_start ON appointments(client_id, start_ts);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_appointments_org_id ON appointments(org_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sessions_appointment_id ON sessions(appointment_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notes_session_id ON notes(session_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_homework_plans_client_id ON homework_plans(client_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_threads_org_id ON threads(org_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_threads_client_id ON threads(client_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_files_client_id ON files(client_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_credentials_therapist_id ON credentials(therapist_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_claim_checks_session_id ON claim_checks(session_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
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

        # ===================================
        # SCRAPER SYSTEM TABLES
        # ===================================
        
        # 1. Treatment Topics (Seed Data)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS treatment_topics (
                id SERIAL PRIMARY KEY,
                topic_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                subcategory VARCHAR(100),
                search_keywords TEXT[],
                age_range_min INTEGER DEFAULT 0,
                age_range_max INTEGER DEFAULT 18,
                description TEXT,
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                UNIQUE(topic_name, version)
            )
        """))

        # 2. Scrape Jobs Tracking
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS scrape_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_type VARCHAR(50) DEFAULT 'full_scrape',
                topics_version INTEGER NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status VARCHAR(20) DEFAULT 'running',
                topics_processed INTEGER DEFAULT 0,
                tavily_queries_made INTEGER DEFAULT 0,
                tavily_results_received INTEGER DEFAULT 0,
                llm_processing_attempts INTEGER DEFAULT 0,
                treatments_created INTEGER DEFAULT 0,
                vectors_created INTEGER DEFAULT 0,
                errors_encountered INTEGER DEFAULT 0,
                error_log JSONB DEFAULT '[]'::jsonb,
                job_config JSONB,
                performance_metrics JSONB
            )
        """))

        # 3. Tavily Query Responses
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tavily_responses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                scrape_job_id UUID REFERENCES scrape_jobs(id),
                topic_id INTEGER REFERENCES treatment_topics(id),
                query_text TEXT NOT NULL,
                search_depth VARCHAR(20),
                max_results INTEGER,
                include_domains TEXT[],
                exclude_domains TEXT[],
                tavily_query VARCHAR(500),
                follow_up_questions JSONB,
                answer TEXT,
                images JSONB,
                response_time FLOAT,
                request_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_results_count INTEGER DEFAULT 0
            )
        """))

        # 4. Tavily Individual Results
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tavily_results (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tavily_response_id UUID REFERENCES tavily_responses(id),
                url TEXT NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                raw_content TEXT,
                score FLOAT,
                content_length INTEGER,
                domain VARCHAR(255),
                is_academic_source BOOLEAN DEFAULT FALSE,
                is_clinical_source BOOLEAN DEFAULT FALSE,
                source_credibility_score FLOAT,
                llm_processed BOOLEAN DEFAULT FALSE,
                processing_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 5. LLM Processing Attempts
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS llm_processing_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tavily_result_id UUID REFERENCES tavily_results(id),
                scrape_job_id UUID REFERENCES scrape_jobs(id),
                model_name VARCHAR(100),
                prompt_template_version VARCHAR(20),
                prompt_text TEXT,
                raw_llm_response TEXT,
                parsed_json JSONB,
                processing_time_ms INTEGER,
                tokens_used INTEGER,
                cost_estimate DECIMAL(10,6),
                status VARCHAR(20) DEFAULT 'pending',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 6. Structured Treatments
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS treatments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                scrape_job_id UUID REFERENCES scrape_jobs(id),
                topic_id INTEGER REFERENCES treatment_topics(id),
                tavily_result_id UUID REFERENCES tavily_results(id),
                llm_attempt_id UUID REFERENCES llm_processing_attempts(id),
                treatment_name VARCHAR(500) NOT NULL,
                treatment_description TEXT NOT NULL,
                treatment_objective TEXT,
                age_range_min INTEGER,
                age_range_max INTEGER,
                difficulty_level VARCHAR(20),
                duration_minutes INTEGER,
                frequency_per_week INTEGER,
                step_by_step_instructions JSONB,
                required_materials JSONB,
                safety_considerations JSONB,
                target_skills JSONB,
                contraindications JSONB,
                modifications JSONB,
                progress_indicators JSONB,
                evidence_level VARCHAR(30),
                source_quality_score FLOAT DEFAULT 0.0,
                llm_confidence_score FLOAT DEFAULT 0.0,
                source_url TEXT,
                source_title TEXT,
                source_domain VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                quality_reviewed BOOLEAN DEFAULT FALSE,
                review_notes TEXT
            )
        """))

        # 7. Treatment Vectors for Semantic Search  
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS treatment_vectors (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                treatment_id UUID REFERENCES treatments(id) ON DELETE CASCADE,
                embedding_text TEXT NOT NULL,
                embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
                embedding VECTOR(1536),
                topic_category VARCHAR(100),
                age_range_min INTEGER,
                age_range_max INTEGER,
                difficulty_level VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 8. Search Query Logs
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS search_queries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER,
                query_text TEXT NOT NULL,
                filters JSONB,
                vector_search_results JSONB,
                reranked_results JSONB,
                final_results_count INTEGER,
                search_time_ms INTEGER,
                rerank_time_ms INTEGER,
                total_time_ms INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Scraper System Indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_treatment_topics_category ON treatment_topics(category);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_treatment_topics_version ON treatment_topics(version);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_tavily_responses_job_topic ON tavily_responses(scrape_job_id, topic_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_tavily_results_response_id ON tavily_results(tavily_response_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_treatments_topic_id ON treatments(topic_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_treatments_age_range ON treatments(age_range_min, age_range_max);
        """))

        print("✅ Scraper system tables created successfully")

        # ===================================
        # CALENDAR AND SCHEDULING SYSTEM TABLES
        # ===================================
        
        # 1. Therapist Calendar Slots (specific time slots marked as available)
        # All times stored in Eastern Time for consistency
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS therapist_calendar_slots (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                slot_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(therapist_id, slot_date, start_time)
            )
        """))
        

        # 2. Scheduling Requests (when clients request meetings)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS scheduling_requests (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                requested_slot_id INTEGER REFERENCES therapist_calendar_slots(id) ON DELETE SET NULL,
                requested_date DATE NOT NULL,
                requested_start_time TIME NOT NULL,
                requested_end_time TIME NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'counter_proposed', 'cancelled')),
                client_message TEXT,
                therapist_response TEXT,
                suggested_alternatives JSONB,
                cancelled_by VARCHAR(10) CHECK (cancelled_by IN ('client', 'therapist')),
                cancellation_reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                responded_at TIMESTAMP WITH TIME ZONE
            )
        """))

        # Migration: Ensure 'declined' status is properly supported
        await conn.execute(text("""
            DO $$ 
            BEGIN
                -- Drop the old constraint if it exists
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'scheduling_requests_status_check'
                ) THEN
                    ALTER TABLE scheduling_requests 
                    DROP CONSTRAINT scheduling_requests_status_check;
                END IF;
                
                -- Add the constraint with 'declined' status
                ALTER TABLE scheduling_requests 
                ADD CONSTRAINT scheduling_requests_status_check 
                CHECK (status IN ('pending', 'approved', 'declined', 'counter_proposed', 'cancelled'));
            END $$;
        """))

        # 3. Calendar Notifications (for scheduling events)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS calendar_notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL CHECK (type IN ('scheduling_request', 'request_approved', 'request_declined', 'request_cancelled', 'counter_proposal', 'meeting_reminder', 'appointment_scheduled', 'appointment_updated', 'appointment_cancelled', 'appointment_rescheduled')),
                related_request_id INTEGER REFERENCES scheduling_requests(id) ON DELETE CASCADE,
                related_appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Add scheduling_request_id to appointments table if it doesn't exist
        await conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='appointments' AND column_name='scheduling_request_id'
            ) THEN
                ALTER TABLE appointments ADD COLUMN scheduling_request_id INTEGER REFERENCES scheduling_requests(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """))

        # Calendar system indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_calendar_slots_therapist_date ON therapist_calendar_slots(therapist_id, slot_date);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_therapist_calendar_slots_status ON therapist_calendar_slots(status);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_scheduling_requests_client ON scheduling_requests(client_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_scheduling_requests_therapist ON scheduling_requests(therapist_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_scheduling_requests_status ON scheduling_requests(status);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_calendar_notifications_user_unread ON calendar_notifications(user_id, is_read);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_appointments_scheduling_request ON appointments(scheduling_request_id);
        """))

        # Update existing calendar_notifications constraint if needed
        await conn.execute(text("""
        DO $$
        BEGIN
            -- Drop old constraint if it exists
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notifications_type_check') THEN
                ALTER TABLE calendar_notifications DROP CONSTRAINT calendar_notifications_type_check;
            END IF;
            
            -- Add new constraint with all notification types
            ALTER TABLE calendar_notifications 
            ADD CONSTRAINT calendar_notifications_type_check 
            CHECK (type IN ('scheduling_request', 'request_approved', 'request_declined', 'request_cancelled', 'counter_proposal', 'meeting_reminder', 'appointment_scheduled', 'appointment_updated', 'appointment_cancelled', 'appointment_rescheduled'));
        END $$;
        """))

        print("✅ Calendar and scheduling system tables created successfully")

        # Create default organization and admin user
        print("🔧 Creating default organization and admin user")
        await conn.execute(text("""
            INSERT INTO organizations (id, name, settings_json)
            VALUES (1, 'TheraVillage', '{"environment": "production"}')
            ON CONFLICT (id) DO UPDATE SET 
                name = 'TheraVillage',
                settings_json = '{"environment": "production"}'
        """))
        
        # Get admin Firebase UID from environment or Secret Manager
        admin_firebase_uid = os.getenv("ADMIN_FIREBASE_UID")
        if not admin_firebase_uid:
            admin_firebase_uid = await get_secret("ADMIN_FIREBASE_UID")
        
        if admin_firebase_uid:
            await conn.execute(text("""
                INSERT INTO users (org_id, name, email, role, status, firebase_uid)
                VALUES (1, 'Daniel Nurieli', 'daniel.nurieli@gmail.com', 'admin', 'active', :firebase_uid)
                ON CONFLICT (email) DO UPDATE SET 
                    role = 'admin', 
                    status = 'active',
                    firebase_uid = :firebase_uid
            """), {"firebase_uid": admin_firebase_uid})
        
        await conn.commit()
        
        # TEMPORARY MIGRATION CODE - Add new columns to existing tables
        print("🔄 Running temporary migrations for existing tables...")
        try:
            # Add cancelled_by column if it doesn't exist
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'scheduling_requests' 
                                  AND column_name = 'cancelled_by') THEN
                        ALTER TABLE scheduling_requests 
                        ADD COLUMN cancelled_by VARCHAR(10) CHECK (cancelled_by IN ('client', 'therapist'));
                        RAISE NOTICE 'Added cancelled_by column to scheduling_requests';
                    END IF;
                END $$;
            """))
            
            # Add cancellation_reason column if it doesn't exist
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'scheduling_requests' 
                                  AND column_name = 'cancellation_reason') THEN
                        ALTER TABLE scheduling_requests 
                        ADD COLUMN cancellation_reason TEXT;
                        RAISE NOTICE 'Added cancellation_reason column to scheduling_requests';
                    END IF;
                END $$;
            """))
            
            # Add guardian and patient name columns to pending_clients if they don't exist
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'pending_clients' 
                                  AND column_name = 'guardian_first_name') THEN
                        ALTER TABLE pending_clients 
                        ADD COLUMN guardian_first_name VARCHAR(255);
                        RAISE NOTICE 'Added guardian_first_name column to pending_clients';
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'pending_clients' 
                                  AND column_name = 'guardian_last_name') THEN
                        ALTER TABLE pending_clients 
                        ADD COLUMN guardian_last_name VARCHAR(255);
                        RAISE NOTICE 'Added guardian_last_name column to pending_clients';
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'pending_clients' 
                                  AND column_name = 'patient_first_name') THEN
                        ALTER TABLE pending_clients 
                        ADD COLUMN patient_first_name VARCHAR(255);
                        RAISE NOTICE 'Added patient_first_name column to pending_clients';
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'pending_clients' 
                                  AND column_name = 'patient_last_name') THEN
                        ALTER TABLE pending_clients 
                        ADD COLUMN patient_last_name VARCHAR(255);
                        RAISE NOTICE 'Added patient_last_name column to pending_clients';
                    END IF;
                END $$;
            """))
            
            await conn.commit()
            print("✅ Temporary migrations completed successfully")
            
        except Exception as e:
            print(f"⚠️  Migration warning (may be expected): {e}")
            await conn.rollback()
        
        print("✅ Database initialization completed successfully")
