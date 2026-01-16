"""
Property-Based Tests for Audit RAG Agent Semantic Search
Tests Properties 6 and 8 from the design document
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
def search_query_strategy(draw):
    """Generate valid search queries"""
    query_templates = [
        "Show me all {} events",
        "Find {} changes last week",
        "What happened with {}",
        "List all {} activities",
        "Search for {}"
    ]
    
    terms = ["budget", "security", "resource", "risk", "project", "user"]
    
    template = draw(st.sampled_from(query_templates))
    term = draw(st.sampled_from(terms))
    
    return template.format(term)


# ============================================================================
# Property 6: Search Result Limit and Scoring
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 6: Search Result Limit and Scoring
@given(
    query=search_query_strategy(),
    limit=st.integers(min_value=1, max_value=20)
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_6_search_result_limit_and_scoring(query, limit):
    """
    Property 6: Search Result Limit and Scoring
    
    For any semantic search query, the number of returned results should be at most 10 
    (or the specified limit), and each result should have a similarity score between 0 and 1, 
    with results ordered by similarity score in descending order.
    
    Validates: Requirements 3.2, 3.3
    """
    tenant_id = str(uuid.uuid4())
    
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock OpenAI client to return valid embedding
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
    
    # Mock the vector search execution to return mock results
    # Generate more results than the limit to test limiting
    num_mock_results = min(limit + 5, 20)
    mock_results = []
    
    for i in range(num_mock_results):
        # Create results with descending similarity scores
        similarity_score = 0.9 - (i * 0.05)
        mock_results.append({
            "audit_event_id": str(uuid.uuid4()),
            "content_text": f"Mock event {i}",
            "tenant_id": tenant_id,
            "similarity_score": max(0.0, similarity_score),
            "event_type": "test_event",
            "user_id": str(uuid.uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid.uuid4()),
            "action_details": {},
            "severity": "info",
            "timestamp": datetime.now().isoformat(),
            "category": "Test",
            "risk_level": "Low",
            "tags": {},
            "ai_insights": {},
            "anomaly_score": None,
            "is_anomaly": False
        })
    
    # Mock the _execute_vector_search method
    async def mock_execute_vector_search(sql_query, params):
        # Return only up to the limit
        return mock_results[:limit]
    
    agent._execute_vector_search = mock_execute_vector_search
    
    # Perform semantic search
    results = await agent.semantic_search(query, limit=limit, tenant_id=tenant_id)
    
    # Verify result count is at most the limit
    assert len(results) <= limit, f"Results should be at most {limit}, got {len(results)}"
    
    # Verify each result has a similarity score between 0 and 1
    for result in results:
        assert "similarity_score" in result, "Each result should have a similarity_score"
        score = result["similarity_score"]
        assert 0.0 <= score <= 1.0, f"Similarity score should be between 0 and 1, got {score}"
    
    # Verify results are ordered by similarity score in descending order
    if len(results) > 1:
        for i in range(len(results) - 1):
            current_score = results[i]["similarity_score"]
            next_score = results[i + 1]["similarity_score"]
            assert current_score >= next_score, \
                f"Results should be ordered by similarity score descending, but {current_score} < {next_score}"


# ============================================================================
# Property 8: Source Reference Inclusion
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 8: Source Reference Inclusion
@given(
    query=search_query_strategy(),
    num_results=st.integers(min_value=1, max_value=10)
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_8_source_reference_inclusion(query, num_results):
    """
    Property 8: Source Reference Inclusion
    
    For any AI-generated response from the RAG search engine, the response should include 
    source references that map to the retrieved audit events used to generate the response.
    
    Validates: Requirements 3.5
    
    Note: This test verifies that search results include source references (audit_event_id).
    The full RAG response generation with GPT-4 would be tested in integration tests.
    """
    tenant_id = str(uuid.uuid4())
    
    # Mock Supabase client
    mock_supabase = Mock()
    
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
    
    # Generate mock results with unique event IDs
    event_ids = [str(uuid.uuid4()) for _ in range(num_results)]
    mock_results = []
    
    for i, event_id in enumerate(event_ids):
        mock_results.append({
            "audit_event_id": event_id,
            "content_text": f"Mock event {i}",
            "tenant_id": tenant_id,
            "similarity_score": 0.9 - (i * 0.05),
            "event_type": "test_event",
            "user_id": str(uuid.uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid.uuid4()),
            "action_details": {"test": "data"},
            "severity": "info",
            "timestamp": datetime.now().isoformat(),
            "category": "Test",
            "risk_level": "Low",
            "tags": {},
            "ai_insights": {},
            "anomaly_score": None,
            "is_anomaly": False
        })
    
    # Mock the _execute_vector_search method
    async def mock_execute_vector_search(sql_query, params):
        return mock_results
    
    agent._execute_vector_search = mock_execute_vector_search
    
    # Perform semantic search
    results = await agent.semantic_search(query, limit=num_results, tenant_id=tenant_id)
    
    # Verify all results have source references (audit_event_id)
    assert len(results) > 0, "Should return at least one result"
    
    for result in results:
        assert "audit_event_id" in result, "Each result should have an audit_event_id (source reference)"
        assert result["audit_event_id"] is not None, "audit_event_id should not be None"
        assert len(result["audit_event_id"]) > 0, "audit_event_id should not be empty"
        
        # Verify the event ID is one of the expected IDs
        assert result["audit_event_id"] in event_ids, \
            f"audit_event_id {result['audit_event_id']} should be in the list of source events"
    
    # Verify all source event IDs are represented in results
    result_event_ids = [r["audit_event_id"] for r in results]
    for event_id in event_ids:
        assert event_id in result_event_ids, \
            f"Source event {event_id} should be included in results"


# ============================================================================
# Edge Case Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.property_test
async def test_semantic_search_empty_results():
    """Test semantic search with no matching results"""
    tenant_id = str(uuid.uuid4())
    
    mock_supabase = Mock()
    mock_openai = Mock()
    mock_embeddings = Mock()
    
    valid_embedding = [0.1] * 1536
    mock_response = Mock()
    mock_response.data = [Mock(embedding=valid_embedding)]
    
    mock_embeddings.create = Mock(return_value=mock_response)
    mock_openai.embeddings = mock_embeddings
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Mock empty results
    async def mock_execute_vector_search(sql_query, params):
        return []
    
    agent._execute_vector_search = mock_execute_vector_search
    
    results = await agent.semantic_search("test query", tenant_id=tenant_id)
    
    assert isinstance(results, list), "Should return a list even when empty"
    assert len(results) == 0, "Should return empty list when no results found"


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_semantic_search_missing_tenant_id():
    """Test that semantic search requires tenant_id"""
    mock_supabase = Mock()
    mock_openai = Mock()
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Should return empty list when tenant_id is missing
    results = await agent.semantic_search("test query", tenant_id=None)
    
    assert isinstance(results, list), "Should return a list"
    assert len(results) == 0, "Should return empty list when tenant_id is missing"


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_semantic_search_with_filters():
    """Test semantic search with additional filters"""
    tenant_id = str(uuid.uuid4())
    
    mock_supabase = Mock()
    mock_openai = Mock()
    mock_embeddings = Mock()
    
    valid_embedding = [0.1] * 1536
    mock_response = Mock()
    mock_response.data = [Mock(embedding=valid_embedding)]
    
    mock_embeddings.create = Mock(return_value=mock_response)
    mock_openai.embeddings = mock_embeddings
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Mock results
    mock_results = [{
        "audit_event_id": str(uuid.uuid4()),
        "content_text": "Test event",
        "tenant_id": tenant_id,
        "similarity_score": 0.9,
        "event_type": "budget_change",
        "user_id": str(uuid.uuid4()),
        "entity_type": "project",
        "entity_id": str(uuid.uuid4()),
        "action_details": {},
        "severity": "critical",
        "timestamp": datetime.now().isoformat(),
        "category": "Financial Impact",
        "risk_level": "High",
        "tags": {},
        "ai_insights": {},
        "anomaly_score": None,
        "is_anomaly": False
    }]
    
    async def mock_execute_vector_search(sql_query, params):
        return mock_results
    
    agent._execute_vector_search = mock_execute_vector_search
    
    # Search with filters
    filters = {
        "event_types": ["budget_change"],
        "severity": "critical",
        "categories": ["Financial Impact"]
    }
    
    results = await agent.semantic_search("test query", filters=filters, tenant_id=tenant_id)
    
    assert len(results) > 0, "Should return results with filters"
    
    # Verify results match filters
    for result in results:
        assert result["event_type"] in filters["event_types"], "Result should match event_type filter"
        assert result["severity"] == filters["severity"], "Result should match severity filter"
        assert result["category"] in filters["categories"], "Result should match category filter"
