"""Unit tests for Cost Impact Analyzer Service."""

import pytest
from unittest.mock import Mock, patch

from services.cost_impact_analyzer_service import CostImpactAnalyzerService


class TestCostImpactAnalyzerService:
    def test_calculate_direct_costs_from_line_items(self):
        with patch("config.database.supabase", Mock()):
            svc = CostImpactAnalyzerService()
        items = [
            {"cost_category": "labor", "total_cost": 1000},
            {"cost_category": "labor", "total_cost": 500},
            {"cost_category": "material", "total_cost": 750},
        ]
        result = svc.calculate_direct_costs_from_line_items(items)
        assert result["labor"] == 1500
        assert result["material"] == 750

    def test_calculate_indirect_costs(self):
        with patch("config.database.supabase", Mock()):
            svc = CostImpactAnalyzerService()
        direct = {"labor": 10000, "material": 5000}
        result = svc.calculate_indirect_costs(direct, overhead_pct=10, profit_pct=5)
        assert "overhead" in result
        assert "profit" in result
        assert result["overhead"] == 1500  # 10% of 15000
        assert result["profit"] == 750  # 5% of 15000
