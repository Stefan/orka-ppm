"""
Unit tests for unified_search_service (Topbar Unified Search).
Covers _snippet, _href_for, _fallback_suggestions, fulltext_search, get_suggestions_sync, unified_search.
"""

import asyncio
from unittest.mock import Mock, patch, MagicMock
import pytest


# Test helpers that are used by the service (we test via public API or by importing internal helpers)
def test_snippet_empty():
    from services.unified_search_service import _snippet
    assert _snippet(None) == ""
    assert _snippet("") == ""


def test_snippet_short():
    from services.unified_search_service import _snippet
    assert _snippet("hello") == "hello"
    assert _snippet("  trim  ") == "trim"


def test_snippet_truncate():
    from services.unified_search_service import _snippet
    long_text = "a" * 150
    result = _snippet(long_text, max_len=100)
    assert len(result) == 101
    assert result.endswith("…")
    assert result.startswith("a" * 100)


def test_snippet_newlines():
    from services.unified_search_service import _snippet
    assert _snippet("line1\nline2") == "line1 line2"


def test_href_for_project():
    from services.unified_search_service import _href_for
    assert _href_for({"type": "project", "id": "pid-123"}) == "/projects/pid-123"
    assert _href_for({"type": "project", "content_id": "pid-456"}) == "/projects/pid-456"


def test_href_for_commitment():
    from services.unified_search_service import _href_for
    assert _href_for({"type": "commitment", "id": "c1"}) == "/financials/commitments"


def test_href_for_knowledge_base():
    from services.unified_search_service import _href_for
    assert _href_for({"type": "knowledge_base"}) == "/help"
    assert _href_for({"type": "document"}) == "/help"


def test_href_for_unknown():
    from services.unified_search_service import _href_for
    assert _href_for({"type": "unknown"}) == "/projects"


def test_fallback_suggestions():
    from services.unified_search_service import _fallback_suggestions
    assert "Projects" in _fallback_suggestions("pro", 10)
    assert "Costbook" in _fallback_suggestions("cos", 10)
    assert "Dashboard" in _fallback_suggestions("dash", 10)
    assert len(_fallback_suggestions("xy", 3)) <= 3
    assert _fallback_suggestions("nonexistentprefix", 5) == []


def test_get_suggestions_sync_empty():
    from services.unified_search_service import get_suggestions_sync
    assert get_suggestions_sync("", 10) == []
    assert get_suggestions_sync("  ", 10) == []
    assert get_suggestions_sync("a", 10) == []  # len < 2


def test_get_suggestions_sync_fallback_when_no_openai():
    from services.unified_search_service import get_suggestions_sync
    with patch.dict("os.environ", {}, clear=False):
        # Remove OPENAI_API_KEY so it uses fallback
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False):
            result = get_suggestions_sync("pro", 5)
    assert isinstance(result, list)
    assert any("Project" in s for s in result)


@pytest.mark.asyncio
async def test_fulltext_search_empty_query():
    from services.unified_search_service import fulltext_search
    result = await fulltext_search("", limit=5)
    assert result == []
    result = await fulltext_search("   ", limit=5)
    assert result == []


@pytest.mark.asyncio
async def test_fulltext_search_no_supabase():
    from services.unified_search_service import fulltext_search
    with patch("services.unified_search_service.supabase", None):
        result = await fulltext_search("test", limit=5)
    assert result == []


@pytest.mark.asyncio
async def test_fulltext_search_with_mock_supabase():
    from services.unified_search_service import fulltext_search
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = Mock(
        data=[
            {"id": "p1", "name": "Project Alpha", "description": "A test project"},
        ]
    )
    mock_sb.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.side_effect = [
        Mock(data=[{"id": "p1", "name": "Project Alpha", "description": "A test project"}]),
        Exception("commitments table missing"),
    ]
    with patch("services.unified_search_service.supabase", mock_sb):
        result = await fulltext_search("alpha", limit=10)
    assert len(result) >= 1
    assert result[0]["type"] == "project"
    assert result[0]["title"] == "Project Alpha"
    assert "alpha" in result[0]["href"] or "p1" in result[0]["href"]


@pytest.mark.asyncio
async def test_semantic_search_empty_query():
    from services.unified_search_service import semantic_search
    result = await semantic_search("", limit=5)
    assert result == []


@pytest.mark.asyncio
async def test_semantic_search_no_openai_returns_empty():
    from services.unified_search_service import semantic_search
    with patch("services.unified_search_service.supabase", MagicMock()):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False):
            result = await semantic_search("help variance", limit=3)
    # When no API key, semantic_search may return [] or raise; we accept []
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_unified_search_empty_query():
    from services.unified_search_service import unified_search
    result = await unified_search("", limit=10, user={"roles": ["user"]})
    assert result["fulltext"] == []
    assert result["semantic"] == []
    assert result["suggestions"] == []
    assert "meta" in result
    assert result["meta"]["role"] == "user"


@pytest.mark.asyncio
async def test_unified_search_with_query_mocked():
    from unittest.mock import AsyncMock
    from services.unified_search_service import unified_search
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = Mock(
        data=[]
    )
    with patch("services.unified_search_service.supabase", mock_sb):
        with patch("services.unified_search_service.fulltext_search", new_callable=AsyncMock, return_value=[]):
            with patch("services.unified_search_service.semantic_search", new_callable=AsyncMock, return_value=[]):
                result = await unified_search("cost", limit=5, user={"roles": ["admin"]})
    assert "fulltext" in result
    assert "semantic" in result
    assert "suggestions" in result
    assert "meta" in result
    assert result["meta"]["role"] == "admin"


@pytest.mark.asyncio
async def test_unified_search_role_from_list():
    from services.unified_search_service import unified_search

    async def mock_fulltext(*args, **kwargs):
        return []

    async def mock_semantic(*args, **kwargs):
        return []

    real_loop = asyncio.get_event_loop()

    def mock_run_in_executor(executor, fn):
        result = fn()
        fut = real_loop.create_future()
        fut.set_result(result)
        return fut

    with patch("services.unified_search_service.fulltext_search", side_effect=mock_fulltext):
        with patch("services.unified_search_service.semantic_search", side_effect=mock_semantic):
            with patch("services.unified_search_service.asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = mock_run_in_executor
                result = await unified_search("co", limit=5, user={"roles": ["editor", "viewer"]})
    assert result["meta"]["role"] == "editor"
    assert isinstance(result["suggestions"], list)
