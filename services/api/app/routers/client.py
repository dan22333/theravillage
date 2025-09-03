from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json

from ..db import get_db
from ..security import get_current_user, require_client
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


