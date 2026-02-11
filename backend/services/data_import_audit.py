"""
Write data import events (projects, commitments, actuals) to the central audit trail (audit_logs).

Used so imports appear in the Audit Trail UI alongside other events.
Failures are logged but do not fail the import.

Import history (import_audit_logs) is trimmed to the last 10 entries per user after each write.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Any
from uuid import uuid4

from config.database import service_supabase

logger = logging.getLogger(__name__)

IMPORT_HISTORY_KEEP_LAST = 10


def trim_import_history(user_id: str, db_client: Optional[Any] = None, keep: int = IMPORT_HISTORY_KEEP_LAST) -> None:
    """
    Keep only the last `keep` import_audit_logs entries per user; delete older ones.
    Call after inserting a new row so the history does not grow indefinitely.
    """
    db = db_client or service_supabase
    if not db or not user_id:
        return
    try:
        # Fetch ids of all entries for this user, newest first
        r = db.table("import_audit_logs").select("id").eq("user_id", str(user_id)).order("created_at", desc=True).execute()
        ids = [row["id"] for row in (r.data or []) if row.get("id")]
        if len(ids) <= keep:
            return
        to_delete = ids[keep:]
        db.table("import_audit_logs").delete().in_("id", to_delete).execute()
        logger.debug("Trimmed import history for user %s: removed %d old entries", user_id, len(to_delete))
    except Exception as e:
        logger.warning("Failed to trim import history: %s", e, exc_info=True)

# Event type for all data imports in the central audit trail
DATA_IMPORT_EVENT_TYPE = "data_import"
ENTITY_TYPE_IMPORT = "data_import"


def log_data_import_to_audit_trail(
    user_id: str,
    import_type: str,
    success: bool,
    total_records: int,
    success_count: int = 0,
    error_count: int = 0,
    duplicate_count: int = 0,
    tenant_id: Optional[str] = None,
    error_message: Optional[str] = None,
    import_id: Optional[str] = None,
) -> None:
    """
    Write one event to audit_logs for a data import (projects, commitments, or actuals).

    Call after import_audit_logs is written. If this fails, log and continue (do not fail the import).

    Args:
        user_id: ID of the user who ran the import.
        import_type: One of 'projects', 'commitments', 'actuals'.
        success: Whether the import completed successfully (or partially).
        total_records: Total records attempted.
        success_count: Records successfully imported.
        error_count: Records that failed.
        duplicate_count: Records skipped as duplicates (if applicable).
        tenant_id: Optional tenant/organization ID for filtering in Audit Trail.
        error_message: Optional short error summary.
        import_id: Optional import run ID for correlation with import_audit_logs.
    """
    if not service_supabase or not user_id:
        return
    try:
        action_details = {
            "import_type": import_type,
            "success": success,
            "total_records": total_records,
            "success_count": success_count,
            "error_count": error_count,
            "duplicate_count": duplicate_count,
        }
        if error_message:
            action_details["error_message"] = error_message[:500]
        if import_id:
            action_details["import_id"] = import_id

        severity = "error" if (not success and error_count == total_records) else "warning" if error_count else "info"
        occurred_at = datetime.now(timezone.utc).isoformat()
        # SOX/001 schema requires table_name, record_id (UUID NOT NULL), action, entity, occurred_at
        record_id = import_id if import_id else str(uuid4())

        event = {
            "table_name": "import_audit_logs",
            "record_id": record_id,
            "action": "CREATE",
            "entity": "data_import",
            "occurred_at": occurred_at,
            "event_type": DATA_IMPORT_EVENT_TYPE,
            "entity_type": ENTITY_TYPE_IMPORT,
            "action_details": action_details,
            "severity": severity,
            "timestamp": occurred_at,
            "user_id": str(user_id),
        }
        if tenant_id:
            event["tenant_id"] = str(tenant_id).strip() or None
        if import_id:
            event["entity_id"] = import_id

        service_supabase.table("audit_logs").insert(event, returning="minimal").execute()
        logger.debug("Logged data import to audit_logs: type=%s success=%s", import_type, success)
    except Exception as e:
        logger.warning(
            "Failed to log data import to audit trail (audit_logs): %s",
            e,
            exc_info=True,
        )
