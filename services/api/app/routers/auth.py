from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from firebase_admin import auth
import jwt
from datetime import date

from ..db import get_db
from ..security import get_current_user
from ..schemas import UserRegistrationRequest, RoleSelectionRequest

router = APIRouter()


@router.post("/users/register")
async def register_user(
    request: UserRegistrationRequest,
    db: AsyncSession = Depends(get_db)
):
    print(f"🔍 REGISTER DEBUG: Starting user registration")
    print(f"🔍 REGISTER DEBUG: Request data: {request}")
    
    try:
        token = request.token
        if not token:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Token is required")

        try:
            decoded_token = auth.verify_id_token(token)
            firebase_uid = decoded_token["uid"]
            email = decoded_token.get("email", "")
        except Exception as e:
            try:
                decoded_token = jwt.decode(token, options={"verify_signature": False})
                firebase_uid = decoded_token.get("user_id") or decoded_token.get("uid")
                email = decoded_token.get("email", "")
            except Exception:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Firebase token: {str(e)}")

        # Is this a client invitation acceptance?
        invitation_result = await db.execute(
            text(
                """
                SELECT * FROM pending_clients 
                WHERE LOWER(email) = LOWER(:email) 
                AND status = 'pending' 
                AND expires_at > NOW()
                """
            ),
            {"email": email},
        )
        invitation = invitation_result.fetchone()

        if invitation:
            # Check if user already exists for this invitation
            existing_user_result = await db.execute(text("SELECT id, role FROM users WHERE firebase_uid = :firebase_uid OR email = :email"), {"firebase_uid": firebase_uid, "email": email})
            existing_user = existing_user_result.fetchone()
            
            if existing_user:
                user_id, user_role = existing_user
                if user_role == "pending":
                    # Convert pending user to client
                    await db.execute(text("UPDATE users SET role = 'client', name = :name WHERE id = :user_id"), {"name": invitation.name, "user_id": user_id})
                    
                    # Create client profile if it doesn't exist
                    await db.execute(
                        text(
                            """
                            INSERT INTO client_profiles (user_id, dob)
                            VALUES (:user_id, :dob)
                            ON CONFLICT (user_id) DO NOTHING
                            """
                        ),
                        {"user_id": user_id, "dob": invitation.dob},
                    )
                    
                    # Assignment to therapist
                    await db.execute(
                        text(
                            """
                            INSERT INTO therapist_assignments (therapist_id, client_id, start_date)
                            VALUES (:therapist_id, :client_id, :start_date)
                            ON CONFLICT (therapist_id, client_id, start_date) DO NOTHING
                            """
                        ),
                        {"therapist_id": invitation.therapist_id, "client_id": user_id, "start_date": date.today()},
                    )
                    
                    # Mark invitation accepted
                    await db.execute(text("UPDATE pending_clients SET status = 'accepted' WHERE id = :id"), {"id": invitation.id})
                    await db.commit()
                    return {"message": "Client account created successfully", "user_id": user_id, "email": email, "name": invitation.name, "role": "client"}
                else:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
            
            # Create new client user
            # Create client user
            result = await db.execute(
                text(
                    """
                    INSERT INTO users (org_id, name, email, role, status, firebase_uid)
                    VALUES (:org_id, :name, :email, 'client', 'active', :firebase_uid)
                    RETURNING id
                    """
                ),
                {"org_id": 1, "name": invitation.name, "email": email, "firebase_uid": firebase_uid},
            )
            user_id = result.fetchone()[0]

            # Create minimal client profile
            await db.execute(
                text(
                    """
                    INSERT INTO client_profiles (user_id, dob)
                    VALUES (:user_id, :dob)
                    """
                ),
                {"user_id": user_id, "dob": invitation.dob},
            )

            # Assignment to therapist
            await db.execute(
                text(
                    """
                    INSERT INTO therapist_assignments (therapist_id, client_id, start_date)
                    VALUES (:therapist_id, :client_id, :start_date)
                    """
                ),
                {"therapist_id": invitation.therapist_id, "client_id": user_id, "start_date": date.today()},
            )

            # Mark invitation accepted
            await db.execute(text("UPDATE pending_clients SET status = 'accepted' WHERE id = :id"), {"id": invitation.id})
            await db.commit()
            return {"message": "Client account created successfully", "user_id": user_id, "email": email, "name": invitation.name, "role": "client"}

        # Regular registration (pending role)
        # Check if user already exists
        existing_user = await db.execute(text("SELECT id FROM users WHERE firebase_uid = :firebase_uid OR email = :email"), {"firebase_uid": firebase_uid, "email": email})
        if existing_user.fetchone():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
        

        result = await db.execute(
            text(
                """
                INSERT INTO users (org_id, name, email, role, status, firebase_uid)
                VALUES (:org_id, :name, :email, 'pending', 'active', :firebase_uid)
                RETURNING id
                """
            ),
            {"org_id": request.org_id or 1, "name": request.name, "email": email, "firebase_uid": firebase_uid},
        )
        user_id = result.fetchone()[0]
        await db.commit()
        return {"message": "User registered successfully - please select your role", "user_id": user_id, "email": email, "name": request.name, "role": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ REGISTER ERROR: Exception occurred: {type(e).__name__}: {str(e)}")
        print(f"❌ REGISTER ERROR: Exception details: {e}")
        await db.rollback()
        print(f"❌ REGISTER ERROR: Transaction rolled back")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {str(e)}")


@router.post("/users/select-role")
async def select_user_role(
    request: RoleSelectionRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        token = request.token
        if not token:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Token is required")

        try:
            decoded_token = auth.verify_id_token(token)
            firebase_uid = decoded_token["uid"]
            email = decoded_token.get("email", "")
        except Exception as e:
            try:
                decoded_token = jwt.decode(token, options={"verify_signature": False})
                firebase_uid = decoded_token.get("user_id") or decoded_token.get("uid")
                email = decoded_token.get("email", "")
            except Exception:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Firebase token: {str(e)}")

        result = await db.execute(
            text("SELECT id, role FROM users WHERE firebase_uid = :firebase_uid OR email = :email"),
            {"firebase_uid": firebase_uid, "email": email},
        )
        user = result.fetchone()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        user_id, current_role = user
        if current_role != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a role")

        if request.role == "client":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client accounts can only be created through therapist invitations")

        # Update user role
        await db.execute(text("UPDATE users SET role = :role WHERE id = :user_id"), {"role": request.role, "user_id": user_id})
        
        # Create corresponding profile based on role
        if request.role == "therapist":
            await db.execute(
                text("INSERT INTO therapist_profiles (user_id) VALUES (:user_id)"),
                {"user_id": user_id}
            )
        elif request.role == "admin":
            await db.execute(
                text("INSERT INTO admin_profiles (user_id) VALUES (:user_id)"),
                {"user_id": user_id}
            )
        elif request.role == "agency":
            await db.execute(
                text("INSERT INTO agency_profiles (user_id) VALUES (:user_id)"),
                {"user_id": user_id}
            )
        
        await db.commit()
        return {"message": "Role selected successfully", "user_id": user_id, "role": request.role}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Role selection failed: {str(e)}")


@router.get("/users/me")
async def get_current_user_info(ctx = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    print(f"🔍 /users/me DEBUG: ctx.user_id={ctx.user_id}, ctx.email={ctx.email}, ctx.role={ctx.role}")
    result = await db.execute(text("SELECT id, org_id, name, email, role, status, last_login FROM users WHERE id = :user_id"), {"user_id": ctx.user_id})
    user = result.fetchone()
    if not user:
        print(f"🚨 /users/me ERROR: No user found with id={ctx.user_id}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User data not found - this should not happen")
    print(f"🔍 /users/me DEBUG: Found user: id={user[0]}, role={user[4]}, email={user[3]}")
    needs_role_selection = user[4] == "pending"
    response_data = {"id": user[0], "org_id": user[1], "name": user[2], "email": user[3], "role": user[4], "status": user[5], "last_login": user[6], "needs_role_selection": needs_role_selection}
    print(f"🔍 /users/me DEBUG: Returning: {response_data}")
    return response_data


@router.get("/debug/users")
async def debug_list_users(db: AsyncSession = Depends(get_db)):
    """Debug endpoint to list all users"""
    result = await db.execute(text("SELECT id, name, email, role, status, firebase_uid FROM users ORDER BY id"))
    users = result.fetchall()
    return {
        "users": [
            {
                "id": user[0],
                "name": user[1], 
                "email": user[2],
                "role": user[3],
                "status": user[4],
                "firebase_uid": user[5]
            } for user in users
        ]
    }

@router.post("/debug/update-firebase-uid")
async def debug_update_firebase_uid(request: dict, db: AsyncSession = Depends(get_db)):
    """Debug endpoint to update Firebase UID for a user"""
    email = request.get("email")
    new_firebase_uid = request.get("firebase_uid")
    
    if not email or not new_firebase_uid:
        raise HTTPException(400, "email and firebase_uid required")
    
    result = await db.execute(
        text("UPDATE users SET firebase_uid = :firebase_uid WHERE email = :email RETURNING id, name, email, role"),
        {"email": email, "firebase_uid": new_firebase_uid}
    )
    await db.commit()
    
    updated_user = result.fetchone()
    if updated_user:
        return {"message": "Firebase UID updated", "user": {"id": updated_user[0], "name": updated_user[1], "email": updated_user[2], "role": updated_user[3]}}
    else:
        raise HTTPException(404, "User not found")

@router.get("/users/invite/{invitation_token}")
async def get_invitation_details(invitation_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT pc.*, u.name as therapist_name 
            FROM pending_clients pc
            JOIN users u ON pc.therapist_id = u.id
            WHERE pc.invitation_token = :token 
            AND pc.status = 'pending'
            AND pc.expires_at > NOW()
            """
        ),
        {"token": invitation_token},
    )
    invitation = result.fetchone()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")
    return {
        "invitation_id": invitation.id,
        "client_name": invitation.name,
        "client_email": invitation.email,
        "therapist_name": invitation.therapist_name,
        "expires_at": invitation.expires_at.isoformat(),
    }


