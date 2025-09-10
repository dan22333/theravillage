#!/usr/bin/env python3
"""
Cleanup Job - Dedicated script for cleaning up stale scraping jobs
Designed to run as a Cloud Run Job triggered by Cloud Scheduler
"""
import asyncio
import sys
import os
import logging
from datetime import datetime, timedelta

# Add the parent directory to Python path
sys.path.insert(0, '/app')

from app.db import init_db, execute_raw_sql
from app.main import load_secrets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class CleanupRunner:
    """Dedicated cleanup runner for scraper maintenance"""
    
    def __init__(self):
        self.job_timeout_hours = int(os.getenv("JOB_TIMEOUT_HOURS", "2"))
        self.dry_run = os.getenv("DRY_RUN", "false").lower() == "true"
    
    async def initialize(self):
        """Initialize database and secrets"""
        try:
            logger.info("🧹 Starting cleanup job...")
            
            # Load secrets from Secret Manager
            await load_secrets()
            
            # Initialize database
            await init_db()
            logger.info("✅ Database initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize cleanup job: {e}")
            raise
    
    async def cleanup_stale_jobs(self):
        """Clean up jobs that have been running too long"""
        try:
            # Calculate cutoff time
            cutoff_time = datetime.now() - timedelta(hours=self.job_timeout_hours)
            logger.info(f"🕒 Looking for jobs started before: {cutoff_time}")
            
            if self.dry_run:
                # Dry run - just count what would be cleaned
                result = await execute_raw_sql("""
                    SELECT id, started_at FROM scrape_jobs 
                    WHERE status = 'running' 
                    AND started_at < :cutoff_time
                """, {"cutoff_time": cutoff_time})
                
                stale_jobs = result.fetchall() if result else []
                logger.info(f"🔍 DRY RUN: Would clean up {len(stale_jobs)} stale jobs")
                
                for job in stale_jobs:
                    age_hours = (datetime.now() - job.started_at).total_seconds() / 3600
                    logger.info(f"  - Job {job.id}: running for {age_hours:.1f} hours")
                
                return len(stale_jobs)
            else:
                # Actually update stale jobs
                result = await execute_raw_sql("""
                    UPDATE scrape_jobs 
                    SET status = :status, 
                        completed_at = :completed_at
                    WHERE status = 'running' 
                    AND started_at < :cutoff_time
                    RETURNING id, started_at
                """, {
                    "status": "failed",
                    "completed_at": datetime.now(),
                    "cutoff_time": cutoff_time
                })
                
                cleaned_jobs = result.fetchall() if result else []
                logger.info(f"🧹 Cleaned up {len(cleaned_jobs)} stale jobs")
                
                for job in cleaned_jobs:
                    age_hours = (datetime.now() - job.started_at).total_seconds() / 3600
                    logger.info(f"  ✅ Cleaned job {job.id}: was running for {age_hours:.1f} hours")
                
                return len(cleaned_jobs)
                
        except Exception as e:
            logger.error(f"❌ Error cleaning up stale jobs: {e}")
            raise
    
    async def run_cleanup(self):
        """Main cleanup execution"""
        try:
            await self.initialize()
            
            cleaned_count = await self.cleanup_stale_jobs()
            
            logger.info(f"🎉 Cleanup job completed: {cleaned_count} jobs processed")
            return cleaned_count
            
        except Exception as e:
            logger.error(f"❌ Cleanup job failed: {e}")
            sys.exit(1)

async def main():
    """Main entry point for cleanup job"""
    logger.info("🚀 Starting scraper cleanup job...")
    
    cleanup = CleanupRunner()
    cleaned_count = await cleanup.run_cleanup()
    
    logger.info(f"✅ Cleanup job finished: {cleaned_count} jobs cleaned")

if __name__ == "__main__":
    asyncio.run(main())
