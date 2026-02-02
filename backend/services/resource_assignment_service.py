"""
Resource Assignment Service

Handles resource assignment operations including:
- Task-to-resource assignment with allocation percentages
- Resource conflict detection algorithms
- Resource leveling suggestions
- Resource utilization calculations
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID, uuid4
from enum import Enum
import logging
import json
from decimal import Decimal

from config.database import supabase
from models.schedule import (
    ResourceAssignmentCreate, ResourceAssignmentResponse,
    ResourceUtilizationReport
)

logger = logging.getLogger(__name__)

class ResourceConflictType(str, Enum):
    """Types of resource conflicts"""
    OVERALLOCATION = "overallocation"
    DOUBLE_BOOKING = "double_booking"
    CAPACITY_EXCEEDED = "capacity_exceeded"
    UNAVAILABLE = "unavailable"

class ResourceAssignmentService:
    """
    Handles all resource assignment operations.
    
    Provides:
    - Task-to-resource assignment with allocation percentages
    - Resource conflict detection algorithms
    - Resource leveling suggestions
    - Resource utilization calculations
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def assign_resource_to_task(
        self,
        task_id: UUID,
        assignment_data: ResourceAssignmentCreate,
        created_by: UUID
    ) -> ResourceAssignmentResponse:
        """
        Assign a resource to a task with allocation percentage.
        
        Args:
            task_id: ID of the task
            assignment_data: Resource assignment data
            created_by: ID of the user creating the assignment
            
        Returns:
            ResourceAssignmentResponse: Created assignment data
        """
        try:
            # Validate task exists
            task_result = self.db.table("tasks").select("id, planned_start_date, planned_end_date").eq("id", str(task_id)).execute()
            if not task_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            task_data = task_result.data[0]
            
            # Validate resource exists
            resource_result = self.db.table("resources").select("id, name, capacity").eq("id", str(assignment_data.resource_id)).execute()
            if not resource_result.data:
                raise ValueError(f"Resource {assignment_data.resource_id} not found")
            
            # Check for existing assignment
            existing_result = self.db.table("task_resource_assignments").select("id").eq(
                "task_id", str(task_id)
            ).eq("resource_id", str(assignment_data.resource_id)).execute()
            
            if existing_result.data:
                raise ValueError(f"Resource {assignment_data.resource_id} is already assigned to task {task_id}")
            
            # Use task dates if assignment dates not provided
            assignment_start = assignment_data.assignment_start_date
            assignment_end = assignment_data.assignment_end_date
            
            if not assignment_start:
                assignment_start = date.fromisoformat(task_data["planned_start_date"])
            if not assignment_end:
                assignment_end = date.fromisoformat(task_data["planned_end_date"])
            
            # Prepare assignment data
            assignment_record = {
                "id": str(uuid4()),
                "task_id": str(task_id),
                "resource_id": str(assignment_data.resource_id),
                "allocation_percentage": assignment_data.allocation_percentage,
                "planned_hours": assignment_data.planned_hours,
                "actual_hours": None,
                "assignment_start_date": assignment_start.isoformat(),
                "assignment_end_date": assignment_end.isoformat(),
                "created_by": str(created_by),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Insert assignment
            result = self.db.table("task_resource_assignments").insert(assignment_record).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create resource assignment")
            
            created_assignment = result.data[0]
            
            # Convert to response model
            return self._convert_assignment_to_response(created_assignment)
            
        except Exception as e:
            logger.error(f"Error assigning resource to task: {e}")
            raise RuntimeError(f"Failed to assign resource to task: {str(e)}")
    
    async def detect_resource_conflicts(
        self,
        schedule_id: UUID,
        resource_id: Optional[UUID] = None,
        date_range_start: Optional[date] = None,
        date_range_end: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect resource conflicts including overallocation and double booking.
        
        Args:
            schedule_id: ID of the schedule to check
            resource_id: Optional specific resource to check
            date_range_start: Optional start date for conflict detection
            date_range_end: Optional end date for conflict detection
            
        Returns:
            List of detected conflicts
        """
        try:
            # Build query for assignments
            query = self.db.table("task_resource_assignments").select("""
                id, task_id, resource_id, allocation_percentage, 
                assignment_start_date, assignment_end_date,
                tasks!inner(id, schedule_id, name, wbs_code),
                resources!inner(id, name, capacity, availability)
            """)
            
            # Filter by schedule through tasks
            if schedule_id:
                query = query.eq("tasks.schedule_id", str(schedule_id))
            
            # Filter by resource if specified
            if resource_id:
                query = query.eq("resource_id", str(resource_id))
            
            # Execute query
            assignments_result = query.execute()
            
            if not assignments_result.data:
                return []
            
            assignments = assignments_result.data
            
            # Filter by date range if specified
            if date_range_start or date_range_end:
                filtered_assignments = []
                for assignment in assignments:
                    assign_start = date.fromisoformat(assignment["assignment_start_date"])
                    assign_end = date.fromisoformat(assignment["assignment_end_date"])
                    
                    # Check if assignment overlaps with date range
                    if date_range_start and assign_end < date_range_start:
                        continue
                    if date_range_end and assign_start > date_range_end:
                        continue
                    
                    filtered_assignments.append(assignment)
                
                assignments = filtered_assignments
            
            # Group assignments by resource and detect conflicts
            conflicts = []
            resource_assignments = {}
            
            for assignment in assignments:
                resource_id = assignment["resource_id"]
                if resource_id not in resource_assignments:
                    resource_assignments[resource_id] = []
                resource_assignments[resource_id].append(assignment)
            
            # Check each resource for conflicts
            for resource_id, resource_assigns in resource_assignments.items():
                resource_conflicts = await self._detect_resource_specific_conflicts(
                    resource_id, resource_assigns
                )
                conflicts.extend(resource_conflicts)
            
            return conflicts
            
        except Exception as e:
            logger.error(f"Error detecting resource conflicts: {e}")
            raise RuntimeError(f"Failed to detect resource conflicts: {str(e)}")
    
    async def suggest_resource_leveling(
        self,
        schedule_id: UUID,
        optimization_criteria: str = "minimize_conflicts"
    ) -> Dict[str, Any]:
        """
        Suggest resource leveling to resolve conflicts.
        
        Args:
            schedule_id: ID of the schedule
            optimization_criteria: Criteria for optimization
            
        Returns:
            Dict with leveling suggestions
        """
        try:
            # First detect all conflicts
            conflicts = await self.detect_resource_conflicts(schedule_id)
            
            if not conflicts:
                return {
                    "conflicts_found": 0,
                    "suggestions": [],
                    "message": "No resource conflicts detected"
                }
            
            # Get all tasks and assignments for the schedule
            tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).execute()
            if not tasks_result.data:
                return {"error": "No tasks found for schedule"}
            
            tasks = tasks_result.data
            
            # Generate leveling suggestions
            suggestions = []
            
            for conflict in conflicts:
                if conflict["type"] == ResourceConflictType.OVERALLOCATION.value:
                    # Suggest reducing allocation or splitting tasks
                    suggestion = await self._generate_overallocation_suggestion(conflict, tasks)
                    if suggestion:
                        suggestions.append(suggestion)
                
                elif conflict["type"] == ResourceConflictType.DOUBLE_BOOKING.value:
                    # Suggest rescheduling one of the conflicting tasks
                    suggestion = await self._generate_rescheduling_suggestion(conflict, tasks)
                    if suggestion:
                        suggestions.append(suggestion)
            
            return {
                "conflicts_found": len(conflicts),
                "suggestions": suggestions,
                "optimization_criteria": optimization_criteria
            }
            
        except Exception as e:
            logger.error(f"Error generating resource leveling suggestions: {e}")
            raise RuntimeError(f"Failed to generate resource leveling suggestions: {str(e)}")
    
    async def calculate_resource_utilization(
        self,
        resource_id: UUID,
        date_range_start: Optional[date] = None,
        date_range_end: Optional[date] = None
    ) -> ResourceUtilizationReport:
        """
        Calculate resource utilization over a time period.
        
        Args:
            resource_id: ID of the resource
            date_range_start: Start date for calculation
            date_range_end: End date for calculation
            
        Returns:
            ResourceUtilizationReport: Utilization metrics
        """
        try:
            # Get resource information
            resource_result = self.db.table("resources").select("*").eq("id", str(resource_id)).execute()
            if not resource_result.data:
                raise ValueError(f"Resource {resource_id} not found")
            
            resource_data = resource_result.data[0]
            
            # Get all assignments for the resource
            query = self.db.table("task_resource_assignments").select("""
                id, task_id, allocation_percentage, planned_hours, actual_hours,
                assignment_start_date, assignment_end_date,
                tasks!inner(id, name, wbs_code, status)
            """).eq("resource_id", str(resource_id))
            
            assignments_result = query.execute()
            assignments = assignments_result.data or []
            
            # Filter by date range if specified
            if date_range_start or date_range_end:
                filtered_assignments = []
                for assignment in assignments:
                    assign_start = date.fromisoformat(assignment["assignment_start_date"])
                    assign_end = date.fromisoformat(assignment["assignment_end_date"])
                    
                    # Check if assignment overlaps with date range
                    if date_range_start and assign_end < date_range_start:
                        continue
                    if date_range_end and assign_start > date_range_end:
                        continue
                    
                    filtered_assignments.append(assignment)
                
                assignments = filtered_assignments
            
            # Calculate utilization metrics
            total_allocation = 0
            total_planned_hours = 0.0
            total_actual_hours = 0.0
            conflicts = []
            
            # Convert assignments to response format
            assignment_responses = []
            for assignment in assignments:
                assignment_responses.append(ResourceAssignmentResponse(
                    id=assignment["id"],
                    task_id=assignment["task_id"],
                    resource_id=str(resource_id),
                    allocation_percentage=assignment["allocation_percentage"],
                    planned_hours=assignment.get("planned_hours"),
                    actual_hours=assignment.get("actual_hours"),
                    assignment_start_date=date.fromisoformat(assignment["assignment_start_date"]),
                    assignment_end_date=date.fromisoformat(assignment["assignment_end_date"]),
                    created_by="", # Would need to join to get this
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                ))
                
                total_allocation += assignment["allocation_percentage"]
                if assignment.get("planned_hours"):
                    total_planned_hours += assignment["planned_hours"]
                if assignment.get("actual_hours"):
                    total_actual_hours += assignment["actual_hours"]
            
            # Calculate utilization percentage
            resource_capacity = resource_data.get("capacity", 40)  # Default 40 hours/week
            resource_availability = resource_data.get("availability", 100)  # Default 100%
            
            available_capacity = resource_capacity * (resource_availability / 100.0)
            
            # Calculate utilization based on planned hours or allocation percentage
            if total_planned_hours > 0:
                utilization_percentage = (total_planned_hours / available_capacity) * 100
            else:
                # Estimate based on allocation percentages (rough calculation)
                utilization_percentage = min(total_allocation, 100)
            
            # Detect conflicts for this resource
            resource_conflicts = await self.detect_resource_conflicts(
                schedule_id=None,  # Check across all schedules
                resource_id=resource_id,
                date_range_start=date_range_start,
                date_range_end=date_range_end
            )
            
            conflict_descriptions = [
                f"{conflict['type']}: {conflict['description']}" 
                for conflict in resource_conflicts
            ]
            
            return ResourceUtilizationReport(
                resource_id=str(resource_id),
                resource_name=resource_data["name"],
                total_allocation=int(total_allocation),
                assignments=assignment_responses,
                utilization_percentage=round(utilization_percentage, 2),
                conflicts=conflict_descriptions
            )
            
        except Exception as e:
            logger.error(f"Error calculating resource utilization: {e}")
            raise RuntimeError(f"Failed to calculate resource utilization: {str(e)}")
    
    async def get_resource_assignments_for_task(
        self,
        task_id: UUID
    ) -> List[ResourceAssignmentResponse]:
        """
        Get all resource assignments for a specific task.
        
        Args:
            task_id: ID of the task
            
        Returns:
            List of resource assignments
        """
        try:
            result = self.db.table("task_resource_assignments").select("*").eq("task_id", str(task_id)).execute()
            
            if not result.data:
                return []
            
            return [self._convert_assignment_to_response(assignment) for assignment in result.data]
            
        except Exception as e:
            logger.error(f"Error getting resource assignments for task {task_id}: {e}")
            raise RuntimeError(f"Failed to get resource assignments: {str(e)}")
    
    async def update_resource_assignment(
        self,
        assignment_id: UUID,
        allocation_percentage: Optional[int] = None,
        planned_hours: Optional[float] = None,
        actual_hours: Optional[float] = None,
        assignment_start_date: Optional[date] = None,
        assignment_end_date: Optional[date] = None,
        updated_by: UUID = None
    ) -> ResourceAssignmentResponse:
        """
        Update an existing resource assignment.
        
        Args:
            assignment_id: ID of the assignment to update
            allocation_percentage: New allocation percentage
            planned_hours: New planned hours
            actual_hours: New actual hours
            assignment_start_date: New start date
            assignment_end_date: New end date
            updated_by: ID of the user updating the assignment
            
        Returns:
            ResourceAssignmentResponse: Updated assignment data
        """
        try:
            # Get existing assignment
            existing_result = self.db.table("task_resource_assignments").select("*").eq("id", str(assignment_id)).execute()
            if not existing_result.data:
                raise ValueError(f"Assignment {assignment_id} not found")
            
            # Prepare update data
            update_data = {
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if allocation_percentage is not None:
                if not 1 <= allocation_percentage <= 100:
                    raise ValueError("Allocation percentage must be between 1 and 100")
                update_data["allocation_percentage"] = allocation_percentage
            
            if planned_hours is not None:
                if planned_hours < 0:
                    raise ValueError("Planned hours cannot be negative")
                update_data["planned_hours"] = planned_hours
            
            if actual_hours is not None:
                if actual_hours < 0:
                    raise ValueError("Actual hours cannot be negative")
                update_data["actual_hours"] = actual_hours
            
            if assignment_start_date is not None:
                update_data["assignment_start_date"] = assignment_start_date.isoformat()
            
            if assignment_end_date is not None:
                update_data["assignment_end_date"] = assignment_end_date.isoformat()
            
            # Validate date range if both dates are being updated
            if assignment_start_date and assignment_end_date and assignment_end_date < assignment_start_date:
                raise ValueError("Assignment end date cannot be before start date")
            
            # Update assignment
            result = self.db.table("task_resource_assignments").update(update_data).eq("id", str(assignment_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update resource assignment")
            
            return self._convert_assignment_to_response(result.data[0])
            
        except Exception as e:
            logger.error(f"Error updating resource assignment {assignment_id}: {e}")
            raise RuntimeError(f"Failed to update resource assignment: {str(e)}")
    
    async def remove_resource_assignment(
        self,
        assignment_id: UUID
    ) -> bool:
        """
        Remove a resource assignment.
        
        Args:
            assignment_id: ID of the assignment to remove
            
        Returns:
            bool: True if removed successfully
        """
        try:
            result = self.db.table("task_resource_assignments").delete().eq("id", str(assignment_id)).execute()
            
            return len(result.data) > 0 if result.data else False
            
        except Exception as e:
            logger.error(f"Error removing resource assignment {assignment_id}: {e}")
            return False
    
    async def get_schedule_resource_summary(
        self,
        schedule_id: UUID
    ) -> Dict[str, Any]:
        """
        Get resource utilization summary for an entire schedule.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Dict with resource summary metrics
        """
        try:
            # Get all assignments for tasks in the schedule
            assignments_result = self.db.table("task_resource_assignments").select("""
                id, resource_id, allocation_percentage, planned_hours, actual_hours,
                assignment_start_date, assignment_end_date,
                tasks!inner(id, schedule_id, name),
                resources!inner(id, name, capacity, availability)
            """).eq("tasks.schedule_id", str(schedule_id)).execute()
            
            if not assignments_result.data:
                return {
                    "schedule_id": str(schedule_id),
                    "total_resources": 0,
                    "total_assignments": 0,
                    "resource_utilization": [],
                    "conflicts": []
                }
            
            assignments = assignments_result.data
            
            # Group by resource
            resource_data = {}
            for assignment in assignments:
                resource_id = assignment["resource_id"]
                if resource_id not in resource_data:
                    resource_data[resource_id] = {
                        "resource_id": resource_id,
                        "resource_name": assignment["resources"]["name"],
                        "capacity": assignment["resources"]["capacity"],
                        "availability": assignment["resources"]["availability"],
                        "assignments": [],
                        "total_allocation": 0,
                        "total_planned_hours": 0.0,
                        "total_actual_hours": 0.0
                    }
                
                resource_info = resource_data[resource_id]
                resource_info["assignments"].append(assignment)
                resource_info["total_allocation"] += assignment["allocation_percentage"]
                
                if assignment.get("planned_hours"):
                    resource_info["total_planned_hours"] += assignment["planned_hours"]
                if assignment.get("actual_hours"):
                    resource_info["total_actual_hours"] += assignment["actual_hours"]
            
            # Calculate utilization for each resource
            resource_utilization = []
            for resource_id, resource_info in resource_data.items():
                capacity = resource_info["capacity"] or 40
                availability = resource_info["availability"] or 100
                available_capacity = capacity * (availability / 100.0)
                
                if resource_info["total_planned_hours"] > 0:
                    utilization_pct = (resource_info["total_planned_hours"] / available_capacity) * 100
                else:
                    utilization_pct = min(resource_info["total_allocation"], 100)
                
                resource_utilization.append({
                    "resource_id": resource_id,
                    "resource_name": resource_info["resource_name"],
                    "total_assignments": len(resource_info["assignments"]),
                    "total_allocation": resource_info["total_allocation"],
                    "total_planned_hours": resource_info["total_planned_hours"],
                    "total_actual_hours": resource_info["total_actual_hours"],
                    "utilization_percentage": round(utilization_pct, 2),
                    "is_overallocated": utilization_pct > 100
                })
            
            # Detect conflicts
            conflicts = await self.detect_resource_conflicts(schedule_id)
            
            return {
                "schedule_id": str(schedule_id),
                "total_resources": len(resource_data),
                "total_assignments": len(assignments),
                "resource_utilization": resource_utilization,
                "conflicts": conflicts
            }
            
        except Exception as e:
            logger.error(f"Error getting schedule resource summary: {e}")
            raise RuntimeError(f"Failed to get schedule resource summary: {str(e)}")

    async def get_schedule_resource_availability(
        self,
        schedule_id: UUID
    ) -> Dict[str, Any]:
        """
        Get resource availability for the schedule: capacity, assigned hours, remaining capacity.
        Requirements: 8.3 - resource availability checking.
        """
        try:
            summary = await self.get_schedule_resource_summary(schedule_id)
            availability_list = []
            for r in summary.get("resource_utilization", []):
                capacity = 40  # default
                # Recompute from assignments if we had raw capacity
                utilization_pct = r.get("utilization_percentage", 0)
                total_planned = r.get("total_planned_hours", 0) or 0
                # Assume capacity from utilization: capacity = planned / (util_pct/100)
                capacity_hours = (total_planned / (utilization_pct / 100)) if utilization_pct > 0 else 40
                remaining_hours = max(0, capacity_hours - total_planned)
                availability_list.append({
                    "resource_id": r["resource_id"],
                    "resource_name": r["resource_name"],
                    "capacity_hours": round(capacity_hours, 2),
                    "assigned_hours": round(total_planned, 2),
                    "remaining_hours": round(remaining_hours, 2),
                    "utilization_percentage": r.get("utilization_percentage", 0),
                    "is_available": r.get("is_overallocated", False) is False,
                })
            return {
                "schedule_id": str(schedule_id),
                "resources": availability_list,
                "conflicts": summary.get("conflicts", []),
            }
        except Exception as e:
            logger.error(f"Error getting schedule resource availability: {e}")
            raise RuntimeError(f"Failed to get schedule resource availability: {str(e)}")

    async def sync_schedule_assignments_to_project(
        self,
        schedule_id: UUID
    ) -> Dict[str, Any]:
        """
        Synchronize task_resource_assignments for this schedule to project_resources
        so the rest of the PPM platform sees which resources are on the project.
        Requirements: 8.3, 8.5 - resource assignment synchronization.
        """
        try:
            # Get schedule -> project_id
            schedule_result = self.db.table("schedules").select("id, project_id").eq("id", str(schedule_id)).execute()
            if not schedule_result.data:
                raise ValueError(f"Schedule {schedule_id} not found")
            project_id = schedule_result.data[0]["project_id"]

            # All task_resource_assignments for tasks in this schedule
            assignments_result = self.db.table("task_resource_assignments").select(
                "resource_id, allocation_percentage, assignment_start_date, assignment_end_date"
            ).eq("tasks.schedule_id", str(schedule_id))
            # Supabase join: we need to query via tasks
            task_ids_result = self.db.table("tasks").select("id").eq("schedule_id", str(schedule_id)).execute()
            if not task_ids_result.data:
                return {"schedule_id": str(schedule_id), "project_id": str(project_id), "synced": 0, "message": "No tasks in schedule"}
            task_ids = [str(t["id"]) for t in task_ids_result.data]

            assignments_result = self.db.table("task_resource_assignments").select(
                "resource_id, allocation_percentage, assignment_start_date, assignment_end_date"
            ).in_("task_id", task_ids).execute()
            assignments = assignments_result.data or []

            # Group by resource_id: min start, max end, max allocation
            by_resource: Dict[str, Dict[str, Any]] = {}
            for a in assignments:
                rid = a["resource_id"]
                if rid not in by_resource:
                    by_resource[rid] = {
                        "resource_id": rid,
                        "allocation_percentage": a["allocation_percentage"],
                        "start_date": a["assignment_start_date"],
                        "end_date": a["assignment_end_date"],
                    }
                else:
                    by_resource[rid]["allocation_percentage"] = max(
                        by_resource[rid]["allocation_percentage"], a["allocation_percentage"]
                    )
                    if a["assignment_start_date"] and (not by_resource[rid]["start_date"] or a["assignment_start_date"] < by_resource[rid]["start_date"]):
                        by_resource[rid]["start_date"] = a["assignment_start_date"]
                    if a["assignment_end_date"] and (not by_resource[rid]["end_date"] or a["assignment_end_date"] > by_resource[rid]["end_date"]):
                        by_resource[rid]["end_date"] = a["assignment_end_date"]

            synced = 0
            for rid, info in by_resource.items():
                existing = self.db.table("project_resources").select("id").eq("project_id", str(project_id)).eq("resource_id", str(rid)).execute()
                row = {
                    "project_id": str(project_id),
                    "resource_id": str(rid),
                    "allocation_percentage": info["allocation_percentage"],
                    "start_date": info["start_date"],
                    "end_date": info["end_date"],
                    "updated_at": datetime.utcnow().isoformat(),
                }
                if existing.data:
                    self.db.table("project_resources").update(row).eq("project_id", str(project_id)).eq("resource_id", str(rid)).execute()
                else:
                    self.db.table("project_resources").insert(row).execute()
                synced += 1

            return {
                "schedule_id": str(schedule_id),
                "project_id": str(project_id),
                "synced": synced,
                "message": f"Synchronized {synced} resource(s) to project",
            }
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error syncing schedule assignments to project: {e}")
            raise RuntimeError(f"Failed to sync schedule assignments to project: {str(e)}")
    
    # Private helper methods
    
    def _convert_assignment_to_response(self, assignment_data: Dict[str, Any]) -> ResourceAssignmentResponse:
        """Convert database assignment record to ResourceAssignmentResponse model."""
        return ResourceAssignmentResponse(
            id=assignment_data["id"],
            task_id=assignment_data["task_id"],
            resource_id=assignment_data["resource_id"],
            allocation_percentage=assignment_data["allocation_percentage"],
            planned_hours=assignment_data.get("planned_hours"),
            actual_hours=assignment_data.get("actual_hours"),
            assignment_start_date=date.fromisoformat(assignment_data["assignment_start_date"]) if assignment_data.get("assignment_start_date") else None,
            assignment_end_date=date.fromisoformat(assignment_data["assignment_end_date"]) if assignment_data.get("assignment_end_date") else None,
            created_by=assignment_data["created_by"],
            created_at=datetime.fromisoformat(assignment_data["created_at"].replace('Z', '+00:00')),
            updated_at=datetime.fromisoformat(assignment_data["updated_at"].replace('Z', '+00:00'))
        )
    
    async def _detect_resource_specific_conflicts(
        self,
        resource_id: str,
        assignments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect conflicts for a specific resource.
        
        Args:
            resource_id: ID of the resource
            assignments: List of assignments for the resource
            
        Returns:
            List of conflicts detected
        """
        conflicts = []
        
        if not assignments:
            return conflicts
        
        # Get resource capacity information
        resource_info = assignments[0]["resources"]  # All assignments have same resource
        resource_capacity = resource_info.get("capacity", 40)
        resource_availability = resource_info.get("availability", 100)
        
        # Check for overallocation
        total_allocation = sum(assignment["allocation_percentage"] for assignment in assignments)
        
        if total_allocation > 100:
            conflicts.append({
                "type": ResourceConflictType.OVERALLOCATION.value,
                "resource_id": resource_id,
                "resource_name": resource_info["name"],
                "total_allocation": total_allocation,
                "excess_allocation": total_allocation - 100,
                "description": f"Resource {resource_info['name']} is overallocated at {total_allocation}%",
                "affected_tasks": [assignment["task_id"] for assignment in assignments],
                "severity": "high" if total_allocation > 150 else "medium"
            })
        
        # Check for date overlaps (double booking)
        for i, assignment1 in enumerate(assignments):
            for assignment2 in assignments[i+1:]:
                start1 = date.fromisoformat(assignment1["assignment_start_date"])
                end1 = date.fromisoformat(assignment1["assignment_end_date"])
                start2 = date.fromisoformat(assignment2["assignment_start_date"])
                end2 = date.fromisoformat(assignment2["assignment_end_date"])
                
                # Check for overlap
                if start1 <= end2 and start2 <= end1:
                    overlap_start = max(start1, start2)
                    overlap_end = min(end1, end2)
                    overlap_days = (overlap_end - overlap_start).days + 1
                    
                    combined_allocation = assignment1["allocation_percentage"] + assignment2["allocation_percentage"]
                    
                    if combined_allocation > 100:
                        conflicts.append({
                            "type": ResourceConflictType.DOUBLE_BOOKING.value,
                            "resource_id": resource_id,
                            "resource_name": resource_info["name"],
                            "task1_id": assignment1["task_id"],
                            "task1_name": assignment1["tasks"]["name"],
                            "task2_id": assignment2["task_id"],
                            "task2_name": assignment2["tasks"]["name"],
                            "overlap_start": overlap_start.isoformat(),
                            "overlap_end": overlap_end.isoformat(),
                            "overlap_days": overlap_days,
                            "combined_allocation": combined_allocation,
                            "description": f"Resource {resource_info['name']} has overlapping assignments with {combined_allocation}% allocation",
                            "severity": "high" if combined_allocation > 150 else "medium"
                        })
        
        return conflicts
    
    async def _generate_overallocation_suggestion(
        self,
        conflict: Dict[str, Any],
        tasks: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate suggestion for resolving overallocation conflict.
        
        Args:
            conflict: Conflict information
            tasks: List of all tasks in the schedule
            
        Returns:
            Suggestion dictionary or None
        """
        try:
            excess_allocation = conflict.get("excess_allocation", 0)
            affected_task_ids = conflict.get("affected_tasks", [])
            
            if not affected_task_ids or excess_allocation <= 0:
                return None
            
            # Find tasks that could have reduced allocation
            reduction_candidates = []
            for task_id in affected_task_ids:
                task = next((t for t in tasks if t["id"] == task_id), None)
                if task:
                    reduction_candidates.append({
                        "task_id": task_id,
                        "task_name": task["name"],
                        "wbs_code": task["wbs_code"],
                        "priority": task.get("priority", "medium")
                    })
            
            # Sort by priority (lower priority tasks are better candidates for reduction)
            priority_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
            reduction_candidates.sort(key=lambda x: priority_order.get(x["priority"], 1))
            
            return {
                "type": "reduce_allocation",
                "conflict_id": conflict.get("resource_id"),
                "description": f"Reduce allocation by {excess_allocation}% across tasks",
                "suggested_actions": [
                    {
                        "action": "reduce_allocation",
                        "task_id": candidate["task_id"],
                        "task_name": candidate["task_name"],
                        "suggested_reduction": min(25, excess_allocation),  # Suggest max 25% reduction per task
                        "reason": f"Lower priority task ({candidate['priority']})"
                    }
                    for candidate in reduction_candidates[:3]  # Limit to top 3 candidates
                ],
                "alternative_actions": [
                    {
                        "action": "split_task",
                        "description": "Consider splitting large tasks into smaller ones"
                    },
                    {
                        "action": "find_additional_resources",
                        "description": "Assign additional resources with similar skills"
                    }
                ]
            }
            
        except Exception as e:
            logger.error(f"Error generating overallocation suggestion: {e}")
            return None
    
    async def _generate_rescheduling_suggestion(
        self,
        conflict: Dict[str, Any],
        tasks: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate suggestion for resolving double booking conflict.
        
        Args:
            conflict: Conflict information
            tasks: List of all tasks in the schedule
            
        Returns:
            Suggestion dictionary or None
        """
        try:
            task1_id = conflict.get("task1_id")
            task2_id = conflict.get("task2_id")
            overlap_days = conflict.get("overlap_days", 0)
            
            if not task1_id or not task2_id:
                return None
            
            # Find the conflicting tasks
            task1 = next((t for t in tasks if t["id"] == task1_id), None)
            task2 = next((t for t in tasks if t["id"] == task2_id), None)
            
            if not task1 or not task2:
                return None
            
            # Determine which task should be rescheduled (prefer lower priority)
            task1_priority = priority_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
            task2_priority = priority_order.get(task2.get("priority", "medium"), 1)
            
            primary_task = task1 if task1_priority >= task2_priority else task2
            reschedule_task = task2 if task1_priority >= task2_priority else task1
            
            return {
                "type": "reschedule_task",
                "conflict_id": f"{task1_id}_{task2_id}",
                "description": f"Reschedule task to avoid {overlap_days} day overlap",
                "suggested_actions": [
                    {
                        "action": "delay_task",
                        "task_id": reschedule_task["id"],
                        "task_name": reschedule_task["name"],
                        "suggested_delay_days": overlap_days + 1,
                        "reason": f"Lower priority than {primary_task['name']}"
                    }
                ],
                "alternative_actions": [
                    {
                        "action": "reduce_overlap_allocation",
                        "description": "Reduce allocation percentage during overlap period"
                    },
                    {
                        "action": "parallel_execution",
                        "description": "Execute tasks in parallel with reduced allocation"
                    }
                ]
            }
            
        except Exception as e:
            logger.error(f"Error generating rescheduling suggestion: {e}")
            return None