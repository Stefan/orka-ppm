#!/usr/bin/env python3
"""
Simple test script for the Proactive Tips Engine
"""

import asyncio
import os
import sys
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.proactive_tips_engine import (
    ProactiveTipsEngine, 
    PageContext, 
    UserBehaviorPattern,
    TipType,
    TipPriority
)

# Mock Supabase client for testing
class MockSupabaseClient:
    def table(self, table_name):
        return MockTable()

class MockTable:
    def select(self, *args):
        return self
    
    def eq(self, *args):
        return self
    
    def execute(self):
        return MockResponse()

class MockResponse:
    def __init__(self):
        self.data = []

async def test_proactive_tips_engine():
    """Test the proactive tips engine functionality"""
    print("🧪 Testing Proactive Tips Engine...")
    
    # Initialize with mock client
    mock_supabase = MockSupabaseClient()
    tips_engine = ProactiveTipsEngine(mock_supabase)
    
    # Test 1: Welcome tips for new user on dashboard
    print("\n📋 Test 1: Welcome tips for new user on dashboard")
    
    context = PageContext(
        route="/dashboard",
        page_title="Dashboard",
        user_role="user"
    )
    
    user_behavior = UserBehaviorPattern(
        user_id="test-user-1",
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
    
    tips = await tips_engine.generate_proactive_tips(context, user_behavior)
    
    print(f"Generated {len(tips)} tips:")
    for tip in tips:
        print(f"  - {tip.title} ({tip.tip_type.value}, {tip.priority.value})")
        print(f"    {tip.content[:100]}...")
        print(f"    Actions: {[action.label for action in tip.actions]}")
    
    # Test 2: Feature discovery tips for intermediate user
    print("\n📋 Test 2: Feature discovery tips for intermediate user")
    
    context = PageContext(
        route="/risks",
        page_title="Risk Management",
        user_role="project_manager"
    )
    
    user_behavior = UserBehaviorPattern(
        user_id="test-user-2",
        recent_pages=["/risks", "/projects"],
        time_on_page=180,
        frequent_queries=["risk assessment", "project risks"],
        user_level="intermediate",
        session_count=15,
        last_login=datetime.now(),
        feature_usage={"risk_management": 5},
        error_patterns=[],
        dismissed_tips=[]
    )
    
    tips = await tips_engine.generate_proactive_tips(context, user_behavior)
    
    print(f"Generated {len(tips)} tips:")
    for tip in tips:
        print(f"  - {tip.title} ({tip.tip_type.value}, {tip.priority.value})")
        print(f"    {tip.content[:100]}...")
        print(f"    Actions: {[action.label for action in tip.actions]}")
    
    # Test 3: Optimization tips for advanced user
    print("\n📋 Test 3: Optimization tips for advanced user")
    
    context = PageContext(
        route="/financials",
        page_title="Financial Management",
        user_role="portfolio_manager"
    )
    
    user_behavior = UserBehaviorPattern(
        user_id="test-user-3",
        recent_pages=["/financials", "/projects", "/portfolios"],
        time_on_page=420,
        frequent_queries=["budget optimization", "cost analysis"],
        user_level="advanced",
        session_count=50,
        last_login=datetime.now(),
        feature_usage={"financial_management": 25, "scenarios": 3},
        error_patterns=[],
        dismissed_tips=[]
    )
    
    tips = await tips_engine.generate_proactive_tips(context, user_behavior)
    
    print(f"Generated {len(tips)} tips:")
    for tip in tips:
        print(f"  - {tip.title} ({tip.tip_type.value}, {tip.priority.value})")
        print(f"    {tip.content[:100]}...")
        print(f"    Actions: {[action.label for action in tip.actions]}")
    
    # Test 4: Test tip dismissal
    print("\n📋 Test 4: Test tip dismissal")
    
    success = await tips_engine.dismiss_tip("test-user-1", "welcome_dashboard")
    print(f"Tip dismissal result: {success}")
    
    print("\n✅ Proactive Tips Engine tests completed!")

if __name__ == "__main__":
    asyncio.run(test_proactive_tips_engine())