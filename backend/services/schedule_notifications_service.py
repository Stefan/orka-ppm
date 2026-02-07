"""
Schedule Notifications Service (Task 13.2).

Task assignment notifications, milestone deadline alerts, schedule change notifications.
"""

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)


class ScheduleNotificationsService:
    """Notifications and alerts for schedules."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    async def get_milestone_deadline_alerts(
        self,
        user_id: Optional[UUID] = None,
        days_ahead: int = 14,
    ) -> List[Dict[str, Any]]:
        """Milestones due within days_ahead (and overdue)."""
        try:
            today = date.today()
            end = today + timedelta(days=days_ahead)
            q = (
                self.db.table("milestones")
                .select("id, schedule_id, name, target_date, status, task_id")
                .lte("target_date", end.isoformat())
                .in_("status", ["planned", "at_risk"])
            )
            r = q.execute()
            rows = r.data or []
            alerts = []
            for row in rows:
                target = date.fromisoformat(row["target_date"])
                overdue = target < today
                alerts.append({
                    "type": "milestone_deadline",
                    "id": row["id"],
                    "schedule_id": row["schedule_id"],
                    "name": row["name"],
                    "target_date": row["target_date"],
                    "status": row["status"],
                    "overdue": overdue,
                    "days_until": (target - today).days,
                })
            return alerts
        except Exception as e:
            logger.error(f"Error getting milestone alerts: {e}")
            return []

    async def get_task_assignment_notifications(
        self,
        user_id: UUID,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Recent task resource assignments (for the user if resource is user, or all for admin)."""
        try:
            # Assume task_resource_assignments has created_by; show recent assignments
            r = (
                self.db.table("task_resource_assignments")
                .select("id, task_id, resource_id, assignment_start_date, assignment_end_date, created_at")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = r.data or []
            return [
                {
                    "type": "task_assignment",
                    "id": x["id"],
                    "task_id": x["task_id"],
                    "resource_id": x["resource_id"],
                    "assignment_start_date": x.get("assignment_start_date"),
                    "assignment_end_date": x.get("assignment_end_date"),
                    "created_at": x.get("created_at"),
                }
                for x in rows
            ]
        except Exception as e:
            logger.error(f"Error getting task assignment notifications: {e}")
            return []

    async def get_schedule_notifications(
        self,
        user_id: Optional[UUID] = None,
        schedule_id: Optional[UUID] = None,
        days_ahead: int = 14,
    ) -> Dict[str, Any]:
        """Aggregated notifications: milestone alerts + recent assignments (parallelized)."""
        import asyncio
        if user_id:
            milestone_alerts, task_notifications = await asyncio.gather(
                self.get_milestone_deadline_alerts(user_id=user_id, days_ahead=days_ahead),
                self.get_task_assignment_notifications(user_id=user_id),
            )
        else:
            milestone_alerts = await self.get_milestone_deadline_alerts(user_id=user_id, days_ahead=days_ahead)
            task_notifications = []
        if schedule_id:
            milestone_alerts = [a for a in milestone_alerts if a.get("schedule_id") == str(schedule_id)]
        return {
            "milestone_alerts": milestone_alerts,
            "task_assignments": task_notifications[:20],
        }
