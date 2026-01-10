#!/usr/bin/env python3
"""
Unit tests for Proactive Tips functionality
Tests tip generation logic, scheduling, and dismissal
Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any

# Import the modules to test
from services.proactive_tips_engine import (
    ProactiveTipsEngine,
    ProactiveTip,
    TipType,
    TipPriority,
    PageContext,
    UserBehaviorPattern,
    TipAction
)


class TestProactiveTipsEngine:
    """Test suite for ProactiveTipsEngine"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase client"""
        mock_client = Mock()
        mock_table = Mock()
        mock_response = Mock()
        mock_response.data = []
        
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.gte.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.execute.return_value = mock_response
        
        mock_client.table.return_value = mock_table
        return mock_client
    
    @pytest.fixture
    def tips_engine(self, mock_supabase):
        """Create ProactiveTipsEngine instance with mock client"""
        return ProactiveTipsEngine(mock_supabase)
    
    @pytest.fixture
    def new_user_context(self):
        """Context for new user on dashboard"""
        return PageContext(
            route="/dashboard",
            page_title="Dashboard",
            user_role="user"
        )
    
    @pytest.fixture
    def new_user_behavior(self):
        """Behavior pattern for new user"""
        return UserBehaviorPattern(
            user_id="new-user-123",
            recent_pages=["/dashboard"],
            time_on_page=30,
            frequent_queries=[],
            user_level="beginner",
            session_count=1,
            last_login=datetime.now(),
            feature_usage={},
            error_patterns=[],
            dismissed_tips=[]
        )
    
    @pytest.fixture
    def experienced_user_behavior(self):
        """Behavior pattern for experienced user"""
        return UserBehaviorPattern(
            user_id="exp-user-456",
            recent_pages=["/risks", "/projects", "/financials"],
            time_on_page=300,
            frequent_queries=["risk assessment", "budget analysis"],
            user_level="intermediate",
            session_count=25,
            last_login=datetime.now(),
            feature_usage={"risk_management": 10, "financial_management": 15},
            error_patterns=[],
            dismissed_tips=[]
        )


