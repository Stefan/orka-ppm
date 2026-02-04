"""Load tests for project controls (basic smoke tests)."""

import pytest


class TestProjectControlsLoad:
    def test_project_controls_services_instantiate(self):
        """All project controls services should instantiate without error."""
        from unittest.mock import Mock
        from services.forecast_engine_service import ForecastEngineService
        from services.earned_value_manager_service import EarnedValueManagerService
        from services.variance_analyzer_service import VarianceAnalyzerService
        mock_db = Mock()
        ForecastEngineService(mock_db)
        EarnedValueManagerService(mock_db)
        VarianceAnalyzerService(mock_db)
