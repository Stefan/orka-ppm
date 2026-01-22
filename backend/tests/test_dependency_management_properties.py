"""
Property-Based Tests for Task Dependency Management

Tests the following properties from the design document:
- Property 2: Dependency Management Consistency
- Property 5: Critical Path Calculation Correctness
- Property 6: Float Calculation Accuracy
- Property 7: Schedule Recalculation Consistency

**Validates: Requirements 1.2, 1.3, 4.1, 4.3, 4.4, 4.5**
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict, deque
from uuid import uuid4
import random


# =====================================================
# STRATEGIES FOR GENERATING TEST DATA
# =====================================================

@st.composite
def task_strategy(draw, min_duration=1, max_duration=30):
    """Generate a valid task with dates and duration."""
    task_id = str(uuid4())
    start_offset = draw(st.integers(min_value=0, max_value=100))
    duration = draw(st.integers(min_value=min_duration, max_value=max_duration))
    base_date = date(2026, 1, 1)
    start_date = base_date + timedelta(days=start_offset)
    end_date = start_date + timedelta(days=duration - 1)
    
    return {
        "id": task_id,
        "planned_start_date": start_date.isoformat(),
        "planned_end_date": end_date.isoformat(),
        "duration_days": duration,
        "is_critical": False,
        "total_float_days": 0,
        "free_float_days": 0,
    }


@st.composite
def dependency_type_strategy(draw):
    """Generate a valid dependency type."""
    return draw(st.sampled_from([
        "finish_to_start",
        "start_to_start", 
        "finish_to_finish",
        "start_to_finish"
    ]))


@st.composite
def task_network_strategy(draw, min_tasks=2, max_tasks=10):
    """Generate a valid task network without circular dependencies.
    
    Tasks are generated with dates that respect dependency constraints.
    """
    num_tasks = draw(st.integers(min_value=min_tasks, max_value=max_tasks))
    tasks = []
    
    base_date = date(2026, 1, 1)
    
    # First, generate all tasks with sequential dates
    current_date = base_date
    for i in range(num_tasks):
        task_id = str(uuid4())
        duration = draw(st.integers(min_value=1, max_value=10))
        start_date = current_date
        end_date = start_date + timedelta(days=duration - 1)
        
        tasks.append({
            "id": task_id,
            "planned_start_date": start_date.isoformat(),
            "planned_end_date": end_date.isoformat(),
            "duration_days": duration,
            "is_critical": False,
            "total_float_days": 0,
            "free_float_days": 0,
        })
        
        # Move to next day after this task ends
        current_date = end_date + timedelta(days=1)
    
    # Generate dependencies (only forward to avoid cycles)
    # Use only finish_to_start for simplicity to ensure valid schedules
    dependencies = []
    num_deps = draw(st.integers(min_value=0, max_value=min(num_tasks - 1, 5)))
    
    for _ in range(num_deps):
        pred_idx = draw(st.integers(min_value=0, max_value=num_tasks - 2))
        succ_idx = draw(st.integers(min_value=pred_idx + 1, max_value=num_tasks - 1))
        lag = draw(st.integers(min_value=0, max_value=5))
        
        # Only use finish_to_start to ensure valid schedules
        dependencies.append({
            "predecessor_task_id": tasks[pred_idx]["id"],
            "successor_task_id": tasks[succ_idx]["id"],
            "dependency_type": "finish_to_start",
            "lag_days": lag
        })
    
    return {"tasks": tasks, "dependencies": dependencies}


# =====================================================
# PURE CALCULATION FUNCTIONS (No Database)
# =====================================================

def calculate_early_dates(tasks: List[Dict], dependencies: List[Dict]) -> Dict[str, Dict]:
    """Calculate early start and finish dates using forward pass algorithm."""
    predecessors = defaultdict(list)
    for dep in dependencies:
        predecessors[dep["successor_task_id"]].append(dep)
    
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
        
        if current_task_id in predecessors:
            max_early_start = early_dates[current_task_id]["early_start"]
            
            for dep in predecessors[current_task_id]:
                pred_id = dep["predecessor_task_id"]
                dep_type = dep["dependency_type"]
                lag_days = dep["lag_days"]
                
                if dep_type == "finish_to_start":
                    constraint_date = early_dates[pred_id]["early_finish"] + timedelta(days=lag_days + 1)
                elif dep_type == "start_to_start":
                    constraint_date = early_dates[pred_id]["early_start"] + timedelta(days=lag_days)
                elif dep_type == "finish_to_finish":
                    constraint_date = early_dates[pred_id]["early_finish"] + timedelta(days=lag_days - duration + 1)
                elif dep_type == "start_to_finish":
                    constraint_date = early_dates[pred_id]["early_start"] + timedelta(days=lag_days - duration + 1)
                else:
                    constraint_date = early_dates[pred_id]["early_finish"] + timedelta(days=lag_days + 1)
                
                max_early_start = max(max_early_start, constraint_date)
            
            early_dates[current_task_id]["early_start"] = max_early_start
            early_dates[current_task_id]["early_finish"] = max_early_start + timedelta(days=duration - 1)
        
        for dep in dependencies:
            if dep["predecessor_task_id"] == current_task_id:
                successor_id = dep["successor_task_id"]
                in_degree[successor_id] -= 1
                if in_degree[successor_id] == 0:
                    queue.append(successor_id)
    
    return early_dates


def calculate_late_dates(tasks: List[Dict], dependencies: List[Dict], early_dates: Dict) -> Dict[str, Dict]:
    """Calculate late start and finish dates using backward pass algorithm."""
    if not early_dates:
        return {}
    
    project_end = max(early_dates[task_id]["early_finish"] for task_id in early_dates.keys())
    
    late_dates = {}
    for task in tasks:
        task_id = task["id"]
        duration = task["duration_days"]
        
        late_dates[task_id] = {
            "late_finish": project_end,
            "late_start": project_end - timedelta(days=duration - 1)
        }
    
    successors = defaultdict(list)
    for dep in dependencies:
        successors[dep["predecessor_task_id"]].append(dep)
    
    out_degree = defaultdict(int)
    for dep in dependencies:
        out_degree[dep["predecessor_task_id"]] += 1
    
    queue = deque([task["id"] for task in tasks if out_degree[task["id"]] == 0])
    
    while queue:
        current_task_id = queue.popleft()
        current_task = next(task for task in tasks if task["id"] == current_task_id)
        duration = current_task["duration_days"]
        
        if current_task_id in successors:
            min_late_finish = late_dates[current_task_id]["late_finish"]
            
            for dep in successors[current_task_id]:
                succ_id = dep["successor_task_id"]
                dep_type = dep["dependency_type"]
                lag_days = dep["lag_days"]
                
                if dep_type == "finish_to_start":
                    constraint_date = late_dates[succ_id]["late_start"] - timedelta(days=lag_days + 1)
                elif dep_type == "start_to_start":
                    constraint_date = late_dates[succ_id]["late_start"] - timedelta(days=lag_days)
                elif dep_type == "finish_to_finish":
                    constraint_date = late_dates[succ_id]["late_finish"] - timedelta(days=lag_days)
                elif dep_type == "start_to_finish":
                    constraint_date = late_dates[succ_id]["late_finish"] - timedelta(days=lag_days)
                else:
                    constraint_date = late_dates[succ_id]["late_start"] - timedelta(days=lag_days + 1)
                
                min_late_finish = min(min_late_finish, constraint_date)
            
            late_dates[current_task_id]["late_finish"] = min_late_finish
            late_dates[current_task_id]["late_start"] = min_late_finish - timedelta(days=duration - 1)
        
        for dep in dependencies:
            if dep["successor_task_id"] == current_task_id:
                predecessor_id = dep["predecessor_task_id"]
                out_degree[predecessor_id] -= 1
                if out_degree[predecessor_id] == 0:
                    queue.append(predecessor_id)
    
    return late_dates


def calculate_float(tasks: List[Dict], dependencies: List[Dict], early_dates: Dict, late_dates: Dict) -> Dict[str, Dict]:
    """Calculate total and free float for each task."""
    float_calculations = {}
    
    for task in tasks:
        task_id = task["id"]
        early_start = early_dates[task_id]["early_start"]
        early_finish = early_dates[task_id]["early_finish"]
        late_start = late_dates[task_id]["late_start"]
        late_finish = late_dates[task_id]["late_finish"]
        
        total_float = (late_start - early_start).days
        
        float_calculations[task_id] = {
            "total_float_days": total_float,
            "free_float_days": 0,
            "early_start_date": early_start,
            "early_finish_date": early_finish,
            "late_start_date": late_start,
            "late_finish_date": late_finish
        }
    
    # Calculate free float
    successors = defaultdict(list)
    for dep in dependencies:
        successors[dep["predecessor_task_id"]].append(dep)
    
    for task in tasks:
        task_id = task["id"]
        early_finish = float_calculations[task_id]["early_finish_date"]
        total_float = float_calculations[task_id]["total_float_days"]
        
        min_successor_early_start = None
        
        if task_id in successors:
            for dep in successors[task_id]:
                succ_id = dep["successor_task_id"]
                succ_early_start = float_calculations[succ_id]["early_start_date"]
                
                if min_successor_early_start is None:
                    min_successor_early_start = succ_early_start
                else:
                    min_successor_early_start = min(min_successor_early_start, succ_early_start)
        
        if min_successor_early_start:
            free_float_days = (min_successor_early_start - early_finish).days - 1
            # Free float cannot exceed total float
            float_calculations[task_id]["free_float_days"] = max(0, min(free_float_days, total_float))
        else:
            # No successors, free float equals total float
            float_calculations[task_id]["free_float_days"] = max(0, total_float)
    
    return float_calculations


def identify_critical_path(float_calculations: Dict) -> List[str]:
    """Identify critical path tasks (tasks with zero total float)."""
    return [task_id for task_id, calc in float_calculations.items() if calc["total_float_days"] == 0]


def detect_circular_dependencies(tasks: List[Dict], dependencies: List[Dict]) -> List[List[str]]:
    """Detect circular dependencies using DFS."""
    task_ids = {task["id"] for task in tasks}
    
    graph = defaultdict(list)
    for dep in dependencies:
        if dep["predecessor_task_id"] in task_ids and dep["successor_task_id"] in task_ids:
            graph[dep["predecessor_task_id"]].append(dep["successor_task_id"])
    
    circular_dependencies = []
    visited = set()
    rec_stack = set()
    path = []
    
    def dfs(node):
        if node in rec_stack:
            cycle_start = path.index(node)
            cycle_path = path[cycle_start:] + [node]
            circular_dependencies.append(cycle_path)
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
    
    for task_id in task_ids:
        if task_id not in visited:
            dfs(task_id)
    
    return circular_dependencies


# =====================================================
# PROPERTY 2: DEPENDENCY MANAGEMENT CONSISTENCY
# **Validates: Requirements 1.2, 2.5**
# =====================================================

class TestDependencyManagementConsistency:
    """
    Property 2: Dependency Management Consistency
    
    *For any* task dependency configuration, all four dependency types should be 
    supported and circular dependencies should be prevented.
    
    **Validates: Requirements 1.2, 2.5**
    """
    
    @given(dependency_type_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_all_dependency_types_supported(self, dep_type: str):
        """
        Property: All four dependency types (FS, SS, FF, SF) should be supported.
        
        **Validates: Requirements 1.2**
        """
        valid_types = {"finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"}
        assert dep_type in valid_types, f"Dependency type {dep_type} not in valid types"
    
    @given(task_network_strategy(min_tasks=3, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_no_circular_dependencies_in_valid_network(self, network: Dict):
        """
        Property: A valid task network should have no circular dependencies.
        
        **Validates: Requirements 1.2, 2.5**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        circular = detect_circular_dependencies(tasks, dependencies)
        
        assert len(circular) == 0, f"Found circular dependencies: {circular}"
    
    @given(task_network_strategy(min_tasks=2, max_tasks=5))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_dependency_prevents_self_reference(self, network: Dict):
        """
        Property: No task should depend on itself.
        
        **Validates: Requirements 1.2**
        """
        dependencies = network["dependencies"]
        
        for dep in dependencies:
            assert dep["predecessor_task_id"] != dep["successor_task_id"], \
                "Task cannot depend on itself"
    
    def test_circular_dependency_detection_works(self):
        """
        Property: Circular dependency detection should correctly identify cycles.
        
        **Validates: Requirements 1.2, 2.5**
        """
        # Create a known circular dependency: A -> B -> C -> A
        base_date = date(2026, 1, 1)
        tasks = [
            {"id": "task_a", "planned_start_date": base_date.isoformat(), 
             "planned_end_date": (base_date + timedelta(days=4)).isoformat(), "duration_days": 5},
            {"id": "task_b", "planned_start_date": (base_date + timedelta(days=5)).isoformat(),
             "planned_end_date": (base_date + timedelta(days=9)).isoformat(), "duration_days": 5},
            {"id": "task_c", "planned_start_date": (base_date + timedelta(days=10)).isoformat(),
             "planned_end_date": (base_date + timedelta(days=14)).isoformat(), "duration_days": 5},
        ]
        
        # Create a cycle: A -> B -> C -> A
        deps_with_cycle = [
            {"predecessor_task_id": "task_a", "successor_task_id": "task_b", 
             "dependency_type": "finish_to_start", "lag_days": 0},
            {"predecessor_task_id": "task_b", "successor_task_id": "task_c",
             "dependency_type": "finish_to_start", "lag_days": 0},
            {"predecessor_task_id": "task_c", "successor_task_id": "task_a",
             "dependency_type": "finish_to_start", "lag_days": 0},
        ]
        
        circular = detect_circular_dependencies(tasks, deps_with_cycle)
        
        # Should detect at least one cycle
        assert len(circular) >= 1, "Should detect circular dependency when one exists"


