#!/usr/bin/env python3
"""
Test script for Analytics Tracker functionality
Tests the core analytics tracking features including question categorization,
metrics calculation, and report generation.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from uuid import uuid4

from services.analytics_tracker import (
    AnalyticsTracker, EventType, QuestionCategory, 
    get_analytics_tracker
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_question_categorization():
    """Test question categorization functionality"""
    print("\n" + "="*50)
    print("TESTING QUESTION CATEGORIZATION")
    print("="*50)
    
    tracker = get_analytics_tracker()
    
    test_queries = [
        ("How do I navigate to the dashboard?", QuestionCategory.NAVIGATION),
        ("How can I create a new project?", QuestionCategory.FEATURE_USAGE),
        ("The system is showing an error message", QuestionCategory.TROUBLESHOOTING),
        ("What are the best practices for resource allocation?", QuestionCategory.BEST_PRACTICES),
        ("How do I integrate with external APIs?", QuestionCategory.INTEGRATION),
        ("How can I generate a performance report?", QuestionCategory.REPORTING),
        ("Where are the user settings located?", QuestionCategory.CONFIGURATION),
        ("What is the weather like today?", QuestionCategory.GENERAL)  # Should be general/off-topic
    ]
    
    correct_predictions = 0
    total_predictions = len(test_queries)
    
    for query, expected_category in test_queries:
        analysis = tracker._categorize_question(query)
        
        print(f"\nQuery: '{query}'")
        print(f"Expected: {expected_category.value}")
        print(f"Predicted: {analysis.category.value}")
        print(f"Confidence: {analysis.confidence:.2f}")
        print(f"Keywords: {analysis.keywords}")
        print(f"Complexity: {analysis.complexity_score:.2f}")
        
        if analysis.category == expected_category:
            correct_predictions += 1
            print("✅ CORRECT")
        else:
            print("❌ INCORRECT")
    
    accuracy = (correct_predictions / total_predictions) * 100
    print(f"\nCategorization Accuracy: {accuracy:.1f}% ({correct_predictions}/{total_predictions})")
    
    return accuracy > 60  # At least 60% accuracy

async def test_analytics_tracking():
    """Test analytics event tracking"""
    print("\n" + "="*50)
    print("TESTING ANALYTICS TRACKING")
    print("="*50)
    
    tracker = get_analytics_tracker()
    test_user_id = str(uuid4())
    
    # Test query tracking
    print("Testing query tracking...")
    success = await tracker.track_query(
        user_id=test_user_id,
        query="How do I create a new project?",
        response="To create a new project, navigate to the Projects section...",
        response_time_ms=1500,
        confidence=0.85,
        sources=[{"type": "help_content", "id": "proj_001", "title": "Project Creation Guide"}],
        page_context={"route": "/projects", "page_title": "Projects"},
        session_id="test_session_001"
    )
    
    if success:
        print("✅ Query tracking successful")
    else:
        print("❌ Query tracking failed")
    
    # Test feedback tracking
    print("Testing feedback tracking...")
    success = await tracker.track_feedback(
        user_id=test_user_id,
        message_id="msg_001",
        rating=4,
        feedback_text="Very helpful response",
        feedback_type="helpful",
        page_context={"route": "/projects", "page_title": "Projects"},
        session_id="test_session_001"
    )
    
    if success:
        print("✅ Feedback tracking successful")
    else:
        print("❌ Feedback tracking failed")
    
    # Test proactive tip tracking
    print("Testing proactive tip tracking...")
    success = await tracker.track_proactive_tip(
        user_id=test_user_id,
        tip_id="tip_001",
        tip_type="feature_discovery",
        action="shown",
        page_context={"route": "/dashboard", "page_title": "Dashboard"},
        session_id="test_session_001"
    )
    
    if success:
        print("✅ Proactive tip tracking successful")
    else:
        print("❌ Proactive tip tracking failed")
    
    return True

async def test_metrics_calculation():
    """Test usage metrics calculation"""
    print("\n" + "="*50)
    print("TESTING METRICS CALCULATION")
    print("="*50)
    
    tracker = get_analytics_tracker()
    
    # Get metrics for the last 7 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    print(f"Calculating metrics from {start_date.date()} to {end_date.date()}")
    
    try:
        metrics = await tracker.get_usage_metrics(start_date, end_date)
        
        print(f"Total Queries: {metrics.total_queries}")
        print(f"Unique Users: {metrics.unique_users}")
        print(f"Avg Response Time: {metrics.avg_response_time:.2f}ms")
        print(f"Satisfaction Rate: {metrics.satisfaction_rate:.1f}%")
        
        if metrics.category_distribution:
            print("\nCategory Distribution:")
            for category, count in metrics.category_distribution.items():
                print(f"  {category}: {count}")
        
        if metrics.top_queries:
            print("\nTop Queries:")
            for i, query_data in enumerate(metrics.top_queries[:3], 1):
                print(f"  {i}. {query_data['query']} ({query_data['count']} times)")
        
        print("✅ Metrics calculation successful")
        return True
        
    except Exception as e:
        print(f"❌ Metrics calculation failed: {e}")
        return False

async def test_weekly_report():
    """Test weekly report generation"""
    print("\n" + "="*50)
    print("TESTING WEEKLY REPORT GENERATION")
    print("="*50)
    
    tracker = get_analytics_tracker()
    
    try:
        # Generate report for last week
        report = await tracker.generate_weekly_report()
        
        print(f"Report Period: {report.week_start.date()} to {report.week_end.date()}")
        print(f"Total Queries: {report.metrics.total_queries}")
        print(f"Unique Users: {report.metrics.unique_users}")
        print(f"Satisfaction Rate: {report.metrics.satisfaction_rate:.1f}%")
        
        if report.trends:
            print("\nTrends:")
            for trend, value in report.trends.items():
                print(f"  {trend}: {value}")
        
        if report.recommendations:
            print("\nRecommendations:")
            for i, rec in enumerate(report.recommendations, 1):
                print(f"  {i}. {rec}")
        
        print("✅ Weekly report generation successful")
        return True
        
    except Exception as e:
        print(f"❌ Weekly report generation failed: {e}")
        return False

async def test_privacy_compliance():
    """Test privacy compliance features"""
    print("\n" + "="*50)
    print("TESTING PRIVACY COMPLIANCE")
    print("="*50)
    
    tracker = get_analytics_tracker()
    
    # Test user ID anonymization
    test_user_id = "user_12345"
    anonymized_1 = tracker._anonymize_user_id(test_user_id)
    anonymized_2 = tracker._anonymize_user_id(test_user_id)
    
    print(f"Original User ID: {test_user_id}")
    print(f"Anonymized: {anonymized_1}")
    print(f"Consistent: {anonymized_1 == anonymized_2}")
    
    if anonymized_1 == anonymized_2 and anonymized_1 != test_user_id:
        print("✅ User ID anonymization working correctly")
    else:
        print("❌ User ID anonymization failed")
        return False
    
    # Test data sanitization
    sensitive_data = {
        "query": "How do I reset my password?",
        "user_email": "user@example.com",
        "session_token": "secret_token_123",
        "response": "A" * 2000,  # Very long response
        "normal_field": "normal_value"
    }
    
    sanitized = tracker._sanitize_event_data(sensitive_data)
    
    print(f"\nOriginal fields: {list(sensitive_data.keys())}")
    print(f"Sanitized fields: {list(sanitized.keys())}")
    
    # Check that sensitive fields are removed
    sensitive_removed = "user_email" not in sanitized and "session_token" not in sanitized
    # Check that long text is truncated
    response_truncated = len(sanitized.get("response", "")) <= 1003  # 1000 + "..."
    
    if sensitive_removed and response_truncated:
        print("✅ Data sanitization working correctly")
        return True
    else:
        print("❌ Data sanitization failed")
        return False

async def run_all_tests():
    """Run all analytics tracker tests"""
    print("ANALYTICS TRACKER TEST SUITE")
    print("="*60)
    
    tests = [
        ("Question Categorization", test_question_categorization),
        ("Analytics Tracking", test_analytics_tracking),
        ("Metrics Calculation", test_metrics_calculation),
        ("Weekly Report", test_weekly_report),
        ("Privacy Compliance", test_privacy_compliance)
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            if result:
                passed_tests += 1
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
    
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    print(f"Passed: {passed_tests}/{total_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check implementation.")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)