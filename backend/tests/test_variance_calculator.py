"""
Unit Tests for VarianceCalculator Service

This module contains comprehensive unit tests for the VarianceCalculator class,
testing remaining amount calculations, variance percentages, currency conversions,
and variance status determination.

**Validates: Requirements 3.1, 3.2, 3.3**
"""

import pytest
from decimal import Decimal
from datetime import datetime
from uuid import uuid4

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.variance_calculator import (
    VarianceCalculator,
    VarianceStatus,
    VarianceResult,
    CurrencyConversionResult,
    CurrencyConversionAuditEntry,
    VARIANCE_THRESHOLDS,
    DEFAULT_EXCHANGE_RATES,
)


class TestCalculateRemainingAmount:
    """Tests for calculate_remaining_amount method - Validates Requirement 3.2"""
    
    def test_positive_remaining_under_budget(self):
        """Test remaining amount when under budget (planned > actual)"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('10000'),
            actual=Decimal('7500')
        )
        assert result == Decimal('2500.00')
    
    def test_negative_remaining_over_budget(self):
        """Test remaining amount when over budget (actual > planned)"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('10000'),
            actual=Decimal('12000')
        )
        assert result == Decimal('-2000.00')
    
    def test_zero_remaining_exact_budget(self):
        """Test remaining amount when exactly on budget"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('10000'),
            actual=Decimal('10000')
        )
        assert result == Decimal('0.00')
    
    def test_zero_planned_amount(self):
        """Test with zero planned amount"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('0'),
            actual=Decimal('5000')
        )
        assert result == Decimal('-5000.00')
    
    def test_zero_actual_amount(self):
        """Test with zero actual amount"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('10000'),
            actual=Decimal('0')
        )
        assert result == Decimal('10000.00')
    
    def test_decimal_precision(self):
        """Test that result is rounded to 2 decimal places"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('100.333'),
            actual=Decimal('50.111')
        )
        assert result == Decimal('50.22')
    
    def test_large_amounts(self):
        """Test with large amounts"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned=Decimal('1000000000.00'),
            actual=Decimal('750000000.00')
        )
        assert result == Decimal('250000000.00')
    
    def test_string_input_conversion(self):
        """Test that string inputs are converted to Decimal"""
        calc = VarianceCalculator()
        result = calc.calculate_remaining_amount(
            planned='10000',
            actual='7500'
        )
        assert result == Decimal('2500.00')
    
    def test_invalid_planned_raises_error(self):
        """Test that invalid planned amount raises ValueError"""
        calc = VarianceCalculator()
        with pytest.raises(ValueError, match="Invalid planned"):
            calc.calculate_remaining_amount(
                planned='invalid',
                actual=Decimal('5000')
            )
    
    def test_invalid_actual_raises_error(self):
        """Test that invalid actual amount raises ValueError"""
        calc = VarianceCalculator()
        with pytest.raises(ValueError, match="Invalid actual"):
            calc.calculate_remaining_amount(
                planned=Decimal('10000'),
                actual='invalid'
            )


class TestCalculateVariancePercentage:
    """Tests for calculate_variance_percentage method - Validates Requirements 3.1, 3.2"""
    
    def test_positive_variance_over_budget(self):
        """Test positive variance when over budget"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('11500')
        )
        assert result == Decimal('15.00')
    
    def test_negative_variance_under_budget(self):
        """Test negative variance when under budget"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('8500')
        )
        assert result == Decimal('-15.00')
    
    def test_zero_variance_exact_budget(self):
        """Test zero variance when exactly on budget"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('10000')
        )
        assert result == Decimal('0.00')
    
    def test_zero_planned_returns_zero(self):
        """Test that zero planned amount returns zero (avoid division by zero)"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('0'),
            actual=Decimal('5000')
        )
        assert result == Decimal('0.00')
    
    def test_small_variance(self):
        """Test small variance percentage"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('10100')
        )
        assert result == Decimal('1.00')
    
    def test_large_variance(self):
        """Test large variance percentage"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('20000')
        )
        assert result == Decimal('100.00')
    
    def test_decimal_precision(self):
        """Test that result is rounded to 2 decimal places"""
        calc = VarianceCalculator()
        result = calc.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('10333')
        )
        assert result == Decimal('3.33')
    
    def test_scale_independence(self):
        """Test that percentage is scale-independent"""
        calc = VarianceCalculator()
        
        # Small scale
        result_small = calc.calculate_variance_percentage(
            planned=Decimal('100'),
            actual=Decimal('110')
        )
        
        # Large scale
        result_large = calc.calculate_variance_percentage(
            planned=Decimal('1000000'),
            actual=Decimal('1100000')
        )
        
        assert result_small == result_large == Decimal('10.00')


class TestConvertCurrency:
    """Tests for convert_currency method - Validates Requirement 3.3"""
    
    def test_same_currency_no_conversion(self):
        """Test that same currency returns original amount"""
        calc = VarianceCalculator()
        result = calc.convert_currency(
            amount=Decimal('1000'),
            from_currency='USD',
            to_currency='USD'
        )
        assert result.converted_amount == Decimal('1000.00')
        assert result.exchange_rate == Decimal('1.0')
    
    def test_conversion_with_provided_rate(self):
        """Test conversion with explicitly provided exchange rate"""
        calc = VarianceCalculator()
        result = calc.convert_currency(
            amount=Decimal('1000'),
            from_currency='EUR',
            to_currency='USD',
            exchange_rate=Decimal('1.09')
        )
        assert result.converted_amount == Decimal('1090.00')
        assert result.exchange_rate == Decimal('1.09')
    
    def test_conversion_creates_audit_entry(self):
        """Test that conversion creates an audit trail entry"""
        calc = VarianceCalculator()
        user_id = uuid4()
        
        result = calc.convert_currency(
            amount=Decimal('1000'),
            from_currency='EUR',
            to_currency='USD',
            exchange_rate=Decimal('1.09'),
            user_id=user_id,
            notes='Test conversion'
        )
        
        assert result.audit_entry is not None
        assert result.audit_entry.original_amount == Decimal('1000')
        assert result.audit_entry.converted_amount == Decimal('1090.00')
        assert result.audit_entry.from_currency == 'EUR'
        assert result.audit_entry.to_currency == 'USD'
        assert result.audit_entry.user_id == user_id
        assert result.audit_entry.notes == 'Test conversion'
    
    def test_audit_log_accumulates(self):
        """Test that audit log accumulates entries"""
        calc = VarianceCalculator()
        
        calc.convert_currency(Decimal('100'), 'EUR', 'USD', Decimal('1.09'))
        calc.convert_currency(Decimal('200'), 'GBP', 'USD', Decimal('1.27'))
        calc.convert_currency(Decimal('300'), 'JPY', 'USD', Decimal('0.0067'))
        
        audit_log = calc.get_audit_log()
        assert len(audit_log) == 3
    
    def test_clear_audit_log(self):
        """Test clearing the audit log"""
        calc = VarianceCalculator()
        
        calc.convert_currency(Decimal('100'), 'EUR', 'USD', Decimal('1.09'))
        calc.convert_currency(Decimal('200'), 'GBP', 'USD', Decimal('1.27'))
        
        count = calc.clear_audit_log()
        assert count == 2
        assert len(calc.get_audit_log()) == 0
    
    def test_currency_case_insensitive(self):
        """Test that currency codes are case-insensitive"""
        calc = VarianceCalculator()
        result = calc.convert_currency(
            amount=Decimal('1000'),
            from_currency='eur',
            to_currency='usd',
            exchange_rate=Decimal('1.09')
        )
        assert result.from_currency == 'EUR'
        assert result.to_currency == 'USD'
    
    def test_invalid_currency_code_raises_error(self):
        """Test that invalid currency code raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Invalid currency code"):
            calc.convert_currency(
                amount=Decimal('1000'),
                from_currency='EURO',  # Invalid - 4 characters
                to_currency='USD'
            )
    
    def test_zero_exchange_rate_raises_error(self):
        """Test that zero exchange rate raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Exchange rate must be positive"):
            calc.convert_currency(
                amount=Decimal('1000'),
                from_currency='EUR',
                to_currency='USD',
                exchange_rate=Decimal('0')
            )
    
    def test_negative_exchange_rate_raises_error(self):
        """Test that negative exchange rate raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Exchange rate must be positive"):
            calc.convert_currency(
                amount=Decimal('1000'),
                from_currency='EUR',
                to_currency='USD',
                exchange_rate=Decimal('-1.09')
            )
    
    def test_conversion_with_default_rates(self):
        """Test conversion using default exchange rates"""
        calc = VarianceCalculator()
        
        # EUR to USD using default rates
        result = calc.convert_currency(
            amount=Decimal('100'),
            from_currency='EUR',
            to_currency='USD'
        )
        
        # Should use calculated rate from default rates
        assert result.converted_amount > Decimal('0')
        assert result.exchange_rate > Decimal('0')
    
    def test_decimal_precision_in_conversion(self):
        """Test that converted amount is rounded to 2 decimal places"""
        calc = VarianceCalculator()
        result = calc.convert_currency(
            amount=Decimal('100.333'),
            from_currency='EUR',
            to_currency='USD',
            exchange_rate=Decimal('1.09123')
        )
        # 100.333 * 1.09123 = 109.4817259 -> 109.48
        assert str(result.converted_amount).count('.') <= 1
        assert len(str(result.converted_amount).split('.')[-1]) <= 2


