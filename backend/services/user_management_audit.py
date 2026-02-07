"""
Write user management actions (invite, create, update, delete, deactivate user)
to the central audit trail (audit_logs) so they appear in the Audit Trail UI.

Existing: Role assign/remove and custom roles are already logged in admin.py / RBACAuditService.
This module covers the remaining admin actions from users.py (admin_audit_log).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from config.database import service_supabase

logger = logging.getLogger(__name__)

# Map internal action names to SOX-style action and entity
ACTION_MAP = {
    "invite_user": "CREATE",
    "create_user": "CREATE",
    "update_user": "UPDATE",
    "delete_user": "DELETE",
    "deactivate_user": "UPDATE",
}


def log_user_management_to_audit_trail(
    admin_user_id: str,
    target_user_id: str,
    action: str,
    details: Dict[str, Any],
    tenant_id: Optional[str] = None,
) -> None:
    """
    Write one event to audit_logs for a user management action.
    Call from log_admin_action; failures are logged but do not fail the request.
    """
    if not service_supabase or not admin_user_id:
        return
    try:
        sox_action = ACTION_MAP.get(action, "UPDATE")
        occurred_at = datetime.now(timezone.utc).isoformat()
        event = {
            "table_name": "user_profiles",
            "record_id": str(target_user_id),
            "action": sox_action,
            "entity": "user",
            "occurred_at": occurred_at,
            "event_type": "user_management",
            "entity_type": "user",
            "entity_id": str(target_user_id),
            "action_details": {
                "action": action,
                "admin_user_id": str(admin_user_id),
                "target_user_id": str(target_user_id),
                **details,
            },
            "severity": "info",
            "timestamp": occurred_at,
            "user_id": str(admin_user_id),
        }
        if tenant_id:
            event["tenant_id"] = str(tenant_id).strip() or None
        service_supabase.table("audit_logs").insert(event).execute()
        logger.debug("Logged user management to audit_logs: action=%s target=%s", action, target_user_id)
    except Exception as e:
        logger.warning(
            "Failed to log user management to audit trail (audit_logs): %s",
            e,
            exc_info=True,
        )
