from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class TreatmentExtraction(BaseModel):
    """Model for LLM treatment extraction response"""
    treatment_name: str = Field(..., description="Clear, descriptive name for the treatment/exercise")
    treatment_description: str = Field(..., description="Comprehensive description of what this treatment involves")
    treatment_objective: Optional[str] = Field(None, description="Primary therapeutic goal or outcome")
    age_range_min: Optional[int] = Field(None, ge=0, le=18, description="Minimum age for this treatment")
    age_range_max: Optional[int] = Field(None, ge=0, le=18, description="Maximum age for this treatment")
    difficulty_level: Optional[str] = Field(None, pattern="^(beginner|intermediate|advanced)$", description="Difficulty level")
    duration_minutes: Optional[int] = Field(None, gt=0, description="Duration in minutes")
    frequency_per_week: Optional[int] = Field(None, gt=0, description="Recommended frequency per week")
    step_by_step_instructions: List[str] = Field(default_factory=list, description="Array of clear instruction steps")
    required_materials: List[str] = Field(default_factory=list, description="Array of materials needed")
    safety_considerations: List[str] = Field(default_factory=list, description="Array of safety notes")
    target_skills: List[str] = Field(default_factory=list, description="Array of skills this addresses")
    contraindications: List[str] = Field(default_factory=list, description="Array of when NOT to use this treatment")
    modifications: List[str] = Field(default_factory=list, description="Array of modifications for different abilities")
    progress_indicators: List[str] = Field(default_factory=list, description="Array of how to measure success")
    evidence_level: Optional[str] = Field(None, pattern="^(research_based|clinical_consensus|expert_opinion)$", description="Evidence level")
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="LLM confidence in extraction (0-1)")

class Treatment(BaseModel):
    """Complete treatment model for database storage"""
    id: Optional[UUID] = None
    scrape_job_id: Optional[UUID] = None
    topic_id: Optional[int] = None
    tavily_result_id: Optional[UUID] = None
    llm_attempt_id: Optional[UUID] = None
    
    # Core Treatment Information
    treatment_name: str
    treatment_description: str
    treatment_objective: Optional[str] = None
    
    # Clinical Details
    age_range_min: Optional[int] = None
    age_range_max: Optional[int] = None
    difficulty_level: Optional[str] = None
    duration_minutes: Optional[int] = None
    frequency_per_week: Optional[int] = None
    
    # Structured Data
    step_by_step_instructions: List[str] = []
    required_materials: List[str] = []
    safety_considerations: List[str] = []
    target_skills: List[str] = []
    contraindications: List[str] = []
    modifications: List[str] = []
    progress_indicators: List[str] = []
    
    # Quality & Evidence
    evidence_level: Optional[str] = None
    source_quality_score: float = 0.0
    llm_confidence_score: float = 0.0
    
    # Source Attribution
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    source_domain: Optional[str] = None
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    quality_reviewed: bool = False
    review_notes: Optional[str] = None

class TreatmentVector(BaseModel):
    """Treatment vector for semantic search"""
    id: Optional[UUID] = None
    treatment_id: UUID
    embedding_text: str
    embedding_model: str = "text-embedding-3-small"
    embedding: Optional[List[float]] = None  # Will be stored as VECTOR in DB
    
    # Denormalized metadata for fast filtering
    topic_category: Optional[str] = None
    age_range_min: Optional[int] = None
    age_range_max: Optional[int] = None
    difficulty_level: Optional[str] = None
    
    created_at: Optional[datetime] = None
