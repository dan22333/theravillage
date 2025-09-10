from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, date
import json

from ..db import get_db
from ..security import get_current_user, require_client, AuthedContext
from ..schemas import ClientProfileUpdateRequest

router = APIRouter()


@router.post("/client/complete-profile")
async def complete_client_profile(
    request: ClientProfileUpdateRequest,
    ctx = Depends(require_client),
    db: AsyncSession = Depends(get_db),
):
    try:

        # Ensure client can only update their own profile
        await db.execute(
            text(
                """
                UPDATE client_profiles 
                SET address = :address, school = :school, diagnosis_codes = :diagnosis_codes,
                    payer_id = :payer_id, auth_lims_json = :auth_lims_json, goals_json = :goals_json
                WHERE user_id = :user_id
                """
            ),
            {
                "user_id": ctx.user_id,
                "address": json.dumps(request.address) if request.address else None,
                "school": request.school,
                "diagnosis_codes": json.dumps(request.diagnosis_codes) if request.diagnosis_codes else None,
                "payer_id": request.payer_id,
                "auth_lims_json": json.dumps(request.auth_lims) if request.auth_lims else None,
                "goals_json": json.dumps(request.goals) if request.goals else None,
            },
        )

        await db.execute(text("UPDATE users SET status = 'active' WHERE id = :user_id"), {"user_id": ctx.user_id})
        await db.commit()
        return {"message": "Profile completed successfully", "status": "active"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to complete profile")


@router.get("/client/profile-status")
async def get_client_profile_status(ctx = Depends(require_client), db: AsyncSession = Depends(get_db)):
    try:

        # Ensure client can only access their own profile
        result = await db.execute(
            text(
                """
                SELECT cp.address, cp.school, cp.diagnosis_codes, cp.payer_id, 
                       cp.auth_lims_json, cp.goals_json, u.status
                FROM client_profiles cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.user_id = :user_id
                """
            ),
            {"user_id": ctx.user_id},
        )

        profile = result.fetchone()
        if not profile:
            return {"profile_complete": False, "status": "incomplete"}

        has_address = profile[0] is not None
        has_school = profile[1] is not None and profile[1].strip() != ""
        has_diagnosis = profile[2] is not None
        has_payer = profile[3] is not None and profile[3].strip() != ""
        has_auth_lims = profile[4] is not None
        has_goals = profile[5] is not None
        is_active = profile[6] == "active"

        profile_complete = has_address and has_school and has_diagnosis and has_payer and has_auth_lims and has_goals
        return {
            "profile_complete": profile_complete,
            "status": "active" if is_active else "incomplete",
            "missing_fields": {
                "address": not has_address,
                "school": not has_school,
                "diagnosis_codes": not has_diagnosis,
                "payer_id": not has_payer,
                "auth_lims": not has_auth_lims,
                "goals": not has_goals,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to check profile status")

@router.get("/client/profile")
async def get_client_profile(
    current_user: AuthedContext = Depends(require_client),
    db: AsyncSession = Depends(get_db)
):
    """Get client profile including assigned therapist information"""
    try:
        # Get therapist assignment first
        assignment_query = text("""
            SELECT ta.therapist_id, ta.start_date, ta.capacity_pct, ta.status,
                   u.name as therapist_name, u.email as therapist_email
            FROM therapist_assignments ta
            JOIN users u ON ta.therapist_id = u.id
            WHERE ta.client_id = :client_id AND ta.status = 'active'
        """)
        
        assignment_result = await db.execute(assignment_query, {"client_id": current_user.user_id})
        assignment = assignment_result.fetchone()
        
        therapist_assignment = None
        if assignment:
            therapist_assignment = {
                "therapist_id": assignment[0],
                "therapist_name": assignment[4],
                "therapist_email": assignment[5],
                "assignment_start": assignment[1].isoformat() if assignment[1] else None,
                "capacity_pct": assignment[2],
                "status": assignment[3]
            }

        return {
            "therapist_assignment": therapist_assignment
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get client profile: {str(e)}")

@router.get("/client/appointments")
async def get_client_appointments(
    current_user: AuthedContext = Depends(require_client),
    db: AsyncSession = Depends(get_db)
):
    """Get all appointments for the current client"""
    try:
        from .timezone_utils import from_utc_to_app_timezone
        
        query = text("""
            SELECT a.id, a.start_ts, a.end_ts, a.status, a.location,
                   u.name as therapist_name, a.scheduling_request_id,
                   a.created_at, a.updated_at
            FROM appointments a
            JOIN users u ON a.therapist_id = u.id
            WHERE a.client_id = :client_id AND a.status != 'cancelled'
            ORDER BY a.start_ts DESC
        """)
        
        result = await db.execute(query, {"client_id": current_user.user_id})
        appointments = []
        
        for row in result.fetchall():
            appointment = {
                "id": row.id,
                "start_ts": from_utc_to_app_timezone(row.start_ts).isoformat(),
                "end_ts": from_utc_to_app_timezone(row.end_ts).isoformat(),
                "status": row.status,
                "location": row.location,
                "therapist_name": row.therapist_name,
                "scheduling_request_id": row.scheduling_request_id,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            appointments.append(appointment)
        
        return {"appointments": appointments}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch appointments: {str(e)}")

@router.get("/client/notifications")
async def get_client_notifications(
    current_user: AuthedContext = Depends(require_client),
    db: AsyncSession = Depends(get_db)
):
    """Get notifications for the current client"""
    try:
        query = text("""
            SELECT id, type, title, message, is_read, created_at,
                   related_request_id, related_appointment_id
            FROM calendar_notifications 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC 
            LIMIT 20
        """)
        
        result = await db.execute(query, {"user_id": current_user.user_id})
        notifications = []
        
        for row in result.fetchall():
            notification = {
                "id": row.id,
                "type": row.type,
                "title": row.title,
                "message": row.message,
                "is_read": row.is_read,
                "created_at": row.created_at.isoformat(),
                "related_request_id": row.related_request_id,
                "related_appointment_id": row.related_appointment_id
            }
            notifications.append(notification)
        
        return {"notifications": notifications}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")


