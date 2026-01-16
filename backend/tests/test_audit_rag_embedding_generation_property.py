"""
Property-Based Tests for Audit RAG Agent Embedding Generation
Tests Properties 5 and 31 from the design document
"""

import pytest
import uuid
from datetime import datetime
from hypothesis import given, strategies as st, settings
from hypothesis import HealthCheck
import sys
import os

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from services.audit_rag_agent import AuditRAGAgent
from unittest.mock import Mock, AsyncMock, patch


# ============================================================================
# Test Data Generators
# ============================================================================

@st.composite
def audit_event_strategy(draw):
    """Generate valid audit events for testing"""
    return {
        "id": str(uuid.uuid4()),
        "event_type": draw(st.sampled_from([
            "user_login", "budget_change", "permission_change",
            "resource_assignment", "risk_created", "report_generated"
        ])),
        "user_id": str(uuid.uuid4()),
        "entity_type": draw(st.sampled_from(["project", "resource", "risk", "change_request"])),
        "entity_id": str(uuid.uuid4()),
        "action_details": draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("Lu", "Ll"))),
            values=st.one_of(st.text(max_size=50), st.integers(), st.floats(allow_nan=False, allow_infinity=False))
        )),
        "severity": draw(st.sampled_from(["info", "warning", "error", "critical"])),
        "timestamp": datetime.now().isoformat(),
        "category": draw(st.sampled_from([
            "Security Change", "Financial Impact", "Resource Allocation",
            "Risk Event", "Compliance Action"
        ])),
        "risk_level": draw(st.sampled_from(["Low", "Medium", "High", "Critical"])),
        "tenant_id": str(uuid.uuid4()),
        "tags": draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=("Lu", "Ll"))),
            values=st.text(max_size=20)
        ))
    }


# ============================================================================
# Property 5: Embedding Generation for Events
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 5: Embedding Generation for Events
@given(event=audit_event_strategy())
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_5_embedding_generation_for_events(event):
    """
    Property 5: Embedding Generation for Events
    
    For any audit event created in the system, an embedding should be generated 
    and stored in the audit_embeddings table with the same audit_event_id, 
    and the embedding vector should have dimension 1536 (OpenAI ada-002 dimension).
    
    Validates: Requirements 3.1, 3.10
    """
    # Mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_upsert = Mock()
    mock_execute = Mock()
    
    # Track what was stored
    stored_data = {}
    
    def capture_upsert(data, on_conflict=None):
        stored_data.update(data)
        return mock_execute
    
    mock_upsert.side_effect = capture_upsert
    mock_table.upsert = mock_upsert
    mock_supabase.table.return_value = mock_table
    
    # Mock OpenAI client to return valid embedding
    mock_openai = Mock()
    mock_embeddings = Mock()
    mock_create = Mock()
    
    # Generate a valid 1536-dimension embedding
    valid_embedding = [0.1] * 1536
    
    mock_response = Mock()
    mock_response.data = [Mock(embedding=valid_embedding)]
    mock_create.return_value = mock_response
    mock_embeddings.create = mock_create
    mock_openai.embeddings = mock_embeddings
    
    # Create agent with mocked clients
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Index the audit event
    result = await agent.index_audit_event(event)
    
    # Verify embedding was generated and stored
    assert result is True, "index_audit_event should return True on success"
    
    # Verify the stored data
    assert "audit_event_id" in stored_data, "audit_event_id should be stored"
    assert stored_data["audit_event_id"] == event["id"], "audit_event_id should match event id"
    
    assert "embedding" in stored_data, "embedding should be stored"
    assert len(stored_data["embedding"]) == 1536, "embedding should have dimension 1536"
    
    assert "tenant_id" in stored_data, "tenant_id should be stored"
    assert stored_data["tenant_id"] == event["tenant_id"], "tenant_id should match event tenant_id"
    
    assert "content_text" in stored_data, "content_text should be stored"
    assert len(stored_data["content_text"]) > 0, "content_text should not be empty"


