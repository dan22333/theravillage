from datetime import date, datetime, timedelta
import json
import os
from typing import List
from dotenv import load_dotenv
from dateutil.parser import parse as parse_datetime

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Load environment variables from .env file
load_dotenv()

from ..db import get_db
from ..security import require_therapist, require_admin
from ..schemas import (
    ClientCreateRequest,
    ClientInvitationRequest,
    ClientInvitationResponse,
    AppointmentCreateRequest,
    TherapistAgencyAssignmentRequest,
)

router = APIRouter()


@router.get("/therapist/clients")
async def get_therapist_clients(
    ctx = Depends(require_therapist), 
    db: AsyncSession = Depends(get_db),
    search: str = None,
    limit: int = 5
):
    if search:
        # Search clients by name (case-insensitive)
        result = await db.execute(
            text(
                """
                SELECT u.id, u.name, u.email, u.status, cp.dob, cp.school, ta.start_date, ta.capacity_pct
                FROM users u
                JOIN client_profiles cp ON u.id = cp.user_id
                JOIN therapist_assignments ta ON u.id = ta.client_id
                WHERE ta.therapist_id = :therapist_id 
                AND u.role = 'client' 
                AND u.status = 'active'
                AND LOWER(u.name) LIKE LOWER(:search_pattern)
                ORDER BY u.name
                LIMIT :limit
                """
            ),
            {
                "therapist_id": ctx.user_id,
                "search_pattern": f"%{search}%",
                "limit": limit
            },
        )
    else:
        # Get all clients
        result = await db.execute(
            text(
                """
                SELECT u.id, u.name, u.email, u.status, cp.dob, cp.school, ta.start_date, ta.capacity_pct
                FROM users u
                JOIN client_profiles cp ON u.id = cp.user_id
                JOIN therapist_assignments ta ON u.id = ta.client_id
                WHERE ta.therapist_id = :therapist_id AND u.role = 'client' AND u.status = 'active'
                ORDER BY u.name
                """
            ),
            {"therapist_id": ctx.user_id},
        )
    
    clients = [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "status": row[3],
            "dob": row[4],
            "school": row[5],
            "assignment_start": row[6],
            "capacity_pct": row[7],
        }
        for row in result.fetchall()
    ]
    return {"clients": clients}


