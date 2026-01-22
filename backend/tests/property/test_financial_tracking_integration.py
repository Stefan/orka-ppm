"""
Property-Based Tests for Existing Financial Tracking System

This module contains property-based tests for the existing variance calculation
functions, budget alert system, and financial data processing.

**Validates: Task 12.1 - Integration with existing financial tracking features**
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.financial_calculations import (
    calculate_variance_amount,
    calculate_variance_percentage,
    determine_variance_status,
    calculate_project_budget_variance,
    calculate_aggregated_variance,
    convert_currency,
    validate_currency_conversion_reciprocal,
    VarianceStatus,
    BASE_EXCHANGE_RATES
)


# ============================================================================
# Custom Strategies for Financial Data
# ============================================================================

@st.composite
def decimal_amount(draw, min_value=0, max_value=10000000):
    """Generate realistic decimal amounts for financial calculations."""
    value = draw(st.floats(
        min_value=min_value,
        max_value=max_value,
        allow_nan=False,
        allow_infinity=False
    ))
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@st.composite
def currency_code(draw):
    """Generate valid currency codes."""
    return draw(st.sampled_from(list(BASE_EXCHANGE_RATES.keys())))


@st.composite
def financial_record(draw):
    """Generate a realistic financial record."""
    planned = draw(decimal_amount(min_value=0, max_value=1000000))
    # Actual can be higher or lower than planned
    actual = draw(decimal_amount(min_value=0, max_value=1000000))
    
    return {
        'planned_amount': planned,
        'actual_amount': actual,
        'currency': draw(currency_code())
    }


@st.composite
def project_budget_data(draw):
    """Generate realistic project budget data."""
    budget = draw(decimal_amount(min_value=1000, max_value=10000000))
    # Actual cost can vary from 50% to 150% of budget
    variance_factor = draw(st.floats(min_value=0.5, max_value=1.5))
    actual_cost = (budget * Decimal(str(variance_factor))).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    
    return {
        'budget': budget,
        'actual_cost': actual_cost
    }


# ============================================================================
# Property Tests for Variance Calculation Functions
# ============================================================================

class TestVarianceCalculationProperties:
    """
    Property-based tests for variance calculation functions.
    
    **Property 39: Existing Variance Calculation Correctness**
    For any planned and actual amounts, variance calculations must produce
    mathematically correct results following the formula: variance = actual - planned
    **Validates: Requirements 2.1, Task 12.1**
    """
    
    @given(
        planned=decimal_amount(min_value=0, max_value=10000000),
        actual=decimal_amount(min_value=0, max_value=10000000)
    )
    @settings(max_examples=100)
    def test_variance_amount_mathematical_correctness(self, planned: Decimal, actual: Decimal):
        """
        Property: Variance amount must equal actual - planned.
        
        **Property 39: Existing Variance Calculation Correctness**
        **Validates: Requirements 2.1**
        """
        variance = calculate_variance_amount(planned, actual)
        expected = actual - planned
        
        # Should be mathematically correct within precision limits
        assert abs(variance - expected) < Decimal('0.01')
        
        # Positive variance means over budget
        if actual > planned:
            assert variance > 0
        # Negative variance means under budget
        elif actual < planned:
            assert variance < 0
        # Equal means on budget
        else:
            assert variance == 0
    
    @given(
        variance_amount=decimal_amount(min_value=-1000000, max_value=1000000),
        planned=decimal_amount(min_value=1, max_value=10000000)
    )
    @settings(max_examples=100)
    def test_variance_percentage_scale_independence(
        self, variance_amount: Decimal, planned: Decimal
    ):
        """
        Property: Variance percentage must be scale-independent.
        
        **Property 40: Variance Percentage Scale Independence**
        **Validates: Requirements 2.3**
        """
        assume(planned > 0)  # Avoid division by zero
        
        percentage = calculate_variance_percentage(variance_amount, planned)
        expected = (variance_amount / planned) * 100
        
        # Should be mathematically correct
        assert abs(percentage - expected) < Decimal('0.01')
        
        # Test scale independence: multiply both by same factor
        scale_factor = Decimal('10')
        scaled_variance = variance_amount * scale_factor
        scaled_planned = planned * scale_factor
        
        scaled_percentage = calculate_variance_percentage(scaled_variance, scaled_planned)
        
        # Percentage should remain the same regardless of scale
        assert abs(percentage - scaled_percentage) < Decimal('0.01')
    
    @given(planned=decimal_amount(min_value=0, max_value=10000000))
    @settings(max_examples=100)
    def test_variance_percentage_zero_planned_handling(self, planned: Decimal):
        """
        Property: Zero planned amount must be handled gracefully.
        
        **Property 41: Edge Case Handling for Zero Budgets**
        **Validates: Requirements 2.4**
        """
        # When planned is zero, percentage should be zero (not error)
        variance_amount = Decimal('100')
        
        if planned == 0:
            percentage = calculate_variance_percentage(variance_amount, planned)
            assert percentage == Decimal('0.00')
        else:
            # Normal calculation should work
            percentage = calculate_variance_percentage(variance_amount, planned)
            assert isinstance(percentage, Decimal)
    
    @given(
        variance_percentage=st.decimals(
            min_value='-100',
            max_value='100',
            places=2
        )
    )
    @settings(max_examples=100)
    def test_variance_status_classification_consistency(self, variance_percentage: Decimal):
        """
        Property: Status classification must be consistent with thresholds.
        
        **Property 42: Variance Status Classification Consistency**
        **Validates: Requirements 2.5**
        """
        status = determine_variance_status(variance_percentage)
        
        # Check status aligns with percentage
        if variance_percentage < Decimal('-5.0'):
            assert status == VarianceStatus.UNDER_BUDGET
        elif variance_percentage > Decimal('5.0'):
            assert status == VarianceStatus.OVER_BUDGET
        else:
            assert status == VarianceStatus.ON_BUDGET
    
    @given(project_data=project_budget_data())
    @settings(max_examples=100)
    def test_project_variance_calculation_completeness(self, project_data: Dict[str, Any]):
        """
        Property: Project variance calculation must return complete results.
        
        **Property 43: Complete Variance Result Structure**
        **Validates: Requirements 2.1, 2.5**
        """
        result = calculate_project_budget_variance(project_data)
        
        # Result must have all required fields
        assert hasattr(result, 'variance_amount')
        assert hasattr(result, 'variance_percentage')
        assert hasattr(result, 'status')
        assert hasattr(result, 'planned_amount')
        assert hasattr(result, 'actual_amount')
        
        # Values must be consistent
        expected_variance = result.actual_amount - result.planned_amount
        assert abs(result.variance_amount - expected_variance) < Decimal('0.01')
        
        # Status must match percentage
        if result.variance_percentage < Decimal('-5.0'):
            assert result.status == VarianceStatus.UNDER_BUDGET
        elif result.variance_percentage > Decimal('5.0'):
            assert result.status == VarianceStatus.OVER_BUDGET
        else:
            assert result.status == VarianceStatus.ON_BUDGET


# ============================================================================
# Property Tests for Currency Conversion
# ============================================================================

class TestCurrencyConversionProperties:
    """
    Property-based tests for currency conversion functions.
    
    **Property 44: Currency Conversion Reciprocal Consistency**
    For any currency conversion A->B->A, the final amount must equal
    the original within acceptable precision limits.
    **Validates: Requirements 2.2, Task 12.1**
    """
    
    @given(
        amount=decimal_amount(min_value=1, max_value=1000000),
        from_currency=currency_code(),
        to_currency=currency_code()
    )
    @settings(max_examples=100)
    def test_currency_conversion_reciprocal_consistency(
        self, amount: Decimal, from_currency: str, to_currency: str
    ):
        """
        Property: Currency conversions must maintain reciprocal consistency.
        
        **Property 44: Currency Conversion Reciprocal Consistency**
        **Validates: Requirements 2.2**
        """
        assume(from_currency != to_currency)  # Skip same currency
        
        # Convert A -> B
        converted = convert_currency(amount, from_currency, to_currency)
        
        # Convert B -> A
        back_converted = convert_currency(converted, to_currency, from_currency)
        
        # Should be approximately equal (within 1% tolerance for large amounts)
        tolerance = max(Decimal('0.02'), amount * Decimal('0.01'))
        difference = abs(back_converted - amount)
        
        assert difference <= tolerance, (
            f"Reciprocal conversion failed: {amount} {from_currency} -> "
            f"{converted} {to_currency} -> {back_converted} {from_currency}, "
            f"difference: {difference}"
        )
    
    @given(
        amount=decimal_amount(min_value=1, max_value=1000000),
        from_currency=currency_code(),
        to_currency=currency_code()
    )
    @settings(max_examples=100)
    def test_currency_conversion_validation_function(
        self, amount: Decimal, from_currency: str, to_currency: str
    ):
        """
        Property: Currency conversion validation must correctly identify valid conversions.
        
        **Property 45: Currency Conversion Validation Accuracy**
        **Validates: Requirements 2.2**
        """
        is_valid, difference = validate_currency_conversion_reciprocal(
            amount, from_currency, to_currency
        )
        
        # Validation should pass for all supported currencies
        if from_currency == to_currency:
            assert is_valid
            assert difference == Decimal('0')
        else:
            # For different currencies, validation should generally pass
            # (may fail for very small amounts due to rounding)
            if amount > Decimal('10'):
                assert is_valid, (
                    f"Validation failed for {amount} {from_currency} -> {to_currency}, "
                    f"difference: {difference}"
                )
    
    @given(
        amount=decimal_amount(min_value=0, max_value=1000000),
        currency=currency_code()
    )
    @settings(max_examples=100)
    def test_same_currency_conversion_identity(self, amount: Decimal, currency: str):
        """
        Property: Converting to the same currency must return the original amount.
        
        **Property 46: Same Currency Conversion Identity**
        **Validates: Requirements 2.2**
        """
        converted = convert_currency(amount, currency, currency)
        
        # Should be exactly equal
        assert converted == amount


# ============================================================================
# Property Tests for Aggregated Variance Calculations
# ============================================================================

class TestAggregatedVarianceProperties:
    """
    Property-based tests for aggregated variance calculations.
    
    **Property 47: Aggregated Variance Calculation Order Independence**
    For any set of financial records, aggregated variance must be
    consistent regardless of calculation order.
    **Validates: Requirements 2.1, Task 12.1**
    """
    
    @given(
        records=st.lists(
            financial_record(),
            min_size=1,
            max_size=50
        )
    )
    @settings(max_examples=100)
    def test_aggregated_variance_order_independence(self, records: list):
        """
        Property: Aggregated variance must be order-independent.
        
        **Property 47: Aggregated Variance Order Independence**
        **Validates: Requirements 2.1**
        """
        # Calculate variance with original order
        result1 = calculate_aggregated_variance(records)
        
        # Calculate variance with reversed order
        result2 = calculate_aggregated_variance(list(reversed(records)))
        
        # Results should be identical
        assert result1.variance_amount == result2.variance_amount
        assert result1.variance_percentage == result2.variance_percentage
        assert result1.status == result2.status
        assert result1.planned_amount == result2.planned_amount
        assert result1.actual_amount == result2.actual_amount
    
    @given(
        records=st.lists(
            financial_record(),
            min_size=2,
            max_size=50
        )
    )
    @settings(max_examples=100)
    def test_aggregated_variance_consistency_with_manual_calculation(self, records: list):
        """
        Property: Aggregated variance must match manual sum calculation.
        
        **Property 48: Aggregated Variance Manual Calculation Consistency**
        **Validates: Requirements 2.1**
        """
        result = calculate_aggregated_variance(records)
        
        # Manually calculate totals
        manual_planned = sum(r['planned_amount'] for r in records)
        manual_actual = sum(r['actual_amount'] for r in records)
        manual_variance = manual_actual - manual_planned
        
        # Should match aggregated result
        assert abs(result.planned_amount - manual_planned) < Decimal('0.01')
        assert abs(result.actual_amount - manual_actual) < Decimal('0.01')
        assert abs(result.variance_amount - manual_variance) < Decimal('0.01')
    
    @given(
        records=st.lists(
            financial_record(),
            min_size=1,
            max_size=50
        )
    )
    @settings(max_examples=100)
    def test_aggregated_variance_non_negative_amounts(self, records: list):
        """
        Property: Aggregated planned and actual amounts must be non-negative.
        
        **Property 49: Aggregated Variance Non-Negative Amounts**
        **Validates: Requirements 2.1**
        """
        result = calculate_aggregated_variance(records)
        
        # Planned and actual amounts should never be negative
        assert result.planned_amount >= 0
        assert result.actual_amount >= 0


# ============================================================================
# Property Tests for Edge Cases
# ============================================================================

class TestFinancialCalculationEdgeCases:
    """
    Property-based tests for edge cases in financial calculations.
    
    **Property 50: Financial Calculation Edge Case Robustness**
    For any edge case input (zero budgets, negative values, extreme amounts),
    calculations must handle them correctly without errors.
    **Validates: Requirements 2.4, Task 12.1**
    """
    
    @given(
        actual=decimal_amount(min_value=0, max_value=1000000)
    )
    @settings(max_examples=100)
    def test_zero_budget_handling(self, actual: Decimal):
        """
        Property: Zero budget must be handled gracefully.
        
        **Property 50: Zero Budget Edge Case Handling**
        **Validates: Requirements 2.4**
        """
        planned = Decimal('0')
        
        # Should not raise an error
        variance_amount = calculate_variance_amount(planned, actual)
        variance_percentage = calculate_variance_percentage(variance_amount, planned)
        
        # Variance amount should equal actual
        assert variance_amount == actual
        
        # Percentage should be zero (not infinity or error)
        assert variance_percentage == Decimal('0.00')
    
    @given(
        planned=decimal_amount(min_value=1, max_value=1000000),
        actual=decimal_amount(min_value=0, max_value=1000000)
    )
    @settings(max_examples=100)
    def test_extreme_variance_percentages(self, planned: Decimal, actual: Decimal):
        """
        Property: Extreme variance percentages must be calculated correctly.
        
        **Property 51: Extreme Variance Percentage Handling**
        **Validates: Requirements 2.4**
        """
        variance_amount = calculate_variance_amount(planned, actual)
        variance_percentage = calculate_variance_percentage(variance_amount, planned)
        
        # Should always return a valid Decimal
        assert isinstance(variance_percentage, Decimal)
        
        # Should match expected calculation
        expected = (variance_amount / planned) * 100
        assert abs(variance_percentage - expected) < Decimal('0.01')
    
    @given(
        amount=st.decimals(
            min_value='0.01',
            max_value='0.99',
            places=2
        ),
        from_currency=currency_code(),
        to_currency=currency_code()
    )
    @settings(max_examples=100)
    def test_small_amount_currency_conversion(
        self, amount: Decimal, from_currency: str, to_currency: str
    ):
        """
        Property: Small amounts must be converted correctly.
        
        **Property 52: Small Amount Currency Conversion**
        **Validates: Requirements 2.2, 2.4**
        """
        # Should not raise an error
        converted = convert_currency(amount, from_currency, to_currency)
        
        # Should return a valid Decimal
        assert isinstance(converted, Decimal)
        
        # Should be non-negative
        assert converted >= 0


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
