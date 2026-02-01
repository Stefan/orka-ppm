"""
Tests for Distribution Rules Engine
Phase 2 & 3: Distribution Settings and Rules
"""
import pytest
from datetime import datetime, timedelta
from backend.services.distribution_rules_engine import (
    DistributionRulesEngine,
    DistributionProfile,
    DistributionRuleType,
    Granularity
)


@pytest.fixture
def engine():
    """Create distribution engine instance"""
    return DistributionRulesEngine()


class TestCalculatePeriods:
    """Test period calculation"""
    
    def test_weekly_periods(self, engine):
        """Test weekly period generation"""
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 29)  # 4 weeks
        
        periods = engine.calculate_periods(start, end, Granularity.WEEK)
        
        assert len(periods) == 4
        assert periods[0].start_date == start
        assert periods[-1].end_date == end
    
    def test_monthly_periods(self, engine):
        """Test monthly period generation"""
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)  # 3 months
        
        periods = engine.calculate_periods(start, end, Granularity.MONTH)
        
        assert len(periods) == 3
        assert periods[0].start_date == start
    
    def test_periods_are_contiguous(self, engine):
        """Test that periods have no gaps"""
        start = datetime(2024, 1, 1)
        end = datetime(2024, 3, 1)
        
        periods = engine.calculate_periods(start, end, Granularity.MONTH)
        
        for i in range(len(periods) - 1):
            assert periods[i].end_date == periods[i + 1].start_date


class TestLinearDistribution:
    """Test linear distribution"""
    
    def test_even_distribution(self, engine):
        """Test budget is distributed evenly"""
        budget = 10000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)
        
        result = engine.apply_linear_distribution(budget, start, end, Granularity.MONTH)
        
        assert result.error is None
        assert len(result.periods) == 3
        assert abs(result.total - budget) < 0.01
        
        # Each period should have approximately equal amount
        expected_amount = budget / 3
        for period in result.periods:
            assert abs(period.amount - expected_amount) < 0.01
            assert abs(period.percentage - 33.33) < 0.1
    
    def test_percentages_sum_to_100(self, engine):
        """Test percentages sum to 100"""
        budget = 50000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 7, 1)
        
        result = engine.apply_linear_distribution(budget, start, end, Granularity.MONTH)
        
        total_percentage = sum(p.percentage for p in result.periods)
        assert abs(total_percentage - 100.0) < 0.01


class TestCustomDistribution:
    """Test custom distribution"""
    
    def test_valid_custom_percentages(self, engine):
        """Test custom distribution with valid percentages"""
        budget = 12000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)
        custom_percentages = [20.0, 30.0, 50.0]  # Sums to 100
        
        result = engine.apply_custom_distribution(
            budget, start, end, Granularity.MONTH, custom_percentages
        )
        
        assert result.error is None
        assert len(result.periods) == 3
        assert abs(result.periods[0].amount - 2400) < 0.01  # 20% of 12000
        assert abs(result.periods[1].amount - 3600) < 0.01  # 30% of 12000
        assert abs(result.periods[2].amount - 6000) < 0.01  # 50% of 12000
    
    def test_invalid_percentage_sum(self, engine):
        """Test custom distribution with invalid percentage sum"""
        budget = 10000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)
        custom_percentages = [20.0, 30.0, 40.0]  # Sums to 90, not 100
        
        result = engine.apply_custom_distribution(
            budget, start, end, Granularity.MONTH, custom_percentages
        )
        
        assert result.error is not None
        assert "must sum to 100%" in result.error
    
    def test_wrong_number_of_percentages(self, engine):
        """Test custom distribution with wrong number of percentages"""
        budget = 10000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)
        custom_percentages = [50.0, 50.0]  # Only 2, but 3 periods expected
        
        result = engine.apply_custom_distribution(
            budget, start, end, Granularity.MONTH, custom_percentages
        )
        
        assert result.error is not None
        assert "Expected 3 percentages" in result.error


