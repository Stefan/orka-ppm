"""Unit tests for EAC Calculator Service."""

import pytest
from uuid import uuid4
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch


class TestEACCalculatorService:
    def test_performance_indices_calculation(self):
        with patch("config.database.supabase", Mock()):
            from services.eac_calculator_service import EACCalculatorService
            svc = EACCalculatorService(Mock())
            indices = svc.calculate_performance_indices(
                Decimal("100"), Decimal("80"), Decimal("90"), Decimal("200")
            )
            assert "cost_performance_index" in indices
            assert "schedule_performance_index" in indices
            assert indices["cost_performance_index"] > 0
            assert indices["schedule_performance_index"] > 0
