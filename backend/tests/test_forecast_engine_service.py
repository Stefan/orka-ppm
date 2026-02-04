"""Unit tests for Forecast Engine Service."""

import pytest
from datetime import date
from uuid import uuid4
from unittest.mock import Mock, patch, AsyncMock

from services.forecast_engine_service import ForecastEngineService


class TestForecastEngineService:
    @pytest.mark.asyncio
    async def test_generate_monthly_forecast_empty_project(self):
        with patch("config.database.supabase", Mock()):
            svc = ForecastEngineService(Mock())
            svc.get_project_data = AsyncMock(return_value=None)
            result = await svc.generate_monthly_forecast(
                uuid4(), date.today(), date(2026, 12, 31)
            )
            assert result == []
