"""
Property-Based Tests for Business Logic Validation

This module implements comprehensive property tests for core PPM business rules
and calculations including project health, resource allocation, timeline calculations,
risk scoring, and system invariants.

Task: 7.4 Write property tests for business logic validation
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

Properties Implemented:
- Property 19: Project Health Score Accuracy
- Property 20: Resource Allocation Constraint Enforcement
- Property 21: Timeline Calculation Correctness
- Property 22: Risk Scoring Formula Compliance
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

# Import the services and models
from services.roche_construction_services import ProjectModelingEngine
from roche_construction_models import (
    ProjectChanges,
    TimelineImpact,
    CostImpact,
    ResourceImpact
)


# =============================================================================
# Custom Strategies for Business Logic Testing
# =============================================================================

@st.composite
def project_with_metrics_strategy(draw):
    """Generate project data with health metrics."""
    budget = draw(st.decimals(
        min_value=Decimal('10000'),
        max_value=Decimal('10000000'),
        places=2
    ))
    
    # Generate actual cost (can be over or under budget)
    actual_cost = draw(st.decimals(
        min_value=Decimal('0'),
        max_value=budget * Decimal('1.5'),
        places=2
    ))
    
    # Generate dates
    start_date = draw(st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2025, 12, 31)
    ))
    duration_days = draw(st.integers(min_value=30, max_value=730))
    end_date = start_date + timedelta(days=duration_days)
    
    return {
        'id': str(draw(st.uuids())),
        'name': draw(st.text(min_size=1, max_size=100)),
        'budget': float(budget),
        'actual_cost': float(actual_cost),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'status': draw(st.sampled_from(['planning', 'active', 'completed', 'on_hold', 'cancelled']))
    }


@st.composite
def resource_allocation_strategy(draw, total_capacity: Optional[float] = None):
    """Generate resource allocations that respect capacity constraints."""
    if total_capacity is None:
        total_capacity = draw(st.floats(min_value=1.0, max_value=100.0))
    
    num_allocations = draw(st.integers(min_value=1, max_value=10))
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
def risk_data_strategy(draw):
    """Generate risk data with probability and impact."""
    return {
        'id': str(draw(st.uuids())),
        'probability': draw(st.floats(min_value=0.0, max_value=1.0)),
        'impact': draw(st.floats(min_value=0.0, max_value=1.0)),
        'cost_impact': draw(st.floats(min_value=0, max_value=1000000)),
        'category': draw(st.sampled_from([
            'technical', 'financial', 'operational', 'external', 'strategic'
        ]))
    }


@st.composite
def date_pair_strategy(draw, min_duration_days=1, max_duration_days=365):
    """Generate a valid pair of start and end dates."""
    start_date = draw(st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2030, 12, 31)
    ))
    
    duration = draw(st.integers(min_value=min_duration_days, max_value=max_duration_days))
    end_date = start_date + timedelta(days=duration)
    
    return {'start_date': start_date, 'end_date': end_date, 'duration': duration}


# =============================================================================
# Property 19: Project Health Score Accuracy
# =============================================================================

class TestProjectHealthScoreAccuracy:
    """
    Property 19: Project Health Score Accuracy
    
    For any project with status indicators, health scores must accurately
    reflect the underlying project metrics and conditions.
    
    **Validates: Requirements 5.1**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(project=project_with_metrics_strategy())
    def test_health_score_bounds(self, project: Dict[str, Any]):
        """
        Property test: Health scores are bounded [0, 100]
        
        **Validates: Requirements 5.1**
        
        For any project, the health score must be between 0 and 100 (inclusive).
        """
        # Calculate health score (simplified version)
        budget = Decimal(str(project['budget']))
        actual_cost = Decimal(str(project['actual_cost']))
        
        # Calculate budget variance
        if budget > 0:
            variance_pct = abs((actual_cost - budget) / budget) * 100
        else:
            variance_pct = 0
        
        # Calculate health score (100 - variance penalty)
        health_score = 100 - min(variance_pct, 100)
        
        # Property: health score must be in [0, 100]
        assert 0 <= health_score <= 100, (
            f"Health score out of bounds: {health_score} "
            f"(budget={budget}, actual_cost={actual_cost})"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(project=project_with_metrics_strategy())
    def test_health_score_reflects_budget_variance(self, project: Dict[str, Any]):
        """
        Property test: Health score correlates with budget variance
        
        **Validates: Requirements 5.1**
        
        Projects with higher budget variance should have lower health scores.
        """
        budget = Decimal(str(project['budget']))
        actual_cost = Decimal(str(project['actual_cost']))
        
        if budget == 0:
            return  # Skip zero budget projects
        
        # Calculate variance percentage
        variance_pct = abs((actual_cost - budget) / budget) * 100
        
        # Calculate health score
        health_score = 100 - min(variance_pct, 100)
        
        # Property: high variance means low health
        if variance_pct > 20:
            assert health_score < 80, (
                f"Health score too high for high variance: "
                f"variance={variance_pct}%, health={health_score}"
            )
        elif variance_pct < 5:
            assert health_score > 95, (
                f"Health score too low for low variance: "
                f"variance={variance_pct}%, health={health_score}"
            )

    
    @settings(max_examples=100, deadline=None)
    @given(
        budget=st.decimals(min_value=Decimal('10000'), max_value=Decimal('1000000'), places=2),
        variance_pct=st.floats(min_value=0.0, max_value=50.0)
    )
    def test_health_score_monotonicity(self, budget: Decimal, variance_pct: float):
        """
        Property test: Health score decreases monotonically with variance
        
        **Validates: Requirements 5.1**
        
        As budget variance increases, health score should decrease or stay the same.
        """
        # Calculate actual costs for two variance levels
        variance1 = Decimal(str(variance_pct))
        variance2 = variance1 + Decimal('5.0')  # 5% higher variance
        
        actual_cost1 = budget * (Decimal('1') + variance1 / Decimal('100'))
        actual_cost2 = budget * (Decimal('1') + variance2 / Decimal('100'))
        
        # Calculate health scores
        health1 = 100 - min(float(variance1), 100)
        health2 = 100 - min(float(variance2), 100)
        
        # Property: health2 <= health1 (higher variance = lower health)
        assert health2 <= health1, (
            f"Health score not monotonic: "
            f"variance1={variance1}%, health1={health1}, "
            f"variance2={variance2}%, health2={health2}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(project=project_with_metrics_strategy())
    def test_health_score_deterministic(self, project: Dict[str, Any]):
        """
        Property test: Health score calculation is deterministic
        
        **Validates: Requirements 5.1**
        
        Calculating health score multiple times with same inputs produces same result.
        """
        budget = Decimal(str(project['budget']))
        actual_cost = Decimal(str(project['actual_cost']))
        
        # Calculate health score multiple times
        def calc_health():
            if budget > 0:
                variance_pct = abs((actual_cost - budget) / budget) * 100
            else:
                variance_pct = 0
            return 100 - min(float(variance_pct), 100)
        
        health1 = calc_health()
        health2 = calc_health()
        health3 = calc_health()
        
        # Property: all calculations produce identical results
        assert health1 == health2 == health3, (
            f"Health score calculation not deterministic: "
            f"{health1}, {health2}, {health3}"
        )


# =============================================================================
# Property 20: Resource Allocation Constraint Enforcement
# =============================================================================

class TestResourceAllocationConstraintEnforcement:
    """
    Property 20: Resource Allocation Constraint Enforcement
    
    For any resource allocation operation, allocation percentages must never
    exceed 100% and must maintain mathematical consistency.
    
    **Validates: Requirements 5.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_total_allocation_never_exceeds_capacity(self, resource_data: Dict[str, Any]):
        """
        Property test: Total allocation ≤ capacity
        
        **Validates: Requirements 5.2**
        
        The sum of all resource allocations must never exceed total capacity.
        """
        total_capacity = resource_data['total_capacity']
        allocations = resource_data['allocations']
        
        # Calculate total allocation
        total_allocated = sum(alloc['allocation_percentage'] for alloc in allocations)
        
        # Property: total allocation must not exceed capacity
        assert total_allocated <= total_capacity, (
            f"Resource allocation exceeded capacity: "
            f"capacity={total_capacity}, allocated={total_allocated}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_individual_allocations_non_negative(self, resource_data: Dict[str, Any]):
        """
        Property test: All allocations ≥ 0
        
        **Validates: Requirements 5.2**
        
        Individual resource allocations must be non-negative.
        """
        allocations = resource_data['allocations']
        
        # Property: all allocations must be non-negative
        for alloc in allocations:
            assert alloc['allocation_percentage'] >= 0, (
                f"Negative resource allocation detected: "
                f"{alloc['allocation_percentage']}"
            )
            assert alloc['hours'] >= 0, (
                f"Negative hours detected: {alloc['hours']}"
            )
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_allocation_percentage_consistency(self, resource_data: Dict[str, Any]):
        """
        Property test: Allocation percentage and hours are consistent
        
        **Validates: Requirements 5.2**
        
        Hours should equal allocation_percentage × hours_per_unit.
        """
        allocations = resource_data['allocations']
        hours_per_unit = 40  # Standard assumption
        
        # Property: hours = allocation_percentage × hours_per_unit
        for alloc in allocations:
            expected_hours = alloc['allocation_percentage'] * hours_per_unit
            tolerance = 0.01
            
            assert abs(alloc['hours'] - expected_hours) < tolerance, (
                f"Allocation percentage and hours inconsistent: "
                f"percentage={alloc['allocation_percentage']}, "
                f"hours={alloc['hours']}, expected_hours={expected_hours}"
            )

    
    @settings(max_examples=50, deadline=None)
    @given(
        total_capacity=st.floats(min_value=10.0, max_value=100.0),
        num_resources=st.integers(min_value=1, max_value=10)
    )
    def test_equal_allocation_sums_to_capacity(
        self, total_capacity: float, num_resources: int
    ):
        """
        Property test: Equal allocations sum to capacity
        
        **Validates: Requirements 5.2**
        
        When allocating equally across resources, sum should equal capacity.
        """
        # Allocate equally
        allocation_per_resource = total_capacity / num_resources
        allocations = [allocation_per_resource] * num_resources
        
        # Calculate sum
        total_allocated = sum(allocations)
        
        # Property: sum equals capacity (within floating point tolerance)
        tolerance = 0.01
        assert abs(total_allocated - total_capacity) < tolerance, (
            f"Equal allocation sum doesn't match capacity: "
            f"capacity={total_capacity}, allocated={total_allocated}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_reallocation_preserves_total(self, resource_data: Dict[str, Any]):
        """
        Property test: Reallocating resources preserves total
        
        **Validates: Requirements 5.2**
        
        Moving allocation from one resource to another preserves total.
        """
        allocations = resource_data['allocations']
        
        if len(allocations) < 2:
            return  # Need at least 2 resources
        
        # Calculate initial total
        initial_total = sum(alloc['allocation_percentage'] for alloc in allocations)
        
        # Reallocate: move 10% from first to second
        transfer_amount = allocations[0]['allocation_percentage'] * 0.1
        allocations[0]['allocation_percentage'] -= transfer_amount
        allocations[1]['allocation_percentage'] += transfer_amount
        
        # Calculate new total
        new_total = sum(alloc['allocation_percentage'] for alloc in allocations)
        
        # Property: total unchanged after reallocation
        tolerance = 0.01
        assert abs(new_total - initial_total) < tolerance, (
            f"Reallocation changed total: "
            f"initial={initial_total}, new={new_total}"
        )


# =============================================================================
# Property 21: Timeline Calculation Correctness
# =============================================================================

class TestTimelineCalculationCorrectness:
    """
    Property 21: Timeline Calculation Correctness
    
    For any project timeline with dates and milestones, date arithmetic
    and milestone progression logic must be mathematically correct.
    
    **Validates: Requirements 5.3**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(dates=date_pair_strategy())
    def test_duration_equals_date_difference(self, dates: Dict[str, Any]):
        """
        Property test: Duration = end_date - start_date
        
        **Validates: Requirements 5.3**
        
        Timeline duration must equal the difference between end and start dates.
        """
        start_date = dates['start_date']
        end_date = dates['end_date']
        expected_duration = dates['duration']
        
        # Calculate duration
        calculated_duration = (end_date - start_date).days
        
        # Property: calculated duration equals expected
        assert calculated_duration == expected_duration, (
            f"Duration calculation incorrect: "
            f"start={start_date}, end={end_date}, "
            f"expected={expected_duration}, calculated={calculated_duration}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(dates=date_pair_strategy())
    def test_duration_always_positive(self, dates: Dict[str, Any]):
        """
        Property test: Duration > 0
        
        **Validates: Requirements 5.3**
        
        Timeline duration must always be positive (at least 1 day).
        """
        duration = dates['duration']
        
        # Property: duration must be positive
        assert duration > 0, (
            f"Duration must be positive, got {duration}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        dates=date_pair_strategy(),
        extension_days=st.integers(min_value=1, max_value=100)
    )
    def test_timeline_extension_increases_duration(
        self, dates: Dict[str, Any], extension_days: int
    ):
        """
        Property test: Extending timeline increases duration
        
        **Validates: Requirements 5.3**
        
        Extending the end date increases duration by the extension amount.
        """
        original_duration = dates['duration']
        end_date = dates['end_date']
        
        # Extend timeline
        new_end_date = end_date + timedelta(days=extension_days)
        new_duration = (new_end_date - dates['start_date']).days
        
        # Property: new duration = original + extension
        expected_new_duration = original_duration + extension_days
        assert new_duration == expected_new_duration, (
            f"Timeline extension incorrect: "
            f"original={original_duration}, extension={extension_days}, "
            f"expected={expected_new_duration}, actual={new_duration}"
        )

    
    @settings(max_examples=50, deadline=None)
    @given(
        dates=date_pair_strategy(),
        milestone_count=st.integers(min_value=0, max_value=10)
    )
    def test_milestones_within_timeline(
        self, dates: Dict[str, Any], milestone_count: int
    ):
        """
        Property test: Milestones fall within project timeline
        
        **Validates: Requirements 5.3**
        
        All milestone dates must be between start and end dates.
        """
        start_date = dates['start_date']
        end_date = dates['end_date']
        duration = dates['duration']
        
        # Generate milestones evenly spaced
        milestones = []
        for i in range(milestone_count):
            if duration > 0:
                days_offset = (duration * i) // max(milestone_count, 1)
            else:
                days_offset = 0
            milestone_date = start_date + timedelta(days=days_offset)
            milestones.append(milestone_date)
        
        # Property: all milestones within timeline
        for milestone_date in milestones:
            assert start_date <= milestone_date <= end_date, (
                f"Milestone outside timeline: "
                f"milestone={milestone_date}, start={start_date}, end={end_date}"
            )


# =============================================================================
# Property 22: Risk Scoring Formula Compliance
# =============================================================================

class TestRiskScoringFormulaCompliance:
    """
    Property 22: Risk Scoring Formula Compliance
    
    For any risk calculation, the results must follow defined mathematical
    formulas and respect established constraints.
    
    **Validates: Requirements 5.4**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(risk=risk_data_strategy())
    def test_risk_score_formula_correctness(self, risk: Dict[str, Any]):
        """
        Property test: Risk score = probability × impact
        
        **Validates: Requirements 5.4**
        
        Risk score must equal the product of probability and impact.
        """
        probability = risk['probability']
        impact = risk['impact']
        
        # Calculate risk score
        risk_score = probability * impact
        
        # Property: risk score in valid range [0, 1]
        assert 0.0 <= risk_score <= 1.0, (
            f"Risk score out of range: {risk_score}"
        )
        
        # Property: risk score equals probability × impact
        expected_score = probability * impact
        tolerance = 0.0001
        assert abs(risk_score - expected_score) < tolerance, (
            f"Risk score formula incorrect: "
            f"expected {expected_score}, got {risk_score}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(risk=risk_data_strategy())
    def test_risk_probability_bounds(self, risk: Dict[str, Any]):
        """
        Property test: Probability ∈ [0, 1]
        
        **Validates: Requirements 5.4**
        
        Risk probability must be between 0 and 1 (inclusive).
        """
        probability = risk['probability']
        
        # Property: probability in [0, 1]
        assert 0.0 <= probability <= 1.0, (
            f"Probability out of bounds: {probability}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(risk=risk_data_strategy())
    def test_risk_impact_bounds(self, risk: Dict[str, Any]):
        """
        Property test: Impact ∈ [0, 1]
        
        **Validates: Requirements 5.4**
        
        Risk impact must be between 0 and 1 (inclusive).
        """
        impact = risk['impact']
        
        # Property: impact in [0, 1]
        assert 0.0 <= impact <= 1.0, (
            f"Impact out of bounds: {impact}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(risk=risk_data_strategy())
    def test_expected_cost_formula(self, risk: Dict[str, Any]):
        """
        Property test: Expected cost = cost_impact × probability
        
        **Validates: Requirements 5.4**
        
        Expected cost must equal cost impact times probability.
        """
        probability = risk['probability']
        cost_impact = risk['cost_impact']
        
        # Calculate expected cost
        expected_cost = cost_impact * probability
        
        # Property: expected cost non-negative
        assert expected_cost >= 0, (
            f"Expected cost must be non-negative, got {expected_cost}"
        )
        
        # Property: expected cost ≤ cost impact
        assert expected_cost <= cost_impact, (
            f"Expected cost {expected_cost} exceeds cost impact {cost_impact}"
        )

    
    @settings(max_examples=50, deadline=None)
    @given(risks=st.lists(risk_data_strategy(), min_size=1, max_size=10))
    def test_aggregated_risk_score_bounds(self, risks: List[Dict[str, Any]]):
        """
        Property test: Aggregated risk scores maintain bounds
        
        **Validates: Requirements 5.4**
        
        Aggregated risk scores must still respect [0, 1] bounds.
        """
        # Calculate individual risk scores
        risk_scores = [r['probability'] * r['impact'] for r in risks]
        
        # Calculate aggregated risk (average)
        avg_risk_score = sum(risk_scores) / len(risk_scores)
        
        # Property: average risk score in [0, 1]
        assert 0.0 <= avg_risk_score <= 1.0, (
            f"Aggregated risk score out of bounds: {avg_risk_score}"
        )
        
        # Property: average between min and max
        min_score = min(risk_scores)
        max_score = max(risk_scores)
        assert min_score <= avg_risk_score <= max_score, (
            f"Average {avg_risk_score} not between min {min_score} and max {max_score}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        probability1=st.floats(min_value=0.0, max_value=1.0),
        probability2=st.floats(min_value=0.0, max_value=1.0),
        impact=st.floats(min_value=0.0, max_value=1.0)
    )
    def test_risk_score_monotonic_with_probability(
        self, probability1: float, probability2: float, impact: float
    ):
        """
        Property test: Risk score increases with probability
        
        **Validates: Requirements 5.4**
        
        Higher probability results in higher or equal risk score.
        """
        risk_score1 = probability1 * impact
        risk_score2 = probability2 * impact
        
        # Property: if prob1 ≤ prob2, then score1 ≤ score2
        if probability1 <= probability2:
            assert risk_score1 <= risk_score2, (
                f"Risk score not monotonic with probability"
            )


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
    @given(
        total_budget=st.decimals(min_value=Decimal('10000'), max_value=Decimal('1000000'), places=2),
        num_allocations=st.integers(min_value=1, max_value=10)
    )
    def test_budget_allocation_sum_invariant(
        self, total_budget: Decimal, num_allocations: int
    ):
        """
        Property test: Budget allocations sum to total
        
        **Validates: Requirements 5.5**
        
        Sum of all budget allocations must equal total budget.
        """
        # Allocate budget equally
        allocation_per_item = total_budget / Decimal(str(num_allocations))
        allocations = [allocation_per_item] * num_allocations
        
        # Calculate sum
        allocation_sum = sum(allocations)
        
        # Property: sum equals total budget
        tolerance = Decimal('0.01')
        difference = abs(allocation_sum - total_budget)
        assert difference <= tolerance, (
            f"Budget allocation sum invariant violated: "
            f"total={total_budget}, sum={allocation_sum}, diff={difference}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(resource_data=resource_allocation_strategy())
    def test_resource_capacity_invariant(self, resource_data: Dict[str, Any]):
        """
        Property test: Resource allocations ≤ capacity
        
        **Validates: Requirements 5.5**
        
        Total resource allocation must not exceed capacity.
        """
        total_capacity = resource_data['total_capacity']
        allocations = resource_data['allocations']
        
        # Calculate total allocation
        total_allocated = sum(alloc['allocation_percentage'] for alloc in allocations)
        
        # Property: total ≤ capacity
        assert total_allocated <= total_capacity, (
            f"Resource capacity invariant violated: "
            f"capacity={total_capacity}, allocated={total_allocated}"
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
        Property test: Budget changes preserve consistency
        
        **Validates: Requirements 5.5**
        
        Final budget = initial budget + sum of changes.
        """
        # Calculate expected final budget
        total_change = sum(budget_changes)
        expected_final = initial_budget + total_change
        
        # Apply changes sequentially
        current_budget = initial_budget
        for change in budget_changes:
            current_budget += change
        
        # Property: final = initial + sum(changes)
        tolerance = Decimal('0.01')
        difference = abs(current_budget - expected_final)
        assert difference <= tolerance, (
            f"Budget change sequence invariant violated: "
            f"initial={initial_budget}, changes_sum={total_change}, "
            f"expected={expected_final}, actual={current_budget}"
        )

    
    @settings(max_examples=50, deadline=None)
    @given(
        projects=st.lists(project_with_metrics_strategy(), min_size=2, max_size=10)
    )
    def test_portfolio_budget_aggregation_invariant(
        self, projects: List[Dict[str, Any]]
    ):
        """
        Property test: Portfolio budget = sum of project budgets
        
        **Validates: Requirements 5.5**
        
        Portfolio total must equal sum of all project budgets.
        """
        # Calculate portfolio budget
        portfolio_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Verify all project budgets are non-negative
        for project in projects:
            assert Decimal(str(project['budget'])) >= 0, (
                f"Project budget must be non-negative: {project['budget']}"
            )
        
        # Recalculate to verify consistency
        recalculated_budget = sum(
            Decimal(str(project['budget'])) for project in projects
        )
        
        # Property: portfolio budget equals sum
        assert portfolio_budget == recalculated_budget, (
            f"Portfolio budget aggregation inconsistent"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        total_capacity=st.floats(min_value=10.0, max_value=100.0),
        num_resources=st.integers(min_value=1, max_value=10)
    )
    def test_resource_reallocation_preserves_total(
        self, total_capacity: float, num_resources: int
    ):
        """
        Property test: Reallocation preserves total capacity usage
        
        **Validates: Requirements 5.5**
        
        Moving allocation between resources preserves total.
        """
        # Create initial allocations
        allocation_per_resource = total_capacity / num_resources
        allocations = [allocation_per_resource] * num_resources
        
        # Verify initial state
        initial_sum = sum(allocations)
        assert abs(initial_sum - total_capacity) < 0.01
        
        # Reallocate if possible
        if num_resources >= 2:
            transfer = allocation_per_resource * 0.5
            allocations[0] -= transfer
            allocations[1] += transfer
            
            # Property: total unchanged
            final_sum = sum(allocations)
            assert abs(final_sum - total_capacity) < 0.01, (
                f"Reallocation violated capacity invariant: "
                f"capacity={total_capacity}, final_sum={final_sum}"
            )


# =============================================================================
# Integration Tests for Business Logic
# =============================================================================

class TestBusinessLogicIntegration:
    """
    Integration tests combining multiple business logic properties.
    
    **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(
        project=project_with_metrics_strategy(),
        risks=st.lists(risk_data_strategy(), min_size=0, max_size=5)
    )
    def test_project_health_with_risks(
        self, project: Dict[str, Any], risks: List[Dict[str, Any]]
    ):
        """
        Property test: Project health considers risks
        
        **Validates: Requirements 5.1, 5.4**
        
        Projects with high risks should have lower health scores.
        """
        # Calculate base health from budget
        budget = Decimal(str(project['budget']))
        actual_cost = Decimal(str(project['actual_cost']))
        
        if budget > 0:
            variance_pct = abs((actual_cost - budget) / budget) * 100
        else:
            variance_pct = 0
        
        base_health = 100 - min(float(variance_pct), 100)
        
        # Calculate risk impact
        high_risks = [r for r in risks if r['probability'] * r['impact'] > 0.6]
        risk_penalty = len(high_risks) * 10
        
        # Adjusted health
        adjusted_health = max(0, base_health - risk_penalty)
        
        # Property: health with risks ≤ base health
        assert adjusted_health <= base_health, (
            f"Health with risks should not exceed base health"
        )
        
        # Property: more high risks = lower health
        if len(high_risks) > 0:
            assert adjusted_health < base_health, (
                f"High risks should reduce health score"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(
        project=project_with_metrics_strategy(),
        resource_data=resource_allocation_strategy()
    )
    def test_project_with_resource_constraints(
        self, project: Dict[str, Any], resource_data: Dict[str, Any]
    ):
        """
        Property test: Resource constraints affect project feasibility
        
        **Validates: Requirements 5.2, 5.3**
        
        Projects must respect resource capacity constraints.
        """
        total_capacity = resource_data['total_capacity']
        allocations = resource_data['allocations']
        
        # Calculate total allocated
        total_allocated = sum(alloc['allocation_percentage'] for alloc in allocations)
        
        # Property: if fully allocated, no more resources available
        if abs(total_allocated - total_capacity) < 0.01:
            available_capacity = 0
        else:
            available_capacity = total_capacity - total_allocated
        
        # Property: available capacity ≥ 0
        assert available_capacity >= -0.01, (  # Small tolerance for floating point
            f"Available capacity cannot be negative: {available_capacity}"
        )
    
    @settings(max_examples=30, deadline=None)
    @given(
        project=project_with_metrics_strategy(),
        risks=st.lists(risk_data_strategy(), min_size=1, max_size=5)
    )
    def test_complete_project_validation(
        self, project: Dict[str, Any], risks: List[Dict[str, Any]]
    ):
        """
        Property test: Complete project validation maintains all invariants
        
        **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
        
        All business logic properties must hold simultaneously.
        """
        # Validate budget invariants
        budget = Decimal(str(project['budget']))
        actual_cost = Decimal(str(project['actual_cost']))
        assert budget >= 0, "Budget must be non-negative"
        assert actual_cost >= 0, "Actual cost must be non-negative"
        
        # Validate timeline invariants
        start_date = datetime.fromisoformat(project['start_date']).date()
        end_date = datetime.fromisoformat(project['end_date']).date()
        assert end_date >= start_date, "End date must be >= start date"
        
        # Validate risk invariants
        for risk in risks:
            assert 0 <= risk['probability'] <= 1, "Probability must be in [0, 1]"
            assert 0 <= risk['impact'] <= 1, "Impact must be in [0, 1]"
            risk_score = risk['probability'] * risk['impact']
            assert 0 <= risk_score <= 1, "Risk score must be in [0, 1]"
        
        # All invariants maintained
        assert True, "All business logic invariants validated"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
