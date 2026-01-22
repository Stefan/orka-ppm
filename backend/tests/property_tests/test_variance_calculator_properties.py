"""
Property-Based Tests for VarianceCalculator Service

This module implements comprehensive property tests for the VarianceCalculator class,
validating financial calculation consistency, currency conversion accuracy, and
variance analysis correctness across all valid inputs.

Task: 3.3 Write property tests for financial calculations
**Property 3: Financial Calculation Consistency**
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Properties Implemented:
- Remaining amount calculation correctness (planned - actual)
- Variance percentage mathematical accuracy
- Currency conversion reciprocal consistency
- Variance status classification alignment
- Project variance aggregation correctness
- Budget overrun detection accuracy
- Alert generation threshold compliance
"""

import pytest
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List
from uuid import uuid4
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from hypothesis import given, settings, assume, example
from hypothesis import strategies as st

from services.variance_calculator import (
    VarianceCalculator,
    VarianceStatus,
    VarianceAlertType,
    AlertSeverity,
    VarianceResult,
    ProjectVarianceResult,
    VarianceAlert,
    CurrencyConversionResult,
    VARIANCE_THRESHOLDS,
    DEFAULT_EXCHANGE_RATES,
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
def budget_variance_pair(draw):
    """Generate a pair of planned and actual amounts for variance testing."""
    planned = draw(positive_decimal_strategy(min_value=100, max_value=10_000_000))
    
    # Generate actual as a factor of planned (0.5x to 2x)
    factor = draw(st.floats(min_value=0.5, max_value=2.0, allow_nan=False))
    actual = (planned * Decimal(str(factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    return {'planned': planned, 'actual': actual}


@st.composite
def breakdown_item_strategy(draw):
    """Generate a PO breakdown item with financial data."""
    planned = draw(positive_decimal_strategy(min_value=100, max_value=1_000_000))
    
    # Generate actual and committed as factors of planned
    actual_factor = draw(st.floats(min_value=0.3, max_value=2.5, allow_nan=False))
    committed_factor = draw(st.floats(min_value=0.8, max_value=1.5, allow_nan=False))
    
    actual = (planned * Decimal(str(actual_factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    committed = (planned * Decimal(str(committed_factor))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    return {
        'id': uuid4(),
        'planned_amount': planned,
        'actual_amount': actual,
        'committed_amount': committed
    }


@st.composite
def currency_pair_strategy(draw):
    """Generate a currency conversion pair."""
    currencies = list(DEFAULT_EXCHANGE_RATES.keys())
    from_currency = draw(st.sampled_from(currencies))
    to_currency = draw(st.sampled_from(currencies))
    amount = draw(positive_decimal_strategy(min_value=100, max_value=100_000))
    
    return {
        'amount': amount,
        'from_currency': from_currency,
        'to_currency': to_currency
    }


# =============================================================================
# Property 3.1: Remaining Amount Calculation Correctness
# =============================================================================

class TestRemainingAmountCalculationCorrectness:
    """
    Property 3.1: Remaining Amount Calculation Correctness
    
    For any planned and actual amounts, the remaining amount must equal
    planned - actual exactly, following the mathematical formula.
    
    **Validates: Requirement 3.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(pair=budget_variance_pair())
    def test_remaining_amount_formula_correctness(self, pair: Dict[str, Decimal]):
        """
        Property test: Remaining amount = planned - actual (always)
        
        **Validates: Requirement 3.2**
        """
        calc = VarianceCalculator()
        planned = pair['planned']
        actual = pair['actual']
        
        # Calculate remaining using the service
        remaining = calc.calculate_remaining_amount(planned, actual)
        
        # Calculate expected remaining directly
        expected = (planned - actual).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: remaining == planned - actual
        assert remaining == expected, (
            f"Remaining amount calculation incorrect: "
            f"expected {expected}, got {remaining} "
            f"(planned={planned}, actual={actual})"
        )
    
    @settings(max_examples=100, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=1, max_value=1_000_000),
        actual=positive_decimal_strategy(min_value=1, max_value=1_000_000)
    )
    def test_remaining_amount_sign_correctness(self, planned: Decimal, actual: Decimal):
        """
        Property test: Remaining amount sign indicates budget status
        
        **Validates: Requirement 3.2**
        
        - Positive remaining: under budget (planned > actual)
        - Negative remaining: over budget (actual > planned)
        - Zero remaining: exactly on budget
        """
        calc = VarianceCalculator()
        remaining = calc.calculate_remaining_amount(planned, actual)
        
        if planned > actual:
            assert remaining > 0, f"Under budget should have positive remaining: {remaining}"
        elif actual > planned:
            assert remaining < 0, f"Over budget should have negative remaining: {remaining}"
        else:
            assert remaining == 0, f"Exact budget should have zero remaining: {remaining}"


# =============================================================================
# Property 3.2: Variance Percentage Mathematical Accuracy
# =============================================================================

class TestVariancePercentageMathematicalAccuracy:
    """
    Property 3.2: Variance Percentage Mathematical Accuracy
    
    For any planned and actual amounts, the variance percentage must be
    calculated correctly using the formula: ((actual - planned) / planned) * 100
    
    **Validates: Requirements 3.1, 3.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(pair=budget_variance_pair())
    def test_variance_percentage_formula_correctness(self, pair: Dict[str, Decimal]):
        """
        Property test: Variance percentage = ((actual - planned) / planned) * 100
        
        **Validates: Requirements 3.1, 3.2**
        """
        calc = VarianceCalculator()
        planned = pair['planned']
        actual = pair['actual']
        
        # Skip if planned is zero (handled separately)
        assume(planned > 0)
        
        # Calculate variance percentage using the service
        variance_pct = calc.calculate_variance_percentage(planned, actual)
        
        # Calculate expected percentage directly
        expected_pct = (((actual - planned) / planned) * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Property: variance_percentage == ((actual - planned) / planned) * 100
        assert variance_pct == expected_pct, (
            f"Variance percentage calculation incorrect: "
            f"expected {expected_pct}, got {variance_pct} "
            f"(planned={planned}, actual={actual})"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=positive_decimal_strategy(min_value=100, max_value=1_000_000),
        scale_factor=st.floats(min_value=1, max_value=10000, allow_nan=False)
    )
    def test_percentage_scale_independence(self, planned: Decimal, scale_factor: float):
        """
        Property test: Percentage is invariant when both amounts are scaled
        
        **Validates: Requirement 3.1**
        
        If we multiply both planned and actual by the same factor,
        the variance percentage should remain unchanged.
        """
        calc = VarianceCalculator()
        
        # Create actual with 15% variance
        actual = (planned * Decimal('1.15')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate base percentage
        base_pct = calc.calculate_variance_percentage(planned, actual)
        
        # Scale both amounts
        scale = Decimal(str(scale_factor))
        scaled_planned = (planned * scale).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        scaled_actual = (actual * scale).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate scaled percentage
        scaled_pct = calc.calculate_variance_percentage(scaled_planned, scaled_actual)
        
        # Property: base_pct ≈ scaled_pct (within rounding tolerance)
        tolerance = Decimal('0.05')
        difference = abs(base_pct - scaled_pct)
        
        assert difference <= tolerance, (
            f"Percentage not invariant under scaling: "
            f"base_pct={base_pct}, scaled_pct={scaled_pct}, "
            f"difference={difference}, scale_factor={scale_factor}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(actual=positive_decimal_strategy(min_value=1, max_value=100_000))
    def test_zero_planned_returns_zero_percentage(self, actual: Decimal):
        """
        Property test: Zero planned amount returns 0% variance
        
        **Validates: Requirement 3.2**
        
        To avoid division by zero, when planned is 0, the system
        should return 0% variance regardless of actual amount.
        """
        calc = VarianceCalculator()
        planned = Decimal('0')
        
        variance_pct = calc.calculate_variance_percentage(planned, actual)
        
        # Property: variance_percentage == 0 when planned == 0
        assert variance_pct == Decimal('0.00'), (
            f"Zero planned should return 0% variance, got {variance_pct}"
        )


# =============================================================================
# Property 3.3: Currency Conversion Reciprocal Consistency
# =============================================================================

class TestCurrencyConversionReciprocalConsistency:
    """
    Property 3.3: Currency Conversion Reciprocal Consistency
    
    For any currency conversion sequence (A→B→A), the final amount
    must equal the original amount within acceptable precision limits.
    
    **Validates: Requirement 3.3**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(pair=currency_pair_strategy())
    def test_currency_conversion_reciprocal(self, pair: Dict[str, Any]):
        """
        Property test: A→B→A conversion returns original amount (within tolerance)
        
        **Validates: Requirement 3.3**
        """
        calc = VarianceCalculator()
        amount = pair['amount']
        from_currency = pair['from_currency']
        to_currency = pair['to_currency']
        
        # Skip same currency (trivial case)
        if from_currency == to_currency:
            result = calc.convert_currency(amount, from_currency, to_currency)
            assert result.converted_amount == amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            return
        
        # Convert A -> B
        result1 = calc.convert_currency(amount, from_currency, to_currency)
        converted = result1.converted_amount
        
        # Skip if converted amount is too small (precision issues)
        assume(converted >= Decimal('0.10'))
        
        # Convert B -> A
        result2 = calc.convert_currency(converted, to_currency, from_currency)
        back_converted = result2.converted_amount
        
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

    
    @settings(max_examples=50, deadline=None)
    @given(
        amount=positive_decimal_strategy(min_value=100, max_value=100_000),
        currency=st.sampled_from(list(DEFAULT_EXCHANGE_RATES.keys()))
    )
    def test_same_currency_conversion_identity(self, amount: Decimal, currency: str):
        """
        Property test: Same currency conversion returns identical amount
        
        **Validates: Requirement 3.3**
        """
        calc = VarianceCalculator()
        result = calc.convert_currency(amount, currency, currency)
        expected = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: convert(amount, X, X) == amount
        assert result.converted_amount == expected, (
            f"Same currency conversion failed: expected {expected}, got {result.converted_amount}"
        )
        assert result.exchange_rate == Decimal('1.0')
    
    @settings(max_examples=50, deadline=None)
    @given(pair=currency_pair_strategy())
    def test_currency_conversion_creates_audit_trail(self, pair: Dict[str, Any]):
        """
        Property test: All currency conversions create audit trail entries
        
        **Validates: Requirement 3.3**
        """
        calc = VarianceCalculator()
        amount = pair['amount']
        from_currency = pair['from_currency']
        to_currency = pair['to_currency']
        
        initial_log_size = len(calc.get_audit_log())
        
        result = calc.convert_currency(amount, from_currency, to_currency)
        
        # Property: Audit log size increases by 1
        assert len(calc.get_audit_log()) == initial_log_size + 1
        
        # Property: Audit entry contains correct information
        assert result.audit_entry is not None
        assert result.audit_entry.original_amount == amount
        assert result.audit_entry.converted_amount == result.converted_amount
        assert result.audit_entry.from_currency == from_currency.upper()
        assert result.audit_entry.to_currency == to_currency.upper()


# =============================================================================
# Property 3.4: Variance Status Classification Alignment
# =============================================================================

class TestVarianceStatusClassificationAlignment:
    """
    Property 3.4: Variance Status Classification Alignment
    
    For any calculated variance percentage, the status classification
    must align correctly with the percentage thresholds.
    
    **Validates: Requirements 3.4, 3.5**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(variance_pct=st.floats(min_value=-100, max_value=200, allow_nan=False))
    def test_status_classification_alignment(self, variance_pct: float):
        """
        Property test: Status classification aligns with percentage thresholds
        
        **Validates: Requirements 3.4, 3.5**
        """
        calc = VarianceCalculator()
        variance_decimal = Decimal(str(variance_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        status = calc.determine_variance_status(variance_decimal)
        abs_variance = abs(variance_decimal)
        
        # Property: Status must align with thresholds
        if abs_variance <= calc.thresholds['on_track']:
            assert status == VarianceStatus.on_track, (
                f"Variance {variance_decimal}% should be on_track, got {status}"
            )
        elif abs_variance <= calc.thresholds['minor_variance']:
            assert status == VarianceStatus.minor_variance, (
                f"Variance {variance_decimal}% should be minor_variance, got {status}"
            )
        elif abs_variance <= calc.thresholds['significant_variance']:
            assert status == VarianceStatus.significant_variance, (
                f"Variance {variance_decimal}% should be significant_variance, got {status}"
            )
        else:
            assert status == VarianceStatus.critical_variance, (
                f"Variance {variance_decimal}% should be critical_variance, got {status}"
            )
    
    @settings(max_examples=100, deadline=None)
    @given(item=breakdown_item_strategy())
    def test_item_variance_status_consistency(self, item: Dict[str, Any]):
        """
        Property test: Item variance status is consistent with calculated percentage
        
        **Validates: Requirements 3.1, 3.4**
        """
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance(item)
        
        # Calculate expected status from percentage
        expected_status = calc.determine_variance_status(result.variance_percentage)
        
        # Property: Status in result matches expected status
        assert result.variance_status == expected_status, (
            f"Status inconsistency: result.status={result.variance_status}, "
            f"expected={expected_status}, variance_pct={result.variance_percentage}"
        )


# =============================================================================
# Property 3.5: Project Variance Aggregation Correctness
# =============================================================================

class TestProjectVarianceAggregationCorrectness:
    """
    Property 3.5: Project Variance Aggregation Correctness
    
    For any collection of breakdown items, the aggregated project variance
    must equal the sum of individual variances.
    
    **Validates: Requirements 3.4, 5.6**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(items=st.lists(breakdown_item_strategy(), min_size=1, max_size=10))
    def test_project_variance_aggregation_correctness(self, items: List[Dict[str, Any]]):
        """
        Property test: Aggregated variance equals sum of individual variances
        
        **Validates: Requirements 3.4, 5.6**
        """
        calc = VarianceCalculator()
        project_id = uuid4()
        
        # Calculate project variance
        result = calc.calculate_project_variance(project_id, items)
        
        # Calculate expected totals manually
        expected_planned = sum(item['planned_amount'] for item in items)
        expected_actual = sum(item['actual_amount'] for item in items)
        expected_committed = sum(item['committed_amount'] for item in items)
        
        # Property: Aggregated totals match sum of individual items
        assert result.total_planned == expected_planned.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert result.total_actual == expected_actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        assert result.total_committed == expected_committed.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: Overall variance percentage is calculated correctly
        expected_variance_pct = calc.calculate_variance_percentage(expected_planned, expected_actual)
        assert result.overall_variance_percentage == expected_variance_pct

    
    @settings(max_examples=50, deadline=None)
    @given(items=st.lists(breakdown_item_strategy(), min_size=1, max_size=10))
    def test_project_variance_item_counts(self, items: List[Dict[str, Any]]):
        """
        Property test: Project variance correctly counts over/under budget items
        
        **Validates: Requirement 3.4**
        """
        calc = VarianceCalculator()
        project_id = uuid4()
        
        result = calc.calculate_project_variance(project_id, items)
        
        # Count manually
        expected_over = sum(1 for item in items if item['actual_amount'] > item['planned_amount'])
        expected_under = sum(1 for item in items if item['actual_amount'] < item['planned_amount'])
        
        # Property: Counts match manual calculation
        assert result.items_over_budget == expected_over
        assert result.items_under_budget == expected_under
        assert result.item_count == len(items)


# =============================================================================
# Property 3.6: Budget Overrun Detection Accuracy
# =============================================================================

class TestBudgetOverrunDetectionAccuracy:
    """
    Property 3.6: Budget Overrun Detection Accuracy
    
    For any collection of breakdown items, the system must correctly
    identify all items where actual spending exceeds planned budget.
    
    **Validates: Requirements 3.5, 5.6**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(items=st.lists(breakdown_item_strategy(), min_size=1, max_size=10))
    def test_budget_overrun_detection_completeness(self, items: List[Dict[str, Any]]):
        """
        Property test: All budget overruns are detected
        
        **Validates: Requirements 3.5, 5.6**
        """
        calc = VarianceCalculator()
        
        overruns = calc.detect_budget_overruns(items, threshold_percentage=Decimal('0'))
        
        # Count expected overruns manually
        expected_overruns = [
            item for item in items 
            if item['actual_amount'] > item['planned_amount']
        ]
        
        # Property: Number of detected overruns matches expected
        assert len(overruns) == len(expected_overruns), (
            f"Overrun detection incomplete: expected {len(expected_overruns)}, "
            f"got {len(overruns)}"
        )
        
        # Property: All detected overruns have positive overrun amounts
        for overrun in overruns:
            assert overrun['overrun_amount'] > 0, (
                f"Overrun amount should be positive: {overrun['overrun_amount']}"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(
        items=st.lists(breakdown_item_strategy(), min_size=1, max_size=10),
        threshold=st.floats(min_value=0, max_value=50, allow_nan=False)
    )
    def test_budget_overrun_threshold_filtering(
        self, items: List[Dict[str, Any]], threshold: float
    ):
        """
        Property test: Threshold filtering works correctly
        
        **Validates: Requirements 3.5, 5.6**
        """
        calc = VarianceCalculator()
        threshold_decimal = Decimal(str(threshold)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        overruns = calc.detect_budget_overruns(items, threshold_percentage=threshold_decimal)
        
        # Property: All detected overruns exceed the threshold
        for overrun in overruns:
            assert overrun['overrun_percentage'] >= threshold_decimal, (
                f"Overrun {overrun['overrun_percentage']}% below threshold {threshold_decimal}%"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(items=st.lists(breakdown_item_strategy(), min_size=2, max_size=10))
    def test_budget_overrun_sorting(self, items: List[Dict[str, Any]]):
        """
        Property test: Overruns are sorted by percentage (highest first)
        
        **Validates: Requirement 3.5**
        """
        calc = VarianceCalculator()
        
        overruns = calc.detect_budget_overruns(items)
        
        # Property: Overruns are sorted in descending order by percentage
        if len(overruns) > 1:
            for i in range(len(overruns) - 1):
                assert overruns[i]['overrun_percentage'] >= overruns[i + 1]['overrun_percentage'], (
                    f"Overruns not sorted correctly: "
                    f"{overruns[i]['overrun_percentage']} < {overruns[i + 1]['overrun_percentage']}"
                )


# =============================================================================
# Property 3.7: Alert Generation Threshold Compliance
# =============================================================================

class TestAlertGenerationThresholdCompliance:
    """
    Property 3.7: Alert Generation Threshold Compliance
    
    For any variance calculation, alerts must be generated when and only when
    the variance exceeds the configured threshold (default 50%).
    
    **Validates: Requirements 3.5, 5.6**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        item=breakdown_item_strategy(),
        threshold=st.floats(min_value=10, max_value=100, allow_nan=False)
    )
    def test_alert_generation_threshold_compliance(
        self, item: Dict[str, Any], threshold: float
    ):
        """
        Property test: Alerts generated only when threshold exceeded
        
        **Validates: Requirements 3.5, 5.6**
        """
        calc = VarianceCalculator()
        threshold_decimal = Decimal(str(threshold)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Calculate variance
        variance_result = calc.calculate_item_variance(item)
        
        # Generate alert
        alert = calc.generate_variance_alert(
            breakdown_id=item['id'],
            project_id=uuid4(),
            variance_result=variance_result,
            threshold=threshold_decimal
        )
        
        abs_variance = abs(variance_result.variance_percentage)
        
        # Property: Alert generated if and only if threshold exceeded
        if abs_variance > threshold_decimal:
            assert alert is not None, (
                f"Alert should be generated: variance={abs_variance}%, threshold={threshold_decimal}%"
            )
            assert alert.threshold_exceeded == threshold_decimal
            assert alert.current_variance == variance_result.variance_percentage
        else:
            assert alert is None, (
                f"Alert should not be generated: variance={abs_variance}%, threshold={threshold_decimal}%"
            )
    
    @settings(max_examples=50, deadline=None)
    @given(items=st.lists(breakdown_item_strategy(), min_size=1, max_size=10))
    def test_project_variance_alert_generation(self, items: List[Dict[str, Any]]):
        """
        Property test: Project variance generates alerts for items exceeding threshold
        
        **Validates: Requirements 3.5, 5.6**
        """
        calc = VarianceCalculator()
        project_id = uuid4()
        threshold = Decimal('50.0')
        
        result = calc.calculate_project_variance(project_id, items, alert_threshold=threshold)
        
        # Count expected alerts manually
        expected_alert_count = 0
        for item in items:
            variance_pct = calc.calculate_variance_percentage(
                item['planned_amount'],
                item['actual_amount']
            )
            if abs(variance_pct) > threshold:
                expected_alert_count += 1
        
        # Property: Number of alerts matches expected
        assert len(result.alerts) == expected_alert_count, (
            f"Alert count mismatch: expected {expected_alert_count}, got {len(result.alerts)}"
        )
    
    @settings(max_examples=50, deadline=None)
    @given(item=breakdown_item_strategy())
    def test_alert_severity_alignment(self, item: Dict[str, Any]):
        """
        Property test: Alert severity aligns with variance status
        
        **Validates: Requirement 3.5**
        """
        calc = VarianceCalculator()
        
        variance_result = calc.calculate_item_variance(item)
        
        # Only test if variance exceeds default threshold
        if abs(variance_result.variance_percentage) > Decimal('50.0'):
            alert = calc.generate_variance_alert(
                breakdown_id=item['id'],
                project_id=uuid4(),
                variance_result=variance_result
            )
            
            assert alert is not None
            
            # Property: Severity aligns with variance status
            if variance_result.variance_status == VarianceStatus.critical_variance:
                assert alert.severity == AlertSeverity.critical
            elif variance_result.variance_status in [
                VarianceStatus.significant_variance,
                VarianceStatus.minor_variance
            ]:
                assert alert.severity == AlertSeverity.warning
            else:
                assert alert.severity == AlertSeverity.info


# =============================================================================
# Run tests if executed directly
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
