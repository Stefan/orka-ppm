"""
Audit Service for Project Import Operations

This service provides audit trail logging for project import operations,
recording user identity, timestamps, import methods, and outcomes for
compliance and tracking purposes.

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
import logging
import json

from config.database import get_db


class AuditService:
    """
    Service for logging project import operations to audit trail.
    
    This service logs all import attempts (successful and failed) with
    comprehensive context including user identity, timestamp, import method,
    record counts, and error details.
    
    Graceful degradation: If audit logging fails, the service logs a warning
    but does not raise exceptions, allowing the import operation to proceed.
    """
    
    def __init__(self, db_session=None):
        """
        Initialize the audit service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
    
    async def log_import_start(
        self,
        user_id: str,
        import_method: str,
        record_count: int
    ) -> str:
        """
        Log the start of an import operation.
        
        Creates an audit log entry when a user initiates a project import,
        recording the user identity, import method (JSON or CSV), and the
        number of records being imported.
        
        Args:
            user_id: ID of user performing import
            import_method: "json" or "csv"
            record_count: Number of records in import batch
            
        Returns:
            Audit log ID for tracking this operation (UUID string)
            
        Requirements: 5.1
        """
        audit_id = str(uuid4())
        
        try:
            if not self.db:
                self.logger.warning("Database client not available, skipping audit logging")
                return audit_id
            
            audit_entry = {
                "id": audit_id,
                "user_id": user_id,
                "action": "project_import",
                "entity_type": "project",
                "event_type": "import_started",
                "action_details": json.dumps({
                    "import_method": import_method,
                    "record_count": record_count
                }),
                "timestamp": datetime.now().isoformat(),
                "success": None,  # Will be updated on completion
                "error_message": None
            }
            
            # Insert audit log entry (minimal response to avoid PostgREST "JSON could not be generated")
            self.db.table("admin_audit_log").insert(audit_entry, returning="minimal").execute()
            self.logger.info(
                f"Audit log created: user={user_id}, method={import_method}, "
                f"records={record_count}, audit_id={audit_id}"
            )
            
            return audit_id
            
        except Exception as e:
            # Graceful degradation: log warning but don't fail import
            self.logger.warning(
                f"Failed to log import start (audit_id={audit_id}): {str(e)}",
                exc_info=True
            )
            return audit_id
    
    async def log_import_complete(
        self,
        audit_id: str,
        success: bool,
        imported_count: int,
        error_message: Optional[str] = None
    ) -> None:
        """
        Log the completion of an import operation.
        
        Updates the audit log entry created by log_import_start with the
        final outcome: success status, number of projects imported, and
        error details if the import failed.
        
        Args:
            audit_id: ID from log_import_start
            success: Whether import succeeded
            imported_count: Number of projects successfully imported
            error_message: Error description if failed (optional)
            
        Requirements: 5.2, 5.3, 5.4
        """
        try:
            if not self.db:
                self.logger.warning("Database client not available, skipping audit logging")
                return
            
            # Prepare update data
            update_data: Dict[str, Any] = {
                "success": success,
                "completed_at": datetime.now().isoformat()
            }
            
            # Update action_details with completion info
            try:
                # Fetch existing entry to merge action_details
                existing = self.db.table("admin_audit_log").select("action_details").eq("id", audit_id).execute()
                if existing.data and len(existing.data) > 0:
                    existing_details = json.loads(existing.data[0].get("action_details", "{}"))
                    existing_details.update({
                        "imported_count": imported_count,
                        "success": success
                    })
                    
                    if error_message:
                        existing_details["error_message"] = error_message
                    
                    update_data["action_details"] = json.dumps(existing_details)
                else:
                    # Entry not found, create minimal details
                    update_data["action_details"] = json.dumps({
                        "imported_count": imported_count,
                        "success": success,
                        "error_message": error_message
                    })
            except Exception as detail_error:
                self.logger.warning(f"Failed to merge action_details: {detail_error}")
                update_data["action_details"] = json.dumps({
                    "imported_count": imported_count,
                    "success": success,
                    "error_message": error_message
                })
            
            if error_message:
                update_data["error_message"] = error_message
            
            # Update audit log entry (minimal response to avoid PostgREST "JSON could not be generated")
            self.db.table("admin_audit_log").update(update_data, returning="minimal").eq("id", audit_id).execute()
            status = "succeeded" if success else "failed"
            self.logger.info(
                f"Audit log updated: audit_id={audit_id}, status={status}, "
                f"imported={imported_count}"
            )
            
        except Exception as e:
            # Graceful degradation: log warning but don't fail import
            # Requirement 5.5: Handle audit logging failures gracefully
            self.logger.warning(
                f"Failed to log import completion (audit_id={audit_id}): {str(e)}",
                exc_info=True
            )
