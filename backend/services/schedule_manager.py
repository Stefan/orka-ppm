"""
Schedule Manager Service

Handles all schedule management operations including:
- Schedule CRUD operations with project linking
- Task creation with WBS code generation
- Task hierarchy management with parent-child relationships
- Task update operations with validation
- Progress tracking and rollup calculations
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID, uuid4
from enum import Enum
import logging
import json
from decimal import Decimal

from config.database import supabase, service_supabase
from models.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse,
    TaskCreate, TaskUpdate, TaskResponse, TaskProgressUpdate,
    TaskStatus, ScheduleWithTasksResponse, TaskHierarchyResponse,
)

logger = logging.getLogger(__name__)

class ScheduleManager:
    """
    Handles all schedule management operations.
    
    Provides:
    - Schedule CRUD operations with project linking
    - Task creation with WBS code generation
    - Task hierarchy management with parent-child relationships
    - Task update operations with validation
    - Progress tracking and rollup calculations
    """
    
    def __init__(self):
        self.db = service_supabase if service_supabase else supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def create_schedule(
        self,
        project_id: UUID,
        schedule_data: ScheduleCreate,
        created_by: UUID
    ) -> ScheduleResponse:
        """
        Create a new project schedule with project linking.
        
        Args:
            project_id: ID of the project
            schedule_data: Schedule creation data
            created_by: ID of the user creating the schedule
            
        Returns:
            ScheduleResponse: Created schedule data
        """
        try:
            # Validate project exists
            project_result = self.db.table("projects").select("id").eq("id", str(project_id)).execute()
            if not project_result.data:
                raise ValueError(f"Project {project_id} not found")
            
            # Prepare schedule data
            schedule_record = {
                "id": str(uuid4()),
                "project_id": str(project_id),
                "name": schedule_data.name,
                "description": schedule_data.description,
                "start_date": schedule_data.start_date.isoformat(),
                "end_date": schedule_data.end_date.isoformat(),
                "status": "active",
                "created_by": str(created_by),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Insert schedule
            result = self.db.table("schedules").insert(schedule_record).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create schedule")
            
            created_schedule = result.data[0]
            
            # Convert to response model
            return ScheduleResponse(
                id=created_schedule["id"],
                project_id=created_schedule["project_id"],
                name=created_schedule["name"],
                description=created_schedule["description"],
                start_date=date.fromisoformat(created_schedule["start_date"]),
                end_date=date.fromisoformat(created_schedule["end_date"]),
                baseline_start_date=None,
                baseline_end_date=None,
                status=created_schedule["status"],
                schedule_performance_index=created_schedule.get("schedule_performance_index"),
                schedule_variance_days=created_schedule.get("schedule_variance_days"),
                created_by=created_schedule["created_by"],
                created_at=datetime.fromisoformat(created_schedule["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(created_schedule["updated_at"].replace('Z', '+00:00'))
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating schedule: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create schedule: {str(e)}")

    async def list_schedules(
        self,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: Optional[str] = "created_at",
        sort_order: str = "desc",
        count_exact: bool = False,
    ) -> Tuple[List[ScheduleResponse], int]:
        """
        List schedules with optional filtering and pagination.
        Returns (list of schedules, total count). Use count_exact=True only when you need exact total (slower).
        """
        try:
            if count_exact:
                query = self.db.table("schedules").select("*", count="exact")
            else:
                query = self.db.table("schedules").select("*")
            if project_id:
                query = query.eq("project_id", str(project_id))
            if status:
                query = query.eq("status", status)
            if sort_by:
                query = query.order(sort_by, desc=(sort_order == "desc"))
            offset = (page - 1) * page_size
            query = query.range(offset, offset + page_size - 1)
            result = query.execute()
            items = result.data or []
            if count_exact and hasattr(result, "count") and result.count is not None:
                total = result.count
            else:
                total = offset + len(items)
            schedules = [
                ScheduleResponse(
                    id=s["id"],
                    project_id=s["project_id"],
                    name=s["name"],
                    description=s.get("description"),
                    start_date=date.fromisoformat(s["start_date"]),
                    end_date=date.fromisoformat(s["end_date"]),
                    baseline_start_date=date.fromisoformat(s["baseline_start_date"]) if s.get("baseline_start_date") else None,
                    baseline_end_date=date.fromisoformat(s["baseline_end_date"]) if s.get("baseline_end_date") else None,
                    status=s["status"],
                    schedule_performance_index=s.get("schedule_performance_index"),
                    schedule_variance_days=s.get("schedule_variance_days"),
                    created_by=s["created_by"],
                    created_at=datetime.fromisoformat(s["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(s["updated_at"].replace("Z", "+00:00")),
                )
                for s in items
            ]
            return schedules, total
        except Exception as e:
            err_str = str(e)
            if "PGRST205" in err_str or "Could not find the table" in err_str:
                logger.debug("Schedules table not in schema, returning empty list: %s", err_str)
                return [], 0
            logger.error("Error listing schedules: %s", e)
            raise RuntimeError(f"Failed to list schedules: {str(e)}")

    async def update_schedule(
        self,
        schedule_id: UUID,
        updates: ScheduleUpdate,
        updated_by: UUID,
    ) -> ScheduleResponse:
        """Update an existing schedule."""
        try:
            existing = self.db.table("schedules").select("*").eq("id", str(schedule_id)).execute()
            if not existing.data:
                raise ValueError(f"Schedule {schedule_id} not found")
            update_data = {"updated_at": datetime.utcnow().isoformat()}
            if updates.name is not None:
                update_data["name"] = updates.name
            if updates.description is not None:
                update_data["description"] = updates.description
            if updates.start_date is not None:
                update_data["start_date"] = updates.start_date.isoformat()
            if updates.end_date is not None:
                update_data["end_date"] = updates.end_date.isoformat()
            if updates.status is not None:
                update_data["status"] = updates.status
            result = self.db.table("schedules").update(update_data).eq("id", str(schedule_id)).execute()
            if not result.data:
                raise RuntimeError("Failed to update schedule")
            s = result.data[0]
            return ScheduleResponse(
                id=s["id"],
                project_id=s["project_id"],
                name=s["name"],
                description=s.get("description"),
                start_date=date.fromisoformat(s["start_date"]),
                end_date=date.fromisoformat(s["end_date"]),
                baseline_start_date=date.fromisoformat(s["baseline_start_date"]) if s.get("baseline_start_date") else None,
                baseline_end_date=date.fromisoformat(s["baseline_end_date"]) if s.get("baseline_end_date") else None,
                status=s["status"],
                schedule_performance_index=s.get("schedule_performance_index"),
                schedule_variance_days=s.get("schedule_variance_days"),
                created_by=s["created_by"],
                created_at=datetime.fromisoformat(s["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(s["updated_at"].replace("Z", "+00:00")),
            )
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error updating schedule: {e}")
            raise RuntimeError(f"Failed to update schedule: {str(e)}")
    
    async def create_task(
        self,
        schedule_id: UUID,
        task_data: TaskCreate,
        created_by: UUID
    ) -> TaskResponse:
        """
        Create a new task with WBS code generation and hierarchy management.
        
        Args:
            schedule_id: ID of the schedule
            task_data: Task creation data
            created_by: ID of the user creating the task
            
        Returns:
            TaskResponse: Created task data
        """
        try:
            # Validate schedule exists
            schedule_result = self.db.table("schedules").select("id").eq("id", str(schedule_id)).execute()
            if not schedule_result.data:
                raise ValueError(f"Schedule {schedule_id} not found")
            
            # Validate parent task if specified
            if task_data.parent_task_id:
                parent_result = self.db.table("tasks").select("id, wbs_code").eq(
                    "id", str(task_data.parent_task_id)
                ).eq("schedule_id", str(schedule_id)).execute()
                
                if not parent_result.data:
                    raise ValueError(f"Parent task {task_data.parent_task_id} not found in schedule")
            
            # Validate WBS code uniqueness within schedule
            existing_wbs = self.db.table("tasks").select("id").eq(
                "schedule_id", str(schedule_id)
            ).eq("wbs_code", task_data.wbs_code).execute()
            
            if existing_wbs.data:
                raise ValueError(f"WBS code {task_data.wbs_code} already exists in schedule")
            
            # Calculate duration if not provided
            duration_days = task_data.duration_days
            if not duration_days:
                duration_days = (task_data.planned_end_date - task_data.planned_start_date).days + 1
            
            # Prepare task data
            task_record = {
                "id": str(uuid4()),
                "schedule_id": str(schedule_id),
                "parent_task_id": str(task_data.parent_task_id) if task_data.parent_task_id else None,
                "wbs_code": task_data.wbs_code,
                "name": task_data.name,
                "description": task_data.description,
                "planned_start_date": task_data.planned_start_date.isoformat(),
                "planned_end_date": task_data.planned_end_date.isoformat(),
                "duration_days": duration_days,
                "progress_percentage": 0,
                "status": TaskStatus.NOT_STARTED.value,
                "planned_effort_hours": task_data.planned_effort_hours,
                "actual_effort_hours": None,
                "remaining_effort_hours": task_data.planned_effort_hours,
                "is_critical": False,
                "total_float_days": 0,
                "free_float_days": 0,
                "deliverables": json.dumps(task_data.deliverables),
                "acceptance_criteria": task_data.acceptance_criteria,
                "created_by": str(created_by),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Insert task
            result = self.db.table("tasks").insert(task_record).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create task")
            
            created_task = result.data[0]
            
            # Convert to response model
            return self._convert_task_to_response(created_task)
            
        except Exception as e:
            logger.error(f"Error creating task: {e}")
            raise RuntimeError(f"Failed to create task: {str(e)}")
    
    async def update_task(
        self,
        task_id: UUID,
        updates: TaskUpdate,
        updated_by: UUID
    ) -> TaskResponse:
        """
        Update an existing task with validation.
        
        Args:
            task_id: ID of the task to update
            updates: Task update data
            updated_by: ID of the user updating the task
            
        Returns:
            TaskResponse: Updated task data
        """
        try:
            # Get existing task
            existing_result = self.db.table("tasks").select("*").eq("id", str(task_id)).execute()
            if not existing_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            existing_task = existing_result.data[0]
            
            # Prepare update data
            update_data = {
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update fields if provided
            if updates.name is not None:
                update_data["name"] = updates.name
            
            if updates.description is not None:
                update_data["description"] = updates.description
            
            if updates.planned_start_date is not None:
                update_data["planned_start_date"] = updates.planned_start_date.isoformat()
            
            if updates.planned_end_date is not None:
                update_data["planned_end_date"] = updates.planned_end_date.isoformat()
            
            if updates.duration_days is not None:
                update_data["duration_days"] = updates.duration_days
            
            if updates.progress_percentage is not None:
                update_data["progress_percentage"] = updates.progress_percentage
            
            if updates.status is not None:
                update_data["status"] = updates.status.value
            
            if updates.actual_start_date is not None:
                update_data["actual_start_date"] = updates.actual_start_date.isoformat()
            
            if updates.actual_end_date is not None:
                update_data["actual_end_date"] = updates.actual_end_date.isoformat()
            
            if updates.actual_effort_hours is not None:
                update_data["actual_effort_hours"] = updates.actual_effort_hours
                # Update remaining effort
                planned_effort = existing_task.get("planned_effort_hours", 0) or 0
                update_data["remaining_effort_hours"] = max(0, planned_effort - updates.actual_effort_hours)
            
            # Update task
            result = self.db.table("tasks").update(update_data).eq("id", str(task_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update task")
            
            updated_task = result.data[0]
            
            # If progress was updated, trigger parent rollup calculation
            if updates.progress_percentage is not None and existing_task.get("parent_task_id"):
                await self._update_parent_progress_rollup(UUID(existing_task["parent_task_id"]))
            
            return self._convert_task_to_response(updated_task)
            
        except Exception as e:
            logger.error(f"Error updating task {task_id}: {e}")
            raise RuntimeError(f"Failed to update task: {str(e)}")
    
    async def get_schedule_with_tasks(
        self,
        schedule_id: UUID,
        include_dependencies: bool = True
    ) -> ScheduleWithTasksResponse:
        """
        Get a schedule with all its tasks and related data.
        
        Args:
            schedule_id: ID of the schedule
            include_dependencies: Whether to include task dependencies
            
        Returns:
            ScheduleWithTasksResponse: Schedule with tasks and dependencies
        """
        try:
            # Get schedule
            schedule_result = self.db.table("schedules").select("*").eq("id", str(schedule_id)).execute()
            if not schedule_result.data:
                raise ValueError(f"Schedule {schedule_id} not found")
            
            schedule_data = schedule_result.data[0]
            schedule = ScheduleResponse(
                id=schedule_data["id"],
                project_id=schedule_data["project_id"],
                name=schedule_data["name"],
                description=schedule_data["description"],
                start_date=date.fromisoformat(schedule_data["start_date"]),
                end_date=date.fromisoformat(schedule_data["end_date"]),
                baseline_start_date=date.fromisoformat(schedule_data["baseline_start_date"]) if schedule_data.get("baseline_start_date") else None,
                baseline_end_date=date.fromisoformat(schedule_data["baseline_end_date"]) if schedule_data.get("baseline_end_date") else None,
                status=schedule_data["status"],
                schedule_performance_index=schedule_data.get("schedule_performance_index"),
                schedule_variance_days=schedule_data.get("schedule_variance_days"),
                created_by=schedule_data["created_by"],
                created_at=datetime.fromisoformat(schedule_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(schedule_data["updated_at"].replace('Z', '+00:00'))
            )
            
            # Get tasks
            tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).execute()
            tasks = [self._convert_task_to_response(task) for task in (tasks_result.data or [])]
            
            # Get dependencies if requested
            dependencies = []
            if include_dependencies:
                deps_result = self.db.table("task_dependencies").select("*").execute()
                if deps_result.data:
                    # Filter dependencies for tasks in this schedule
                    task_ids = {task.id for task in tasks}
                    dependencies = [
                        dep for dep in deps_result.data
                        if dep["predecessor_task_id"] in task_ids or dep["successor_task_id"] in task_ids
                    ]
            
            # Get milestones
            milestones_result = self.db.table("milestones").select("*").eq("schedule_id", str(schedule_id)).execute()
            milestones = milestones_result.data or []
            
            # Calculate critical path (placeholder - would be implemented in TaskDependencyEngine)
            critical_path = []
            
            return ScheduleWithTasksResponse(
                schedule=schedule,
                tasks=tasks,
                dependencies=dependencies,
                milestones=milestones,
                critical_path=critical_path
            )
            
        except Exception as e:
            logger.error(f"Error getting schedule with tasks {schedule_id}: {e}")
            raise RuntimeError(f"Failed to get schedule with tasks: {str(e)}")
    
    async def update_task_progress(
        self,
        task_id: UUID,
        progress_data: TaskProgressUpdate,
        updated_by: UUID
    ) -> TaskResponse:
        """
        Update task progress with actual dates and rollup calculations.
        
        Args:
            task_id: ID of the task
            progress_data: Progress update data
            updated_by: ID of the user updating progress
            
        Returns:
            TaskResponse: Updated task data
        """
        try:
            # Get existing task
            existing_result = self.db.table("tasks").select("*").eq("id", str(task_id)).execute()
            if not existing_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            existing_task = existing_result.data[0]
            
            # Validate status transition
            current_status = TaskStatus(existing_task["status"])
            new_status = progress_data.status
            
            if not self._is_valid_status_transition(current_status, new_status):
                raise ValueError(f"Invalid status transition from {current_status.value} to {new_status.value}")
            
            # Prepare update data
            update_data = {
                "progress_percentage": progress_data.progress_percentage,
                "status": progress_data.status.value,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if progress_data.actual_start_date:
                update_data["actual_start_date"] = progress_data.actual_start_date.isoformat()
            
            if progress_data.actual_end_date:
                update_data["actual_end_date"] = progress_data.actual_end_date.isoformat()
            
            if progress_data.actual_effort_hours is not None:
                update_data["actual_effort_hours"] = progress_data.actual_effort_hours
                # Update remaining effort
                planned_effort = existing_task.get("planned_effort_hours", 0) or 0
                update_data["remaining_effort_hours"] = max(0, planned_effort - progress_data.actual_effort_hours)
            
            # Update task
            result = self.db.table("tasks").update(update_data).eq("id", str(task_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update task progress")
            
            updated_task = result.data[0]
            
            # Trigger parent progress rollup if task has parent
            if existing_task.get("parent_task_id"):
                await self._update_parent_progress_rollup(UUID(existing_task["parent_task_id"]))
            
            return self._convert_task_to_response(updated_task)
            
        except Exception as e:
            logger.error(f"Error updating task progress {task_id}: {e}")
            raise RuntimeError(f"Failed to update task progress: {str(e)}")
    
    def calculate_task_rollup_progress(
        self,
        parent_task_id: UUID
    ) -> float:
        """
        Calculate parent task progress based on child completion and effort weighting.
        
        Args:
            parent_task_id: ID of the parent task
            
        Returns:
            float: Calculated progress percentage (0-100)
        """
        try:
            # Get child tasks
            children_result = self.db.table("tasks").select(
                "progress_percentage, planned_effort_hours"
            ).eq("parent_task_id", str(parent_task_id)).execute()
            
            if not children_result.data:
                return 0.0
            
            children = children_result.data
            
            # Calculate effort-weighted progress
            total_weighted_progress = 0.0
            total_effort = 0.0
            
            for child in children:
                progress = child.get("progress_percentage", 0)
                effort = child.get("planned_effort_hours", 1) or 1  # Default to 1 to avoid division by zero
                
                total_weighted_progress += progress * effort
                total_effort += effort
            
            if total_effort == 0:
                return 0.0
            
            return round(total_weighted_progress / total_effort, 2)
            
        except Exception as e:
            logger.error(f"Error calculating rollup progress for task {parent_task_id}: {e}")
            return 0.0
    
    async def get_task_hierarchy(
        self,
        schedule_id: UUID,
        max_depth: Optional[int] = None
    ) -> List[TaskHierarchyResponse]:
        """
        Get task hierarchy for a schedule.
        
        Args:
            schedule_id: ID of the schedule
            max_depth: Maximum depth to retrieve (None for unlimited)
            
        Returns:
            List[TaskHierarchyResponse]: Hierarchical task structure
        """
        try:
            # Get all tasks for the schedule
            tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).execute()
            
            if not tasks_result.data:
                return []
            
            tasks = tasks_result.data
            
            # Build hierarchy
            task_map = {task["id"]: task for task in tasks}
            root_tasks = []
            
            def build_hierarchy(task_data: Dict[str, Any], level: int = 0, path: str = "") -> TaskHierarchyResponse:
                task_path = f"{path}/{task_data['wbs_code']}" if path else task_data['wbs_code']
                
                # Get children
                children = []
                if max_depth is None or level < max_depth:
                    child_tasks = [t for t in tasks if t.get("parent_task_id") == task_data["id"]]
                    children = [build_hierarchy(child, level + 1, task_path) for child in child_tasks]
                
                return TaskHierarchyResponse(
                    id=task_data["id"],
                    schedule_id=task_data["schedule_id"],
                    parent_task_id=task_data.get("parent_task_id"),
                    wbs_code=task_data["wbs_code"],
                    name=task_data["name"],
                    planned_start_date=date.fromisoformat(task_data["planned_start_date"]),
                    planned_end_date=date.fromisoformat(task_data["planned_end_date"]),
                    progress_percentage=task_data["progress_percentage"],
                    status=task_data["status"],
                    is_critical=task_data["is_critical"],
                    level=level,
                    path=task_path,
                    children=children
                )
            
            # Find root tasks (no parent)
            for task in tasks:
                if not task.get("parent_task_id"):
                    root_tasks.append(build_hierarchy(task))
            
            return root_tasks
            
        except Exception as e:
            logger.error(f"Error getting task hierarchy for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to get task hierarchy: {str(e)}")
    
    # Private helper methods
    
    def _convert_task_to_response(self, task_data: Dict[str, Any]) -> TaskResponse:
        """Convert database task record to TaskResponse model."""
        return TaskResponse(
            id=task_data["id"],
            schedule_id=task_data["schedule_id"],
            parent_task_id=task_data.get("parent_task_id"),
            wbs_code=task_data["wbs_code"],
            name=task_data["name"],
            description=task_data.get("description"),
            planned_start_date=date.fromisoformat(task_data["planned_start_date"]),
            planned_end_date=date.fromisoformat(task_data["planned_end_date"]),
            actual_start_date=date.fromisoformat(task_data["actual_start_date"]) if task_data.get("actual_start_date") else None,
            actual_end_date=date.fromisoformat(task_data["actual_end_date"]) if task_data.get("actual_end_date") else None,
            duration_days=task_data["duration_days"],
            baseline_start_date=date.fromisoformat(task_data["baseline_start_date"]) if task_data.get("baseline_start_date") else None,
            baseline_end_date=date.fromisoformat(task_data["baseline_end_date"]) if task_data.get("baseline_end_date") else None,
            baseline_duration_days=task_data.get("baseline_duration_days"),
            progress_percentage=task_data["progress_percentage"],
            status=task_data["status"],
            planned_effort_hours=task_data.get("planned_effort_hours"),
            actual_effort_hours=task_data.get("actual_effort_hours"),
            remaining_effort_hours=task_data.get("remaining_effort_hours"),
            is_critical=task_data["is_critical"],
            total_float_days=task_data["total_float_days"],
            free_float_days=task_data["free_float_days"],
            early_start_date=date.fromisoformat(task_data["early_start_date"]) if task_data.get("early_start_date") else None,
            early_finish_date=date.fromisoformat(task_data["early_finish_date"]) if task_data.get("early_finish_date") else None,
            late_start_date=date.fromisoformat(task_data["late_start_date"]) if task_data.get("late_start_date") else None,
            late_finish_date=date.fromisoformat(task_data["late_finish_date"]) if task_data.get("late_finish_date") else None,
            deliverables=json.loads(task_data.get("deliverables", "[]")),
            acceptance_criteria=task_data.get("acceptance_criteria"),
            created_by=task_data["created_by"],
            created_at=datetime.fromisoformat(task_data["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(task_data["updated_at"].replace('Z', '+00:00'))
        )
    
    def _is_valid_status_transition(self, current_status: TaskStatus, new_status: TaskStatus) -> bool:
        """
        Validate if a status transition is allowed.
        
        Args:
            current_status: Current task status
            new_status: Proposed new status
            
        Returns:
            bool: True if transition is valid
        """
        # Define valid transitions
        valid_transitions = {
            TaskStatus.NOT_STARTED: [TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD, TaskStatus.CANCELLED],
            TaskStatus.IN_PROGRESS: [TaskStatus.COMPLETED, TaskStatus.ON_HOLD, TaskStatus.CANCELLED],
            TaskStatus.ON_HOLD: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
            TaskStatus.COMPLETED: [TaskStatus.IN_PROGRESS],  # Allow reopening completed tasks
            TaskStatus.CANCELLED: [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS]  # Allow reactivating cancelled tasks
        }
        
        return new_status in valid_transitions.get(current_status, [])
    
    async def _update_parent_progress_rollup(self, parent_task_id: UUID) -> None:
        """
        Update parent task progress based on child task completion.
        
        Args:
            parent_task_id: ID of the parent task to update
        """
        try:
            # Calculate rollup progress
            rollup_progress = self.calculate_task_rollup_progress(parent_task_id)
            
            # Update parent task progress
            update_data = {
                "progress_percentage": int(rollup_progress),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update status based on progress
            if rollup_progress == 100:
                update_data["status"] = TaskStatus.COMPLETED.value
            elif rollup_progress > 0:
                update_data["status"] = TaskStatus.IN_PROGRESS.value
            
            result = self.db.table("tasks").update(update_data).eq("id", str(parent_task_id)).execute()
            
            if result.data:
                # Check if this parent has its own parent and continue rollup
                parent_data = result.data[0]
                if parent_data.get("parent_task_id"):
                    await self._update_parent_progress_rollup(UUID(parent_data["parent_task_id"]))
            
        except Exception as e:
            logger.error(f"Error updating parent progress rollup for task {parent_task_id}: {e}")
    
    async def get_schedule(self, schedule_id: UUID) -> Optional[ScheduleResponse]:
        """
        Get a single schedule by ID.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            ScheduleResponse or None if not found
        """
        try:
            result = self.db.table("schedules").select("*").eq("id", str(schedule_id)).execute()
            
            if not result.data:
                return None
            
            schedule_data = result.data[0]
            
            return ScheduleResponse(
                id=schedule_data["id"],
                project_id=schedule_data["project_id"],
                name=schedule_data["name"],
                description=schedule_data["description"],
                start_date=date.fromisoformat(schedule_data["start_date"]),
                end_date=date.fromisoformat(schedule_data["end_date"]),
                baseline_start_date=date.fromisoformat(schedule_data["baseline_start_date"]) if schedule_data.get("baseline_start_date") else None,
                baseline_end_date=date.fromisoformat(schedule_data["baseline_end_date"]) if schedule_data.get("baseline_end_date") else None,
                status=schedule_data["status"],
                schedule_performance_index=schedule_data.get("schedule_performance_index"),
                schedule_variance_days=schedule_data.get("schedule_variance_days"),
                created_by=schedule_data["created_by"],
                created_at=datetime.fromisoformat(schedule_data["created_at"].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(schedule_data["updated_at"].replace('Z', '+00:00'))
            )
            
        except Exception as e:
            logger.error(f"Error getting schedule {schedule_id}: {e}")
            return None
    
    async def get_task(self, task_id: UUID) -> Optional[TaskResponse]:
        """
        Get a single task by ID.
        
        Args:
            task_id: ID of the task
            
        Returns:
            TaskResponse or None if not found
        """
        try:
            result = self.db.table("tasks").select("*").eq("id", str(task_id)).execute()
            
            if not result.data:
                return None
            
            return self._convert_task_to_response(result.data[0])
            
        except Exception as e:
            logger.error(f"Error getting task {task_id}: {e}")
            return None
    
    async def delete_schedule(self, schedule_id: UUID) -> bool:
        """
        Delete a schedule and all its tasks.
        
        Args:
            schedule_id: ID of the schedule to delete
            
        Returns:
            bool: True if deleted successfully
        """
        try:
            # Delete schedule (tasks will be deleted by CASCADE)
            result = self.db.table("schedules").delete().eq("id", str(schedule_id)).execute()
            
            return len(result.data) > 0 if result.data else False
            
        except Exception as e:
            logger.error(f"Error deleting schedule {schedule_id}: {e}")
            return False
    
    async def delete_task(self, task_id: UUID) -> bool:
        """
        Delete a task and all its children.
        
        Args:
            task_id: ID of the task to delete
            
        Returns:
            bool: True if deleted successfully
        """
        try:
            # Get task to check for children
            task_result = self.db.table("tasks").select("id, parent_task_id").eq("id", str(task_id)).execute()
            
            if not task_result.data:
                return False
            
            task_data = task_result.data[0]
            
            # Delete task (children will be deleted by CASCADE)
            result = self.db.table("tasks").delete().eq("id", str(task_id)).execute()
            
            # Update parent progress if task had a parent
            if task_data.get("parent_task_id"):
                await self._update_parent_progress_rollup(UUID(task_data["parent_task_id"]))
            
            return len(result.data) > 0 if result.data else False
            
        except Exception as e:
            logger.error(f"Error deleting task {task_id}: {e}")
            return False
    
    # Enhanced Progress Tracking and Rollup Methods
    
    async def update_task_progress_with_validation(
        self,
        task_id: UUID,
        progress_percentage: int,
        status: TaskStatus,
        actual_start_date: Optional[date] = None,
        actual_end_date: Optional[date] = None,
        actual_effort_hours: Optional[float] = None,
        notes: Optional[str] = None,
        updated_by: UUID = None
    ) -> TaskResponse:
        """
        Update task progress with comprehensive validation and automatic rollup.
        
        Args:
            task_id: ID of the task
            progress_percentage: Progress percentage (0-100)
            status: New task status
            actual_start_date: Actual start date
            actual_end_date: Actual end date
            actual_effort_hours: Actual effort spent
            notes: Progress notes
            updated_by: ID of the user updating progress
            
        Returns:
            TaskResponse: Updated task data
        """
        try:
            # Get existing task
            existing_result = self.db.table("tasks").select("*").eq("id", str(task_id)).execute()
            if not existing_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            existing_task = existing_result.data[0]
            
            # Validate progress percentage
            if not 0 <= progress_percentage <= 100:
                raise ValueError("Progress percentage must be between 0 and 100")
            
            # Validate status transition
            current_status = TaskStatus(existing_task["status"])
            if not self._is_valid_status_transition(current_status, status):
                raise ValueError(f"Invalid status transition from {current_status.value} to {status.value}")
            
            # Validate dates
            if actual_start_date and actual_end_date and actual_end_date < actual_start_date:
                raise ValueError("Actual end date cannot be before actual start date")
            
            # Auto-set actual start date if task is starting
            if status == TaskStatus.IN_PROGRESS and not existing_task.get("actual_start_date") and not actual_start_date:
                actual_start_date = date.today()
            
            # Auto-set actual end date if task is completing
            if status == TaskStatus.COMPLETED and progress_percentage == 100 and not actual_end_date:
                actual_end_date = date.today()
            
            # Prepare update data
            update_data = {
                "progress_percentage": progress_percentage,
                "status": status.value,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if actual_start_date:
                update_data["actual_start_date"] = actual_start_date.isoformat()
            
            if actual_end_date:
                update_data["actual_end_date"] = actual_end_date.isoformat()
            
            if actual_effort_hours is not None:
                update_data["actual_effort_hours"] = actual_effort_hours
                # Update remaining effort
                planned_effort = existing_task.get("planned_effort_hours", 0) or 0
                update_data["remaining_effort_hours"] = max(0, planned_effort - actual_effort_hours)
            
            # Update task
            result = self.db.table("tasks").update(update_data).eq("id", str(task_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update task progress")
            
            updated_task = result.data[0]
            
            # Create progress history record
            await self._create_progress_history_record(
                task_id, progress_percentage, status, notes, updated_by
            )
            
            # Trigger parent progress rollup
            if existing_task.get("parent_task_id"):
                await self._update_parent_progress_rollup(UUID(existing_task["parent_task_id"]))
            
            return self._convert_task_to_response(updated_task)
            
        except Exception as e:
            logger.error(f"Error updating task progress with validation {task_id}: {e}")
            raise RuntimeError(f"Failed to update task progress: {str(e)}")
    
    async def calculate_schedule_progress(self, schedule_id: UUID) -> Dict[str, Any]:
        """
        Calculate overall schedule progress and performance metrics.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Dict with schedule progress metrics
        """
        try:
            # Get all tasks for the schedule
            tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).execute()
            
            if not tasks_result.data:
                return {
                    "overall_progress": 0.0,
                    "total_tasks": 0,
                    "completed_tasks": 0,
                    "in_progress_tasks": 0,
                    "not_started_tasks": 0,
                    "on_hold_tasks": 0,
                    "cancelled_tasks": 0,
                    "effort_progress": 0.0,
                    "schedule_health": "unknown"
                }
            
            tasks = tasks_result.data
            total_tasks = len(tasks)
            
            # Count tasks by status
            status_counts = {
                "completed": 0,
                "in_progress": 0,
                "not_started": 0,
                "on_hold": 0,
                "cancelled": 0
            }
            
            total_progress = 0.0
            total_effort = 0.0
            completed_effort = 0.0
            
            for task in tasks:
                status = task["status"]
                progress = task["progress_percentage"]
                planned_effort = task.get("planned_effort_hours", 1) or 1
                
                # Count by status
                if status == TaskStatus.COMPLETED.value:
                    status_counts["completed"] += 1
                elif status == TaskStatus.IN_PROGRESS.value:
                    status_counts["in_progress"] += 1
                elif status == TaskStatus.NOT_STARTED.value:
                    status_counts["not_started"] += 1
                elif status == TaskStatus.ON_HOLD.value:
                    status_counts["on_hold"] += 1
                elif status == TaskStatus.CANCELLED.value:
                    status_counts["cancelled"] += 1
                
                # Calculate weighted progress
                total_progress += progress * planned_effort
                total_effort += planned_effort
                completed_effort += (progress / 100.0) * planned_effort
            
            # Calculate overall progress
            overall_progress = (total_progress / total_effort) if total_effort > 0 else 0.0
            effort_progress = (completed_effort / total_effort * 100) if total_effort > 0 else 0.0
            
            # Determine schedule health
            schedule_health = self._calculate_schedule_health(
                overall_progress, status_counts, total_tasks
            )
            
            return {
                "overall_progress": round(overall_progress, 2),
                "total_tasks": total_tasks,
                "completed_tasks": status_counts["completed"],
                "in_progress_tasks": status_counts["in_progress"],
                "not_started_tasks": status_counts["not_started"],
                "on_hold_tasks": status_counts["on_hold"],
                "cancelled_tasks": status_counts["cancelled"],
                "effort_progress": round(effort_progress, 2),
                "schedule_health": schedule_health
            }
            
        except Exception as e:
            logger.error(f"Error calculating schedule progress {schedule_id}: {e}")
            raise RuntimeError(f"Failed to calculate schedule progress: {str(e)}")
    
    async def get_task_progress_history(
        self,
        task_id: UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get progress history for a task.
        
        Args:
            task_id: ID of the task
            limit: Maximum number of history records to return
            
        Returns:
            List of progress history records
        """
        try:
            # This would typically query a task_progress_history table
            # For now, return empty list as the table doesn't exist yet
            return []
            
        except Exception as e:
            logger.error(f"Error getting task progress history {task_id}: {e}")
            return []
    
    async def bulk_update_task_progress(
        self,
        progress_updates: List[Dict[str, Any]],
        updated_by: UUID
    ) -> Dict[str, Any]:
        """
        Update progress for multiple tasks in a single operation.
        
        Args:
            progress_updates: List of progress update dictionaries
            updated_by: ID of the user updating progress
            
        Returns:
            Dict with update results
        """
        try:
            successful_updates = []
            failed_updates = []
            
            for update in progress_updates:
                try:
                    task_id = UUID(update["task_id"])
                    progress_data = TaskProgressUpdate(
                        progress_percentage=update["progress_percentage"],
                        status=TaskStatus(update["status"]),
                        actual_start_date=date.fromisoformat(update["actual_start_date"]) if update.get("actual_start_date") else None,
                        actual_end_date=date.fromisoformat(update["actual_end_date"]) if update.get("actual_end_date") else None,
                        actual_effort_hours=update.get("actual_effort_hours"),
                        notes=update.get("notes")
                    )
                    
                    updated_task = await self.update_task_progress(task_id, progress_data, updated_by)
                    successful_updates.append({
                        "task_id": str(task_id),
                        "success": True,
                        "updated_task": updated_task
                    })
                    
                except Exception as e:
                    failed_updates.append({
                        "task_id": update.get("task_id", "unknown"),
                        "success": False,
                        "error": str(e)
                    })
            
            return {
                "total_updates": len(progress_updates),
                "successful_updates": len(successful_updates),
                "failed_updates": len(failed_updates),
                "results": successful_updates + failed_updates
            }
            
        except Exception as e:
            logger.error(f"Error in bulk update task progress: {e}")
            raise RuntimeError(f"Failed to bulk update task progress: {str(e)}")
    
    # Private helper methods for enhanced progress tracking
    
    def _calculate_schedule_health(
        self,
        overall_progress: float,
        status_counts: Dict[str, int],
        total_tasks: int
    ) -> str:
        """
        Calculate schedule health based on progress and task status distribution.
        
        Args:
            overall_progress: Overall progress percentage
            status_counts: Count of tasks by status
            total_tasks: Total number of tasks
            
        Returns:
            str: Schedule health status
        """
        try:
            # Calculate percentages
            completed_pct = (status_counts["completed"] / total_tasks * 100) if total_tasks > 0 else 0
            on_hold_pct = (status_counts["on_hold"] / total_tasks * 100) if total_tasks > 0 else 0
            in_progress_pct = (status_counts["in_progress"] / total_tasks * 100) if total_tasks > 0 else 0
            
            # Determine health based on various factors
            if completed_pct >= 90:
                return "excellent"
            elif completed_pct >= 70 and on_hold_pct <= 10:
                return "good"
            elif completed_pct >= 50 and on_hold_pct <= 20:
                return "fair"
            elif on_hold_pct > 30:
                return "at_risk"
            elif completed_pct < 30 and in_progress_pct < 20:
                return "poor"
            else:
                return "fair"
                
        except Exception as e:
            logger.error(f"Error calculating schedule health: {e}")
            return "unknown"
    
    async def _create_progress_history_record(
        self,
        task_id: UUID,
        progress_percentage: int,
        status: TaskStatus,
        notes: Optional[str],
        updated_by: Optional[UUID]
    ) -> None:
        """
        Create a progress history record for audit trail.
        
        Args:
            task_id: ID of the task
            progress_percentage: Progress percentage
            status: Task status
            notes: Progress notes
            updated_by: ID of the user who made the update
        """
        try:
            # This would typically insert into a task_progress_history table
            # For now, just log the progress update
            logger.info(
                f"Progress update for task {task_id}: {progress_percentage}% - {status.value}"
                f"{f' by user {updated_by}' if updated_by else ''}"
                f"{f' - Notes: {notes}' if notes else ''}"
            )
            
        except Exception as e:
            logger.error(f"Error creating progress history record: {e}")
    
    async def recalculate_all_parent_progress(self, schedule_id: UUID) -> Dict[str, Any]:
        """
        Recalculate progress for all parent tasks in a schedule.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Dict with recalculation results
        """
        try:
            # Get all tasks with children
            tasks_result = self.db.table("tasks").select("id, parent_task_id").eq("schedule_id", str(schedule_id)).execute()
            
            if not tasks_result.data:
                return {"updated_tasks": 0, "errors": []}
            
            tasks = tasks_result.data
            
            # Find all parent tasks
            parent_task_ids = set()
            for task in tasks:
                if task.get("parent_task_id"):
                    parent_task_ids.add(UUID(task["parent_task_id"]))
            
            # Update progress for each parent task
            updated_count = 0
            errors = []
            
            for parent_id in parent_task_ids:
                try:
                    await self._update_parent_progress_rollup(parent_id)
                    updated_count += 1
                except Exception as e:
                    errors.append(f"Failed to update parent {parent_id}: {str(e)}")
            
            return {
                "updated_tasks": updated_count,
                "total_parents": len(parent_task_ids),
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error recalculating all parent progress for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to recalculate parent progress: {str(e)}")
    
    async def get_task_children_progress(self, parent_task_id: UUID) -> Dict[str, Any]:
        """
        Get detailed progress information for all children of a parent task.
        
        Args:
            parent_task_id: ID of the parent task
            
        Returns:
            Dict with children progress details
        """
        try:
            # Get child tasks
            children_result = self.db.table("tasks").select("*").eq("parent_task_id", str(parent_task_id)).execute()
            
            if not children_result.data:
                return {
                    "parent_task_id": str(parent_task_id),
                    "children_count": 0,
                    "children": [],
                    "rollup_progress": 0.0
                }
            
            children = children_result.data
            children_progress = []
            
            total_weighted_progress = 0.0
            total_effort = 0.0
            
            for child in children:
                progress = child.get("progress_percentage", 0)
                effort = child.get("planned_effort_hours", 1) or 1
                
                children_progress.append({
                    "task_id": child["id"],
                    "name": child["name"],
                    "wbs_code": child["wbs_code"],
                    "progress_percentage": progress,
                    "status": child["status"],
                    "planned_effort_hours": effort,
                    "contribution_weight": effort
                })
                
                total_weighted_progress += progress * effort
                total_effort += effort
            
            rollup_progress = (total_weighted_progress / total_effort) if total_effort > 0 else 0.0
            
            return {
                "parent_task_id": str(parent_task_id),
                "children_count": len(children),
                "children": children_progress,
                "rollup_progress": round(rollup_progress, 2),
                "total_effort": total_effort
            }
            
        except Exception as e:
            logger.error(f"Error getting task children progress {parent_task_id}: {e}")
            raise RuntimeError(f"Failed to get task children progress: {str(e)}")
    
    # =====================================================
    # BASELINE MANAGEMENT INTEGRATION
    # =====================================================
    
    async def create_schedule_baseline(
        self,
        schedule_id: UUID,
        baseline_name: str,
        description: Optional[str] = None,
        created_by: UUID = None
    ) -> Dict[str, Any]:
        """
        Create a baseline for the schedule using the BaselineManager.
        
        Args:
            schedule_id: ID of the schedule
            baseline_name: Name for the baseline
            description: Optional description
            created_by: ID of the user creating the baseline
            
        Returns:
            Dict with baseline creation result
        """
        try:
            from services.baseline_manager import BaselineManager
            from models.schedule import ScheduleBaselineCreate
            
            baseline_manager = BaselineManager()
            
            baseline_data = ScheduleBaselineCreate(
                baseline_name=baseline_name,
                baseline_date=date.today(),
                description=description,
                baseline_data={"version": "1.0", "created_via": "schedule_manager"}
            )
            
            baseline = await baseline_manager.create_baseline(
                schedule_id, baseline_data, created_by
            )
            
            return {
                "success": True,
                "baseline_id": baseline.id,
                "baseline_name": baseline.baseline_name,
                "baseline_date": baseline.baseline_date.isoformat(),
                "message": "Baseline created successfully"
            }
            
        except Exception as e:
            logger.error(f"Error creating schedule baseline: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to create baseline"
            }
    
    async def get_schedule_variance_analysis(
        self,
        schedule_id: UUID,
        baseline_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get variance analysis for the schedule against its baseline.
        
        Args:
            schedule_id: ID of the schedule
            baseline_id: Optional specific baseline ID
            
        Returns:
            Dict with variance analysis
        """
        try:
            from services.baseline_manager import BaselineManager
            
            baseline_manager = BaselineManager()
            
            variance_analysis = await baseline_manager.calculate_schedule_variance(
                schedule_id, baseline_id
            )
            
            return {
                "success": True,
                "variance_analysis": variance_analysis
            }
            
        except Exception as e:
            logger.error(f"Error getting schedule variance analysis: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to get variance analysis"
            }
    
    async def get_schedule_performance_metrics(
        self,
        schedule_id: UUID,
        baseline_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get earned value and performance metrics for the schedule.
        
        Args:
            schedule_id: ID of the schedule
            baseline_id: Optional specific baseline ID
            
        Returns:
            Dict with performance metrics
        """
        try:
            from services.baseline_manager import BaselineManager
            
            baseline_manager = BaselineManager()
            
            performance_metrics = await baseline_manager.calculate_earned_value_metrics(
                schedule_id, baseline_id
            )
            
            return {
                "success": True,
                "performance_metrics": performance_metrics
            }
            
        except Exception as e:
            logger.error(f"Error getting schedule performance metrics: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to get performance metrics"
            }
    
    async def update_schedule_performance_index(
        self,
        schedule_id: UUID
    ) -> None:
        """
        Update the schedule's performance index based on current progress.
        
        Args:
            schedule_id: ID of the schedule
        """
        try:
            # Get performance metrics
            performance_result = await self.get_schedule_performance_metrics(schedule_id)
            
            if performance_result["success"]:
                metrics = performance_result["performance_metrics"]["summary_metrics"]
                spi = metrics.get("schedule_performance_index", 0)
                
                # Calculate schedule variance in days (simplified)
                variance_result = await self.get_schedule_variance_analysis(schedule_id)
                variance_days = 0
                
                if variance_result["success"]:
                    variance_analysis = variance_result["variance_analysis"]
                    variance_days = variance_analysis["schedule_variance"].get("total_duration_variance_days", 0)
                
                # Update schedule with performance metrics
                update_data = {
                    "schedule_performance_index": spi,
                    "schedule_variance_days": variance_days,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("schedules").update(update_data).eq("id", str(schedule_id)).execute()
                
        except Exception as e:
            logger.error(f"Error updating schedule performance index: {e}")