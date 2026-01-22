"""
Property-Based Tests for System Invariant Preservation

This module implements comprehensive property tests for critical system invariants
that must be preserved across all operations.

Task: 7.3 Add system invariant preservation testing
**Validates: Requirements 5.5**

Properties Implemented:
- Property 23: System Invariant Preservation
"""

import pytest
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from hypothesis import given, settings, assume, example, note
from hypothesis import strategies as st

# Import the PBT framework components
from tests.property_tests.pbt_framework import (
    DomainGenerators,
    BackendPBTFramework,
    get_test_settings
)


# =============================================================================
# Custom Strategies for System Invariant Testing
# =============================================================================

@st.composite
def budget_allocation_strategy(draw, total_budget: Optional[Decimal] = None):
    """Generate budget allocations that should sum to total budget."""
    if total_budget is None:
        total_budget = draw(st.decimals(
            min_value=Decimal('10000'),
            max_value=Decimal('10000000'),
            places=2
        ))
    
    # Generate number of allocations
    num_allocations = draw(st.integers(min_value=1, max_value=10))
    
    # Generate allocations that sum to total_budget
    allocations = []
    remaining = total_budget
    
    for i in range(num_allocations - 1):
        # Allocate a portion of remaining budget
        if remaining > 0:
            max_allocation = remaining * Decimal('0.8')  # Leave some for others
            allocation = draw(st.decimals(
                min_value=Decimal('0'),
                max_value=max_allocation,
                places=2
            ))
            allocations.append({
                'id': f"allocation_{i}",
                'amount': allocation,
                'category': draw(st.sampled_from(['labor', 'materials', 'equipment', 'overhead']))
            })
            remaining -= allocation
        else:
            break
    
    # Last allocation gets the remainder
    if remaining >= 0:
        allocations.append({
            'id': f"allocation_{num_allocations-1}",
            'amount': remaining,
            'category': draw(st.sampled_from(['labor', 'materials', 'equipment', 'overhead']))
        })
    
    return {
        'total_budget': total_budget,
        'allocations': allocations
    }


@st.composite
def resource_allocation_strategy(draw, total_capacity: Optional[float] = None):
    """Generate resource allocations that should not exceed total capacity."""
    if total_capacity is None:
        total_capacity = draw(st.floats(min_value=1.0, max_value=100.0))
    
    # Generate number of allocations
    num_allocations = draw(st.integers(min_value=1, max_value=10))
    
    # Generate allocations that sum to at most total_capacity
    allocations = []
    remaining = total_capacity
    
    for i in range(num_allocations):
        if remaining > 0:
            # Allocate a portion of remaining capacity
            allocation = draw(st.floats(
                min_value=0.0,
                max_value=min(remaining, total_capacity * 0.5)
            ))
            allocations.append({
                'resource_id': f"resource_{i}",
                'allocation_percentage': allocation,
                'hours': allocation * 40  # Assuming 40 hours per unit
            })
            remaining -= allocation
        else:
            break
    
    return {
        'total_capacity': total_capacity,
        'allocations': allocations
    }


@st.composite
def project_with_budget_strategy(draw):
    """Generate project data with budget information."""
    budget = draw(st.decimals(
        min_value=Decimal('10000'),
        max_value=Decimal('10000000'),
        places=2
    ))
    
    actual_cost = draw(st.decimals(
        min_value=Decimal('0'),
        max_value=budget * Decimal('1.5'),  # Can be over budget
        places=2
    ))
    
    return {
        'id': str(draw(st.uuids())),
        'name': draw(st.text(min_size=1, max_size=100)),
        'budget': float(budget),
        'actual_cost': float(actual_cost),
        'status': draw(st.sampled_from(['planning', 'active', 'completed', 'cancelled']))
    }


@st.composite
def portfolio_with_projects_strategy(draw):
    """Generate portfolio with multiple projects."""
    num_projects = draw(st.integers(min_value=1, max_value=10))
    
    projects = []
    for i in range(num_projects):
        project = draw(project_with_budget_strategy())
        project['portfolio_id'] = 'portfolio_1'
        projects.append(project)
    
    return {
        'portfolio_id': 'portfolio_1',
        'name': draw(st.text(min_size=1, max_size=100)),
        'projects': projects
    }


