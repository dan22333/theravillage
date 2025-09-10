from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel


# Auth and Users
class UserRegistrationRequest(BaseModel):
    token: str
    name: str
    org_id: Optional[int] = None


class RoleSelectionRequest(BaseModel):
    token: str
    role: str


# Clients
class ClientCreateRequest(BaseModel):
    name: str
    email: str
    dob: Optional[date] = None
    address: Optional[dict] = None
    school: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    payer_id: Optional[str] = None
    auth_lims: Optional[dict] = None
    goals: Optional[List[str]] = None
    initial_analysis: Optional[str] = None


class ClientInvitationRequest(BaseModel):
    guardian_first_name: str
    guardian_last_name: str
    guardian_email: str
    patient_first_name: str
    patient_last_name: str
    patient_dob: Optional[date] = None


class ClientInvitationResponse(BaseModel):
    success: bool
    message: str
    invitation_id: int


class ClientProfileUpdateRequest(BaseModel):
    address: Optional[dict] = None
    school: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    payer_id: Optional[str] = None
    auth_lims: Optional[dict] = None
    goals: Optional[List[str]] = None
    initial_analysis: Optional[str] = None


# Appointments / Sessions / Notes
class AppointmentCreateRequest(BaseModel):
    client_id: int
    start_ts: datetime
    duration_minutes: int = 60
    location: Optional[dict] = None
    recurring_rule: Optional[str] = None
    recurring_end_date: Optional[date] = None


class AppointmentResponse(BaseModel):
    id: int
    client_id: int
    client_name: str
    therapist_id: int
    start_ts: datetime
    end_ts: datetime
    status: str
    location: Optional[dict] = None


class NoteCreateRequest(BaseModel):
    session_id: int
    type: str = "soap"
    soap: Optional[dict] = None
    goals_checked: Optional[List[str]] = None
    treatment_codes: Optional[List[str]] = None


# Therapist / Agency
class TherapistAgencyAssignmentRequest(BaseModel):
    therapist_id: int
    agency_id: int
    start_date: date
    end_date: Optional[date] = None


