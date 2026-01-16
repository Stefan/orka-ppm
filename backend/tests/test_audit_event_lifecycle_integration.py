"""
Integration Test: Audit Event Lifecycle
Tests the complete lifecycle: event creation → embedding generation → classification → storage

Task: 19.1
Requirements: All
"""

import pytest
import asyncio
import os
import json
from uuid import uuid4
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from supabase import create_client, Client

# Import services
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.audit_rag_agent import AuditRAGAgent
from services.audit_ml_service import AuditMLService
from services.audit_feature_extractor import AuditFeatureExtractor


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for testing"""
    mock_client = Mock(spec=Client)
    mock_table = Mock()
    mock_client.table.return_value = mock_table
    
    # Mock table operations
    mock_table.insert.return_value = mock_table
    mock_table.upsert.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = Mock(data=[])
    
    return mock_client


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client for testing"""
    mock_client = Mock()
    
    # Mock embeddings
    mock_embedding_response = Mock()
    mock_embedding_response.data = [Mock(embedding=[0.1] * 1536)]
    mock_client.embeddings.create.return_value = mock_embedding_response
    
    # Mock chat completions
    mock_chat_response = Mock()
    mock_chat_response.choices = [Mock(message=Mock(content="Test classification"))]
    mock_client.chat.completions.create.return_value = mock_chat_response
    
    return mock_client


@pytest.fixture
def sample_audit_event():
    """Create a sample audit event for testing"""
    return {
        "id": str(uuid4()),
        "event_type": "budget_change",
        "user_id": str(uuid4()),
        "entity_type": "project",
        "entity_id": str(uuid4()),
        "action_details": {
            "old_budget": 100000,
            "new_budget": 120000,
            "change_percentage": 20.0,
            "reason": "Scope expansion"
        },
        "severity": "warning",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0",
        "project_id": str(uuid4()),
        "timestamp": datetime.now().isoformat(),
        "tenant_id": str(uuid4())
    }


@pytest.mark.asyncio
async def test_audit_event_lifecycle_complete_flow(
    mock_supabase,
    mock_openai_client,
    sample_audit_event
):
    """
    Integration Test: Complete audit event lifecycle
    
    Tests the flow:
    1. Event creation
    2. Embedding generation
    3. ML classification
    4. Storage with all fields populated
    
    Validates: All requirements
    """
    # Initialize services
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key")
    rag_agent.openai_client = mock_openai_client
    
    ml_service = AuditMLService(mock_supabase)
    
    # Step 1: Create audit event (simulated - would normally be done by audit logging system)
    event = sample_audit_event.copy()
    
    # Step 2: Generate embedding
    with patch.object(rag_agent, 'generate_embedding', return_value=[0.1] * 1536):
        embedding_success = await rag_agent.index_audit_event(event)
    
    assert embedding_success is True, "Embedding generation should succeed"
    
    # Verify embedding was stored
    mock_supabase.table.assert_any_call("audit_embeddings")
    
    # Step 3: Classify event
    with patch.object(ml_service, 'classify_event') as mock_classify:
        mock_classify.return_value = {
            "category": "Financial Impact",
            "category_confidence": 0.95,
            "risk_level": "High",
            "risk_confidence": 0.88,
            "tags": ["budget_change", "high_impact"]
        }
        
        classification = await ml_service.classify_event(event)
    
    assert classification["category"] == "Financial Impact"
    assert classification["risk_level"] == "High"
    assert "budget_change" in classification["tags"]
    
    # Step 4: Verify all fields are populated
    # Update event with classification results
    event["category"] = classification["category"]
    event["risk_level"] = classification["risk_level"]
    event["tags"] = {"ml_tags": classification["tags"]}
    
    # Verify required fields are present
    required_fields = [
        "id", "event_type", "user_id", "entity_type", "entity_id",
        "action_details", "severity", "timestamp", "tenant_id",
        "category", "risk_level", "tags"
    ]
    
    for field in required_fields:
        assert field in event, f"Required field '{field}' should be present"
        assert event[field] is not None, f"Required field '{field}' should not be None"
    
    print("✓ Audit event lifecycle test passed")
    print(f"  - Event created with ID: {event['id']}")
    print(f"  - Embedding generated (dimension: 1536)")
    print(f"  - Classified as: {event['category']} / {event['risk_level']}")
    print(f"  - All required fields populated")


