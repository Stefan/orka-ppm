"""
Property-Based Tests for Financial Variance Accuracy

This module implements comprehensive property tests for financial variance calculations,
currency conversion reciprocal consistency, and percentage calculation scale independence.

Task: 3.1 Create comprehensive variance calculation tests
**Validates: Requirements 2.1, 2.2, 2.3**

Properties Implemented:
- Property 5: Variance Calculation Mathematical Correctness
- Property 6: Currency Conversion Reciprocal Consistency
- Property 7: Percentage Calculation Scale Independence
"""

import pytest
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any
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
from tests.property_tests.pbt_framework.domain_generators import (
    financial_record_strategy,
    currency_conversion_pair,
    edge_case_financial_record
)

# Import the financial calculations module
from services.financial_calculations import (
    VarianceStatus,
    VarianceResult,
    BASE_EXCHANGE_RATES,
    VARIANCE_THRESHOLDS,
    get_exchange_rate,
    convert_currency,
    calculate_variance_amount,
    calculate_variance_percentage,
    determine_variance_status,
    calculate_project_budget_variance,
    calculate_aggregated_variance,
    validate_currency_conversion_reciprocal,
)


# =============================================================================
# Custom Strategies for Financial Testing
# =============================================================================

@st.composite
def positive_decimal_strategy(draw, min_value=0.01, max_value=10_000_000):
    """Generate positive decimal values for financial amounts."""
    value = draw(st.floats(
        min_value=min_value,
        max_value=max_value,
        allow_nan=False,
        allow_infinity=False
    ))
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@st.composite
def non_negative_decimal_strategy(draw, max_value=10_000_000):
    """Generate non-negative decimal values for financial amounts."""
    value = draw(st.floats(
        min_value=0,
        max_value=max_value,
        allow_nan=False,
        allow_infinity=False
    ))
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@st.composite
def budget_variance_pair(draw):
    """Generate a pair of planned and actual amounts for variance testing."""
    planned = draw(positive_decimal_strategy(min_value=100, max_value=10_000_000))
    
    # Generate actual as a factor of planned (0.5x to 2x)
    factor = draw(st.floats(min_value=0.5, max_value=2.0, allow_nan=False))
    actual = (planned * Decimal(str(factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    return {'planned': planned, 'actual': actual}


@st.composite
def scale_independent_variance_pair(draw):
    """
    Generate variance pairs at different scales with the same percentage.
    
    This strategy generates two budget/actual pairs that should have
    the same variance percentage despite different absolute scales.
    """
    # Generate a base variance percentage
    variance_pct = draw(st.floats(min_value=-50, max_value=100, allow_nan=False))
    
    # Generate two different scales
    scale1 = draw(st.floats(min_value=100, max_value=1000, allow_nan=False))
    scale2 = draw(st.floats(min_value=100000, max_value=10000000, allow_nan=False))
    
    # Calculate actual amounts based on the variance percentage
    # variance_pct = ((actual - planned) / planned) * 100
    # actual = planned * (1 + variance_pct/100)
    factor = 1 + (variance_pct / 100)
    
    planned1 = Decimal(str(scale1)).quantize(Decimal('0.01'))
    actual1 = (planned1 * Decimal(str(factor))).quantize(Decimal('0.01'))
    
    planned2 = Decimal(str(scale2)).quantize(Decimal('0.01'))
    actual2 = (planned2 * Decimal(str(factor))).quantize(Decimal('0.01'))
    
    return {
        'variance_percentage': Decimal(str(variance_pct)).quantize(Decimal('0.01')),
        'small_scale': {'planned': planned1, 'actual': actual1},
        'large_scale': {'planned': planned2, 'actual': actual2}
    }


# =============================================================================
# Property 5: Variance Calculation Mathematical Correctness
# =============================================================================

class TestVarianceCalculationMathematicalCorrectness:
    """
    Property 5: Variance Calculation Mathematical Correctness
    
    For any budget and actual amount combination, variance calculations
    must produce mathematically accurate results following defined formulas.
    
    **Validates: Requirements 2.1**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(pair=budget_variance_pair())
    def test_variance_amount_formula_correctness(self, pair: Dict[str, Decimal]):
        """
        Property test: Variance amount = actual - planned (always)
        
        **Validates: Requirements 2.1**
        
        For any planned and actual amounts, the variance amount must
        equal actual minus planned exactly.
        """
        planned = pair['planned']
        actual = pair['actual']
        
        # Calculate variance using our function
        variance = calculate_variance_amount(planned, actual)
        
        # Calculate expected variance directly
        expected_variance = (actual - planned).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: variance_amount == actual - planned
        assert variance == expected_variance, (
            f"Variance calculation incorrect: "
            f"expected {expected_variance}, got {variance} "
            f"(planned={planned}, actual={actual})"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(pair=budget_variance_pair())
    def test_variance_percentage_formula_correctness(self, pair: Dict[str, Decimal]):
        """
        Property test: Variance percentage = (variance_amount / planned) * 100
        
        **Validates: Requirements 2.1**
        
        For any non-zero planned amount, the variance percentage must
        be calculated correctly using the standard formula.
        """
        planned = pair['planned']
        actual = pair['actual']
        
        # Skip if planned is zero (handled separately)
        assume(planned > 0)
        
        # Calculate variance amount
        variance_amount = calculate_variance_amount(planned, actual)
        
        # Calculate variance percentage using our function
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        
        # Calculate expected percentage directly
        expected_pct = ((variance_amount / planned) * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Property: variance_percentage == (variance_amount / planned) * 100
        assert variance_pct == expected_pct, (
            f"Variance percentage calculation incorrect: "
            f"expected {expected_pct}, got {variance_pct} "
            f"(variance_amount={variance_amount}, planned={planned})"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=100, max_value=1_000_000),
        actual=non_negative_decimal_strategy(max_value=2_000_000)
    )
    def test_complete_variance_calculation_consistency(self, planned: Decimal, actual: Decimal):
        """
        Property test: Complete variance calculation produces consistent results
        
        **Validates: Requirements 2.1**
        
        The calculate_project_budget_variance function must produce
        results that are internally consistent.
        """
        project_data = {'budget': float(planned), 'actual_cost': float(actual)}
        
        result = calculate_project_budget_variance(project_data)
        
        # Verify internal consistency
        # 1. Variance amount should equal actual - planned
        expected_variance = (actual - planned).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert result.variance_amount == expected_variance, (
            f"Variance amount inconsistent: expected {expected_variance}, got {result.variance_amount}"
        )
        
        # 2. If planned > 0, percentage should be (variance / planned) * 100
        if planned > 0:
            expected_pct = ((result.variance_amount / planned) * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            assert result.variance_percentage == expected_pct, (
                f"Variance percentage inconsistent: expected {expected_pct}, got {result.variance_percentage}"
            )
        
        # 3. Stored amounts should match inputs
        assert result.planned_amount == planned.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert result.actual_amount == actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @settings(max_examples=50, deadline=None)
    @given(record=DomainGenerators.financial_record())
    def test_variance_with_domain_generator(self, record: Dict[str, Any]):
        """
        Property test: Variance calculations work with domain-generated data
        
        **Validates: Requirements 2.1**
        
        Using the DomainGenerators.financial_record() strategy, verify
        that variance calculations produce mathematically correct results.
        """
        planned = Decimal(str(record['planned_amount']))
        actual = Decimal(str(record['actual_amount']))
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        
        # Verify mathematical correctness
        expected = (actual - planned).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert variance_amount == expected
        
        # Verify percentage if planned > 0
        if planned > 0:
            variance_pct = calculate_variance_percentage(variance_amount, planned)
            expected_pct = ((variance_amount / planned) * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            assert variance_pct == expected_pct


# =============================================================================
# Property 6: Currency Conversion Reciprocal Consistency
# =============================================================================

class TestCurrencyConversionReciprocalConsistency:
    """
    Property 6: Currency Conversion Reciprocal Consistency
    
    For any currency conversion sequence (A→B→A), the final amount
    must equal the original amount within acceptable precision limits.
    
    **Validates: Requirements 2.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(pair=currency_conversion_pair())
    def test_currency_conversion_reciprocal(self, pair: Dict[str, Any]):
        """
        Property test: A→B→A conversion returns original amount (within tolerance)
        
        **Validates: Requirements 2.2**
        
        For any amount in currency A, converting to currency B and back
        to currency A should return approximately the original amount.
        """
        from_currency = pair['from_currency']
        to_currency = pair['to_currency']
        amount = Decimal(str(pair['amount']))
        
        # Skip same currency (trivial case)
        if from_currency == to_currency:
            converted = convert_currency(amount, from_currency, to_currency)
            assert converted == amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            return
        
        # For currencies with very different scales (like JPY), small amounts
        # can cause precision issues. Skip amounts that would convert to < 1 unit.
        # JPY rate is ~150, so 1 JPY = ~0.007 USD
        if from_currency == 'JPY' and amount < 150:
            assume(False)  # Skip this case
        if to_currency == 'JPY' and amount < 1:
            assume(False)  # Skip this case
        
        # Convert A -> B
        converted = convert_currency(amount, from_currency, to_currency)
        
        # Skip if converted amount is too small (precision issues)
        assume(converted >= Decimal('0.10'))
        
        # Convert B -> A
        back_converted = convert_currency(converted, to_currency, from_currency)
        
        # Calculate difference
        original_rounded = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        difference = abs(back_converted - original_rounded)
        
        # Tolerance: 1% of original amount or 0.02, whichever is larger
        tolerance = max(Decimal('0.02'), amount * Decimal('0.01'))
        
        # Property: |back_converted - original| <= tolerance
        assert difference <= tolerance, (
            f"Reciprocal conversion failed: "
            f"original={amount}, converted={converted}, back={back_converted}, "
            f"difference={difference}, tolerance={tolerance}, "
            f"currencies={from_currency}->{to_currency}->{from_currency}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        amount=positive_decimal_strategy(min_value=100, max_value=1_000_000),
        from_currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys())),
        to_currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys()))
    )
    def test_currency_conversion_reciprocal_with_validation(
        self, amount: Decimal, from_currency: str, to_currency: str
    ):
        """
        Property test: validate_currency_conversion_reciprocal returns True
        
        **Validates: Requirements 2.2**
        
        The validation function should confirm reciprocal consistency
        for all valid currency pairs. We use amounts >= 100 to avoid
        precision issues with very small amounts in high-rate currencies
        like JPY (where 1 JPY = ~0.007 USD).
        """
        is_valid, difference = validate_currency_conversion_reciprocal(
            amount, from_currency, to_currency
        )
        
        # Property: All conversions should be reciprocally consistent
        assert is_valid, (
            f"Reciprocal validation failed: "
            f"amount={amount}, {from_currency}->{to_currency}, "
            f"difference={difference}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        amount=positive_decimal_strategy(min_value=100, max_value=100_000),
        currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys()))
    )
    def test_same_currency_conversion_identity(self, amount: Decimal, currency: str):
        """
        Property test: Same currency conversion returns identical amount
        
        **Validates: Requirements 2.2**
        
        Converting from a currency to itself should return the exact
        same amount (identity property).
        """
        converted = convert_currency(amount, currency, currency)
        expected = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: convert(amount, X, X) == amount
        assert converted == expected, (
            f"Same currency conversion failed: "
            f"expected {expected}, got {converted}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        from_currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys())),
        to_currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys()))
    )
    def test_exchange_rate_reciprocal_relationship(self, from_currency: str, to_currency: str):
        """
        Property test: Exchange rates are reciprocally related
        
        **Validates: Requirements 2.2**
        
        For any currency pair, rate(A->B) * rate(B->A) should equal 1
        (within floating point precision).
        """
        rate_ab = get_exchange_rate(from_currency, to_currency)
        rate_ba = get_exchange_rate(to_currency, from_currency)
        
        # Property: rate(A->B) * rate(B->A) ≈ 1
        product = rate_ab * rate_ba
        
        # Allow small tolerance for floating point precision
        tolerance = Decimal('0.0001')
        assert abs(product - Decimal('1')) <= tolerance, (
            f"Exchange rate reciprocal failed: "
            f"rate({from_currency}->{to_currency})={rate_ab}, "
            f"rate({to_currency}->{from_currency})={rate_ba}, "
            f"product={product}"
        )
    
    @settings(max_examples=30, deadline=None)
    @given(
        amount=positive_decimal_strategy(min_value=1000, max_value=100_000),
        currency_a=st.sampled_from(['USD', 'EUR', 'GBP']),
        currency_b=st.sampled_from(['JPY', 'CAD', 'AUD']),
        currency_c=st.sampled_from(['CHF', 'EUR', 'USD'])
    )
    def test_multi_hop_conversion_consistency(
        self, amount: Decimal, currency_a: str, currency_b: str, currency_c: str
    ):
        """
        Property test: Multi-hop conversions are consistent
        
        **Validates: Requirements 2.2**
        
        Converting A->B->C should give the same result as A->C
        (within acceptable precision).
        """
        # Direct conversion A -> C
        direct = convert_currency(amount, currency_a, currency_c)
        
        # Multi-hop conversion A -> B -> C
        via_b = convert_currency(amount, currency_a, currency_b)
        multi_hop = convert_currency(via_b, currency_b, currency_c)
        
        # Calculate difference
        difference = abs(direct - multi_hop)
        
        # Tolerance: 2% of the amount (multi-hop accumulates rounding errors)
        tolerance = max(Decimal('0.05'), amount * Decimal('0.02'))
        
        # Property: |direct - multi_hop| <= tolerance
        assert difference <= tolerance, (
            f"Multi-hop conversion inconsistent: "
            f"direct={direct}, multi_hop={multi_hop}, "
            f"difference={difference}, tolerance={tolerance}, "
            f"path={currency_a}->{currency_b}->{currency_c}"
        )


