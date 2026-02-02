"""
Schedule Management API Endpoints

Provides REST API endpoints for:
- Schedule CRUD operations
- Task management
- Baseline management and variance analysis
- Schedule performance metrics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date
import logging

from auth.dependencies import get_current_user
from services.schedule_manager import ScheduleManager
from services.baseline_manager import BaselineManager
from services.task_dependency_engine import TaskDependencyEngine
from services.wbs_manager import WBSManager
from services.milestone_tracker import MilestoneTracker
from services.resource_assignment_service import ResourceAssignmentService
from services.schedule_export_service import ScheduleExportService
from services.schedule_financial_integration import ScheduleFinancialIntegrationService
from services.schedule_audit_service import ScheduleAuditService
from services.schedule_notifications_service import ScheduleNotificationsService
from services.schedule_cache import get_schedule_cached, set_schedule_cached, invalidate_schedule, get_critical_path_cached, set_critical_path_cached
from models.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse,
    TaskCreate, TaskUpdate, TaskResponse, TaskProgressUpdate,
    ScheduleBaselineCreate, ScheduleBaselineResponse,
    ScheduleWithTasksResponse, TaskHierarchyResponse,
    PaginationParams, ScheduleFilter, TaskFilter,
    TaskDependencyCreate, TaskDependencyResponse, DependencyType,
    CriticalPathResult, FloatCalculation,
    WBSElementCreate, WBSElementResponse, WBSHierarchy,
    MilestoneCreate, MilestoneResponse, MilestoneStatus,
    ResourceAssignmentCreate, ResourceAssignmentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schedules", tags=["schedules"])

# Initialize services
schedule_manager = ScheduleManager()
baseline_manager = BaselineManager()
dependency_engine = TaskDependencyEngine()
wbs_manager = WBSManager()
milestone_tracker = MilestoneTracker()
resource_assignment_service = ResourceAssignmentService()
schedule_export_service = ScheduleExportService()
schedule_financial_integration = ScheduleFinancialIntegrationService()
schedule_audit_service = ScheduleAuditService()
schedule_notifications_service = ScheduleNotificationsService()

# =====================================================
# SCHEDULE CRUD ENDPOINTS
# =====================================================

@router.get("/", response_model=Dict[str, Any])
async def list_schedules(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: dict = Depends(get_current_user),
):
    """List schedules with filtering and pagination."""
    try:
        schedules, total = await schedule_manager.list_schedules(
            project_id=project_id,
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return {"schedules": schedules, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        logger.error(f"Error listing schedules: {e}")
        raise HTTPException(status_code=500, detail="Failed to list schedules")

@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    project_id: UUID,
    schedule_data: ScheduleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project schedule."""
    try:
        schedule = await schedule_manager.create_schedule(
            project_id, schedule_data, UUID(current_user["id"])
        )
        return schedule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to create schedule")

@router.get("/notifications", response_model=Dict[str, Any])
async def get_schedule_notifications(
    schedule_id: Optional[UUID] = Query(None),
    days_ahead: int = Query(14, ge=1, le=90),
    current_user: dict = Depends(get_current_user),
):
    """Get milestone deadline alerts and task assignment notifications (Task 13.2)."""
    try:
        user_id = UUID(current_user["id"]) if current_user.get("id") else None
        return await schedule_notifications_service.get_schedule_notifications(
            user_id=user_id, schedule_id=schedule_id, days_ahead=days_ahead
        )
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notifications")

@router.get("/{schedule_id}", response_model=ScheduleWithTasksResponse)
async def get_schedule_with_tasks(
    schedule_id: UUID,
    include_dependencies: bool = Query(True, description="Include task dependencies"),
    current_user: dict = Depends(get_current_user)
):
    """Get a schedule with all its tasks and related data (cached 60s)."""
    try:
        cached = get_schedule_cached(schedule_id)
        if cached is not None:
            return cached
        schedule = await schedule_manager.get_schedule_with_tasks(
            schedule_id, include_dependencies
        )
        set_schedule_cached(schedule_id, schedule)
        return schedule
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to get schedule")

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    updates: ScheduleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing schedule."""
    try:
        schedule = await schedule_manager.update_schedule(
            schedule_id, updates, UUID(current_user["id"])
        )
        invalidate_schedule(schedule_id)
        return schedule
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to update schedule")

@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a schedule and all its tasks."""
    try:
        success = await schedule_manager.delete_schedule(schedule_id)
        if not success:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return {"message": "Schedule deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete schedule")