# ============================================================================
# Property 31: Embedding Namespace Isolation
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 31: Embedding Namespace Isolation
@given(
    event1=audit_event_strategy(),
    event2=audit_event_strategy()
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_31_embedding_namespace_isolation(event1, event2):
    """
    Property 31: Embedding Namespace Isolation
    
    For any embedding generated for an audit event, the embedding should be stored 
    with the same tenant_id as the audit event, ensuring tenant isolation in semantic search.
    
    Validates: Requirements 9.4
    """
    # Ensure events have different tenant IDs
    event1["tenant_id"] = str(uuid.uuid4())
    event2["tenant_id"] = str(uuid.uuid4())
    
    # Mock Supabase client
    mock_supabase = Mock()
    stored_embeddings = []
    
    def mock_table(table_name):
        mock_tbl = Mock()
        
        def mock_upsert(data, on_conflict=None):
            stored_embeddings.append(data.copy())
            mock_exec = Mock()
            mock_exec.execute = Mock()
            return mock_exec
        
        mock_tbl.upsert = mock_upsert
        return mock_tbl
    
    mock_supabase.table = mock_table
    
    # Mock OpenAI client
    mock_openai = Mock()
    mock_embeddings = Mock()
    
    valid_embedding = [0.1] * 1536
    mock_response = Mock()
    mock_response.data = [Mock(embedding=valid_embedding)]
    
    mock_embeddings.create = Mock(return_value=mock_response)
    mock_openai.embeddings = mock_embeddings
    
    # Create agent
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Index both events
    result1 = await agent.index_audit_event(event1)
    result2 = await agent.index_audit_event(event2)
    
    assert result1 is True, "First event should be indexed successfully"
    assert result2 is True, "Second event should be indexed successfully"
    
    # Verify tenant isolation
    assert len(stored_embeddings) == 2, "Two embeddings should be stored"
    
    # Verify first embedding has correct tenant_id
    embedding1 = stored_embeddings[0]
    assert embedding1["tenant_id"] == event1["tenant_id"], \
        "First embedding should have same tenant_id as first event"
    assert embedding1["audit_event_id"] == event1["id"], \
        "First embedding should reference first event"
    
    # Verify second embedding has correct tenant_id
    embedding2 = stored_embeddings[1]
    assert embedding2["tenant_id"] == event2["tenant_id"], \
        "Second embedding should have same tenant_id as second event"
    assert embedding2["audit_event_id"] == event2["id"], \
        "Second embedding should reference second event"
    
    # Verify tenant IDs are different (isolation)
    assert embedding1["tenant_id"] != embedding2["tenant_id"], \
        "Embeddings should have different tenant_ids for isolation"


# ============================================================================
# Edge Case Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.property_test
async def test_embedding_generation_missing_event_id():
    """Test that embedding generation fails gracefully without event ID"""
    mock_supabase = Mock()
    mock_openai = Mock()
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Event without ID
    event = {
        "event_type": "test",
        "tenant_id": str(uuid.uuid4())
    }
    
    result = await agent.index_audit_event(event)
    assert result is False, "Should return False when event ID is missing"


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_embedding_generation_missing_tenant_id():
    """Test that embedding generation fails gracefully without tenant ID"""
    mock_supabase = Mock()
    mock_openai = Mock()
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Event without tenant_id
    event = {
        "id": str(uuid.uuid4()),
        "event_type": "test"
    }
    
    result = await agent.index_audit_event(event)
    assert result is False, "Should return False when tenant_id is missing"


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_embedding_dimension_validation():
    """Test that embedding dimension is validated"""
    mock_supabase = Mock()
    mock_table = Mock()
    mock_upsert = Mock()
    mock_execute = Mock()
    
    mock_upsert.return_value = mock_execute
    mock_table.upsert = mock_upsert
    mock_supabase.table.return_value = mock_table
    
    # Mock OpenAI to return wrong dimension
    mock_openai = Mock()
    mock_embeddings = Mock()
    
    # Wrong dimension (should be 1536)
    wrong_embedding = [0.1] * 512
    mock_response = Mock()
    mock_response.data = [Mock(embedding=wrong_embedding)]
    
    mock_embeddings.create = Mock(return_value=mock_response)
    mock_openai.embeddings = mock_embeddings
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    event = {
        "id": str(uuid.uuid4()),
        "event_type": "test",
        "tenant_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "entity_type": "project",
        "severity": "info",
        "timestamp": datetime.now().isoformat()
    }
    
    result = await agent.index_audit_event(event)
    assert result is False, "Should return False when embedding dimension is wrong"
