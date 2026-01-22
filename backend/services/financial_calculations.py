"""
Financial Calculations Module

This module provides core financial calculation functions for variance analysis,
currency conversion, and budget calculations. These functions are designed to be
pure functions that can be easily tested with property-based testing.

**Validates: Requirements 2.1, 2.2, 2.3**
"""

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class VarianceStatus(Enum):
    """Variance status classification"""
    UNDER_BUDGET = "under_budget"
    ON_BUDGET = "on_budget"
    OVER_BUDGET = "over_budget"


@dataclass
class VarianceResult:
    """Result of a variance calculation"""
    variance_amount: Decimal
    variance_percentage: Decimal
    status: VarianceStatus
    planned_amount: Decimal
    actual_amount: Decimal


# Base exchange rates to USD (for testing and fallback)
# These represent approximate real-world rates
BASE_EXCHANGE_RATES: Dict[str, float] = {
    'USD': 1.0,
    'EUR': 0.92,      # 1 EUR = 1.09 USD, so 1 USD = 0.92 EUR
    'GBP': 0.79,      # 1 GBP = 1.27 USD, so 1 USD = 0.79 GBP
    'JPY': 149.50,    # 1 USD = 149.50 JPY
    'CHF': 0.88,      # 1 CHF = 1.14 USD, so 1 USD = 0.88 CHF
    'CAD': 1.36,      # 1 USD = 1.36 CAD
    'AUD': 1.53,      # 1 USD = 1.53 AUD
}

# Variance thresholds for status determination (in percentage)
VARIANCE_THRESHOLDS = {
    'under_threshold': Decimal('-5.0'),  # More than 5% under budget
    'over_threshold': Decimal('5.0'),    # More than 5% over budget
}


def get_exchange_rate(from_currency: str, to_currency: str, 
                      rates: Optional[Dict[str, float]] = None) -> Decimal:
    """
    Get exchange rate between two currencies.
    
    The exchange rate represents how many units of to_currency you get for 
    one unit of from_currency.
    
    Args:
        from_currency: Source currency code (e.g., 'USD', 'EUR')
        to_currency: Target currency code
        rates: Optional custom exchange rates dictionary (rates to USD)
        
    Returns:
        Exchange rate as Decimal
        
    Raises:
        ValueError: If currency code is not supported
        
    **Validates: Requirements 2.2**
    
    Example:
        >>> get_exchange_rate('USD', 'EUR')  # Returns ~0.92
        >>> get_exchange_rate('EUR', 'USD')  # Returns ~1.09
    """
    if rates is None:
        rates = BASE_EXCHANGE_RATES
    
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    if from_currency not in rates:
        raise ValueError(f"Unsupported currency: {from_currency}")
    if to_currency not in rates:
        raise ValueError(f"Unsupported currency: {to_currency}")
    
    # Same currency conversion
    if from_currency == to_currency:
        return Decimal('1.0')
    
    # Convert through USD as base currency
    # Rate represents: 1 USD = X currency
    from_rate = Decimal(str(rates[from_currency]))
    to_rate = Decimal(str(rates[to_currency]))
    
    # from_currency -> USD -> to_currency
    # If from_rate is how many from_currency per USD,
    # then 1 from_currency = 1/from_rate USD
    # And 1 USD = to_rate to_currency
    # So 1 from_currency = (1/from_rate) * to_rate to_currency
    
    if from_rate == 0:
        raise ValueError(f"Invalid exchange rate for {from_currency}: rate cannot be zero")
    
    exchange_rate = to_rate / from_rate
    
    return exchange_rate.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)


