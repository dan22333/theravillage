from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TreatmentTopic(BaseModel):
    id: Optional[int] = None
    topic_name: str
    category: str
    subcategory: Optional[str] = None
    search_keywords: List[str]
    age_range_min: int = 0
    age_range_max: int = 18
    description: Optional[str] = None
    version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True

class TopicSeedRequest(BaseModel):
    categories: Optional[List[str]] = None  # If None, generate all categories
    version: int = 1
    overwrite_existing: bool = False

class TopicSeedResponse(BaseModel):
    success: bool
    message: str
    topics_created: int
    version: int
