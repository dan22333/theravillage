# services/api/app/security.py
from fastapi import Request, HTTPException, Depends, status
from firebase_admin import auth
from .db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        logger.error("Missing Bearer token in Authorization header")
        raise HTTPException(401, "Missing Bearer token")

    id_token = auth_header.split(" ", 1)[1]
    
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        logger.info(f"Token verified - UID: {decoded.get('uid', 'N/A')}")
    except Exception as e:
        error_msg = f"Invalid/Revoked token: {e}"
        logger.error(f"Token verification failed: {error_msg}")
        raise HTTPException(401, error_msg)

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
        logger.warning(f"User not found in database - Firebase UID: {firebase_uid}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please complete registration first."
        )
    
    user_id, is_admin, disabled = user
    
    if disabled:
        logger.warning(f"User account is disabled - Firebase UID: {firebase_uid}")
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