# =============================================================================
# Property 7: Percentage Calculation Scale Independence
# =============================================================================

class TestPercentageCalculationScaleIndependence:
    """
    Property 7: Percentage Calculation Scale Independence
    
    For any budget variance calculation, percentage results must be
    accurate regardless of the absolute budget scale or magnitude.
    
    **Validates: Requirements 2.3**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(data=scale_independent_variance_pair())
    def test_percentage_scale_independence(self, data: Dict[str, Any]):
        """
        Property test: Same percentage at different scales
        
        **Validates: Requirements 2.3**
        
        Two budget/actual pairs with the same variance ratio should
        produce the same variance percentage regardless of scale.
        """
        small = data['small_scale']
        large = data['large_scale']
        
        # Calculate variance for small scale
        small_variance = calculate_variance_amount(small['planned'], small['actual'])
        small_pct = calculate_variance_percentage(small_variance, small['planned'])
        
        # Calculate variance for large scale
        large_variance = calculate_variance_amount(large['planned'], large['actual'])
        large_pct = calculate_variance_percentage(large_variance, large['planned'])
        
        # Property: percentages should be equal (within rounding tolerance)
        tolerance = Decimal('0.02')  # Allow 0.02% difference due to rounding
        difference = abs(small_pct - large_pct)
        
        assert difference <= tolerance, (
            f"Scale independence violated: "
            f"small_pct={small_pct}, large_pct={large_pct}, "
            f"difference={difference}, "
            f"small_scale={small}, large_scale={large}"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        base_planned=positive_decimal_strategy(min_value=100, max_value=1000),
        variance_ratio=st.floats(min_value=-0.5, max_value=1.0, allow_nan=False),
        scale_factor=st.floats(min_value=1, max_value=10000, allow_nan=False)
    )
    def test_percentage_invariant_under_scaling(
        self, base_planned: Decimal, variance_ratio: float, scale_factor: float
    ):
        """
        Property test: Percentage is invariant when both amounts are scaled
        
        **Validates: Requirements 2.3**
        
        If we multiply both planned and actual by the same factor,
        the variance percentage should remain unchanged.
        """
        # Calculate actual based on variance ratio
        # variance_ratio = (actual - planned) / planned
        # actual = planned * (1 + variance_ratio)
        base_actual = base_planned * Decimal(str(1 + variance_ratio))
        base_actual = base_actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate base percentage
        base_variance = calculate_variance_amount(base_planned, base_actual)
        base_pct = calculate_variance_percentage(base_variance, base_planned)
        
        # Scale both amounts
        scale = Decimal(str(scale_factor))
        scaled_planned = (base_planned * scale).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        scaled_actual = (base_actual * scale).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate scaled percentage
        scaled_variance = calculate_variance_amount(scaled_planned, scaled_actual)
        scaled_pct = calculate_variance_percentage(scaled_variance, scaled_planned)
        
        # Property: base_pct ≈ scaled_pct
        tolerance = Decimal('0.05')  # Allow small rounding differences
        difference = abs(base_pct - scaled_pct)
        
        assert difference <= tolerance, (
            f"Percentage not invariant under scaling: "
            f"base_pct={base_pct}, scaled_pct={scaled_pct}, "
            f"difference={difference}, scale_factor={scale_factor}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=100, max_value=100_000_000),
        percentage=st.floats(min_value=-99, max_value=200, allow_nan=False)
    )
    def test_percentage_calculation_accuracy_at_any_scale(
        self, planned: Decimal, percentage: float
    ):
        """
        Property test: Percentage calculation is accurate at any scale
        
        **Validates: Requirements 2.3**
        
        Given a target percentage, we should be able to calculate the
        actual amount and verify the percentage is computed correctly.
        
        Note: We use planned >= 100 to ensure sufficient precision.
        With very small planned amounts (e.g., 1.00), small percentages
        result in variances that round to different values.
        """
        target_pct = Decimal(str(percentage)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate actual from target percentage
        # percentage = (variance / planned) * 100
        # variance = percentage * planned / 100
        # actual = planned + variance
        variance = (target_pct * planned / 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        actual = planned + variance
        
        # Calculate percentage using our function
        calculated_variance = calculate_variance_amount(planned, actual)
        calculated_pct = calculate_variance_percentage(calculated_variance, planned)
        
        # Property: calculated_pct ≈ target_pct
        # Tolerance scales with the inverse of planned amount
        # Larger amounts = more precision, smaller tolerance
        base_tolerance = Decimal('0.05')
        tolerance = max(base_tolerance, Decimal('100') / planned)
        difference = abs(calculated_pct - target_pct)
        
        assert difference <= tolerance, (
            f"Percentage calculation inaccurate: "
            f"target={target_pct}, calculated={calculated_pct}, "
            f"difference={difference}, planned={planned}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        small_budget=positive_decimal_strategy(min_value=100, max_value=1000),
        large_budget=positive_decimal_strategy(min_value=1_000_000, max_value=100_000_000),
        variance_pct=st.floats(min_value=-50, max_value=100, allow_nan=False)
    )
    def test_status_classification_scale_independence(
        self, small_budget: Decimal, large_budget: Decimal, variance_pct: float
    ):
        """
        Property test: Status classification is scale-independent
        
        **Validates: Requirements 2.3, 2.5**
        
        The same variance percentage should produce the same status
        classification regardless of the budget scale.
        """
        target_pct = Decimal(str(variance_pct))
        
        # Calculate actuals for both scales
        small_variance = (target_pct * small_budget / 100).quantize(Decimal('0.01'))
        small_actual = small_budget + small_variance
        
        large_variance = (target_pct * large_budget / 100).quantize(Decimal('0.01'))
        large_actual = large_budget + large_variance
        
        # Get results for both scales
        small_result = calculate_project_budget_variance({
            'budget': float(small_budget),
            'actual_cost': float(small_actual)
        })
        
        large_result = calculate_project_budget_variance({
            'budget': float(large_budget),
            'actual_cost': float(large_actual)
        })
        
        # Property: status should be the same for both scales
        assert small_result.status == large_result.status, (
            f"Status classification differs by scale: "
            f"small_status={small_result.status}, large_status={large_result.status}, "
            f"small_pct={small_result.variance_percentage}, "
            f"large_pct={large_result.variance_percentage}, "
            f"target_pct={target_pct}"
        )


# =============================================================================
# Additional Integration Tests
# =============================================================================

class TestFinancialVarianceIntegration:
    """
    Integration tests combining multiple properties.
    
    **Validates: Requirements 2.1, 2.2, 2.3**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(records=st.lists(DomainGenerators.financial_record(), min_size=1, max_size=10))
    def test_aggregated_variance_mathematical_correctness(self, records: list):
        """
        Property test: Aggregated variance is mathematically correct
        
        **Validates: Requirements 2.1**
        
        The aggregated variance should equal the sum of individual variances.
        """
        # Calculate aggregated result
        result = calculate_aggregated_variance(records)
        
        # Calculate expected totals manually
        expected_planned = sum(
            Decimal(str(r['planned_amount'])) for r in records
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        expected_actual = sum(
            Decimal(str(r['actual_amount'])) for r in records
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        expected_variance = (expected_actual - expected_planned).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Verify aggregation
        assert result.planned_amount == expected_planned
        assert result.actual_amount == expected_actual
        assert result.variance_amount == expected_variance
    
    @settings(max_examples=30, deadline=None)
    @given(
        record=DomainGenerators.financial_record(min_amount=100, max_amount=1_000_000),
        target_currency=st.sampled_from(list(BASE_EXCHANGE_RATES.keys()))
    )
    def test_variance_preserved_after_currency_conversion(
        self, record: Dict[str, Any], target_currency: str
    ):
        """
        Property test: Variance percentage preserved after currency conversion
        
        **Validates: Requirements 2.1, 2.2, 2.3**
        
        Converting both planned and actual to a different currency
        should preserve the variance percentage.
        
        Note: We use amounts >= 100 to ensure sufficient precision.
        Very small amounts accumulate rounding errors during conversion.
        """
        source_currency = record['currency']
        planned = Decimal(str(record['planned_amount']))
        actual = Decimal(str(record['actual_amount']))
        
        # Skip if planned is too small (precision issues)
        assume(planned >= 10)
        
        # Calculate original variance percentage
        original_variance = calculate_variance_amount(planned, actual)
        original_pct = calculate_variance_percentage(original_variance, planned)
        
        # Convert both amounts to target currency
        converted_planned = convert_currency(planned, source_currency, target_currency)
        converted_actual = convert_currency(actual, source_currency, target_currency)
        
        # Skip if converted amounts are too small (precision issues with JPY etc.)
        assume(converted_planned >= 1)
        
        # Calculate converted variance percentage
        converted_variance = calculate_variance_amount(converted_planned, converted_actual)
        converted_pct = calculate_variance_percentage(converted_variance, converted_planned)
        
        # Property: percentage should be preserved (within tolerance)
        # Tolerance is larger for currency conversion due to accumulated rounding
        tolerance = Decimal('1.0')  # Allow 1% difference due to rounding
        difference = abs(original_pct - converted_pct)
        
        assert difference <= tolerance, (
            f"Variance percentage not preserved after conversion: "
            f"original_pct={original_pct}, converted_pct={converted_pct}, "
            f"difference={difference}, "
            f"currencies={source_currency}->{target_currency}"
        )


# =============================================================================
# Property 8: Edge Case Handling Robustness
# =============================================================================

class TestEdgeCaseHandlingRobustness:
    """
    Property 8: Edge Case Handling Robustness
    
    For any edge case input (zero budgets, negative values, extreme amounts),
    variance calculations must handle them correctly without errors.
    
    **Validates: Requirements 2.4**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(record=edge_case_financial_record())
    def test_edge_case_variance_calculation_no_errors(self, record: Dict[str, Any]):
        """
        Property test: Edge case inputs don't cause errors
        
        **Validates: Requirements 2.4**
        
        For any edge case financial record (zero budgets, tiny amounts,
        large amounts, extreme variances), the variance calculation
        should complete without raising exceptions.
        """
        planned = Decimal(str(record['planned_amount']))
        actual = Decimal(str(record['actual_amount']))
        
        # Property: No exceptions should be raised
        try:
            variance_amount = calculate_variance_amount(planned, actual)
            variance_pct = calculate_variance_percentage(variance_amount, planned)
            status = determine_variance_status(variance_pct)
            
            # Verify results are valid Decimal/enum values
            assert isinstance(variance_amount, Decimal)
            assert isinstance(variance_pct, Decimal)
            assert isinstance(status, VarianceStatus)
        except Exception as e:
            pytest.fail(
                f"Edge case caused error: {e}\n"
                f"edge_case_type={record['edge_case_type']}, "
                f"planned={planned}, actual={actual}"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(actual=non_negative_decimal_strategy(max_value=1_000_000))
    def test_zero_budget_handling(self, actual: Decimal):
        """
        Property test: Zero budget is handled correctly
        
        **Validates: Requirements 2.4**
        
        When planned budget is zero, the system should:
        - Calculate variance amount correctly (actual - 0 = actual)
        - Return 0% variance percentage (to avoid division by zero)
        - Not raise any exceptions
        """
        planned = Decimal('0')
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        
        # Property: variance_amount should equal actual when planned is 0
        assert variance_amount == actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), (
            f"Zero budget variance incorrect: expected {actual}, got {variance_amount}"
        )
        
        # Property: variance_percentage should be 0 when planned is 0
        assert variance_pct == Decimal('0.00'), (
            f"Zero budget percentage should be 0, got {variance_pct}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=st.floats(min_value=0.01, max_value=1.0, allow_nan=False, allow_infinity=False),
        actual=st.floats(min_value=0.01, max_value=2.0, allow_nan=False, allow_infinity=False)
    )
    def test_very_small_amounts_precision(self, planned: float, actual: float):
        """
        Property test: Very small amounts maintain precision
        
        **Validates: Requirements 2.4**
        
        For very small amounts (near zero), variance calculations
        should maintain precision and produce correct results.
        """
        planned_dec = Decimal(str(planned)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        actual_dec = Decimal(str(actual)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Skip if planned rounds to zero
        assume(planned_dec > 0)
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned_dec, actual_dec)
        variance_pct = calculate_variance_percentage(variance_amount, planned_dec)
        
        # Property: variance_amount should be mathematically correct
        expected_variance = (actual_dec - planned_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert variance_amount == expected_variance, (
            f"Small amount variance incorrect: expected {expected_variance}, got {variance_amount}"
        )
        
        # Property: variance_percentage should be mathematically correct
        expected_pct = ((variance_amount / planned_dec) * 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert variance_pct == expected_pct, (
            f"Small amount percentage incorrect: expected {expected_pct}, got {variance_pct}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=st.floats(min_value=1_000_000, max_value=1_000_000_000, allow_nan=False, allow_infinity=False),
        actual=st.floats(min_value=500_000, max_value=1_500_000_000, allow_nan=False, allow_infinity=False)
    )
    def test_very_large_amounts_handling(self, planned: float, actual: float):
        """
        Property test: Very large amounts (millions/billions) are handled correctly
        
        **Validates: Requirements 2.4**
        
        For very large amounts, variance calculations should:
        - Not overflow or lose precision
        - Produce mathematically correct results
        - Handle the full range of realistic financial values
        """
        planned_dec = Decimal(str(planned)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        actual_dec = Decimal(str(actual)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned_dec, actual_dec)
        variance_pct = calculate_variance_percentage(variance_amount, planned_dec)
        
        # Property: variance_amount should be mathematically correct
        expected_variance = (actual_dec - planned_dec).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert variance_amount == expected_variance, (
            f"Large amount variance incorrect: expected {expected_variance}, got {variance_amount}"
        )
        
        # Property: variance_percentage should be mathematically correct
        expected_pct = ((variance_amount / planned_dec) * 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert variance_pct == expected_pct, (
            f"Large amount percentage incorrect: expected {expected_pct}, got {variance_pct}"
        )
        
        # Property: Results should be finite and reasonable
        assert variance_amount.is_finite()
        assert variance_pct.is_finite()
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000),
        over_factor=st.floats(min_value=2.0, max_value=20.0, allow_nan=False, allow_infinity=False)
    )
    def test_extreme_over_budget_variance(self, planned: Decimal, over_factor: float):
        """
        Property test: Extreme over-budget scenarios (100%+ over) are handled correctly
        
        **Validates: Requirements 2.4**
        
        For extreme over-budget scenarios (e.g., 1000% over budget),
        the system should calculate correct variance percentages
        without overflow or errors.
        """
        actual = (planned * Decimal(str(over_factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: variance_amount should be positive (over budget)
        assert variance_amount > 0, (
            f"Over budget variance should be positive: got {variance_amount}"
        )
        
        # Property: variance_percentage should be > 100% for factor > 2
        expected_pct = ((over_factor - 1) * 100)
        assert float(variance_pct) >= 100, (
            f"Extreme over budget should have >= 100% variance: got {variance_pct}"
        )
        
        # Property: status should be OVER_BUDGET
        assert status == VarianceStatus.OVER_BUDGET, (
            f"Extreme over budget should have OVER_BUDGET status: got {status}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000),
        under_factor=st.floats(min_value=0.01, max_value=0.5, allow_nan=False, allow_infinity=False)
    )
    def test_extreme_under_budget_variance(self, planned: Decimal, under_factor: float):
        """
        Property test: Extreme under-budget scenarios (50%+ under) are handled correctly
        
        **Validates: Requirements 2.4**
        
        For extreme under-budget scenarios (e.g., only 10% of budget used),
        the system should calculate correct negative variance percentages.
        """
        actual = (planned * Decimal(str(under_factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: variance_amount should be negative (under budget)
        assert variance_amount < 0, (
            f"Under budget variance should be negative: got {variance_amount}"
        )
        
        # Property: variance_percentage should be significantly negative
        # With under_factor in [0.01, 0.5], variance should be <= -50%
        assert variance_pct <= Decimal('-50'), (
            f"Extreme under budget should have <= -50% variance: got {variance_pct}"
        )
        
        # Property: status should be UNDER_BUDGET
        assert status == VarianceStatus.UNDER_BUDGET, (
            f"Extreme under budget should have UNDER_BUDGET status: got {status}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(record=edge_case_financial_record())
    def test_complete_variance_result_for_edge_cases(self, record: Dict[str, Any]):
        """
        Property test: Complete variance calculation works for all edge cases
        
        **Validates: Requirements 2.4**
        
        The calculate_project_budget_variance function should handle
        all edge case types and produce valid VarianceResult objects.
        """
        project_data = {
            'budget': record['planned_amount'],
            'actual_cost': record['actual_amount']
        }
        
        # Property: Should not raise exceptions
        try:
            result = calculate_project_budget_variance(project_data)
            
            # Verify result is valid
            assert isinstance(result, VarianceResult)
            assert isinstance(result.variance_amount, Decimal)
            assert isinstance(result.variance_percentage, Decimal)
            assert isinstance(result.status, VarianceStatus)
            assert isinstance(result.planned_amount, Decimal)
            assert isinstance(result.actual_amount, Decimal)
            
            # Verify internal consistency
            expected_variance = (result.actual_amount - result.planned_amount).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            assert result.variance_amount == expected_variance
            
        except Exception as e:
            pytest.fail(
                f"Edge case caused error in complete calculation: {e}\n"
                f"edge_case_type={record['edge_case_type']}, "
                f"planned={record['planned_amount']}, actual={record['actual_amount']}"
            )


# =============================================================================
# Property 9: Status Classification Consistency
# =============================================================================

class TestStatusClassificationConsistency:
    """
    Property 9: Status Classification Consistency
    
    For any calculated variance percentage, the status classification
    (over/under/on budget) must align correctly with the percentage thresholds.
    
    Default thresholds:
    - Under budget: variance_percentage < -5%
    - On budget: -5% <= variance_percentage <= 5%
    - Over budget: variance_percentage > 5%
    
    **Validates: Requirements 2.5**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(variance_pct=st.floats(min_value=-100, max_value=200, allow_nan=False, allow_infinity=False))
    def test_status_classification_alignment(self, variance_pct: float):
        """
        Property test: Status classification aligns with percentage thresholds
        
        **Validates: Requirements 2.5**
        
        For any variance percentage, the status classification must
        correctly reflect whether the project is under, on, or over budget
        according to the defined thresholds.
        """
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = determine_variance_status(variance_decimal)
        
        under_threshold = VARIANCE_THRESHOLDS['under_threshold']
        over_threshold = VARIANCE_THRESHOLDS['over_threshold']
        
        # Property: Status must align with thresholds
        if variance_decimal < under_threshold:
            assert status == VarianceStatus.UNDER_BUDGET, (
                f"Variance {variance_decimal}% < {under_threshold}% should be UNDER_BUDGET, got {status}"
            )
        elif variance_decimal > over_threshold:
            assert status == VarianceStatus.OVER_BUDGET, (
                f"Variance {variance_decimal}% > {over_threshold}% should be OVER_BUDGET, got {status}"
            )
        else:
            assert status == VarianceStatus.ON_BUDGET, (
                f"Variance {variance_decimal}% in [{under_threshold}%, {over_threshold}%] should be ON_BUDGET, got {status}"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=100, max_value=1_000_000),
        actual=non_negative_decimal_strategy(max_value=2_000_000)
    )
    def test_status_consistency_with_calculated_percentage(self, planned: Decimal, actual: Decimal):
        """
        Property test: Status is consistent with calculated percentage
        
        **Validates: Requirements 2.5**
        
        When calculating variance from planned/actual amounts, the
        resulting status must be consistent with the calculated percentage.
        """
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Also get status from complete calculation
        result = calculate_project_budget_variance({
            'budget': float(planned),
            'actual_cost': float(actual)
        })
        
        # Property: Both methods should produce same status
        assert status == result.status, (
            f"Status inconsistency: direct={status}, result={result.status}, "
            f"variance_pct={variance_pct}"
        )
        
        # Property: Status must align with percentage
        under_threshold = VARIANCE_THRESHOLDS['under_threshold']
        over_threshold = VARIANCE_THRESHOLDS['over_threshold']
        
        if variance_pct < under_threshold:
            assert status == VarianceStatus.UNDER_BUDGET
        elif variance_pct > over_threshold:
            assert status == VarianceStatus.OVER_BUDGET
        else:
            assert status == VarianceStatus.ON_BUDGET
    
    @settings(max_examples=20, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000)
    )
    def test_boundary_condition_exactly_at_under_threshold(self, planned: Decimal):
        """
        Property test: Exactly at under-budget threshold (-5%)
        
        **Validates: Requirements 2.5**
        
        When variance percentage is exactly at the under-budget threshold,
        the status should be ON_BUDGET (threshold is exclusive).
        """
        # Calculate actual to get exactly -5% variance
        # variance_pct = (actual - planned) / planned * 100 = -5
        # actual - planned = -0.05 * planned
        # actual = planned - 0.05 * planned = 0.95 * planned
        actual = (planned * Decimal('0.95')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: At exactly -5%, status should be ON_BUDGET
        # (threshold is < -5%, not <= -5%)
        assert status == VarianceStatus.ON_BUDGET, (
            f"At -5% threshold, status should be ON_BUDGET, got {status} "
            f"(variance_pct={variance_pct})"
        )
    
    @settings(max_examples=20, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000)
    )
    def test_boundary_condition_exactly_at_over_threshold(self, planned: Decimal):
        """
        Property test: Exactly at over-budget threshold (+5%)
        
        **Validates: Requirements 2.5**
        
        When variance percentage is exactly at the over-budget threshold,
        the status should be ON_BUDGET (threshold is exclusive).
        """
        # Calculate actual to get exactly +5% variance
        # actual = planned + 0.05 * planned = 1.05 * planned
        actual = (planned * Decimal('1.05')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: At exactly +5%, status should be ON_BUDGET
        # (threshold is > +5%, not >= +5%)
        assert status == VarianceStatus.ON_BUDGET, (
            f"At +5% threshold, status should be ON_BUDGET, got {status} "
            f"(variance_pct={variance_pct})"
        )
    
    @settings(max_examples=20, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000),
        epsilon=st.floats(min_value=0.01, max_value=0.1, allow_nan=False)
    )
    def test_boundary_condition_just_below_under_threshold(self, planned: Decimal, epsilon: float):
        """
        Property test: Just below under-budget threshold
        
        **Validates: Requirements 2.5**
        
        When variance percentage is just below -5% (e.g., -5.01%),
        the status should be UNDER_BUDGET.
        """
        # Calculate actual to get slightly below -5% variance
        # variance_pct = -5 - epsilon
        target_pct = Decimal('-5') - Decimal(str(epsilon))
        # actual = planned * (1 + target_pct/100)
        actual = (planned * (1 + target_pct / 100)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: Just below -5%, status should be UNDER_BUDGET
        assert status == VarianceStatus.UNDER_BUDGET, (
            f"Below -5% threshold, status should be UNDER_BUDGET, got {status} "
            f"(variance_pct={variance_pct}, target={target_pct})"
        )
    
    @settings(max_examples=20, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1000, max_value=100000),
        epsilon=st.floats(min_value=0.01, max_value=0.1, allow_nan=False)
    )
    def test_boundary_condition_just_above_over_threshold(self, planned: Decimal, epsilon: float):
        """
        Property test: Just above over-budget threshold
        
        **Validates: Requirements 2.5**
        
        When variance percentage is just above +5% (e.g., +5.01%),
        the status should be OVER_BUDGET.
        """
        # Calculate actual to get slightly above +5% variance
        # variance_pct = 5 + epsilon
        target_pct = Decimal('5') + Decimal(str(epsilon))
        # actual = planned * (1 + target_pct/100)
        actual = (planned * (1 + target_pct / 100)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: Just above +5%, status should be OVER_BUDGET
        assert status == VarianceStatus.OVER_BUDGET, (
            f"Above +5% threshold, status should be OVER_BUDGET, got {status} "
            f"(variance_pct={variance_pct}, target={target_pct})"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        variance_pct=st.floats(min_value=-4.99, max_value=4.99, allow_nan=False)
    )
    def test_on_budget_range(self, variance_pct: float):
        """
        Property test: Values within on-budget range are classified correctly
        
        **Validates: Requirements 2.5**
        
        Any variance percentage strictly between -5% and +5% should
        be classified as ON_BUDGET.
        """
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = determine_variance_status(variance_decimal)
        
        # Property: Values in (-5%, +5%) should be ON_BUDGET
        assert status == VarianceStatus.ON_BUDGET, (
            f"Variance {variance_decimal}% in on-budget range should be ON_BUDGET, got {status}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        variance_pct=st.floats(min_value=-100, max_value=-5.01, allow_nan=False)
    )
    def test_under_budget_range(self, variance_pct: float):
        """
        Property test: Values below under-budget threshold are classified correctly
        
        **Validates: Requirements 2.5**
        
        Any variance percentage below -5% should be classified as UNDER_BUDGET.
        """
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = determine_variance_status(variance_decimal)
        
        # Property: Values < -5% should be UNDER_BUDGET
        assert status == VarianceStatus.UNDER_BUDGET, (
            f"Variance {variance_decimal}% below threshold should be UNDER_BUDGET, got {status}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        variance_pct=st.floats(min_value=5.01, max_value=500, allow_nan=False)
    )
    def test_over_budget_range(self, variance_pct: float):
        """
        Property test: Values above over-budget threshold are classified correctly
        
        **Validates: Requirements 2.5**
        
        Any variance percentage above +5% should be classified as OVER_BUDGET.
        """
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = determine_variance_status(variance_decimal)
        
        # Property: Values > +5% should be OVER_BUDGET
        assert status == VarianceStatus.OVER_BUDGET, (
            f"Variance {variance_decimal}% above threshold should be OVER_BUDGET, got {status}"
        )
    
    @settings(max_examples=30, deadline=None)
    @given(
        under_threshold=st.floats(min_value=-20, max_value=-1, allow_nan=False),
        over_threshold=st.floats(min_value=1, max_value=20, allow_nan=False),
        variance_pct=st.floats(min_value=-50, max_value=100, allow_nan=False)
    )
    def test_custom_thresholds_consistency(
        self, under_threshold: float, over_threshold: float, variance_pct: float
    ):
        """
        Property test: Custom thresholds work correctly
        
        **Validates: Requirements 2.5**
        
        The status classification should work correctly with custom
        threshold values, not just the default -5%/+5%.
        """
        custom_thresholds = {
            'under_threshold': Decimal(str(under_threshold)),
            'over_threshold': Decimal(str(over_threshold))
        }
        
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = determine_variance_status(variance_decimal, custom_thresholds)
        
        # Property: Status must align with custom thresholds
        if variance_decimal < custom_thresholds['under_threshold']:
            assert status == VarianceStatus.UNDER_BUDGET, (
                f"Variance {variance_decimal}% < {under_threshold}% should be UNDER_BUDGET"
            )
        elif variance_decimal > custom_thresholds['over_threshold']:
            assert status == VarianceStatus.OVER_BUDGET, (
                f"Variance {variance_decimal}% > {over_threshold}% should be OVER_BUDGET"
            )
        else:
            assert status == VarianceStatus.ON_BUDGET, (
                f"Variance {variance_decimal}% in range should be ON_BUDGET"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(record=edge_case_financial_record())
    def test_status_classification_for_edge_cases(self, record: Dict[str, Any]):
        """
        Property test: Status classification works for edge case inputs
        
        **Validates: Requirements 2.4, 2.5**
        
        For edge case financial records, the status classification
        should still be consistent with the calculated variance percentage.
        """
        planned = Decimal(str(record['planned_amount']))
        actual = Decimal(str(record['actual_amount']))
        
        # Calculate variance
        variance_amount = calculate_variance_amount(planned, actual)
        variance_pct = calculate_variance_percentage(variance_amount, planned)
        status = determine_variance_status(variance_pct)
        
        # Property: Status must align with percentage
        under_threshold = VARIANCE_THRESHOLDS['under_threshold']
        over_threshold = VARIANCE_THRESHOLDS['over_threshold']
        
        if variance_pct < under_threshold:
            assert status == VarianceStatus.UNDER_BUDGET, (
                f"Edge case {record['edge_case_type']}: "
                f"variance {variance_pct}% should be UNDER_BUDGET, got {status}"
            )
        elif variance_pct > over_threshold:
            assert status == VarianceStatus.OVER_BUDGET, (
                f"Edge case {record['edge_case_type']}: "
                f"variance {variance_pct}% should be OVER_BUDGET, got {status}"
            )
        else:
            assert status == VarianceStatus.ON_BUDGET, (
                f"Edge case {record['edge_case_type']}: "
                f"variance {variance_pct}% should be ON_BUDGET, got {status}"
            )


# =============================================================================
# Run tests if executed directly
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
