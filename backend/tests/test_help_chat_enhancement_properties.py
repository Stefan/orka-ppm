"""
Property-based tests for AI Help Chat Enhancement (Phase 1).
Validates: HelpLogger (Properties 7, 8, 9), HelpDocumentationRAG (Properties 4, 5, 6, org filtering).
"""

import pytest
import sys
from pathlib import Path
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import MagicMock, patch

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.help_logger import HelpLogger
from services.help_documentation_rag import (
    HelpDocumentationRAG,
    TOP_K,
    SIMILARITY_THRESHOLD,
    CONTENT_TYPE_HELP_DOC,
)


def _make_mock_supabase():
    """Create a fresh mock Supabase client (no fixture for use with @given)."""
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.select.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[], count=0)
    return client


# --- HelpLogger property tests (Tasks 3.2, 3.3, 3.4) ---

@pytest.mark.unit
@pytest.mark.property
class TestHelpLoggerPropertyQueryLogging:
    """Property 7: Help Query Logging Completeness."""

    @given(
        user_id=st.uuids().map(str),
        organization_id=st.one_of(st.none(), st.uuids().map(str)),
        query=st.text(min_size=1, max_size=500),
        user_role=st.one_of(st.none(), st.sampled_from(["user", "admin", "viewer"])),
    )
    @settings(max_examples=15, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_log_query_returns_uuid_and_calls_insert(self, user_id, organization_id, query, user_role):
        mock_supabase = _make_mock_supabase()
        logger = HelpLogger(supabase_client=mock_supabase)
        query_id = logger.log_query(
            user_id=user_id,
            organization_id=organization_id,
            query=query,
            page_context={"route": "/test"},
            user_role=user_role,
        )
        assert query_id is not None
        assert len(query_id) == 36
        table = mock_supabase.table.return_value
        table.insert.assert_called_once()
        payload = table.insert.call_args[0][0]
        assert payload["user_id"] == user_id
        assert payload["organization_id"] == organization_id
        assert payload["query"] == query
        assert payload["user_role"] == user_role
        assert "route" in (payload.get("page_context") or {})


@pytest.mark.unit
@pytest.mark.property
class TestHelpLoggerPropertyResponseLogging:
    """Property 8: Help Response Logging Completeness."""

    @given(
        confidence=st.floats(min_value=0.0, max_value=1.0),
        response_time_ms=st.integers(min_value=0, max_value=30000),
        success=st.booleans(),
    )
    @settings(max_examples=10, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_log_response_updates_with_all_fields(self, confidence, response_time_ms, success):
        mock_supabase = _make_mock_supabase()
        logger = HelpLogger(supabase_client=mock_supabase)
        logger.log_response(
            query_id="q-1",
            response="Test response",
            confidence_score=confidence,
            sources_used=[{"id": "doc1"}],
            response_time_ms=response_time_ms,
            success=success,
        )
        table = mock_supabase.table.return_value
        table.update.assert_called_once()
        payload = table.update.call_args[0][0]
        assert payload["response"] == "Test response"
        assert 0 <= payload["confidence_score"] <= 1
        assert payload["response_time_ms"] == response_time_ms
        assert payload["success"] is success


@pytest.mark.unit
@pytest.mark.property
class TestHelpLoggerPropertyFeedbackLogging:
    """Property 9: Feedback Logging Completeness."""

    @given(
        rating=st.integers(min_value=1, max_value=5),
        comments=st.one_of(st.none(), st.text(max_size=500)),
    )
    @settings(max_examples=10, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_log_feedback_clamps_rating_and_stores_comments(self, rating, comments):
        mock_supabase = _make_mock_supabase()
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[], count=0)
        logger = HelpLogger(supabase_client=mock_supabase)
        feedback_id = logger.log_feedback(
            query_id="q-1",
            user_id="u-1",
            organization_id="org-1",
            rating=rating,
            comments=comments,
        )
        assert feedback_id is not None
        table = mock_supabase.table.return_value
        table.insert.assert_called_once()
        payload = table.insert.call_args[0][0]
        assert 1 <= payload["rating"] <= 5
        assert payload["comments"] == (comments or "")


# --- HelpDocumentationRAG property tests (Tasks 4.2, 4.3, 4.4, 4.5) ---

@pytest.mark.unit
@pytest.mark.property
class TestHelpDocumentationRAGPropertyIndexing:
    """Property 5: RAG Documentation Indexing."""

    @given(
        content_id=st.uuids().map(str),
        content_text=st.text(min_size=1, max_size=1000),
        organization_id=st.one_of(st.none(), st.uuids().map(str)),
    )
    @settings(max_examples=8, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_index_documentation_upserts_with_help_doc_type(self, content_id, content_text, organization_id):
        mock_supabase = _make_mock_supabase()
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.1] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            record_id = rag.index_documentation(
                content_id=content_id,
                content_text=content_text,
                organization_id=organization_id,
            )
            assert record_id is not None
            table = mock_supabase.table.return_value
            table.upsert.assert_called_once()
            payload = table.upsert.call_args[0][0]
            assert payload["content_type"] == CONTENT_TYPE_HELP_DOC
            assert payload["content_id"] == content_id
            assert organization_id == payload.get("organization_id")


@pytest.mark.unit
@pytest.mark.property
class TestHelpDocumentationRAGPropertyTopK:
    """Property 4: RAG Top-K Retrieval."""

    def test_retrieve_calls_rpc_with_similarity_limit(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(data=[])
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            rag.retrieve_relevant_docs("help", organization_id="org-1", top_k=5, similarity_threshold=0.75)
            call_kw = mock_supabase.rpc.call_args[0][1]
            assert call_kw["similarity_limit"] == 5
            assert call_kw["similarity_threshold"] == 0.75
            assert CONTENT_TYPE_HELP_DOC in call_kw["content_types"]


@pytest.mark.unit
@pytest.mark.property
class TestHelpDocumentationRAGPropertyOrgFiltering:
    """Property 1 (RAG portion): Organization Context Isolation."""

    def test_retrieve_passes_organization_id_to_rpc(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(data=[])
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            rag.retrieve_relevant_docs("query", organization_id="org-123")
            assert mock_supabase.rpc.call_args[0][1]["org_id"] == "org-123"


@pytest.mark.unit
@pytest.mark.property
class TestHelpDocumentationRAGPropertySourceAttribution:
    """Property 6: RAG Source Attribution."""

    def test_retrieve_returns_docs_with_content_type_and_similarity(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(
            data=[
                {"content_type": CONTENT_TYPE_HELP_DOC, "content_id": "d1", "content_text": "t1", "metadata": {}, "similarity_score": 0.9},
                {"content_type": CONTENT_TYPE_HELP_DOC, "content_id": "d2", "content_text": "t2", "metadata": {}, "similarity_score": 0.8},
            ]
        )
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            result = rag.retrieve_relevant_docs("query", organization_id=None)
            assert len(result) == 2
            for r in result:
                assert "content_type" in r
                assert "content_id" in r
                assert "content_text" in r
                assert "similarity_score" in r
