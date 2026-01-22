"""
Property-based tests for cost distribution output.

Tests Property 10: Cost Distribution Output
Validates: Requirements 4.4

These tests verify that the Monte Carlo Engine produces probability distributions 
showing budget compliance at different confidence levels.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from hypothesis import given, strategies as st, assume, settings
from hypothesis.extra.numpy import arrays

from monte_carlo.distribution_outputs import (
    DistributionOutputGenerator, BudgetComplianceResult, ComplianceLevel, DistributionSummary
)
from monte_carlo.models import SimulationResults, ConvergenceMetrics


class TestCostDistributionOutputProperties:
    """Property-based tests for cost distribution output functionality."""
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=10000),
            elements=st.floats(min_value=10000.0, max_value=1000000.0, allow_nan=False, allow_infinity=False)
        ),
        target_budget=st.floats(min_value=50000.0, max_value=500000.0)
    )
    @settings(max_examples=50, deadline=5000)
    def test_budget_compliance_probability_bounds(self, cost_outcomes, target_budget):
        """
        Property: Budget compliance probability should be between 0 and 1.
        
        This property ensures that compliance probability calculations always
        produce valid probability values regardless of input distributions.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        assume(target_budget > 0)
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        
        generator = DistributionOutputGenerator()
        result = generator.calculate_budget_compliance(simulation_results, target_budget)
        
        # Property: Compliance probability must be between 0 and 1
        assert 0.0 <= result.compliance_probability <= 1.0
        
        # Property: Expected cost should be positive and finite
        assert result.expected_cost > 0
        assert np.isfinite(result.expected_cost)
        
        # Property: Cost at risk should be non-negative
        assert result.cost_at_risk >= 0
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        ),
        target_budget_multiplier=st.floats(min_value=0.5, max_value=2.0)
    )
    @settings(max_examples=50, deadline=5000)
    def test_compliance_probability_monotonicity(self, cost_outcomes, target_budget_multiplier):
        """
        Property: Higher target budgets should result in higher compliance probabilities.
        
        This property ensures that compliance probability increases monotonically
        with target budget, which is fundamental to budget analysis.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        assume(np.std(cost_outcomes) > 1.0)  # Ensure some variance in the data
        
        mean_cost = float(np.mean(cost_outcomes))
        median_cost = float(np.median(cost_outcomes))
        
        # Filter out pathological distributions where mean and median are too different
        assume(abs(mean_cost - median_cost) < mean_cost * 0.5)
        
        target_budget_1 = mean_cost * target_budget_multiplier
        target_budget_2 = target_budget_1 * 1.2  # 20% higher budget
        
        assume(target_budget_1 > 0)
        assume(target_budget_2 > target_budget_1)
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        
        generator = DistributionOutputGenerator()
        
        result_1 = generator.calculate_budget_compliance(simulation_results, target_budget_1)
        result_2 = generator.calculate_budget_compliance(simulation_results, target_budget_2)
        
        # Property: Higher budget should have higher or equal compliance probability
        assert result_2.compliance_probability >= result_1.compliance_probability
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=50, deadline=5000)
    def test_confidence_interval_nesting(self, cost_outcomes):
        """
        Property: Confidence intervals should be properly nested.
        
        This property ensures that higher confidence levels produce wider intervals
        that contain lower confidence level intervals.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        assume(np.std(cost_outcomes) > 1.0)  # Ensure some variance in the data
        
        mean_cost = float(np.mean(cost_outcomes))
        target_budget = mean_cost * 1.1  # 10% above mean
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        
        generator = DistributionOutputGenerator()
        result = generator.calculate_budget_compliance(
            simulation_results, target_budget, confidence_levels=[0.80, 0.90, 0.95]
        )
        
        # Property: Confidence intervals should be nested
        ci_80 = result.confidence_intervals['80%']
        ci_90 = result.confidence_intervals['90%']
        ci_95 = result.confidence_intervals['95%']
        
        # 95% CI should contain 90% CI, which should contain 80% CI
        assert ci_95[0] <= ci_90[0] <= ci_80[0]  # Lower bounds
        assert ci_80[1] <= ci_90[1] <= ci_95[1]  # Upper bounds
        
        # Property: All confidence intervals should have positive or zero width
        assert ci_80[1] >= ci_80[0]
        assert ci_90[1] >= ci_90[0]
        assert ci_95[1] >= ci_95[0]
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=50, deadline=5000)
    def test_percentile_ordering(self, cost_outcomes):
        """
        Property: Percentiles should be properly ordered.
        
        This property ensures that percentile calculations produce monotonically
        increasing values, which is fundamental to distribution analysis.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        
        mean_cost = float(np.mean(cost_outcomes))
        target_budget = mean_cost * 1.1
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        
        generator = DistributionOutputGenerator()
        result = generator.calculate_budget_compliance(simulation_results, target_budget)
        
        # Property: Percentiles should be ordered
        percentiles = result.percentile_analysis
        p_values = [percentiles[f'P{p}'] for p in [10, 25, 50, 75, 90, 95, 99]]
        
        for i in range(len(p_values) - 1):
            assert p_values[i] <= p_values[i + 1]
        
        # Property: Median (P50) should be close to expected cost
        expected_cost = result.expected_cost
        median_cost = percentiles['P50']
        
        # Allow reasonable tolerance for median vs mean difference
        assert abs(median_cost - expected_cost) <= expected_cost * 0.5
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=50, deadline=5000)
    def test_compliance_level_categorization(self, cost_outcomes):
        """
        Property: Compliance level categorization should be consistent with probability.
        
        This property ensures that compliance levels are correctly categorized
        based on the calculated compliance probability.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        
        # Test different budget levels to get different compliance probabilities
        mean_cost = float(np.mean(cost_outcomes))
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        generator = DistributionOutputGenerator()
        
        # Test very high budget (should be VERY_HIGH compliance)
        high_budget = mean_cost * 2.0
        high_result = generator.calculate_budget_compliance(simulation_results, high_budget)
        
        # Test very low budget (should be LOW compliance)
        low_budget = mean_cost * 0.5
        low_result = generator.calculate_budget_compliance(simulation_results, low_budget)
        
        # Property: High budget should have higher compliance level than low budget
        compliance_order = {
            ComplianceLevel.LOW: 0,
            ComplianceLevel.MEDIUM: 1,
            ComplianceLevel.HIGH: 2,
            ComplianceLevel.VERY_HIGH: 3
        }
        
        assert compliance_order[high_result.compliance_level] >= compliance_order[low_result.compliance_level]
        
        # Property: Compliance level should match probability ranges
        if high_result.compliance_probability >= 0.95:
            assert high_result.compliance_level == ComplianceLevel.VERY_HIGH
        elif high_result.compliance_probability >= 0.90:
            assert high_result.compliance_level == ComplianceLevel.HIGH
        elif high_result.compliance_probability >= 0.70:
            assert high_result.compliance_level == ComplianceLevel.MEDIUM
        else:
            assert high_result.compliance_level == ComplianceLevel.LOW
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=50, deadline=5000)
    def test_distribution_summary_consistency(self, cost_outcomes):
        """
        Property: Distribution summary statistics should be internally consistent.
        
        This property ensures that summary statistics are mathematically
        consistent and reasonable.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        assume(np.std(cost_outcomes) > 0)  # Ensure some variation
        
        generator = DistributionOutputGenerator()
        summary = generator.generate_distribution_summary(cost_outcomes)
        
        # Property: Basic statistics should be reasonable
        assert summary.mean > 0
        assert summary.median > 0
        assert summary.std_dev >= 0
        assert np.isfinite(summary.mean)
        assert np.isfinite(summary.median)
        assert np.isfinite(summary.std_dev)
        
        # Property: Coefficient of variation should be reasonable
        if summary.mean > 0:
            expected_cv = summary.std_dev / summary.mean
            assert abs(summary.coefficient_of_variation - expected_cv) < 1e-6
        
        # Property: Percentiles should be ordered and within data range
        percentiles = summary.percentiles
        p_values = [percentiles[f'P{p}'] for p in [10, 25, 50, 75, 90, 95, 99]]
        
        for i in range(len(p_values) - 1):
            assert p_values[i] <= p_values[i + 1]
        
        # Property: Percentiles should be within data range
        data_min = float(np.min(cost_outcomes))
        data_max = float(np.max(cost_outcomes))
        
        for p_value in p_values:
            assert data_min <= p_value <= data_max
        
        # Property: Median should match P50
        assert abs(summary.median - percentiles['P50']) < 1e-6
    
    @given(
        cost_outcomes=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=5000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=50, deadline=5000)
    def test_value_at_risk_properties(self, cost_outcomes):
        """
        Property: Value at Risk calculations should have correct properties.
        
        This property ensures that VaR and CVaR calculations are mathematically
        correct and consistent.
        """
        assume(len(cost_outcomes) > 0)
        assume(np.all(np.isfinite(cost_outcomes)))
        assume(np.all(cost_outcomes > 0))
        assume(np.std(cost_outcomes) > 1.0)  # Ensure meaningful variation
        
        generator = DistributionOutputGenerator()
        
        # Calculate VaR and CVaR
        var_results = generator.calculate_value_at_risk(cost_outcomes, [0.95, 0.99])
        cvar_results = generator.calculate_conditional_value_at_risk(cost_outcomes, [0.95, 0.99])
        
        # Property: VaR should be within data range
        data_min = float(np.min(cost_outcomes))
        data_max = float(np.max(cost_outcomes))
        
        for var_value in var_results.values():
            assert data_min <= var_value <= data_max
        
        # Property: CVaR should be >= VaR for same confidence level (with floating-point tolerance)
        assert cvar_results['CVaR_95%'] >= var_results['VaR_95%'] - 1e-6
        assert cvar_results['CVaR_99%'] >= var_results['VaR_99%'] - 1e-6
        
        # Property: Higher confidence VaR should be >= lower confidence VaR
        assert var_results['VaR_99%'] >= var_results['VaR_95%']
        assert cvar_results['CVaR_99%'] >= cvar_results['CVaR_95%']
    
    @given(
        num_outcomes=st.integers(min_value=1000, max_value=5000),
        mean_cost=st.floats(min_value=50000.0, max_value=500000.0),
        std_ratio=st.floats(min_value=0.1, max_value=0.5)
    )
    @settings(max_examples=50, deadline=5000)
    def test_extreme_budget_scenarios(self, num_outcomes, mean_cost, std_ratio):
        """
        Property: Extreme budget scenarios should produce expected compliance results.
        
        This property tests edge cases with very high and very low budgets
        to ensure robust behavior.
        """
        assume(mean_cost > 0)
        assume(std_ratio > 0)
        
        # Generate cost outcomes with controlled distribution
        std_cost = mean_cost * std_ratio
        cost_outcomes = np.random.normal(mean_cost, std_cost, num_outcomes)
        cost_outcomes = np.maximum(cost_outcomes, mean_cost * 0.1)  # Ensure positive
        
        # Create simulation results
        simulation_results = self._create_simulation_results(cost_outcomes)
        generator = DistributionOutputGenerator()
        
        # Test extremely high budget (should have ~100% compliance)
        very_high_budget = mean_cost * 10.0
        high_result = generator.calculate_budget_compliance(simulation_results, very_high_budget)
        
        # Property: Very high budget should have very high compliance
        assert high_result.compliance_probability >= 0.95
        assert high_result.compliance_level in [ComplianceLevel.HIGH, ComplianceLevel.VERY_HIGH]
        assert high_result.cost_at_risk <= mean_cost * 0.1  # Very low risk
        
        # Test extremely low budget (should have ~0% compliance)
        very_low_budget = mean_cost * 0.1
        low_result = generator.calculate_budget_compliance(simulation_results, very_low_budget)
        
        # Property: Very low budget should have low compliance
        assert low_result.compliance_probability <= 0.1
        assert low_result.compliance_level == ComplianceLevel.LOW
        assert low_result.cost_at_risk >= mean_cost * 0.5  # High risk
    
    @given(
        cost_outcomes_1=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=3000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        ),
        cost_outcomes_2=arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1000, max_value=3000),
            elements=st.floats(min_value=10000.0, max_value=100000.0, allow_nan=False, allow_infinity=False)
        )
    )
    @settings(max_examples=25, deadline=10000)
    def test_comparative_analysis_consistency(self, cost_outcomes_1, cost_outcomes_2):
        """
        Property: Comparative analysis should be consistent across different distributions.
        
        This property ensures that when comparing different cost distributions,
        the analysis produces consistent and logical results.
        """
        assume(len(cost_outcomes_1) > 0 and len(cost_outcomes_2) > 0)
        assume(np.all(np.isfinite(cost_outcomes_1)) and np.all(np.isfinite(cost_outcomes_2)))
        assume(np.all(cost_outcomes_1 > 0) and np.all(cost_outcomes_2 > 0))
        assume(np.std(cost_outcomes_1) > 1.0 and np.std(cost_outcomes_2) > 1.0)  # Ensure variance
        
        mean_1 = float(np.mean(cost_outcomes_1))
        mean_2 = float(np.mean(cost_outcomes_2))
        
        # Only test when means are sufficiently different
        assume(abs(mean_1 - mean_2) > min(mean_1, mean_2) * 0.1)
        
        # Filter out pathological cases where distributions are too skewed
        # (e.g., all values at one extreme except one outlier)
        median_1 = float(np.median(cost_outcomes_1))
        median_2 = float(np.median(cost_outcomes_2))
        assume(abs(mean_1 - median_1) < mean_1 * 0.5)  # Mean and median should be reasonably close
        assume(abs(mean_2 - median_2) < mean_2 * 0.5)
        
        # Use common target budget
        target_budget = (mean_1 + mean_2) / 2
        
        # Create simulation results
        simulation_results_1 = self._create_simulation_results(cost_outcomes_1)
        simulation_results_2 = self._create_simulation_results(cost_outcomes_2)
        
        generator = DistributionOutputGenerator()
        
        result_1 = generator.calculate_budget_compliance(simulation_results_1, target_budget)
        result_2 = generator.calculate_budget_compliance(simulation_results_2, target_budget)
        
        # Property: Distribution with lower mean should have higher compliance probability
        if mean_1 < mean_2:
            assert result_1.compliance_probability >= result_2.compliance_probability
        else:
            assert result_2.compliance_probability >= result_1.compliance_probability
    
    def _create_simulation_results(self, cost_outcomes: np.ndarray) -> SimulationResults:
        """Helper method to create SimulationResults for testing."""
        schedule_outcomes = np.random.uniform(100, 500, len(cost_outcomes))
        
        return SimulationResults(
            simulation_id="test_simulation",
            timestamp=datetime.now(),
            iteration_count=len(cost_outcomes),
            cost_outcomes=cost_outcomes,
            schedule_outcomes=schedule_outcomes,
            risk_contributions={},
            convergence_metrics=ConvergenceMetrics(
                mean_stability=0.95,
                variance_stability=0.95,
                percentile_stability={50.0: 0.95, 90.0: 0.95},
                converged=True,
                iterations_to_convergence=len(cost_outcomes)
            ),
            execution_time=1.0
        )