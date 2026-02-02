"""
Schedule Audit Trail Service (Task 13.3).

Comprehensive change logging for schedules, tasks, dependencies with user attribution and timestamps.
"""

import logging
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)

SCHEDULE_AUDIT_TABLES = ("schedules", "tasks", "task_dependencies", "wbs_elements", "schedule_baselines", "task_resource_assignments")


class ScheduleAuditService:
    """Audit trail for schedule-related changes."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    async def get_schedule_audit_trail(
        self,
        schedule_id: UUID,
        limit: int = 100,
        since: Optional[date] = None,
        table_filter: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Get audit trail for a schedule: all changes to schedules, tasks, dependencies
        that belong to this schedule, with user attribution and timestamps.
        """
        try:
            # For schedules table, record_id is schedule_id
            # For tasks, we need to filter by schedule_id (tasks.schedule_id) - audit_logs has record_id = task_id
            # So we need: 1) audit_logs where table_name='schedules' and record_id=schedule_id
            # 2) task ids for this schedule, then audit_logs where table_name='tasks' and record_id in task_ids
            # 3) dependency ids for this schedule's tasks, then audit_logs for task_dependencies
            schedule_id_str = str(schedule_id)
            tables = table_filter or list(SCHEDULE_AUDIT_TABLES)

            # Get task ids for this schedule
            tasks_result = self.db.table("tasks").select("id").eq("schedule_id", schedule_id_str).execute()
            task_ids = [t["id"] for t in (tasks_result.data or [])]

            # Get dependency ids (where predecessor or successor is in task_ids)
            dep_ids = []
            if task_ids:
                try:
                    deps_result = self.db.table("task_dependencies").select("id").in_("predecessor_task_id", task_ids).execute()
                    dep_ids = [d["id"] for d in (deps_result.data or [])]
                    deps2 = self.db.table("task_dependencies").select("id").in_("successor_task_id", task_ids).execute()
                    for d in (deps2.data or []):
                        if d["id"] not in dep_ids:
                            dep_ids.append(d["id"])
                except Exception:
                    pass

            # Build query: audit_logs where (table_name, record_id) matches our scope
            # Supabase: we'll do multiple selects and merge
            since_ts = (datetime.combine(since, datetime.min.time()).isoformat() + "Z") if since else None
            all_entries: List[Dict[str, Any]] = []

            # Schedules
            if "schedules" in tables:
                q = self.db.table("audit_logs").select("*").eq("table_name", "schedules").eq("record_id", schedule_id_str)
                if since_ts:
                    q = q.gte("changed_at", since_ts)
                r = q.order("changed_at", desc=True).limit(limit).execute()
                all_entries.extend(r.data or [])

            # Tasks
            if task_ids and "tasks" in tables:
                for tid in task_ids[:500]:  # batch to avoid huge IN
                    q = self.db.table("audit_logs").select("*").eq("table_name", "tasks").eq("record_id", tid)
                    if since_ts:
                        q = q.gte("changed_at", since_ts)
                    r = q.order("changed_at", desc=True).limit(limit).execute()
                    all_entries.extend(r.data or [])

            # Task dependencies
            if dep_ids and "task_dependencies" in tables:
                for did in dep_ids[:200]:
                    q = self.db.table("audit_logs").select("*").eq("table_name", "task_dependencies").eq("record_id", did)
                    if since_ts:
                        q = q.gte("changed_at", since_ts)
                    r = q.order("changed_at", desc=True).limit(limit).execute()
                    all_entries.extend(r.data or [])

            # Sort by changed_at desc and limit
            all_entries.sort(key=lambda x: x.get("changed_at") or "", reverse=True)
            entries = all_entries[:limit]

            return {
                "schedule_id": schedule_id_str,
                "entries": entries,
                "total": len(entries),
            }
        except Exception as e:
            logger.error(f"Error getting schedule audit trail: {e}")
            raise RuntimeError(f"Failed to get audit trail: {str(e)}")
