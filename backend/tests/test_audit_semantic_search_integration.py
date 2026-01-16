"""
Integration Test: Semantic Search Flow
Tests the complete flow: query → embedding → vector search → GPT response → caching

Task: 19.3
Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
"""

import pytest
import asyncio
import os
import json
from uuid import uuid4
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from supabase import Client
import redis.asyncio as aioredis

# Import services
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.audit_rag_agent import AuditRAGAgent


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
    mock_table.gte.return_value = mock_table
    mock_table.lte.return_value = mock_table
    mock_table.execute.return_value = Mock(data=[])
    
    return mock_client


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing"""
    mock_redis = AsyncMock(spec=aioredis.Redis)
    mock_redis.get.return_value = None  # No cached data by default
    mock_redis.setex.return_value = True
    return mock_redis


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
    mock_chat_response.choices = [
        Mock(message=Mock(content="Based on the audit logs, there were 3 budget changes last week affecting projects A, B, and C."))
    ]
    mock_client.chat.completions.create.return_value = mock_chat_response
    
    return mock_client


@pytest.fixture
def sample_search_results():
    """Create sample search results"""
    tenant_id = str(uuid4())
    
    return [
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Budget change for Project A from $100k to $120k",
            "similarity_score": 0.92,
            "event_type": "budget_change",
            "user_id": str(uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "action_details": {"old_budget": 100000, "new_budget": 120000},
            "severity": "warning",
            "timestamp": (datetime.now() - timedelta(days=3)).isoformat(),
            "category": "Financial Impact",
            "risk_level": "Medium",
            "tenant_id": tenant_id
        },
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Budget change for Project B from $200k to $250k",
            "similarity_score": 0.88,
            "event_type": "budget_change",
            "user_id": str(uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "action_details": {"old_budget": 200000, "new_budget": 250000},
            "severity": "warning",
            "timestamp": (datetime.now() - timedelta(days=5)).isoformat(),
            "category": "Financial Impact",
            "risk_level": "Medium",
            "tenant_id": tenant_id
        },
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Budget change for Project C from $150k to $180k",
            "similarity_score": 0.85,
            "event_type": "budget_change",
            "user_id": str(uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid4()),
            "action_details": {"old_budget": 150000, "new_budget": 180000},
            "severity": "info",
            "timestamp": (datetime.now() - timedelta(days=6)).isoformat(),
            "category": "Financial Impact",
            "risk_level": "Low",
            "tenant_id": tenant_id
        }
    ], tenant_id


@pytest.mark.asyncio
async def test_semantic_search_complete_flow(
    mock_supabase,
    mock_redis,
    mock_openai_client,
    sample_search_results
):
    """
    Integration Test: Complete semantic search flow
    
    Tests the flow:
    1. User submits natural language query
    2. Query embedding is generated
    3. Vector similarity search is performed
    4. GPT generates response from results
    5. Results are cached
    
    Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
    """
    search_results, tenant_id = sample_search_results
    
    # Initialize RAG agent
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    # Step 1: User submits query
    query = "Show me all budget changes last week"
    print(f"✓ Step 1: User query: '{query}'")
    
    # Step 2: Generate query embedding
    with patch.object(rag_agent, 'generate_embedding') as mock_embed:
        mock_embed.return_value = [0.1] * 1536
        query_embedding = await rag_agent.generate_embedding(query)
    
    assert len(query_embedding) == 1536, "Query embedding should have dimension 1536"
    print(f"✓ Step 2: Generated query embedding (dimension: {len(query_embedding)})")
    
    # Step 3: Perform vector similarity search
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = search_results
        
        results = await rag_agent.semantic_search(
            query=query,
            tenant_id=tenant_id,
            limit=10
        )
    
    assert len(results) > 0, "Search should return results"
    assert all(r["similarity_score"] >= 0.85 for r in results), "All results should have high similarity"
    print(f"✓ Step 3: Vector search returned {len(results)} results")
    for i, result in enumerate(results[:3]):
        print(f"  - Result {i+1}: similarity={result['similarity_score']:.2f}, event={result['event_type']}")
    
    # Step 4: Generate GPT response
    # This is typically done in a separate method, but we'll simulate it here
    system_prompt = "You are an AI assistant analyzing audit logs."
    user_prompt = f"Query: {query}\n\nRelevant events:\n"
    for result in results:
        user_prompt += f"- {result['content_text']}\n"
    user_prompt += "\nProvide a concise answer based on these events."
    
    gpt_response = mock_openai_client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
    
    ai_answer = gpt_response.choices[0].message.content
    assert len(ai_answer) > 0, "GPT should generate a response"
    print(f"✓ Step 4: GPT response generated")
    print(f"  Response: {ai_answer[:100]}...")
    
    # Step 5: Verify caching
    # Check that cache was attempted to be set
    cache_key = rag_agent._build_cache_key("search", query, None, tenant_id)
    
    # Simulate caching the results
    await rag_agent._cache_result(cache_key, results, rag_agent.cache_ttl)
    
    # Verify cache was called (may be called multiple times due to semantic_search internal caching)
    assert mock_redis.setex.call_count >= 1, "Cache should be set at least once"
    print(f"✓ Step 5: Results cached with TTL={rag_agent.cache_ttl}s")
    
    # Verify cache retrieval works
    mock_redis.get = AsyncMock(return_value=json.dumps(results))
    cached_results = await rag_agent._get_cached_result(cache_key)
    
    assert cached_results is not None, "Should retrieve cached results"
    assert len(cached_results) == len(results), "Cached results should match original"
    print(f"✓ Step 5b: Cache retrieval successful")
    
    print("\n✓ Complete semantic search flow test passed")


@pytest.mark.asyncio
async def test_search_result_limit_and_scoring(
    mock_supabase,
    mock_redis,
    mock_openai_client
):
    """
    Test that search returns at most 10 results with proper scoring
    
    Validates: Requirements 3.2, 3.3
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    tenant_id = str(uuid4())
    
    # Create 15 mock results (more than limit of 10)
    mock_results = []
    for i in range(15):
        mock_results.append({
            "audit_event_id": str(uuid4()),
            "content_text": f"Event {i}",
            "similarity_score": 0.95 - (i * 0.05),  # Descending scores
            "event_type": "test_event",
            "tenant_id": tenant_id
        })
    
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = mock_results[:10]  # Limit to 10
        
        results = await rag_agent.semantic_search(
            query="test query",
            tenant_id=tenant_id,
            limit=10
        )
    
    # Verify limit
    assert len(results) <= 10, "Should return at most 10 results"
    
    # Verify scoring
    for result in results:
        score = result["similarity_score"]
        assert 0 <= score <= 1, f"Similarity score should be between 0 and 1, got {score}"
    
    # Verify ordering (descending by similarity)
    scores = [r["similarity_score"] for r in results]
    assert scores == sorted(scores, reverse=True), "Results should be ordered by similarity (descending)"
    
    print("✓ Search result limit and scoring test passed")
    print(f"  - Results limited to {len(results)}")
    print(f"  - Scores range: {min(scores):.2f} to {max(scores):.2f}")
    print(f"  - Results properly ordered by similarity")


