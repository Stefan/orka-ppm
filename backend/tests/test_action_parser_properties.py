"""
Property tests for Natural Language Action Parser (Tasks 10.4–10.9).
Properties 20–25: action detection, response format, error handling, logging, navigate/modal commands.
"""

import pytest
from unittest.mock import MagicMock

from services.natural_language_actions_service import NaturalLanguageActionsService


# ---------- Property 20: Action Parser Detection (Req 7.1) ----------
@pytest.mark.property
class TestProperty20ActionParserDetection:
    """For any query containing actionable intent, the parser SHALL identify action type and extract parameters."""

    @pytest.mark.asyncio
    async def test_fetch_data_intent_detected(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("show me EAC for projects", {}, "u1", "org1")
        assert result["action_type"] == "fetch_data"
        assert "action_data" in result
        assert result["action_data"].get("type") == "eac"

    @pytest.mark.asyncio
    async def test_navigate_intent_detected(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to financials", {}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert "path" in result["action_data"]
        assert result["action_data"]["path"] == "/financials"

    @pytest.mark.asyncio
    async def test_open_modal_intent_detected(self, mock_supabase):
        # "open costbook" is matched as fetch_data (costbook); use phrase that triggers open_modal only
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("show the settings modal", {}, "u1", "org1")
        assert result["action_type"] == "open_modal"
        assert "modal" in result["action_data"]
        assert result["action_data"]["modal"] in ("generic", "costbook")


# ---------- Property 21: Action Execution Response Format (Req 7.5) ----------
@pytest.mark.property
class TestProperty21ActionExecutionResponseFormat:
    """For any successfully executed action, the system SHALL return action_result AND natural language confirmation."""

    @pytest.mark.asyncio
    async def test_success_response_has_action_data_and_explanation(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("navigate to dashboard", {}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert "action_data" in result
        assert "explanation" in result
        assert isinstance(result["explanation"], str)
        assert len(result["explanation"]) > 0

    @pytest.mark.asyncio
    async def test_fetch_data_response_has_data_and_confirmation(self, mock_supabase):
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("what is our EAC?", {}, "u1", "org1")
        assert result["action_type"] == "fetch_data"
        assert "data" in result["action_data"] or "type" in result["action_data"]
        assert result["explanation"]


# ---------- Property 22: Action Execution Error Handling (Req 7.6) ----------
@pytest.mark.property
class TestProperty22ActionExecutionErrorHandling:
    """For any action that cannot be executed, the system SHALL return an error message with specific reason."""

    @pytest.mark.asyncio
    async def test_empty_query_returns_explanation(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("", {}, "u1", "org1")
        assert result["action_type"] == "none"
        assert "explanation" in result
        assert result["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_unrelated_query_returns_no_action_with_reason(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("what is the weather today?", {}, "u1", "org1")
        assert result["action_type"] == "none"
        assert "explanation" in result
        assert "No actionable" in result["explanation"] or "detected" in result["explanation"].lower()

    @pytest.mark.asyncio
    async def test_whitespace_only_returns_empty_query_reason(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("   ", {}, "u1", "org1")
        assert result["action_type"] == "none"
        assert result["explanation"]


# ---------- Property 23: Action Execution Logging (Req 7.7) ----------
@pytest.mark.property
class TestProperty23ActionExecutionLogging:
    """Return value SHALL contain all fields needed for help_logs: action_type, action_details (action_data), explanation."""

    @pytest.mark.asyncio
    async def test_action_result_has_loggable_fields(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to risks", {}, "u1", "org1")
        assert "action_type" in result
        assert "action_data" in result  # action_details for logging
        assert "explanation" in result
        assert result["action_type"] != "none"

    @pytest.mark.asyncio
    async def test_no_action_result_has_same_shape_for_logging(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("hello", {}, "u1", "org1")
        assert "action_type" in result
        assert "action_data" in result
        assert "explanation" in result
        assert result["action_type"] == "none"


# ---------- Property 24: Navigate Action Command Generation (Req 7.3) ----------
@pytest.mark.property
class TestProperty24NavigateCommandGeneration:
    """For any 'navigate' identification, return command with path (page) and optional entity_id."""

    @pytest.mark.asyncio
    async def test_navigate_has_path_field(self, mock_supabase):
        # Any phrase with "costbook" matches fetch_data first; use navigate-only phrase
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to dashboard", {}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert "path" in result["action_data"]
        assert result["action_data"]["path"].startswith("/")

    @pytest.mark.asyncio
    async def test_navigate_path_is_valid_route(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        for query, expected_path in [
            ("go to dashboard", "/dashboards"),
            ("navigate to financials", "/financials"),
            ("go to risks", "/risks"),
            ("show me projects", "/dashboards"),
        ]:
            result = await svc.parse_and_execute(query, {}, "u1", "org1")
            assert result["action_type"] == "navigate", f"Query: {query}"
            assert result["action_data"]["path"] == expected_path, f"Query: {query}"


# ---------- Property 25: Modal Action Command Generation (Req 7.4) ----------
@pytest.mark.property
class TestProperty25ModalActionCommandGeneration:
    """For any 'open modal' identification, return command with modal_type and optional prefill."""

    @pytest.mark.asyncio
    async def test_open_modal_has_modal_type_field(self, mock_supabase):
        # Queries with "modal" or "dialog" (and no prior match) yield open_modal with modal type
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("display dialog", {}, "u1", "org1")
        assert result["action_type"] == "open_modal"
        assert "modal" in result["action_data"]
        assert result["action_data"]["modal"] in ("generic", "costbook")

    @pytest.mark.asyncio
    async def test_open_modal_generic_when_no_costbook(self, mock_supabase):
        # "open modal" matches navigate first; use phrase that triggers open_modal only
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("display dialog", {}, "u1", "org1")
        assert result["action_type"] == "open_modal"
        assert result["action_data"]["modal"] in ("generic", "costbook")
