"""
Unit tests for HelpDocumentationRAG (AI Help Chat Enhancement).
Index and retrieve help documentation with embeddings and organization filtering.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from services.help_documentation_rag import (
    HelpDocumentationRAG,
    get_help_documentation_rag,
    SIMILARITY_THRESHOLD,
    TOP_K,
    CONTENT_TYPE_HELP_DOC,
)


@pytest.mark.unit
class TestHelpDocumentationRAGInit:
    """Construction and _get_openai."""

    def test_init_stores_supabase_and_env(self, mock_supabase):
        with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test", "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small"}):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-override")
            assert rag.supabase is mock_supabase
            assert rag.openai_api_key == "sk-override"
            assert rag.embedding_model == "text-embedding-3-small"

    def test_get_openai_raises_when_no_key(self, mock_supabase):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key=None)
            with pytest.raises(RuntimeError, match="OPENAI_API_KEY not set"):
                rag._get_openai()

    def test_get_openai_creates_client_with_base_url(self, mock_supabase):
        with patch("services.help_documentation_rag.OpenAI") as OpenAI:
            rag = HelpDocumentationRAG(
                mock_supabase,
                openai_api_key="sk-x",
                base_url="https://custom.openai.com/v1",
            )
            rag._get_openai()
            OpenAI.assert_called_once_with(api_key="sk-x", base_url="https://custom.openai.com/v1")


@pytest.mark.unit
class TestHelpDocumentationRAGIndex:
    """index_documentation generates embedding and upserts to embeddings."""

    def test_index_documentation_success(self, mock_supabase):
        fake_embedding = [0.1] * 1536
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=fake_embedding):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            record_id = rag.index_documentation(
                content_id="doc-1",
                content_text="How to create a project.",
                organization_id="org-1",
                metadata={"source": "manual"},
            )
            assert record_id is not None
            table = mock_supabase.table.return_value
            table.upsert.assert_called_once()
            call_args = table.upsert.call_args
            payload = call_args[0][0]
            assert payload["content_type"] == CONTENT_TYPE_HELP_DOC
            assert payload["content_id"] == "doc-1"
            assert "How to create a project." in (payload["content_text"] or "")
            assert payload["embedding"] == fake_embedding
            assert payload["metadata"] == {"source": "manual"}
            assert payload["organization_id"] == "org-1"
            assert call_args[1].get("on_conflict") == "content_type,content_id"

    def test_index_documentation_truncates_text(self, mock_supabase):
        long_text = "x" * 10000
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            rag.index_documentation(content_id="d", content_text=long_text, organization_id=None)
            payload = mock_supabase.table.return_value.upsert.call_args[0][0]
            assert len(payload["content_text"]) == 8000


@pytest.mark.unit
class TestHelpDocumentationRAGRetrieve:
    """retrieve_relevant_docs calls RPC and returns list of docs."""

    def test_retrieve_empty_query_returns_empty(self, mock_supabase):
        rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
        result = rag.retrieve_relevant_docs(query="", organization_id="org-1")
        assert result == []
        result = rag.retrieve_relevant_docs(query="   ", organization_id="org-1")
        assert result == []

    def test_retrieve_success(self, mock_supabase):
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(
            data=[
                {
                    "content_type": CONTENT_TYPE_HELP_DOC,
                    "content_id": "doc-1",
                    "content_text": "Creating projects...",
                    "metadata": {"lang": "en"},
                    "similarity_score": 0.85,
                }
            ]
        )
        mock_supabase.rpc.return_value = mock_rpc
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.1] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            result = rag.retrieve_relevant_docs(
                query="create project",
                organization_id="org-1",
                top_k=5,
                similarity_threshold=0.75,
            )
            assert len(result) == 1
            assert result[0]["content_id"] == "doc-1"
            assert result[0]["content_text"] == "Creating projects..."
            assert result[0]["metadata"] == {"lang": "en"}
            assert result[0]["similarity_score"] == 0.85
            mock_supabase.rpc.assert_called_once_with(
                "vector_similarity_search",
                {
                    "query_embedding": [0.1] * 1536,
                    "content_types": [CONTENT_TYPE_HELP_DOC],
                    "org_id": "org-1",
                    "similarity_limit": 5,
                    "similarity_threshold": 0.75,
                },
            )

    def test_retrieve_defaults_top_k_and_threshold(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(data=[])
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            rag.retrieve_relevant_docs(query="help", organization_id=None)
            call_kw = mock_supabase.rpc.call_args[0][1]
            assert call_kw["similarity_limit"] == TOP_K
            assert call_kw["similarity_threshold"] == SIMILARITY_THRESHOLD

    def test_retrieve_rpc_failure_returns_empty(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.side_effect = Exception("RPC failed")
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            result = rag.retrieve_relevant_docs(query="help", organization_id="org-1")
            assert result == []

    def test_retrieve_none_data_returns_empty(self, mock_supabase):
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(data=None)
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            result = rag.retrieve_relevant_docs(query="help", organization_id=None)
            assert result == []

    def test_retrieve_fewer_than_top_k_docs_returns_available(self, mock_supabase):
        """Task 4.6: Test with fewer than 3 docs available."""
        mock_supabase.rpc.return_value.execute.return_value = MagicMock(
            data=[
                {"content_type": CONTENT_TYPE_HELP_DOC, "content_id": "d1", "content_text": "t1", "metadata": {}, "similarity_score": 0.85},
            ]
        )
        with patch.object(HelpDocumentationRAG, "_generate_embedding", return_value=[0.0] * 1536):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            result = rag.retrieve_relevant_docs(query="help", organization_id=None, top_k=3)
            assert len(result) == 1
            assert result[0]["content_id"] == "d1"
            assert result[0]["similarity_score"] == 0.85

    def test_retrieve_embedding_failure_raises(self, mock_supabase):
        """Task 4.6: Test embedding generation failures."""
        with patch.object(HelpDocumentationRAG, "_generate_embedding", side_effect=RuntimeError("OpenAI error")):
            rag = HelpDocumentationRAG(mock_supabase, openai_api_key="sk-x")
            with pytest.raises(RuntimeError, match="OpenAI error"):
                rag.retrieve_relevant_docs(query="help", organization_id=None)


@pytest.mark.unit
class TestGetHelpDocumentationRAG:
    """Factory get_help_documentation_rag."""

    def test_get_returns_instance_when_config_available(self, mock_supabase):
        with patch("services.help_documentation_rag.HelpDocumentationRAG") as Klass:
            get_help_documentation_rag(supabase_client=mock_supabase)
            Klass.assert_called_once()
            assert get_help_documentation_rag(supabase_client=mock_supabase) is not None
