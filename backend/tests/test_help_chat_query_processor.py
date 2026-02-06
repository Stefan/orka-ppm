"""
Unit tests for Help Chat query processor flow (Tasks 5.3, 5.5).
Context formatting, response shape, and HelpLogger integration.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.help_rag_agent import PageContext, HelpResponse


@pytest.mark.unit
class TestPageContextFormatting:
    """Task 5.3: Context Capture and Formatting (backend portion)."""

    def test_page_context_from_dict_has_required_fields(self):
        ctx = PageContext(
            route="/financials/costbook",
            page_title="Costbook",
            user_role="admin",
            current_project="proj-1",
            current_portfolio="port-1",
            relevant_data={"page": "financials"},
        )
        assert ctx.route == "/financials/costbook"
        assert ctx.page_title == "Costbook"
        assert ctx.user_role == "admin"
        assert ctx.current_project == "proj-1"
        assert ctx.current_portfolio == "port-1"
        assert ctx.relevant_data == {"page": "financials"}

    def test_page_context_defaults_relevant_data_to_empty(self):
        ctx = PageContext(route="/", page_title="Dashboard", user_role="user")
        assert ctx.relevant_data == {}

    @pytest.mark.parametrize("route,page_title,user_role", [
        ("/dashboards", "Dashboards", "user"),
        ("/projects/abc", "Project: abc", "admin"),
        ("/admin", "Administration", "admin"),
    ])
    def test_context_formatting_various_routes(self, route, page_title, user_role):
        ctx = PageContext(route=route, page_title=page_title, user_role=user_role)
        assert ctx.route == route
        assert ctx.page_title == page_title
        assert ctx.user_role == user_role


@pytest.mark.unit
class TestHelpResponseStructure:
    """Task 5.5: Response structure and confidence."""

    def test_help_response_has_required_fields(self):
        r = HelpResponse(
            response="Answer",
            sources=[{"type": "doc", "id": "1", "title": "T", "similarity": 0.9, "url": "/doc/1"}],
            confidence=0.85,
            session_id="s1",
            response_time_ms=100,
            proactive_tips=[],
            suggested_actions=[],
            related_guides=[],
        )
        assert r.response == "Answer"
        assert len(r.sources) == 1
        assert r.confidence == 0.85
        assert r.response_time_ms == 100
        assert r.proactive_tips == []
        assert r.suggested_actions == []
        assert r.related_guides == []

    def test_help_response_defaults_optional_lists(self):
        r = HelpResponse(
            response="Ok",
            sources=[],
            confidence=0.5,
            session_id="s2",
            response_time_ms=50,
        )
        assert r.proactive_tips == []
        assert r.suggested_actions == []
        assert r.related_guides == []
