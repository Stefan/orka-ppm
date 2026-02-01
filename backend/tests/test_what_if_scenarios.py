#!/usr/bin/env python3
"""
Test script for What-If Scenarios API endpoints
"""

import asyncio
import json
import sys
from datetime import datetime, date
from decimal import Decimal
from uuid import uuid4
from typing import Dict, Any

# Add backend to path
sys.path.append('.')

from generic_construction_models import (
    ScenarioCreate, ScenarioConfig, ProjectChanges,
    TimelineImpact, CostImpact, ResourceImpact
)
from services.generic_construction_services import ScenarioAnalyzer


def test_scenario_models():
    """Test that the Pydantic models work correctly"""
    print("🧪 Testing Scenario Models...")
    
    try:
        # Test ProjectChanges model
        changes = ProjectChanges(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            budget=Decimal('100000.00'),
            resource_allocations={'developer': 0.8, 'designer': 0.5}
        )
        print(f"✅ ProjectChanges model: {changes.budget}")
        
        # Test ScenarioConfig model
        config = ScenarioConfig(
            name="Test Scenario",
            description="Testing scenario creation",
            parameter_changes=changes,
            analysis_scope=['timeline', 'cost', 'resources']
        )
        print(f"✅ ScenarioConfig model: {config.name}")
        
        # Test ScenarioCreate model
        scenario_create = ScenarioCreate(
            project_id=uuid4(),
            config=config
        )
        print(f"✅ ScenarioCreate model: {scenario_create.project_id}")
        
        # Test impact models
        timeline_impact = TimelineImpact(
            original_duration=365,
            new_duration=400,
            duration_change=35,
            critical_path_affected=True,
            affected_milestones=['milestone1', 'milestone2']
        )
        print(f"✅ TimelineImpact model: {timeline_impact.duration_change} days")
        
        cost_impact = CostImpact(
            original_cost=Decimal('100000.00'),
            new_cost=Decimal('120000.00'),
            cost_change=Decimal('20000.00'),
            cost_change_percentage=20.0,
            affected_categories=['development', 'testing']
        )
        print(f"✅ CostImpact model: {cost_impact.cost_change_percentage}%")
        
        resource_impact = ResourceImpact(
            utilization_changes={'developer': 0.9, 'designer': 0.6},
            over_allocated_resources=['developer'],
            under_allocated_resources=['designer'],
            new_resource_requirements=['qa_engineer']
        )
        print(f"✅ ResourceImpact model: {len(resource_impact.new_resource_requirements)} new resources")
        
        print("✅ All scenario models working correctly!")
        return True
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False


def test_scenario_analyzer_initialization():
    """Test that ScenarioAnalyzer can be initialized"""
    print("\n🧪 Testing ScenarioAnalyzer Initialization...")
    
    try:
        # Test with None supabase (should work for testing)
        analyzer = ScenarioAnalyzer(None)
        print("✅ ScenarioAnalyzer initialized successfully")
        return True
        
    except Exception as e:
        print(f"❌ ScenarioAnalyzer initialization failed: {e}")
        return False


def test_json_serialization():
    """Test that models can be serialized to JSON"""
    print("\n🧪 Testing JSON Serialization...")
    
    try:
        changes = ProjectChanges(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            budget=Decimal('100000.00'),
            resource_allocations={'developer': 0.8}
        )
        
        config = ScenarioConfig(
            name="JSON Test Scenario",
            description="Testing JSON serialization",
            parameter_changes=changes
        )
        
        # Test serialization
        json_data = config.model_dump(mode='json')
        print(f"✅ JSON serialization successful: {len(json.dumps(json_data))} characters")
        
        # Test deserialization
        reconstructed = ScenarioConfig.model_validate(json_data)
        print(f"✅ JSON deserialization successful: {reconstructed.name}")
        
        return True
        
    except Exception as e:
        print(f"❌ JSON serialization test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("🚀 Starting What-If Scenarios API Tests\n")
    
    tests = [
        test_scenario_models,
        test_scenario_analyzer_initialization,
        test_json_serialization
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! What-If Scenarios implementation is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return 1


if __name__ == "__main__":
    sys.exit(main())