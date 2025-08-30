# services/api/app/security.py
from fastapi import Request, HTTPException, Depends, status
from firebase_admin import auth
from .db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

class AuthedContext(BaseModel):
    user_id: int
    firebase_uid: str
    email: str
    name: str
    is_admin: bool

async def get_current_user(ctx_req: Request, db: AsyncSession = Depends(get_db)) -> AuthedContext:
    """Get current authenticated user from Firebase token"""
    auth_header = ctx_req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")

    id_token = auth_header.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
    except Exception as e:
        raise HTTPException(401, f"Invalid/Revoked token: {e}")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")
    name = decoded.get("name", "")

    # Check if user exists in database
    result = await db.execute(
        text("SELECT id, is_admin, disabled FROM users WHERE firebase_uid = :uid"),
        {"uid": firebase_uid}
    )
    user = result.fetchone()
    
    if not user:
        # User doesn't exist in our system yet
        # They need to complete registration first
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please complete registration first."
        )
    
    user_id, is_admin, disabled = user
    
    if disabled:
        raise HTTPException(403, "User account is disabled")

    return AuthedContext(
        user_id=user_id,
        firebase_uid=firebase_uid,
        email=email,
        name=name,
        is_admin=is_admin
    )

async def require_admin(ctx: AuthedContext = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Require admin privileges"""
    if not ctx.is_admin:
        raise HTTPException(403, "Admin privileges required")
    return ctx
