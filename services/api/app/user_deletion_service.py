from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict
import logging
import json

logger = logging.getLogger(__name__)

class UserDeletionService:
    """Simplified service for user deletion with safety checks and impact analysis"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_deletion_impact(self, user_id: int) -> Dict:
        """Get comprehensive impact analysis before deleting a user"""
        try:
            # Get user basic info
            user_result = await self.db.execute(
                text("SELECT id, name, email, role, status FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            user = user_result.fetchone()
            
            if not user:
                return {"error": "User not found"}
            
            user_id, name, email, role, status = user
            
            # Get impact counts for all related data
            impact_result = await self.db.execute(
                text("""
                    SELECT 
                        -- Therapist assignments (if user is therapist)
                        (SELECT COUNT(*) FROM therapist_assignments WHERE therapist_id = :user_id) as therapist_assignments,
                        -- Client assignments (if user is client)
                        (SELECT COUNT(*) FROM therapist_assignments WHERE client_id = :user_id) as client_assignments,
                        -- Agency assignments (if user is therapist)
                        (SELECT COUNT(*) FROM therapist_agency_assignments WHERE therapist_id = :user_id) as agency_assignments,
                        -- Appointments as therapist
                        (SELECT COUNT(*) FROM appointments WHERE therapist_id = :user_id) as appointments_as_therapist,
                        -- Appointments as client
                        (SELECT COUNT(*) FROM appointments WHERE client_id = :user_id) as appointments_as_client,
                        -- Sessions (via appointments)
                        (SELECT COUNT(*) FROM sessions s 
                         JOIN appointments a ON s.appointment_id = a.id 
                         WHERE a.therapist_id = :user_id OR a.client_id = :user_id) as sessions,
                        -- Notes (via sessions)
                        (SELECT COUNT(*) FROM notes n 
                         JOIN sessions s ON n.session_id = s.id 
                         JOIN appointments a ON s.appointment_id = a.id 
                         WHERE a.therapist_id = :user_id OR a.client_id = :user_id) as notes,
                        -- Homework plans
                        (SELECT COUNT(*) FROM homework_plans WHERE client_id = :user_id OR assigned_by = :user_id) as homework_plans,
                        -- Files
                        (SELECT COUNT(*) FROM files WHERE owner_id = :user_id OR client_id = :user_id) as files,
                        -- Messages
                        (SELECT COUNT(*) FROM messages WHERE sender_id = :user_id) as messages,
                        -- Threads
                        (SELECT COUNT(*) FROM threads WHERE client_id = :user_id) as threads,
                        -- Pending clients (if user is therapist) - only count actual pending ones
                        (SELECT COUNT(*) FROM pending_clients WHERE therapist_id = :user_id AND status = 'pending') as pending_clients,
                        -- Waitlist entries
                        (SELECT COUNT(*) FROM waitlist WHERE client_id = :user_id) as waitlist_entries,
                        -- Availability slots
                        (SELECT COUNT(*) FROM availability WHERE therapist_id = :user_id) as availability_slots,
                        -- Credentials
                        (SELECT COUNT(*) FROM credentials WHERE therapist_id = :user_id) as credentials,
                        -- Audit logs
                        (SELECT COUNT(*) FROM audit_logs WHERE actor_id = :user_id) as audit_logs,
                        -- Notifications
                        (SELECT COUNT(*) FROM notifications WHERE user_id = :user_id) as notifications
                """),
                {"user_id": user_id}
            )
            
            impact = impact_result.fetchone()
            
            # Build impact message
            impact_message_parts = []
            if impact[0] > 0:  # therapist_assignments
                impact_message_parts.append(f"• {impact[0]} therapist assignments")
            if impact[1] > 0:  # client_assignments
                impact_message_parts.append(f"• {impact[1]} client assignments")
            if impact[3] > 0:  # appointments_as_therapist
                impact_message_parts.append(f"• {impact[3]} appointments as therapist")
            if impact[4] > 0:  # appointments_as_client
                impact_message_parts.append(f"• {impact[4]} appointments as client")
            if impact[5] > 0:  # sessions
                impact_message_parts.append(f"• {impact[5]} sessions")
            if impact[6] > 0:  # notes
                impact_message_parts.append(f"• {impact[6]} notes")
            if impact[7] > 0:  # homework_plans
                impact_message_parts.append(f"• {impact[7]} homework plans")
            if impact[8] > 0:  # files
                impact_message_parts.append(f"• {impact[8]} files")
            if impact[9] > 0:  # messages
                impact_message_parts.append(f"• {impact[9]} messages")
            if impact[10] > 0:  # threads
                impact_message_parts.append(f"• {impact[10]} threads")
            if impact[11] > 0:  # pending_clients
                impact_message_parts.append(f"• {impact[11]} pending clients")
            if impact[12] > 0:  # waitlist_entries
                impact_message_parts.append(f"• {impact[12]} waitlist entries")
            if impact[13] > 0:  # availability_slots
                impact_message_parts.append(f"• {impact[13]} availability slots")
            if impact[14] > 0:  # credentials
                impact_message_parts.append(f"• {impact[14]} credentials")
            if impact[15] > 0:  # audit_logs
                impact_message_parts.append(f"• {impact[15]} audit logs")
            if impact[16] > 0:  # notifications
                impact_message_parts.append(f"• {impact[16]} notifications")
            
            impact_message = f"Deleting {name} ({email}) - Role: {role}\n\nThis will also delete:\n" + "\n".join(impact_message_parts) if impact_message_parts else f"Deleting {name} ({email}) - Role: {role}\n\nNo related data will be affected."
            
            return {
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": email,
                    "role": role,
                    "status": status
                },
                "impact": {
                    "therapist_assignments": impact[0],
                    "client_assignments": impact[1],
                    "agency_assignments": impact[2],
                    "appointments_as_therapist": impact[3],
                    "appointments_as_client": impact[4],
                    "sessions": impact[5],
                    "notes": impact[6],
                    "homework_plans": impact[7],
                    "files": impact[8],
                    "messages": impact[9],
                    "threads": impact[10],
                    "pending_clients": impact[11],
                    "waitlist_entries": impact[12],
                    "availability_slots": impact[13],
                    "credentials": impact[14],
                    "audit_logs": impact[15],
                    "notifications": impact[16]
                },
                "total_records": sum(impact),
                "impact_message": impact_message
            }
            
        except Exception as e:
            logger.error(f"Error getting user deletion impact: {e}")
            raise
    
    async def delete_user_simple(self, user_id: int, admin_user_id: int) -> Dict:
        """Delete user with safety checks and audit logging - let database handle cascading"""
        try:
            # Get user info for logging
            user_result = await self.db.execute(
                text("SELECT name, email, role FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            user = user_result.fetchone()
            
            if not user:
                return {"error": "User not found"}
            
            name, email, role = user
            
            # Log the deletion attempt
            await self.db.execute(
                text("""
                    INSERT INTO audit_logs (actor_id, action, entity, entity_id, payload)
                    VALUES (:actor_id, 'USER_DELETION_STARTED', 'users', :entity_id, :payload)
                """),
                {
                    "actor_id": admin_user_id,
                    "entity_id": user_id,
                    "payload": json.dumps({
                        "user_name": name,
                        "user_email": email,
                        "user_role": role,
                        "deletion_type": "cascade"
                    })
                }
            )
            
            # Get impact before deletion for logging
            impact = await self.get_user_deletion_impact(user_id)
            
            # Simple delete - let database handle cascading
            delete_result = await self.db.execute(
                text("DELETE FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            
            if delete_result.rowcount == 0:
                return {"error": "User deletion failed - no rows affected"}
            
            # Log successful deletion
            await self.db.execute(
                text("""
                    INSERT INTO audit_logs (actor_id, action, entity, entity_id, payload)
                    VALUES (:actor_id, 'USER_DELETION_COMPLETED', 'users', :entity_id, :payload)
                """),
                {
                    "actor_id": admin_user_id,
                    "entity_id": user_id,
                    "payload": json.dumps({
                        "user_name": name,
                        "user_email": email,
                        "user_role": role,
                        "impact": impact.get("impact", {}),
                        "total_records_deleted": impact.get("total_records", 0)
                    })
                }
            )
            
            # Commit transaction
            await self.db.commit()
            
            logger.info(f"User {name} ({email}) deleted successfully by admin {admin_user_id}")
            
            return {
                "success": True,
                "message": f"User {name} deleted successfully",
                "user_id": user_id,
                "user_name": name,
                "user_email": email,
                "user_role": role,
                "impact": impact.get("impact", {}),
                "total_records_deleted": impact.get("total_records", 0)
            }
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting user {user_id}: {e}")
            
            # Log the failed deletion attempt
            try:
                await self.db.execute(
                    text("""
                        INSERT INTO audit_logs (actor_id, action, entity, entity_id, payload)
                        VALUES (:actor_id, 'USER_DELETION_FAILED', 'users', :entity_id, :payload)
                    """),
                    {
                        "actor_id": admin_user_id,
                        "entity_id": user_id,
                        "payload": json.dumps({
                            "error": str(e),
                            "error_type": type(e).__name__
                        })
                    }
                )
                await self.db.commit()
            except:
                pass  # Don't let logging errors affect the main error response
            
            raise
    
    async def validate_deletion_safety(self, user_id: int, admin_user_id: int) -> Dict:
        """Validate that deletion is safe and allowed"""
        try:
            # Check if user exists
            user_result = await self.db.execute(
                text("SELECT id, name, email, role FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            user = user_result.fetchone()
            
            if not user:
                return {"valid": False, "error": "User not found"}
            
            user_id, name, email, role = user
            
            # Prevent self-deletion
            if user_id == admin_user_id:
                return {
                    "valid": False, 
                    "error": "You cannot delete yourself",
                    "user_name": name
                }
            
            # Check if user is the last admin
            if role == "admin":
                admin_count_result = await self.db.execute(
                    text("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"),
                    {}
                )
                admin_count = admin_count_result.fetchone()[0]
                
                if admin_count <= 1:
                    return {
                        "valid": False,
                        "error": "Cannot delete the last active admin",
                        "user_name": name
                    }
            
            return {
                "valid": True,
                "user_name": name,
                "user_email": email,
                "user_role": role
            }
            
        except Exception as e:
            logger.error(f"Error validating deletion safety: {e}")
            return {"valid": False, "error": f"Validation error: {str(e)}"}