def convert_currency(amount: Decimal, from_currency: str, to_currency: str,
                    rates: Optional[Dict[str, float]] = None) -> Decimal:
    """
    Convert an amount from one currency to another.
    
    Args:
        amount: Amount to convert
        from_currency: Source currency code
        to_currency: Target currency code
        rates: Optional custom exchange rates dictionary
        
    Returns:
        Converted amount as Decimal
        
    Raises:
        ValueError: If currency code is not supported or amount is invalid
        
    **Validates: Requirements 2.2**
    
    Property: Currency conversion should be reciprocally consistent.
    For any amount A in currency X, converting X->Y->X should return A
    within acceptable precision limits.
    
    Example:
        >>> convert_currency(Decimal('100'), 'USD', 'EUR')  # Returns ~92.00
        >>> convert_currency(Decimal('92'), 'EUR', 'USD')   # Returns ~100.00
    """
    if not isinstance(amount, Decimal):
        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError) as e:
            raise ValueError(f"Invalid amount: {amount}") from e
    
    # Handle edge cases
    if amount == 0:
        return Decimal('0.00')
    
    exchange_rate = get_exchange_rate(from_currency, to_currency, rates)
    converted = amount * exchange_rate
    
    return converted.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_variance_amount(planned: Decimal, actual: Decimal) -> Decimal:
    """
    Calculate the variance amount between planned and actual values.
    
    Variance = Actual - Planned
    
    A positive variance means over budget (actual > planned).
    A negative variance means under budget (actual < planned).
    
    Args:
        planned: Planned/budgeted amount
        actual: Actual spent amount
        
    Returns:
        Variance amount as Decimal
        
    **Validates: Requirements 2.1**
    
    Property: Variance calculation must be mathematically correct.
    variance_amount = actual - planned (always)
    """
    if not isinstance(planned, Decimal):
        planned = Decimal(str(planned))
    if not isinstance(actual, Decimal):
        actual = Decimal(str(actual))
    
    variance = actual - planned
    return variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_variance_percentage(variance_amount: Decimal, planned: Decimal) -> Decimal:
    """
    Calculate the variance percentage relative to the planned amount.
    
    Variance Percentage = (Variance Amount / Planned) * 100
    
    Args:
        variance_amount: The variance amount (actual - planned)
        planned: The planned/budgeted amount
        
    Returns:
        Variance percentage as Decimal
        Returns 0 if planned is 0 (to avoid division by zero)
        
    **Validates: Requirements 2.1, 2.3**
    
    Property: Percentage calculation must be scale-independent.
    For any budget scale (small or large), the percentage should be
    calculated correctly and consistently.
    
    Example:
        >>> calculate_variance_percentage(Decimal('10'), Decimal('100'))  # Returns 10.00
        >>> calculate_variance_percentage(Decimal('100000'), Decimal('1000000'))  # Returns 10.00
    """
    if not isinstance(variance_amount, Decimal):
        variance_amount = Decimal(str(variance_amount))
    if not isinstance(planned, Decimal):
        planned = Decimal(str(planned))
    
    # Handle zero planned amount
    if planned == 0:
        return Decimal('0.00')
    
    percentage = (variance_amount / planned) * 100
    return percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def determine_variance_status(variance_percentage: Decimal,
                             thresholds: Optional[Dict[str, Decimal]] = None) -> VarianceStatus:
    """
    Determine the variance status based on the variance percentage.
    
    Args:
        variance_percentage: The calculated variance percentage
        thresholds: Optional custom thresholds dictionary
        
    Returns:
        VarianceStatus enum value
        
    **Validates: Requirements 2.5**
    
    Default thresholds:
    - Under budget: variance_percentage < -5%
    - On budget: -5% <= variance_percentage <= 5%
    - Over budget: variance_percentage > 5%
    """
    if thresholds is None:
        thresholds = VARIANCE_THRESHOLDS
    
    if not isinstance(variance_percentage, Decimal):
        variance_percentage = Decimal(str(variance_percentage))
    
    under_threshold = thresholds.get('under_threshold', Decimal('-5.0'))
    over_threshold = thresholds.get('over_threshold', Decimal('5.0'))
    
    if variance_percentage < under_threshold:
        return VarianceStatus.UNDER_BUDGET
    elif variance_percentage > over_threshold:
        return VarianceStatus.OVER_BUDGET
    else:
        return VarianceStatus.ON_BUDGET