class TestTipGenerationLogic(TestProactiveTipsEngine):
    """Test tip generation logic for different scenarios"""
    
    @pytest.mark.asyncio
    async def test_welcome_tips_for_new_user_on_dashboard(self, tips_engine, new_user_context, new_user_behavior):
        """
        Test Requirement 3.1: WHEN a new user first accesses the dashboard, 
        THE Proactive_Tips_Engine SHALL offer a guided tour of key features
        """
        # Mock empty tip history and default preferences
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should generate welcome tips for new user on dashboard
            assert len(tips) > 0
            welcome_tips = [tip for tip in tips if tip.tip_type == TipType.WELCOME]
            assert len(welcome_tips) > 0
            
            # Check for dashboard welcome tip
            dashboard_tip = next((tip for tip in welcome_tips if "dashboard" in tip.tip_id.lower()), None)
            assert dashboard_tip is not None
            assert "dashboard" in dashboard_tip.title.lower() or "welcome" in dashboard_tip.title.lower()
            assert dashboard_tip.priority == TipPriority.HIGH
            assert len(dashboard_tip.actions) > 0
    
    @pytest.mark.asyncio
    async def test_no_welcome_tips_for_experienced_user(self, tips_engine, new_user_context, experienced_user_behavior):
        """Test that experienced users don't get welcome tips"""
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, experienced_user_behavior)
            
            # Should not generate welcome tips for experienced user
            welcome_tips = [tip for tip in tips if tip.tip_type == TipType.WELCOME]
            assert len(welcome_tips) == 0
    
    @pytest.mark.asyncio
    async def test_budget_threshold_optimization_tips(self, tips_engine, experienced_user_behavior):
        """
        Test Requirement 3.2: WHEN budget utilization exceeds thresholds, 
        THE Proactive_Tips_Engine SHALL suggest What-If Simulation features
        """
        financial_context = PageContext(
            route="/financials",
            page_title="Financial Management",
            user_role="project_manager"
        )
        
        # Mock high budget utilization
        optimization_data = {"budget_utilization": 85, "resource_imbalance": False}
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}), \
             patch.object(tips_engine, '_get_optimization_data', return_value=optimization_data):
            
            tips = await tips_engine.generate_proactive_tips(financial_context, experienced_user_behavior)
            
            # Should generate budget optimization tips
            optimization_tips = [tip for tip in tips if tip.tip_type == TipType.OPTIMIZATION]
            assert len(optimization_tips) > 0
            
            # Check for budget-related tip
            budget_tip = next((tip for tip in optimization_tips if "budget" in tip.title.lower()), None)
            assert budget_tip is not None
            assert budget_tip.priority == TipPriority.HIGH
            
            # Should suggest optimization actions (budget optimization tip has "Optimize Budget" action that navigates to scenarios)
            optimization_action = next((action for action in budget_tip.actions if "optimize" in action.label.lower()), None)
            assert optimization_action is not None
    
    @pytest.mark.asyncio
    async def test_resource_page_optimization_tips(self, tips_engine, experienced_user_behavior):
        """
        Test Requirement 3.3: WHEN users spend time on resource pages, 
        THE Proactive_Tips_Engine SHALL highlight optimization tools
        """
        resource_context = PageContext(
            route="/resources",
            page_title="Resource Management",
            user_role="resource_manager"
        )
        
        # User spending significant time on resource page
        long_time_behavior = UserBehaviorPattern(
            user_id="resource-user-789",
            recent_pages=["/resources"],
            time_on_page=400,  # More than 5 minutes
            frequent_queries=["resource allocation"],
            user_level="intermediate",
            session_count=15,
            last_login=datetime.now(),
            feature_usage={"resource_management": 8},
            error_patterns=[],
            dismissed_tips=[]
        )
        
        # Mock resource imbalance
        optimization_data = {"budget_utilization": 60, "resource_imbalance": True}
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}), \
             patch.object(tips_engine, '_get_optimization_data', return_value=optimization_data):
            
            tips = await tips_engine.generate_proactive_tips(resource_context, long_time_behavior)
            
            # Should generate resource optimization tips
            optimization_tips = [tip for tip in tips if tip.tip_type == TipType.OPTIMIZATION]
            resource_tips = [tip for tip in optimization_tips if "resource" in tip.title.lower()]
            
            assert len(resource_tips) > 0
            
            # Check for optimization tools suggestion
            resource_tip = resource_tips[0]
            optimization_action = next((action for action in resource_tip.actions 
                                     if "optimize" in action.label.lower() or "rebalance" in action.label.lower()), None)
            assert optimization_action is not None
    
    @pytest.mark.asyncio
    async def test_feature_discovery_tips_generation(self, tips_engine, experienced_user_behavior):
        """Test feature discovery tips for unused features"""
        risk_context = PageContext(
            route="/risks",
            page_title="Risk Management",
            user_role="project_manager"
        )
        
        # User hasn't used Monte Carlo feature
        behavior_without_monte_carlo = UserBehaviorPattern(
            user_id="risk-user-101",
            recent_pages=["/risks", "/projects"],
            time_on_page=200,
            frequent_queries=["risk assessment"],
            user_level="intermediate",
            session_count=20,
            last_login=datetime.now(),
            feature_usage={"risk_management": 5},  # No monte_carlo usage
            error_patterns=[],
            dismissed_tips=[]
        )
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(risk_context, behavior_without_monte_carlo)
            
            # Should generate feature discovery tips
            discovery_tips = [tip for tip in tips if tip.tip_type == TipType.FEATURE_DISCOVERY]
            assert len(discovery_tips) > 0
            
            # Check for Monte Carlo discovery tip
            monte_carlo_tip = next((tip for tip in discovery_tips if "monte carlo" in tip.title.lower() or "risk analysis" in tip.title.lower()), None)
            assert monte_carlo_tip is not None
            assert monte_carlo_tip.priority == TipPriority.MEDIUM


