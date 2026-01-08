"""
Implementation Tracker Service

Handles implementation task creation, assignment, progress tracking,
milestone management, and actual vs. estimated impact measurement.
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
import logging
from collections import defaultdict
from enum import Enum

from config.database import supabase
from models.change_management import (
    ChangeStatus, PriorityLevel, ImplementationTask, 
    ImplementationStatus, TaskType
)

logger = logging.getLogger(__name__)

class ImplementationTracker:
    """
    Service for tracking change request implementation progress.
    
    Handles:
    - Implementation task creation and assignment
    - Progress tracking with milestone and deliverable management
    - Actual vs. estimated impact measurement
    - Deviation detection and alert system
    - Implementation plan adjustment capabilities
    - Lessons learned capture and knowledge management
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def create_implementation_plan(
        self,
        change_request_id: UUID,
        planned_start_date: date,
        planned_end_date: date,
        assigned_to: UUID,
        tasks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create implementation plan for an approved change request.
        
        Args:
            change_request_id: ID of the approved change request
            planned_start_date: Planned implementation start date
            planned_end_date: Planned implementation completion date
            assigned_to: User ID of implementation manager
            tasks: List of implementation tasks with details
            
        Returns:
            Dict containing implementation plan details
            
        Raises:
            RuntimeError: If database operation fails
            ValueError: If change request is not approved
        """
        try:
            # Verify change request is approved
            change_result = self.db.table("change_requests").select("*").eq(
                "id", str(change_request_id)
            ).execute()
            
            if not change_result.data:
                raise ValueError(f"Change request {change_request_id} not found")
            
            change_request = change_result.data[0]
            if change_request["status"] != ChangeStatus.APPROVED.value:
                raise ValueError(f"Change request must be approved before implementation planning")
            
            # Create implementation plan record
            plan_data = {
                "id": str(uuid4()),
                "change_request_id": str(change_request_id),
                "planned_start_date": planned_start_date.isoformat(),
                "planned_end_date": planned_end_date.isoformat(),
                "actual_start_date": None,
                "actual_end_date": None,
                "assigned_to": str(assigned_to),
                "status": ImplementationStatus.PLANNED.value,
                "progress_percentage": 0,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            plan_result = self.db.table("implementation_plans").insert(plan_data).execute()
            
            if not plan_result.data:
                raise RuntimeError("Failed to create implementation plan")
            
            plan_id = plan_result.data[0]["id"]
            
            # Create implementation tasks
            created_tasks = []
            for i, task in enumerate(tasks):
                task_data = {
                    "id": str(uuid4()),
                    "implementation_plan_id": plan_id,
                    "task_number": i + 1,
                    "title": task["title"],
                    "description": task.get("description", ""),
                    "task_type": task.get("task_type", TaskType.IMPLEMENTATION.value),
                    "assigned_to": task.get("assigned_to", str(assigned_to)),
                    "planned_start_date": task.get("planned_start_date", planned_start_date.isoformat()),
                    "planned_end_date": task.get("planned_end_date", planned_end_date.isoformat()),
                    "actual_start_date": None,
                    "actual_end_date": None,
                    "status": ImplementationStatus.PLANNED.value,
                    "progress_percentage": 0,
                    "estimated_effort_hours": task.get("estimated_effort_hours", 0),
                    "actual_effort_hours": None,
                    "dependencies": task.get("dependencies", []),
                    "deliverables": task.get("deliverables", []),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                task_result = self.db.table("implementation_tasks").insert(task_data).execute()
                
                if task_result.data:
                    created_tasks.append(task_result.data[0])
            
            # Update change request status
            self.db.table("change_requests").update({
                "status": ChangeStatus.IMPLEMENTING.value,
                "implementation_start_date": planned_start_date.isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", str(change_request_id)).execute()
            
            return {
                "implementation_plan": plan_result.data[0],
                "tasks": created_tasks,
                "total_tasks": len(created_tasks),
                "estimated_duration_days": (planned_end_date - planned_start_date).days
            }
            
        except Exception as e:
            logger.error(f"Error creating implementation plan: {e}")
            raise RuntimeError(f"Failed to create implementation plan: {str(e)}")
    
    async def start_implementation(
        self,
        implementation_plan_id: UUID,
        actual_start_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Start implementation execution.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            actual_start_date: Actual start date (defaults to today)
            
        Returns:
            Dict containing updated implementation plan
        """
        try:
            if not actual_start_date:
                actual_start_date = date.today()
            
            # Update implementation plan
            plan_update = {
                "actual_start_date": actual_start_date.isoformat(),
                "status": ImplementationStatus.IN_PROGRESS.value,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            plan_result = self.db.table("implementation_plans").update(plan_update).eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            if not plan_result.data:
                raise RuntimeError("Failed to update implementation plan")
            
            # Start first available tasks (those without dependencies)
            tasks_result = self.db.table("implementation_tasks").select("*").eq(
                "implementation_plan_id", str(implementation_plan_id)
            ).execute()
            
            started_tasks = []
            for task in tasks_result.data or []:
                dependencies = task.get("dependencies", [])
                if not dependencies:  # No dependencies, can start immediately
                    task_update = {
                        "actual_start_date": actual_start_date.isoformat(),
                        "status": ImplementationStatus.IN_PROGRESS.value,
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    updated_task = self.db.table("implementation_tasks").update(task_update).eq(
                        "id", task["id"]
                    ).execute()
                    
                    if updated_task.data:
                        started_tasks.append(updated_task.data[0])
            
            return {
                "implementation_plan": plan_result.data[0],
                "started_tasks": started_tasks,
                "message": f"Implementation started with {len(started_tasks)} initial tasks"
            }
            
        except Exception as e:
            logger.error(f"Error starting implementation: {e}")
            raise RuntimeError(f"Failed to start implementation: {str(e)}")
    
    async def update_task_progress(
        self,
        task_id: UUID,
        progress_percentage: int,
        status: Optional[ImplementationStatus] = None,
        actual_effort_hours: Optional[float] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update progress for an implementation task.
        
        Args:
            task_id: ID of the implementation task
            progress_percentage: Progress percentage (0-100)
            status: Optional status update
            actual_effort_hours: Actual effort spent so far
            notes: Progress notes
            
        Returns:
            Dict containing updated task and plan progress
        """
        try:
            # Validate progress percentage
            if not 0 <= progress_percentage <= 100:
                raise ValueError("Progress percentage must be between 0 and 100")
            
            # Get current task
            task_result = self.db.table("implementation_tasks").select("*").eq(
                "id", str(task_id)
            ).execute()
            
            if not task_result.data:
                raise ValueError(f"Implementation task {task_id} not found")
            
            task = task_result.data[0]
            
            # Prepare update data
            update_data = {
                "progress_percentage": progress_percentage,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if status:
                update_data["status"] = status.value
                
                # Set completion date if task is completed
                if status == ImplementationStatus.COMPLETED:
                    update_data["actual_end_date"] = date.today().isoformat()
                    update_data["progress_percentage"] = 100
            
            if actual_effort_hours is not None:
                update_data["actual_effort_hours"] = actual_effort_hours
            
            # Update task
            updated_task_result = self.db.table("implementation_tasks").update(update_data).eq(
                "id", str(task_id)
            ).execute()
            
            if not updated_task_result.data:
                raise RuntimeError("Failed to update task progress")
            
            updated_task = updated_task_result.data[0]
            
            # Add progress note if provided
            if notes:
                note_data = {
                    "id": str(uuid4()),
                    "implementation_task_id": str(task_id),
                    "note": notes,
                    "progress_percentage": progress_percentage,
                    "created_by": task["assigned_to"],  # Use task assignee for now
                    "created_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("implementation_progress_notes").insert(note_data).execute()
            
            # Update overall plan progress
            plan_progress = await self._calculate_plan_progress(task["implementation_plan_id"])
            
            # Check for task completion and start dependent tasks
            if status == ImplementationStatus.COMPLETED:
                await self._start_dependent_tasks(task_id, task["implementation_plan_id"])
            
            # Check for deviations and generate alerts
            deviations = await self._detect_deviations(task["implementation_plan_id"])
            
            return {
                "updated_task": updated_task,
                "plan_progress": plan_progress,
                "deviations_detected": deviations,
                "message": f"Task progress updated to {progress_percentage}%"
            }
            
        except Exception as e:
            logger.error(f"Error updating task progress: {e}")
            raise RuntimeError(f"Failed to update task progress: {str(e)}")
    
    async def complete_implementation(
        self,
        implementation_plan_id: UUID,
        actual_end_date: Optional[date] = None,
        lessons_learned: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete implementation and capture final metrics.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            actual_end_date: Actual completion date (defaults to today)
            lessons_learned: Lessons learned during implementation
            
        Returns:
            Dict containing completion summary and impact analysis
        """
        try:
            if not actual_end_date:
                actual_end_date = date.today()
            
            # Get implementation plan
            plan_result = self.db.table("implementation_plans").select("*").eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            if not plan_result.data:
                raise ValueError(f"Implementation plan {implementation_plan_id} not found")
            
            plan = plan_result.data[0]
            
            # Verify all tasks are completed
            tasks_result = self.db.table("implementation_tasks").select("*").eq(
                "implementation_plan_id", str(implementation_plan_id)
            ).execute()
            
            incomplete_tasks = [
                t for t in tasks_result.data or [] 
                if t["status"] != ImplementationStatus.COMPLETED.value
            ]
            
            if incomplete_tasks:
                raise ValueError(f"Cannot complete implementation: {len(incomplete_tasks)} tasks still incomplete")
            
            # Calculate actual vs. estimated metrics
            impact_analysis = await self._calculate_actual_vs_estimated_impact(implementation_plan_id)
            
            # Update implementation plan
            plan_update = {
                "actual_end_date": actual_end_date.isoformat(),
                "status": ImplementationStatus.COMPLETED.value,
                "progress_percentage": 100,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            updated_plan_result = self.db.table("implementation_plans").update(plan_update).eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            # Update change request status
            change_request_id = plan["change_request_id"]
            change_update = {
                "status": ChangeStatus.IMPLEMENTED.value,
                "implementation_end_date": actual_end_date.isoformat(),
                "actual_cost_impact": impact_analysis["actual_cost_impact"],
                "actual_schedule_impact_days": impact_analysis["actual_schedule_impact_days"],
                "actual_effort_hours": impact_analysis["actual_effort_hours"],
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("change_requests").update(change_update).eq(
                "id", change_request_id
            ).execute()
            
            # Capture lessons learned
            if lessons_learned:
                lessons_data = {
                    "id": str(uuid4()),
                    "implementation_plan_id": str(implementation_plan_id),
                    "change_request_id": change_request_id,
                    "lessons_learned": lessons_learned,
                    "created_by": plan["assigned_to"],
                    "created_at": datetime.utcnow().isoformat()
                }
                
                self.db.table("implementation_lessons_learned").insert(lessons_data).execute()
            
            return {
                "implementation_plan": updated_plan_result.data[0] if updated_plan_result.data else None,
                "impact_analysis": impact_analysis,
                "completion_summary": {
                    "planned_duration_days": (
                        datetime.fromisoformat(plan["planned_end_date"]) - 
                        datetime.fromisoformat(plan["planned_start_date"])
                    ).days,
                    "actual_duration_days": (
                        actual_end_date - 
                        datetime.fromisoformat(plan["actual_start_date"]).date()
                    ).days,
                    "total_tasks_completed": len(tasks_result.data or []),
                    "lessons_learned_captured": bool(lessons_learned)
                },
                "message": "Implementation completed successfully"
            }
            
        except Exception as e:
            logger.error(f"Error completing implementation: {e}")
            raise RuntimeError(f"Failed to complete implementation: {str(e)}")
    
    async def get_implementation_status(
        self,
        implementation_plan_id: UUID
    ) -> Dict[str, Any]:
        """
        Get comprehensive implementation status and progress.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            
        Returns:
            Dict containing detailed implementation status
        """
        try:
            # Get implementation plan
            plan_result = self.db.table("implementation_plans").select("*").eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            if not plan_result.data:
                raise ValueError(f"Implementation plan {implementation_plan_id} not found")
            
            plan = plan_result.data[0]
            
            # Get all tasks
            tasks_result = self.db.table("implementation_tasks").select("*").eq(
                "implementation_plan_id", str(implementation_plan_id)
            ).order("task_number").execute()
            
            tasks = tasks_result.data or []
            
            # Calculate progress metrics
            total_tasks = len(tasks)
            completed_tasks = len([t for t in tasks if t["status"] == ImplementationStatus.COMPLETED.value])
            in_progress_tasks = len([t for t in tasks if t["status"] == ImplementationStatus.IN_PROGRESS.value])
            
            overall_progress = sum(t["progress_percentage"] for t in tasks) / total_tasks if total_tasks > 0 else 0
            
            # Calculate schedule metrics
            planned_start = datetime.fromisoformat(plan["planned_start_date"]).date()
            planned_end = datetime.fromisoformat(plan["planned_end_date"]).date()
            actual_start = datetime.fromisoformat(plan["actual_start_date"]).date() if plan["actual_start_date"] else None
            
            schedule_status = self._calculate_schedule_status(planned_start, planned_end, actual_start, overall_progress)
            
            # Get recent progress notes
            notes_result = self.db.table("implementation_progress_notes").select("*").in_(
                "implementation_task_id", [t["id"] for t in tasks]
            ).order("created_at", desc=True).limit(10).execute()
            
            # Detect current deviations
            deviations = await self._detect_deviations(implementation_plan_id)
            
            # Get milestones
            milestones = self._extract_milestones(tasks)
            
            return {
                "implementation_plan": plan,
                "progress_summary": {
                    "overall_progress_percentage": round(overall_progress, 1),
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "in_progress_tasks": in_progress_tasks,
                    "pending_tasks": total_tasks - completed_tasks - in_progress_tasks
                },
                "schedule_status": schedule_status,
                "tasks": tasks,
                "milestones": milestones,
                "recent_progress_notes": notes_result.data or [],
                "deviations": deviations,
                "status_updated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting implementation status: {e}")
            raise RuntimeError(f"Failed to get implementation status: {str(e)}")
    
    async def create_milestone(
        self,
        implementation_plan_id: UUID,
        title: str,
        description: str,
        target_date: date,
        milestone_type: str = "deliverable",
        dependencies: Optional[List[UUID]] = None
    ) -> Dict[str, Any]:
        """
        Create implementation milestone.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            title: Milestone title
            description: Milestone description
            target_date: Target completion date
            milestone_type: Type of milestone (deliverable, review, approval)
            dependencies: List of task IDs this milestone depends on
            
        Returns:
            Dict containing created milestone
        """
        try:
            milestone_data = {
                "id": str(uuid4()),
                "implementation_plan_id": str(implementation_plan_id),
                "title": title,
                "description": description,
                "milestone_type": milestone_type,
                "target_date": target_date.isoformat(),
                "actual_date": None,
                "status": ImplementationStatus.PLANNED.value,
                "dependencies": dependencies or [],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            milestone_result = self.db.table("implementation_milestones").insert(milestone_data).execute()
            
            if not milestone_result.data:
                raise RuntimeError("Failed to create milestone")
            
            return {
                "milestone": milestone_result.data[0],
                "message": f"Milestone '{title}' created successfully"
            }
            
        except Exception as e:
            logger.error(f"Error creating milestone: {e}")
            raise RuntimeError(f"Failed to create milestone: {str(e)}")
    
    # Private helper methods
    
    async def _calculate_plan_progress(self, implementation_plan_id: str) -> Dict[str, Any]:
        """Calculate overall implementation plan progress."""
        tasks_result = self.db.table("implementation_tasks").select("*").eq(
            "implementation_plan_id", implementation_plan_id
        ).execute()
        
        tasks = tasks_result.data or []
        
        if not tasks:
            return {"overall_progress": 0, "task_count": 0}
        
        total_progress = sum(task["progress_percentage"] for task in tasks)
        overall_progress = total_progress / len(tasks)
        
        # Update implementation plan progress
        self.db.table("implementation_plans").update({
            "progress_percentage": round(overall_progress, 1),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", implementation_plan_id).execute()
        
        return {
            "overall_progress": round(overall_progress, 1),
            "task_count": len(tasks),
            "completed_tasks": len([t for t in tasks if t["progress_percentage"] == 100])
        }
    
    async def _start_dependent_tasks(self, completed_task_id: str, implementation_plan_id: str):
        """Start tasks that depend on the completed task."""
        # Get all tasks in the plan
        tasks_result = self.db.table("implementation_tasks").select("*").eq(
            "implementation_plan_id", implementation_plan_id
        ).execute()
        
        tasks = tasks_result.data or []
        
        # Find tasks that depend on the completed task
        for task in tasks:
            dependencies = task.get("dependencies", [])
            if completed_task_id in dependencies:
                # Check if all dependencies are completed
                all_dependencies_completed = True
                for dep_id in dependencies:
                    dep_task = next((t for t in tasks if t["id"] == dep_id), None)
                    if not dep_task or dep_task["status"] != ImplementationStatus.COMPLETED.value:
                        all_dependencies_completed = False
                        break
                
                # Start task if all dependencies are completed and task is not already started
                if all_dependencies_completed and task["status"] == ImplementationStatus.PLANNED.value:
                    self.db.table("implementation_tasks").update({
                        "status": ImplementationStatus.IN_PROGRESS.value,
                        "actual_start_date": date.today().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", task["id"]).execute()
    
    async def _detect_deviations(self, implementation_plan_id: str) -> List[Dict[str, Any]]:
        """Detect deviations from planned implementation."""
        deviations = []
        
        # Get implementation plan and tasks
        plan_result = self.db.table("implementation_plans").select("*").eq(
            "id", implementation_plan_id
        ).execute()
        
        if not plan_result.data:
            return deviations
        
        plan = plan_result.data[0]
        
        tasks_result = self.db.table("implementation_tasks").select("*").eq(
            "implementation_plan_id", implementation_plan_id
        ).execute()
        
        tasks = tasks_result.data or []
        
        # Check schedule deviations
        today = date.today()
        planned_end = datetime.fromisoformat(plan["planned_end_date"]).date()
        
        if plan["status"] == ImplementationStatus.IN_PROGRESS.value and today > planned_end:
            deviations.append({
                "type": "schedule_overrun",
                "severity": "high",
                "description": f"Implementation is {(today - planned_end).days} days overdue",
                "days_overdue": (today - planned_end).days
            })
        
        # Check task-level deviations
        for task in tasks:
            if task["status"] == ImplementationStatus.IN_PROGRESS.value:
                planned_end = datetime.fromisoformat(task["planned_end_date"]).date()
                if today > planned_end:
                    deviations.append({
                        "type": "task_overdue",
                        "severity": "medium",
                        "description": f"Task '{task['title']}' is {(today - planned_end).days} days overdue",
                        "task_id": task["id"],
                        "task_title": task["title"],
                        "days_overdue": (today - planned_end).days
                    })
        
        # Check effort deviations
        for task in tasks:
            estimated_effort = task.get("estimated_effort_hours", 0)
            actual_effort = task.get("actual_effort_hours", 0)
            
            if estimated_effort > 0 and actual_effort > estimated_effort * 1.2:  # 20% over estimate
                deviations.append({
                    "type": "effort_overrun",
                    "severity": "medium",
                    "description": f"Task '{task['title']}' effort is {((actual_effort / estimated_effort - 1) * 100):.1f}% over estimate",
                    "task_id": task["id"],
                    "task_title": task["title"],
                    "effort_variance_percentage": ((actual_effort / estimated_effort - 1) * 100)
                })
        
        return deviations
    
    async def _calculate_actual_vs_estimated_impact(self, implementation_plan_id: str) -> Dict[str, Any]:
        """Calculate actual vs. estimated impact metrics."""
        # Get implementation plan
        plan_result = self.db.table("implementation_plans").select("*").eq(
            "id", implementation_plan_id
        ).execute()
        
        if not plan_result.data:
            return {}
        
        plan = plan_result.data[0]
        
        # Get change request to compare with estimates
        change_result = self.db.table("change_requests").select("*").eq(
            "id", plan["change_request_id"]
        ).execute()
        
        if not change_result.data:
            return {}
        
        change_request = change_result.data[0]
        
        # Get all tasks to calculate actual effort
        tasks_result = self.db.table("implementation_tasks").select("*").eq(
            "implementation_plan_id", implementation_plan_id
        ).execute()
        
        tasks = tasks_result.data or []
        
        # Calculate actual metrics
        actual_effort_hours = sum(task.get("actual_effort_hours", 0) for task in tasks)
        
        actual_start = datetime.fromisoformat(plan["actual_start_date"]).date() if plan["actual_start_date"] else None
        actual_end = datetime.fromisoformat(plan["actual_end_date"]).date() if plan["actual_end_date"] else None
        actual_schedule_impact_days = (actual_end - actual_start).days if actual_start and actual_end else 0
        
        # For cost impact, we'll use a simple calculation based on effort
        # In a real system, this would include materials, resources, etc.
        estimated_cost_per_hour = 100  # Default rate
        actual_cost_impact = actual_effort_hours * estimated_cost_per_hour
        
        # Compare with estimates
        estimated_cost_impact = float(change_request.get("estimated_cost_impact", 0))
        estimated_schedule_impact_days = change_request.get("estimated_schedule_impact_days", 0)
        estimated_effort_hours = float(change_request.get("estimated_effort_hours", 0))
        
        return {
            "actual_cost_impact": actual_cost_impact,
            "actual_schedule_impact_days": actual_schedule_impact_days,
            "actual_effort_hours": actual_effort_hours,
            "estimated_cost_impact": estimated_cost_impact,
            "estimated_schedule_impact_days": estimated_schedule_impact_days,
            "estimated_effort_hours": estimated_effort_hours,
            "cost_variance_percentage": ((actual_cost_impact - estimated_cost_impact) / estimated_cost_impact * 100) if estimated_cost_impact > 0 else 0,
            "schedule_variance_percentage": ((actual_schedule_impact_days - estimated_schedule_impact_days) / estimated_schedule_impact_days * 100) if estimated_schedule_impact_days > 0 else 0,
            "effort_variance_percentage": ((actual_effort_hours - estimated_effort_hours) / estimated_effort_hours * 100) if estimated_effort_hours > 0 else 0
        }
    
    def _calculate_schedule_status(
        self,
        planned_start: date,
        planned_end: date,
        actual_start: Optional[date],
        progress_percentage: float
    ) -> Dict[str, Any]:
        """Calculate schedule status and projections."""
        today = date.today()
        
        if not actual_start:
            return {
                "status": "not_started",
                "days_until_start": (planned_start - today).days if planned_start > today else 0,
                "on_schedule": planned_start >= today
            }
        
        # Calculate expected progress based on time elapsed
        total_planned_days = (planned_end - planned_start).days
        elapsed_days = (today - actual_start).days
        expected_progress = (elapsed_days / total_planned_days * 100) if total_planned_days > 0 else 0
        
        # Determine schedule status
        progress_variance = progress_percentage - expected_progress
        
        if progress_variance >= -5:  # Within 5% tolerance
            schedule_status = "on_track"
        elif progress_variance >= -15:  # 5-15% behind
            schedule_status = "at_risk"
        else:  # More than 15% behind
            schedule_status = "behind_schedule"
        
        # Project completion date
        if progress_percentage > 0:
            projected_total_days = elapsed_days * (100 / progress_percentage)
            projected_end_date = actual_start + timedelta(days=int(projected_total_days))
        else:
            projected_end_date = planned_end
        
        return {
            "status": schedule_status,
            "progress_percentage": progress_percentage,
            "expected_progress": expected_progress,
            "progress_variance": progress_variance,
            "projected_end_date": projected_end_date.isoformat(),
            "days_variance": (projected_end_date - planned_end).days,
            "on_schedule": projected_end_date <= planned_end
        }
    
    def _extract_milestones(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract milestone information from tasks."""
        milestones = []
        
        # Get explicit milestones
        milestone_result = self.db.table("implementation_milestones").select("*").in_(
            "implementation_plan_id", [task["implementation_plan_id"] for task in tasks]
        ).execute()
        
        explicit_milestones = milestone_result.data or []
        
        # Add explicit milestones
        for milestone in explicit_milestones:
            milestones.append({
                "id": milestone["id"],
                "title": milestone["title"],
                "type": "explicit",
                "target_date": milestone["target_date"],
                "actual_date": milestone.get("actual_date"),
                "status": milestone["status"],
                "milestone_type": milestone["milestone_type"]
            })
        
        # Add task-based milestones (completed tasks)
        for task in tasks:
            if task["status"] == ImplementationStatus.COMPLETED.value:
                milestones.append({
                    "id": task["id"],
                    "title": f"Task Completed: {task['title']}",
                    "type": "task_completion",
                    "target_date": task["planned_end_date"],
                    "actual_date": task["actual_end_date"],
                    "status": ImplementationStatus.COMPLETED.value,
                    "milestone_type": "task"
                })
        
        # Sort by target date
        milestones.sort(key=lambda x: x["target_date"])
        
        return milestones
    
    # Implementation Monitoring and Alerts (Task 8.2)
    
    async def generate_implementation_alerts(
        self,
        implementation_plan_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate alerts for implementation issues and deviations.
        
        Args:
            implementation_plan_id: Optional filter by specific implementation plan
            project_id: Optional filter by project
            
        Returns:
            List of alerts with severity and recommended actions
        """
        try:
            alerts = []
            
            # Get implementation plans to monitor
            if implementation_plan_id:
                plans_query = self.db.table("implementation_plans").select("*").eq(
                    "id", str(implementation_plan_id)
                )
            elif project_id:
                # Get change requests for the project first
                changes_result = self.db.table("change_requests").select("id").eq(
                    "project_id", str(project_id)
                ).execute()
                
                change_ids = [c["id"] for c in changes_result.data or []]
                
                if not change_ids:
                    return alerts
                
                plans_query = self.db.table("implementation_plans").select("*").in_(
                    "change_request_id", change_ids
                )
            else:
                # Monitor all active implementation plans
                plans_query = self.db.table("implementation_plans").select("*").not_.in_(
                    "status", [ImplementationStatus.COMPLETED.value, ImplementationStatus.CANCELLED.value]
                )
            
            plans_result = plans_query.execute()
            plans = plans_result.data or []
            
            for plan in plans:
                plan_alerts = await self._generate_plan_alerts(plan)
                alerts.extend(plan_alerts)
            
            # Sort alerts by severity and date
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            alerts.sort(key=lambda x: (severity_order.get(x["severity"], 4), x.get("detected_at", "")))
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error generating implementation alerts: {e}")
            raise RuntimeError(f"Failed to generate implementation alerts: {str(e)}")
    
    async def create_deviation_record(
        self,
        implementation_plan_id: UUID,
        deviation_type: str,
        severity: str,
        description: str,
        root_cause: Optional[str] = None,
        corrective_action: Optional[str] = None,
        created_by: UUID = None
    ) -> Dict[str, Any]:
        """
        Create a formal deviation record for tracking and resolution.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            deviation_type: Type of deviation (schedule, cost, scope, quality)
            severity: Severity level (low, medium, high, critical)
            description: Description of the deviation
            root_cause: Optional root cause analysis
            corrective_action: Optional corrective action plan
            created_by: User who identified the deviation
            
        Returns:
            Dict containing created deviation record
        """
        try:
            deviation_data = {
                "id": str(uuid4()),
                "implementation_plan_id": str(implementation_plan_id),
                "deviation_type": deviation_type,
                "severity": severity,
                "description": description,
                "root_cause": root_cause,
                "corrective_action": corrective_action,
                "impact_assessment": None,
                "detected_date": date.today().isoformat(),
                "resolved_date": None,
                "status": "open",
                "created_by": str(created_by) if created_by else None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            deviation_result = self.db.table("implementation_deviations").insert(deviation_data).execute()
            
            if not deviation_result.data:
                raise RuntimeError("Failed to create deviation record")
            
            # Generate alert for critical and high severity deviations
            if severity in ["critical", "high"]:
                await self._send_deviation_alert(deviation_result.data[0])
            
            return {
                "deviation": deviation_result.data[0],
                "message": f"Deviation record created with severity: {severity}"
            }
            
        except Exception as e:
            logger.error(f"Error creating deviation record: {e}")
            raise RuntimeError(f"Failed to create deviation record: {str(e)}")
    
    async def update_deviation_status(
        self,
        deviation_id: UUID,
        status: str,
        corrective_action: Optional[str] = None,
        impact_assessment: Optional[str] = None,
        updated_by: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Update deviation status and resolution details.
        
        Args:
            deviation_id: ID of the deviation record
            status: New status (open, in_progress, resolved, closed)
            corrective_action: Updated corrective action plan
            impact_assessment: Impact assessment details
            updated_by: User making the update
            
        Returns:
            Dict containing updated deviation record
        """
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if corrective_action:
                update_data["corrective_action"] = corrective_action
            
            if impact_assessment:
                update_data["impact_assessment"] = impact_assessment
            
            if status == "resolved":
                update_data["resolved_date"] = date.today().isoformat()
            
            deviation_result = self.db.table("implementation_deviations").update(update_data).eq(
                "id", str(deviation_id)
            ).execute()
            
            if not deviation_result.data:
                raise ValueError(f"Deviation {deviation_id} not found")
            
            return {
                "deviation": deviation_result.data[0],
                "message": f"Deviation status updated to: {status}"
            }
            
        except Exception as e:
            logger.error(f"Error updating deviation status: {e}")
            raise RuntimeError(f"Failed to update deviation status: {str(e)}")
    
    async def adjust_implementation_plan(
        self,
        implementation_plan_id: UUID,
        adjustments: Dict[str, Any],
        reason: str,
        adjusted_by: UUID
    ) -> Dict[str, Any]:
        """
        Adjust implementation plan based on deviations or changing requirements.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            adjustments: Dictionary of adjustments to make
            reason: Reason for the adjustments
            adjusted_by: User making the adjustments
            
        Returns:
            Dict containing updated implementation plan and adjustment record
        """
        try:
            # Get current implementation plan
            plan_result = self.db.table("implementation_plans").select("*").eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            if not plan_result.data:
                raise ValueError(f"Implementation plan {implementation_plan_id} not found")
            
            current_plan = plan_result.data[0]
            
            # Prepare plan updates
            plan_updates = {
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Apply adjustments
            if "planned_end_date" in adjustments:
                plan_updates["planned_end_date"] = adjustments["planned_end_date"]
            
            if "assigned_to" in adjustments:
                plan_updates["assigned_to"] = str(adjustments["assigned_to"])
            
            # Update implementation plan
            updated_plan_result = self.db.table("implementation_plans").update(plan_updates).eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            # Create adjustment record for audit trail
            adjustment_record = {
                "id": str(uuid4()),
                "implementation_plan_id": str(implementation_plan_id),
                "adjustment_type": "plan_modification",
                "reason": reason,
                "original_values": {k: current_plan.get(k) for k in plan_updates.keys() if k != "updated_at"},
                "new_values": {k: v for k, v in plan_updates.items() if k != "updated_at"},
                "adjusted_by": str(adjusted_by),
                "adjusted_at": datetime.utcnow().isoformat()
            }
            
            # Store adjustment record (would need a new table for this)
            # For now, we'll add it to progress notes
            note_data = {
                "id": str(uuid4()),
                "implementation_task_id": None,  # Plan-level adjustment
                "note": f"Plan adjusted: {reason}. Changes: {adjustments}",
                "progress_percentage": current_plan.get("progress_percentage", 0),
                "created_by": str(adjusted_by),
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Apply task-level adjustments if specified
            task_adjustments = []
            if "task_adjustments" in adjustments:
                for task_adjustment in adjustments["task_adjustments"]:
                    task_id = task_adjustment["task_id"]
                    task_updates = task_adjustment["updates"]
                    
                    updated_task_result = self.db.table("implementation_tasks").update({
                        **task_updates,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", task_id).execute()
                    
                    if updated_task_result.data:
                        task_adjustments.append(updated_task_result.data[0])
            
            return {
                "updated_plan": updated_plan_result.data[0] if updated_plan_result.data else None,
                "adjusted_tasks": task_adjustments,
                "adjustment_record": adjustment_record,
                "message": f"Implementation plan adjusted: {reason}"
            }
            
        except Exception as e:
            logger.error(f"Error adjusting implementation plan: {e}")
            raise RuntimeError(f"Failed to adjust implementation plan: {str(e)}")
    
    async def capture_lessons_learned(
        self,
        implementation_plan_id: UUID,
        lessons_learned: str,
        category: Optional[str] = None,
        impact_on_future_changes: Optional[str] = None,
        created_by: UUID = None
    ) -> Dict[str, Any]:
        """
        Capture lessons learned during implementation.
        
        Args:
            implementation_plan_id: ID of the implementation plan
            lessons_learned: Lessons learned description
            category: Category of lessons (process, technical, communication, etc.)
            impact_on_future_changes: How this impacts future change implementations
            created_by: User capturing the lessons learned
            
        Returns:
            Dict containing lessons learned record
        """
        try:
            # Get implementation plan to get change request ID
            plan_result = self.db.table("implementation_plans").select("*").eq(
                "id", str(implementation_plan_id)
            ).execute()
            
            if not plan_result.data:
                raise ValueError(f"Implementation plan {implementation_plan_id} not found")
            
            plan = plan_result.data[0]
            
            lessons_data = {
                "id": str(uuid4()),
                "implementation_plan_id": str(implementation_plan_id),
                "change_request_id": plan["change_request_id"],
                "lessons_learned": lessons_learned,
                "category": category,
                "impact_on_future_changes": impact_on_future_changes,
                "created_by": str(created_by) if created_by else None,
                "created_at": datetime.utcnow().isoformat()
            }
            
            lessons_result = self.db.table("implementation_lessons_learned").insert(lessons_data).execute()
            
            if not lessons_result.data:
                raise RuntimeError("Failed to capture lessons learned")
            
            return {
                "lessons_learned": lessons_result.data[0],
                "message": "Lessons learned captured successfully"
            }
            
        except Exception as e:
            logger.error(f"Error capturing lessons learned: {e}")
            raise RuntimeError(f"Failed to capture lessons learned: {str(e)}")
    
    async def get_implementation_knowledge_base(
        self,
        category: Optional[str] = None,
        project_id: Optional[UUID] = None,
        change_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieve implementation knowledge base from lessons learned.
        
        Args:
            category: Optional filter by category
            project_id: Optional filter by project
            change_type: Optional filter by change type
            
        Returns:
            Dict containing knowledge base entries and insights
        """
        try:
            # Build query for lessons learned
            query = self.db.table("implementation_lessons_learned").select("*")
            
            if category:
                query = query.eq("category", category)
            
            lessons_result = query.order("created_at", desc=True).execute()
            lessons = lessons_result.data or []
            
            # Filter by project or change type if specified
            if project_id or change_type:
                filtered_lessons = []
                
                for lesson in lessons:
                    # Get change request details
                    change_result = self.db.table("change_requests").select("*").eq(
                        "id", lesson["change_request_id"]
                    ).execute()
                    
                    if change_result.data:
                        change = change_result.data[0]
                        
                        # Apply filters
                        if project_id and change.get("project_id") != str(project_id):
                            continue
                        
                        if change_type and change.get("change_type") != change_type:
                            continue
                        
                        # Add change context to lesson
                        lesson["change_context"] = {
                            "change_type": change.get("change_type"),
                            "project_id": change.get("project_id"),
                            "priority": change.get("priority")
                        }
                        
                        filtered_lessons.append(lesson)
                
                lessons = filtered_lessons
            
            # Categorize lessons
            categorized_lessons = defaultdict(list)
            for lesson in lessons:
                lesson_category = lesson.get("category", "general")
                categorized_lessons[lesson_category].append(lesson)
            
            # Generate insights and recommendations
            insights = self._generate_knowledge_insights(lessons)
            
            return {
                "total_lessons": len(lessons),
                "categorized_lessons": dict(categorized_lessons),
                "insights": insights,
                "recommendations": self._generate_implementation_recommendations(lessons),
                "knowledge_base_updated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error retrieving implementation knowledge base: {e}")
            raise RuntimeError(f"Failed to retrieve implementation knowledge base: {str(e)}")
    
    # Private helper methods for monitoring and alerts
    
    async def _generate_plan_alerts(self, plan: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate alerts for a specific implementation plan."""
        alerts = []
        today = date.today()
        
        # Get tasks for this plan
        tasks_result = self.db.table("implementation_tasks").select("*").eq(
            "implementation_plan_id", plan["id"]
        ).execute()
        
        tasks = tasks_result.data or []
        
        # Schedule alerts
        if plan["status"] == ImplementationStatus.IN_PROGRESS.value:
            planned_end = datetime.fromisoformat(plan["planned_end_date"]).date()
            days_until_end = (planned_end - today).days
            
            if days_until_end < 0:
                alerts.append({
                    "type": "schedule_overrun",
                    "severity": "critical",
                    "title": "Implementation Overdue",
                    "description": f"Implementation is {abs(days_until_end)} days overdue",
                    "implementation_plan_id": plan["id"],
                    "recommended_action": "Review implementation plan and adjust timeline or resources",
                    "detected_at": datetime.utcnow().isoformat()
                })
            elif days_until_end <= 3:
                alerts.append({
                    "type": "schedule_warning",
                    "severity": "high",
                    "title": "Implementation Due Soon",
                    "description": f"Implementation due in {days_until_end} days",
                    "implementation_plan_id": plan["id"],
                    "recommended_action": "Ensure all tasks are on track for completion",
                    "detected_at": datetime.utcnow().isoformat()
                })
        
        # Progress alerts
        progress = plan.get("progress_percentage", 0)
        if plan["status"] == ImplementationStatus.IN_PROGRESS.value and progress < 10:
            planned_start = datetime.fromisoformat(plan["planned_start_date"]).date()
            days_since_start = (today - planned_start).days
            
            if days_since_start > 7:  # No progress after a week
                alerts.append({
                    "type": "progress_stalled",
                    "severity": "high",
                    "title": "Implementation Progress Stalled",
                    "description": f"No significant progress in {days_since_start} days",
                    "implementation_plan_id": plan["id"],
                    "recommended_action": "Review blockers and resource allocation",
                    "detected_at": datetime.utcnow().isoformat()
                })
        
        # Task-level alerts
        for task in tasks:
            if task["status"] == ImplementationStatus.IN_PROGRESS.value:
                task_planned_end = datetime.fromisoformat(task["planned_end_date"]).date()
                task_days_overdue = (today - task_planned_end).days
                
                if task_days_overdue > 0:
                    alerts.append({
                        "type": "task_overdue",
                        "severity": "medium" if task_days_overdue <= 3 else "high",
                        "title": f"Task Overdue: {task['title']}",
                        "description": f"Task is {task_days_overdue} days overdue",
                        "implementation_plan_id": plan["id"],
                        "task_id": task["id"],
                        "recommended_action": "Review task status and adjust timeline or reassign",
                        "detected_at": datetime.utcnow().isoformat()
                    })
        
        # Resource alerts
        assigned_to = plan.get("assigned_to")
        if assigned_to:
            # Check if assignee has multiple active implementations
            active_plans_result = self.db.table("implementation_plans").select("id").eq(
                "assigned_to", assigned_to
            ).eq("status", ImplementationStatus.IN_PROGRESS.value).execute()
            
            active_count = len(active_plans_result.data or [])
            
            if active_count > 3:  # More than 3 active implementations
                alerts.append({
                    "type": "resource_overload",
                    "severity": "medium",
                    "title": "Resource Overload Warning",
                    "description": f"Assignee has {active_count} active implementations",
                    "implementation_plan_id": plan["id"],
                    "recommended_action": "Consider redistributing workload or adjusting timelines",
                    "detected_at": datetime.utcnow().isoformat()
                })
        
        return alerts
    
    async def _send_deviation_alert(self, deviation: Dict[str, Any]):
        """Send alert for critical deviations (placeholder for notification system)."""
        # This would integrate with the notification system
        logger.warning(f"Critical deviation detected: {deviation['description']}")
        
        # In a real system, this would:
        # 1. Send email notifications to stakeholders
        # 2. Create in-app notifications
        # 3. Escalate to management if needed
        # 4. Update project dashboards
    
    def _generate_knowledge_insights(self, lessons: List[Dict[str, Any]]) -> List[str]:
        """Generate insights from lessons learned."""
        insights = []
        
        if not lessons:
            return insights
        
        # Analyze common themes
        categories = defaultdict(int)
        for lesson in lessons:
            category = lesson.get("category", "general")
            categories[category] += 1
        
        # Most common category
        if categories:
            most_common = max(categories.items(), key=lambda x: x[1])
            insights.append(f"Most common lesson category: {most_common[0]} ({most_common[1]} occurrences)")
        
        # Recent trends
        recent_lessons = [l for l in lessons if 
            datetime.fromisoformat(l["created_at"]) > datetime.utcnow() - timedelta(days=90)
        ]
        
        if len(recent_lessons) > len(lessons) * 0.3:  # More than 30% are recent
            insights.append("High volume of recent lessons learned indicates active learning and improvement")
        
        # Impact analysis
        future_impact_lessons = [l for l in lessons if l.get("impact_on_future_changes")]
        if future_impact_lessons:
            insights.append(f"{len(future_impact_lessons)} lessons have identified impacts on future changes")
        
        return insights
    
    def _generate_implementation_recommendations(self, lessons: List[Dict[str, Any]]) -> List[str]:
        """Generate recommendations based on lessons learned."""
        recommendations = []
        
        # Analyze lesson content for common themes (simplified)
        lesson_text = " ".join([l["lessons_learned"].lower() for l in lessons])
        
        if "communication" in lesson_text:
            recommendations.append("Improve communication protocols and stakeholder engagement")
        
        if "testing" in lesson_text or "quality" in lesson_text:
            recommendations.append("Enhance testing procedures and quality assurance processes")
        
        if "timeline" in lesson_text or "schedule" in lesson_text:
            recommendations.append("Improve timeline estimation and schedule management")
        
        if "resource" in lesson_text:
            recommendations.append("Better resource planning and allocation strategies needed")
        
        # Default recommendations
        recommendations.extend([
            "Conduct regular implementation reviews and checkpoints",
            "Maintain comprehensive documentation throughout implementation",
            "Establish clear escalation procedures for issues and deviations"
        ])
        
        return recommendations[:5]  # Return top 5 recommendations