class TestCalculateItemVariance:
    """Tests for calculate_item_variance method - Validates Requirements 3.1, 3.2"""
    
    def test_complete_variance_calculation(self):
        """Test complete variance calculation for a breakdown item"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('11500'),
            'committed_amount': Decimal('10500')
        })
        
        assert isinstance(result, VarianceResult)
        assert result.remaining_amount == Decimal('-1500.00')
        assert result.variance_percentage == Decimal('15.00')
        assert result.variance_status == VarianceStatus.minor_variance
        assert result.planned_vs_actual == Decimal('-1500.00')
        assert result.planned_vs_committed == Decimal('-500.00')
        assert result.committed_vs_actual == Decimal('-1000.00')
    
    def test_on_track_status(self):
        """Test item with on_track variance status"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('10300'),  # 3% variance
            'committed_amount': Decimal('10000')
        })
        
        assert result.variance_status == VarianceStatus.on_track
    
    def test_minor_variance_status(self):
        """Test item with minor_variance status"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('11000'),  # 10% variance
            'committed_amount': Decimal('10000')
        })
        
        assert result.variance_status == VarianceStatus.minor_variance
    
    def test_significant_variance_status(self):
        """Test item with significant_variance status"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('13000'),  # 30% variance
            'committed_amount': Decimal('10000')
        })
        
        assert result.variance_status == VarianceStatus.significant_variance
    
    def test_critical_variance_status(self):
        """Test item with critical_variance status"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('16000'),  # 60% variance
            'committed_amount': Decimal('10000')
        })
        
        assert result.variance_status == VarianceStatus.critical_variance
    
    def test_missing_committed_amount_defaults_to_zero(self):
        """Test that missing committed_amount defaults to zero"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('8000')
        })
        
        assert result.committed_amount == Decimal('0')
        assert result.planned_vs_committed == Decimal('10000.00')
    
    def test_missing_planned_amount_raises_error(self):
        """Test that missing planned_amount raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Missing required field: planned_amount"):
            calc.calculate_item_variance({
                'actual_amount': Decimal('8000')
            })
    
    def test_missing_actual_amount_raises_error(self):
        """Test that missing actual_amount raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Missing required field: actual_amount"):
            calc.calculate_item_variance({
                'planned_amount': Decimal('10000')
            })
    
    def test_calculated_at_timestamp(self):
        """Test that calculated_at timestamp is set"""
        calc = VarianceCalculator()
        
        before = datetime.now()
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('10000'),
            'actual_amount': Decimal('8000')
        })
        after = datetime.now()
        
        assert before <= result.calculated_at <= after


