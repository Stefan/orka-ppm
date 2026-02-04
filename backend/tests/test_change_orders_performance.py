"""Performance tests for change order processing."""

import pytest
from uuid import uuid4


class TestChangeOrderPerformance:
    """Basic performance smoke tests."""

    def test_import_performance(self):
        """Imports should complete quickly."""
        import time
        start = time.perf_counter()
        from services.change_order_manager_service import ChangeOrderManagerService
        from services.cost_impact_analyzer_service import CostImpactAnalyzerService
        elapsed = time.perf_counter() - start
        assert elapsed < 2.0, "Service imports took too long"
