"""
TheraVillage Treatment Scraper Service
FastAPI application for scraping and processing pediatric OT treatment content
"""
import logging
import asyncio
import os
from contextlib import asynccontextmanager
from typing import List, Dict, Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Simple settings from environment variables
class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://tv_admin:TheraVillage2024!@tv-postgres:5432/theravillage")
    TAVILY_MAX_RESULTS = int(os.getenv("TAVILY_MAX_RESULTS", "10"))
    TAVILY_SEARCH_DEPTH = os.getenv("TAVILY_SEARCH_DEPTH", "advanced")
    MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "theravillage-edb89")

settings = Settings()

# Load API keys from Secret Manager
async def load_secrets():
    """Load API keys from Secret Manager using secret names from environment"""
    try:
        import google.cloud.secretmanager as secretmanager
        client = secretmanager.SecretManagerServiceClient()
        project_id = settings.GOOGLE_CLOUD_PROJECT
        
        # Get secret names from environment variables
        tavily_secret_name_env = os.getenv("TAVILY_API_KEY_SECRET_NAME", "TAVILY_API_KEY")
        openai_secret_name_env = os.getenv("OPENAI_API_KEY_SECRET_NAME", "OPENAI_API_KEY")
        pinecone_secret_name_env = os.getenv("PINECONE_API_KEY_SECRET_NAME", "PINECONE_API_KEY")
        
        # Load Tavily API Key
        tavily_secret_path = f"projects/{project_id}/secrets/{tavily_secret_name_env}/versions/latest"
        tavily_response = client.access_secret_version(request={"name": tavily_secret_path})
        settings.TAVILY_API_KEY = tavily_response.payload.data.decode("UTF-8")
        logger.info(f"✅ Loaded TAVILY_API_KEY from secret: {tavily_secret_name_env}")
        
        # Load OpenAI API Key
        openai_secret_path = f"projects/{project_id}/secrets/{openai_secret_name_env}/versions/latest"
        openai_response = client.access_secret_version(request={"name": openai_secret_path})
        settings.OPENAI_API_KEY = openai_response.payload.data.decode("UTF-8")
        logger.info(f"✅ Loaded OPENAI_API_KEY from secret: {openai_secret_name_env}")
        
        # Load Pinecone API Key
        pinecone_secret_path = f"projects/{project_id}/secrets/{pinecone_secret_name_env}/versions/latest"
        pinecone_response = client.access_secret_version(request={"name": pinecone_secret_path})
        settings.PINECONE_API_KEY = pinecone_response.payload.data.decode("UTF-8")
        logger.info(f"✅ Loaded PINECONE_API_KEY from secret: {pinecone_secret_name_env}")
        
        logger.info("✅ All API keys loaded from Secret Manager")
        
    except Exception as e:
        logger.error(f"❌ Failed to load secrets from Secret Manager: {e}")
        # Fallback to environment variables for local development
        settings.TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
        settings.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        settings.PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
        logger.warning("⚠️ Using fallback environment variables for API keys")
from .database import init_db, check_db_health, get_db_session
from .models.jobs import ScrapeJobRequest, ScrapeJobResponse, ScrapeJobStatus, JobStatus
from .models.topics import TopicSeedRequest, TopicSeedResponse
from .services.topic_seeder import TopicSeeder
from .services.tavily_client import TavilyClient
from .services.cloud_tasks_manager import CloudTasksManager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global variables for services
topic_seeder = None
tavily_client = None
cloud_tasks_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global topic_seeder, tavily_client, cloud_tasks_manager
    
    logger.info("🚀 Starting TheraVillage Scraper Service...")
    
    try:
        # Load secrets from Secret Manager
        await load_secrets()
        
        # Initialize database
        await init_db()
        logger.info("✅ Database initialized")
        
        # Initialize services
        topic_seeder = TopicSeeder()
        tavily_client = TavilyClient()
        cloud_tasks_manager = CloudTasksManager()
        logger.info("✅ Services initialized")
        
        # Note: Automatic cleanup handled by separate Cloud Scheduler + Cloud Run Job
        # See app/cleanup_job.py for dedicated cleanup logic
        
        logger.info("🎯 Scraper service ready!")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize service: {e}")
        raise
    
    yield
    
    logger.info("🛑 Shutting down scraper service...")

# Cleanup is now handled by dedicated Cloud Run Job (see app/cleanup_job.py)