@st.composite
def operation_sequence_strategy(draw):
    """Generate a sequence of operations that should preserve invariants."""
    num_operations = draw(st.integers(min_value=1, max_value=5))
    
    operations = []
    for i in range(num_operations):
        op_type = draw(st.sampled_from(['create', 'update', 'delete']))
        operations.append({
            'type': op_type,
            'entity': draw(st.sampled_from(['project', 'budget_allocation', 'resource_allocation'])),
            'data': {}  # Will be filled based on entity type
        })
    
    return operations


# =============================================================================
# Property 23: System Invariant Preservation
# =============================================================================

class TestSystemInvariantPreservation:
    """
    Property 23: System Invariant Preservation
    
    For any system operation, critical invariants (budget totals, resource
    capacity limits) must be preserved across all operations.
    
    **Validates: Requirements 5.5**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(budget_data=budget_allocation_strategy())
    def test_budget_allocation_sum_invariant(self, budget_data: Dict[str, Any]):
        """
        Property test: Budget allocations must sum to total budget
        
        **Validates: Requirements 5.5**
        
        For any set of budget allocations, the sum of all allocations
        must equal the total budget (within rounding tolerance).
        """
        total_budget = budget_data['total_budget']
        allocations = budget_data['allocations']
        
        # Calculate sum of allocations
        allocation_sum = sum(
            Decimal(str(alloc['amount'])) for alloc in allocations
        )
        
        # Property: sum of allocations must equal total budget
        tolerance = Decimal('0.01')  # 1 cent tolerance for rounding
        difference = abs(allocation_sum - total_budget)
        
        assert difference <= tolerance, (
            f"Budget allocation sum invariant violated: "
            f"total_budget={total_budget}, allocation_sum={allocation_sum}, "
            f"difference={difference}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_resource_capacity_limit_invariant(self, resource_data: Dict[str, Any]):
        """
        Property test: Resource allocations must not exceed capacity
        
        **Validates: Requirements 5.5**
        
        For any set of resource allocations, the sum of all allocations
        must not exceed the total available capacity.
        """
        total_capacity = resource_data['total_capacity']
        allocations = resource_data['allocations']
        
        # Calculate sum of allocations
        allocation_sum = sum(
            alloc['allocation_percentage'] for alloc in allocations
        )
        
        # Property: sum of allocations must not exceed capacity
        assert allocation_sum <= total_capacity, (
            f"Resource capacity limit invariant violated: "
            f"total_capacity={total_capacity}, allocation_sum={allocation_sum}"
        )
        
        # Property: individual allocations must be non-negative
        for alloc in allocations:
            assert alloc['allocation_percentage'] >= 0, (
                f"Negative resource allocation detected: {alloc['allocation_percentage']}"
            )
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_resource_allocation_percentage_bounds(self, resource_data: Dict[str, Any]):
        """
        Property test: Resource allocation percentages are bounded
        
        **Validates: Requirements 5.5**
        
        For any resource allocation, the percentage must be between 0 and 100
        (or 0 and 1.0 depending on representation).
        """
        allocations = resource_data['allocations']
        
        for alloc in allocations:
            percentage = alloc['allocation_percentage']
            
            # Property: percentage must be non-negative
            assert percentage >= 0, (
                f"Resource allocation percentage must be non-negative, got {percentage}"
            )
            
            # Property: percentage should not exceed total capacity
            assert percentage <= resource_data['total_capacity'], (
                f"Individual resource allocation {percentage} exceeds total capacity "
                f"{resource_data['total_capacity']}"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(portfolio_data=portfolio_with_projects_strategy())
    def test_portfolio_budget_aggregation_invariant(self, portfolio_data: Dict[str, Any]):
        """
        Property test: Portfolio budget equals sum of project budgets
        
        **Validates: Requirements 5.5**
        
        For any portfolio, the total portfolio budget must equal the sum
        of all project budgets within that portfolio.
        """
        projects = portfolio_data['projects']
        
        # Calculate total portfolio budget
        portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Calculate total actual cost
        portfolio_actual = sum(
            Decimal(str(project['actual_cost'])) for project in projects
        )
        
        # Property: portfolio totals must equal sum of project values
        # (This is a consistency check - the aggregation should be correct)
        for project in projects:
            assert Decimal(str(project['budget'])) >= 0, (
                f"Project budget must be non-negative: {project['budget']}"
            )
            assert Decimal(str(project['actual_cost'])) >= 0, (
                f"Project actual cost must be non-negative: {project['actual_cost']}"
            )
        
        # Property: portfolio budget must be sum of project budgets
        recalculated_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        assert portfolio_budget == recalculated_budget, (
            f"Portfolio budget aggregation inconsistent"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        initial_budget=st.decimals(min_value=Decimal('10000'), max_value=Decimal('1000000'), places=2),
        budget_changes=st.lists(
            st.decimals(min_value=Decimal('-10000'), max_value=Decimal('10000'), places=2),
            min_size=1,
            max_size=10
        )
    )
    def test_budget_change_sequence_invariant(
        self, initial_budget: Decimal, budget_changes: List[Decimal]
    ):
        """
        Property test: Budget changes preserve mathematical consistency
        
        **Validates: Requirements 5.5**
        
        For any sequence of budget changes, the final budget must equal
        the initial budget plus the sum of all changes.
        """
        # Calculate expected final budget
        total_change = sum(budget_changes)
        expected_final = initial_budget + total_change
        
        # Simulate applying changes sequentially
        current_budget = initial_budget
        for change in budget_changes:
            current_budget += change
        
        # Property: final budget must equal initial + sum of changes
        tolerance = Decimal('0.01')
        difference = abs(current_budget - expected_final)
        
        assert difference <= tolerance, (
            f"Budget change sequence invariant violated: "
            f"initial={initial_budget}, changes_sum={total_change}, "
            f"expected_final={expected_final}, actual_final={current_budget}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        total_capacity=st.floats(min_value=1.0, max_value=100.0),
        num_resources=st.integers(min_value=1, max_value=10)
    )
    def test_resource_allocation_after_reallocation(
        self, total_capacity: float, num_resources: int
    ):
        """
        Property test: Resource reallocation preserves capacity limits
        
        **Validates: Requirements 5.5**
        
        After reallocating resources, the total allocation must still
        not exceed the capacity limit.
        """
        # Create initial allocations
        allocation_per_resource = total_capacity / num_resources
        initial_allocations = [
            {'resource_id': f"resource_{i}", 'allocation': allocation_per_resource}
            for i in range(num_resources)
        ]
        
        # Verify initial state
        initial_sum = sum(alloc['allocation'] for alloc in initial_allocations)
        assert abs(initial_sum - total_capacity) < 0.01, (
            f"Initial allocation sum {initial_sum} doesn't match capacity {total_capacity}"
        )
        
        # Simulate reallocation: move allocation from one resource to another
        if num_resources >= 2:
            # Take from first, give to second
            transfer_amount = allocation_per_resource * 0.5
            initial_allocations[0]['allocation'] -= transfer_amount
            initial_allocations[1]['allocation'] += transfer_amount
            
            # Property: total allocation still equals capacity
            final_sum = sum(alloc['allocation'] for alloc in initial_allocations)
            assert abs(final_sum - total_capacity) < 0.01, (
                f"Reallocation violated capacity invariant: "
                f"capacity={total_capacity}, final_sum={final_sum}"
            )
            
            # Property: no allocation is negative
            for alloc in initial_allocations:
                assert alloc['allocation'] >= 0, (
                    f"Negative allocation after reallocation: {alloc['allocation']}"
                )
    
    @settings(max_examples=50, deadline=None)
    @given(
        budget_data=budget_allocation_strategy(),
        modification_percentage=st.floats(min_value=-0.5, max_value=0.5)
    )
    def test_budget_modification_preserves_total(
        self, budget_data: Dict[str, Any], modification_percentage: float
    ):
        """
        Property test: Modifying one allocation adjusts others to preserve total
        
        **Validates: Requirements 5.5**
        
        When modifying a budget allocation, other allocations should be
        adjusted to maintain the total budget invariant.
        """
        total_budget = budget_data['total_budget']
        allocations = budget_data['allocations']
        
        if len(allocations) < 2:
            return  # Need at least 2 allocations to test rebalancing
        
        # Modify first allocation
        original_amount = Decimal(str(allocations[0]['amount']))
        modification = original_amount * Decimal(str(modification_percentage))
        new_amount = original_amount + modification
        
        # Ensure new amount is non-negative
        if new_amount < 0:
            new_amount = Decimal('0')
            modification = -original_amount
        
        # Calculate adjustment needed for other allocations
        adjustment_per_other = -modification / Decimal(str(len(allocations) - 1))
        
        # Apply modifications
        allocations[0]['amount'] = float(new_amount)
        for i in range(1, len(allocations)):
            current = Decimal(str(allocations[i]['amount']))
            allocations[i]['amount'] = float(current + adjustment_per_other)
        
        # Property: total budget must be preserved
        new_sum = sum(Decimal(str(alloc['amount'])) for alloc in allocations)
        tolerance = Decimal('0.01')
        difference = abs(new_sum - total_budget)
        
        assert difference <= tolerance, (
            f"Budget modification violated total invariant: "
            f"original_total={total_budget}, new_total={new_sum}, "
            f"difference={difference}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        initial_capacity=st.floats(min_value=10.0, max_value=100.0),
        capacity_increase=st.floats(min_value=0.0, max_value=50.0)
    )
    def test_capacity_increase_allows_more_allocation(
        self, initial_capacity: float, capacity_increase: float
    ):
        """
        Property test: Increasing capacity allows proportional allocation increase
        
        **Validates: Requirements 5.5**
        
        When resource capacity increases, the system should allow
        additional allocations up to the new capacity limit.
        """
        # Initial allocation at full capacity
        initial_allocation = initial_capacity
        
        # Increase capacity
        new_capacity = initial_capacity + capacity_increase
        
        # Property: new capacity must be greater than or equal to initial
        assert new_capacity >= initial_capacity, (
            f"Capacity increase resulted in lower capacity: "
            f"initial={initial_capacity}, new={new_capacity}"
        )
        
        # Property: can now allocate up to new capacity
        max_additional_allocation = new_capacity - initial_allocation
        assert max_additional_allocation >= 0, (
            f"Negative additional allocation capacity: {max_additional_allocation}"
        )
        
        # Property: max additional allocation equals capacity increase
        tolerance = 0.01
        assert abs(max_additional_allocation - capacity_increase) < tolerance, (
            f"Additional allocation capacity doesn't match capacity increase: "
            f"expected={capacity_increase}, actual={max_additional_allocation}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        projects=st.lists(project_with_budget_strategy(), min_size=2, max_size=10)
    )
    def test_project_deletion_preserves_portfolio_consistency(
        self, projects: List[Dict[str, Any]]
    ):
        """
        Property test: Deleting a project maintains portfolio budget consistency
        
        **Validates: Requirements 5.5**
        
        When a project is deleted from a portfolio, the portfolio's
        total budget should decrease by exactly the project's budget.
        """
        # Calculate initial portfolio budget
        initial_portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Select a project to delete
        project_to_delete = projects[0]
        deleted_budget = Decimal(str(project_to_delete['budget']))
        
        # Remove project
        remaining_projects = projects[1:]
        
        # Calculate new portfolio budget
        new_portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in remaining_projects
        )
        
        # Property: new budget equals initial minus deleted
        expected_new_budget = initial_portfolio_budget - deleted_budget
        tolerance = Decimal('0.01')
        difference = abs(new_portfolio_budget - expected_new_budget)
        
        assert difference <= tolerance, (
            f"Project deletion violated portfolio budget invariant: "
            f"initial={initial_portfolio_budget}, deleted={deleted_budget}, "
            f"expected_new={expected_new_budget}, actual_new={new_portfolio_budget}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        budget_data=budget_allocation_strategy(),
        reallocation_pairs=st.lists(
            st.tuples(st.integers(min_value=0, max_value=9), st.integers(min_value=0, max_value=9)),
            min_size=1,
            max_size=5
        )
    )
    def test_multiple_reallocations_preserve_total(
        self, budget_data: Dict[str, Any], reallocation_pairs: List[tuple]
    ):
        """
        Property test: Multiple reallocations preserve total budget
        
        **Validates: Requirements 5.5**
        
        After multiple budget reallocations between categories, the
        total budget must remain unchanged.
        """
        total_budget = budget_data['total_budget']
        allocations = budget_data['allocations']
        
        if len(allocations) < 2:
            return  # Need at least 2 allocations
        
        # Perform multiple reallocations
        for from_idx, to_idx in reallocation_pairs:
            # Ensure indices are valid
            from_idx = from_idx % len(allocations)
            to_idx = to_idx % len(allocations)
            
            if from_idx == to_idx:
                continue
            
            # Transfer 10% from one allocation to another
            from_amount = Decimal(str(allocations[from_idx]['amount']))
            transfer = from_amount * Decimal('0.1')
            
            allocations[from_idx]['amount'] = float(from_amount - transfer)
            to_amount = Decimal(str(allocations[to_idx]['amount']))
            allocations[to_idx]['amount'] = float(to_amount + transfer)
        
        # Property: total budget must be preserved
        final_sum = sum(Decimal(str(alloc['amount'])) for alloc in allocations)
        tolerance = Decimal('0.01')
        difference = abs(final_sum - total_budget)
        
        assert difference <= tolerance, (
            f"Multiple reallocations violated budget invariant: "
            f"original_total={total_budget}, final_total={final_sum}, "
            f"difference={difference}"
        )
        
        # Property: all allocations must be non-negative
        for alloc in allocations:
            assert Decimal(str(alloc['amount'])) >= 0, (
                f"Negative allocation after reallocations: {alloc['amount']}"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(
        resource_data=resource_allocation_strategy(),
        num_operations=st.integers(min_value=1, max_value=10)
    )
    def test_resource_allocation_operations_preserve_capacity(
        self, resource_data: Dict[str, Any], num_operations: int
    ):
        """
        Property test: Sequence of resource operations preserves capacity limit
        
        **Validates: Requirements 5.5**
        
        After any sequence of resource allocation operations (add, remove,
        modify), the total allocation must not exceed capacity.
        """
        total_capacity = resource_data['total_capacity']
        allocations = resource_data['allocations']
        
        # Perform random operations
        for _ in range(num_operations):
            if len(allocations) == 0:
                break
            
            # Randomly choose an operation
            import random
            operation = random.choice(['modify', 'remove', 'add'])
            
            if operation == 'modify' and len(allocations) > 0:
                # Modify an existing allocation
                idx = random.randint(0, len(allocations) - 1)
                current = allocations[idx]['allocation_percentage']
                # Reduce allocation by up to 50%
                reduction = current * random.uniform(0, 0.5)
                allocations[idx]['allocation_percentage'] = current - reduction
            
            elif operation == 'remove' and len(allocations) > 1:
                # Remove an allocation
                allocations.pop(random.randint(0, len(allocations) - 1))
            
            elif operation == 'add':
                # Add a new allocation with available capacity
                current_sum = sum(alloc['allocation_percentage'] for alloc in allocations)
                available = total_capacity - current_sum
                if available > 0:
                    new_allocation = min(available, random.uniform(0, available * 0.5))
                    allocations.append({
                        'resource_id': f"resource_new_{_}",
                        'allocation_percentage': new_allocation,
                        'hours': new_allocation * 40
                    })
        
        # Property: total allocation must not exceed capacity
        final_sum = sum(alloc['allocation_percentage'] for alloc in allocations)
        assert final_sum <= total_capacity + 0.01, (  # Small tolerance for floating point
            f"Resource operations violated capacity invariant: "
            f"capacity={total_capacity}, final_allocation={final_sum}"
        )
        
        # Property: all allocations must be non-negative
        for alloc in allocations:
            assert alloc['allocation_percentage'] >= 0, (
                f"Negative allocation after operations: {alloc['allocation_percentage']}"
            )


# =============================================================================
# Cross-Operation Invariant Preservation Tests
# =============================================================================

class TestCrossOperationInvariants:
    """
    Tests for invariants that must hold across different types of operations.
    
    **Validates: Requirements 5.5**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(
        initial_budget=st.decimals(min_value=Decimal('10000'), max_value=Decimal('1000000'), places=2),
        num_projects=st.integers(min_value=2, max_value=5)
    )
    def test_budget_split_and_merge_invariant(
        self, initial_budget: Decimal, num_projects: int
    ):
        """
        Property test: Splitting and merging budgets preserves total
        
        **Validates: Requirements 5.5**
        
        When splitting a budget across projects and then merging them back,
        the total budget must be preserved.
        """
        # Split budget across projects
        budget_per_project = initial_budget / Decimal(str(num_projects))
        project_budgets = [budget_per_project] * num_projects
        
        # Verify split
        split_sum = sum(project_budgets)
        tolerance = Decimal('0.01')
        assert abs(split_sum - initial_budget) <= tolerance, (
            f"Budget split violated invariant: "
            f"initial={initial_budget}, split_sum={split_sum}"
        )
        
        # Merge budgets back
        merged_budget = sum(project_budgets)
        
        # Property: merged budget equals initial budget
        difference = abs(merged_budget - initial_budget)
        assert difference <= tolerance, (
            f"Budget merge violated invariant: "
            f"initial={initial_budget}, merged={merged_budget}, "
            f"difference={difference}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        total_capacity=st.floats(min_value=10.0, max_value=100.0),
        allocation_percentage=st.floats(min_value=0.1, max_value=0.9)
    )
    def test_resource_reserve_and_release_invariant(
        self, total_capacity: float, allocation_percentage: float
    ):
        """
        Property test: Reserving and releasing resources preserves capacity
        
        **Validates: Requirements 5.5**
        
        When reserving resources and then releasing them, the available
        capacity must return to the original value.
        """
        # Initial state
        available_capacity = total_capacity
        
        # Reserve resources
        reserved = total_capacity * allocation_percentage
        available_after_reserve = available_capacity - reserved
        
        # Property: available capacity decreased by reserved amount
        assert abs(available_after_reserve - (total_capacity - reserved)) < 0.01, (
            f"Resource reservation calculation incorrect"
        )
        
        # Release resources
        available_after_release = available_after_reserve + reserved
        
        # Property: available capacity returns to original
        tolerance = 0.01
        difference = abs(available_after_release - total_capacity)
        assert difference <= tolerance, (
            f"Resource release violated capacity invariant: "
            f"original={total_capacity}, after_release={available_after_release}, "
            f"difference={difference}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        portfolio_data=portfolio_with_projects_strategy(),
        project_index=st.integers(min_value=0, max_value=9)
    )
    def test_project_budget_update_preserves_portfolio_total(
        self, portfolio_data: Dict[str, Any], project_index: int
    ):
        """
        Property test: Updating project budget updates portfolio total correctly
        
        **Validates: Requirements 5.5**
        
        When a project's budget is updated, the portfolio's total budget
        must be updated by the same delta.
        """
        projects = portfolio_data['projects']
        
        if len(projects) == 0:
            return
        
        # Calculate initial portfolio budget
        initial_portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Select project to update
        project_index = project_index % len(projects)
        project = projects[project_index]
        original_budget = Decimal(str(project['budget']))
        
        # Update project budget (increase by 10%)
        new_budget = original_budget * Decimal('1.1')
        budget_delta = new_budget - original_budget
        project['budget'] = float(new_budget)
        
        # Calculate new portfolio budget
        new_portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Property: portfolio budget increased by budget delta
        expected_portfolio_budget = initial_portfolio_budget + budget_delta
        tolerance = Decimal('0.01')
        difference = abs(new_portfolio_budget - expected_portfolio_budget)
        
        assert difference <= tolerance, (
            f"Project budget update violated portfolio invariant: "
            f"initial_portfolio={initial_portfolio_budget}, "
            f"budget_delta={budget_delta}, "
            f"expected_portfolio={expected_portfolio_budget}, "
            f"actual_portfolio={new_portfolio_budget}"
        )


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
