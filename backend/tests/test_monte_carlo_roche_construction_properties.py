"""
Property-Based Tests for Monte Carlo Risk Simulation Engine (Roche Construction PPM Features).

Feature: roche-construction-ppm-features
Property 3: Monte Carlo Statistical Correctness
Property 4: Simulation Performance and Caching

These tests validate that the Monte Carlo simulation engine produces statistically
valid results and meets performance requirements.
"""

import pytest
import numpy as np
from hypothesis import given, settings, strategies as st, assume
from hypothesis import HealthCheck
from datetime import datetime
import time
from typing import List, Dict

from monte_carlo.engine import MonteCarloEngine
from monte_carlo.models import (
    Risk, RiskCategory, ImpactType, ProbabilityDistribution,
    DistributionType, CorrelationMatrix
)


# Strategy for generating valid probability distributions
@st.composite
def probability_distribution_strategy(draw):
    """Generate valid probability distributions for testing."""
    dist_type = draw(st.sampled_from(list(DistributionType)))
    
    if dist_type == DistributionType.NORMAL:
        mean = draw(st.floats(min_value=-1000, max_value=1000, allow_nan=False, allow_infinity=False))
        std = draw(st.floats(min_value=0.1, max_value=500, allow_nan=False, allow_infinity=False))
        return ProbabilityDistribution(
            distribution_type=dist_type,
            parameters={"mean": mean, "std": std}
        )
    
    elif dist_type == DistributionType.TRIANGULAR:
        min_val = draw(st.floats(min_value=-1000, max_value=500, allow_nan=False, allow_infinity=False))
        max_val = draw(st.floats(min_value=min_val + 1, max_value=1000, allow_nan=False, allow_infinity=False))
        mode_val = draw(st.floats(min_value=min_val, max_value=max_val, allow_nan=False, allow_infinity=False))
        return ProbabilityDistribution(
            distribution_type=dist_type,
            parameters={"min": min_val, "mode": mode_val, "max": max_val}
        )
    
    elif dist_type == DistributionType.UNIFORM:
        min_val = draw(st.floats(min_value=-1000, max_value=500, allow_nan=False, allow_infinity=False))
        max_val = draw(st.floats(min_value=min_val + 1, max_value=1000, allow_nan=False, allow_infinity=False))
        return ProbabilityDistribution(
            distribution_type=dist_type,
            parameters={"min": min_val, "max": max_val}
        )
    
    elif dist_type == DistributionType.BETA:
        alpha = draw(st.floats(min_value=0.1, max_value=10, allow_nan=False, allow_infinity=False))
        beta = draw(st.floats(min_value=0.1, max_value=10, allow_nan=False, allow_infinity=False))
        return ProbabilityDistribution(
            distribution_type=dist_type,
            parameters={"alpha": alpha, "beta": beta}
        )
    
    else:  # LOGNORMAL
        mu = draw(st.floats(min_value=-5, max_value=5, allow_nan=False, allow_infinity=False))
        sigma = draw(st.floats(min_value=0.1, max_value=2, allow_nan=False, allow_infinity=False))
        return ProbabilityDistribution(
            distribution_type=dist_type,
            parameters={"mu": mu, "sigma": sigma}
        )


@st.composite
def risk_strategy(draw, risk_id=None):
    """Generate valid Risk objects for testing."""
    if risk_id is None:
        risk_id = f"risk_{draw(st.integers(min_value=1, max_value=10000))}"
    
    name = f"Test Risk {risk_id}"
    category = draw(st.sampled_from(list(RiskCategory)))
    impact_type = draw(st.sampled_from(list(ImpactType)))
    distribution = draw(probability_distribution_strategy())
    baseline_impact = draw(st.floats(min_value=0.1, max_value=1000, allow_nan=False, allow_infinity=False))
    
    return Risk(
        id=risk_id,
        name=name,
        category=category,
        impact_type=impact_type,
        probability_distribution=distribution,
        baseline_impact=baseline_impact,
        correlation_dependencies=[],
        mitigation_strategies=[]
    )


@st.composite
def risk_list_strategy(draw, min_risks=1, max_risks=10):
    """Generate a list of valid Risk objects."""
    num_risks = draw(st.integers(min_value=min_risks, max_value=max_risks))
    risks = []
    for i in range(num_risks):
        risk = draw(risk_strategy(risk_id=f"risk_{i}"))
        risks.append(risk)
    return risks


