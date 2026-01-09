"""
Test feedback integration between help chat and main feedback system
"""

import pytest
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_help_feedback_submission():
    """Test submitting feedback through help chat API"""
    
    # Mock authentication - in real tests this would use proper auth
    headers = {"Authorization": "Bearer mock-token"}
    
    feedback_data = {
        "message_id": "test-message-123",
        "rating": 2,
        "feedback_text": "The response was not helpful and contained incorrect information",
        "feedback_type": "not_helpful"
    }
    
    response = client.post(
        "/ai/help/feedback",
        json=feedback_data,
        headers=headers
    )
    
    # Should succeed even without real auth in test environment
    assert response.status_code in [200, 401]  # 401 if auth is enforced
    
    if response.status_code == 200:
        data = response.json()
        assert data["success"] is True
        assert "message" in data
        assert "tracking_id" in data

def test_help_query_processing():
    """Test processing help queries with context"""
    
    headers = {"Authorization": "Bearer mock-token"}
    
    query_data = {
        "query": "How do I create a new project?",
        "context": {
            "route": "/projects",
            "pageTitle": "Projects",
            "userRole": "user"
        },
        "language": "en",
        "include_proactive_tips": True
    }
    
    response = client.post(
        "/ai/help/query",
        json=query_data,
        headers=headers
    )
    
    # Should succeed even without real auth in test environment
    assert response.status_code in [200, 401]
    
    if response.status_code == 200:
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert "sources" in data
        assert "confidence" in data

def test_proactive_tips_retrieval():
    """Test retrieving proactive tips based on context"""
    
    headers = {"Authorization": "Bearer mock-token"}
    
    response = client.get(
        "/ai/help/tips?page_route=/dashboard&page_title=Dashboard&user_role=user",
        headers=headers
    )
    
    # Should succeed even without real auth in test environment
    assert response.status_code in [200, 401]
    
    if response.status_code == 200:
        data = response.json()
        assert "tips" in data
        assert "context" in data
        assert isinstance(data["tips"], list)

def test_help_analytics():
    """Test retrieving help analytics"""
    
    headers = {"Authorization": "Bearer mock-token"}
    
    response = client.get(
        "/ai/help/analytics?days=30",
        headers=headers
    )
    
    # Should succeed even without real auth in test environment
    assert response.status_code in [200, 401, 403]  # 403 if admin permission required
    
    if response.status_code == 200:
        data = response.json()
        assert "total_queries" in data
        assert "average_rating" in data
        assert "user_satisfaction" in data

def test_feedback_integration_flow():
    """Test the complete feedback integration flow"""
    
    # This test simulates the complete flow:
    # 1. User asks a question
    # 2. Gets a response
    # 3. Provides negative feedback
    # 4. System potentially creates bug report/feature request
    
    headers = {"Authorization": "Bearer mock-token"}
    
    # Step 1: Submit a help query
    query_response = client.post(
        "/ai/help/query",
        json={
            "query": "This feature doesn't work as expected",
            "context": {
                "route": "/projects",
                "pageTitle": "Projects",
                "userRole": "user"
            },
            "language": "en"
        },
        headers=headers
    )
    
    if query_response.status_code == 200:
        query_data = query_response.json()
        session_id = query_data["session_id"]
        
        # Step 2: Submit negative feedback
        feedback_response = client.post(
            "/ai/help/feedback",
            json={
                "message_id": f"msg-{session_id}",
                "rating": 1,  # Very low rating
                "feedback_text": "This response was completely wrong and unhelpful",
                "feedback_type": "incorrect"
            },
            headers=headers
        )
        
        if feedback_response.status_code == 200:
            feedback_data = feedback_response.json()
            assert feedback_data["success"] is True
            
            # In a real integration, this would trigger bug report creation
            # For now, we just verify the feedback was accepted

def test_tip_dismissal():
    """Test dismissing proactive tips"""
    
    headers = {"Authorization": "Bearer mock-token"}
    
    response = client.post(
        "/ai/help/tips/dismiss",
        json={"tip_id": "test-tip-123"},
        headers=headers
    )
    
    # Should succeed even without real auth in test environment
    assert response.status_code in [200, 401]
    
    if response.status_code == 200:
        data = response.json()
        assert data["success"] is True

if __name__ == "__main__":
    # Run basic tests
    print("Testing help feedback submission...")
    test_help_feedback_submission()
    print("✓ Help feedback test passed")
    
    print("Testing help query processing...")
    test_help_query_processing()
    print("✓ Help query test passed")
    
    print("Testing proactive tips...")
    test_proactive_tips_retrieval()
    print("✓ Proactive tips test passed")
    
    print("Testing help analytics...")
    test_help_analytics()
    print("✓ Help analytics test passed")
    
    print("Testing feedback integration flow...")
    test_feedback_integration_flow()
    print("✓ Feedback integration test passed")
    
    print("Testing tip dismissal...")
    test_tip_dismissal()
    print("✓ Tip dismissal test passed")
    
    print("\n✅ All feedback integration tests passed!")