class TestSCurveDistribution:
    """Test AI-generated S-curve distribution"""
    
    def test_s_curve_generation(self, engine):
        """Test S-curve distribution generation"""
        budget = 100000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 7, 1)
        
        result = engine.generate_s_curve_distribution(budget, start, end, Granularity.MONTH)
        
        assert result.error is None
        assert len(result.periods) == 6
        assert abs(result.total - budget) < 0.01
        assert result.confidence is not None
        assert 0 < result.confidence <= 1
    
    def test_s_curve_shape(self, engine):
        """Test that S-curve has typical shape (slow-fast-slow)"""
        budget = 60000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 7, 1)
        
        result = engine.generate_s_curve_distribution(budget, start, end, Granularity.MONTH)
        
        amounts = [p.amount for p in result.periods]
        
        # First period should be less than middle period
        assert amounts[0] < amounts[len(amounts) // 2]
        # Last period should be less than middle period
        assert amounts[-1] < amounts[len(amounts) // 2]


class TestReprofiling:
    """Test reprofiling distribution"""
    
    def test_reprofile_with_remaining_budget(self, engine):
        """Test reprofiling with remaining budget"""
        budget = 100000
        current_spend = 40000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 7, 1)
        current_date = datetime(2024, 4, 1)  # Halfway through
        
        result = engine.apply_reprofiling(
            budget, current_spend, start, end, Granularity.MONTH, current_date
        )
        
        assert result.error is None
        
        # Only future periods should have amounts
        remaining_budget = budget - current_spend
        total_future = sum(
            p.amount for p in result.periods 
            if p.start_date >= current_date
        )
        assert abs(total_future - remaining_budget) < 0.01
        
        # Past periods should be zero
        for period in result.periods:
            if period.start_date < current_date:
                assert period.amount == 0
    
    def test_reprofile_budget_consumed(self, engine):
        """Test reprofiling when budget is fully consumed"""
        budget = 100000
        current_spend = 100000  # All consumed
        start = datetime(2024, 1, 1)
        end = datetime(2024, 7, 1)
        current_date = datetime(2024, 4, 1)
        
        result = engine.apply_reprofiling(
            budget, current_spend, start, end, Granularity.MONTH, current_date
        )
        
        assert result.error is not None
        assert "fully consumed" in result.error.lower()
        
        # All periods should be zero
        for period in result.periods:
            assert period.amount == 0
    
    def test_reprofile_no_remaining_periods(self, engine):
        """Test reprofiling when all periods are in the past"""
        budget = 100000
        current_spend = 40000
        start = datetime(2024, 1, 1)
        end = datetime(2024, 4, 1)
        current_date = datetime(2024, 5, 1)  # After end date
        
        result = engine.apply_reprofiling(
            budget, current_spend, start, end, Granularity.MONTH, current_date
        )
        
        assert result.error is not None
        assert "No remaining periods" in result.error


class TestApplyRule:
    """Test rule application"""
    
    def test_apply_automatic_rule(self, engine):
        """Test applying automatic (linear) rule"""
        result = engine.apply_rule(
            rule_type=DistributionRuleType.AUTOMATIC,
            profile=DistributionProfile.LINEAR,
            total_budget=50000,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 4, 1),
            granularity=Granularity.MONTH
        )
        
        assert result.error is None
        assert result.profile == DistributionProfile.LINEAR
        assert len(result.periods) == 3
    
    def test_apply_reprofiling_rule(self, engine):
        """Test applying reprofiling rule"""
        result = engine.apply_rule(
            rule_type=DistributionRuleType.REPROFILING,
            profile=DistributionProfile.LINEAR,
            total_budget=100000,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 7, 1),
            granularity=Granularity.MONTH,
            current_spend=30000
        )
        
        assert result.error is None
        remaining = 100000 - 30000
        total_amount = sum(p.amount for p in result.periods)
        assert abs(total_amount - remaining) < 0.01
    
    def test_apply_ai_generator_rule(self, engine):
        """Test applying AI generator rule"""
        result = engine.apply_rule(
            rule_type=DistributionRuleType.AI_GENERATOR,
            profile=DistributionProfile.AI_GENERATED,
            total_budget=80000,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 5, 1),
            granularity=Granularity.MONTH
        )
        
        assert result.error is None
        assert result.profile == DistributionProfile.AI_GENERATED
        assert result.confidence is not None