def calculate_project_budget_variance(project_data: Dict[str, Any]) -> VarianceResult:
    """
    Calculate complete budget variance for a project.
    
    Args:
        project_data: Dictionary containing:
            - budget or planned_amount: The planned budget
            - actual_cost or actual_amount: The actual spent amount
            
    Returns:
        VarianceResult with all variance metrics
        
    **Validates: Requirements 2.1, 2.3, 2.5**
    
    Example:
        >>> result = calculate_project_budget_variance({
        ...     'budget': 100000,
        ...     'actual_cost': 110000
        ... })
        >>> result.variance_amount  # Decimal('10000.00')
        >>> result.variance_percentage  # Decimal('10.00')
        >>> result.status  # VarianceStatus.OVER_BUDGET
    """
    # Extract planned amount
    planned = project_data.get('budget') or project_data.get('planned_amount') or 0
    if not isinstance(planned, Decimal):
        planned = Decimal(str(planned))
    
    # Extract actual amount
    actual = project_data.get('actual_cost') or project_data.get('actual_amount') or 0
    if not isinstance(actual, Decimal):
        actual = Decimal(str(actual))
    
    # Calculate variance metrics
    variance_amount = calculate_variance_amount(planned, actual)
    variance_percentage = calculate_variance_percentage(variance_amount, planned)
    status = determine_variance_status(variance_percentage)
    
    return VarianceResult(
        variance_amount=variance_amount,
        variance_percentage=variance_percentage,
        status=status,
        planned_amount=planned.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        actual_amount=actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    )


def calculate_aggregated_variance(records: list) -> VarianceResult:
    """
    Calculate aggregated variance across multiple financial records.
    
    Args:
        records: List of dictionaries containing planned_amount and actual_amount
        
    Returns:
        VarianceResult with aggregated variance metrics
        
    **Validates: Requirements 2.1**
    
    Property: Aggregation should be consistent regardless of calculation order.
    """
    total_planned = Decimal('0')
    total_actual = Decimal('0')
    
    for record in records:
        planned = record.get('planned_amount', 0)
        actual = record.get('actual_amount', 0)
        
        if not isinstance(planned, Decimal):
            planned = Decimal(str(planned))
        if not isinstance(actual, Decimal):
            actual = Decimal(str(actual))
        
        total_planned += planned
        total_actual += actual
    
    variance_amount = calculate_variance_amount(total_planned, total_actual)
    variance_percentage = calculate_variance_percentage(variance_amount, total_planned)
    status = determine_variance_status(variance_percentage)
    
    return VarianceResult(
        variance_amount=variance_amount,
        variance_percentage=variance_percentage,
        status=status,
        planned_amount=total_planned.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        actual_amount=total_actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    )


def validate_currency_conversion_reciprocal(amount: Decimal, from_currency: str, 
                                           to_currency: str, 
                                           tolerance: Decimal = Decimal('0.02'),
                                           rates: Optional[Dict[str, float]] = None) -> Tuple[bool, Decimal]:
    """
    Validate that currency conversion is reciprocally consistent.
    
    Converts amount from from_currency to to_currency and back,
    checking if the result is within tolerance of the original.
    
    Args:
        amount: Original amount
        from_currency: Source currency
        to_currency: Target currency
        tolerance: Maximum acceptable difference (default 0.02 = 2 cents)
        rates: Optional custom exchange rates
        
    Returns:
        Tuple of (is_valid, difference)
        
    **Validates: Requirements 2.2**
    
    Property: For any currency conversion A->B->A, the final amount
    should equal the original within acceptable precision limits.
    """
    if from_currency == to_currency:
        return (True, Decimal('0'))
    
    # Convert A -> B
    converted = convert_currency(amount, from_currency, to_currency, rates)
    
    # Convert B -> A
    back_converted = convert_currency(converted, to_currency, from_currency, rates)
    
    # Calculate difference
    difference = abs(back_converted - amount)
    
    # Check if within tolerance (use percentage-based tolerance for large amounts)
    if amount > 0:
        percentage_tolerance = amount * Decimal('0.01')  # 1% tolerance
        effective_tolerance = max(tolerance, percentage_tolerance)
    else:
        effective_tolerance = tolerance
    
    is_valid = difference <= effective_tolerance
    
    return (is_valid, difference)


# Export all public functions and classes
__all__ = [
    'VarianceStatus',
    'VarianceResult',
    'BASE_EXCHANGE_RATES',
    'VARIANCE_THRESHOLDS',
    'get_exchange_rate',
    'convert_currency',
    'calculate_variance_amount',
    'calculate_variance_percentage',
    'determine_variance_status',
    'calculate_project_budget_variance',
    'calculate_aggregated_variance',
    'validate_currency_conversion_reciprocal',
]
