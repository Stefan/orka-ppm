"""
Schedule Export Service

Handles schedule data export in multiple formats:
- CSV for schedule data
- MS Project XML (placeholder structure)
- Primavera P6 XML (placeholder structure)
- PDF report (placeholder - returns summary data for client-side PDF generation)
"""

import csv
import io
import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)


class ScheduleExportService:
    """Export schedules to CSV, MS Project, Primavera, and PDF-compatible data."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    async def get_schedule_with_tasks_for_export(self, schedule_id: UUID) -> Dict[str, Any]:
        """Load schedule and all tasks/dependencies for export."""
        schedule_result = self.db.table("schedules").select("*").eq("id", str(schedule_id)).execute()
        if not schedule_result.data:
            raise ValueError(f"Schedule {schedule_id} not found")
        schedule = schedule_result.data[0]

        tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).order("wbs_code").execute()
        tasks = tasks_result.data or []

        deps_result = self.db.table("task_dependencies").select("*").execute()
        deps = deps_result.data or []
        schedule_task_ids = {t["id"] for t in tasks}
        deps = [d for d in deps if d["predecessor_task_id"] in schedule_task_ids and d["successor_task_id"] in schedule_task_ids]

        return {"schedule": schedule, "tasks": tasks, "dependencies": deps}

    async def export_csv(self, schedule_id: UUID) -> str:
        """Export schedule and tasks to CSV string."""
        data = await self.get_schedule_with_tasks_for_export(schedule_id)
        tasks = data["tasks"]
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "WBS", "Name", "Start", "End", "Duration", "Progress", "Status",
            "Is Critical", "Total Float", "Predecessors", "Successors"
        ])
        task_id_to_wbs = {t["id"]: t["wbs_code"] for t in tasks}
        for t in tasks:
            pred_ids = [d["predecessor_task_id"] for d in data["dependencies"] if d["successor_task_id"] == t["id"]]
            succ_ids = [d["successor_task_id"] for d in data["dependencies"] if d["predecessor_task_id"] == t["id"]]
            pred_wbs = ",".join(task_id_to_wbs.get(pid, "") for pid in pred_ids)
            succ_wbs = ",".join(task_id_to_wbs.get(sid, "") for sid in succ_ids)
            writer.writerow([
                t.get("wbs_code", ""),
                t.get("name", ""),
                t.get("planned_start_date", ""),
                t.get("planned_end_date", ""),
                t.get("duration_days", ""),
                t.get("progress_percentage", 0),
                t.get("status", ""),
                t.get("is_critical", False),
                t.get("total_float_days", 0),
                pred_wbs,
                succ_wbs,
            ])
        return output.getvalue()

    async def export_ms_project_xml(self, schedule_id: UUID) -> str:
        """Export schedule to MS Project–compatible XML structure (simplified)."""
        data = await self.get_schedule_with_tasks_for_export(schedule_id)
        schedule = data["schedule"]
        tasks = data["tasks"]
        deps = data["dependencies"]
        # Simplified XML structure for MS Project import
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Project xmlns="http://schemas.microsoft.com/project">',
            f"  <Name>{schedule.get('name', '')}</Name>",
            f"  <StartDate>{schedule.get('start_date', '')}</StartDate>",
            f"  <FinishDate>{schedule.get('end_date', '')}</FinishDate>",
            "  <Tasks>",
        ]
        for t in tasks:
            lines.append(f"    <Task><UID>{t['id']}</UID><WBS>{t.get('wbs_code','')}</WBS><Name>{t.get('name','')}</Name><Start>{t.get('planned_start_date','')}</Start><Finish>{t.get('planned_end_date','')}</Finish><Duration>{t.get('duration_days',0)}</Duration><PercentComplete>{t.get('progress_percentage',0)}</PercentComplete></Task>")
        lines.append("  </Tasks>")
        lines.append("  <PredecessorLink>")
        for d in deps:
            lines.append(f"    <Link><PredecessorUID>{d['predecessor_task_id']}</PredecessorUID><SuccessorUID>{d['successor_task_id']}</SuccessorUID><Type>1</Type><Lag>{d.get('lag_days',0)}</Lag></Link>")
        lines.append("  </PredecessorLink>")
        lines.append("</Project>")
        return "\n".join(lines)

    async def export_primavera_xml(self, schedule_id: UUID) -> str:
        """Export schedule to Primavera P6–compatible XML structure (simplified)."""
        data = await self.get_schedule_with_tasks_for_export(schedule_id)
        schedule = data["schedule"]
        tasks = data["tasks"]
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Project xmlns="http://xmlns.oracle.com/Primavera P6">',
            f"  <Name>{schedule.get('name', '')}</Name>",
            f"  <PlannedStart>{schedule.get('start_date', '')}</PlannedStart>",
            f"  <PlannedFinish>{schedule.get('end_date', '')}</PlannedFinish>",
            "  <Activities>",
        ]
        for t in tasks:
            lines.append(f"    <Activity><Id>{t['id']}</Id><Code>{t.get('wbs_code','')}</Code><Name>{t.get('name','')}</Name><Start>{t.get('planned_start_date','')}</Start><Finish>{t.get('planned_end_date','')}</Finish><Duration>{t.get('duration_days',0)}</Duration><PercentComplete>{t.get('progress_percentage',0)}</PercentComplete></Activity>")
        lines.append("  </Activities>")
        lines.append("</Project>")
        return "\n".join(lines)

    async def export_pdf_data(self, schedule_id: UUID) -> Dict[str, Any]:
        """Return schedule summary and task list for client-side PDF generation."""
        data = await self.get_schedule_with_tasks_for_export(schedule_id)
        schedule = data["schedule"]
        tasks = data["tasks"]
        return {
            "schedule": {
                "name": schedule.get("name"),
                "start_date": schedule.get("start_date"),
                "end_date": schedule.get("end_date"),
                "status": schedule.get("status"),
            },
            "tasks": [
                {
                    "wbs_code": t.get("wbs_code"),
                    "name": t.get("name"),
                    "planned_start_date": t.get("planned_start_date"),
                    "planned_end_date": t.get("planned_end_date"),
                    "duration_days": t.get("duration_days"),
                    "progress_percentage": t.get("progress_percentage"),
                    "status": t.get("status"),
                }
                for t in tasks
            ],
            "exported_at": datetime.utcnow().isoformat(),
        }