# Create FastAPI app
app = FastAPI(
    title="TheraVillage Treatment Scraper",
    description="Service for scraping and processing pediatric occupational therapy treatment content",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware (same pattern as other services)
cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")

if cors_origins:
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
elif settings.ENVIRONMENT == "development":
    allowed_origins = ["*"]
else:
    # Production fallback: Allow common origins
    allowed_origins = [
        "https://theravillage-edb89.web.app",
        "https://theravillage-edb89.firebaseapp.com"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if settings.ENVIRONMENT == "production" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_healthy = await check_db_health()
    
    # Get running jobs count from database
    try:
        from .database import fetch_one
        result = await fetch_one("SELECT COUNT(*) FROM scrape_jobs WHERE status = 'running'")
        running_jobs = result[0] if result else 0
    except:
        running_jobs = 0
    
    health_status = {
        "status": "healthy" if db_healthy else "unhealthy",
        "service": "theravillage-scraper",
        "database": "connected" if db_healthy else "disconnected",
        "environment": settings.ENVIRONMENT,
        "running_jobs": running_jobs
    }
    
    if not db_healthy:
        raise HTTPException(status_code=503, detail=health_status)
    
    return health_status

# Topic Management Endpoints
@app.post("/topics/seed", response_model=TopicSeedResponse)
async def seed_topics(request: TopicSeedRequest):
    """Seed treatment topics into database"""
    try:
        result = await topic_seeder.seed_topics(
            version=request.version,
            overwrite_existing=request.overwrite_existing
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return TopicSeedResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Error seeding topics: {e}")
        raise HTTPException(status_code=500, detail=f"Error seeding topics: {str(e)}")

@app.get("/topics")
async def get_topics(version: int = None):
    """Get treatment topics"""
    try:
        if version is None:
            version = await topic_seeder.get_latest_version()
            if version == 0:
                raise HTTPException(status_code=404, detail="No topics found. Please seed topics first.")
        
        topics = await topic_seeder.get_topics_by_version(version)
        
        return {
            "version": version,
            "count": len(topics),
            "topics": topics
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching topics: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching topics: {str(e)}")

@app.get("/topics/versions")
async def get_topic_versions():
    """Get available topic versions"""
    try:
        from .database import fetch_all
        
        result = await fetch_all("""
            SELECT version, COUNT(*) as topic_count, MIN(created_at) as created_at
            FROM treatment_topics 
            WHERE is_active = true
            GROUP BY version
            ORDER BY version DESC
        """)
        
        versions = []
        for row in result:
            versions.append({
                "version": row.version,
                "topic_count": row.topic_count,
                "created_at": row.created_at
            })
        
        return {"versions": versions}
        
    except Exception as e:
        logger.error(f"❌ Error fetching topic versions: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching topic versions: {str(e)}")

# Job Management Endpoints
@app.post("/jobs/start", response_model=ScrapeJobResponse)
async def start_scrape_job(request: ScrapeJobRequest):
    """Start a new scraping job using Cloud Run Jobs"""
    try:
        # Auto-use latest version if not specified
        if request.config.topics_version is None:
            request.config.topics_version = await topic_seeder.get_latest_version()
            if request.config.topics_version == 0:
                raise HTTPException(status_code=404, detail="No topics found. Please seed topics first.")
            logger.info(f"🔄 Auto-selected latest topics version: {request.config.topics_version}")
        
        # Populate default domains for complete audit trail
        if request.config.include_domains is None:
            # Get default preferred domains from TavilyClient
            from .services.tavily_client import TavilyClient
            temp_client = TavilyClient.__new__(TavilyClient)  # Create without __init__
            request.config.include_domains = temp_client._get_preferred_domains()
            
        if request.config.exclude_domains is None:
            # Get default excluded domains from TavilyClient  
            from .services.tavily_client import TavilyClient
            temp_client = TavilyClient.__new__(TavilyClient)  # Create without __init__
            request.config.exclude_domains = temp_client._get_excluded_domains()
        
        # Get topics for this job
        if request.config.specific_topic_ids:
            # Use specific topics
            topics = await topic_seeder.get_topics_by_ids(request.config.specific_topic_ids)
            if not topics:
                raise HTTPException(
                    status_code=400, 
                    detail=f"No topics found for IDs: {request.config.specific_topic_ids}"
                )
            logger.info(f"🎯 Using {len(topics)} specific topics: {[t['topic_name'] for t in topics]}")
        else:
            # Use all topics from version
            topics = await topic_seeder.get_topics_by_version(request.config.topics_version)
            if not topics:
                raise HTTPException(
                    status_code=400, 
                    detail=f"No topics found for version {request.config.topics_version}"
                )
            logger.info(f"📋 Using all {len(topics)} topics from version {request.config.topics_version}")
        
        # Log complete configuration for audit trail
        logger.info(f"🔧 Job configuration: {request.config.dict()}")
        
        # Create scraping job using Cloud Tasks Manager
        result = await cloud_tasks_manager.create_scraping_job(request.config, topics)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])
        
        return ScrapeJobResponse(
            success=True,
            message=result["message"],
            job_id=result["job_id"],
            estimated_duration_minutes=result.get("estimated_duration_minutes")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error starting scrape job: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting scrape job: {str(e)}")

@app.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get status of a scraping job"""
    try:
        result = await cloud_tasks_manager.get_job_status(job_id)
        
        if "error" in result:
            if result["error"] == "Job not found":
                raise HTTPException(status_code=404, detail="Job not found")
            else:
                raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting job status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting job status: {str(e)}")

@app.get("/jobs")
async def get_jobs(limit: int = 10, offset: int = 0):
    """Get list of scraping jobs"""
    try:
        from .database import fetch_all
        
        result = await fetch_all("""
            SELECT id, job_type, status, topics_processed, treatments_created, 
                   started_at, completed_at, errors_encountered, topics_version
            FROM scrape_jobs 
            ORDER BY started_at DESC 
            LIMIT :limit OFFSET :offset
        """, {"limit": limit, "offset": offset})
        
        jobs = []
        for row in result:
            jobs.append({
                "id": str(row.id),
                "job_type": row.job_type,
                "status": row.status,
                "topics_processed": row.topics_processed,
                "treatments_created": row.treatments_created,
                "started_at": row.started_at,
                "completed_at": row.completed_at,
                "errors_encountered": row.errors_encountered,
                "topics_version": row.topics_version
            })
        
        return {"jobs": jobs}
        
    except Exception as e:
        logger.error(f"❌ Error fetching jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching jobs: {str(e)}")

@app.get("/jobs/{job_id}/topics")
async def get_job_topics(job_id: str):
    """Get the specific topics used for a scraping job"""
    try:
        from .database import fetch_one
        import json
        
        # Get job info including topics_version and config
        result = await fetch_one("""
            SELECT topics_version, job_config FROM scrape_jobs WHERE id = :job_id
        """, {"job_id": job_id})
        
        if not result:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Parse job config to check for specific topic IDs
        job_config = result.job_config if result.job_config else {}
        specific_topic_ids = job_config.get("specific_topic_ids")
        
        if specific_topic_ids:
            # Get only the specific topics that were used
            topics = await topic_seeder.get_topics_by_ids(specific_topic_ids)
            topics_source = f"specific topics (IDs: {specific_topic_ids})"
        else:
            # Get all topics for the version used by this job
            topics = await topic_seeder.get_topics_by_version(result.topics_version)
            topics_source = f"all topics from version {result.topics_version}"
        
        return {
            "job_id": job_id,
            "topics_version": result.topics_version,
            "topics_count": len(topics),
            "topics_source": topics_source,
            "specific_topic_ids": specific_topic_ids,
            "topics": topics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching job topics: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching job topics: {str(e)}")

@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running scraping job"""
    try:
        result = await cloud_tasks_manager.cancel_job(job_id)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error cancelling job: {e}")
        raise HTTPException(status_code=500, detail=f"Error cancelling job: {str(e)}")

@app.post("/jobs/cleanup")
async def cleanup_stale_jobs(timeout_hours: int = 2):
    """Clean up jobs that have been running too long (manual/local use)"""
    try:
        result = await cloud_tasks_manager.cleanup_stale_jobs(timeout_hours)
        return result
        
    except Exception as e:
        logger.error(f"❌ Error cleaning up jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up jobs: {str(e)}")

# Note: Production also has dedicated Cloud Run Job for automatic cleanup

# Internal endpoint for Cloud Tasks to trigger job execution
@app.post("/internal/execute-job")
async def execute_job_internal(request: dict):
    """Internal endpoint called by Cloud Tasks to execute scraping jobs"""
    try:
        job_id = request.get("job_id")
        config_data = request.get("config")
        
        if not job_id or not config_data:
            raise HTTPException(status_code=400, detail="Missing job_id or config")
        
        logger.info(f"🚀 Executing job via Cloud Tasks: {job_id}")
        
        # Import job runner here to avoid circular imports
        from .job_runner import JobRunner
        
        # Create and run job
        runner = JobRunner()
        await runner.initialize()
        await runner.run_job(job_id)
        
        return {"success": True, "message": f"Job {job_id} completed"}
        
    except Exception as e:
        logger.error(f"❌ Error executing job: {e}")
        raise HTTPException(status_code=500, detail=f"Error executing job: {str(e)}")

# Local development endpoint for testing
@app.post("/internal/execute-job-local")
async def execute_job_local(job_id: str):
    """Local development endpoint to execute jobs directly"""
    try:
        logger.info(f"🔄 Executing job locally: {job_id}")
        
        # Import job runner here to avoid circular imports
        from .job_runner import JobRunner
        
        # Create and run job
        runner = JobRunner()
        await runner.initialize()
        await runner.run_job(job_id)
        
        return {"success": True, "message": f"Job {job_id} completed"}
        
    except Exception as e:
        logger.error(f"❌ Error executing local job: {e}")
        raise HTTPException(status_code=500, detail=f"Error executing job: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
