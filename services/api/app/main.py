from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import firebase_admin
from firebase_admin import auth, credentials
import os
import json
from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel

from .db import get_db, init_db
from .security import get_current_user, require_admin, AuthedContext

# Request model for user registration
class UserRegistrationRequest(BaseModel):
    token: str

# Initialize Firebase Admin SDK
try:
    # Get Firebase credentials from environment or Secret Manager
    firebase_creds_json = os.getenv("FIREBASE_ADMIN_JSON")
    
    if not firebase_creds_json and os.getenv("ENVIRONMENT") == "development":
        # For local development, try to get from Secret Manager
        try:
            import google.cloud.secretmanager as secretmanager
            client = secretmanager.SecretManagerServiceClient()
            secret_name = f"projects/theravillage-edb89/secrets/FIREBASE_ADMIN_JSON/versions/latest"
            response = client.access_secret_version(request={"name": secret_name})
            firebase_creds_json = response.payload.data.decode("UTF-8")
            print("✅ Firebase credentials loaded from Secret Manager")
        except Exception as secret_error:
            print(f"⚠️  Could not load from Secret Manager: {secret_error}")
            print("⚠️  Firebase Admin SDK will not work - authentication will fail")
    
    if firebase_creds_json:
        creds = credentials.Certificate(json.loads(firebase_creds_json))
        firebase_admin.initialize_app(creds)
        print("✅ Firebase Admin SDK initialized successfully")
    else:
        print("⚠️  No Firebase credentials found - authentication will fail")
        firebase_admin.initialize_app()
except Exception as e:
    print(f"Firebase initialization error: {e}")

app = FastAPI(
    title="TheraVillage API",
    description="Backend API for TheraVillage wellness platform with Google authentication and enhanced security",
    version="1.0.0"
)

# Security middleware to log all requests
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """Log all requests for security monitoring"""
    request_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    # Log request details
    print(f"🔒 SECURITY LOG: {request_id} - {request.method} {request.url} - {request.client.host if request.client else 'unknown'}")
    
    # Add request ID to response headers
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    # Fix Firebase authentication popup issues
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
    
    # Log response details
    process_time = (datetime.utcnow() - start_time).total_seconds()
    print(f"🔒 SECURITY LOG: {request_id} - Completed in {process_time:.3f}s - Status: {response.status_code}")
    
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://theravillage-edb89.web.app",
        "https://theravillage-edb89.firebaseapp.com",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"⚠️  Database initialization failed: {e}")
        print("API will start but database features will not work")