@router.get("/therapist/clients/{client_id}")
async def get_client_details(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    # Verify the client belongs to this therapist
    result = await db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.status, cp.dob, cp.school, ta.start_date, ta.capacity_pct
            FROM users u
            JOIN client_profiles cp ON u.id = cp.user_id
            JOIN therapist_assignments ta ON u.id = ta.client_id
            WHERE ta.therapist_id = :therapist_id 
            AND u.id = :client_id 
            AND u.role = 'client' 
            AND u.status = 'active'
            """
        ),
        {"therapist_id": ctx.user_id, "client_id": client_id},
    )
    
    client = result.fetchone()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {
        "id": client[0],
        "name": client[1],
        "email": client[2],
        "status": client[3],
        "dob": client[4],
        "school": client[5],
        "assignment_start": client[6],
        "capacity_pct": client[7],
    }


@router.delete("/therapist/clients/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    # Verify the client is assigned to this therapist
    assignment_check = await db.execute(
        text(
            """
            SELECT 1
            FROM therapist_assignments ta
            JOIN users u ON u.id = ta.client_id
            WHERE ta.therapist_id = :therapist_id
              AND ta.client_id = :client_id
              AND u.role = 'client'
            """
        ),
        {"therapist_id": ctx.user_id, "client_id": client_id},
    )
    if assignment_check.fetchone() is None:
        raise HTTPException(status_code=404, detail="Client not found or not assigned to you")

    # Delete the client user (ON DELETE CASCADE will remove dependents)
    await db.execute(text("DELETE FROM users WHERE id = :client_id"), {"client_id": client_id})
    await db.commit()
    # 204 No Content
    return


@router.get("/therapist/clients/{client_id}/sessions")
async def get_client_sessions(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    # Verify the client belongs to this therapist
    client_check = await db.execute(
        text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
        {"therapist_id": ctx.user_id, "client_id": client_id}
    )
    if not client_check.fetchone():
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get sessions with notes (updated for new schema)
    result = await db.execute(
        text(
            """
            SELECT s.id, s.start_time, s.duration_minutes, s.treatment_codes, s.note_status, s.created_at,
                   n.id as note_id, n.type, n.soap, n.final_text
            FROM sessions s
            LEFT JOIN notes n ON s.id = n.session_id
            WHERE s.client_id = :client_id
            ORDER BY s.created_at DESC
            """
        ),
        {"client_id": client_id},
    )
    
    sessions = {}
    for row in result.fetchall():
        session_id = row[0]
        if session_id not in sessions:
            sessions[session_id] = {
                "id": session_id,
                "start_time": row[1],
                "duration_minutes": row[2],
                "treatment_codes": row[3],
                "note_status": row[4],
                "created_at": row[5],
                "notes": []
            }
        
        if row[6]:  # note_id exists
            sessions[session_id]["notes"].append({
                "id": row[6],
                "type": row[7],
                "soap": row[8],
                "final_text": row[9]
            })
    
    return {"sessions": list(sessions.values())}


@router.get("/therapist/clients/{client_id}/goals")
async def get_client_goals(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    print(f"🔍 DEBUG: Goals request for client {client_id} from therapist {ctx.user_id}")
    # Verify the client belongs to this therapist
    client_check = await db.execute(
        text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
        {"therapist_id": ctx.user_id, "client_id": client_id}
    )
    if not client_check.fetchone():
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get goals from client_profiles first (simple text goals)
    profile_result = await db.execute(
        text(
            """
            SELECT goals_json
            FROM client_profiles
            WHERE user_id = :client_id
            """
        ),
        {"client_id": client_id},
    )
    
    goals = []
    profile_row = profile_result.fetchone()
    if profile_row and profile_row[0]:
        # Handle both string JSON and already parsed list
        if isinstance(profile_row[0], str):
            profile_goals = json.loads(profile_row[0])
        else:
            profile_goals = profile_row[0]  # Already a list
            
        for i, goal_text in enumerate(profile_goals):
            goals.append({
                "id": f"profile_{i}",
                "title": goal_text,
                "description": "",
                "status": "active",
                "progress": 0,
                "created_at": None,
                "target_date": None
            })
    
    # Also get goals from homework_plans
    homework_result = await db.execute(
        text(
            """
            SELECT id, items, completion_rate, created_at
            FROM homework_plans
            WHERE client_id = :client_id
            ORDER BY created_at DESC
            """
        ),
        {"client_id": client_id},
    )
    
    for row in homework_result.fetchall():
        items = json.loads(row[1]) if row[1] else []
        for item in items:
            goals.append({
                "id": f"homework_{row[0]}_{item.get('id', 'unknown')}",
                "title": item.get('title', 'Untitled Goal'),
                "description": item.get('description', ''),
                "status": item.get('status', 'pending'),
                "progress": row[2] or 0,
                "created_at": row[3],
                "target_date": item.get('target_date')
            })
    
    return {"goals": goals}


@router.get("/therapist/clients/{client_id}/recommendations")
async def get_client_recommendations(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    # Verify the client belongs to this therapist
    client_check = await db.execute(
        text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
        {"therapist_id": ctx.user_id, "client_id": client_id}
    )
    if not client_check.fetchone():
        raise HTTPException(status_code=404, detail="Client not found")
    
    # For now, return empty recommendations (can be populated with AI recommendations later)
    return {"recommendations": []}


@router.post("/therapist/clients/invite")
async def invite_client(
    request: ClientInvitationRequest,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    print(f"🔍 INVITE DEBUG: Starting invite process for {request.email}")
    print(f"🔍 INVITE DEBUG: Therapist ID: {ctx.user_id}")
    print(f"🔍 INVITE DEBUG: Request data: {request}")
    
    try:
        invitation_token = str(json.loads(json.dumps(str(datetime.utcnow().timestamp()))))  # cheap unique, kept simple
        expires_at = datetime.now() + timedelta(days=7)
        
        print(f"🔍 INVITE DEBUG: Generated token: {invitation_token}")
        print(f"🔍 INVITE DEBUG: Expires at: {expires_at}")

        print(f"🔍 INVITE DEBUG: Attempting to insert into pending_clients table...")
        result = await db.execute(
            text(
                """
                INSERT INTO pending_clients (
                    therapist_id, email, name, dob, invitation_token, expires_at
                ) VALUES (
                    :therapist_id, :email, :name, :dob, :invitation_token, :expires_at
                ) RETURNING id
                """
            ),
            {
                "therapist_id": ctx.user_id,
                "email": request.email,
                "name": request.name,
                "dob": request.dob,
                "invitation_token": invitation_token,
                "expires_at": expires_at,
            },
        )
        invitation_id = result.fetchone()[0]
        print(f"🔍 INVITE DEBUG: Successfully inserted invitation with ID: {invitation_id}")

        print(f"🔍 INVITE DEBUG: Fetching therapist name...")
        therapist_result = await db.execute(text("SELECT name FROM users WHERE id = :therapist_id"), {"therapist_id": ctx.user_id})
        therapist_name = therapist_result.fetchone()[0]
        print(f"🔍 INVITE DEBUG: Therapist name: {therapist_name}")

        # Call Cloud Function to send email
        print(f"🔍 INVITE DEBUG: Calling Cloud Function...")
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                # Get frontend URL from environment variable
                frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
                
                cloud_function_data = {
                    "clientEmail": request.email,
                    "clientName": request.name,
                    "therapistName": therapist_name,
                    "invitationToken": invitation_token,
                    "frontendUrl": frontend_url
                }
                print(f"🔍 INVITE DEBUG: Cloud Function payload: {cloud_function_data}")
                
                response = await client.post(
                    "https://us-central1-theravillage-edb89.cloudfunctions.net/sendClientInvitation",
                    json=cloud_function_data,
                    timeout=30.0
                )
                print(f"🔍 INVITE DEBUG: Cloud Function response status: {response.status_code}")
                print(f"🔍 INVITE DEBUG: Cloud Function response body: {response.text}")
                
                if response.status_code != 200:
                    print(f"⚠️ Cloud Function error: {response.status_code} - {response.text}")
                else:
                    print(f"✅ Email sent successfully to {request.email}")
        except Exception as e:
            print(f"⚠️ Failed to call Cloud Function: {e}")
            print(f"🔍 INVITE DEBUG: Cloud Function exception details: {type(e).__name__}: {str(e)}")
            # Continue anyway - the invitation is still created

        print(f"🔍 INVITE DEBUG: Committing transaction...")
        await db.commit()
        print(f"🔍 INVITE DEBUG: Transaction committed successfully")
        
        return ClientInvitationResponse(success=True, message=f"Invitation sent to {request.email}", invitation_id=invitation_id)
    except Exception as e:
        print(f"❌ INVITE ERROR: Exception occurred: {type(e).__name__}: {str(e)}")
        print(f"❌ INVITE ERROR: Exception details: {e}")
        await db.rollback()
        print(f"❌ INVITE ERROR: Transaction rolled back")
        raise HTTPException(status_code=500, detail=f"Failed to create client invitation: {str(e)}")


@router.post("/therapist/clients")
async def create_client(request: ClientCreateRequest, ctx = Depends(require_therapist), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            text(
                """
                INSERT INTO users (org_id, name, email, role, status)
                VALUES (:org_id, :name, :email, 'client', 'active')
                RETURNING id
                """
            ),
            {"org_id": ctx.org_id, "name": request.name, "email": request.email},
        )
        client_user_id = result.fetchone()[0]

        await db.execute(
            text(
                """
                INSERT INTO client_profiles (user_id, dob, address, school, diagnosis_codes, payer_id, auth_lims_json, goals_json)
                VALUES (:user_id, :dob, :address, :school, :diagnosis_codes, :payer_id, :auth_lims, :goals)
                """
            ),
            {
                "user_id": client_user_id,
                "dob": request.dob,
                "address": request.address,
                "school": request.school,
                "diagnosis_codes": request.diagnosis_codes,
                "payer_id": request.payer_id,
                "auth_lims": request.auth_lims,
                "goals": request.goals,
            },
        )

        await db.execute(
            text(
                """
                INSERT INTO therapist_assignments (therapist_id, client_id, start_date)
                VALUES (:therapist_id, :client_id, :start_date)
                """
            ),
            {"therapist_id": ctx.user_id, "client_id": client_user_id, "start_date": date.today()},
        )

        await db.commit()
        return {"message": "Client created successfully", "client_id": client_user_id, "name": request.name, "email": request.email}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create client: {str(e)}")


@router.put("/therapist/clients/{client_id}")
async def update_client(
    client_id: int,
    request: ClientCreateRequest,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing client"""
    try:
        # Verify client is assigned to therapist
        result = await db.execute(
            text(
                """
                SELECT 1 FROM therapist_assignments 
                WHERE therapist_id = :therapist_id AND client_id = :client_id
                """
            ),
            {"therapist_id": ctx.user_id, "client_id": client_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client not assigned to this therapist")

        # Update user
        await db.execute(
            text("UPDATE users SET name = :name, email = :email WHERE id = :client_id"),
            {"name": request.name, "email": request.email, "client_id": client_id},
        )

        # Update client profile
        await db.execute(
            text(
                """
                UPDATE client_profiles 
                SET dob = :dob, address = :address, school = :school, 
                    diagnosis_codes = :diagnosis_codes, payer_id = :payer_id, 
                    auth_lims_json = :auth_lims, goals_json = :goals,
                    initial_analysis = :initial_analysis
                WHERE user_id = :client_id
                """
            ),
            {
                "client_id": client_id,
                "dob": request.dob,
                "address": json.dumps(request.address) if request.address else None,
                "school": request.school,
                "diagnosis_codes": json.dumps(request.diagnosis_codes) if request.diagnosis_codes else None,
                "payer_id": request.payer_id,
                "auth_lims": json.dumps(request.auth_lims) if request.auth_lims else None,
                "goals": json.dumps(request.goals) if request.goals else None,
                "initial_analysis": request.initial_analysis,
            },
        )

        await db.commit()
        return {"message": "Client updated successfully", "client_id": client_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update client: {str(e)}")


@router.delete("/therapist/clients/{client_id}")
async def delete_client(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    """Delete a client (soft delete by setting status to inactive)"""
    try:
        # Verify client is assigned to therapist
        result = await db.execute(
            text(
                """
                SELECT 1 FROM therapist_assignments 
                WHERE therapist_id = :therapist_id AND client_id = :client_id
                """
            ),
            {"therapist_id": ctx.user_id, "client_id": client_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client not assigned to this therapist")

        # Soft delete by setting status to inactive
        await db.execute(
            text("UPDATE users SET status = 'inactive' WHERE id = :client_id"),
            {"client_id": client_id},
        )

        await db.commit()
        return {"message": "Client deleted successfully", "client_id": client_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete client: {str(e)}")
@router.get("/therapist/appointments")
async def get_therapist_appointments(
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
    start_date: date | None = None,
    end_date: date | None = None,
):
    query = (
        """
        SELECT a.id, a.start_ts, a.end_ts, a.status, a.location,
               u.name as client_name, u.id as client_id
        FROM appointments a
        JOIN users u ON a.client_id = u.id
        WHERE a.therapist_id = :therapist_id AND u.role = 'client'
        """
    )
    params = {"therapist_id": ctx.user_id}
    if start_date:
        query += " AND a.start_ts >= :start_date"
        params["start_date"] = start_date
    if end_date:
        query += " AND a.start_ts <= :end_date"
        params["end_date"] = end_date
    query += " ORDER BY a.start_ts"
    result = await db.execute(text(query), params)
    appointments = [
        {
            "id": row[0],
            "start_ts": row[1],
            "end_ts": row[2],
            "status": row[3],
            "location": row[4],
            "client_name": row[5],
            "client_id": row[6],
        }
        for row in result.fetchall()
    ]
    return {"appointments": appointments}


@router.get("/therapist/appointments/today")
async def get_today_appointments(ctx = Depends(require_therapist), db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        text(
            """
            SELECT a.id, a.client_id, u.name as client_name, a.therapist_id, 
                   a.start_ts, a.end_ts, a.status, a.location
            FROM appointments a
            INNER JOIN users u ON a.client_id = u.id
            WHERE a.therapist_id = :therapist_id 
            AND DATE(a.start_ts) = :today
            ORDER BY a.start_ts
            """
        ),
        {"therapist_id": ctx.user_id, "today": today},
    )
    appointments = [
        {
            "id": row[0],
            "client_id": row[1],
            "client_name": row[2],
            "therapist_id": row[3],
            "start_ts": row[4],
            "end_ts": row[5],
            "status": row[6],
            "location": row[7],
        }
        for row in result.fetchall()
    ]
    return {"appointments": appointments}


@router.post("/therapist/sessions/{appointment_id}/notes")
async def create_session_notes(
    appointment_id: int,
    request: dict,  # Will contain SOAP notes
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    """Create session notes for an appointment"""
    try:
        # First, create a session record for the appointment
        session_result = await db.execute(
            text(
                """
                INSERT INTO sessions (appointment_id, time_in, note_status)
                VALUES (:appointment_id, NOW(), 'draft')
                RETURNING id
                """
            ),
            {"appointment_id": appointment_id}
        )
        session_id = session_result.fetchone()[0]
        
        # Create the SOAP note
        soap_data = {
            "subjective": request.get("subjective", ""),
            "objective": request.get("objective", ""),
            "assessment": request.get("assessment", ""),
            "plan": request.get("plan", "")
        }
        
        await db.execute(
            text(
                """
                INSERT INTO notes (session_id, type, soap, final_text)
                VALUES (:session_id, 'soap', :soap, :final_text)
                """
            ),
            {
                "session_id": session_id,
                "soap": json.dumps(soap_data),
                "final_text": f"S: {soap_data['subjective']}\nO: {soap_data['objective']}\nA: {soap_data['assessment']}\nP: {soap_data['plan']}"
            }
        )
        
        await db.commit()
        return {"message": "Session notes created successfully", "session_id": session_id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create session notes: {str(e)}")


@router.post("/therapist/appointments")
async def create_appointment(request: AppointmentCreateRequest, ctx = Depends(require_therapist), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            text(
                """
                SELECT 1 FROM therapist_assignments 
                WHERE therapist_id = :therapist_id AND client_id = :client_id
                """
            ),
            {"therapist_id": ctx.user_id, "client_id": request.client_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client not assigned to this therapist")

        result = await db.execute(
            text(
                """
                INSERT INTO appointments (org_id, client_id, therapist_id, start_ts, end_ts, location, recurring_rule)
                VALUES (:org_id, :client_id, :therapist_id, :start_ts, :end_ts, :location, :recurring_rule)
                RETURNING id
                """
            ),
            {
                "org_id": ctx.org_id,
                "client_id": request.client_id,
                "therapist_id": ctx.user_id,
                "start_ts": request.start_ts,
                "end_ts": request.end_ts,
                "location": request.location,
                "recurring_rule": request.recurring_rule,
            },
        )
        appointment_id = result.fetchone()[0]
        await db.commit()
        return {"message": "Appointment created successfully", "appointment_id": appointment_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create appointment: {str(e)}")


@router.post("/therapist/sessions/{appointment_id}/start")
async def start_session(
    appointment_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            text(
                """
                SELECT id FROM appointments 
                WHERE id = :appointment_id AND therapist_id = :therapist_id
                """
            ),
            {"appointment_id": appointment_id, "therapist_id": ctx.user_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

        result = await db.execute(
            text(
                """
                INSERT INTO sessions (appointment_id, time_in, note_status)
                VALUES (:appointment_id, :time_in, 'in_progress')
                RETURNING id
                """
            ),
            {"appointment_id": appointment_id, "time_in": datetime.now()},
        )
        session_id = result.fetchone()[0]

        await db.execute(
            text("UPDATE appointments SET status = 'in_progress' WHERE id = :appointment_id"),
            {"appointment_id": appointment_id},
        )
        await db.commit()
        return {"message": "Session started successfully", "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start session: {str(e)}")


@router.post("/therapist/sessions/{session_id}/end")
async def end_session(
    session_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            text(
                """
                SELECT s.id, s.appointment_id FROM sessions s
                JOIN appointments a ON s.appointment_id = a.id
                WHERE s.id = :session_id AND a.therapist_id = :therapist_id
                """
            ),
            {"session_id": session_id, "therapist_id": ctx.user_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        await db.execute(
            text(
                """
                UPDATE sessions 
                SET time_out = :time_out, note_status = 'draft'
                WHERE id = :session_id
                """
            ),
            {"time_out": datetime.now(), "session_id": session_id},
        )

        await db.execute(
            text(
                """
                UPDATE appointments a 
                SET status = 'completed' 
                FROM sessions s 
                WHERE s.id = :session_id AND a.id = s.appointment_id
                """
            ),
            {"session_id": session_id},
        )
        await db.commit()
        return {"message": "Session ended successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to end session: {str(e)}")


@router.get("/therapist/exercises")
async def get_exercises(
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
    tags: str | None = None,
    difficulty: str | None = None,
):
    query = "SELECT id, title, tags, difficulty, instructions_richtext FROM exercises WHERE 1=1"
    params = {}
    if tags:
        query += " AND tags @> :tags"
        params["tags"] = tags
    if difficulty:
        query += " AND difficulty = :difficulty"
        params["difficulty"] = difficulty
    query += " ORDER BY title"
    result = await db.execute(text(query), params)
    exercises = [
        {
            "id": row[0],
            "title": row[1],
            "tags": row[2],
            "difficulty": row[3],
            "instructions": row[4],
        }
        for row in result.fetchall()
    ]
    return {"exercises": exercises}


@router.get("/therapist/homework/{client_id}")
async def get_client_homework(
    client_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text(
            """
            SELECT 1 FROM therapist_assignments 
            WHERE therapist_id = :therapist_id AND client_id = :client_id
            """
        ),
        {"therapist_id": ctx.user_id, "client_id": client_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client not assigned to this therapist")

    result = await db.execute(
        text(
            """
            SELECT id, items, status_per_day, completion_rate, created_at
            FROM homework_plans
            WHERE client_id = :client_id
            ORDER BY created_at DESC
            """
        ),
        {"client_id": client_id},
    )
    homework_plans = [
        {
            "id": row[0],
            "items": row[1],
            "status_per_day": row[2],
            "completion_rate": row[3],
            "created_at": row[4],
        }
        for row in result.fetchall()
    ]
    return {"homework_plans": homework_plans}


@router.post("/therapist/assign-to-agency")
async def assign_therapist_to_agency(
    request: TherapistAgencyAssignmentRequest,
    ctx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            text("SELECT id FROM users WHERE id = :therapist_id AND role = 'therapist'"),
            {"therapist_id": request.therapist_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Therapist not found")

        result = await db.execute(
            text("SELECT id FROM users WHERE id = :agency_id AND role = 'agency'"),
            {"agency_id": request.agency_id},
        )
        if not result.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found")

        await db.execute(
            text(
                """
                INSERT INTO therapist_agency_assignments (therapist_id, agency_id, start_date, end_date)
                VALUES (:therapist_id, :agency_id, :start_date, :end_date)
                """
            ),
            {
                "therapist_id": request.therapist_id,
                "agency_id": request.agency_id,
                "start_date": request.start_date,
                "end_date": request.end_date,
            },
        )
        await db.commit()
        return {
            "message": "Therapist assigned to agency successfully",
            "therapist_id": request.therapist_id,
            "agency_id": request.agency_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to assign therapist to agency: {str(e)}")


@router.get("/therapist/agencies")
async def get_therapist_agencies(ctx = Depends(require_therapist), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, taa.start_date, taa.end_date, taa.status
            FROM users u
            JOIN therapist_agency_assignments taa ON u.id = taa.agency_id
            WHERE taa.therapist_id = :therapist_id AND u.role = 'agency'
            ORDER BY taa.start_date DESC
            """
        ),
        {"therapist_id": ctx.user_id},
    )
    agencies = [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "assignment_start": row[3],
            "assignment_end": row[4],
            "status": row[5],
        }
        for row in result.fetchall()
    ]
    return {"agencies": agencies}


@router.get("/admin/therapists")
async def get_all_therapists(ctx = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.status, u.created_at,
                   tp.npi, tp.license_state, tp.license_number,
                   a.name as agency_name
            FROM users u
            LEFT JOIN therapist_profiles tp ON u.id = tp.user_id
            LEFT JOIN therapist_agency_assignments taa ON u.id = taa.therapist_id
            LEFT JOIN users a ON taa.agency_id = a.id
            WHERE u.org_id = :org_id AND u.role = 'therapist'
            ORDER BY u.name
            """
        ),
        {"org_id": ctx.org_id},
    )
    therapists = [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "status": row[3],
            "created_at": row[4],
            "npi": row[5],
            "license_state": row[6],
            "license_number": row[7],
            "agency_name": row[8],
        }
        for row in result.fetchall()
    ]
    return {"therapists": therapists}


@router.post("/therapist/clients/{client_id}/sessions")
async def create_session(
    client_id: int,
    session_data: dict,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    """Create a new session for a client"""
    try:
        # Verify the client belongs to this therapist
        client_check = await db.execute(
            text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
            {"therapist_id": ctx.user_id, "client_id": client_id}
        )
        if not client_check.fetchone():
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Create session with new schema
        session_result = await db.execute(
            text(
                """
                INSERT INTO sessions (
                    client_id, therapist_id, start_time, duration_minutes, treatment_codes, note_status
                ) VALUES (
                    :client_id, :therapist_id, :start_time, :duration_minutes, :treatment_codes, 'draft'
                ) RETURNING id
                """
            ),
            {
                "client_id": client_id,
                "therapist_id": ctx.user_id,
                "start_time": parse_datetime(session_data.get("start_time")) if session_data.get("start_time") else datetime.now(),
                "duration_minutes": session_data.get("duration_minutes", 60),
                "treatment_codes": json.dumps(session_data.get("treatment_codes", []))
            }
        )
        
        session_id = session_result.fetchone()[0]
        
        # Create notes if provided
        if session_data.get("notes"):
            await db.execute(
                text(
                    """
                    INSERT INTO notes (
                        session_id, type, soap, goals_checked, treatment_codes, final_text
                    ) VALUES (
                        :session_id, :type, :soap, :goals_checked, :treatment_codes, :final_text
                    )
                    """
                ),
                {
                    "session_id": session_id,
                    "type": session_data["notes"].get("type", "soap"),
                    "soap": json.dumps(session_data["notes"].get("soap", {})),
                    "goals_checked": json.dumps(session_data["notes"].get("goals_checked", [])),
                    "treatment_codes": json.dumps(session_data["notes"].get("treatment_codes", [])),
                    "final_text": f"Subjective: {session_data['notes']['soap'].get('subjective', '')}\nObjective: {session_data['notes']['soap'].get('objective', '')}\nAssessment: {session_data['notes']['soap'].get('assessment', '')}\nPlan: {session_data['notes']['soap'].get('plan', '')}"
                }
            )
        
        await db.commit()
        
        return {
            "message": "Session created successfully",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.put("/therapist/clients/{client_id}/sessions/{session_id}")
async def update_session(
    client_id: int,
    session_id: int,
    session_data: dict,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing session"""
    try:
        # Verify the client belongs to this therapist
        client_check = await db.execute(
            text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
            {"therapist_id": ctx.user_id, "client_id": client_id}
        )
        if not client_check.fetchone():
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Verify session exists and belongs to this client
        session_check = await db.execute(
            text("SELECT id FROM sessions WHERE id = :session_id AND client_id = :client_id"),
            {"session_id": session_id, "client_id": client_id}
        )
        if not session_check.fetchone():
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Update session
        await db.execute(
            text(
                """
                UPDATE sessions 
                SET start_time = :start_time, duration_minutes = :duration_minutes, treatment_codes = :treatment_codes
                WHERE id = :session_id
                """
            ),
            {
                "session_id": session_id,
                "start_time": parse_datetime(session_data.get("start_time")) if session_data.get("start_time") else None,
                "duration_minutes": session_data.get("duration_minutes"),
                "treatment_codes": json.dumps(session_data.get("treatment_codes", []))
            }
        )
        
        # Update notes if provided
        if session_data.get("notes"):
            await db.execute(
                text(
                    """
                    UPDATE notes 
                    SET soap = :soap, final_text = :final_text
                    WHERE session_id = :session_id
                    """
                ),
                {
                    "session_id": session_id,
                    "soap": json.dumps(session_data["notes"].get("soap", {})),
                    "final_text": f"Subjective: {session_data['notes']['soap'].get('subjective', '')}\nObjective: {session_data['notes']['soap'].get('objective', '')}\nAssessment: {session_data['notes']['soap'].get('assessment', '')}\nPlan: {session_data['notes']['soap'].get('plan', '')}"
                }
            )
        
        await db.commit()
        
        return {
            "message": "Session updated successfully",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")


@router.delete("/therapist/clients/{client_id}/sessions/{session_id}")
async def delete_session(
    client_id: int,
    session_id: int,
    ctx = Depends(require_therapist),
    db: AsyncSession = Depends(get_db)
):
    """Delete a session"""
    try:
        # Verify the client belongs to this therapist
        client_check = await db.execute(
            text("SELECT id FROM therapist_assignments WHERE therapist_id = :therapist_id AND client_id = :client_id"),
            {"therapist_id": ctx.user_id, "client_id": client_id}
        )
        if not client_check.fetchone():
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Verify session exists and belongs to this client
        session_check = await db.execute(
            text("SELECT id FROM sessions WHERE id = :session_id AND client_id = :client_id"),
            {"session_id": session_id, "client_id": client_id}
        )
        if not session_check.fetchone():
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Delete session (notes will be deleted via CASCADE)
        await db.execute(
            text("DELETE FROM sessions WHERE id = :session_id"),
            {"session_id": session_id}
        )
        
        await db.commit()
        
        return {
            "message": "Session deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")