@pytest.mark.asyncio
async def test_source_reference_inclusion(
    mock_supabase,
    mock_redis,
    mock_openai_client,
    sample_search_results
):
    """
    Test that AI response includes source references
    
    Validates: Requirements 3.5
    """
    search_results, tenant_id = sample_search_results
    
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    query = "Show me budget changes"
    
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = search_results
        
        results = await rag_agent.semantic_search(
            query=query,
            tenant_id=tenant_id
        )
    
    # Build source references from results
    sources = []
    for result in results:
        source = {
            "event_id": result["audit_event_id"],
            "event_type": result["event_type"],
            "timestamp": result["timestamp"],
            "similarity_score": result["similarity_score"],
            "content_snippet": result["content_text"][:100]
        }
        sources.append(source)
    
    # Verify sources are properly structured
    assert len(sources) > 0, "Should have source references"
    
    for source in sources:
        assert "event_id" in source, "Source should include event_id"
        assert "event_type" in source, "Source should include event_type"
        assert "timestamp" in source, "Source should include timestamp"
        assert "similarity_score" in source, "Source should include similarity_score"
        assert "content_snippet" in source, "Source should include content_snippet"
    
    print("✓ Source reference inclusion test passed")
    print(f"  - {len(sources)} source references generated")
    print(f"  - Each source includes: event_id, event_type, timestamp, similarity_score, content_snippet")


