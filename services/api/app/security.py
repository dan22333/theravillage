# services/api/app/security.py
from fastapi import Request, HTTPException, Depends, status
from firebase_admin import auth
from .db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AuthedContext(BaseModel):
    user_id: int
    org_id: int
    email: str
    name: str
    role: str
    firebase_uid: str

async def get_current_user(ctx_req: Request, db: AsyncSession = Depends(get_db)) -> AuthedContext:
    """Get current authenticated user from Firebase token"""
    auth_header = ctx_req.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        logger.error("Missing Bearer token in Authorization header")
        raise HTTPException(401, "Missing Bearer token")

    id_token = auth_header.split(" ", 1)[1]
    
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        firebase_uid = decoded.get("uid")
        email = decoded.get("email", "")
        logger.info(f"Token verified - UID: {firebase_uid}")
    except Exception as e:
        error_msg = f"Invalid/Revoked token: {e}"
        logger.error(f"Token verification failed: {error_msg}")
        raise HTTPException(401, error_msg)

    # For development mode, try to find user by Firebase UID first, then by email
    import os
    environment = os.getenv("ENVIRONMENT", "production")
    
    if environment.lower() in ["development", "local"]:
        # Try to find user by Firebase UID first (for development mode)
        result = await db.execute(
            text("SELECT id, org_id, name, role, status FROM users WHERE firebase_uid = :firebase_uid"),
            {"firebase_uid": firebase_uid}
        )
        user = result.fetchone()
        
        if not user:
            # Fallback to email lookup
            result = await db.execute(
                text("SELECT id, org_id, name, role, status FROM users WHERE email = :email"),
                {"email": email}
            )
            user = result.fetchone()
    else:
        # Production mode - use email lookup
        result = await db.execute(
            text("SELECT id, org_id, name, role, status FROM users WHERE email = :email"),
            {"email": email}
        )
        user = result.fetchone()
    
    if not user:
        logger.warning(f"User not found in database - Email: {email}, UID: {firebase_uid}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please complete registration first."
        )
    
    user_id, org_id, name, role, user_status = user
    
    if user_status != 'active':
        logger.warning(f"User account is not active - Email: {email}")
        raise HTTPException(403, "User account is not active")

    return AuthedContext(
        user_id=user_id,
        org_id=org_id,
        email=email,
        name=name,
        role=role,
        firebase_uid=firebase_uid
    )

async def require_therapist(ctx: AuthedContext = Depends(get_current_user)):
    """Require therapist privileges"""
    if ctx.role not in ['therapist', 'admin']:
        raise HTTPException(403, "Therapist privileges required")
    return ctx

async def require_admin(ctx: AuthedContext = Depends(get_current_user)):
    """Require admin privileges"""
    if ctx.role != 'admin':
        raise HTTPException(403, "Admin privileges required")
    return ctx

async def require_client(ctx: AuthedContext = Depends(get_current_user)):
    """Require client privileges"""
    if ctx.role != 'client':
        raise HTTPException(403, "Client privileges required")
    return ctx