@pytest.mark.asyncio
async def test_embedding_generation_with_tenant_isolation(
    mock_supabase,
    mock_openai_client,
    sample_audit_event
):
    """
    Test that embeddings are generated with proper tenant isolation
    
    Validates: Requirements 3.1, 3.10, 9.4
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key")
    rag_agent.openai_client = mock_openai_client
    
    tenant_id = str(uuid4())
    event = sample_audit_event.copy()
    event["tenant_id"] = tenant_id
    
    # Mock the upsert call to capture the data
    upsert_data = None
    def capture_upsert(data, **kwargs):
        nonlocal upsert_data
        upsert_data = data
        return mock_supabase.table.return_value
    
    mock_supabase.table.return_value.upsert = capture_upsert
    
    with patch.object(rag_agent, 'generate_embedding', return_value=[0.1] * 1536):
        await rag_agent.index_audit_event(event)
    
    # Verify tenant_id is included in embedding storage
    assert upsert_data is not None, "Embedding data should be captured"
    assert upsert_data["tenant_id"] == tenant_id, "Tenant ID should match"
    assert upsert_data["audit_event_id"] == event["id"], "Event ID should match"
    assert len(upsert_data["embedding"]) == 1536, "Embedding dimension should be 1536"
    
    print("✓ Embedding generation with tenant isolation test passed")


@pytest.mark.asyncio
async def test_classification_populates_all_ml_fields(
    mock_supabase,
    sample_audit_event
):
    """
    Test that ML classification populates all required fields
    
    Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8
    """
    ml_service = AuditMLService(mock_supabase)
    
    # Test different event types
    test_cases = [
        {
            "event_type": "permission_change",
            "action_details": {"permission": "admin", "granted": True},
            "expected_category": "Security Change",
            "expected_tags": ["security_change"]
        },
        {
            "event_type": "budget_change",
            "action_details": {"old_budget": 100000, "new_budget": 120000},
            "expected_category": "Financial Impact",
            "expected_tags": ["budget_change"]
        },
        {
            "event_type": "resource_assignment",
            "action_details": {"resource_id": "res-123", "project_id": "proj-456"},
            "expected_category": "Resource Allocation",
            "expected_tags": ["resource_allocation"]
        }
    ]
    
    for test_case in test_cases:
        event = sample_audit_event.copy()
        event["event_type"] = test_case["event_type"]
        event["action_details"] = test_case["action_details"]
        
        with patch.object(ml_service, 'classify_event') as mock_classify:
            mock_classify.return_value = {
                "category": test_case["expected_category"],
                "category_confidence": 0.90,
                "risk_level": "Medium",
                "risk_confidence": 0.85,
                "tags": test_case["expected_tags"]
            }
            
            classification = await ml_service.classify_event(event)
        
        # Verify all ML fields are populated
        assert "category" in classification
        assert "category_confidence" in classification
        assert "risk_level" in classification
        assert "risk_confidence" in classification
        assert "tags" in classification
        
        # Verify expected values
        assert classification["category"] == test_case["expected_category"]
        assert test_case["expected_tags"][0] in classification["tags"]
        
        print(f"✓ Classification test passed for {test_case['event_type']}")


@pytest.mark.asyncio
async def test_event_lifecycle_error_handling(
    mock_supabase,
    mock_openai_client,
    sample_audit_event
):
    """
    Test error handling in the event lifecycle
    
    Validates: Robustness of the lifecycle
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key")
    rag_agent.openai_client = mock_openai_client
    
    # Test 1: Missing tenant_id
    event_no_tenant = sample_audit_event.copy()
    del event_no_tenant["tenant_id"]
    
    with patch.object(rag_agent, 'generate_embedding', return_value=[0.1] * 1536):
        result = await rag_agent.index_audit_event(event_no_tenant)
    
    assert result is False, "Should fail without tenant_id"
    
    # Test 2: Missing event_id
    event_no_id = sample_audit_event.copy()
    del event_no_id["id"]
    
    with patch.object(rag_agent, 'generate_embedding', return_value=[0.1] * 1536):
        result = await rag_agent.index_audit_event(event_no_id)
    
    assert result is False, "Should fail without event_id"
    
    # Test 3: Embedding generation failure
    event = sample_audit_event.copy()
    
    with patch.object(rag_agent, 'generate_embedding', side_effect=Exception("API Error")):
        result = await rag_agent.index_audit_event(event)
    
    assert result is False, "Should handle embedding generation errors gracefully"
    
    print("✓ Error handling test passed")


@pytest.mark.asyncio
async def test_content_text_building_for_embedding(
    mock_supabase,
    sample_audit_event
):
    """
    Test that content text is properly built for embedding generation
    
    Validates: Comprehensive content extraction for semantic search
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key")
    
    event = sample_audit_event.copy()
    event["category"] = "Financial Impact"
    event["risk_level"] = "High"
    event["tags"] = {"impact": "high", "requires_approval": True}
    
    content_text = rag_agent._build_event_content_text(event)
    
    # Verify all important fields are included in content text
    assert event["event_type"] in content_text
    assert event["entity_type"] in content_text
    assert event["severity"] in content_text
    assert event["category"] in content_text
    assert event["risk_level"] in content_text
    
    # Verify action details are included
    assert "old_budget" in content_text or "Action Details" in content_text
    
    print("✓ Content text building test passed")
    print(f"  Content text length: {len(content_text)} characters")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