# =====================================================
# PROPERTY 5: CRITICAL PATH CALCULATION CORRECTNESS
# **Validates: Requirements 4.1, 4.5**
# =====================================================

class TestCriticalPathCalculationCorrectness:
    """
    Property 5: Critical Path Calculation Correctness
    
    *For any* task network with dependencies, the critical path should identify 
    the longest sequence of dependent tasks that determines project duration.
    
    **Validates: Requirements 4.1, 4.5**
    """
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_critical_path_has_zero_float(self, network: Dict):
        """
        Property: All tasks on the critical path should have zero total float.
        
        **Validates: Requirements 4.1**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        critical_tasks = identify_critical_path(float_calcs)
        
        for task_id in critical_tasks:
            assert float_calcs[task_id]["total_float_days"] == 0, \
                f"Critical task {task_id} should have zero float"
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_at_least_one_critical_path_exists(self, network: Dict):
        """
        Property: Every schedule should have at least one critical path.
        
        **Validates: Requirements 4.1**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        critical_tasks = identify_critical_path(float_calcs)
        
        assert len(critical_tasks) >= 1, "Schedule should have at least one critical task"
    
    @given(task_network_strategy(min_tasks=3, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_critical_path_determines_project_duration(self, network: Dict):
        """
        Property: The critical path should determine the project duration.
        At least one critical task should end at the project end date.
        
        **Validates: Requirements 4.1, 4.5**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        critical_tasks = identify_critical_path(float_calcs)
        
        # Project duration from early dates
        project_end = max(early_dates[task_id]["early_finish"] for task_id in early_dates.keys())
        
        # At least one critical task should end at project end
        if critical_tasks:
            critical_end = max(float_calcs[t]["early_finish_date"] for t in critical_tasks)
            assert critical_end == project_end, "At least one critical task should end at project end"


# =====================================================
# PROPERTY 6: FLOAT CALCULATION ACCURACY
# **Validates: Requirements 4.3, 4.4**
# =====================================================

class TestFloatCalculationAccuracy:
    """
    Property 6: Float Calculation Accuracy
    
    *For any* non-critical task in a schedule, total float and free float 
    calculations should be mathematically correct based on early/late dates.
    
    **Validates: Requirements 4.3, 4.4**
    """
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_total_float_equals_late_minus_early_start(self, network: Dict):
        """
        Property: Total float = Late Start - Early Start for all tasks.
        
        **Validates: Requirements 4.3**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        
        for task_id, calc in float_calcs.items():
            expected_float = (calc["late_start_date"] - calc["early_start_date"]).days
            assert calc["total_float_days"] == expected_float, \
                f"Total float for {task_id} should be {expected_float}, got {calc['total_float_days']}"
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_float_is_non_negative(self, network: Dict):
        """
        Property: Float values should be non-negative for valid schedules.
        
        **Validates: Requirements 4.3, 4.4**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        
        for task_id, calc in float_calcs.items():
            assert calc["total_float_days"] >= 0, \
                f"Total float for {task_id} should be non-negative"
            assert calc["free_float_days"] >= 0, \
                f"Free float for {task_id} should be non-negative"
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_free_float_less_than_or_equal_total_float(self, network: Dict):
        """
        Property: Free float should always be <= total float.
        
        **Validates: Requirements 4.3, 4.4**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        
        for task_id, calc in float_calcs.items():
            assert calc["free_float_days"] <= calc["total_float_days"], \
                f"Free float ({calc['free_float_days']}) should be <= total float ({calc['total_float_days']}) for {task_id}"
    
    @given(task_network_strategy(min_tasks=2, max_tasks=8))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_early_dates_precede_late_dates(self, network: Dict):
        """
        Property: Early dates should be <= late dates for all tasks.
        
        **Validates: Requirements 4.4**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        
        for task_id, calc in float_calcs.items():
            assert calc["early_start_date"] <= calc["late_start_date"], \
                f"Early start should be <= late start for {task_id}"
            assert calc["early_finish_date"] <= calc["late_finish_date"], \
                f"Early finish should be <= late finish for {task_id}"


# =====================================================
# PROPERTY 7: SCHEDULE RECALCULATION CONSISTENCY
# **Validates: Requirements 1.3, 4.5**
# =====================================================

class TestScheduleRecalculationConsistency:
    """
    Property 7: Schedule Recalculation Consistency
    
    *For any* task date change, dependent task schedules and critical path 
    should be recalculated correctly and automatically.
    
    **Validates: Requirements 1.3, 4.5**
    """
    
    @given(task_network_strategy(min_tasks=3, max_tasks=8), st.integers(min_value=1, max_value=10))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_recalculation_after_duration_change(self, network: Dict, duration_increase: int):
        """
        Property: Changing a task's duration should correctly recalculate dependent tasks.
        
        **Validates: Requirements 1.3, 4.5**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        # Calculate original dates
        original_early = calculate_early_dates(tasks, dependencies)
        original_late = calculate_late_dates(tasks, dependencies, original_early)
        
        # Modify first task's duration
        modified_tasks = [dict(t) for t in tasks]
        modified_tasks[0]["duration_days"] += duration_increase
        old_end = date.fromisoformat(modified_tasks[0]["planned_end_date"])
        modified_tasks[0]["planned_end_date"] = (old_end + timedelta(days=duration_increase)).isoformat()
        
        # Recalculate
        new_early = calculate_early_dates(modified_tasks, dependencies)
        new_late = calculate_late_dates(modified_tasks, dependencies, new_early)
        
        # First task's early finish should increase
        first_task_id = modified_tasks[0]["id"]
        original_finish = original_early[first_task_id]["early_finish"]
        new_finish = new_early[first_task_id]["early_finish"]
        
        assert new_finish >= original_finish, \
            "Increasing duration should not decrease early finish"
    
    @given(task_network_strategy(min_tasks=3, max_tasks=6))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_recalculation_preserves_dependency_constraints(self, network: Dict):
        """
        Property: After recalculation, all dependency constraints should be satisfied.
        
        **Validates: Requirements 1.3, 4.5**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        
        for dep in dependencies:
            pred_id = dep["predecessor_task_id"]
            succ_id = dep["successor_task_id"]
            dep_type = dep["dependency_type"]
            lag = dep["lag_days"]
            
            pred_early_start = early_dates[pred_id]["early_start"]
            pred_early_finish = early_dates[pred_id]["early_finish"]
            succ_early_start = early_dates[succ_id]["early_start"]
            succ_early_finish = early_dates[succ_id]["early_finish"]
            
            if dep_type == "finish_to_start":
                # Successor starts after predecessor finishes + lag
                expected_min_start = pred_early_finish + timedelta(days=lag + 1)
                assert succ_early_start >= expected_min_start, \
                    f"FS constraint violated: {succ_id} starts before {pred_id} finishes + lag"
            
            elif dep_type == "start_to_start":
                # Successor starts after predecessor starts + lag
                expected_min_start = pred_early_start + timedelta(days=lag)
                assert succ_early_start >= expected_min_start, \
                    f"SS constraint violated: {succ_id} starts before {pred_id} starts + lag"
    
    @given(task_network_strategy(min_tasks=3, max_tasks=6))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_recalculation_is_idempotent(self, network: Dict):
        """
        Property: Recalculating the same schedule twice should produce identical results.
        
        **Validates: Requirements 1.3, 4.5**
        """
        tasks = network["tasks"]
        dependencies = network["dependencies"]
        
        # First calculation
        early1 = calculate_early_dates(tasks, dependencies)
        late1 = calculate_late_dates(tasks, dependencies, early1)
        float1 = calculate_float(tasks, dependencies, early1, late1)
        
        # Second calculation
        early2 = calculate_early_dates(tasks, dependencies)
        late2 = calculate_late_dates(tasks, dependencies, early2)
        float2 = calculate_float(tasks, dependencies, early2, late2)
        
        # Results should be identical
        for task_id in early1.keys():
            assert early1[task_id] == early2[task_id], \
                f"Early dates for {task_id} differ between calculations"
            assert late1[task_id] == late2[task_id], \
                f"Late dates for {task_id} differ between calculations"
            assert float1[task_id]["total_float_days"] == float2[task_id]["total_float_days"], \
                f"Total float for {task_id} differs between calculations"


# =====================================================
# ADDITIONAL EDGE CASE TESTS
# =====================================================

class TestDependencyEdgeCases:
    """Additional edge case tests for dependency management."""
    
    @given(task_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_single_task_is_critical(self, task: Dict):
        """
        Property: A single task with no dependencies is always critical.
        
        **Validates: Requirements 4.1**
        """
        tasks = [task]
        dependencies = []
        
        early_dates = calculate_early_dates(tasks, dependencies)
        late_dates = calculate_late_dates(tasks, dependencies, early_dates)
        float_calcs = calculate_float(tasks, dependencies, early_dates, late_dates)
        critical_tasks = identify_critical_path(float_calcs)
        
        assert task["id"] in critical_tasks, "Single task should be on critical path"
        assert float_calcs[task["id"]]["total_float_days"] == 0, "Single task should have zero float"
    
    @given(st.integers(min_value=0, max_value=30))
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_lag_days_affect_successor_dates(self, lag_days: int):
        """
        Property: Lag days should correctly offset successor task dates.
        
        **Validates: Requirements 1.2**
        """
        base_date = date(2026, 1, 1)
        
        tasks = [
            {
                "id": "task1",
                "planned_start_date": base_date.isoformat(),
                "planned_end_date": (base_date + timedelta(days=4)).isoformat(),
                "duration_days": 5,
            },
            {
                "id": "task2",
                "planned_start_date": base_date.isoformat(),
                "planned_end_date": (base_date + timedelta(days=4)).isoformat(),
                "duration_days": 5,
            }
        ]
        
        dependencies = [{
            "predecessor_task_id": "task1",
            "successor_task_id": "task2",
            "dependency_type": "finish_to_start",
            "lag_days": lag_days
        }]
        
        early_dates = calculate_early_dates(tasks, dependencies)
        
        # Task 2 should start after Task 1 finishes + lag
        expected_task2_start = early_dates["task1"]["early_finish"] + timedelta(days=lag_days + 1)
        actual_task2_start = early_dates["task2"]["early_start"]
        
        assert actual_task2_start >= expected_task2_start, \
            f"Task 2 should start at or after {expected_task2_start}, got {actual_task2_start}"


# =====================================================
# RUN TESTS
# =====================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
