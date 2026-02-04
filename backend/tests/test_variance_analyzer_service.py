"""Unit tests for Variance Analyzer Service."""

import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch


class TestVarianceAnalyzerService:
    @pytest.mark.asyncio
    async def test_analyze_variances_returns_dict(self):
        with patch("config.database.supabase", Mock()):
            from services.variance_analyzer_service import VarianceAnalyzerService
            mock_db = Mock()
            svc = VarianceAnalyzerService(mock_db)
            svc.get_financial_data = AsyncMock(return_value={
                "budget_at_completion": Decimal("1000"),
                "actual_cost": Decimal("500"),
                "earned_value": Decimal("600"),
                "planned_value": Decimal("1000"),
            })
            result = await svc.analyze_variances(uuid4())
            assert "cost_variances" in result
            assert "schedule_variances" in result
            assert "performance_indices" in result
