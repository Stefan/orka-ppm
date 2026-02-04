"""Performance tests for project controls."""

import pytest
import time


class TestProjectControlsPerformance:
    def test_service_import_performance(self):
        """Service imports should complete quickly."""
        start = time.perf_counter()
        from services.etc_calculator_service import ETCCalculatorService
        from services.eac_calculator_service import EACCalculatorService
        from services.forecast_engine_service import ForecastEngineService
        elapsed = time.perf_counter() - start
        assert elapsed < 2.0, "Service imports took too long"
