"""
Cloud Tasks Manager - Professional job scheduling
Uses Cloud Tasks to trigger job execution in same container via HTTP
"""
import asyncio
import logging
import os
import json
from typing import Dict, List
from uuid import uuid4
from datetime import datetime, timedelta

from ..db import execute_raw_sql, fetch_one
from ..models.jobs import ScrapeJobConfig, JobStatus

logger = logging.getLogger(__name__)

class CloudTasksManager:
    """Manages scraping jobs via Cloud Tasks → HTTP endpoint"""
    
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "theravillage-edb89")
        self.region = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
        self.queue_name = "scraper-jobs"
        self.environment = os.getenv("ENVIRONMENT", "development")
        
        # Service URL (Terraform provides this for production)
        self.service_url = os.getenv("SCRAPER_SERVICE_URL", "http://localhost:8002")
        logger.info(f"🔗 Service URL: {self.service_url}")
    
        
        # Initialize Cloud Tasks client for production
        self.tasks_client = None
        self.queue_path = None
        
        if self.environment == "production":
            try:
                from google.cloud import tasks_v2
                self.tasks_client = tasks_v2.CloudTasksAsyncClient()
                self.queue_path = self.tasks_client.queue_path(
                    self.project_id, self.region, self.queue_name
                )
                logger.info(f"✅ Cloud Tasks client initialized for queue: {self.queue_name}")
            except Exception as e:
                logger.warning(f"⚠️ Cloud Tasks not available: {e}")
                self.tasks_client = None
    
    async def create_tavily_scraping_job(self, config: ScrapeJobConfig, topics: List[Dict]) -> Dict:
        """Create a new Tavily scraping job via Cloud Tasks"""
        try:
            # Generate unique job ID
            job_id = str(uuid4())
            
            # Create job record in database
            await self._create_tavily_job_record(job_id, config, len(topics))
            
            if self.environment == "production":
                # Use Cloud Tasks to trigger job execution
                success = await self._create_tavily_cloud_task(job_id, config)
                if not success:
                    await self._update_tavily_job_status(job_id, JobStatus.FAILED, "Failed to create Cloud Task")
                    return {"success": False, "message": "Failed to create Cloud Task", "job_id": job_id}
            else:
                # Local development fallback - use the same TavilyRunner logic as production
                asyncio.create_task(self._execute_tavily_job_local(job_id))
            
            return {
                "success": True,
                "message": "Scraping job created successfully",
                "job_id": job_id,
                "estimated_duration_minutes": len(topics) * 2
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating scraping job: {e}")
            return {"success": False, "message": str(e), "job_id": None}
    
    async def _create_tavily_cloud_task(self, job_id: str, config: ScrapeJobConfig) -> bool:
        """Create Cloud Task to trigger Tavily job execution"""
        try:
            if not self.tasks_client:
                logger.error("❌ Cloud Tasks client not initialized")
                return False
            
            # Task payload
            task_payload = {
                "job_id": job_id,
                "config": config.dict()
            }
            
            # Create HTTP task that calls our own /internal/execute-job endpoint
            from google.cloud import tasks_v2
            task = {
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": f"{self.service_url}/internal/execute-job",
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps(task_payload).encode(),
                }
            }
            
            # Submit task to queue
            response = await self.tasks_client.create_task(
                parent=self.queue_path,
                task=task
            )
            
            logger.info(f"✅ Created Cloud Task: {response.name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error creating Cloud Task: {e}")
            return False
    
    async def _create_tavily_job_record(self, job_id: str, config: ScrapeJobConfig, topic_count: int):
        """Create initial Tavily job record in database"""
        import json
        
        await execute_raw_sql("""
            INSERT INTO scrape_jobs (id, job_type, topics_version, job_config, status)
            VALUES (:job_id, :job_type, :topics_version, :job_config, :status)
        """, {
            "job_id": job_id,
            "job_type": config.job_type.value,  # Convert enum to string
            "topics_version": config.topics_version,
            "job_config": json.dumps(config.dict()),  # Serialize to JSON string
            "status": JobStatus.RUNNING.value  # Convert enum to string
        })
        logger.info(f"✅ Created job record: {job_id}")
    
    async def _execute_tavily_job_local(self, job_id: str):
        """Execute Tavily job locally using the same logic as production"""
        try:
            logger.info(f"🔄 Executing job locally: {job_id}")
            
            # Call the same function that production uses
            from ..main import execute_tavily_job_internal
            
            # Create the same request structure that Cloud Tasks would send
            request = {
                "job_id": job_id,
                "config": {}  # Config is already in database, not needed here
            }
            
            await execute_tavily_job_internal(request)
            logger.info(f"✅ Local job execution completed: {job_id}")
                
        except Exception as e:
            logger.error(f"❌ Error executing local job: {e}")
            await self._update_tavily_job_status(job_id, JobStatus.FAILED, f"Local execution failed: {str(e)}")

    
    async def _update_tavily_job_status(self, job_id: str, status: JobStatus, message: str = None):
        """Update Tavily job status in database"""
        try:
            update_data = {
                "job_id": job_id,
                "status": status.value if hasattr(status, 'value') else status,  # Handle enum
                "updated_at": datetime.now()
            }
            
            status_value = status.value if hasattr(status, 'value') else status
            if status_value in ["completed", "failed", "partial"]:
                update_data["completed_at"] = datetime.now()
            
            await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET status = :status, 
                    completed_at = COALESCE(:completed_at, completed_at)
                WHERE id = :job_id
            """, update_data)
            
            if message:
                logger.info(f"📊 Job {job_id}: {message}")
                
        except Exception as e:
            logger.error(f"❌ Error updating job status: {e}")
    
    async def get_tavily_job_status(self, job_id: str) -> Dict:
        """Get Tavily job status from database"""
        try:
            result = await fetch_one("""
                SELECT id, job_type, status, topics_processed, treatments_created, 
                       started_at, completed_at, errors_encountered, topics_version
                FROM scrape_jobs 
                WHERE id = :job_id
            """, {"job_id": job_id})
            
            if not result:
                return {"error": "Job not found"}
            
            # Calculate progress
            topics_total = len(await self._get_topics_for_tavily_job(result.topics_version))
            progress = (result.topics_processed / topics_total * 100) if topics_total > 0 else 0
            
            return {
                "job_id": job_id,
                "status": result.status,
                "progress_percentage": round(progress, 2),
                "topics_processed": result.topics_processed,
                "topics_total": topics_total,
                "treatments_created": result.treatments_created,
                "errors_encountered": result.errors_encountered,
                "started_at": result.started_at,
                "completed_at": result.completed_at,
                "current_activity": self._get_tavily_activity_from_status(result.status)
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting job status: {e}")
            return {"error": str(e)}
    
    async def _get_topics_for_tavily_job(self, topics_version: int) -> List[Dict]:
        """Get topics for a Tavily job version"""
        from .topic_seeder import TopicSeeder
        seeder = TopicSeeder()
        return await seeder.get_topics_by_version(topics_version)
    
    def _get_tavily_activity_from_status(self, status: str) -> str:
        """Get current Tavily activity description from status"""
        activity_map = {
            "running": "Scraping web content...",
            "completed": "Completed successfully",
            "failed": "Failed with errors",
            "partial": "Completed with some errors",
            "cancelled": "Cancelled by user"
        }
        return activity_map.get(status, "Unknown status")
    
    async def cancel_tavily_job(self, job_id: str) -> Dict:
        """Cancel a running Tavily scraping job"""
        try:
            # Check if job exists and is running
            result = await fetch_one("""
                SELECT id, status FROM scrape_jobs WHERE id = :job_id
            """, {"job_id": job_id})
            
            if not result:
                return {"success": False, "message": "Job not found"}
            
            if result.status != "running":
                return {"success": False, "message": f"Job is not running (status: {result.status})"}
            
            # Update job status to cancelled
            await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET status = :status, completed_at = :completed_at
                WHERE id = :job_id
            """, {
                "job_id": job_id,
                "status": JobStatus.CANCELLED.value,
                "completed_at": datetime.now()
            })
            
            logger.info(f"✅ Job cancelled: {job_id}")
            return {"success": True, "message": f"Job {job_id} cancelled successfully"}
            
        except Exception as e:
            logger.error(f"❌ Error cancelling job: {e}")
            return {"success": False, "message": str(e)}
    
    async def cleanup_stale_tavily_jobs(self, timeout_hours: int = 2) -> Dict:
        """Cancel Tavily jobs that have been running too long"""
        try:
            # Find jobs running longer than timeout
            cutoff_time = datetime.now() - timedelta(hours=timeout_hours)
            
            result = await execute_raw_sql("""
                UPDATE scrape_jobs 
                SET status = :status, completed_at = :completed_at
                WHERE status = 'running' 
                AND started_at < :cutoff_time
                RETURNING id
            """, {
                "status": JobStatus.FAILED.value,
                "completed_at": datetime.now(),
                "cutoff_time": cutoff_time
            })
            
            cancelled_count = result.rowcount if result else 0
            
            logger.info(f"🧹 Cleaned up {cancelled_count} stale jobs")
            return {
                "success": True, 
                "message": f"Cleaned up {cancelled_count} stale jobs",
                "cancelled_count": cancelled_count
            }
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up stale jobs: {e}")
            return {"success": False, "message": str(e)}
