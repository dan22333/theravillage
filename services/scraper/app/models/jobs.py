from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum

class JobType(str, Enum):
    FULL_SCRAPE = "full_scrape"
    INCREMENTAL = "incremental"
    TOPIC_SPECIFIC = "topic_specific"

class JobStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"

class ScrapeJobConfig(BaseModel):
    job_type: JobType = JobType.FULL_SCRAPE
    topics_version: Optional[int] = None  # Auto-use latest if not specified
    specific_topic_ids: Optional[List[int]] = None  # For topic-specific jobs
    max_results_per_topic: int = 10
    tavily_search_depth: str = "advanced"
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None
    force_reprocess: bool = False  # Reprocess even if already processed

class ScrapeJobRequest(BaseModel):
    config: ScrapeJobConfig

class ScrapeJob(BaseModel):
    id: Optional[UUID] = None
    job_type: JobType
    topics_version: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: JobStatus = JobStatus.RUNNING
    topics_processed: int = 0
    tavily_queries_made: int = 0
    tavily_results_received: int = 0
    llm_processing_attempts: int = 0
    treatments_created: int = 0
    vectors_created: int = 0
    errors_encountered: int = 0
    error_log: List[str] = []
    job_config: Optional[Dict[str, Any]] = None
    performance_metrics: Optional[Dict[str, Any]] = None

class ScrapeJobResponse(BaseModel):
    success: bool
    message: str
    job_id: Optional[UUID] = None
    estimated_duration_minutes: Optional[int] = None

class ScrapeJobStatus(BaseModel):
    job: ScrapeJob
    progress_percentage: float
    current_activity: str
    estimated_completion: Optional[datetime] = None
