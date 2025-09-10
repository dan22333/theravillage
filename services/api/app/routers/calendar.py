"""
Calendar and Scheduling API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, insert, update, delete
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time, timedelta
from pydantic import BaseModel, Field
import json

from ..db import get_db
from ..security import get_current_user, require_therapist, require_client, AuthedContext
from ..timezone_utils import combine_date_time_in_app_timezone, to_utc_for_storage

router = APIRouter()

# Helper function for role validation
def require_role(user, allowed_roles: list):
    """Helper function to check if user has required role"""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {allowed_roles}"
        )

# ===================================
# PYDANTIC MODELS
# ===================================

class CalendarSlot(BaseModel):
    id: Optional[int] = None
    therapist_id: int
    slot_date: date
    start_time: time
    end_time: time
    status: str = "available"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CreateCalendarSlot(BaseModel):
    slot_date: date
    start_time: time
    end_time: time

class SchedulingRequest(BaseModel):
    id: Optional[int] = None
    client_id: int
    therapist_id: int
    requested_slot_id: Optional[int] = None
    requested_date: date
    requested_start_time: time
    requested_end_time: time
    status: str = "pending"
    client_message: Optional[str] = None
    therapist_response: Optional[str] = None
    suggested_alternatives: Optional[List[Dict[str, Any]]] = None
    cancelled_by: Optional[str] = None  # 'client' or 'therapist'
    cancellation_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

class CreateSchedulingRequest(BaseModel):
    therapist_id: int
    requested_slot_id: Optional[int] = None
    requested_date: date
    requested_start_time: time
    requested_end_time: time
    client_message: Optional[str] = None

class RespondToSchedulingRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|declined|counter_proposed)$")
    therapist_response: Optional[str] = None
    suggested_alternatives: Optional[List[Dict[str, Any]]] = None

class CalendarNotification(BaseModel):
    id: Optional[int] = None
    user_id: int
    type: str
    related_request_id: Optional[int] = None
    related_appointment_id: Optional[int] = None
    title: str
    message: str
    is_read: bool = False
    created_at: Optional[datetime] = None

class WeeklyCalendarView(BaseModel):
    week_start: date
    week_end: date
    slots: List[CalendarSlot]
    appointments: List[Dict[str, Any]]
    scheduling_requests: List[SchedulingRequest]

# ===================================
# THERAPIST CALENDAR ENDPOINTS
# ===================================

@router.get("/therapist/calendar/week/{week_start}", response_model=WeeklyCalendarView)
async def get_therapist_weekly_calendar(
    week_start: date,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get therapist's weekly calendar view with slots, appointments, and requests"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    # Calculate week end
    week_end = week_start + timedelta(days=6)
    
    # Get calendar slots for the week
    slots_query = text("""
        SELECT id, therapist_id, slot_date, start_time, end_time, status, created_at, updated_at
        FROM therapist_calendar_slots 
        WHERE therapist_id = :therapist_id 
        AND slot_date >= :week_start 
        AND slot_date <= :week_end
        ORDER BY slot_date, start_time
    """)
    slots_result = await db.execute(slots_query, {
        "therapist_id": therapist_id,
        "week_start": week_start,
        "week_end": week_end
    })
    slots_rows = slots_result.fetchall()
    
    # Get appointments for the week (exclude cancelled appointments)
    appointments_query = text("""
        SELECT a.id, a.client_id, a.start_ts, a.end_ts, a.status, u.name as client_name
        FROM appointments a
        JOIN users u ON a.client_id = u.id
        WHERE a.therapist_id = :therapist_id 
        AND DATE(a.start_ts) >= :week_start 
        AND DATE(a.start_ts) <= :week_end
        AND a.status != 'cancelled'
        ORDER BY a.start_ts
    """)
    appointments_result = await db.execute(appointments_query, {
        "therapist_id": therapist_id,
        "week_start": week_start,
        "week_end": week_end
    })
    appointments_rows = appointments_result.fetchall()
    
    # Get scheduling requests for the week
    requests_query = text("""
        SELECT sr.*, u.name as client_name
        FROM scheduling_requests sr
        JOIN users u ON sr.client_id = u.id
        WHERE sr.therapist_id = :therapist_id 
        AND sr.requested_date >= :week_start 
        AND sr.requested_date <= :week_end
        ORDER BY sr.created_at DESC
    """)
    requests_result = await db.execute(requests_query, {
        "therapist_id": therapist_id,
        "week_start": week_start,
        "week_end": week_end
    })
    requests_rows = requests_result.fetchall()
    
    # Convert to response format
    slots = [CalendarSlot(**dict(row._mapping)) for row in slots_rows]
    appointments = [dict(row._mapping) for row in appointments_rows]
    scheduling_requests = [SchedulingRequest(**dict(row._mapping)) for row in requests_rows]
    
    # Debug logging
    print(f"📅 WEEKLY CALENDAR DEBUG for therapist {therapist_id}, week {week_start} to {week_end}:")
    print(f"📅 Total slots returned: {len(slots)}")
    available_slots = [s for s in slots if s.status == 'available']
    print(f"📅 Available slots: {len(available_slots)}")
    if available_slots:
        print(f"📅 Available slot details:")
        for slot in available_slots[:5]:  # Show first 5
            print(f"   - {slot.slot_date} {slot.start_time} ({slot.status})")
    print(f"📅 Total appointments: {len(appointments)}")
    
    return WeeklyCalendarView(
        week_start=week_start,
        week_end=week_end,
        slots=slots,
        appointments=appointments,
        scheduling_requests=scheduling_requests
    )

@router.post("/therapist/calendar/slots", response_model=CalendarSlot)
async def create_calendar_slot(
    slot_data: CreateCalendarSlot,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new available time slot"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    # Prevent creating slots on past dates
    from datetime import date
    if slot_data.slot_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create availability on past dates"
        )
    
    # Validate time slot
    if slot_data.start_time >= slot_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )
    
    # Check for exact duplicate slots only (allow adjacent and overlapping for flexibility)
    conflict_query = text("""
        SELECT id FROM therapist_calendar_slots 
        WHERE therapist_id = :therapist_id 
        AND slot_date = :slot_date
        AND start_time = :start_time
        AND end_time = :end_time
    """)
    conflict_result = await db.execute(conflict_query, {
        "therapist_id": therapist_id,
        "slot_date": slot_data.slot_date,
        "start_time": slot_data.start_time,
        "end_time": slot_data.end_time
    })
    
    if conflict_result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Exact same time slot already exists"
        )
    
    # Create the slot
    insert_query = text("""
        INSERT INTO therapist_calendar_slots (therapist_id, slot_date, start_time, end_time, status)
        VALUES (:therapist_id, :slot_date, :start_time, :end_time, 'available')
        RETURNING id, therapist_id, slot_date, start_time, end_time, status, created_at, updated_at
    """)
    result = await db.execute(insert_query, {
        "therapist_id": therapist_id,
        "slot_date": slot_data.slot_date,
        "start_time": slot_data.start_time,
        "end_time": slot_data.end_time
    })
    await db.commit()
    
    row = result.fetchone()
    return CalendarSlot(**dict(row._mapping))

@router.get("/debug/therapist/slots")
async def debug_therapist_slots(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to show all slots for therapist"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    query = text("""
        SELECT id, slot_date, start_time, end_time, status, created_at
        FROM therapist_calendar_slots 
        WHERE therapist_id = :therapist_id 
        ORDER BY slot_date, start_time
    """)
    result = await db.execute(query, {"therapist_id": therapist_id})
    slots = [dict(row._mapping) for row in result.fetchall()]
    
    return {
        "therapist_id": therapist_id,
        "total_slots": len(slots),
        "available_slots": len([s for s in slots if s["status"] == "available"]),
        "booked_slots": len([s for s in slots if s["status"] == "booked"]),
        "slots": slots
    }

@router.post("/debug/update-schema")
async def update_schema_for_cancelled_status(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update database schema to support 'cancelled' status"""
    require_role(current_user, ["therapist"])
    
    try:
        # Drop the old constraint and add new one with 'cancelled' status
        await db.execute(text("""
            ALTER TABLE scheduling_requests 
            DROP CONSTRAINT IF EXISTS scheduling_requests_status_check
        """))
        
        await db.execute(text("""
            ALTER TABLE scheduling_requests 
            ADD CONSTRAINT scheduling_requests_status_check 
            CHECK (status IN ('pending', 'approved', 'declined', 'counter_proposed', 'cancelled'))
        """))
        
        # Update notification types constraint
        await db.execute(text("""
            ALTER TABLE calendar_notifications 
            DROP CONSTRAINT IF EXISTS calendar_notifications_type_check
        """))
        
        await db.execute(text("""
            ALTER TABLE calendar_notifications 
            ADD CONSTRAINT calendar_notifications_type_check 
            CHECK (type IN ('scheduling_request', 'request_approved', 'request_declined', 'request_cancelled', 'counter_proposal', 'meeting_reminder', 'appointment_scheduled', 'appointment_updated', 'appointment_cancelled', 'appointment_rescheduled'))
        """))
        
        await db.commit()
        
        return {"message": "Schema updated successfully to support cancelled status"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update schema: {str(e)}")

@router.post("/debug/clear-all-data")
async def clear_all_appointments_and_slots(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """DEBUG ONLY: Clear all appointments, slots, and scheduling requests"""
    require_role(current_user, ["therapist"])
    
    try:
        # Clear all appointments
        appointments_deleted = await db.execute(text("DELETE FROM appointments"))
        
        # Clear all calendar slots
        slots_deleted = await db.execute(text("DELETE FROM therapist_calendar_slots"))
        
        # Clear all scheduling requests
        requests_deleted = await db.execute(text("DELETE FROM scheduling_requests"))
        
        # Clear all calendar notifications
        notifications_deleted = await db.execute(text("DELETE FROM calendar_notifications"))
        
        await db.commit()
        
        return {
            "message": "All data cleared successfully",
            "appointments_deleted": appointments_deleted.rowcount,
            "slots_deleted": slots_deleted.rowcount,
            "requests_deleted": requests_deleted.rowcount,
            "notifications_deleted": notifications_deleted.rowcount
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear data: {str(e)}")

@router.get("/debug/all-requests")
async def debug_all_requests(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to show ALL scheduling requests in database"""
    
    query = text("""
        SELECT sr.*, 
               uc.name as client_name, 
               ut.name as therapist_name
        FROM scheduling_requests sr
        JOIN users uc ON sr.client_id = uc.id
        JOIN users ut ON sr.therapist_id = ut.id
        ORDER BY sr.created_at DESC
    """)
    result = await db.execute(query)
    requests = [dict(row._mapping) for row in result.fetchall()]
    
    return {
        "total_requests": len(requests),
        "requests": requests
    }

@router.post("/debug/therapist/fix-stuck-slots")
async def fix_stuck_slots(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to fix slots that are stuck as 'booked' without active appointments"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    # Find slots that are marked as 'booked' but don't have corresponding active appointments
    query = text("""
        UPDATE therapist_calendar_slots 
        SET status = 'available' 
        WHERE therapist_id = :therapist_id 
        AND status = 'booked' 
        AND NOT EXISTS (
            SELECT 1 FROM appointments a 
            WHERE a.therapist_id = :therapist_id 
            AND DATE(a.start_ts) = slot_date 
            AND TIME(a.start_ts) <= start_time 
            AND TIME(a.end_ts) > start_time
            AND a.status NOT IN ('cancelled')
        )
    """)
    result = await db.execute(query, {"therapist_id": therapist_id})
    await db.commit()
    
    return {
        "message": f"Fixed {result.rowcount} stuck slots",
        "slots_fixed": result.rowcount
    }

@router.delete("/therapist/calendar/slots/{slot_id}")
async def delete_calendar_slot(
    slot_id: int,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a calendar slot (remove availability)"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    # Check if slot exists and belongs to therapist
    check_query = text("""
        SELECT id, status FROM therapist_calendar_slots 
        WHERE id = :slot_id AND therapist_id = :therapist_id
    """)
    result = await db.execute(check_query, {"slot_id": slot_id, "therapist_id": therapist_id})
    slot = result.fetchone()
    
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar slot not found"
        )
    
    if slot.status == "booked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete booked slot"
        )
    
    # Delete the slot
    delete_query = text("""
        DELETE FROM therapist_calendar_slots 
        WHERE id = :slot_id AND therapist_id = :therapist_id
    """)
    await db.execute(delete_query, {"slot_id": slot_id, "therapist_id": therapist_id})
    await db.commit()
    
    return {"message": "Calendar slot deleted successfully"}

# ===================================
# CLIENT CALENDAR ENDPOINTS
# ===================================

@router.get("/client/therapist/{therapist_id}/available-slots")
async def get_available_slots(
    therapist_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get available slots for a specific therapist"""
    require_role(current_user, ["client"])
    
    # Default to next 4 weeks if no dates provided
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(weeks=4)
    
    # Get available slots
    query = text("""
        SELECT id, therapist_id, slot_date, start_time, end_time, status
        FROM therapist_calendar_slots 
        WHERE therapist_id = :therapist_id 
        AND status = 'available'
        AND slot_date >= :start_date 
        AND slot_date <= :end_date
        ORDER BY slot_date, start_time
    """)
    result = await db.execute(query, {
        "therapist_id": therapist_id,
        "start_date": start_date,
        "end_date": end_date
    })
    
    slots = [dict(row._mapping) for row in result.fetchall()]
    
    print(f"🔍 CLIENT SLOTS REQUEST: Therapist {therapist_id}, dates {start_date} to {end_date}")
    print(f"🔍 CLIENT SLOTS FOUND: {len(slots)} available slots")
    if slots:
        print(f"🔍 CLIENT SLOTS SAMPLE:")
        for slot in slots[:3]:
            print(f"   - {slot['slot_date']} {slot['start_time']} ({slot['status']})")
    
    return {"available_slots": slots}

@router.post("/client/scheduling-requests", response_model=SchedulingRequest)
async def create_scheduling_request(
    request_data: CreateSchedulingRequest,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new scheduling request"""
    require_role(current_user, ["client"])
    client_id = current_user.user_id
    
    # Validate that ALL required consecutive slots are available
    consecutive_slots_query = text("""
        SELECT COUNT(*) as available_count,
               COUNT(*) FILTER (WHERE status = 'available') as actually_available
        FROM therapist_calendar_slots 
        WHERE therapist_id = :therapist_id
        AND slot_date = :requested_date
        AND start_time >= :requested_start_time
        AND start_time < :requested_end_time
    """)
    slots_result = await db.execute(consecutive_slots_query, {
        "therapist_id": request_data.therapist_id,
        "requested_date": request_data.requested_date,
        "requested_start_time": request_data.requested_start_time,
        "requested_end_time": request_data.requested_end_time
    })
    slots_info = slots_result.fetchone()
    
    # Calculate expected number of 15-minute slots needed
    start_dt = datetime.strptime(str(request_data.requested_start_time), "%H:%M:%S")
    end_dt = datetime.strptime(str(request_data.requested_end_time), "%H:%M:%S")
    duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
    expected_slots = duration_minutes // 15
    
    if slots_info.actually_available < expected_slots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough consecutive available slots. Need {expected_slots} consecutive 15-minute slots, but only {slots_info.actually_available} are available."
        )
    
    # Create the scheduling request
    print(f"📋 REQUEST CREATION: Client {client_id} requesting meeting with therapist {request_data.therapist_id}")
    print(f"📋 Date: {request_data.requested_date}, Time: {request_data.requested_start_time} - {request_data.requested_end_time}")
    
    insert_query = text("""
        INSERT INTO scheduling_requests (
            client_id, therapist_id, requested_slot_id, requested_date, 
            requested_start_time, requested_end_time, client_message
        )
        VALUES (:client_id, :therapist_id, :requested_slot_id, :requested_date, 
                :requested_start_time, :requested_end_time, :client_message)
        RETURNING id, client_id, therapist_id, requested_slot_id, requested_date, 
                  requested_start_time, requested_end_time, status, client_message, 
                  therapist_response, suggested_alternatives, created_at, updated_at, responded_at
    """)
    result = await db.execute(insert_query, {
        "client_id": client_id,
        "therapist_id": request_data.therapist_id,
        "requested_slot_id": request_data.requested_slot_id,
        "requested_date": request_data.requested_date,
        "requested_start_time": request_data.requested_start_time,
        "requested_end_time": request_data.requested_end_time,
        "client_message": request_data.client_message
    })
    
    row = result.fetchone()
    request_id = row[0]
    print(f"📋 REQUEST CREATED: ID {request_id} with status '{row[7]}')")
    
    # Create notification for therapist
    await create_notification(
        db=db,
        user_id=request_data.therapist_id,
        notification_type="scheduling_request",
        title="New Scheduling Request",
        message=f"You have a new meeting request for {request_data.requested_date}",
        related_request_id=request_id
    )
    
    await db.commit()
    
    return SchedulingRequest(
        id=row[0],
        client_id=row[1],
        therapist_id=row[2],
        requested_slot_id=row[3],
        requested_date=row[4],
        requested_start_time=row[5],
        requested_end_time=row[6],
        status=row[7],
        client_message=row[8],
        therapist_response=row[9],
        suggested_alternatives=row[10],
        created_at=row[11],
        updated_at=row[12],
        responded_at=row[13]
    )

# ===================================
# SCHEDULING REQUEST MANAGEMENT
# ===================================

@router.get("/scheduling-requests/pending")
async def get_pending_requests(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get scheduling requests for the current user"""
    user_id = current_user.user_id
    user_role = current_user.role
    
    if user_role == "therapist":
        # Get only pending requests for therapists (actionable items)
        query = text("""
            SELECT sr.*, u.name as client_name, u.email as client_email
            FROM scheduling_requests sr
            JOIN users u ON sr.client_id = u.id
            WHERE sr.therapist_id = :user_id AND sr.status = 'pending'
            ORDER BY sr.created_at DESC
        """)
    else:  # client
        # Get recent requests excluding old processed ones (last 30 days)
        query = text("""
            SELECT sr.*, u.name as therapist_name, u.email as therapist_email
            FROM scheduling_requests sr
            JOIN users u ON sr.therapist_id = u.id
            WHERE sr.client_id = :user_id
            AND sr.created_at >= NOW() - INTERVAL '30 days'
            ORDER BY sr.created_at DESC
            LIMIT 10
        """)
    
    result = await db.execute(query, {"user_id": user_id})
    requests = [dict(row._mapping) for row in result.fetchall()]
    
    print(f"📋 PENDING REQUESTS DEBUG: User {user_id} ({user_role}) - Found {len(requests)} requests")
    if requests:
        for req in requests:
            print(f"   - Request {req['id']}: {req['requested_date']} {req['requested_start_time']} (status: {req['status']})")
    
    return {"pending_requests": requests}

@router.post("/scheduling-requests/{request_id}/cancel")
async def cancel_scheduling_request(
    request_id: int,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allow client to cancel their own pending scheduling request"""
    require_role(current_user, ["client"])
    client_id = current_user.user_id
    
    # Get the request and verify it belongs to this client
    request_query = text("""
        SELECT sr.*, u.name as therapist_name
        FROM scheduling_requests sr
        JOIN users u ON sr.therapist_id = u.id
        WHERE sr.id = :request_id AND sr.client_id = :client_id
    """)
    request_result = await db.execute(request_query, {
        "request_id": request_id,
        "client_id": client_id
    })
    request_row = request_result.fetchone()
    
    if not request_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or you don't have permission to cancel it"
        )
    
    # Only allow cancellation of pending requests
    if request_row.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel request with status '{request_row.status}'. Only pending requests can be cancelled."
        )
    
    print(f"📋 CLIENT CANCELLATION: Request {request_id} being cancelled by client {client_id}")
    
    # Update request status to cancelled with cancellation tracking
    update_query = text("""
        UPDATE scheduling_requests 
        SET status = 'cancelled', 
            updated_at = NOW(),
            responded_at = NOW(),
            therapist_response = 'Cancelled by client'
        WHERE id = :request_id
    """)
    await db.execute(update_query, {"request_id": request_id})
    
    # Create notification for therapist
    await create_notification(
        db=db,
        user_id=request_row.therapist_id,
        notification_type="request_cancelled",
        title="Meeting Request Cancelled",
        message=f"A client cancelled their meeting request for {request_row.requested_date}",
        related_request_id=request_id
    )
    
    await db.commit()
    
    print(f"📋 CLIENT CANCELLATION: Request {request_id} cancelled successfully")
    
    return {"message": "Request cancelled successfully"}

@router.post("/scheduling-requests/{request_id}/respond")
async def respond_to_scheduling_request(
    request_id: int,
    response_data: RespondToSchedulingRequest,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Therapist responds to a scheduling request"""
    require_role(current_user, ["therapist"])
    therapist_id = current_user.user_id
    
    # Get the request
    request_query = text("""
        SELECT * FROM scheduling_requests 
        WHERE id = :request_id AND therapist_id = :therapist_id AND status = 'pending'
    """)
    result = await db.execute(request_query, {"request_id": request_id, "therapist_id": therapist_id})
    request_row = result.fetchone()
    
    if not request_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduling request not found or already responded to"
        )
    
    # Update the request with proper cancellation tracking for declined requests
    if response_data.status == 'declined':
        update_query = text("""
            UPDATE scheduling_requests 
            SET status = :status, therapist_response = :response, 
                suggested_alternatives = :alternatives, responded_at = NOW(),
                cancelled_by = 'therapist',
                cancellation_reason = :response
            WHERE id = :request_id
        """)
    else:
        update_query = text("""
            UPDATE scheduling_requests 
            SET status = :status, therapist_response = :response, 
                suggested_alternatives = :alternatives, responded_at = NOW()
            WHERE id = :request_id
        """)
    
    await db.execute(update_query, {
        "request_id": request_id,
        "status": response_data.status,
        "response": response_data.therapist_response,
        "alternatives": json.dumps(response_data.suggested_alternatives) if response_data.suggested_alternatives else None
    })
    
    # If approved, create appointment and mark slot as booked
    if response_data.status == "approved":
        # No timezone conversion - store exactly as requested
        start_ts_str = f"{request_row.requested_date} {request_row.requested_start_time}"
        end_ts_str = f"{request_row.requested_date} {request_row.requested_end_time}"
        start_ts = datetime.fromisoformat(start_ts_str)
        end_ts = datetime.fromisoformat(end_ts_str)
        
        # Check for overlapping appointments before creating
        overlap_check = await db.execute(text("""
            SELECT a.id, a.start_ts, a.end_ts, u.name as client_name
            FROM appointments a
            JOIN users u ON a.client_id = u.id
            WHERE a.therapist_id = :therapist_id 
            AND a.status NOT IN ('cancelled')
            AND (
                (a.start_ts < :end_ts AND a.end_ts > :start_ts)
            )
        """), {
            "therapist_id": therapist_id,
            "start_ts": start_ts,
            "end_ts": end_ts
        })
        
        overlapping_appointments = overlap_check.fetchall()
        if overlapping_appointments:
            overlap_details = []
            for apt in overlapping_appointments:
                overlap_details.append(f"{apt.client_name} ({apt.start_ts.strftime('%I:%M %p')} - {apt.end_ts.strftime('%I:%M %p')})")
            
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot approve: Time slot is occupied by existing appointment(s): {', '.join(overlap_details)}"
            )
        
        # Create appointment
        appointment_query = text("""
            INSERT INTO appointments (
                client_id, therapist_id, scheduling_request_id,
                start_ts, end_ts, status
            )
            VALUES (
                :client_id, :therapist_id, :request_id,
                :start_ts, :end_ts, 'scheduled'
            )
        """)
        
        await db.execute(appointment_query, {
            "client_id": request_row.client_id,
            "therapist_id": therapist_id,
            "request_id": request_id,
            "start_ts": start_ts,
            "end_ts": end_ts
        })
        
        # Mark ALL slots in the requested time range as booked
        print(f"🔄 BOOKING: Marking slots as booked for therapist {therapist_id}")
        print(f"🔄 Date: {request_row.requested_date}, Start: {request_row.requested_start_time}, End: {request_row.requested_end_time}")
        
        # First, check what slots exist in this range
        check_booking_slots = await db.execute(text("""
            SELECT id, slot_date, start_time, end_time, status
            FROM therapist_calendar_slots 
            WHERE therapist_id = :therapist_id
            AND slot_date = :requested_date
            AND start_time >= :requested_start_time
            AND start_time < :requested_end_time
        """), {
            "therapist_id": therapist_id,
            "requested_date": request_row.requested_date,
            "requested_start_time": request_row.requested_start_time,
            "requested_end_time": request_row.requested_end_time
        })
        
        booking_slots = check_booking_slots.fetchall()
        print(f"🔄 BOOKING: Found {len(booking_slots)} slots in range:")
        for slot in booking_slots:
            print(f"   - Slot {slot.id}: {slot.slot_date} {slot.start_time}-{slot.end_time} ({slot.status})")
        
        slot_update_query = text("""
            UPDATE therapist_calendar_slots 
            SET status = 'booked' 
            WHERE therapist_id = :therapist_id
            AND slot_date = :requested_date
            AND start_time >= :requested_start_time
            AND start_time < :requested_end_time
            AND status = 'available'
        """)
        slots_booked = await db.execute(slot_update_query, {
            "therapist_id": therapist_id,
            "requested_date": request_row.requested_date,
            "requested_start_time": request_row.requested_start_time,
            "requested_end_time": request_row.requested_end_time
        })
        
        print(f"🔄 BOOKING: Marked {slots_booked.rowcount} slots as booked")
        
        # If no slots were found, create them automatically
        if slots_booked.rowcount == 0:
            print(f"🔄 BOOKING: No existing slots found, creating slots automatically")
            
            # Calculate 15-minute slots needed
            from datetime import datetime, timedelta
            start_dt = datetime.strptime(str(request_row.requested_start_time), "%H:%M:%S")
            end_dt = datetime.strptime(str(request_row.requested_end_time), "%H:%M:%S")
            
            current_time = start_dt
            slots_created = 0
            
            while current_time < end_dt:
                end_time = current_time + timedelta(minutes=15)
                
                create_slot_query = text("""
                    INSERT INTO therapist_calendar_slots (therapist_id, slot_date, start_time, end_time, status)
                    VALUES (:therapist_id, :slot_date, :start_time, :end_time, 'booked')
                    ON CONFLICT (therapist_id, slot_date, start_time) DO UPDATE SET status = 'booked'
                """)
                await db.execute(create_slot_query, {
                    "therapist_id": therapist_id,
                    "slot_date": request_row.requested_date,
                    "start_time": current_time.time(),
                    "end_time": end_time.time()
                })
                
                current_time += timedelta(minutes=15)
                slots_created += 1
            
            print(f"🔄 BOOKING: Created {slots_created} new booked slots")
    
    await db.commit()
    
    # Create notification for client
    notification_type = f"request_{response_data.status}"
    title_map = {
        "approved": "Meeting Request Approved",
        "declined": "Meeting Request Declined", 
        "counter_proposed": "Alternative Times Suggested"
    }
    
    await create_notification(
        db=db,
        user_id=request_row.client_id,
        notification_type=notification_type,
        title=title_map.get(response_data.status, "Meeting Request Update"),
        message=response_data.therapist_response or f"Your meeting request has been {response_data.status}",
        related_request_id=request_id
    )
    
    return {"message": f"Request {response_data.status} successfully"}

# ===================================
# NOTIFICATIONS
# ===================================

async def create_notification(
    db: AsyncSession,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    related_request_id: Optional[int] = None,
    related_appointment_id: Optional[int] = None
):
    """Helper function to create notifications"""
    query = text("""
        INSERT INTO calendar_notifications (
            user_id, type, title, message, related_request_id, related_appointment_id
        )
        VALUES (:user_id, :type, :title, :message, :related_request_id, :related_appointment_id)
    """)
    await db.execute(query, {
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "related_request_id": related_request_id,
        "related_appointment_id": related_appointment_id
    })

@router.get("/notifications")
async def get_notifications(
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notifications for the current user"""
    user_id = current_user["user_id"]
    
    query = text("""
        SELECT * FROM calendar_notifications 
        WHERE user_id = :user_id 
        ORDER BY created_at DESC 
        LIMIT 50
    """)
    result = await db.execute(query, {"user_id": user_id})
    notifications = [dict(row._mapping) for row in result.fetchall()]
    
    return {"notifications": notifications}

@router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: int,
    current_user: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read"""
    user_id = current_user["user_id"]
    
    query = text("""
        UPDATE calendar_notifications 
        SET is_read = TRUE 
        WHERE id = :notification_id AND user_id = :user_id
    """)
    result = await db.execute(query, {"notification_id": notification_id, "user_id": user_id})
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {"message": "Notification marked as read"}
