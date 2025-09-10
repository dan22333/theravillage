#!/usr/bin/env python3
"""
Job Runner - Executes scraping jobs in Cloud Run Jobs
This script runs as a separate Cloud Run Job instance
"""
import asyncio
import sys
import os
import logging
from datetime import datetime

# Add the parent directory to Python path
sys.path.insert(0, '/app')

from app.database import init_db, execute_raw_sql, fetch_one, fetch_all
from app.services.topic_seeder import TopicSeeder
from app.services.tavily_client import TavilyClient
from app.main import load_secrets, settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class JobRunner:
    """Runs scraping jobs in isolated Cloud Run Job instances"""
    
    def __init__(self):
        self.tavily_client = None
        self.topic_seeder = None
    
    async def initialize(self):
        """Initialize services"""
        try:
            logger.info("🚀 Initializing job runner...")
            
            # Load secrets from Secret Manager
            await load_secrets()
            
            # Initialize database
            await init_db()
            logger.info("✅ Database initialized")
            
            # Initialize services
            self.topic_seeder = TopicSeeder()
            self.tavily_client = TavilyClient()
            logger.info("✅ Services initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize job runner: {e}")
            raise
    
    async def run_job(self, job_id: str):
        """Run a specific scraping job"""
        try:
            logger.info(f"🔄 Starting scraping job: {job_id}")
            
            # Get job details from database
            job_data = await self._get_job_data(job_id)
            if not job_data:
                logger.error(f"❌ Job not found: {job_id}")
                return
            
            # Get topics for this job
            topics = await self.topic_seeder.get_topics_by_version(job_data["topics_version"])
            if not topics:
                await self._update_job_status(job_id, "failed", "No topics found for version")
                return
            
            logger.info(f"📋 Processing {len(topics)} topics for job {job_id}")
            
            # Update job start time
            await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET started_at = :started_at
                WHERE id = :job_id
            """, {
                "job_id": job_id,
                "started_at": datetime.now()
            })
            
            # Process each topic
            topics_processed = 0
            tavily_queries_made = 0
            tavily_results_received = 0
            errors_encountered = 0
            
            for i, topic in enumerate(topics):
                try:
                    # Check if job was cancelled
                    job_status_check = await fetch_one("""
                        SELECT status FROM scrape_jobs WHERE id = :job_id
                    """, {"job_id": job_id})
                    
                    if job_status_check and job_status_check.status == "cancelled":
                        logger.info(f"🛑 Job {job_id} was cancelled, stopping execution")
                        return
                    
                    logger.info(f"🔍 Processing topic {i+1}/{len(topics)}: {topic['topic_name']}")
                    
                    # Search with Tavily
                    try:
                        tavily_response = await self.tavily_client.search_topic(topic, job_id)
                        
                        if tavily_response:
                            tavily_queries_made += 1
                            tavily_results_received += tavily_response.total_results_count
                            logger.info(f"✅ Processed topic: {topic['topic_name']} - {tavily_response.total_results_count} results")
                        else:
                            logger.warning(f"⚠️ No results for topic: {topic['topic_name']}")
                        
                        # Always count as processed (attempted)
                        topics_processed += 1
                        
                    except Exception as e:
                        logger.error(f"❌ Error processing topic {topic['topic_name']}: {e}")
                        # Still count as processed (attempted)
                        topics_processed += 1
                        errors_encountered += 1
                    
                    # Update progress in database every 5 topics (batch updates for performance)
                    if (i + 1) % 5 == 0 or (i + 1) == len(topics):
                        await execute_raw_sql("""
                            UPDATE scrape_jobs 
                            SET topics_processed = :topics_processed,
                                tavily_queries_made = :tavily_queries_made,
                                tavily_results_received = :tavily_results_received
                            WHERE id = :job_id
                        """, {
                            "job_id": job_id,
                            "topics_processed": topics_processed,
                            "tavily_queries_made": tavily_queries_made,
                            "tavily_results_received": tavily_results_received
                        })
                        logger.info(f"📊 Progress update: {topics_processed}/{len(topics)} topics completed")
                    
                    # Rate limiting between topics
                    await asyncio.sleep(2)
                    
                except Exception as e:
                    logger.error(f"❌ Error processing topic {topic['topic_name']}: {e}")
                    errors_encountered += 1
                    continue
            
            # Update final job status
            final_status = "completed" if errors_encountered == 0 else "partial"
            await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET status = :status, 
                    completed_at = :completed_at,
                    topics_processed = :topics_processed,
                    tavily_queries_made = :tavily_queries_made,
                    tavily_results_received = :tavily_results_received,
                    errors_encountered = :errors_encountered
                WHERE id = :job_id
            """, {
                "job_id": job_id,
                "status": final_status,
                "completed_at": datetime.now(),
                "topics_processed": topics_processed,
                "tavily_queries_made": tavily_queries_made,
                "tavily_results_received": tavily_results_received,
                "errors_encountered": errors_encountered
            })
            
            logger.info(f"🎉 Job {job_id} completed: {topics_processed}/{len(topics)} topics processed, {errors_encountered} errors")
            
        except Exception as e:
            logger.error(f"❌ Fatal error in scraping job {job_id}: {e}")
            await self._update_job_status(job_id, "failed", str(e))
    
    async def _create_cloud_run_job(self, job_name: str, job_id: str, config: ScrapeJobConfig) -> bool:
        """Create and execute Cloud Run Job"""
        try:
            cmd = [
                "gcloud", "run", "jobs", "create", job_name,
                "--image", self.image_url,
                "--region", self.region,
                "--project", self.project_id,
                "--max-retries", "2",
                "--parallelism", "1", 
                "--task-count", "1",
                "--task-timeout", "3600",  # 1 hour
                "--cpu", "2",
                "--memory", "2Gi",
                "--set-env-vars", f"ENVIRONMENT=production,SCRAPER_JOB_ID={job_id}",
                "--command", "python",
                "--args", f"-m,app.job_runner,{job_id}",
                "--quiet"
            ]
            
            # Create the job
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                logger.error(f"❌ Failed to create job: {result.stderr}")
                return False
            
            # Execute the job
            exec_cmd = [
                "gcloud", "run", "jobs", "execute", job_name,
                "--region", self.region,
                "--project", self.project_id,
                "--async",  # Don't wait for completion
                "--quiet"
            ]
            
            exec_result = subprocess.run(exec_cmd, capture_output=True, text=True, timeout=30)
            
            if exec_result.returncode == 0:
                logger.info(f"🚀 Successfully started job execution: {job_name}")
                return True
            else:
                logger.error(f"❌ Failed to execute job: {exec_result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error with Cloud Run Job: {e}")
            return False
    
    async def _get_job_data(self, job_id: str) -> Dict:
        """Get job configuration from database"""
        result = await fetch_one("""
            SELECT job_type, topics_version, job_config
            FROM scrape_jobs 
            WHERE id = :job_id
        """, {"job_id": job_id})
        
        if result:
            return {
                "job_type": result.job_type,
                "topics_version": result.topics_version,
                "job_config": result.job_config
            }
        return None
    
    async def _update_job_status(self, job_id: str, status: str, message: str = None):
        """Update job status in database"""
        try:
            await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET status = :status, 
                    completed_at = CASE WHEN :status IN ('completed', 'failed', 'partial') 
                                   THEN :completed_at ELSE completed_at END
                WHERE id = :job_id
            """, {
                "job_id": job_id,
                "status": status,
                "completed_at": datetime.now()
            })
            
            if message:
                logger.info(f"📊 Job {job_id}: {message}")
                
        except Exception as e:
            logger.error(f"❌ Error updating job status: {e}")

async def main():
    """Main entry point for job runner"""
    if len(sys.argv) < 2:
        logger.error("❌ Usage: python -m app.job_runner <job_id>")
        sys.exit(1)
    
    job_id = sys.argv[1]
    logger.info(f"🎯 Starting job runner for job: {job_id}")
    
    runner = JobRunner()
    await runner.initialize()
    await runner.run_job(job_id)
    
    logger.info(f"✅ Job runner completed for job: {job_id}")

if __name__ == "__main__":
    asyncio.run(main())
