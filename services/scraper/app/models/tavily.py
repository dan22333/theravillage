from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class TavilyResult(BaseModel):
    """Individual result from Tavily API response"""
    url: str
    title: Optional[str] = None
    content: str
    raw_content: Optional[str] = None
    score: float

class TavilyResponse(BaseModel):
    """Complete Tavily API response structure"""
    query: str
    follow_up_questions: Optional[List[str]] = None
    answer: Optional[str] = None
    images: List[str] = []
    results: List[TavilyResult]
    response_time: float
    request_id: str

class TavilyQuery(BaseModel):
    """Tavily query request model"""
    query: str
    search_depth: str = "advanced"  # "basic" or "advanced"
    max_results: int = 10
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None
    include_answer: bool = True
    include_raw_content: bool = False

class TavilyResponseRecord(BaseModel):
    """Database model for storing Tavily responses"""
    id: Optional[UUID] = None
    scrape_job_id: UUID
    topic_id: int
    
    # Request details
    query_text: str
    search_depth: str
    max_results: int
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None
    
    # Response data
    tavily_query: str
    follow_up_questions: Optional[List[str]] = None
    answer: Optional[str] = None
    images: List[str] = []
    response_time: float
    request_id: str
    
    # Metadata
    created_at: Optional[datetime] = None
    total_results_count: int = 0

class TavilyResultRecord(BaseModel):
    """Database model for storing individual Tavily results"""
    id: Optional[UUID] = None
    tavily_response_id: UUID
    
    # Result data
    url: str
    title: Optional[str] = None
    content: str
    raw_content: Optional[str] = None
    score: float
    
    # Our analysis
    content_length: int
    domain: Optional[str] = None
    is_academic_source: bool = False
    is_clinical_source: bool = False
    source_credibility_score: Optional[float] = None
    
    # Processing status
    llm_processed: bool = False
    processing_error: Optional[str] = None
    created_at: Optional[datetime] = None
