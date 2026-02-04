"""Unit tests for ETC Calculator Service."""

import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch


class TestETCCalculatorService:
    @pytest.mark.asyncio
    async def test_calculate_bottom_up_etc_empty_work_packages(self):
        with patch("config.database.supabase", Mock()):
            from services.etc_calculator_service import ETCCalculatorService
            from models.project_controls import ETCCalculationMethod
            mock_db = Mock()
            svc = ETCCalculatorService(mock_db)
            svc.get_work_packages = AsyncMock(return_value=[])
            result = await svc.calculate_bottom_up_etc(uuid4())
            assert result.result_value == Decimal("0")
            assert result.calculation_method == ETCCalculationMethod.bottom_up
            assert result.validation_result.is_valid is False
