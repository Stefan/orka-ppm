"""Load tests for change orders (basic smoke tests)."""

import pytest


class TestChangeOrdersLoad:
    def test_change_order_services_import(self):
        """Change order services should import without error."""
        from services.change_order_manager_service import ChangeOrderManagerService
        from services.cost_impact_analyzer_service import CostImpactAnalyzerService
        assert ChangeOrderManagerService is not None
        assert CostImpactAnalyzerService is not None