async def log_admin_action(
    admin_uid: str, 
    action: str, 
    target_uid: str, 
    db: AsyncSession
):
    """Log admin actions for audit trail"""
    try:
        await db.execute(
            text("""
                INSERT INTO admin_audit_log (admin_uid, action, target_uid, timestamp)
                VALUES (:admin_uid, :action, :target_uid, NOW())
            """),
            {"admin_uid": admin_uid, "action": action, "target_uid": target_uid}
        )
        await db.commit()
    except Exception as e:
        print(f"Failed to log admin action: {e}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "TheraVillage API is running!", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "xtheravillage-api"}



@app.post("/users/register")
async def register_user(
    request: UserRegistrationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with Google authentication"""
    try:
        # Extract token from request body
        token = request.token
        if not token:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Token is required"
            )
        
        # Verify the Firebase token
        decoded_token = auth.verify_id_token(token)
        firebase_uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        name = decoded_token.get("name", "")
        
        # Check if user already exists
        result = await db.execute(
            text("SELECT id FROM users WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        if result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already registered"
            )
        
        # Create new user
        result = await db.execute(
            text("""
                INSERT INTO users (firebase_uid, email, name, is_admin, disabled)
                VALUES (:uid, :email, :name, false, false)
                RETURNING id
            """),
            {"uid": firebase_uid, "email": email, "name": name}
        )
        user_id = result.fetchone()[0]
        
        # Ensure the transaction is committed
        await db.commit()
        
        # Verify the user was actually created
        verify_result = await db.execute(
            text("SELECT id FROM users WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        if not verify_result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User creation failed - database transaction issue"
            )
        
        return {
            "message": "User registered successfully", 
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "email": email,
            "name": name
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ User registration error: {e}")
        print(f"❌ Error type: {type(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@app.get("/users/me")
async def get_current_user_info(
    ctx: AuthedContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user information"""
    # SECURITY: Users can ONLY access their own data via /users/me
    # No user ID parameter means no way to access other users' data
    
    # User is already authenticated and exists (checked in get_current_user)
    # Just return their information
    result = await db.execute(
        text("SELECT id, firebase_uid, email, name, created_at, disabled, is_admin FROM users WHERE firebase_uid = :uid"),
        {"uid": ctx.firebase_uid}
    )
    user = result.fetchone()
    
    # This should never happen since get_current_user already verified the user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User data not found - this should not happen"
        )
    
    return {
        "id": user[0],
        "firebase_uid": user[1],
        "email": user[2],
        "name": user[3],
        "created_at": user[4],
        "disabled": user[5],
        "is_admin": user[6]
    }

# SECURITY: NO endpoint like /users/{user_id} exists
# This prevents users from accessing other users' data by guessing IDs

@app.post("/admin/users/{firebase_uid}/revoke")
async def revoke_user(
    firebase_uid: str,
    ctx: AuthedContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Revoke user access (admin only)"""
    # SECURITY: Only admins can access this endpoint
    # Regular users cannot revoke other users
    
    try:
        # Revoke Firebase refresh tokens
        auth.revoke_refresh_tokens(firebase_uid)
        
        # Update database
        await db.execute(
            text("UPDATE users SET disabled = true WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        await db.commit()
        
        # Log admin action for audit trail
        await log_admin_action(ctx.firebase_uid, "revoke_user", firebase_uid, db)
        
        return {"message": "User revoked successfully", "uid": firebase_uid}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Revoke failed: {str(e)}"
        )

@app.post("/admin/users/{firebase_uid}/enable")
async def enable_user(
    firebase_uid: str,
    ctx: AuthedContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Enable user access (admin only)"""
    # SECURITY: Only admins can access this endpoint
    # Regular users cannot enable other users
    
    try:
        await db.execute(
            text("UPDATE users SET disabled = false WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        await db.commit()
        
        # Log admin action for audit trail
        await log_admin_action(ctx.firebase_uid, "enable_user", firebase_uid, db)
        
        return {"message": "User enabled successfully", "uid": firebase_uid}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enable failed: {str(e)}"
        )

@app.get("/admin/users")
async def list_users(
    ctx: AuthedContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)"""
    # SECURITY: Only admins can see the user list
    # Regular users cannot see other users' information
    
    result = await db.execute(
        text("SELECT firebase_uid, email, name, created_at, disabled, is_admin FROM users ORDER BY created_at DESC")
    )
    users = result.fetchall()
    
    return {
        "users": [
            {
                "firebase_uid": user[0],
                "email": user[1],
                "name": user[2],
                "created_at": user[3],
                "disabled": user[4],
                "is_admin": user[5]
            }
            for user in users
        ]
    }



@app.post("/admin/users/{firebase_uid}/promote")
async def promote_user_to_admin(
    firebase_uid: str,
    ctx: AuthedContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Promote a user to admin (admin only)"""
    # SECURITY: Only existing admins can promote other users
    
    try:
        # Check if target user exists
        result = await db.execute(
            text("SELECT id, email, name, is_admin FROM users WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        user = result.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_id, email, name, is_admin = user
        
        if is_admin:
            return {
                "message": "User is already an admin",
                "uid": firebase_uid,
                "email": email
            }
        
        # Promote user to admin
        await db.execute(
            text("UPDATE users SET is_admin = true WHERE id = :user_id"),
            {"user_id": user_id}
        )
        await db.commit()
        
        # Log admin action for audit trail
        await log_admin_action(ctx.firebase_uid, "promote_user", firebase_uid, db)
        
        return {
            "message": "User promoted to admin successfully",
            "uid": firebase_uid,
            "email": email,
            "name": name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Promotion failed: {str(e)}"
        )

@app.post("/admin/users/{firebase_uid}/demote")
async def demote_admin_to_user(
    firebase_uid: str,
    ctx: AuthedContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Demote an admin to regular user (admin only)"""
    # SECURITY: Only existing admins can demote other admins
    
    try:
        # Check if target user exists and is admin
        result = await db.execute(
            text("SELECT id, email, name, is_admin FROM users WHERE firebase_uid = :uid"),
            {"uid": firebase_uid}
        )
        user = result.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_id, email, name, is_admin = user
        
        if not is_admin:
            return {
                "message": "User is not an admin",
                "uid": firebase_uid,
                "email": email
            }
        
        # Prevent self-demotion (admin can't demote themselves)
        if firebase_uid == ctx.firebase_uid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote yourself"
            )
        
        # Demote user from admin
        await db.execute(
            text("UPDATE users SET is_admin = false WHERE id = :user_id"),
            {"user_id": user_id}
        )
        await db.commit()
        
        # Log admin action for audit trail
        await log_admin_action(ctx.firebase_uid, "demote_user", firebase_uid, db)
        
        return {
            "message": "User demoted from admin successfully",
            "uid": firebase_uid,
            "email": email,
            "name": name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Demotion failed: {str(e)}"
        )