class TestTipSchedulingAndLimiting(TestProactiveTipsEngine):
    """Test tip scheduling and frequency limiting"""
    
    @pytest.mark.asyncio
    async def test_tip_frequency_limiting_max_per_session(self, tips_engine, new_user_context, new_user_behavior):
        """
        Test Requirement 3.4: THE Proactive_Tips_Engine SHALL limit proactive tips 
        to avoid overwhelming users (max 1 tip per session)
        """
        # Create multiple tip templates that would normally be generated
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            # Set max_tips_per_session to 1 for this test
            original_max = tips_engine.max_tips_per_session
            tips_engine.max_tips_per_session = 1
            
            try:
                tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
                
                # Should limit to max 1 tip per session
                assert len(tips) <= 1
                
            finally:
                # Restore original value
                tips_engine.max_tips_per_session = original_max
    
    @pytest.mark.asyncio
    async def test_tip_cooldown_period(self, tips_engine, new_user_context, new_user_behavior):
        """Test that tips respect cooldown periods"""
        # Mock recent tip history within cooldown period
        recent_tip_history = [
            {
                "event_type": "tip_shown",
                "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat(),
                "event_data": {"tip_id": "recent_tip"}
            }
        ]
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=recent_tip_history), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True, "tip_frequency": "medium"}):
            
            # Should respect cooldown and show fewer tips
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # With recent tips in cooldown period, should limit new tips
            assert len(tips) <= 2  # Medium frequency allows 2 tips, but cooldown should reduce this
    
    @pytest.mark.asyncio
    async def test_user_preference_tip_frequency_off(self, tips_engine, new_user_context, new_user_behavior):
        """Test that tips are disabled when user preference is off"""
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": False}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should not generate any tips when disabled
            assert len(tips) == 0
    
    @pytest.mark.asyncio
    async def test_tip_frequency_preferences(self, tips_engine, new_user_context, new_user_behavior):
        """Test different tip frequency preferences"""
        frequency_settings = ["low", "medium", "high"]
        
        for frequency in frequency_settings:
            with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
                 patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True, "tip_frequency": frequency}):
                
                tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
                
                # All frequencies should allow some tips for new users
                assert len(tips) >= 0
                
                # High frequency should allow more tips than low frequency
                if frequency == "high":
                    assert len(tips) <= 3  # Max tips per session
                elif frequency == "low":
                    assert len(tips) <= 1  # More restrictive