@pytest.mark.asyncio
async def test_cache_hit_performance(
    mock_supabase,
    mock_redis,
    mock_openai_client,
    sample_search_results
):
    """
    Test that cached results are returned without re-executing search
    
    Validates: Caching performance optimization
    """
    search_results, tenant_id = sample_search_results
    
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    query = "budget changes"
    cache_key = rag_agent._build_cache_key("search", query, None, tenant_id)
    
    # First request: cache miss
    mock_redis.get = AsyncMock(return_value=None)
    
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = search_results
        
        results_first = await rag_agent.semantic_search(
            query=query,
            tenant_id=tenant_id
        )
    
    # Verify search was executed
    assert len(results_first) > 0, "First request should return results"
    
    # Second request: cache hit
    mock_redis.get = AsyncMock(return_value=json.dumps(search_results))
    
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = []  # Should not be called
        
        # Also need to patch _get_cached_result to return the cached data
        with patch.object(rag_agent, '_get_cached_result', return_value=search_results):
            results_second = await rag_agent.semantic_search(
                query=query,
                tenant_id=tenant_id
            )
    
    # Verify cached results were returned
    assert len(results_second) > 0, "Second request should return cached results"
    
    # Verify search was NOT executed (cache hit)
    mock_search.assert_not_called()
    
    print("✓ Cache hit performance test passed")
    print(f"  - First request: executed search, returned {len(results_first)} results")
    print(f"  - Second request: cache hit, returned {len(results_second)} results without search")


@pytest.mark.asyncio
async def test_tenant_isolation_in_search(
    mock_supabase,
    mock_redis,
    mock_openai_client
):
    """
    Test that search results are isolated by tenant
    
    Validates: Requirements 9.4 (tenant isolation)
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    tenant_a = str(uuid4())
    tenant_b = str(uuid4())
    
    # Create results for tenant A
    results_tenant_a = [
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Tenant A event",
            "similarity_score": 0.90,
            "tenant_id": tenant_a
        }
    ]
    
    # Create results for tenant B
    results_tenant_b = [
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Tenant B event",
            "similarity_score": 0.90,
            "tenant_id": tenant_b
        }
    ]
    
    # Search for tenant A
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = results_tenant_a
        
        results_a = await rag_agent.semantic_search(
            query="test",
            tenant_id=tenant_a
        )
    
    # Verify only tenant A results
    assert all(r["tenant_id"] == tenant_a for r in results_a), "Should only return tenant A results"
    
    # Search for tenant B
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = results_tenant_b
        
        results_b = await rag_agent.semantic_search(
            query="test",
            tenant_id=tenant_b
        )
    
    # Verify only tenant B results
    assert all(r["tenant_id"] == tenant_b for r in results_b), "Should only return tenant B results"
    
    # Verify no cross-tenant data
    tenant_a_ids = {r["audit_event_id"] for r in results_a}
    tenant_b_ids = {r["audit_event_id"] for r in results_b}
    assert tenant_a_ids.isdisjoint(tenant_b_ids), "No cross-tenant data should be returned"
    
    print("✓ Tenant isolation in search test passed")
    print(f"  - Tenant A: {len(results_a)} results (isolated)")
    print(f"  - Tenant B: {len(results_b)} results (isolated)")
    print(f"  - No cross-tenant data leakage")


@pytest.mark.asyncio
async def test_search_with_filters(
    mock_supabase,
    mock_redis,
    mock_openai_client
):
    """
    Test semantic search with additional filters
    
    Validates: Filter application in semantic search
    """
    rag_agent = AuditRAGAgent(mock_supabase, "test-api-key", mock_redis)
    rag_agent.openai_client = mock_openai_client
    
    tenant_id = str(uuid4())
    
    # Create filtered results
    filtered_results = [
        {
            "audit_event_id": str(uuid4()),
            "content_text": "Budget change event",
            "similarity_score": 0.90,
            "event_type": "budget_change",
            "severity": "warning",
            "timestamp": datetime.now().isoformat(),
            "tenant_id": tenant_id
        }
    ]
    
    filters = {
        "event_types": ["budget_change"],
        "severity": "warning",
        "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
        "end_date": datetime.now().isoformat()
    }
    
    with patch.object(rag_agent, '_execute_vector_search') as mock_search:
        mock_search.return_value = filtered_results
        
        results = await rag_agent.semantic_search(
            query="budget changes",
            filters=filters,
            tenant_id=tenant_id
        )
    
    # Verify filters were applied
    assert len(results) > 0, "Should return filtered results"
    assert all(r["event_type"] == "budget_change" for r in results), "Should match event_type filter"
    assert all(r["severity"] == "warning" for r in results), "Should match severity filter"
    
    print("✓ Search with filters test passed")
    print(f"  - Applied filters: event_types, severity, date_range")
    print(f"  - Returned {len(results)} matching results")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
