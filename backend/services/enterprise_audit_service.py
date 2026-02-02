"""
Phase 1 – Security & Scalability: SOX-compliant audit logging
Enterprise Readiness: audit_logs table (user_id, action, entity, old_value, new_value, timestamp, ip)
"""

import logging
import json
from datetime import datetime
from typing import Optional, Any
from uuid import UUID, uuid4

from config.database import get_db, service_supabase

logger = logging.getLogger(__name__)

# Allowed actions for SOX audit_logs
AUDIT_ACTIONS = frozenset({"CREATE", "UPDATE", "DELETE", "EXPORT", "LOGIN", "LOGIN_FAILED"})


class EnterpriseAuditService:
    """
    Writes immutable audit entries to audit_logs (SOX-compliant).
    Used by financial, CSV import, and auth flows.
    """

    def __init__(self, db=None):
        self.db = db or service_supabase or get_db()

    def log(
        self,
        user_id: str,
        action: str,
        entity: str,
        *,
        entity_id: Optional[str] = None,
        old_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Append one audit log entry. Never raises; logs warning on failure.
        """
        if action not in AUDIT_ACTIONS:
            logger.warning("EnterpriseAuditService: invalid action %s, skipping", action)
            return None

        try:
            if not self.db:
                logger.warning("EnterpriseAuditService: no db, skipping audit")
                return None

            def _serialize(v: Any) -> Optional[str]:
                if v is None:
                    return None
                if isinstance(v, (str, int, float, bool)):
                    return str(v)
                try:
                    return json.dumps(v, default=str)
                except Exception:
                    return str(v)

            payload = {
                "id": str(uuid4()),
                "user_id": user_id,
                "action": action,
                "entity": entity[:255],
                "entity_id": str(entity_id) if entity_id else None,
                "old_value": _serialize(old_value),
                "new_value": _serialize(new_value),
                "occurred_at": datetime.utcnow().isoformat() + "Z",
                "ip": ip,
                "user_agent": (user_agent or "")[:2048],
                "correlation_id": str(correlation_id) if correlation_id else None,
                "organization_id": str(organization_id) if organization_id else None,
            }

            self.db.table("audit_logs").insert(payload).execute()
            return payload["id"]
        except Exception as e:
            logger.warning("EnterpriseAuditService: failed to write audit_logs: %s", e)
            return None
