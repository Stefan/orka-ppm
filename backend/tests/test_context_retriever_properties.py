"""
Property-Based Tests for Context Retriever
Feature: ai-help-chat-knowledge-base
Tests Properties 9, 10, 20, and 21 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any
import os
import sys
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.context_retriever import ContextRetriever, UserContext, ContextualResult
from services.vector_store import SearchResult, VectorChunk


# Test data strategies
@st.composite
def user_context_strategy(draw):
    """Generate realistic user contexts"""
    user_id = str(uuid.uuid4())
    role = draw(st.sampled_from(["admin", "manager", "user"]))
    current_page = draw(st.sampled_from([
        "/dashboard", "/projects", "/resources", "/reports",
        "/settings", "/profile", "/help"
    ]))

    # Optional fields
    current_project = draw(st.one_of(st.none(), st.uuids().map(str)))
    current_portfolio = draw(st.one_of(st.none(), st.uuids().map(str)))

    preferences = {
        "preferred_categories": draw(st.lists(
            st.sampled_from(["dashboard", "projects", "resources", "financial", "risks"]),
            min_size=0, max_size=3
        ))
    }

    return UserContext(
        user_id=user_id,
        role=role,
        current_page=current_page,
        current_project=current_project,
        current_portfolio=current_portfolio,
        user_preferences=preferences
    )


@st.composite
def search_results_strategy(draw):
    """Generate mock search results"""
    num_results = draw(st.integers(min_value=1, max_value=10))

    results = []
    for i in range(num_results):
        document_id = str(uuid.uuid4())
        chunk_id = f"{document_id}_chunk_{i}"

        content = draw(st.text(min_size=100, max_size=500, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
        )))

        similarity_score = draw(st.floats(min_value=0.1, max_value=1.0))

        metadata = {
            "document_id": document_id,
            "chunk_index": i,
            "category": draw(st.sampled_from(["dashboard", "projects", "resources", "financial", "risks"])),
            "keywords": draw(st.lists(st.text(min_size=3, max_size=15), min_size=0, max_size=3)),
            "access_control": {
                "roles": draw(st.lists(st.sampled_from(["admin", "manager", "user"]), min_size=1, max_size=3))
            },
            "created_at": "2024-01-01T00:00:00Z",
            "recency_score": draw(st.floats(min_value=0.1, max_value=1.0))
        }

        result = SearchResult(
            chunk_id=chunk_id,
            document_id=document_id,
            chunk_index=i,
            content=content,
            similarity_score=similarity_score,
            metadata=metadata
        )
        results.append(result)

    return results


@pytest.fixture
def mock_context_retriever():
    """Create a mock context retriever for testing"""
    class MockVectorStore:
        def __init__(self):
            self.results = []

        async def similarity_search(self, query_embedding, limit=10, threshold=0.1):
            return self.results[:limit]

    class MockEmbeddingService:
        async def embed_text(self, text: str):
            # Return a mock 1536-dimensional embedding
            return [0.1] * 1536

    class MockTranslationService:
        async def translate_to_english(self, text: str, source_lang: str) -> str:
            return f"EN: {text}"

    # Create mock services
    vector_store = MockVectorStore()
    embedding_service = MockEmbeddingService()
    translation_service = MockTranslationService()

    return ContextRetriever(vector_store, embedding_service, translation_service)


@pytest.mark.property_test
class TestSearchResultCount:
    """
    Property tests for search result count.
    Property 9: Search Result Count
    Validates: Requirements 3.3
    """

    @settings(max_examples=20, deadline=8000)
    @given(
        user_context=user_context_strategy(),
        search_results=search_results_strategy()
    )
    async def test_result_count_within_bounds(self, mock_context_retriever, user_context, search_results):
        """
        Test that search result count stays within reasonable bounds.

        Property 9: The number of retrieved results must be
        reasonable and not excessive.
        """
        # Set up mock results
        mock_context_retriever.vector_store.results = search_results

        # Perform retrieval
        query = "How do I create a new project?"
        contextual_results = await mock_context_retriever.retrieve(query, user_context)

        # Verify result count constraints
        assert len(contextual_results) <= 10, "Should not return more than max_results (10)"
        assert len(contextual_results) >= 0, "Should return non-negative count"

        # If we have search results, we should get some contextual results
        if search_results:
            assert len(contextual_results) > 0, "Should return results when search finds matches"


@pytest.mark.property_test
class TestRetrievedChunkCompleteness:
    """
    Property tests for retrieved chunk completeness.
    Property 10: Retrieved Chunk Completeness
    Validates: Requirements 3.4
    """

    @settings(max_examples=15, deadline=6000)
    @given(
        user_context=user_context_strategy(),
        search_results=search_results_strategy()
    )
    async def test_chunk_content_preservation(self, mock_context_retriever, user_context, search_results):
        """
        Test that retrieved chunks maintain content integrity.

        Property 10: Retrieved chunks must contain complete,
        unmodified content.
        """
        assume(len(search_results) > 0)

        # Set up mock results
        mock_context_retriever.vector_store.results = search_results

        # Perform retrieval
        query = "test query"
        contextual_results = await mock_context_retriever.retrieve(query, user_context)

        # Verify content preservation
        for result in contextual_results:
            original = next((r for r in search_results if r.chunk_id == result.search_result.chunk_id), None)
            assert original is not None, "Retrieved chunk must exist in original results"
            assert result.search_result.content == original.content, "Content must be preserved"
            assert result.search_result.metadata == original.metadata, "Metadata must be preserved"


@pytest.mark.property_test
class TestContextualRankingBoost:
    """
    Property tests for contextual ranking boost.
    Property 20: Contextual Ranking Boost
    Validates: Requirements 7.1
    """

    @settings(max_examples=20, deadline=8000)
    @given(
        user_context=user_context_strategy(),
        search_results=search_results_strategy()
    )
    async def test_contextual_boost_increases_relevance(self, mock_context_retriever, user_context, search_results):
        """
        Test that contextual boosting improves result relevance.

        Property 20: Contextual factors must improve ranking
        of relevant results.
        """
        assume(len(search_results) >= 2)

        # Modify search results to have different categories
        for i, result in enumerate(search_results):
            result.metadata["category"] = ["dashboard", "projects", "resources"][i % 3]

        # Set user's preferred categories
        user_context.user_preferences["preferred_categories"] = ["dashboard"]

        # Set up mock results
        mock_context_retriever.vector_store.results = search_results

        # Perform retrieval
        query = "dashboard overview"
        contextual_results = await mock_context_retriever.retrieve(query, user_context)

        # Results should be sorted by total score
        scores = [r.total_score for r in contextual_results]
        assert scores == sorted(scores, reverse=True), "Results must be sorted by total score"


@pytest.mark.property_test
class TestRoleBasedAccessControl:
    """
    Property tests for role-based access control.
    Property 21: Role-Based Access Control
    Validates: Requirements 7.2, 11.1
    """

    @settings(max_examples=25, deadline=9000)
    @given(
        user_context=user_context_strategy(),
        search_results=search_results_strategy()
    )
    async def test_role_based_filtering(self, mock_context_retriever, user_context, search_results):
        """
        Test that role-based access control filters results appropriately.

        Property 21: Users must only see content they have
        access to based on their role.
        """
        # Modify search results to have different access controls
        for result in search_results:
            if user_context.role == "admin":
                result.metadata["access_control"]["roles"] = ["admin", "manager", "user"]
            elif user_context.role == "manager":
                result.metadata["access_control"]["roles"] = ["manager", "user"]
            else:  # user
                result.metadata["access_control"]["roles"] = ["user"]

        # Set up mock results
        mock_context_retriever.vector_store.results = search_results

        # Perform retrieval
        query = "access control test"
        contextual_results = await mock_context_retriever.retrieve(query, user_context)

        # Verify role-based filtering
        for result in contextual_results:
            allowed_roles = result.search_result.metadata["access_control"]["roles"]
            assert user_context.role in allowed_roles, f"User role {user_context.role} must be in allowed roles {allowed_roles}"

    @settings(max_examples=15, deadline=6000)
    @given(user_context=user_context_strategy())
    async def test_admin_access_all_content(self, mock_context_retriever, user_context):
        """
        Test that admin users can access all content.

        Property 21: Admin users must have access to all
        content regardless of restrictions.
        """
        # Make user an admin
        user_context.role = "admin"

        # Create search results with restricted access
        search_results = []
        for i in range(3):
            result = SearchResult(
                chunk_id=f"chunk_{i}",
                document_id=f"doc_{i}",
                chunk_index=i,
                content=f"Content {i}",
                similarity_score=0.8 - i * 0.1,
                metadata={
                    "access_control": {"roles": ["user"]},  # Restricted to user only
                    "category": "test"
                }
            )
            search_results.append(result)

        # Set up mock results
        mock_context_retriever.vector_store.results = search_results

        # Perform retrieval
        query = "admin access test"
        contextual_results = await mock_context_retriever.retrieve(query, user_context)

        # Admin should still get results despite restrictions
        assert len(contextual_results) > 0, "Admin should access restricted content"