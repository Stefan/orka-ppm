"""
Performance Analytics Service for Project Controls
Trend analysis and performance summary.
"""

import logging
from typing import Dict, List, Any
from uuid import UUID

from services.earned_value_manager_service import EarnedValueManagerService
from services.variance_analyzer_service import VarianceAnalyzerService

logger = logging.getLogger(__name__)


class PerformanceAnalyticsService:
    """Service for performance analytics and dashboards."""

    def __init__(self, supabase_client):
        self.ev_manager = EarnedValueManagerService(supabase_client)
        self.variance = VarianceAnalyzerService(supabase_client)

    async def get_performance_dashboard(
        self,
        project_id: UUID,
    ) -> Dict[str, Any]:
        """Get full performance dashboard data."""
        metrics = await self.ev_manager.calculate_earned_value_metrics(project_id)
        variance = await self.variance.analyze_variances(project_id)
        trends = await self.ev_manager.get_performance_trends(project_id)
        return {
            "project_id": str(project_id),
            "current_metrics": metrics,
            "variance_analysis": variance,
            "performance_trends": trends,
        }
