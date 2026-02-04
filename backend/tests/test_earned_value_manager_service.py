"""Unit tests for Earned Value Manager Service."""

import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch


class TestEarnedValueManagerService:
    @pytest.mark.asyncio
    async def test_calculate_earned_value_metrics_returns_dict(self):
        with patch("config.database.supabase", Mock()):
            from services.earned_value_manager_service import EarnedValueManagerService
            mock_db = Mock()
            svc = EarnedValueManagerService(mock_db)
            svc.get_financial_data = AsyncMock(return_value={
                "budget_at_completion": Decimal("1000"),
                "actual_cost": Decimal("500"),
                "earned_value": Decimal("600"),
                "planned_value": Decimal("1000"),
            })
            result = await svc.calculate_earned_value_metrics(uuid4())
            assert "cost_performance_index" in result
            assert "schedule_performance_index" in result
            assert "estimate_at_completion" in result
