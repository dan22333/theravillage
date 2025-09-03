from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json

from ..db import get_db
from ..security import require_admin
from ..user_deletion_service import UserDeletionService

router = APIRouter()


@router.get("/admin/users")
async def get_all_users(ctx = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT id, name, email, role, status, last_login, created_at, firebase_uid
            FROM users
            WHERE org_id = :org_id
            ORDER BY name
            """
        ),
        {"org_id": ctx.org_id},
    )
    users = [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "status": row[4],
            "last_login": row[5],
            "created_at": row[6],
            "firebase_uid": row[7],
        }
        for row in result.fetchall()
    ]
    return {"users": users}


@router.get("/admin/clients")
async def get_all_clients(ctx = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT u.id, u.name, u.email, u.status, u.created_at, cp.dob, cp.school,
                   t.name as therapist_name
            FROM users u
            LEFT JOIN client_profiles cp ON u.id = cp.user_id
            LEFT JOIN therapist_assignments ta ON u.id = ta.client_id
            LEFT JOIN users t ON ta.therapist_id = t.id
            WHERE u.org_id = :org_id AND u.role = 'client'
            ORDER BY u.name
            """
        ),
        {"org_id": ctx.org_id},
    )
    clients = [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "status": row[3],
            "created_at": row[4],
            "dob": row[5],
            "school": row[6],
            "therapist_name": row[7],
        }
        for row in result.fetchall()
    ]
    return {"clients": clients}


@router.post("/admin/users/{firebase_uid}/{action}")
async def admin_user_action(
    firebase_uid: str,
    action: str,
    ctx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin actions on users: promote, demote, revoke, enable"""
    try:
        # Validate action
        valid_actions = ["promote", "demote", "revoke", "enable"]
        if action not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}"
            )
        
        # Find user by Firebase UID
        result = await db.execute(
            text("SELECT id, role, status FROM users WHERE firebase_uid = :firebase_uid"),
            {"firebase_uid": firebase_uid}
        )
        user = result.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_id, current_role, current_status = user
        
        # Prevent admin from demoting themselves
        if action == "demote" and user_id == ctx.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot demote yourself"
            )
        
        # Apply action
        if action == "promote":
            await db.execute(
                text("UPDATE users SET role = 'admin' WHERE id = :user_id"),
                {"user_id": user_id}
            )
            message = "User promoted to admin"
        elif action == "demote":
            await db.execute(
                text("UPDATE users SET role = 'therapist' WHERE id = :user_id"),
                {"user_id": user_id}
            )
            message = "User demoted from admin"
        elif action == "revoke":
            await db.execute(
                text("UPDATE users SET status = 'inactive' WHERE id = :user_id"),
                {"user_id": user_id}
            )
            message = "User access revoked"
        elif action == "enable":
            await db.execute(
                text("UPDATE users SET status = 'active' WHERE id = :user_id"),
                {"user_id": user_id}
            )
            message = "User access enabled"
        
        await db.commit()
        
        return {
            "message": message,
            "user_id": user_id,
            "action": action,
            "new_role": "admin" if action == "promote" else "therapist" if action == "demote" else current_role,
            "new_status": "inactive" if action == "revoke" else "active" if action == "enable" else current_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to {action} user: {str(e)}"
        )


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    ctx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete user with comprehensive cascading deletes for all related data"""
    try:
        deletion_service = UserDeletionService(db)
        
        # Validate deletion safety
        validation = await deletion_service.validate_deletion_safety(user_id, ctx.user_id)
        if not validation["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation["error"]
            )
        
        # Perform simple deletion with cascade
        result = await deletion_service.delete_user_simple(user_id, ctx.user_id)
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["error"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )


@router.get("/admin/users/{user_id}/impact")
async def get_user_deletion_impact(
    user_id: int,
    ctx = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get the comprehensive impact of deleting a user before actually deleting them"""
    try:
        deletion_service = UserDeletionService(db)
        
        # Get comprehensive impact analysis
        impact = await deletion_service.get_user_deletion_impact(user_id)
        
        if "error" in impact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=impact["error"]
            )
        
        return impact
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user deletion impact: {str(e)}"
        )


