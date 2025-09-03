from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ExerciseRecommendationRequest(BaseModel):
    client_age: int = Field(..., description="Client age in years")
    diagnosis: str = Field(..., description="Primary diagnosis or condition")
    goals: List[str] = Field(..., description="Therapy goals")
    equipment_available: Optional[List[str]] = Field(default=[], description="Available equipment")
    difficulty_level: Optional[str] = Field(default="moderate", description="Desired difficulty level")
    session_duration: Optional[int] = Field(default=30, description="Session duration in minutes")
    session_activities: Optional[List[str]] = Field(default=[], description="Activities from current session")


class ExerciseRecommendation(BaseModel):
    exercise_id: str
    title: str
    description: str
    instructions: str
    difficulty: str
    age_appropriateness: str
    equipment_needed: List[str]
    estimated_duration: int
    confidence_score: float
    reasoning: str

class SOAPNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    synthesized_summary: str
    short_term_goals: List[str]
    long_term_goals: List[str]
    goals_addressed: List[str]
    next_session_recommendations: List[str]
    confidence_score: float
    time_in: Optional[str] = None
    time_out: Optional[str] = None
    units: Optional[int] = None
    treatment_codes: Optional[List[str]] = None

class HomeworkPlan(BaseModel):
    exercises: List[ExerciseRecommendation]
    frequency: str
    duration: str
    instructions: str
    parent_guidance: str
    progress_tracking: str

class SessionAnalysis(BaseModel):
    key_insights: List[str]
    goal_progress: Dict[str, float]
    recommendations: List[str]
    risk_factors: List[str]
    next_steps: List[str]

class ExerciseSearchResult(BaseModel):
    exercise_id: str
    title: str
    description: str
    tags: List[str]
    difficulty: str
    age_group: str
    relevance_score: float
    instructions: str