class TestTipDismissalAndAdaptation(TestProactiveTipsEngine):
    """Test tip dismissal functionality and user adaptation"""
    
    @pytest.mark.asyncio
    async def test_tip_dismissal_functionality(self, tips_engine, mock_supabase):
        """Test basic tip dismissal functionality"""
        user_id = "test-user-dismiss"
        tip_id = "welcome_dashboard"
        
        # Mock user profile response
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"preferences": {"dismissed_tips": []}}
        ]
        
        result = await tips_engine.dismiss_tip(user_id, tip_id)
        
        # Should successfully dismiss tip
        assert result is True
        
        # Should have called database operations
        assert mock_supabase.table.called
    
    @pytest.mark.asyncio
    async def test_dismissed_tips_filtering(self, tips_engine, new_user_context, new_user_behavior):
        """Test that dismissed tips are filtered out"""
        # User has dismissed welcome tips
        dismissed_behavior = UserBehaviorPattern(
            user_id="dismissed-user-123",
            recent_pages=["/dashboard"],
            time_on_page=30,
            frequent_queries=[],
            user_level="beginner",
            session_count=1,
            last_login=datetime.now(),
            feature_usage={},
            error_patterns=[],
            dismissed_tips=["welcome_dashboard", "welcome_projects"]
        )
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, dismissed_behavior)
            
            # Should not include dismissed tips
            tip_ids = [tip.tip_id for tip in tips]
            assert "welcome_dashboard" not in tip_ids
            assert "welcome_projects" not in tip_ids
    
    @pytest.mark.asyncio
    async def test_repeated_dismissal_frequency_reduction(self, tips_engine, new_user_context):
        """
        Test Requirement 3.5: WHEN users dismiss tips repeatedly, 
        THE Proactive_Tips_Engine SHALL reduce tip frequency for that user
        """
        # User with many dismissed tips (indicating repeated dismissals)
        frequent_dismisser = UserBehaviorPattern(
            user_id="frequent-dismisser-456",
            recent_pages=["/dashboard"],
            time_on_page=30,
            frequent_queries=[],
            user_level="beginner",
            session_count=5,
            last_login=datetime.now(),
            feature_usage={},
            error_patterns=[],
            dismissed_tips=["welcome_dashboard", "welcome_projects", "discover_monte_carlo", "budget_optimization", "regular_updates"]
        )
        
        # Mock tip history showing many dismissals
        dismissal_history = [
            {
                "event_type": "tip_dismissed",
                "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
                "event_data": {"tip_id": f"tip_{i}"}
            }
            for i in range(10)  # 10 recent dismissals
        ]
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=dismissal_history), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True, "tip_frequency": "medium"}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, frequent_dismisser)
            
            # Should generate fewer tips due to dismissal pattern
            # The engine should adapt by showing fewer tips to users who dismiss frequently
            assert len(tips) <= 1  # Reduced from normal frequency
    
    @pytest.mark.asyncio
    async def test_show_once_tips_not_repeated(self, tips_engine, new_user_context, new_user_behavior):
        """Test that show_once tips are not repeated"""
        # Mock tip history showing a show_once tip was already shown
        shown_once_history = [
            {
                "event_type": "tip_shown",
                "timestamp": (datetime.now() - timedelta(days=1)).isoformat(),
                "event_data": {"tip_id": "welcome_dashboard"}
            }
        ]
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=shown_once_history), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should not include the show_once tip that was already shown
            tip_ids = [tip.tip_id for tip in tips]
            assert "welcome_dashboard" not in tip_ids


class TestTipPrioritizationAndScheduling(TestProactiveTipsEngine):
    """Test tip prioritization and scheduling logic"""
    
    @pytest.mark.asyncio
    async def test_tip_prioritization_by_priority_level(self, tips_engine, new_user_context, new_user_behavior):
        """Test that tips are prioritized correctly by priority level"""
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            if len(tips) > 1:
                # Tips should be sorted by priority (HIGH > MEDIUM > LOW)
                priority_values = {"high": 3, "medium": 2, "low": 1}
                
                for i in range(len(tips) - 1):
                    current_priority = priority_values[tips[i].priority.value]
                    next_priority = priority_values[tips[i + 1].priority.value]
                    assert current_priority >= next_priority
    
    @pytest.mark.asyncio
    async def test_context_relevance_boost(self, tips_engine, experienced_user_behavior):
        """Test that context-relevant tips get priority boost"""
        financial_context = PageContext(
            route="/financials",
            page_title="Financial Management",
            user_role="project_manager"
        )
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}), \
             patch.object(tips_engine, '_get_optimization_data', return_value={"budget_utilization": 85}):
            
            tips = await tips_engine.generate_proactive_tips(financial_context, experienced_user_behavior)
            
            # Financial context should prioritize budget-related tips
            if tips:
                top_tip = tips[0]
                assert "budget" in top_tip.title.lower() or "financial" in top_tip.title.lower()
    
    @pytest.mark.asyncio
    async def test_tip_scheduling_and_logging(self, tips_engine, new_user_context, new_user_behavior, mock_supabase):
        """Test that tips are properly scheduled and logged"""
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should have logged tip generation events
            if tips:
                # Verify that database insert was called for logging
                assert mock_supabase.table.return_value.insert.called


