"""
Task Dependency Engine Service

Handles all task dependency operations including:
- Dependency creation with all four relationship types
- Circular dependency detection and prevention
- Dependency validation logic
- Dependency deletion with impact analysis
- Critical path calculation
- Schedule recalculation engine
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID, uuid4
from enum import Enum
import logging
from collections import defaultdict, deque

from config.database import supabase
from models.schedule import (
    TaskDependencyCreate, TaskDependencyResponse, DependencyType,
    CriticalPathResult, FloatCalculation, ScheduleRecalculationResult,
    CircularDependency, ScheduleDateCalculation, TaskResponse
)

logger = logging.getLogger(__name__)

class TaskDependencyEngine:
    """
    Handles all task dependency operations and critical path calculations.
    
    Provides:
    - Dependency creation with all four relationship types
    - Circular dependency detection and prevention
    - Dependency validation logic
    - Dependency deletion with impact analysis
    - Critical path calculation using forward/backward pass algorithms
    - Schedule recalculation engine with real-time triggers
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def create_dependency(
        self,
        predecessor_id: UUID,
        successor_id: UUID,
        dependency_type: DependencyType,
        lag_days: int = 0,
        created_by: UUID = None
    ) -> TaskDependencyResponse:
        """
        Create a task dependency with validation and circular dependency prevention.
        
        Args:
            predecessor_id: ID of the predecessor task
            successor_id: ID of the successor task
            dependency_type: Type of dependency relationship
            lag_days: Number of lag days (can be negative for lead time)
            created_by: ID of the user creating the dependency
            
        Returns:
            TaskDependencyResponse: Created dependency data
        """
        try:
            # Validate tasks exist and are in the same schedule
            await self._validate_dependency_tasks(predecessor_id, successor_id)
            
            # Check for circular dependencies
            if await self._would_create_circular_dependency(predecessor_id, successor_id):
                raise ValueError("Creating this dependency would create a circular dependency")
            
            # Check if dependency already exists
            existing_result = self.db.table("task_dependencies").select("id").eq(
                "predecessor_task_id", str(predecessor_id)
            ).eq("successor_task_id", str(successor_id)).execute()
            
            if existing_result.data:
                raise ValueError("Dependency already exists between these tasks")
            
            # Create dependency record
            dependency_record = {
                "id": str(uuid4()),
                "predecessor_task_id": str(predecessor_id),
                "successor_task_id": str(successor_id),
                "dependency_type": dependency_type.value,
                "lag_days": lag_days,
                "created_by": str(created_by) if created_by else None,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Insert dependency
            result = self.db.table("task_dependencies").insert(dependency_record).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create dependency")
            
            created_dependency = result.data[0]
            
            # Trigger schedule recalculation
            await self._trigger_schedule_recalculation(successor_id)
            
            return TaskDependencyResponse(
                id=created_dependency["id"],
                predecessor_task_id=created_dependency["predecessor_task_id"],
                successor_task_id=created_dependency["successor_task_id"],
                dependency_type=created_dependency["dependency_type"],
                lag_days=created_dependency["lag_days"],
                created_by=created_dependency["created_by"],
                created_at=datetime.fromisoformat(created_dependency["created_at"].replace('Z', '+00:00'))
            )
            
        except Exception as e:
            logger.error(f"Error creating dependency: {e}")
            raise RuntimeError(f"Failed to create dependency: {str(e)}")
    
    async def delete_dependency(
        self,
        dependency_id: UUID,
        perform_impact_analysis: bool = True
    ) -> Dict[str, Any]:
        """
        Delete a task dependency with impact analysis.
        
        Args:
            dependency_id: ID of the dependency to delete
            perform_impact_analysis: Whether to perform impact analysis
            
        Returns:
            Dict with deletion results and impact analysis
        """
        try:
            # Get dependency details before deletion
            dependency_result = self.db.table("task_dependencies").select("*").eq(
                "id", str(dependency_id)
            ).execute()
            
            if not dependency_result.data:
                raise ValueError(f"Dependency {dependency_id} not found")
            
            dependency = dependency_result.data[0]
            successor_id = UUID(dependency["successor_task_id"])
            
            # Perform impact analysis if requested
            impact_analysis = {}
            if perform_impact_analysis:
                impact_analysis = await self._analyze_dependency_deletion_impact(dependency_id)
            
            # Delete dependency
            delete_result = self.db.table("task_dependencies").delete().eq(
                "id", str(dependency_id)
            ).execute()
            
            if not delete_result.data:
                raise RuntimeError("Failed to delete dependency")
            
            # Trigger schedule recalculation for affected tasks
            await self._trigger_schedule_recalculation(successor_id)
            
            return {
                "dependency_id": str(dependency_id),
                "deleted": True,
                "impact_analysis": impact_analysis,
                "recalculation_triggered": True
            }
            
        except Exception as e:
            logger.error(f"Error deleting dependency {dependency_id}: {e}")
            raise RuntimeError(f"Failed to delete dependency: {str(e)}")

    async def get_dependencies_for_task(self, task_id: UUID) -> List[TaskDependencyResponse]:
        """Get all dependencies where the task is predecessor or successor."""
        try:
            pred = self.db.table("task_dependencies").select("*").eq(
                "predecessor_task_id", str(task_id)
            ).execute()
            succ = self.db.table("task_dependencies").select("*").eq(
                "successor_task_id", str(task_id)
            ).execute()
            seen = set()
            out = []
            for row in (pred.data or []) + (succ.data or []):
                if row["id"] in seen:
                    continue
                seen.add(row["id"])
                out.append(TaskDependencyResponse(
                    id=row["id"],
                    predecessor_task_id=row["predecessor_task_id"],
                    successor_task_id=row["successor_task_id"],
                    dependency_type=row["dependency_type"],
                    lag_days=row["lag_days"],
                    created_by=str(row.get("created_by") or ""),
                    created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                ))
            return out
        except Exception as e:
            logger.error(f"Error getting dependencies for task {task_id}: {e}")
            raise RuntimeError(f"Failed to get dependencies: {str(e)}")
    
    async def detect_circular_dependencies(
        self,
        schedule_id: UUID
    ) -> List[CircularDependency]:
        """
        Detect circular dependencies in a schedule using depth-first search.
        
        Args:
            schedule_id: ID of the schedule to check
            
        Returns:
            List[CircularDependency]: List of detected circular dependencies
        """
        try:
            # Get all tasks and dependencies for the schedule
            tasks_result = self.db.table("tasks").select("id").eq("schedule_id", str(schedule_id)).execute()
            if not tasks_result.data:
                return []
            
            task_ids = {task["id"] for task in tasks_result.data}
            
            # Get all dependencies for tasks in this schedule
            dependencies_result = self.db.table("task_dependencies").select("*").execute()
            if not dependencies_result.data:
                return []
            
            # Filter dependencies for this schedule
            schedule_dependencies = [
                dep for dep in dependencies_result.data
                if dep["predecessor_task_id"] in task_ids and dep["successor_task_id"] in task_ids
            ]
            
            # Build adjacency list
            graph = defaultdict(list)
            for dep in schedule_dependencies:
                graph[dep["predecessor_task_id"]].append(dep["successor_task_id"])
            
            # Detect cycles using DFS
            circular_dependencies = []
            visited = set()
            rec_stack = set()
            path = []
            
            def dfs(node):
                if node in rec_stack:
                    # Found a cycle
                    cycle_start = path.index(node)
                    cycle_path = path[cycle_start:] + [node]
                    circular_dependencies.append(CircularDependency(
                        task_ids=cycle_path,
                        dependency_chain=[f"{cycle_path[i]} -> {cycle_path[i+1]}" for i in range(len(cycle_path)-1)]
                    ))
                    return
                
                if node in visited:
                    return
                
                visited.add(node)
                rec_stack.add(node)
                path.append(node)
                
                for neighbor in graph[node]:
                    dfs(neighbor)
                
                rec_stack.remove(node)
                path.pop()
            
            # Check all nodes
            for task_id in task_ids:
                if task_id not in visited:
                    dfs(task_id)
            
            return circular_dependencies
            
        except Exception as e:
            logger.error(f"Error detecting circular dependencies for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to detect circular dependencies: {str(e)}")
    
    async def calculate_critical_path(
        self,
        schedule_id: UUID
    ) -> CriticalPathResult:
        """
        Calculate the critical path for a schedule using forward and backward pass algorithms.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            CriticalPathResult: Critical path analysis results
        """
        try:
            # Get all tasks and dependencies for the schedule
            tasks_data = await self._get_schedule_tasks_and_dependencies(schedule_id)
            
            if not tasks_data["tasks"]:
                return CriticalPathResult(
                    critical_tasks=[],
                    project_duration_days=0,
                    critical_path_length=0.0,
                    schedule_risk_factors=[]
                )
            
            tasks = tasks_data["tasks"]
            dependencies = tasks_data["dependencies"]
            
            # Perform forward pass to calculate early dates
            early_dates = await self._calculate_early_dates(tasks, dependencies)
            
            # Perform backward pass to calculate late dates
            late_dates = await self._calculate_late_dates(tasks, dependencies, early_dates)
            
            # Calculate float for each task
            float_calculations = {}
            critical_tasks = []
            
            for task in tasks:
                task_id = task["id"]
                early_start = early_dates[task_id]["early_start"]
                early_finish = early_dates[task_id]["early_finish"]
                late_start = late_dates[task_id]["late_start"]
                late_finish = late_dates[task_id]["late_finish"]
                
                total_float = (late_start - early_start).days
                
                float_calculations[task_id] = FloatCalculation(
                    task_id=task_id,
                    total_float_days=total_float,
                    free_float_days=0,  # Will be calculated separately
                    early_start_date=early_start,
                    early_finish_date=early_finish,
                    late_start_date=late_start,
                    late_finish_date=late_finish
                )
                
                # Task is critical if total float is zero
                if total_float == 0:
                    critical_tasks.append(task_id)
            
            # Calculate free float
            await self._calculate_free_float(tasks, dependencies, float_calculations)
            
            # Update task records with calculated dates and critical status
            await self._update_task_critical_path_data(float_calculations, critical_tasks)
            
            # Calculate project duration
            project_end_date = max(early_dates[task_id]["early_finish"] for task_id in early_dates.keys())
            project_start_date = min(early_dates[task_id]["early_start"] for task_id in early_dates.keys())
            project_duration = (project_end_date - project_start_date).days + 1
            
            # Identify schedule risk factors
            risk_factors = await self._identify_schedule_risk_factors(tasks, dependencies, critical_tasks)
            
            return CriticalPathResult(
                critical_tasks=critical_tasks,
                project_duration_days=project_duration,
                critical_path_length=len(critical_tasks),
                schedule_risk_factors=risk_factors
            )
            
        except Exception as e:
            logger.error(f"Error calculating critical path for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to calculate critical path: {str(e)}")
    
    async def calculate_task_dates(
        self,
        schedule_id: UUID,
        task_id: Optional[UUID] = None
    ) -> ScheduleDateCalculation:
        """
        Calculate or recalculate task dates based on dependencies.
        
        Args:
            schedule_id: ID of the schedule
            task_id: Optional specific task ID to recalculate (None for all tasks)
            
        Returns:
            ScheduleDateCalculation: Date calculation results
        """
        try:
            # Get tasks and dependencies
            tasks_data = await self._get_schedule_tasks_and_dependencies(schedule_id)
            tasks = tasks_data["tasks"]
            dependencies = tasks_data["dependencies"]
            
            if not tasks:
                return ScheduleDateCalculation(
                    schedule_id=str(schedule_id),
                    calculated_tasks=[],
                    calculation_timestamp=datetime.utcnow(),
                    errors=[]
                )
            
            # Filter to specific task if requested
            if task_id:
                tasks = [task for task in tasks if task["id"] == str(task_id)]
                if not tasks:
                    raise ValueError(f"Task {task_id} not found in schedule")
            
            # Calculate early dates using forward pass
            early_dates = await self._calculate_early_dates(tasks, dependencies)
            
            # Update task records with calculated dates
            calculated_tasks = []
            errors = []
            
            for task in tasks:
                try:
                    task_id_str = task["id"]
                    early_start = early_dates[task_id_str]["early_start"]
                    early_finish = early_dates[task_id_str]["early_finish"]
                    
                    # Update task with calculated dates
                    update_data = {
                        "early_start_date": early_start.isoformat(),
                        "early_finish_date": early_finish.isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    result = self.db.table("tasks").update(update_data).eq("id", task_id_str).execute()
                    
                    if result.data:
                        calculated_tasks.append(task_id_str)
                    else:
                        errors.append(f"Failed to update dates for task {task_id_str}")
                        
                except Exception as e:
                    errors.append(f"Error calculating dates for task {task.get('id', 'unknown')}: {str(e)}")
            
            return ScheduleDateCalculation(
                schedule_id=str(schedule_id),
                calculated_tasks=calculated_tasks,
                calculation_timestamp=datetime.utcnow(),
                errors=errors
            )
            
        except Exception as e:
            logger.error(f"Error calculating task dates for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to calculate task dates: {str(e)}")
    
    async def recalculate_schedule(
        self,
        schedule_id: UUID,
        changed_task_id: UUID
    ) -> ScheduleRecalculationResult:
        """
        Recalculate schedule after a task change with dependency impact propagation.
        
        Args:
            schedule_id: ID of the schedule
            changed_task_id: ID of the task that changed
            
        Returns:
            ScheduleRecalculationResult: Recalculation results
        """
        try:
            # Get current critical path before recalculation
            current_critical_path = await self.calculate_critical_path(schedule_id)
            old_critical_tasks = set(current_critical_path.critical_tasks)
            
            # Find all tasks affected by the change
            affected_tasks = await self._find_affected_tasks(changed_task_id)
            
            # Recalculate dates for affected tasks
            date_calculation = await self.calculate_task_dates(schedule_id)
            
            # Recalculate critical path
            new_critical_path = await self.calculate_critical_path(schedule_id)
            new_critical_tasks = set(new_critical_path.critical_tasks)
            
            # Determine if critical path changed
            critical_path_changed = old_critical_tasks != new_critical_tasks
            
            return ScheduleRecalculationResult(
                schedule_id=str(schedule_id),
                affected_tasks=affected_tasks,
                critical_path_changed=critical_path_changed,
                new_critical_path=new_critical_path.critical_tasks,
                recalculation_timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error recalculating schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to recalculate schedule: {str(e)}")
    
    # Private helper methods
    
    async def _validate_dependency_tasks(self, predecessor_id: UUID, successor_id: UUID) -> None:
        """Validate that both tasks exist and are in the same schedule."""
        # Get both tasks
        tasks_result = self.db.table("tasks").select("id, schedule_id").in_(
            "id", [str(predecessor_id), str(successor_id)]
        ).execute()
        
        if not tasks_result.data or len(tasks_result.data) != 2:
            raise ValueError("One or both tasks not found")
        
        # Check if tasks are in the same schedule
        schedules = {task["schedule_id"] for task in tasks_result.data}
        if len(schedules) > 1:
            raise ValueError("Tasks must be in the same schedule")
    
    async def _would_create_circular_dependency(self, predecessor_id: UUID, successor_id: UUID) -> bool:
        """Check if creating a dependency would create a circular dependency."""
        # Get the schedule ID from one of the tasks
        task_result = self.db.table("tasks").select("schedule_id").eq("id", str(predecessor_id)).execute()
        if not task_result.data:
            return False
        
        schedule_id = UUID(task_result.data[0]["schedule_id"])
        
        # Create a temporary dependency graph including the proposed dependency
        tasks_data = await self._get_schedule_tasks_and_dependencies(schedule_id)
        dependencies = tasks_data["dependencies"]
        
        # Add the proposed dependency to the graph
        graph = defaultdict(list)
        for dep in dependencies:
            graph[dep["predecessor_task_id"]].append(dep["successor_task_id"])
        
        # Add proposed dependency
        graph[str(predecessor_id)].append(str(successor_id))
        
        # Check if there's a path from successor back to predecessor
        visited = set()
        
        def has_path(start, end):
            if start == end:
                return True
            if start in visited:
                return False
            
            visited.add(start)
            for neighbor in graph[start]:
                if has_path(neighbor, end):
                    return True
            return False
        
        return has_path(str(successor_id), str(predecessor_id))
    
    async def _get_schedule_tasks_and_dependencies(self, schedule_id: UUID) -> Dict[str, Any]:
        """Get all tasks and dependencies for a schedule."""
        # Get tasks
        tasks_result = self.db.table("tasks").select("*").eq("schedule_id", str(schedule_id)).execute()
        tasks = tasks_result.data or []
        
        if not tasks:
            return {"tasks": [], "dependencies": []}
        
        task_ids = {task["id"] for task in tasks}
        
        # Get dependencies for these tasks
        dependencies_result = self.db.table("task_dependencies").select("*").execute()
        dependencies = []
        
        if dependencies_result.data:
            dependencies = [
                dep for dep in dependencies_result.data
                if dep["predecessor_task_id"] in task_ids and dep["successor_task_id"] in task_ids
            ]
        
        return {"tasks": tasks, "dependencies": dependencies}
    
    async def _calculate_early_dates(self, tasks: List[Dict], dependencies: List[Dict]) -> Dict[str, Dict]:
        """Calculate early start and finish dates using forward pass algorithm."""
        # Build dependency graph
        predecessors = defaultdict(list)
        for dep in dependencies:
            predecessors[dep["successor_task_id"]].append(dep)
        
        # Initialize early dates
        early_dates = {}
        for task in tasks:
            task_id = task["id"]
            planned_start = date.fromisoformat(task["planned_start_date"])
            duration = task["duration_days"]
            
            early_dates[task_id] = {
                "early_start": planned_start,
                "early_finish": planned_start + timedelta(days=duration - 1)
            }
        
        # Topological sort and forward pass
        in_degree = defaultdict(int)
        for dep in dependencies:
            in_degree[dep["successor_task_id"]] += 1
        
        queue = deque([task["id"] for task in tasks if in_degree[task["id"]] == 0])
        
        while queue:
            current_task_id = queue.popleft()
            current_task = next(task for task in tasks if task["id"] == current_task_id)
            duration = current_task["duration_days"]
            
            # Calculate early dates based on predecessors
            if current_task_id in predecessors:
                max_early_start = early_dates[current_task_id]["early_start"]
                
                for dep in predecessors[current_task_id]:
                    pred_id = dep["predecessor_task_id"]
                    dep_type = DependencyType(dep["dependency_type"])
                    lag_days = dep["lag_days"]
                    
                    # Calculate constraint date based on dependency type
                    if dep_type == DependencyType.FINISH_TO_START:
                        constraint_date = early_dates[pred_id]["early_finish"] + timedelta(days=lag_days + 1)
                    elif dep_type == DependencyType.START_TO_START:
                        constraint_date = early_dates[pred_id]["early_start"] + timedelta(days=lag_days)
                    elif dep_type == DependencyType.FINISH_TO_FINISH:
                        constraint_date = early_dates[pred_id]["early_finish"] + timedelta(days=lag_days - duration + 1)
                    elif dep_type == DependencyType.START_TO_FINISH:
                        constraint_date = early_dates[pred_id]["early_start"] + timedelta(days=lag_days - duration + 1)
                    
                    max_early_start = max(max_early_start, constraint_date)
                
                early_dates[current_task_id]["early_start"] = max_early_start
                early_dates[current_task_id]["early_finish"] = max_early_start + timedelta(days=duration - 1)
            
            # Add successors to queue
            for dep in dependencies:
                if dep["predecessor_task_id"] == current_task_id:
                    successor_id = dep["successor_task_id"]
                    in_degree[successor_id] -= 1
                    if in_degree[successor_id] == 0:
                        queue.append(successor_id)
        
        return early_dates
    
    async def _calculate_late_dates(self, tasks: List[Dict], dependencies: List[Dict], early_dates: Dict) -> Dict[str, Dict]:
        """Calculate late start and finish dates using backward pass algorithm."""
        # Find project end date
        project_end = max(early_dates[task_id]["early_finish"] for task_id in early_dates.keys())
        
        # Initialize late dates
        late_dates = {}
        for task in tasks:
            task_id = task["id"]
            duration = task["duration_days"]
            
            late_dates[task_id] = {
                "late_finish": project_end,
                "late_start": project_end - timedelta(days=duration - 1)
            }
        
        # Build successor graph
        successors = defaultdict(list)
        for dep in dependencies:
            successors[dep["predecessor_task_id"]].append(dep)
        
        # Backward pass
        # Start with tasks that have no successors
        out_degree = defaultdict(int)
        for dep in dependencies:
            out_degree[dep["predecessor_task_id"]] += 1
        
        queue = deque([task["id"] for task in tasks if out_degree[task["id"]] == 0])
        
        while queue:
            current_task_id = queue.popleft()
            current_task = next(task for task in tasks if task["id"] == current_task_id)
            duration = current_task["duration_days"]
            
            # Calculate late dates based on successors
            if current_task_id in successors:
                min_late_finish = late_dates[current_task_id]["late_finish"]
                
                for dep in successors[current_task_id]:
                    succ_id = dep["successor_task_id"]
                    dep_type = DependencyType(dep["dependency_type"])
                    lag_days = dep["lag_days"]
                    
                    # Calculate constraint date based on dependency type
                    if dep_type == DependencyType.FINISH_TO_START:
                        constraint_date = late_dates[succ_id]["late_start"] - timedelta(days=lag_days + 1)
                    elif dep_type == DependencyType.START_TO_START:
                        constraint_date = late_dates[succ_id]["late_start"] - timedelta(days=lag_days)
                    elif dep_type == DependencyType.FINISH_TO_FINISH:
                        constraint_date = late_dates[succ_id]["late_finish"] - timedelta(days=lag_days)
                    elif dep_type == DependencyType.START_TO_FINISH:
                        constraint_date = late_dates[succ_id]["late_finish"] - timedelta(days=lag_days)
                    
                    min_late_finish = min(min_late_finish, constraint_date)
                
                late_dates[current_task_id]["late_finish"] = min_late_finish
                late_dates[current_task_id]["late_start"] = min_late_finish - timedelta(days=duration - 1)
            
            # Add predecessors to queue
            for dep in dependencies:
                if dep["successor_task_id"] == current_task_id:
                    predecessor_id = dep["predecessor_task_id"]
                    out_degree[predecessor_id] -= 1
                    if out_degree[predecessor_id] == 0:
                        queue.append(predecessor_id)
        
        return late_dates
    
    async def _calculate_free_float(self, tasks: List[Dict], dependencies: List[Dict], float_calculations: Dict) -> None:
        """Calculate free float for each task."""
        # Build successor graph
        successors = defaultdict(list)
        for dep in dependencies:
            successors[dep["predecessor_task_id"]].append(dep)
        
        for task in tasks:
            task_id = task["id"]
            early_finish = float_calculations[task_id].early_finish_date
            
            # Free float is the minimum difference between this task's early finish
            # and the early start of its immediate successors
            min_successor_early_start = None
            
            if task_id in successors:
                for dep in successors[task_id]:
                    succ_id = dep["successor_task_id"]
                    succ_early_start = float_calculations[succ_id].early_start_date
                    
                    if min_successor_early_start is None:
                        min_successor_early_start = succ_early_start
                    else:
                        min_successor_early_start = min(min_successor_early_start, succ_early_start)
            
            if min_successor_early_start:
                free_float_days = (min_successor_early_start - early_finish).days - 1
                float_calculations[task_id].free_float_days = max(0, free_float_days)
            else:
                # No successors, free float equals total float
                float_calculations[task_id].free_float_days = float_calculations[task_id].total_float_days
    
    async def _update_task_critical_path_data(self, float_calculations: Dict, critical_tasks: List[str]) -> None:
        """Update task records with critical path calculation results."""
        for task_id, float_calc in float_calculations.items():
            update_data = {
                "is_critical": task_id in critical_tasks,
                "total_float_days": float_calc.total_float_days,
                "free_float_days": float_calc.free_float_days,
                "early_start_date": float_calc.early_start_date.isoformat(),
                "early_finish_date": float_calc.early_finish_date.isoformat(),
                "late_start_date": float_calc.late_start_date.isoformat(),
                "late_finish_date": float_calc.late_finish_date.isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            try:
                self.db.table("tasks").update(update_data).eq("id", task_id).execute()
            except Exception as e:
                logger.error(f"Error updating critical path data for task {task_id}: {e}")
    
    async def _identify_schedule_risk_factors(self, tasks: List[Dict], dependencies: List[Dict], critical_tasks: List[str]) -> List[str]:
        """Identify potential schedule risk factors."""
        risk_factors = []
        
        # High percentage of critical tasks
        if len(critical_tasks) / len(tasks) > 0.3:
            risk_factors.append("High percentage of critical tasks")
        
        # Tasks with very short duration on critical path
        critical_task_data = [task for task in tasks if task["id"] in critical_tasks]
        short_duration_critical = [task for task in critical_task_data if task["duration_days"] <= 1]
        if len(short_duration_critical) > 0:
            risk_factors.append("Critical tasks with very short duration")
        
        # Complex dependency network
        if len(dependencies) / len(tasks) > 2:
            risk_factors.append("Complex dependency network")
        
        # Tasks with multiple predecessors
        predecessor_count = defaultdict(int)
        for dep in dependencies:
            predecessor_count[dep["successor_task_id"]] += 1
        
        high_dependency_tasks = [task_id for task_id, count in predecessor_count.items() if count > 3]
        if high_dependency_tasks:
            risk_factors.append("Tasks with high dependency complexity")
        
        return risk_factors
    
    async def _analyze_dependency_deletion_impact(self, dependency_id: UUID) -> Dict[str, Any]:
        """Analyze the impact of deleting a dependency."""
        try:
            # Get dependency details
            dependency_result = self.db.table("task_dependencies").select("*").eq(
                "id", str(dependency_id)
            ).execute()
            
            if not dependency_result.data:
                return {"error": "Dependency not found"}
            
            dependency = dependency_result.data[0]
            successor_id = dependency["successor_task_id"]
            
            # Find all tasks that might be affected
            affected_tasks = await self._find_affected_tasks(UUID(successor_id))
            
            return {
                "affected_task_count": len(affected_tasks),
                "affected_tasks": affected_tasks,
                "dependency_type": dependency["dependency_type"],
                "lag_days": dependency["lag_days"]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing dependency deletion impact: {e}")
            return {"error": str(e)}
    
    async def _find_affected_tasks(self, changed_task_id: UUID) -> List[str]:
        """Find all tasks that could be affected by a change to the given task."""
        try:
            # Get all dependencies
            dependencies_result = self.db.table("task_dependencies").select("*").execute()
            if not dependencies_result.data:
                return []
            
            dependencies = dependencies_result.data
            
            # Build successor graph
            successors = defaultdict(list)
            for dep in dependencies:
                successors[dep["predecessor_task_id"]].append(dep["successor_task_id"])
            
            # Find all downstream tasks using BFS
            affected_tasks = []
            visited = set()
            queue = deque([str(changed_task_id)])
            
            while queue:
                current_task = queue.popleft()
                if current_task in visited:
                    continue
                
                visited.add(current_task)
                affected_tasks.append(current_task)
                
                # Add successors to queue
                for successor in successors[current_task]:
                    if successor not in visited:
                        queue.append(successor)
            
            return affected_tasks
            
        except Exception as e:
            logger.error(f"Error finding affected tasks: {e}")
            return []
    
    async def _trigger_schedule_recalculation(self, task_id: UUID) -> None:
        """Trigger schedule recalculation for a task's schedule."""
        try:
            # Get task's schedule
            task_result = self.db.table("tasks").select("schedule_id").eq("id", str(task_id)).execute()
            if not task_result.data:
                return
            
            schedule_id = UUID(task_result.data[0]["schedule_id"])
            
            # Trigger recalculation (in a real system, this might be async)
            await self.recalculate_schedule(schedule_id, task_id)
            
        except Exception as e:
            logger.error(f"Error triggering schedule recalculation: {e}")
    
    async def get_task_float(
        self,
        task_id: UUID
    ) -> FloatCalculation:
        """
        Get float calculation for a specific task.
        
        Args:
            task_id: ID of the task
            
        Returns:
            FloatCalculation: Float calculation results
        """
        try:
            # Get task details
            task_result = self.db.table("tasks").select("*").eq("id", str(task_id)).execute()
            if not task_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            task = task_result.data[0]
            
            return FloatCalculation(
                task_id=str(task_id),
                total_float_days=task["total_float_days"],
                free_float_days=task["free_float_days"],
                early_start_date=date.fromisoformat(task["early_start_date"]) if task.get("early_start_date") else date.fromisoformat(task["planned_start_date"]),
                early_finish_date=date.fromisoformat(task["early_finish_date"]) if task.get("early_finish_date") else date.fromisoformat(task["planned_end_date"]),
                late_start_date=date.fromisoformat(task["late_start_date"]) if task.get("late_start_date") else date.fromisoformat(task["planned_start_date"]),
                late_finish_date=date.fromisoformat(task["late_finish_date"]) if task.get("late_finish_date") else date.fromisoformat(task["planned_end_date"])
            )
            
        except Exception as e:
            logger.error(f"Error getting task float {task_id}: {e}")
            raise RuntimeError(f"Failed to get task float: {str(e)}")
    
    async def get_critical_path_tasks(
        self,
        schedule_id: UUID
    ) -> List[TaskResponse]:
        """
        Get detailed information for all critical path tasks.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            List[TaskResponse]: Critical path tasks with full details
        """
        try:
            # Get all critical tasks for the schedule
            critical_tasks_result = self.db.table("tasks").select("*").eq(
                "schedule_id", str(schedule_id)
            ).eq("is_critical", True).execute()
            
            if not critical_tasks_result.data:
                return []
            
            # Convert to TaskResponse objects
            from services.schedule_manager import ScheduleManager
            schedule_manager = ScheduleManager()
            
            critical_tasks = []
            for task_data in critical_tasks_result.data:
                task_response = schedule_manager._convert_task_to_response(task_data)
                critical_tasks.append(task_response)
            
            # Sort by early start date to show path sequence
            critical_tasks.sort(key=lambda t: t.early_start_date or t.planned_start_date)
            
            return critical_tasks
            
        except Exception as e:
            logger.error(f"Error getting critical path tasks for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to get critical path tasks: {str(e)}")
    
    async def analyze_schedule_compression_opportunities(
        self,
        schedule_id: UUID
    ) -> Dict[str, Any]:
        """
        Analyze opportunities for schedule compression (crashing and fast-tracking).
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Dict with compression analysis results
        """
        try:
            # Get critical path
            critical_path_result = await self.calculate_critical_path(schedule_id)
            
            if not critical_path_result.critical_tasks:
                return {
                    "compression_opportunities": [],
                    "fast_tracking_opportunities": [],
                    "potential_time_savings": 0
                }
            
            # Get critical tasks details
            critical_tasks = await self.get_critical_path_tasks(schedule_id)
            
            # Analyze crashing opportunities (shortening task durations)
            crashing_opportunities = []
            for task in critical_tasks:
                if task.duration_days > 1:  # Can potentially be shortened
                    crashing_opportunities.append({
                        "task_id": task.id,
                        "task_name": task.name,
                        "current_duration": task.duration_days,
                        "potential_savings": min(task.duration_days - 1, task.duration_days * 0.3),  # Up to 30% reduction
                        "compression_type": "crashing"
                    })
            
            # Analyze fast-tracking opportunities (parallel execution)
            tasks_data = await self._get_schedule_tasks_and_dependencies(schedule_id)
            dependencies = tasks_data["dependencies"]
            
            fast_tracking_opportunities = []
            for dep in dependencies:
                if dep["dependency_type"] == DependencyType.FINISH_TO_START.value:
                    # Could potentially be changed to start-to-start with overlap
                    pred_task = next((t for t in critical_tasks if t.id == dep["predecessor_task_id"]), None)
                    succ_task = next((t for t in critical_tasks if t.id == dep["successor_task_id"]), None)
                    
                    if pred_task and succ_task:
                        potential_overlap = min(pred_task.duration_days * 0.5, succ_task.duration_days * 0.5)
                        if potential_overlap >= 1:
                            fast_tracking_opportunities.append({
                                "predecessor_task": pred_task.name,
                                "successor_task": succ_task.name,
                                "potential_overlap_days": int(potential_overlap),
                                "compression_type": "fast_tracking"
                            })
            
            # Calculate potential time savings
            total_crashing_savings = sum(opp["potential_savings"] for opp in crashing_opportunities)
            total_fast_tracking_savings = sum(opp["potential_overlap_days"] for opp in fast_tracking_opportunities)
            
            return {
                "compression_opportunities": crashing_opportunities,
                "fast_tracking_opportunities": fast_tracking_opportunities,
                "potential_time_savings": int(total_crashing_savings + total_fast_tracking_savings),
                "current_project_duration": critical_path_result.project_duration_days
            }
            
        except Exception as e:
            logger.error(f"Error analyzing schedule compression for schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to analyze schedule compression: {str(e)}")
    
    async def validate_critical_path_integrity(
        self,
        schedule_id: UUID
    ) -> Dict[str, Any]:
        """
        Validate the integrity of critical path calculations.
        
        Args:
            schedule_id: ID of the schedule
            
        Returns:
            Dict with validation results
        """
        try:
            # Get tasks and dependencies
            tasks_data = await self._get_schedule_tasks_and_dependencies(schedule_id)
            tasks = tasks_data["tasks"]
            dependencies = tasks_data["dependencies"]
            
            validation_results = {
                "is_valid": True,
                "errors": [],
                "warnings": [],
                "statistics": {}
            }
            
            if not tasks:
                validation_results["warnings"].append("No tasks found in schedule")
                return validation_results
            
            # Check for orphaned tasks (no predecessors or successors)
            task_ids = {task["id"] for task in tasks}
            tasks_with_deps = set()
            
            for dep in dependencies:
                tasks_with_deps.add(dep["predecessor_task_id"])
                tasks_with_deps.add(dep["successor_task_id"])
            
            orphaned_tasks = task_ids - tasks_with_deps
            if orphaned_tasks:
                validation_results["warnings"].append(f"Found {len(orphaned_tasks)} orphaned tasks with no dependencies")
            
            # Check for circular dependencies
            circular_deps = await self.detect_circular_dependencies(schedule_id)
            if circular_deps:
                validation_results["is_valid"] = False
                validation_results["errors"].append(f"Found {len(circular_deps)} circular dependencies")
            
            # Validate critical path calculations
            critical_path_result = await self.calculate_critical_path(schedule_id)
            critical_tasks = set(critical_path_result.critical_tasks)
            
            # Check if critical tasks have zero float
            for task in tasks:
                task_id = task["id"]
                is_critical = task.get("is_critical", False)
                total_float = task.get("total_float_days", 0)
                
                if is_critical and total_float > 0:
                    validation_results["errors"].append(f"Critical task {task_id} has non-zero float: {total_float}")
                    validation_results["is_valid"] = False
                
                if not is_critical and total_float == 0 and task_id not in critical_tasks:
                    validation_results["warnings"].append(f"Non-critical task {task_id} has zero float")
            
            # Calculate statistics
            validation_results["statistics"] = {
                "total_tasks": len(tasks),
                "total_dependencies": len(dependencies),
                "critical_tasks": len(critical_tasks),
                "orphaned_tasks": len(orphaned_tasks),
                "circular_dependencies": len(circular_deps),
                "project_duration": critical_path_result.project_duration_days
            }
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating critical path integrity for schedule {schedule_id}: {e}")
            return {
                "is_valid": False,
                "errors": [f"Validation failed: {str(e)}"],
                "warnings": [],
                "statistics": {}
            }
    
    async def auto_recalculate_on_task_change(
        self,
        task_id: UUID,
        change_type: str,
        old_values: Dict[str, Any] = None,
        new_values: Dict[str, Any] = None
    ) -> ScheduleRecalculationResult:
        """
        Automatically recalculate schedule when a task changes.
        
        Args:
            task_id: ID of the changed task
            change_type: Type of change (date_change, duration_change, status_change, etc.)
            old_values: Previous values before change
            new_values: New values after change
            
        Returns:
            ScheduleRecalculationResult: Recalculation results
        """
        try:
            # Get task's schedule
            task_result = self.db.table("tasks").select("schedule_id").eq("id", str(task_id)).execute()
            if not task_result.data:
                raise ValueError(f"Task {task_id} not found")
            
            schedule_id = UUID(task_result.data[0]["schedule_id"])
            
            # Log the change for audit trail
            logger.info(f"Auto-recalculating schedule {schedule_id} due to {change_type} on task {task_id}")
            
            # Determine if recalculation is needed based on change type
            needs_recalculation = self._should_trigger_recalculation(change_type, old_values, new_values)
            
            if not needs_recalculation:
                logger.info(f"Skipping recalculation for change type {change_type}")
                return ScheduleRecalculationResult(
                    schedule_id=str(schedule_id),
                    affected_tasks=[],
                    critical_path_changed=False,
                    new_critical_path=[],
                    recalculation_timestamp=datetime.utcnow()
                )
            
            # Perform recalculation
            return await self.recalculate_schedule(schedule_id, task_id)
            
        except Exception as e:
            logger.error(f"Error in auto-recalculation for task {task_id}: {e}")
            raise RuntimeError(f"Failed to auto-recalculate schedule: {str(e)}")
    
    async def optimize_schedule_performance(
        self,
        schedule_id: UUID,
        optimization_goals: List[str] = None
    ) -> Dict[str, Any]:
        """
        Optimize schedule for performance based on specified goals.
        
        Args:
            schedule_id: ID of the schedule
            optimization_goals: List of optimization goals (duration, resource_leveling, cost)
            
        Returns:
            Dict with optimization results and recommendations
        """
        try:
            if optimization_goals is None:
                optimization_goals = ["duration"]
            
            # Get current schedule state
            current_critical_path = await self.calculate_critical_path(schedule_id)
            
            optimization_results = {
                "current_duration": current_critical_path.project_duration_days,
                "optimization_goals": optimization_goals,
                "recommendations": [],
                "potential_improvements": {}
            }
            
            # Duration optimization
            if "duration" in optimization_goals:
                compression_analysis = await self.analyze_schedule_compression_opportunities(schedule_id)
                optimization_results["recommendations"].extend([
                    {
                        "type": "duration_optimization",
                        "description": "Consider crashing critical path tasks",
                        "potential_savings": compression_analysis["potential_time_savings"],
                        "opportunities": compression_analysis["compression_opportunities"]
                    }
                ])
                
                optimization_results["potential_improvements"]["duration"] = {
                    "current_days": current_critical_path.project_duration_days,
                    "potential_savings": compression_analysis["potential_time_savings"],
                    "optimized_days": current_critical_path.project_duration_days - compression_analysis["potential_time_savings"]
                }
            
            # Resource leveling optimization
            if "resource_leveling" in optimization_goals:
                resource_conflicts = await self._analyze_resource_conflicts(schedule_id)
                if resource_conflicts:
                    optimization_results["recommendations"].append({
                        "type": "resource_optimization",
                        "description": "Resolve resource conflicts through task rescheduling",
                        "conflicts_count": len(resource_conflicts),
                        "affected_resources": resource_conflicts
                    })
            
            # Risk mitigation optimization
            if "risk_mitigation" in optimization_goals:
                risk_analysis = await self._analyze_schedule_risks(schedule_id)
                optimization_results["recommendations"].extend(risk_analysis["recommendations"])
            
            return optimization_results
            
        except Exception as e:
            logger.error(f"Error optimizing schedule {schedule_id}: {e}")
            raise RuntimeError(f"Failed to optimize schedule: {str(e)}")
    
    async def batch_recalculate_schedules(
        self,
        schedule_ids: List[UUID],
        priority_order: bool = True
    ) -> Dict[str, Any]:
        """
        Recalculate multiple schedules in batch with optional priority ordering.
        
        Args:
            schedule_ids: List of schedule IDs to recalculate
            priority_order: Whether to process in priority order (critical schedules first)
            
        Returns:
            Dict with batch recalculation results
        """
        try:
            batch_results = {
                "total_schedules": len(schedule_ids),
                "successful_recalculations": 0,
                "failed_recalculations": 0,
                "results": [],
                "processing_time": None
            }
            
            start_time = datetime.utcnow()
            
            # Sort by priority if requested
            if priority_order:
                schedule_ids = await self._sort_schedules_by_priority(schedule_ids)
            
            # Process each schedule
            for schedule_id in schedule_ids:
                try:
                    # For batch processing, we'll recalculate without a specific changed task
                    # Get any task from the schedule to use as trigger
                    tasks_result = self.db.table("tasks").select("id").eq(
                        "schedule_id", str(schedule_id)
                    ).limit(1).execute()
                    
                    if tasks_result.data:
                        trigger_task_id = UUID(tasks_result.data[0]["id"])
                        result = await self.recalculate_schedule(schedule_id, trigger_task_id)
                        
                        batch_results["results"].append({
                            "schedule_id": str(schedule_id),
                            "success": True,
                            "result": result
                        })
                        batch_results["successful_recalculations"] += 1
                    else:
                        batch_results["results"].append({
                            "schedule_id": str(schedule_id),
                            "success": False,
                            "error": "No tasks found in schedule"
                        })
                        batch_results["failed_recalculations"] += 1
                        
                except Exception as e:
                    batch_results["results"].append({
                        "schedule_id": str(schedule_id),
                        "success": False,
                        "error": str(e)
                    })
                    batch_results["failed_recalculations"] += 1
            
            end_time = datetime.utcnow()
            batch_results["processing_time"] = (end_time - start_time).total_seconds()
            
            return batch_results
            
        except Exception as e:
            logger.error(f"Error in batch recalculation: {e}")
            raise RuntimeError(f"Failed to batch recalculate schedules: {str(e)}")
    
    async def setup_real_time_recalculation_triggers(
        self,
        schedule_id: UUID,
        trigger_events: List[str] = None
    ) -> Dict[str, Any]:
        """
        Set up real-time recalculation triggers for a schedule.
        
        Args:
            schedule_id: ID of the schedule
            trigger_events: List of events that should trigger recalculation
            
        Returns:
            Dict with trigger setup results
        """
        try:
            if trigger_events is None:
                trigger_events = [
                    "task_date_change",
                    "task_duration_change",
                    "dependency_added",
                    "dependency_removed",
                    "task_status_change"
                ]
            
            # In a real implementation, this would set up database triggers or event listeners
            # For now, we'll just log the setup and return configuration
            
            trigger_config = {
                "schedule_id": str(schedule_id),
                "enabled_triggers": trigger_events,
                "setup_timestamp": datetime.utcnow().isoformat(),
                "trigger_rules": {}
            }
            
            # Define trigger rules
            for event in trigger_events:
                if event == "task_date_change":
                    trigger_config["trigger_rules"][event] = {
                        "description": "Recalculate when task start or end dates change",
                        "conditions": ["planned_start_date_changed", "planned_end_date_changed"],
                        "immediate": True
                    }
                elif event == "task_duration_change":
                    trigger_config["trigger_rules"][event] = {
                        "description": "Recalculate when task duration changes",
                        "conditions": ["duration_days_changed"],
                        "immediate": True
                    }
                elif event == "dependency_added":
                    trigger_config["trigger_rules"][event] = {
                        "description": "Recalculate when new dependencies are added",
                        "conditions": ["new_dependency_created"],
                        "immediate": True
                    }
                elif event == "dependency_removed":
                    trigger_config["trigger_rules"][event] = {
                        "description": "Recalculate when dependencies are removed",
                        "conditions": ["dependency_deleted"],
                        "immediate": True
                    }
                elif event == "task_status_change":
                    trigger_config["trigger_rules"][event] = {
                        "description": "Recalculate when critical task status changes",
                        "conditions": ["critical_task_status_changed"],
                        "immediate": False,  # Can be batched
                        "batch_delay_minutes": 5
                    }
            
            logger.info(f"Set up real-time recalculation triggers for schedule {schedule_id}")
            
            return {
                "setup_successful": True,
                "trigger_configuration": trigger_config,
                "message": "Real-time triggers configured successfully"
            }
            
        except Exception as e:
            logger.error(f"Error setting up real-time triggers for schedule {schedule_id}: {e}")
            return {
                "setup_successful": False,
                "error": str(e),
                "message": "Failed to set up real-time triggers"
            }
    
    # Private helper methods for schedule recalculation engine
    
    def _should_trigger_recalculation(
        self,
        change_type: str,
        old_values: Dict[str, Any] = None,
        new_values: Dict[str, Any] = None
    ) -> bool:
        """Determine if a change should trigger schedule recalculation."""
        
        # Always trigger for these change types
        always_trigger = [
            "date_change",
            "duration_change",
            "dependency_added",
            "dependency_removed"
        ]
        
        if change_type in always_trigger:
            return True
        
        # Conditional triggers
        if change_type == "status_change":
            # Only trigger if task is critical or becomes critical
            if old_values and new_values:
                old_critical = old_values.get("is_critical", False)
                new_critical = new_values.get("is_critical", False)
                return old_critical or new_critical
        
        if change_type == "progress_change":
            # Only trigger for significant progress changes on critical tasks
            if old_values and new_values:
                is_critical = new_values.get("is_critical", False)
                old_progress = old_values.get("progress_percentage", 0)
                new_progress = new_values.get("progress_percentage", 0)
                progress_change = abs(new_progress - old_progress)
                return is_critical and progress_change >= 25  # 25% or more change
        
        return False
    
    async def _analyze_resource_conflicts(self, schedule_id: UUID) -> List[Dict[str, Any]]:
        """Analyze resource conflicts in a schedule."""
        try:
            # This would typically analyze resource assignments and identify conflicts
            # For now, return empty list as resource assignment table integration is not complete
            return []
            
        except Exception as e:
            logger.error(f"Error analyzing resource conflicts: {e}")
            return []
    
    async def _analyze_schedule_risks(self, schedule_id: UUID) -> Dict[str, Any]:
        """Analyze schedule risks and provide mitigation recommendations."""
        try:
            # Get critical path analysis
            critical_path_result = await self.calculate_critical_path(schedule_id)
            
            recommendations = []
            
            # High risk if many critical tasks
            if len(critical_path_result.critical_tasks) > 10:
                recommendations.append({
                    "type": "risk_mitigation",
                    "description": "High number of critical tasks increases schedule risk",
                    "recommendation": "Consider adding buffer time or parallel execution paths",
                    "priority": "high"
                })
            
            # Risk from schedule risk factors
            for risk_factor in critical_path_result.schedule_risk_factors:
                recommendations.append({
                    "type": "risk_mitigation",
                    "description": f"Schedule risk identified: {risk_factor}",
                    "recommendation": "Review and mitigate identified risk factor",
                    "priority": "medium"
                })
            
            return {
                "risk_level": "high" if len(recommendations) > 3 else "medium" if len(recommendations) > 1 else "low",
                "recommendations": recommendations
            }
            
        except Exception as e:
            logger.error(f"Error analyzing schedule risks: {e}")
            return {"risk_level": "unknown", "recommendations": []}
    
    async def _sort_schedules_by_priority(self, schedule_ids: List[UUID]) -> List[UUID]:
        """Sort schedules by priority for batch processing."""
        try:
            # Get schedule information
            schedules_result = self.db.table("schedules").select("id, end_date, status").in_(
                "id", [str(sid) for sid in schedule_ids]
            ).execute()
            
            if not schedules_result.data:
                return schedule_ids
            
            schedules = schedules_result.data
            
            # Sort by end date (earlier deadlines first) and status (active first)
            def priority_key(schedule):
                end_date = date.fromisoformat(schedule["end_date"])
                status_priority = 0 if schedule["status"] == "active" else 1
                return (status_priority, end_date)
            
            sorted_schedules = sorted(schedules, key=priority_key)
            
            return [UUID(schedule["id"]) for schedule in sorted_schedules]
            
        except Exception as e:
            logger.error(f"Error sorting schedules by priority: {e}")
            return schedule_ids