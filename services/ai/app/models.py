from pydantic import BaseModel
from typing import List, Optional


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