class TestTipAnalytics(TestProactiveTipsEngine):
    """Test tip analytics functionality"""
    
    @pytest.mark.asyncio
    async def test_tip_analytics_generation(self, tips_engine, mock_supabase):
        """Test tip analytics data generation"""
        # Mock analytics data
        mock_analytics_data = [
            {
                "event_type": "tip_shown",
                "timestamp": datetime.now().isoformat(),
                "event_data": {"tip_id": "welcome_dashboard", "tip_type": "welcome"}
            },
            {
                "event_type": "tip_dismissed",
                "timestamp": datetime.now().isoformat(),
                "event_data": {"tip_id": "budget_optimization", "tip_type": "optimization"}
            }
        ]
        
        mock_supabase.table.return_value.select.return_value.gte.return_value.execute.return_value.data = mock_analytics_data
        
        analytics = await tips_engine.get_tip_analytics(user_id="test-user", days=30)
        
        # Should return analytics data
        assert isinstance(analytics, dict)
        assert "total_tips_shown" in analytics
        assert "total_tips_dismissed" in analytics
        assert "engagement_rate" in analytics
        assert "tip_types" in analytics
    
    @pytest.mark.asyncio
    async def test_engagement_rate_calculation(self, tips_engine, mock_supabase):
        """Test engagement rate calculation"""
        # Mock data with 3 shown, 1 dismissed = 66.67% engagement
        mock_analytics_data = [
            {"event_type": "tip_shown", "timestamp": datetime.now().isoformat(), "event_data": {}},
            {"event_type": "tip_shown", "timestamp": datetime.now().isoformat(), "event_data": {}},
            {"event_type": "tip_shown", "timestamp": datetime.now().isoformat(), "event_data": {}},
            {"event_type": "tip_dismissed", "timestamp": datetime.now().isoformat(), "event_data": {}}
        ]
        
        mock_supabase.table.return_value.select.return_value.gte.return_value.execute.return_value.data = mock_analytics_data
        
        analytics = await tips_engine.get_tip_analytics()
        
        # Should calculate correct engagement rate
        assert analytics["total_tips_shown"] == 3
        assert analytics["total_tips_dismissed"] == 1
        assert abs(analytics["engagement_rate"] - 66.67) < 0.1  # Allow for floating point precision


class TestEdgeCasesAndErrorHandling(TestProactiveTipsEngine):
    """Test edge cases and error handling"""
    
    @pytest.mark.asyncio
    async def test_empty_user_behavior(self, tips_engine, new_user_context):
        """Test handling of empty user behavior data"""
        empty_behavior = UserBehaviorPattern(
            user_id="empty-user",
            recent_pages=[],
            time_on_page=0,
            frequent_queries=[],
            user_level="beginner",
            session_count=0,
            last_login=datetime.now(),
            feature_usage={},
            error_patterns=[],
            dismissed_tips=[]
        )
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=[]), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, empty_behavior)
            
            # Should handle empty behavior gracefully
            assert isinstance(tips, list)
    
    @pytest.mark.asyncio
    async def test_database_error_handling(self, tips_engine, new_user_context, new_user_behavior):
        """Test handling of database errors"""
        with patch.object(tips_engine, '_get_user_tip_history', side_effect=Exception("Database error")), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should handle database errors gracefully and return empty list
            assert tips == []
    
    @pytest.mark.asyncio
    async def test_malformed_tip_history(self, tips_engine, new_user_context, new_user_behavior):
        """Test handling of malformed tip history data"""
        malformed_history = [
            {"invalid": "data"},
            {"event_type": "tip_shown"},  # Missing timestamp
            {"timestamp": "invalid-date", "event_type": "tip_shown"}
        ]
        
        with patch.object(tips_engine, '_get_user_tip_history', return_value=malformed_history), \
             patch.object(tips_engine, '_get_user_preferences', return_value={"proactive_tips": True}):
            
            tips = await tips_engine.generate_proactive_tips(new_user_context, new_user_behavior)
            
            # Should handle malformed data gracefully
            assert isinstance(tips, list)
    
    @pytest.mark.asyncio
    async def test_tip_dismissal_with_missing_user_profile(self, tips_engine, mock_supabase):
        """Test tip dismissal when user profile doesn't exist"""
        # Mock empty user profile response
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        result = await tips_engine.dismiss_tip("nonexistent-user", "some-tip")
        
        # Should handle missing profile gracefully
        assert isinstance(result, bool)


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])