class TestDetermineVarianceStatus:
    """Tests for determine_variance_status method - Validates Requirements 3.1, 3.5"""
    
    def test_on_track_at_zero(self):
        """Test on_track status at 0%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('0')) == VarianceStatus.on_track
    
    def test_on_track_at_threshold(self):
        """Test on_track status at exactly 5%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('5.00')) == VarianceStatus.on_track
    
    def test_minor_variance_just_above_on_track(self):
        """Test minor_variance status just above 5%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('5.01')) == VarianceStatus.minor_variance
    
    def test_minor_variance_at_threshold(self):
        """Test minor_variance status at exactly 15%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('15.00')) == VarianceStatus.minor_variance
    
    def test_significant_variance_just_above_minor(self):
        """Test significant_variance status just above 15%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('15.01')) == VarianceStatus.significant_variance
    
    def test_significant_variance_at_threshold(self):
        """Test significant_variance status at exactly 50%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('50.00')) == VarianceStatus.significant_variance
    
    def test_critical_variance_just_above_significant(self):
        """Test critical_variance status just above 50%"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('50.01')) == VarianceStatus.critical_variance
    
    def test_critical_variance_large_value(self):
        """Test critical_variance status with large variance"""
        calc = VarianceCalculator()
        assert calc.determine_variance_status(Decimal('100.00')) == VarianceStatus.critical_variance
    
    def test_negative_variance_uses_absolute_value(self):
        """Test that negative variance uses absolute value for status"""
        calc = VarianceCalculator()
        
        # -3% should be on_track (abs = 3%)
        assert calc.determine_variance_status(Decimal('-3.00')) == VarianceStatus.on_track
        
        # -10% should be minor_variance (abs = 10%)
        assert calc.determine_variance_status(Decimal('-10.00')) == VarianceStatus.minor_variance
        
        # -30% should be significant_variance (abs = 30%)
        assert calc.determine_variance_status(Decimal('-30.00')) == VarianceStatus.significant_variance
        
        # -60% should be critical_variance (abs = 60%)
        assert calc.determine_variance_status(Decimal('-60.00')) == VarianceStatus.critical_variance


class TestCustomThresholds:
    """Tests for custom threshold configuration"""
    
    def test_custom_thresholds_initialization(self):
        """Test initialization with custom thresholds"""
        custom_thresholds = {
            'on_track': Decimal('10.0'),
            'minor_variance': Decimal('25.0'),
            'significant_variance': Decimal('75.0'),
        }
        
        calc = VarianceCalculator(thresholds=custom_thresholds)
        
        # 8% should be on_track with custom threshold
        assert calc.determine_variance_status(Decimal('8.00')) == VarianceStatus.on_track
        
        # 15% should be minor_variance with custom threshold
        assert calc.determine_variance_status(Decimal('15.00')) == VarianceStatus.minor_variance
    
    def test_set_threshold_method(self):
        """Test setting threshold via method"""
        calc = VarianceCalculator()
        
        # Default: 5% is on_track
        assert calc.determine_variance_status(Decimal('8.00')) == VarianceStatus.minor_variance
        
        # Update threshold
        calc.set_threshold('on_track', Decimal('10.0'))
        
        # Now 8% should be on_track
        assert calc.determine_variance_status(Decimal('8.00')) == VarianceStatus.on_track
    
    def test_invalid_threshold_level_raises_error(self):
        """Test that invalid threshold level raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Invalid threshold level"):
            calc.set_threshold('invalid_level', Decimal('10.0'))
    
    def test_negative_threshold_raises_error(self):
        """Test that negative threshold raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="must be non-negative"):
            calc.set_threshold('on_track', Decimal('-5.0'))


class TestCustomExchangeRates:
    """Tests for custom exchange rate configuration"""
    
    def test_custom_exchange_rates_initialization(self):
        """Test initialization with custom exchange rates"""
        custom_rates = {
            'USD': Decimal('1.0'),
            'EUR': Decimal('0.90'),
            'GBP': Decimal('0.75'),
        }
        
        calc = VarianceCalculator(exchange_rates=custom_rates)
        
        result = calc.convert_currency(
            amount=Decimal('100'),
            from_currency='EUR',
            to_currency='USD'
        )
        
        # With custom rates: 100 EUR * (1.0/0.90) = 111.11 USD
        assert result.converted_amount > Decimal('100')
    
    def test_set_exchange_rate_method(self):
        """Test setting exchange rate via method"""
        calc = VarianceCalculator()
        
        calc.set_exchange_rate('XYZ', Decimal('2.0'))
        
        result = calc.convert_currency(
            amount=Decimal('100'),
            from_currency='XYZ',
            to_currency='USD'
        )
        
        # 100 XYZ * (1.0/2.0) = 50 USD
        assert result.converted_amount == Decimal('50.00')
    
    def test_invalid_exchange_rate_raises_error(self):
        """Test that invalid exchange rate raises ValueError"""
        calc = VarianceCalculator()
        
        with pytest.raises(ValueError, match="Exchange rate must be positive"):
            calc.set_exchange_rate('EUR', Decimal('0'))


class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""
    
    def test_very_small_amounts(self):
        """Test with very small amounts"""
        calc = VarianceCalculator()
        
        result = calc.calculate_remaining_amount(
            planned=Decimal('0.01'),
            actual=Decimal('0.005')
        )
        
        assert result == Decimal('0.01')  # Rounded
    
    def test_very_large_amounts(self):
        """Test with very large amounts"""
        calc = VarianceCalculator()
        
        result = calc.calculate_remaining_amount(
            planned=Decimal('999999999999.99'),
            actual=Decimal('888888888888.88')
        )
        
        assert result == Decimal('111111111111.11')
    
    def test_both_zero_amounts(self):
        """Test with both amounts being zero"""
        calc = VarianceCalculator()
        
        result = calc.calculate_item_variance({
            'planned_amount': Decimal('0'),
            'actual_amount': Decimal('0'),
            'committed_amount': Decimal('0')
        })
        
        assert result.remaining_amount == Decimal('0.00')
        assert result.variance_percentage == Decimal('0.00')
        assert result.variance_status == VarianceStatus.on_track


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
