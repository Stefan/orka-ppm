"""
Distribution Rules Engine for Cash Out Forecast
Phase 2 & 3: Automated distribution settings and AI-powered rules
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class DistributionProfile(str, Enum):
    """Distribution profile types"""
    LINEAR = "linear"
    CUSTOM = "custom"
    AI_GENERATED = "ai_generated"


class DistributionRuleType(str, Enum):
    """Distribution rule types"""
    AUTOMATIC = "automatic"
    REPROFILING = "reprofiling"
    AI_GENERATOR = "ai_generator"


class Granularity(str, Enum):
    """Time period granularity"""
    WEEK = "week"
    MONTH = "month"


class DistributionPeriod:
    """Distribution period with amount and dates"""
    def __init__(self, start_date: datetime, end_date: datetime, amount: float, percentage: float):
        self.start_date = start_date
        self.end_date = end_date
        self.amount = amount
        self.percentage = percentage
        self.label = self._generate_label()
    
    def _generate_label(self) -> str:
        """Generate human-readable label"""
        return self.start_date.strftime("%b %d, %Y")
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "amount": round(self.amount, 2),
            "percentage": round(self.percentage, 2),
            "label": self.label
        }


class DistributionResult:
    """Result of distribution calculation"""
    def __init__(
        self, 
        periods: List[DistributionPeriod], 
        total: float, 
        profile: DistributionProfile,
        confidence: Optional[float] = None,
        error: Optional[str] = None
    ):
        self.periods = periods
        self.total = total
        self.profile = profile
        self.confidence = confidence
        self.error = error
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        result = {
            "periods": [p.to_dict() for p in self.periods],
            "total": round(self.total, 2),
            "profile": self.profile.value
        }
        if self.confidence is not None:
            result["confidence"] = round(self.confidence, 2)
        if self.error:
            result["error"] = self.error
        return result


class DistributionRulesEngine:
    """
    Distribution Rules Engine for automated budget distribution
    Implements Phase 2 (Distribution Settings) and Phase 3 (AI Rules)
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def calculate_periods(
        self, 
        start_date: datetime, 
        end_date: datetime, 
        granularity: Granularity
    ) -> List[DistributionPeriod]:
        """Calculate time periods based on date range and granularity"""
        periods = []
        current = start_date
        
        while current < end_date:
            period_start = current
            
            if granularity == Granularity.WEEK:
                period_end = min(current + timedelta(days=7), end_date)
            else:  # MONTH
                # Calculate next month
                if current.month == 12:
                    period_end = current.replace(year=current.year + 1, month=1, day=1)
                else:
                    period_end = current.replace(month=current.month + 1, day=1)
                period_end = min(period_end, end_date)
            
            periods.append(DistributionPeriod(
                start_date=period_start,
                end_date=period_end,
                amount=0,  # Will be set by distribution calculation
                percentage=0
            ))
            
            current = period_end
        
        return periods
    
    def apply_linear_distribution(
        self, 
        total_budget: float, 
        start_date: datetime, 
        end_date: datetime,
        granularity: Granularity
    ) -> DistributionResult:
        """
        Apply linear distribution (even spread across periods)
        Phase 2: Distribution Settings
        """
        periods = self.calculate_periods(start_date, end_date, granularity)
        
        if not periods:
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.LINEAR,
                error="No periods available"
            )
        
        amount_per_period = total_budget / len(periods)
        percentage_per_period = 100.0 / len(periods)
        
        for period in periods:
            period.amount = amount_per_period
            period.percentage = percentage_per_period
        
        return DistributionResult(
            periods=periods,
            total=total_budget,
            profile=DistributionProfile.LINEAR
        )
    
    def apply_custom_distribution(
        self, 
        total_budget: float, 
        start_date: datetime, 
        end_date: datetime,
        granularity: Granularity,
        custom_percentages: List[float]
    ) -> DistributionResult:
        """
        Apply custom distribution with user-defined percentages
        Phase 2: Distribution Settings
        """
        periods = self.calculate_periods(start_date, end_date, granularity)
        
        if not periods:
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.CUSTOM,
                error="No periods available"
            )
        
        if len(custom_percentages) != len(periods):
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.CUSTOM,
                error=f"Expected {len(periods)} percentages, got {len(custom_percentages)}"
            )
        
        total_percentage = sum(custom_percentages)
        if abs(total_percentage - 100.0) > 0.01:
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.CUSTOM,
                error=f"Percentages must sum to 100%, got {total_percentage:.2f}%"
            )
        
        for period, percentage in zip(periods, custom_percentages):
            period.percentage = percentage
            period.amount = (total_budget * percentage) / 100.0
        
        return DistributionResult(
            periods=periods,
            total=total_budget,
            profile=DistributionProfile.CUSTOM
        )
    
    def generate_s_curve_distribution(
        self, 
        total_budget: float, 
        start_date: datetime, 
        end_date: datetime,
        granularity: Granularity
    ) -> DistributionResult:
        """
        Generate AI-powered S-curve distribution
        Phase 3: AI Generator
        Typical project spending pattern: slow start, ramp up, slow end
        """
        import math
        
        periods = self.calculate_periods(start_date, end_date, granularity)
        
        if not periods:
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.AI_GENERATED,
                error="No periods available"
            )
        
        # Generate S-curve using logistic function
        n = len(periods)
        cumulative_values = []
        
        for i in range(n):
            x = i / (n - 1) if n > 1 else 0
            # Logistic S-curve: 1 / (1 + e^(-10*(x-0.5)))
            s_curve = 1 / (1 + math.exp(-10 * (x - 0.5)))
            cumulative_values.append(s_curve)
        
        # Convert cumulative to incremental (spending per period)
        percentages = []
        for i in range(n):
            if i == 0:
                percentages.append(cumulative_values[i])
            else:
                percentages.append(cumulative_values[i] - cumulative_values[i-1])
        
        # Normalize to 100%
        total_pct = sum(percentages)
        percentages = [(p / total_pct) * 100 for p in percentages]
        
        for period, percentage in zip(periods, percentages):
            period.percentage = percentage
            period.amount = (total_budget * percentage) / 100.0
        
        return DistributionResult(
            periods=periods,
            total=total_budget,
            profile=DistributionProfile.AI_GENERATED,
            confidence=0.85  # Mock confidence score
        )
    
    def apply_reprofiling(
        self, 
        total_budget: float,
        current_spend: float,
        start_date: datetime, 
        end_date: datetime,
        granularity: Granularity,
        current_date: Optional[datetime] = None
    ) -> DistributionResult:
        """
        Apply reprofiling based on actual consumption
        Phase 3: Reprofiling Rule
        Redistributes remaining budget to future periods
        """
        if current_date is None:
            current_date = datetime.now()
        
        periods = self.calculate_periods(start_date, end_date, granularity)
        
        if not periods:
            return DistributionResult(
                periods=[],
                total=0,
                profile=DistributionProfile.LINEAR,
                error="No periods available"
            )
        
        remaining_budget = total_budget - current_spend
        
        if remaining_budget <= 0:
            # Budget consumed, zero out all periods
            for period in periods:
                period.amount = 0
                period.percentage = 0
            return DistributionResult(
                periods=periods,
                total=0,
                profile=DistributionProfile.LINEAR,
                error="Budget fully consumed"
            )
        
        # Find remaining periods (future only)
        remaining_periods = [p for p in periods if p.start_date >= current_date]
        
        if not remaining_periods:
            # No future periods
            for period in periods:
                period.amount = 0
                period.percentage = 0
            return DistributionResult(
                periods=periods,
                total=0,
                profile=DistributionProfile.LINEAR,
                error="No remaining periods"
            )
        
        # Redistribute remaining budget linearly
        amount_per_period = remaining_budget / len(remaining_periods)
        percentage_per_period = 100.0 / len(remaining_periods)
        
        for period in periods:
            if period.start_date >= current_date:
                period.amount = amount_per_period
                period.percentage = percentage_per_period
            else:
                period.amount = 0
                period.percentage = 0
        
        return DistributionResult(
            periods=periods,
            total=remaining_budget,
            profile=DistributionProfile.LINEAR
        )
    
    def apply_rule(
        self,
        rule_type: DistributionRuleType,
        profile: DistributionProfile,
        total_budget: float,
        start_date: datetime,
        end_date: datetime,
        granularity: Granularity,
        custom_percentages: Optional[List[float]] = None,
        current_spend: Optional[float] = None
    ) -> DistributionResult:
        """
        Apply a distribution rule based on type and profile
        Phase 3: Distribution Rules Engine
        """
        self.logger.info(f"Applying rule: type={rule_type}, profile={profile}")
        
        if rule_type == DistributionRuleType.AUTOMATIC:
            return self.apply_linear_distribution(total_budget, start_date, end_date, granularity)
        
        elif rule_type == DistributionRuleType.REPROFILING:
            if current_spend is None:
                current_spend = 0
            return self.apply_reprofiling(
                total_budget, current_spend, start_date, end_date, granularity
            )
        
        elif rule_type == DistributionRuleType.AI_GENERATOR:
            if profile == DistributionProfile.CUSTOM and custom_percentages:
                return self.apply_custom_distribution(
                    total_budget, start_date, end_date, granularity, custom_percentages
                )
            else:
                return self.generate_s_curve_distribution(
                    total_budget, start_date, end_date, granularity
                )
        
        else:
            return DistributionResult(
                periods=[],
                total=0,
                profile=profile,
                error=f"Unknown rule type: {rule_type}"
            )
