"""
Unit tests for NaturalLanguageActionsService (Tasks 10.10, 11.6).
Action detection, costbook data retrieval, currency formatting, variance.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from services.natural_language_actions_service import (
    NaturalLanguageActionsService,
    _format_currency,
    VARIANCE_THRESHOLD_PERCENT,
)


@pytest.mark.unit
class TestFormatCurrency:
    """Task 11.6: Currency formatting."""

    def test_format_currency_default(self):
        assert "1,234.56" in _format_currency(1234.56)
        assert "USD" in _format_currency(1234.56, "USD")

    def test_format_currency_zero(self):
        assert "0.00" in _format_currency(0)

    def test_format_currency_eur(self):
        out = _format_currency(1000, "EUR")
        assert "EUR" in out and "1,000" in out


@pytest.mark.unit
class TestNaturalLanguageActionsServiceCostbook:
    """Task 11: Costbook intent and data."""

    @pytest.mark.asyncio
    async def test_costbook_intent_returns_fetch_data(self, mock_supabase):
        projects_mock = MagicMock()
        projects_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        actuals_mock = MagicMock()
        actuals_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])
        mock_supabase.table.side_effect = [projects_mock, actuals_mock]
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("show me budget and variance", {}, "u1", "org1")
        assert result["action_type"] == "fetch_data"
        assert result["action_data"]["type"] == "costbook"
        assert result["confidence"] >= 0.8

    @pytest.mark.asyncio
    async def test_fetch_costbook_data_returns_formatted_rows(self, mock_supabase):
        projects_mock = MagicMock()
        projects_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "p1", "name": "Project A", "budget": 10000, "currency": "USD"}]
        )
        actuals_mock = MagicMock()
        actuals_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"project_id": "p1", "amount": 3000}]
        )
        mock_supabase.table.side_effect = [projects_mock, actuals_mock]
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        rows = await svc._fetch_costbook_data("org1")
        assert len(rows) == 1
        assert rows[0]["project_name"] == "Project A"
        assert rows[0]["budget"] == 10000
        assert rows[0]["actual_cost"] == 3000
        assert rows[0]["variance"] == 7000
        assert "variance_percent" in rows[0]
        assert "budget_formatted" in rows[0]
        assert rows[0]["variance_over_threshold"] is True  # 70% > 10%

    @pytest.mark.asyncio
    async def test_fetch_costbook_data_empty_when_no_supabase(self):
        svc = NaturalLanguageActionsService(supabase_client=None)
        rows = await svc._fetch_costbook_data("org1")
        assert rows == []


@pytest.mark.unit
class TestNaturalLanguageActionsServiceDetection:
    """Task 10.10: Action detection."""

    @pytest.mark.asyncio
    async def test_navigate_intent_returns_path(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to dashboard", {}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert "path" in result["action_data"]
        assert result["action_data"]["path"] == "/dashboards"

    @pytest.mark.asyncio
    async def test_no_action_for_unrelated_query(self, mock_supabase):
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("what is the weather", {}, "u1", "org1")
        assert result["action_type"] == "none"
        assert result["confidence"] == 0.0

    # ---------- Task 10.10: Additional unit tests ----------

    @pytest.mark.asyncio
    async def test_fetch_eac_returns_project_data(self, mock_supabase):
        """Task 10.10: Test specific action type - fetch EAC."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "p1", "name": "Alpha", "budget": 1000, "eac": 1200}]
        )
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("show EAC for all projects", {}, "u1", "org1")
        assert result["action_type"] == "fetch_data"
        assert result["action_data"]["type"] == "eac"
        assert isinstance(result["action_data"].get("data"), list)

    @pytest.mark.asyncio
    async def test_navigate_to_project_detail_path(self, mock_supabase):
        """Task 10.10: Open project details - navigate to projects."""
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("show me project detail", {}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert result["action_data"]["path"] == "/projects"

    @pytest.mark.asyncio
    async def test_invalid_parameters_empty_user_id_returns_action_or_no_action(self, mock_supabase):
        """Task 10.10: Invalid parameters - empty user_id does not crash; returns consistent shape."""
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to dashboard", {}, "", "org1")
        assert "action_type" in result
        assert "action_data" in result
        assert "explanation" in result

    @pytest.mark.asyncio
    async def test_invalid_parameters_none_organization_does_not_crash(self, mock_supabase):
        """Task 10.10: Invalid parameters - None/missing organization_id handled."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("eac please", {}, "u1", None)
        assert "action_type" in result
        assert "action_data" in result

    @pytest.mark.asyncio
    async def test_context_passed_does_not_affect_action_detection_shape(self, mock_supabase):
        """Task 10.10: Context is optional; response shape unchanged."""
        svc = NaturalLanguageActionsService(supabase_client=mock_supabase)
        result = await svc.parse_and_execute("go to risks", {"route": "/x", "pageTitle": "Y"}, "u1", "org1")
        assert result["action_type"] == "navigate"
        assert result["action_data"]["path"] == "/risks"
