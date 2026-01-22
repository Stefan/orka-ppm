"""
Variance Calculator Service for SAP PO Breakdown Management

This module provides a dedicated VarianceCalculator class for calculating
financial variances, remaining amounts, and currency conversions with
comprehensive audit trails.

**Validates: Requirements 3.1, 3.2, 3.3**

Requirements:
- 3.1: Support planned, committed, and actual amount fields
- 3.2: Automatically calculate remaining amounts (planned - actual)
- 3.3: Apply currency conversions with exchange rates and audit trail
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID, uuid4

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VarianceStatus(str, Enum):
    """
    Status classification for variance analysis.
    
    Thresholds:
    - on_track: <= 5%
    - minor_variance: <= 15%
    - significant_variance: <= 50%
    - critical_variance: > 50%
    """
    on_track = "on_track"
    minor_variance = "minor_variance"
    significant_variance = "significant_variance"
    critical_variance = "critical_variance"


class VarianceAlertType(str, Enum):
    """
    Types of variance alerts that can be generated.
    
    **Validates: Requirement 3.5**
    """
    budget_exceeded = "budget_exceeded"
    commitment_exceeded = "commitment_exceeded"
    negative_variance = "negative_variance"
    trend_deteriorating = "trend_deteriorating"
    threshold_warning = "threshold_warning"


class AlertSeverity(str, Enum):
    """
    Severity levels for variance alerts.
    
    **Validates: Requirement 3.5**
    """
    info = "info"
    warning = "warning"
    critical = "critical"


@dataclass
class CurrencyConversionAuditEntry:
    """
    Audit trail entry for currency conversion operations.
    
    **Validates: Requirement 3.3**
    """
    id: UUID
    timestamp: datetime
    original_amount: Decimal
    converted_amount: Decimal
    from_currency: str
    to_currency: str
    exchange_rate: Decimal
    conversion_source: str  # e.g., "manual", "api", "database"
    user_id: Optional[UUID] = None
    notes: Optional[str] = None


@dataclass
class VarianceAlert:
    """
    Alert generated for variance threshold violations.
    
    **Validates: Requirements 3.4, 3.5, 5.6**
    """
    id: UUID
    breakdown_id: Optional[UUID]
    project_id: Optional[UUID]
    alert_type: VarianceAlertType
    severity: AlertSeverity
    threshold_exceeded: Decimal
    current_variance: Decimal
    message: str
    recommended_actions: List[str]
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VarianceResult:
    """
    Result of variance calculation for a single item.
    
    **Validates: Requirements 3.1, 3.2**
    """
    remaining_amount: Decimal
    variance_percentage: Decimal
    variance_status: VarianceStatus
    planned_amount: Decimal
    actual_amount: Decimal
    committed_amount: Decimal
    planned_vs_actual: Decimal
    planned_vs_committed: Decimal
    committed_vs_actual: Decimal
    calculated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ProjectVarianceResult:
    """
    Comprehensive variance analysis for an entire project.
    
    **Validates: Requirements 3.4, 5.6**
    """
    project_id: UUID
    total_planned: Decimal
    total_actual: Decimal
    total_committed: Decimal
    total_remaining: Decimal
    overall_variance_percentage: Decimal
    overall_variance_status: VarianceStatus
    item_count: int
    items_over_budget: int
    items_under_budget: int
    alerts: List[VarianceAlert]
    calculated_at: datetime = field(default_factory=datetime.now)


@dataclass
class CurrencyConversionResult:
    """
    Result of currency conversion with audit information.
    
    **Validates: Requirement 3.3**
    """
    original_amount: Decimal
    converted_amount: Decimal
    from_currency: str
    to_currency: str
    exchange_rate: Decimal
    audit_entry: CurrencyConversionAuditEntry


# Default variance thresholds (in percentage)
VARIANCE_THRESHOLDS = {
    'on_track': Decimal('5.0'),        # <= 5%
    'minor_variance': Decimal('15.0'),  # <= 15%
    'significant_variance': Decimal('50.0'),  # <= 50%
    # > 50% is critical_variance
}

# Default exchange rates to USD (for fallback)
DEFAULT_EXCHANGE_RATES: Dict[str, Decimal] = {
    'USD': Decimal('1.0'),
    'EUR': Decimal('0.92'),
    'GBP': Decimal('0.79'),
    'JPY': Decimal('149.50'),
    'CHF': Decimal('0.88'),
    'CAD': Decimal('1.36'),
    'AUD': Decimal('1.53'),
}


class VarianceCalculator:
    """
    Dedicated calculator for financial variance analysis in PO breakdown management.
    
    This class provides methods for:
    - Calculating remaining amounts (planned - actual)
    - Computing variance percentages
    - Currency conversion with audit trails
    - Determining variance status based on thresholds
    
    **Validates: Requirements 3.1, 3.2, 3.3**
    
    Example usage:
        calculator = VarianceCalculator()
        
        # Calculate remaining amount
        remaining = calculator.calculate_remaining_amount(
            planned=Decimal('10000'),
            actual=Decimal('7500')
        )  # Returns Decimal('2500.00')
        
        # Calculate variance percentage
        variance_pct = calculator.calculate_variance_percentage(
            planned=Decimal('10000'),
            actual=Decimal('11500')
        )  # Returns Decimal('15.00')
        
        # Convert currency with audit trail
        result = calculator.convert_currency(
            amount=Decimal('1000'),
            from_currency='EUR',
            to_currency='USD',
            exchange_rate=Decimal('1.09')
        )  # Returns CurrencyConversionResult with audit entry
    """
    
    def __init__(
        self,
        thresholds: Optional[Dict[str, Decimal]] = None,
        exchange_rates: Optional[Dict[str, Decimal]] = None
    ):
        """
        Initialize the VarianceCalculator.
        
        Args:
            thresholds: Custom variance thresholds (optional)
            exchange_rates: Custom exchange rates to USD (optional)
        """
        self.thresholds = thresholds or VARIANCE_THRESHOLDS.copy()
        self.exchange_rates = exchange_rates or DEFAULT_EXCHANGE_RATES.copy()
        self._audit_log: List[CurrencyConversionAuditEntry] = []
    
    def calculate_remaining_amount(
        self,
        planned: Decimal,
        actual: Decimal
    ) -> Decimal:
        """
        Calculate the remaining amount (planned - actual).
        
        **Validates: Requirement 3.2**
        
        The remaining amount represents how much budget is left to spend.
        A positive value means under budget, negative means over budget.
        
        Args:
            planned: The planned/budgeted amount
            actual: The actual spent amount
            
        Returns:
            Remaining amount as Decimal (planned - actual)
            
        Raises:
            ValueError: If inputs cannot be converted to Decimal
            
        Example:
            >>> calc = VarianceCalculator()
            >>> calc.calculate_remaining_amount(Decimal('10000'), Decimal('7500'))
            Decimal('2500.00')
            >>> calc.calculate_remaining_amount(Decimal('10000'), Decimal('12000'))
            Decimal('-2000.00')
        """
        planned = self._ensure_decimal(planned, "planned")
        actual = self._ensure_decimal(actual, "actual")
        
        remaining = planned - actual
        return remaining.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def calculate_variance_percentage(
        self,
        planned: Decimal,
        actual: Decimal
    ) -> Decimal:
        """
        Calculate the variance percentage relative to planned amount.
        
        **Validates: Requirements 3.1, 3.2**
        
        Variance Percentage = ((actual - planned) / planned) * 100
        
        A positive percentage means over budget (actual > planned).
        A negative percentage means under budget (actual < planned).
        
        Args:
            planned: The planned/budgeted amount
            actual: The actual spent amount
            
        Returns:
            Variance percentage as Decimal
            Returns Decimal('0.00') if planned is zero (to avoid division by zero)
            
        Raises:
            ValueError: If inputs cannot be converted to Decimal
            
        Example:
            >>> calc = VarianceCalculator()
            >>> calc.calculate_variance_percentage(Decimal('10000'), Decimal('11500'))
            Decimal('15.00')
            >>> calc.calculate_variance_percentage(Decimal('10000'), Decimal('8500'))
            Decimal('-15.00')
        """
        planned = self._ensure_decimal(planned, "planned")
        actual = self._ensure_decimal(actual, "actual")
        
        # Handle zero planned amount to avoid division by zero
        if planned == Decimal('0'):
            return Decimal('0.00')
        
        variance_amount = actual - planned
        percentage = (variance_amount / planned) * Decimal('100')
        
        return percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def convert_currency(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        exchange_rate: Optional[Decimal] = None,
        user_id: Optional[UUID] = None,
        notes: Optional[str] = None
    ) -> CurrencyConversionResult:
        """
        Convert an amount from one currency to another with audit trail.
        
        **Validates: Requirement 3.3**
        
        This method performs currency conversion and creates an audit trail
        entry for compliance and tracking purposes.
        
        Args:
            amount: The amount to convert
            from_currency: Source currency code (ISO 4217, e.g., 'USD', 'EUR')
            to_currency: Target currency code (ISO 4217)
            exchange_rate: Exchange rate to use (optional, will calculate if not provided)
            user_id: ID of user performing the conversion (optional)
            notes: Additional notes for audit trail (optional)
            
        Returns:
            CurrencyConversionResult containing converted amount and audit entry
            
        Raises:
            ValueError: If currency codes are invalid or exchange rate is invalid
            
        Example:
            >>> calc = VarianceCalculator()
            >>> result = calc.convert_currency(
            ...     amount=Decimal('1000'),
            ...     from_currency='EUR',
            ...     to_currency='USD',
            ...     exchange_rate=Decimal('1.09')
            ... )
            >>> result.converted_amount
            Decimal('1090.00')
        """
        amount = self._ensure_decimal(amount, "amount")
        from_currency = from_currency.upper().strip()
        to_currency = to_currency.upper().strip()
        
        # Validate currency codes
        self._validate_currency_code(from_currency)
        self._validate_currency_code(to_currency)
        
        # Same currency - no conversion needed
        if from_currency == to_currency:
            exchange_rate = Decimal('1.0')
            converted_amount = amount
        else:
            # Use provided exchange rate or calculate from stored rates
            if exchange_rate is None:
                exchange_rate = self._get_exchange_rate(from_currency, to_currency)
            else:
                exchange_rate = self._ensure_decimal(exchange_rate, "exchange_rate")
                if exchange_rate <= Decimal('0'):
                    raise ValueError("Exchange rate must be positive")
            
            converted_amount = amount * exchange_rate
        
        # Round to 2 decimal places
        converted_amount = converted_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Create audit entry
        audit_entry = CurrencyConversionAuditEntry(
            id=uuid4(),
            timestamp=datetime.now(),
            original_amount=amount,
            converted_amount=converted_amount,
            from_currency=from_currency,
            to_currency=to_currency,
            exchange_rate=exchange_rate.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP),
            conversion_source="manual" if exchange_rate else "calculated",
            user_id=user_id,
            notes=notes
        )
        
        # Store in audit log
        self._audit_log.append(audit_entry)
        
        logger.info(
            f"Currency conversion: {amount} {from_currency} -> "
            f"{converted_amount} {to_currency} (rate: {exchange_rate})"
        )
        
        return CurrencyConversionResult(
            original_amount=amount,
            converted_amount=converted_amount,
            from_currency=from_currency,
            to_currency=to_currency,
            exchange_rate=exchange_rate,
            audit_entry=audit_entry
        )
    
    def calculate_item_variance(
        self,
        breakdown: Dict[str, Any]
    ) -> VarianceResult:
        """
        Calculate comprehensive variance data for a single PO breakdown item.
        
        **Validates: Requirements 3.1, 3.2**
        
        This method calculates all variance metrics for a breakdown item:
        - Remaining amount (planned - actual)
        - Variance percentage
        - Variance status based on thresholds
        - Planned vs actual, planned vs committed, committed vs actual
        
        Args:
            breakdown: Dictionary containing breakdown data with keys:
                - planned_amount: Planned/budgeted amount
                - actual_amount: Actual spent amount
                - committed_amount: Committed amount (optional, defaults to 0)
                
        Returns:
            VarianceResult with all calculated variance metrics
            
        Raises:
            ValueError: If required fields are missing or invalid
            
        Example:
            >>> calc = VarianceCalculator()
            >>> result = calc.calculate_item_variance({
            ...     'planned_amount': Decimal('10000'),
            ...     'actual_amount': Decimal('11500'),
            ...     'committed_amount': Decimal('10500')
            ... })
            >>> result.variance_status
            <VarianceStatus.minor_variance: 'minor_variance'>
        """
        # Extract and validate amounts
        planned = self._extract_amount(breakdown, 'planned_amount')
        actual = self._extract_amount(breakdown, 'actual_amount')
        committed = self._extract_amount(breakdown, 'committed_amount', default=Decimal('0'))
        
        # Calculate remaining amount (Requirement 3.2)
        remaining_amount = self.calculate_remaining_amount(planned, actual)
        
        # Calculate variance percentage
        variance_percentage = self.calculate_variance_percentage(planned, actual)
        
        # Determine variance status
        variance_status = self.determine_variance_status(variance_percentage)
        
        # Calculate additional variance metrics
        planned_vs_actual = (planned - actual).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        planned_vs_committed = (planned - committed).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        committed_vs_actual = (committed - actual).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        return VarianceResult(
            remaining_amount=remaining_amount,
            variance_percentage=variance_percentage,
            variance_status=variance_status,
            planned_amount=planned,
            actual_amount=actual,
            committed_amount=committed,
            planned_vs_actual=planned_vs_actual,
            planned_vs_committed=planned_vs_committed,
            committed_vs_actual=committed_vs_actual,
            calculated_at=datetime.now()
        )
    
    def determine_variance_status(
        self,
        variance_percentage: Decimal
    ) -> VarianceStatus:
        """
        Determine the variance status based on percentage thresholds.
        
        **Validates: Requirements 3.1, 3.5**
        
        Status thresholds (using absolute value of variance):
        - on_track: <= 5%
        - minor_variance: <= 15%
        - significant_variance: <= 50%
        - critical_variance: > 50%
        
        Args:
            variance_percentage: The calculated variance percentage
            
        Returns:
            VarianceStatus enum value
            
        Example:
            >>> calc = VarianceCalculator()
            >>> calc.determine_variance_status(Decimal('3.5'))
            <VarianceStatus.on_track: 'on_track'>
            >>> calc.determine_variance_status(Decimal('12.0'))
            <VarianceStatus.minor_variance: 'minor_variance'>
            >>> calc.determine_variance_status(Decimal('35.0'))
            <VarianceStatus.significant_variance: 'significant_variance'>
            >>> calc.determine_variance_status(Decimal('75.0'))
            <VarianceStatus.critical_variance: 'critical_variance'>
        """
        variance_percentage = self._ensure_decimal(variance_percentage, "variance_percentage")
        abs_percentage = abs(variance_percentage)
        
        if abs_percentage <= self.thresholds['on_track']:
            return VarianceStatus.on_track
        elif abs_percentage <= self.thresholds['minor_variance']:
            return VarianceStatus.minor_variance
        elif abs_percentage <= self.thresholds['significant_variance']:
            return VarianceStatus.significant_variance
        else:
            return VarianceStatus.critical_variance
    
    def get_audit_log(self) -> List[CurrencyConversionAuditEntry]:
        """
        Get the currency conversion audit log.
        
        **Validates: Requirement 3.3**
        
        Returns:
            List of CurrencyConversionAuditEntry objects
        """
        return self._audit_log.copy()
    
    def clear_audit_log(self) -> int:
        """
        Clear the currency conversion audit log.
        
        Returns:
            Number of entries cleared
        """
        count = len(self._audit_log)
        self._audit_log.clear()
        return count
    
    def set_exchange_rate(self, currency: str, rate_to_usd: Decimal) -> None:
        """
        Set or update an exchange rate.
        
        Args:
            currency: Currency code (ISO 4217)
            rate_to_usd: Exchange rate to USD (how many units of currency per 1 USD)
        """
        currency = currency.upper().strip()
        self._validate_currency_code(currency)
        rate_to_usd = self._ensure_decimal(rate_to_usd, "rate_to_usd")
        
        if rate_to_usd <= Decimal('0'):
            raise ValueError("Exchange rate must be positive")
        
        self.exchange_rates[currency] = rate_to_usd
        logger.info(f"Updated exchange rate: {currency} = {rate_to_usd} per USD")
    
    def set_threshold(self, level: str, percentage: Decimal) -> None:
        """
        Set or update a variance threshold.
        
        Args:
            level: Threshold level ('on_track', 'minor_variance', 'significant_variance')
            percentage: Threshold percentage value
        """
        if level not in self.thresholds:
            raise ValueError(f"Invalid threshold level: {level}")
        
        percentage = self._ensure_decimal(percentage, "percentage")
        if percentage < Decimal('0'):
            raise ValueError("Threshold percentage must be non-negative")
        
        self.thresholds[level] = percentage
        logger.info(f"Updated threshold: {level} = {percentage}%")
    
    def calculate_project_variance(
        self,
        project_id: UUID,
        breakdown_items: List[Dict[str, Any]],
        alert_threshold: Optional[Decimal] = None
    ) -> ProjectVarianceResult:
        """
        Calculate comprehensive variance analysis for an entire project.
        
        **Validates: Requirements 3.4, 5.6**
        
        This method aggregates variance data across all PO breakdown items
        in a project and generates alerts for items exceeding thresholds.
        
        Args:
            project_id: UUID of the project
            breakdown_items: List of breakdown item dictionaries with financial data
            alert_threshold: Percentage threshold for generating alerts (default: 50%)
                           When variance exceeds this threshold, an alert is generated
                           
        Returns:
            ProjectVarianceResult with aggregated variance data and alerts
            
        Raises:
            ValueError: If breakdown_items is empty or contains invalid data
            
        Example:
            >>> calc = VarianceCalculator()
            >>> items = [
            ...     {'id': uuid4(), 'planned_amount': Decimal('10000'), 'actual_amount': Decimal('11500')},
            ...     {'id': uuid4(), 'planned_amount': Decimal('5000'), 'actual_amount': Decimal('4800')}
            ... ]
            >>> result = calc.calculate_project_variance(uuid4(), items)
            >>> result.overall_variance_percentage
            Decimal('8.33')
        """
        if not breakdown_items:
            raise ValueError("breakdown_items cannot be empty")
        
        # Default alert threshold is 50% (Requirement 3.5)
        if alert_threshold is None:
            alert_threshold = Decimal('50.0')
        else:
            alert_threshold = self._ensure_decimal(alert_threshold, "alert_threshold")
        
        # Initialize aggregation variables
        total_planned = Decimal('0')
        total_actual = Decimal('0')
        total_committed = Decimal('0')
        items_over_budget = 0
        items_under_budget = 0
        alerts: List[VarianceAlert] = []
        
        # Process each breakdown item
        for item in breakdown_items:
            # Extract amounts
            planned = self._extract_amount(item, 'planned_amount')
            actual = self._extract_amount(item, 'actual_amount')
            committed = self._extract_amount(item, 'committed_amount', default=Decimal('0'))
            
            # Aggregate totals
            total_planned += planned
            total_actual += actual
            total_committed += committed
            
            # Track over/under budget items
            if actual > planned:
                items_over_budget += 1
            elif actual < planned:
                items_under_budget += 1
            
            # Calculate item variance and check for alerts
            variance_pct = self.calculate_variance_percentage(planned, actual)
            
            # Generate alert if threshold exceeded (Requirement 3.5)
            if abs(variance_pct) > alert_threshold:
                alert = self._generate_variance_alert(
                    breakdown_id=item.get('id'),
                    project_id=project_id,
                    variance_pct=variance_pct,
                    threshold=alert_threshold,
                    planned=planned,
                    actual=actual,
                    committed=committed
                )
                alerts.append(alert)
        
        # Calculate overall project variance
        total_remaining = total_planned - total_actual
        overall_variance_pct = self.calculate_variance_percentage(total_planned, total_actual)
        overall_status = self.determine_variance_status(overall_variance_pct)
        
        return ProjectVarianceResult(
            project_id=project_id,
            total_planned=total_planned.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            total_actual=total_actual.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            total_committed=total_committed.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            total_remaining=total_remaining.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            overall_variance_percentage=overall_variance_pct,
            overall_variance_status=overall_status,
            item_count=len(breakdown_items),
            items_over_budget=items_over_budget,
            items_under_budget=items_under_budget,
            alerts=alerts,
            calculated_at=datetime.now()
        )
    
    def generate_variance_alert(
        self,
        breakdown_id: Optional[UUID],
        project_id: Optional[UUID],
        variance_result: VarianceResult,
        threshold: Optional[Decimal] = None
    ) -> Optional[VarianceAlert]:
        """
        Generate a variance alert if thresholds are exceeded.
        
        **Validates: Requirements 3.5, 5.6**
        
        This method checks if a variance result exceeds configured thresholds
        and generates an appropriate alert with recommended actions.
        
        Args:
            breakdown_id: UUID of the breakdown item (optional)
            project_id: UUID of the project (optional)
            variance_result: VarianceResult to check
            threshold: Custom threshold percentage (default: 50%)
            
        Returns:
            VarianceAlert if threshold exceeded, None otherwise
            
        Example:
            >>> calc = VarianceCalculator()
            >>> variance = calc.calculate_item_variance({
            ...     'planned_amount': Decimal('10000'),
            ...     'actual_amount': Decimal('16000')
            ... })
            >>> alert = calc.generate_variance_alert(uuid4(), uuid4(), variance)
            >>> alert.severity
            <AlertSeverity.critical: 'critical'>
        """
        if threshold is None:
            threshold = Decimal('50.0')
        else:
            threshold = self._ensure_decimal(threshold, "threshold")
        
        variance_pct = variance_result.variance_percentage
        
        # Check if threshold exceeded
        if abs(variance_pct) <= threshold:
            return None
        
        return self._generate_variance_alert(
            breakdown_id=breakdown_id,
            project_id=project_id,
            variance_pct=variance_pct,
            threshold=threshold,
            planned=variance_result.planned_amount,
            actual=variance_result.actual_amount,
            committed=variance_result.committed_amount
        )
    
    def detect_budget_overruns(
        self,
        breakdown_items: List[Dict[str, Any]],
        threshold_percentage: Optional[Decimal] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect all budget overruns in a list of breakdown items.
        
        **Validates: Requirements 3.5, 5.6**
        
        This method identifies all items where actual spending exceeds
        planned budget by more than the specified threshold.
        
        Args:
            breakdown_items: List of breakdown item dictionaries
            threshold_percentage: Overrun threshold (default: 0%, any overrun)
            
        Returns:
            List of dictionaries containing overrun details:
                - breakdown_id: UUID of the item
                - planned_amount: Planned budget
                - actual_amount: Actual spending
                - overrun_amount: Amount over budget
                - overrun_percentage: Percentage over budget
                - variance_status: VarianceStatus enum value
                
        Example:
            >>> calc = VarianceCalculator()
            >>> items = [
            ...     {'id': uuid4(), 'planned_amount': Decimal('10000'), 'actual_amount': Decimal('11500')},
            ...     {'id': uuid4(), 'planned_amount': Decimal('5000'), 'actual_amount': Decimal('4800')}
            ... ]
            >>> overruns = calc.detect_budget_overruns(items)
            >>> len(overruns)
            1
        """
        if threshold_percentage is None:
            threshold_percentage = Decimal('0.0')
        else:
            threshold_percentage = self._ensure_decimal(threshold_percentage, "threshold_percentage")
        
        overruns = []
        
        for item in breakdown_items:
            planned = self._extract_amount(item, 'planned_amount')
            actual = self._extract_amount(item, 'actual_amount')
            
            # Calculate overrun
            overrun_amount = actual - planned
            
            # Only include if over budget
            if overrun_amount > Decimal('0'):
                variance_pct = self.calculate_variance_percentage(planned, actual)
                
                # Check if exceeds threshold
                if variance_pct >= threshold_percentage:
                    overruns.append({
                        'breakdown_id': item.get('id'),
                        'planned_amount': planned,
                        'actual_amount': actual,
                        'overrun_amount': overrun_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                        'overrun_percentage': variance_pct,
                        'variance_status': self.determine_variance_status(variance_pct)
                    })
        
        # Sort by overrun percentage (highest first)
        overruns.sort(key=lambda x: x['overrun_percentage'], reverse=True)
        
        return overruns
    
    # =========================================================================
    # Private Helper Methods
    # =========================================================================
    
    def _generate_variance_alert(
        self,
        breakdown_id: Optional[UUID],
        project_id: Optional[UUID],
        variance_pct: Decimal,
        threshold: Decimal,
        planned: Decimal,
        actual: Decimal,
        committed: Decimal
    ) -> VarianceAlert:
        """
        Generate a variance alert with appropriate severity and recommendations.
        
        **Validates: Requirements 3.5, 5.6**
        """
        # Determine alert type and severity
        if actual > planned:
            if actual > committed:
                alert_type = VarianceAlertType.budget_exceeded
            else:
                alert_type = VarianceAlertType.commitment_exceeded
        else:
            alert_type = VarianceAlertType.negative_variance
        
        # Determine severity based on variance status
        variance_status = self.determine_variance_status(variance_pct)
        if variance_status == VarianceStatus.critical_variance:
            severity = AlertSeverity.critical
        elif variance_status in [VarianceStatus.significant_variance, VarianceStatus.minor_variance]:
            severity = AlertSeverity.warning
        else:
            severity = AlertSeverity.info
        
        # Generate message
        if variance_pct > Decimal('0'):
            message = (
                f"Budget overrun detected: Actual spending ({actual}) exceeds "
                f"planned budget ({planned}) by {variance_pct}%"
            )
        else:
            message = (
                f"Under budget: Actual spending ({actual}) is {abs(variance_pct)}% "
                f"below planned budget ({planned})"
            )
        
        # Generate recommended actions
        recommended_actions = self._generate_recommended_actions(
            variance_pct=variance_pct,
            variance_status=variance_status,
            alert_type=alert_type
        )
        
        return VarianceAlert(
            id=uuid4(),
            breakdown_id=breakdown_id,
            project_id=project_id,
            alert_type=alert_type,
            severity=severity,
            threshold_exceeded=threshold,
            current_variance=variance_pct,
            message=message,
            recommended_actions=recommended_actions,
            created_at=datetime.now(),
            metadata={
                'planned_amount': str(planned),
                'actual_amount': str(actual),
                'committed_amount': str(committed),
                'variance_status': variance_status.value
            }
        )
    
    def _generate_recommended_actions(
        self,
        variance_pct: Decimal,
        variance_status: VarianceStatus,
        alert_type: VarianceAlertType
    ) -> List[str]:
        """
        Generate recommended actions based on variance analysis.
        
        **Validates: Requirement 3.5**
        """
        actions = []
        
        if variance_status == VarianceStatus.critical_variance:
            actions.append("URGENT: Review project budget and spending immediately")
            actions.append("Conduct detailed cost analysis to identify root causes")
            actions.append("Consider implementing cost control measures")
            actions.append("Escalate to project stakeholders and management")
        elif variance_status == VarianceStatus.significant_variance:
            actions.append("Review spending patterns and identify cost drivers")
            actions.append("Update project forecasts and financial projections")
            actions.append("Consider budget reallocation or change requests")
        elif variance_status == VarianceStatus.minor_variance:
            actions.append("Monitor spending trends closely")
            actions.append("Review upcoming commitments and planned expenses")
        
        if alert_type == VarianceAlertType.budget_exceeded:
            actions.append("Verify all actual costs are correctly recorded")
            actions.append("Review and approve any pending change orders")
        elif alert_type == VarianceAlertType.commitment_exceeded:
            actions.append("Review committed amounts and purchase orders")
            actions.append("Ensure all commitments are properly tracked")
        
        return actions
    
    def _ensure_decimal(self, value: Any, field_name: str) -> Decimal:
        """Convert value to Decimal, raising ValueError if invalid."""
        if isinstance(value, Decimal):
            return value
        
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid {field_name}: {value}") from e
    
    def _extract_amount(
        self,
        data: Dict[str, Any],
        field: str,
        default: Optional[Decimal] = None
    ) -> Decimal:
        """Extract and convert an amount field from a dictionary."""
        value = data.get(field)
        
        if value is None:
            if default is not None:
                return default
            raise ValueError(f"Missing required field: {field}")
        
        return self._ensure_decimal(value, field)
    
    def _validate_currency_code(self, currency: str) -> None:
        """Validate currency code format."""
        if not currency or len(currency) != 3 or not currency.isalpha():
            raise ValueError(f"Invalid currency code: {currency}. Must be 3-letter ISO 4217 code.")
    
    def _get_exchange_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """
        Calculate exchange rate between two currencies.
        
        Uses USD as the base currency for conversion.
        """
        if from_currency == to_currency:
            return Decimal('1.0')
        
        # Get rates to USD
        from_rate = self.exchange_rates.get(from_currency)
        to_rate = self.exchange_rates.get(to_currency)
        
        if from_rate is None:
            raise ValueError(f"No exchange rate available for {from_currency}")
        if to_rate is None:
            raise ValueError(f"No exchange rate available for {to_currency}")
        
        if from_rate == Decimal('0'):
            raise ValueError(f"Invalid exchange rate for {from_currency}: rate cannot be zero")
        
        # Convert: from_currency -> USD -> to_currency
        # from_rate = units of from_currency per 1 USD
        # to_rate = units of to_currency per 1 USD
        # So: 1 from_currency = (1/from_rate) USD = (to_rate/from_rate) to_currency
        exchange_rate = to_rate / from_rate
        
        return exchange_rate.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)


# Export public interface
__all__ = [
    'VarianceCalculator',
    'VarianceStatus',
    'VarianceAlertType',
    'AlertSeverity',
    'VarianceResult',
    'ProjectVarianceResult',
    'VarianceAlert',
    'CurrencyConversionResult',
    'CurrencyConversionAuditEntry',
    'VARIANCE_THRESHOLDS',
    'DEFAULT_EXCHANGE_RATES',
]
