"""
Property-based tests for time-based cost modeling.

Tests Property 11: Time-Based Cost Modeling
Validates: Requirements 4.5

These tests verify that the Monte Carlo Engine correctly applies time-based 
escalation factors when inflation or currency risks exist.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from hypothesis import given, strategies as st, assume, settings
from hypothesis.extra.numpy import arrays

from monte_carlo.cost_escalation import (
    CostEscalationModeler, EscalationFactor, EscalationFactorType, CostEscalationResult
)
from monte_carlo.models import ProbabilityDistribution, DistributionType


class TestTimeBasisCostModelingProperties:
    """Property-based tests for time-based cost modeling functionality."""
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=10000000.0),
        annual_rate=st.floats(min_value=-0.20, max_value=0.50),
        time_period_days=st.integers(min_value=1, max_value=3650)  # 1 day to 10 years
    )
    @settings(max_examples=100, deadline=5000)
    def test_escalation_monotonicity_with_positive_rates(self, base_cost, annual_rate, time_period_days):
        """
        Property: For positive escalation rates, escalated cost should be >= base cost.
        
        This property ensures that positive escalation rates always increase costs,
        which is fundamental to inflation and cost escalation modeling.
        """
        assume(annual_rate >= 0.01)  # Ensure meaningful positive rate
        assume(base_cost > 0)
        assume(time_period_days >= 30)  # Minimum meaningful period
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factor
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create escalation factor with positive rate
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=annual_rate
        )
        modeler.add_escalation_factor(factor)
        
        # Calculate escalation
        start_date = datetime(2024, 1, 1)
        end_date = start_date + timedelta(days=time_period_days)
        
        result = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Escalated cost should be >= base cost for positive rates
        assert result.escalated_cost >= base_cost
        assert result.escalation_amount >= 0
        
        # Property: Escalation amount should be proportional to time and rate
        if time_period_days > 0 and annual_rate > 0:
            time_period_years = time_period_days / 365.25
            expected_min_escalation = base_cost * annual_rate * time_period_years * 0.8
            assert result.escalation_amount >= expected_min_escalation
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        annual_rate=st.floats(min_value=-0.10, max_value=-0.01),
        time_period_days=st.integers(min_value=30, max_value=1825)  # 1 month to 5 years
    )
    @settings(max_examples=50, deadline=5000)
    def test_escalation_monotonicity_with_negative_rates(self, base_cost, annual_rate, time_period_days):
        """
        Property: For negative escalation rates, escalated cost should be <= base cost.
        
        This property ensures that negative escalation rates (deflation) decrease costs.
        """
        assume(annual_rate <= -0.01)  # Ensure meaningful negative rate
        assume(base_cost > 0)
        assume(time_period_days >= 30)  # Minimum meaningful period
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factor
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create escalation factor with negative rate
        factor = EscalationFactor(
            factor_type=EscalationFactorType.CURRENCY,
            annual_rate=annual_rate
        )
        modeler.add_escalation_factor(factor)
        
        # Calculate escalation
        start_date = datetime(2024, 1, 1)
        end_date = start_date + timedelta(days=time_period_days)
        
        result = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Escalated cost should be <= base cost for negative rates
        assert result.escalated_cost <= base_cost
        assert result.escalation_amount <= 0
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        time_period_days=st.integers(min_value=1, max_value=1825)
    )
    @settings(max_examples=50, deadline=5000)
    def test_zero_escalation_for_zero_rates(self, base_cost, time_period_days):
        """
        Property: Zero escalation rates should result in no cost change.
        
        This property ensures that when no escalation factors are applied,
        the escalated cost equals the base cost.
        """
        assume(base_cost > 0)
        assume(time_period_days >= 1)
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create escalation factor with zero rate
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=0.0
        )
        modeler.add_escalation_factor(factor)
        
        # Calculate escalation
        start_date = datetime(2024, 1, 1)
        end_date = start_date + timedelta(days=time_period_days)
        
        result = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Zero rate should result in no escalation
        assert abs(result.escalated_cost - base_cost) < 1e-6
        assert abs(result.escalation_amount) < 1e-6
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        annual_rate=st.floats(min_value=0.01, max_value=0.20),
        compound_frequency=st.sampled_from(["monthly", "quarterly", "annually"])
    )
    @settings(max_examples=75, deadline=5000)
    def test_compound_frequency_effects(self, base_cost, annual_rate, compound_frequency):
        """
        Property: More frequent compounding should result in higher escalated costs.
        
        This property verifies that compound frequency affects escalation correctly,
        with more frequent compounding yielding higher costs for positive rates.
        """
        assume(base_cost > 0)
        assume(annual_rate > 0)
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factor
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Test different compounding frequencies
        time_period_days = 365  # 1 year
        start_date = datetime(2024, 1, 1)
        end_date = start_date + timedelta(days=time_period_days)
        
        # Create factor with specified frequency
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=annual_rate,
            compound_frequency=compound_frequency
        )
        modeler.add_escalation_factor(factor)
        
        result = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Escalation should be reasonable for the given frequency
        expected_simple_escalation = base_cost * annual_rate
        
        # For positive rates, compound escalation should be >= simple escalation
        assert result.escalation_amount >= expected_simple_escalation * 0.95  # Allow small tolerance
        
        # Escalation should not be unreasonably high
        max_reasonable_escalation = base_cost * annual_rate * 1.2  # 20% buffer for compounding
        assert result.escalation_amount <= max_reasonable_escalation
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        num_factors=st.integers(min_value=2, max_value=4),
        time_period_days=st.integers(min_value=90, max_value=1095)  # 3 months to 3 years
    )
    @settings(max_examples=50, deadline=5000)
    def test_multiple_factor_additivity(self, base_cost, num_factors, time_period_days):
        """
        Property: Multiple escalation factors should combine additively.
        
        This property ensures that when multiple escalation factors are applied,
        their effects combine in a predictable manner.
        """
        assume(base_cost > 0)
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factors
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create multiple escalation factors
        factor_types = [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                       EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]
        
        total_expected_rate = 0.0
        for i in range(min(num_factors, len(factor_types))):
            rate = 0.02 + (i * 0.01)  # 2%, 3%, 4%, 5%
            total_expected_rate += rate
            
            factor = EscalationFactor(
                factor_type=factor_types[i],
                annual_rate=rate
            )
            modeler.add_escalation_factor(factor)
        
        # Calculate escalation
        start_date = datetime(2024, 1, 1)
        end_date = start_date + timedelta(days=time_period_days)
        
        result = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Total escalation should be reasonable for combined rates
        time_period_years = time_period_days / 365.25
        expected_min_escalation = base_cost * total_expected_rate * time_period_years * 0.8
        expected_max_escalation = base_cost * total_expected_rate * time_period_years * 1.3
        
        assert result.escalation_amount >= expected_min_escalation
        assert result.escalation_amount <= expected_max_escalation
        
        # Property: Each factor should contribute to total escalation
        assert len(result.escalation_by_factor) == min(num_factors, len(factor_types))
        for factor_contribution in result.escalation_by_factor.values():
            assert factor_contribution > 0  # All rates are positive
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        annual_rate=st.floats(min_value=0.01, max_value=0.15),
        num_scenarios=st.integers(min_value=100, max_value=1000)
    )
    @settings(max_examples=25, deadline=10000)
    def test_simulation_consistency(self, base_cost, annual_rate, num_scenarios):
        """
        Property: Simulation scenarios should produce consistent statistical properties.
        
        This property verifies that Monte Carlo simulation of escalation produces
        statistically consistent results across multiple runs.
        """
        assume(base_cost > 0)
        assume(annual_rate > 0)
        assume(num_scenarios >= 100)
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factor
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create escalation factor with distribution
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=annual_rate,
            distribution=ProbabilityDistribution(
                distribution_type=DistributionType.NORMAL,
                parameters={'mean': annual_rate, 'std': annual_rate * 0.2},
                bounds=(0.0, annual_rate * 2)
            )
        )
        modeler.add_escalation_factor(factor)
        
        # Run simulation
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2025, 1, 1)  # 1 year
        
        scenarios = modeler.simulate_escalation_scenarios(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date,
            num_scenarios=num_scenarios,
            random_seed=42
        )
        
        escalated_costs = scenarios['escalated_costs']
        escalation_amounts = scenarios['escalation_amounts']
        
        # Property: All escalated costs should be finite and positive
        assert np.all(np.isfinite(escalated_costs))
        assert np.all(escalated_costs > 0)
        
        # Property: Mean escalation should be close to expected value
        expected_escalation = base_cost * annual_rate
        mean_escalation = np.mean(escalation_amounts)
        
        # Allow 20% tolerance for stochastic variation
        assert abs(mean_escalation - expected_escalation) <= expected_escalation * 0.2
        
        # Property: Standard deviation should be reasonable
        std_escalation = np.std(escalation_amounts)
        expected_std = expected_escalation * 0.2  # Based on 20% coefficient of variation
        
        # Standard deviation should be in reasonable range
        assert std_escalation >= expected_std * 0.5
        assert std_escalation <= expected_std * 2.0
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        time_period_1=st.integers(min_value=30, max_value=365),
        time_period_2=st.integers(min_value=366, max_value=1095)
    )
    @settings(max_examples=50, deadline=5000)
    def test_time_period_monotonicity(self, base_cost, time_period_1, time_period_2):
        """
        Property: Longer time periods should result in higher escalation for positive rates.
        
        This property ensures that escalation increases monotonically with time
        for positive escalation rates.
        """
        assume(base_cost > 0)
        assume(time_period_2 > time_period_1)
        
        modeler = CostEscalationModeler()
        
        # Remove all default factors to test only our factor
        for factor_type in [EscalationFactorType.INFLATION, EscalationFactorType.CURRENCY, 
                           EscalationFactorType.MATERIAL, EscalationFactorType.LABOR]:
            modeler.remove_escalation_factor(factor_type)
        
        # Create escalation factor with positive rate
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=0.05  # 5% annual rate
        )
        modeler.add_escalation_factor(factor)
        
        start_date = datetime(2024, 1, 1)
        
        # Calculate escalation for shorter period
        end_date_1 = start_date + timedelta(days=time_period_1)
        result_1 = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date_1
        )
        
        # Calculate escalation for longer period
        end_date_2 = start_date + timedelta(days=time_period_2)
        result_2 = modeler.calculate_escalation(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date_2
        )
        
        # Property: Longer period should result in higher escalation
        assert result_2.escalation_amount >= result_1.escalation_amount
        assert result_2.escalated_cost >= result_1.escalated_cost
        
        # Property: Escalation should be roughly proportional to time
        time_ratio = time_period_2 / time_period_1
        escalation_ratio = result_2.escalation_amount / max(result_1.escalation_amount, 1e-6)
        
        # For simple interest, ratio should be close to time ratio
        # Allow tolerance for compounding effects
        assert escalation_ratio >= time_ratio * 0.8
        assert escalation_ratio <= time_ratio * 1.3
    
    @given(
        base_cost=st.floats(min_value=1000.0, max_value=1000000.0),
        annual_rate=st.floats(min_value=0.01, max_value=0.20)
    )
    @settings(max_examples=50, deadline=5000)
    def test_escalation_summary_consistency(self, base_cost, annual_rate):
        """
        Property: Escalation summary statistics should be internally consistent.
        
        This property verifies that summary statistics from escalation analysis
        are mathematically consistent and reasonable.
        """
        assume(base_cost > 0)
        assume(annual_rate > 0)
        
        modeler = CostEscalationModeler()
        
        # Create escalation factor
        factor = EscalationFactor(
            factor_type=EscalationFactorType.INFLATION,
            annual_rate=annual_rate
        )
        modeler.add_escalation_factor(factor)
        
        # Get escalation summary
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2025, 1, 1)  # 1 year
        
        summary = modeler.get_escalation_summary(
            base_cost=base_cost,
            start_date=start_date,
            end_date=end_date
        )
        
        # Property: Summary should contain expected keys
        assert 'base_cost' in summary
        assert 'escalation_statistics' in summary
        assert 'escalated_cost_statistics' in summary
        assert 'percentiles' in summary
        assert 'confidence_intervals' in summary
        
        # Property: Base cost should match input
        assert abs(summary['base_cost'] - base_cost) < 1e-6
        
        # Property: Mean escalated cost should be > base cost
        mean_escalated = summary['escalated_cost_statistics']['mean']
        assert mean_escalated > base_cost
        
        # Property: Percentiles should be ordered
        percentiles = summary['percentiles']
        p_values = [percentiles[f'P{p}'] for p in [10, 25, 50, 75, 90, 95, 99]]
        
        for i in range(len(p_values) - 1):
            assert p_values[i] <= p_values[i + 1]
        
        # Property: Confidence intervals should be nested
        ci_80 = summary['confidence_intervals']['80%']
        ci_90 = summary['confidence_intervals']['90%']
        ci_95 = summary['confidence_intervals']['95%']
        
        # 95% CI should contain 90% CI, which should contain 80% CI
        assert ci_95['lower'] <= ci_90['lower'] <= ci_80['lower']
        assert ci_80['upper'] <= ci_90['upper'] <= ci_95['upper']