# =====================================================
# TASK MANAGEMENT ENDPOINTS
# =====================================================

@router.post("/{schedule_id}/tasks", response_model=TaskResponse)
async def create_task(
    schedule_id: UUID,
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task in the schedule."""
    try:
        task = await schedule_manager.create_task(
            schedule_id, task_data, UUID(current_user["id"])
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    updates: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing task."""
    try:
        task = await schedule_manager.update_task(
            task_id, updates, UUID(current_user["id"])
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")

@router.post("/tasks/{task_id}/progress", response_model=TaskResponse)
async def update_task_progress(
    task_id: UUID,
    progress_data: TaskProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update task progress with actual dates and percentage completion."""
    try:
        task = await schedule_manager.update_task_progress(
            task_id, progress_data, UUID(current_user["id"])
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating task progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task progress")

@router.get("/{schedule_id}/tasks/hierarchy", response_model=List[TaskHierarchyResponse])
async def get_task_hierarchy(
    schedule_id: UUID,
    max_depth: Optional[int] = Query(None, description="Maximum hierarchy depth"),
    current_user: dict = Depends(get_current_user)
):
    """Get task hierarchy for a schedule."""
    try:
        hierarchy = await schedule_manager.get_task_hierarchy(schedule_id, max_depth)
        return hierarchy
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting task hierarchy: {e}")
        raise HTTPException(status_code=500, detail="Failed to get task hierarchy")

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a task and all its children."""
    try:
        success = await schedule_manager.delete_task(task_id)
        if not success:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"message": "Task deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete task")

# =====================================================
# DEPENDENCY MANAGEMENT ENDPOINTS
# =====================================================

@router.post("/tasks/{task_id}/dependencies", response_model=TaskDependencyResponse)
async def create_dependency(
    task_id: UUID,
    body: TaskDependencyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a dependency involving this task (as predecessor or successor)."""
    try:
        pred_id = body.predecessor_task_id
        succ_id = body.successor_task_id
        if str(pred_id) != str(task_id) and str(succ_id) != str(task_id):
            raise HTTPException(
                status_code=400,
                detail="One of predecessor_task_id or successor_task_id must equal the path task_id",
            )
        dep = await dependency_engine.create_dependency(
            pred_id, succ_id, body.dependency_type, body.lag_days, UUID(current_user["id"])
        )
        return dep
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating dependency: {e}")
        raise HTTPException(status_code=500, detail="Failed to create dependency")

@router.get("/tasks/{task_id}/dependencies", response_model=List[TaskDependencyResponse])
async def get_task_dependencies(
    task_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get all dependencies for a task."""
    try:
        return await dependency_engine.get_dependencies_for_task(task_id)
    except Exception as e:
        logger.error(f"Error getting task dependencies: {e}")
        raise HTTPException(status_code=500, detail="Failed to get task dependencies")

@router.delete("/dependencies/{dependency_id}")
async def delete_dependency(
    dependency_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a dependency."""
    try:
        result = await dependency_engine.delete_dependency(dependency_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting dependency: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete dependency")

@router.get("/{schedule_id}/critical-path", response_model=CriticalPathResult)
async def get_critical_path(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get critical path analysis for a schedule (cached 60s)."""
    try:
        cached = get_critical_path_cached(schedule_id)
        if cached is not None:
            return cached
        result = await dependency_engine.calculate_critical_path(schedule_id)
        set_critical_path_cached(schedule_id, result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating critical path: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate critical path")

@router.get("/tasks/{task_id}/float", response_model=FloatCalculation)
async def get_task_float(
    task_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get float calculations for a task."""
    try:
        return await dependency_engine.get_task_float(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting task float: {e}")
        raise HTTPException(status_code=500, detail="Failed to get task float")

# =====================================================
# WBS AND MILESTONE ENDPOINTS
# =====================================================

@router.post("/{schedule_id}/wbs", response_model=WBSElementResponse)
async def create_wbs_element(
    schedule_id: UUID,
    wbs_data: WBSElementCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a WBS element in the schedule."""
    try:
        return await wbs_manager.create_wbs_element(
            schedule_id, wbs_data, UUID(current_user["id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating WBS element: {e}")
        raise HTTPException(status_code=500, detail="Failed to create WBS element")

@router.get("/{schedule_id}/wbs/hierarchy", response_model=WBSHierarchy)
async def get_wbs_hierarchy(
    schedule_id: UUID,
    max_depth: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get WBS hierarchy for a schedule."""
    try:
        return await wbs_manager.get_wbs_hierarchy(schedule_id, max_depth)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting WBS hierarchy: {e}")
        raise HTTPException(status_code=500, detail="Failed to get WBS hierarchy")

@router.post("/{schedule_id}/milestones", response_model=MilestoneResponse)
async def create_milestone(
    schedule_id: UUID,
    milestone_data: MilestoneCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a milestone in the schedule."""
    try:
        return await milestone_tracker.create_milestone(
            schedule_id, milestone_data, UUID(current_user["id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating milestone: {e}")
        raise HTTPException(status_code=500, detail="Failed to create milestone")

@router.get("/{schedule_id}/milestones", response_model=List[MilestoneResponse])
async def list_milestones(
    schedule_id: UUID,
    status: Optional[str] = Query(None, description="Filter by status (planned, at_risk, achieved, missed)"),
    current_user: dict = Depends(get_current_user)
):
    """List milestones for a schedule, optionally filtered by status."""
    try:
        status_filter = [MilestoneStatus(status)] if status else None
        return await milestone_tracker.get_milestones_by_schedule(schedule_id, status_filter)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error listing milestones: {e}")
        raise HTTPException(status_code=500, detail="Failed to list milestones")

# =====================================================
# RESOURCE ASSIGNMENT ENDPOINTS
# =====================================================

@router.post("/tasks/{task_id}/resources", response_model=ResourceAssignmentResponse)
async def assign_resource_to_task(
    task_id: UUID,
    assignment_data: ResourceAssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Assign a resource to a task."""
    try:
        return await resource_assignment_service.assign_resource_to_task(
            task_id, assignment_data, UUID(current_user["id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error assigning resource: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign resource")

@router.get("/{schedule_id}/resource-conflicts", response_model=Dict[str, Any])
async def get_resource_conflicts(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get resource conflicts for a schedule."""
    try:
        conflicts = await resource_assignment_service.detect_resource_conflicts(schedule_id)
        return {"schedule_id": str(schedule_id), "conflicts": conflicts}
    except Exception as e:
        logger.error(f"Error detecting resource conflicts: {e}")
        raise HTTPException(status_code=500, detail="Failed to detect resource conflicts")

@router.get("/{schedule_id}/resource-utilization", response_model=Dict[str, Any])
async def get_resource_utilization(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get resource utilization report for a schedule."""
    try:
        return await resource_assignment_service.get_schedule_resource_summary(schedule_id)
    except Exception as e:
        logger.error(f"Error calculating resource utilization: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate resource utilization")

@router.post("/{schedule_id}/resource-leveling", response_model=Dict[str, Any])
async def suggest_resource_leveling(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get resource leveling suggestions for a schedule."""
    try:
        return await resource_assignment_service.suggest_resource_leveling(schedule_id)
    except Exception as e:
        logger.error(f"Error suggesting resource leveling: {e}")
        raise HTTPException(status_code=500, detail="Failed to suggest resource leveling")

@router.get("/{schedule_id}/resource-availability", response_model=Dict[str, Any])
async def get_resource_availability(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get resource availability for the schedule (capacity, assigned, remaining). Task 10.2."""
    try:
        return await resource_assignment_service.get_schedule_resource_availability(schedule_id)
    except Exception as e:
        logger.error(f"Error getting resource availability: {e}")
        raise HTTPException(status_code=500, detail="Failed to get resource availability")

@router.post("/{schedule_id}/sync-resources", response_model=Dict[str, Any])
async def sync_schedule_resources_to_project(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Synchronize schedule task resource assignments to project_resources. Task 10.2."""
    try:
        return await resource_assignment_service.sync_schedule_assignments_to_project(schedule_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error syncing schedule resources: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync schedule resources")

# =====================================================
# EARNED VALUE ENDPOINT
# =====================================================

@router.get("/{schedule_id}/earned-value", response_model=Dict[str, Any])
async def get_earned_value(
    schedule_id: UUID,
    baseline_id: Optional[UUID] = Query(None),
    status_date: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get earned value metrics for a schedule."""
    try:
        return await baseline_manager.calculate_earned_value_metrics(
            schedule_id, baseline_id, status_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating earned value: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate earned value")

@router.get("/{schedule_id}/financial-summary", response_model=Dict[str, Any])
async def get_schedule_financial_summary(
    schedule_id: UUID,
    status_date: Optional[date] = Query(None, description="Status date for EV/financial calculations"),
    baseline_id: Optional[UUID] = Query(None, description="Baseline ID for EV (uses latest approved if omitted)"),
    current_user: dict = Depends(get_current_user)
):
    """Get financial summary for dashboard: budget, actual cost, earned value, cost variance. Task 10.1."""
    try:
        return await schedule_financial_integration.get_schedule_financial_summary(
            schedule_id, status_date=status_date, baseline_id=baseline_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting schedule financial summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get schedule financial summary")

# =====================================================
# BASELINE MANAGEMENT ENDPOINTS
# =====================================================

@router.post("/{schedule_id}/baselines", response_model=ScheduleBaselineResponse)
async def create_baseline(
    schedule_id: UUID,
    baseline_data: ScheduleBaselineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new baseline for the schedule."""
    try:
        baseline = await baseline_manager.create_baseline(
            schedule_id, baseline_data, UUID(current_user["id"])
        )
        return baseline
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating baseline: {e}")
        raise HTTPException(status_code=500, detail="Failed to create baseline")

@router.get("/{schedule_id}/baselines", response_model=List[ScheduleBaselineResponse])
async def get_baseline_versions(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get all baseline versions for a schedule."""
    try:
        baselines = await baseline_manager.get_baseline_versions(schedule_id)
        return baselines
    except Exception as e:
        logger.error(f"Error getting baseline versions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get baseline versions")

@router.get("/baselines/{baseline_id}", response_model=ScheduleBaselineResponse)
async def get_baseline(
    baseline_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific baseline by ID."""
    try:
        baseline = await baseline_manager.get_baseline(baseline_id)
        if not baseline:
            raise HTTPException(status_code=404, detail="Baseline not found")
        return baseline
    except Exception as e:
        logger.error(f"Error getting baseline: {e}")
        raise HTTPException(status_code=500, detail="Failed to get baseline")

@router.post("/baselines/{baseline_id}/approve", response_model=ScheduleBaselineResponse)
async def approve_baseline(
    baseline_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Approve a baseline and set it as the official project baseline."""
    try:
        baseline = await baseline_manager.approve_baseline(
            baseline_id, UUID(current_user["id"])
        )
        return baseline
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving baseline: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve baseline")

@router.delete("/baselines/{baseline_id}")
async def delete_baseline(
    baseline_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a baseline (only if not approved)."""
    try:
        success = await baseline_manager.delete_baseline(baseline_id)
        if not success:
            raise HTTPException(status_code=404, detail="Baseline not found or cannot be deleted")
        return {"message": "Baseline deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting baseline: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete baseline")

# =====================================================
# VARIANCE AND PERFORMANCE ANALYSIS ENDPOINTS
# =====================================================

@router.get("/{schedule_id}/variance", response_model=Dict[str, Any])
async def get_schedule_variance(
    schedule_id: UUID,
    baseline_id: Optional[UUID] = Query(None, description="Specific baseline ID (uses latest approved if not provided)"),
    current_user: dict = Depends(get_current_user)
):
    """Get schedule variance analysis against baseline."""
    try:
        variance = await baseline_manager.calculate_schedule_variance(schedule_id, baseline_id)
        return variance
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating schedule variance: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate schedule variance")

@router.get("/{schedule_id}/performance", response_model=Dict[str, Any])
async def get_schedule_performance(
    schedule_id: UUID,
    baseline_id: Optional[UUID] = Query(None, description="Specific baseline ID"),
    status_date: Optional[date] = Query(None, description="Status date for calculations"),
    current_user: dict = Depends(get_current_user)
):
    """Get schedule performance metrics including earned value analysis."""
    try:
        performance = await baseline_manager.calculate_earned_value_metrics(
            schedule_id, baseline_id, status_date
        )
        return performance
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating schedule performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate schedule performance")

@router.get("/{schedule_id}/progress", response_model=Dict[str, Any])
async def get_schedule_progress(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get overall schedule progress and health metrics."""
    try:
        progress = await schedule_manager.calculate_schedule_progress(schedule_id)
        return progress
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating schedule progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate schedule progress")

# =====================================================
# BULK OPERATIONS ENDPOINTS
# =====================================================

@router.post("/tasks/bulk-progress", response_model=Dict[str, Any])
async def bulk_update_task_progress(
    progress_updates: List[Dict[str, Any]],
    current_user: dict = Depends(get_current_user)
):
    """Update progress for multiple tasks in a single operation."""
    try:
        result = await schedule_manager.bulk_update_task_progress(
            progress_updates, UUID(current_user["id"])
        )
        return result
    except Exception as e:
        logger.error(f"Error in bulk update task progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to bulk update task progress")

@router.post("/{schedule_id}/recalculate-progress")
async def recalculate_all_parent_progress(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Recalculate progress for all parent tasks in a schedule."""
    try:
        result = await schedule_manager.recalculate_all_parent_progress(schedule_id)
        return result
    except Exception as e:
        logger.error(f"Error recalculating parent progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to recalculate parent progress")

# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/tasks/{task_id}/children-progress", response_model=Dict[str, Any])
async def get_task_children_progress(
    task_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed progress information for all children of a parent task."""
    try:
        progress = await schedule_manager.get_task_children_progress(task_id)
        return progress
    except Exception as e:
        logger.error(f"Error getting task children progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to get task children progress")

@router.post("/{schedule_id}/update-performance-index")
async def update_schedule_performance_index(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Update the schedule's performance index based on current progress."""
    try:
        await schedule_manager.update_schedule_performance_index(schedule_id)
        return {"message": "Schedule performance index updated successfully"}
    except Exception as e:
        logger.error(f"Error updating schedule performance index: {e}")
        raise HTTPException(status_code=500, detail="Failed to update schedule performance index")

# =====================================================
# EXPORT ENDPOINTS (Task 10.3 - Data export)
# =====================================================

@router.get("/{schedule_id}/export/csv")
async def export_schedule_csv(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Export schedule and tasks to CSV."""
    try:
        csv_content = await schedule_export_service.export_csv(schedule_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=schedule-{schedule_id}.csv"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting schedule CSV: {e}")
        raise HTTPException(status_code=500, detail="Failed to export schedule CSV")

@router.get("/{schedule_id}/export/ms-project")
async def export_schedule_ms_project(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Export schedule to MS Project–compatible XML."""
    try:
        xml_content = await schedule_export_service.export_ms_project_xml(schedule_id)
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=schedule-{schedule_id}.xml"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting MS Project XML: {e}")
        raise HTTPException(status_code=500, detail="Failed to export MS Project XML")

@router.get("/{schedule_id}/export/primavera")
async def export_schedule_primavera(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Export schedule to Primavera P6–compatible XML."""
    try:
        xml_content = await schedule_export_service.export_primavera_xml(schedule_id)
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=schedule-{schedule_id}-p6.xml"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting Primavera XML: {e}")
        raise HTTPException(status_code=500, detail="Failed to export Primavera XML")

@router.get("/{schedule_id}/export/pdf-data", response_model=Dict[str, Any])
async def export_schedule_pdf_data(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Return schedule data for client-side PDF report generation."""
    try:
        return await schedule_export_service.export_pdf_data(schedule_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting PDF data: {e}")
        raise HTTPException(status_code=500, detail="Failed to export PDF data")

# =====================================================
# AUDIT TRAIL (Task 13.3)
# =====================================================

@router.get("/{schedule_id}/audit-trail", response_model=Dict[str, Any])
async def get_schedule_audit_trail(
    schedule_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    since: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get audit trail for schedule changes (Task 13.3)."""
    try:
        return await schedule_audit_service.get_schedule_audit_trail(schedule_id, limit=limit, since=since)
    except Exception as e:
        logger.error(f"Error getting audit trail: {e}")
        raise HTTPException(status_code=500, detail="Failed to get audit trail")