class TestMonteCarloStatisticalCorrectness:
    """
    Property 3: Monte Carlo Statistical Correctness
    
    For any valid risk configuration, Monte Carlo simulation must complete the specified
    number of iterations and produce statistically valid percentile results (P10, P50, P90)
    for both cost and schedule.
    
    Validates: Requirements 2.1, 2.2, 2.3
    """
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=20000)
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_simulation_completes_specified_iterations(self, risks: List[Risk], iterations: int):
        """
        Property: Simulation must complete exactly the specified number of iterations.
        
        For any valid risk configuration and iteration count >= 10000,
        the simulation must complete all iterations and return results
        with the correct iteration count.
        """
        engine = MonteCarloEngine()
        
        # Run simulation
        results = engine.run_simulation(risks=risks, iterations=iterations)
        
        # Verify iteration count matches
        assert results.iteration_count == iterations, \
            f"Expected {iterations} iterations, got {results.iteration_count}"
        
        # Verify outcome arrays have correct length
        assert len(results.cost_outcomes) == iterations, \
            f"Cost outcomes length {len(results.cost_outcomes)} != {iterations}"
        assert len(results.schedule_outcomes) == iterations, \
            f"Schedule outcomes length {len(results.schedule_outcomes)} != {iterations}"
        
        # Verify all risk contributions have correct length
        for risk_id, contributions in results.risk_contributions.items():
            assert len(contributions) == iterations, \
                f"Risk {risk_id} contributions length {len(contributions)} != {iterations}"
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=15000)
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_percentile_results_are_statistically_valid(self, risks: List[Risk], iterations: int):
        """
        Property: Percentile results (P10, P50, P90) must be statistically valid.
        
        For any simulation, the percentiles must satisfy:
        - P10 <= P50 <= P90
        - All percentiles are finite numbers
        - Percentiles are within the range of outcomes
        """
        engine = MonteCarloEngine()
        
        # Run simulation
        results = engine.run_simulation(risks=risks, iterations=iterations)
        
        # Calculate percentiles for cost outcomes
        cost_p10 = np.percentile(results.cost_outcomes, 10)
        cost_p50 = np.percentile(results.cost_outcomes, 50)
        cost_p90 = np.percentile(results.cost_outcomes, 90)
        
        # Verify percentile ordering for cost
        assert cost_p10 <= cost_p50, f"Cost P10 ({cost_p10}) > P50 ({cost_p50})"
        assert cost_p50 <= cost_p90, f"Cost P50 ({cost_p50}) > P90 ({cost_p90})"
        
        # Verify percentiles are finite
        assert np.isfinite(cost_p10), "Cost P10 is not finite"
        assert np.isfinite(cost_p50), "Cost P50 is not finite"
        assert np.isfinite(cost_p90), "Cost P90 is not finite"
        
        # Verify percentiles are within outcome range
        cost_min = np.min(results.cost_outcomes)
        cost_max = np.max(results.cost_outcomes)
        assert cost_min <= cost_p10 <= cost_max, "Cost P10 outside outcome range"
        assert cost_min <= cost_p50 <= cost_max, "Cost P50 outside outcome range"
        assert cost_min <= cost_p90 <= cost_max, "Cost P90 outside outcome range"
        
        # Calculate percentiles for schedule outcomes
        schedule_p10 = np.percentile(results.schedule_outcomes, 10)
        schedule_p50 = np.percentile(results.schedule_outcomes, 50)
        schedule_p90 = np.percentile(results.schedule_outcomes, 90)
        
        # Verify percentile ordering for schedule
        assert schedule_p10 <= schedule_p50, f"Schedule P10 ({schedule_p10}) > P50 ({schedule_p50})"
        assert schedule_p50 <= schedule_p90, f"Schedule P50 ({schedule_p50}) > P90 ({schedule_p90})"
        
        # Verify percentiles are finite
        assert np.isfinite(schedule_p10), "Schedule P10 is not finite"
        assert np.isfinite(schedule_p50), "Schedule P50 is not finite"
        assert np.isfinite(schedule_p90), "Schedule P90 is not finite"
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=15000),
        random_seed=st.integers(min_value=0, max_value=1000000)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_simulation_is_reproducible_with_seed(self, risks: List[Risk], iterations: int, random_seed: int):
        """
        Property: Simulations with the same seed must produce identical results.
        
        For any risk configuration, running the simulation twice with the same
        random seed must produce identical outcomes.
        """
        engine = MonteCarloEngine()
        
        # Run simulation twice with same seed
        results1 = engine.run_simulation(risks=risks, iterations=iterations, random_seed=random_seed)
        results2 = engine.run_simulation(risks=risks, iterations=iterations, random_seed=random_seed)
        
        # Verify cost outcomes are identical
        assert np.allclose(results1.cost_outcomes, results2.cost_outcomes, rtol=1e-10), \
            "Cost outcomes differ with same random seed"
        
        # Verify schedule outcomes are identical
        assert np.allclose(results1.schedule_outcomes, results2.schedule_outcomes, rtol=1e-10), \
            "Schedule outcomes differ with same random seed"
        
        # Verify risk contributions are identical
        for risk_id in results1.risk_contributions:
            assert np.allclose(
                results1.risk_contributions[risk_id],
                results2.risk_contributions[risk_id],
                rtol=1e-10
            ), f"Risk {risk_id} contributions differ with same random seed"
    
    @given(
        risks=risk_list_strategy(min_risks=2, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=15000)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_outcomes_are_finite_and_valid(self, risks: List[Risk], iterations: int):
        """
        Property: All simulation outcomes must be finite numbers.
        
        For any simulation, all cost and schedule outcomes must be finite
        (not NaN or infinity) and risk contributions must sum correctly.
        """
        engine = MonteCarloEngine()
        
        # Run simulation
        results = engine.run_simulation(risks=risks, iterations=iterations)
        
        # Verify all cost outcomes are finite
        assert np.all(np.isfinite(results.cost_outcomes)), \
            "Some cost outcomes are not finite"
        
        # Verify all schedule outcomes are finite
        assert np.all(np.isfinite(results.schedule_outcomes)), \
            "Some schedule outcomes are not finite"
        
        # Verify all risk contributions are finite
        for risk_id, contributions in results.risk_contributions.items():
            assert np.all(np.isfinite(contributions)), \
                f"Risk {risk_id} has non-finite contributions"
        
        # Verify execution time is positive and finite
        assert results.execution_time > 0, "Execution time must be positive"
        assert np.isfinite(results.execution_time), "Execution time must be finite"


class TestMonteCarloPerformanceAndCaching:
    """
    Property 4: Simulation Performance and Caching
    
    For any Monte Carlo simulation on typical project complexity, execution must
    complete within 30 seconds and results must be cached until underlying risk
    data changes.
    
    Validates: Requirements 2.6, 8.1, 8.5
    """
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=10),
        iterations=st.integers(min_value=10000, max_value=15000)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_simulation_completes_within_time_limit(self, risks: List[Risk], iterations: int):
        """
        Property: Simulation must complete within 30 seconds for typical complexity.
        
        For any simulation with up to 10 risks and 15000 iterations,
        execution time must be <= 30 seconds.
        """
        engine = MonteCarloEngine()
        
        # Measure execution time
        start_time = time.time()
        results = engine.run_simulation(risks=risks, iterations=iterations)
        end_time = time.time()
        
        execution_time = end_time - start_time
        
        # Verify execution time is within limit
        assert execution_time <= 30.0, \
            f"Simulation took {execution_time:.2f}s, exceeds 30s limit"
        
        # Verify reported execution time matches actual time (within 10% tolerance)
        assert abs(results.execution_time - execution_time) / execution_time <= 0.1, \
            f"Reported time {results.execution_time:.2f}s differs from actual {execution_time:.2f}s"
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=12000)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_results_are_cached_correctly(self, risks: List[Risk], iterations: int):
        """
        Property: Simulation results must be cached and retrievable.
        
        For any simulation, results must be cached after execution and
        retrievable using the simulation ID.
        """
        engine = MonteCarloEngine()
        
        # Run simulation
        results = engine.run_simulation(risks=risks, iterations=iterations)
        simulation_id = results.simulation_id
        
        # Retrieve cached results
        cached_results = engine.get_cached_results(simulation_id)
        
        # Verify results were cached
        assert cached_results is not None, "Results were not cached"
        
        # Verify cached results match original
        assert cached_results.simulation_id == results.simulation_id
        assert cached_results.iteration_count == results.iteration_count
        assert np.array_equal(cached_results.cost_outcomes, results.cost_outcomes)
        assert np.array_equal(cached_results.schedule_outcomes, results.schedule_outcomes)
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=12000)
    )
    @settings(
        max_examples=30,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_cache_invalidation_on_risk_change(self, risks: List[Risk], iterations: int):
        """
        Property: Cache must be invalidated when risk data changes.
        
        For any simulation, when a risk is modified, cached results
        referencing that risk must be invalidated.
        """
        engine = MonteCarloEngine()
        
        # Run initial simulation
        results = engine.run_simulation(risks=risks, iterations=iterations)
        simulation_id = results.simulation_id
        
        # Verify results are cached
        cached_results = engine.get_cached_results(simulation_id)
        assert cached_results is not None, "Initial results not cached"
        
        # Invalidate cache for first risk
        if len(risks) > 0:
            engine.invalidate_cache_for_risk(risks[0].id)
            
            # Verify cache was invalidated
            cached_results_after = engine.get_cached_results(simulation_id)
            assert cached_results_after is None, \
                "Cache was not invalidated after risk change"
    
    @given(
        risks=risk_list_strategy(min_risks=1, max_risks=5),
        iterations=st.integers(min_value=10000, max_value=12000)
    )
    @settings(
        max_examples=30,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_parameter_change_detection(self, risks: List[Risk], iterations: int):
        """
        Property: Parameter changes must be detected correctly.
        
        For any simulation, running with different parameters should be detected
        as a change, while running with identical parameters should use cache.
        """
        engine = MonteCarloEngine()
        
        # Run initial simulation with caching
        results1 = engine.run_simulation_with_caching(
            risks=risks,
            iterations=iterations,
            random_seed=42
        )
        
        # Run again with same parameters (should use cache)
        start_time = time.time()
        results2 = engine.run_simulation_with_caching(
            risks=risks,
            iterations=iterations,
            random_seed=42,
            previous_simulation_id=results1.simulation_id
        )
        cache_time = time.time() - start_time
        
        # Verify results are identical (from cache)
        assert results2.simulation_id == results1.simulation_id, \
            "Cached simulation should return same ID"
        
        # Cache retrieval should be much faster than simulation
        assert cache_time < 1.0, \
            f"Cache retrieval took {cache_time:.2f}s, should be < 1s"
        
        # Run with different parameters (should detect change)
        results3 = engine.run_simulation_with_caching(
            risks=risks,
            iterations=iterations + 1000,  # Different iteration count
            random_seed=42,
            previous_simulation_id=results1.simulation_id
        )
        
        # Verify new simulation was run
        assert results3.simulation_id != results1.simulation_id, \
            "Parameter change should trigger new simulation"
        assert results3.iteration_count != results1.iteration_count, \
            "New simulation should have different iteration count"


# Integration test to verify both properties work together
class TestMonteCarloIntegration:
    """Integration tests for Monte Carlo simulation properties."""
    
    @given(
        risks=risk_list_strategy(min_risks=2, max_risks=8),
        iterations=st.integers(min_value=10000, max_value=15000)
    )
    @settings(
        max_examples=20,
        deadline=None,
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture]
    )
    def test_complete_simulation_workflow(self, risks: List[Risk], iterations: int):
        """
        Integration test: Complete simulation workflow with validation.
        
        Tests that a complete simulation workflow (validation, execution,
        caching, retrieval) works correctly and meets all properties.
        """
        engine = MonteCarloEngine()
        
        # Step 1: Validate parameters
        validation_result = engine.validate_simulation_parameters(risks, iterations)
        assert validation_result.is_valid, \
            f"Validation failed: {validation_result.errors}"
        
        # Step 2: Run simulation
        start_time = time.time()
        results = engine.run_simulation(risks=risks, iterations=iterations)
        execution_time = time.time() - start_time
        
        # Verify performance (Property 4)
        assert execution_time <= 30.0, \
            f"Execution time {execution_time:.2f}s exceeds 30s limit"
        
        # Verify statistical correctness (Property 3)
        assert results.iteration_count == iterations
        assert len(results.cost_outcomes) == iterations
        assert len(results.schedule_outcomes) == iterations
        assert np.all(np.isfinite(results.cost_outcomes))
        assert np.all(np.isfinite(results.schedule_outcomes))
        
        # Verify percentiles are ordered correctly
        cost_p10 = np.percentile(results.cost_outcomes, 10)
        cost_p50 = np.percentile(results.cost_outcomes, 50)
        cost_p90 = np.percentile(results.cost_outcomes, 90)
        assert cost_p10 <= cost_p50 <= cost_p90
        
        # Step 3: Verify caching (Property 4)
        cached_results = engine.get_cached_results(results.simulation_id)
        assert cached_results is not None
        assert cached_results.simulation_id == results.simulation_id
        
        # Step 4: Verify cache invalidation works
        if len(risks) > 0:
            engine.invalidate_cache_for_risk(risks[0].id)
            invalidated_cache = engine.get_cached_results(results.simulation_id)
            assert invalidated_cache is None, "Cache should be invalidated"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
