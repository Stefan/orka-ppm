"""
Unit Tests for PO Breakdown Variance Analysis and Alerting

This module contains comprehensive unit tests for variance calculation,
alert generation, and alert management functionality.

Task: 3.2 Add variance analysis and alerting
**Validates: Requirements 3.4, 3.5, 5.6**

Tests Implemented:
- Variance calculation for individual items
- Project-wide variance calculation
- Alert generation when variance exceeds 50% threshold
- Alert storage and retrieval
- Alert acknowledgment and resolution
- Recommendation generation
"""

import pytest
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, List
from uuid import UUID, uuid4
from unittest.mock import Mock, MagicMock

import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.po_breakdown import (
    VarianceData,
    VarianceStatus,
    TrendDirection,
    ProjectVarianceResult,
    VarianceAlert,
    VarianceAlertType,
    AlertSeverity,
)
from services.po_breakdown_service import POBreakdownDatabaseService, VARIANCE_THRESHOLDS


# ============================================================================
# Test Fixtures
# ============================================================================

class MockSupabaseResponse:
    """Mock Supabase response object."""
    def __init__(self, data: List[Dict[str, Any]], count: int = None):
        self.data = data
        self.count = count if count is not None else len(data)


class MockSupabaseQuery:
    """Mock Supabase query builder."""
    def __init__(self, data: List[Dict[str, Any]] = None):
        self._data = data or []
        self._filters = {}
        self._count = None
        self._order_desc = False
        self._limit_val = None
    
    def select(self, *args, **kwargs):
        if 'count' in kwargs:
            self._count = len(self._data)
        return self
    
    def insert(self, data):
        self._data = [data]
        return self
    
    def update(self, data):
        if self._data:
            self._data[0].update(data)
        return self
    
    def eq(self, field, value):
        self._filters[field] = value
        return self
    
    def order(self, field, **kwargs):
        if kwargs.get('desc'):
            self._order_desc = True
        return self
    
    def limit(self, value):
        self._limit_val = value
        return self
    
    def execute(self):
        return MockSupabaseResponse(self._data, self._count)


@pytest.fixture
def sample_breakdown_data() -> Dict[str, Any]:
    """Create sample breakdown data for testing."""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Test Breakdown',
        'code': 'TB-001',
        'hierarchy_level': 0,
        'parent_breakdown_id': None,
        'planned_amount': '100000.00',
        'committed_amount': '50000.00',
        'actual_amount': '25000.00',
        'remaining_amount': '75000.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': 'Development',
        'is_active': True,
        'version': 1,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


@pytest.fixture
def sample_overrun_breakdown() -> Dict[str, Any]:
    """Create sample breakdown with budget overrun (>50%)."""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Overrun Breakdown',
        'code': 'OB-001',
        'hierarchy_level': 0,
        'parent_breakdown_id': None,
        'planned_amount': '100000.00',
        'committed_amount': '150000.00',
        'actual_amount': '160000.00',  # 60% over budget
        'remaining_amount': '-60000.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': 'Construction',
        'is_active': True,
        'version': 1,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


# ============================================================================
# Test Class: Variance Calculations
# ============================================================================

class TestVarianceCalculations:
    """
    Test variance calculation functionality.
    
    **Validates: Requirements 3.1, 3.2, 3.4**
    """

    @pytest.mark.asyncio
    async def test_calculate_item_variance_on_track(self, sample_breakdown_data):
        """
        Test variance calculation for item within acceptable range.
        
        **Validates: Requirements 3.1, 3.2**
        """
        # Setup mock - adjust to have minor variance (within 5%)
        sample_breakdown_data['planned_amount'] = '100000.00'
        sample_breakdown_data['actual_amount'] = '98000.00'  # 2% under budget
        
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        breakdown_id = UUID(sample_breakdown_data['id'])
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        service = POBreakdownDatabaseService(mock_client)
        
        # Execute
        variance = await service.calculate_item_variance(breakdown_id)
        
        # Verify
        assert variance is not None
        assert variance.variance_status == VarianceStatus.on_track
        assert variance.planned_vs_actual == Decimal('2000.00')  # 100000 - 98000
        assert variance.variance_percentage == Decimal('-2.00')  # (98000 - 100000) / 100000 * 100

    @pytest.mark.asyncio
    async def test_calculate_item_variance_critical(self, sample_overrun_breakdown):
        """
        Test variance calculation for item with critical overrun (>50%).
        
        **Validates: Requirements 3.2, 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        breakdown_id = UUID(sample_overrun_breakdown['id'])
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_overrun_breakdown])
        
        service = POBreakdownDatabaseService(mock_client)
        
        # Execute
        variance = await service.calculate_item_variance(breakdown_id)
        
        # Verify
        assert variance is not None
        assert variance.variance_status == VarianceStatus.critical_variance
        assert variance.variance_percentage == Decimal('60.00')  # (160000 - 100000) / 100000 * 100
        assert abs(variance.variance_percentage) > VARIANCE_THRESHOLDS['critical']

    @pytest.mark.asyncio
    async def test_calculate_project_variance_empty_project(self):
        """
        Test project variance calculation with no breakdowns.
        
        **Validates: Requirements 3.4, 5.2**
        """
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        # Empty result
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = uuid4()
        
        # Execute
        result = await service.calculate_project_variance(project_id)
        
        # Verify
        assert result is not None
        assert result.project_id == project_id
        assert result.overall_variance.variance_percentage == Decimal('0')
        assert result.overall_variance.variance_status == VarianceStatus.on_track

    @pytest.mark.asyncio
    async def test_calculate_project_variance_with_categories(self, sample_breakdown_data, sample_overrun_breakdown):
        """
        Test project variance calculation with multiple categories.
        
        **Validates: Requirements 3.4, 5.2**
        """
        # Setup mock
        mock_client = Mock()
        
        # Multiple breakdowns with different categories
        breakdowns = [sample_breakdown_data, sample_overrun_breakdown]
        
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse(breakdowns)
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = uuid4()
        
        # Execute
        result = await service.calculate_project_variance(project_id)
        
        # Verify
        assert result is not None
        assert len(result.by_category) == 2  # Development and Construction
        assert 'Development' in result.by_category
        assert 'Construction' in result.by_category
        assert len(result.top_variances) > 0


# ============================================================================
# Test Class: Alert Generation
# ============================================================================

class TestAlertGeneration:
    """
    Test variance alert generation functionality.
    
    **Validates: Requirements 3.5, 5.6**
    """

    @pytest.mark.asyncio
    async def test_generate_variance_alerts_no_overruns(self, sample_breakdown_data):
        """
        Test alert generation when no items exceed threshold.
        
        **Validates: Requirements 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = uuid4()
        
        # Execute
        alerts = await service.generate_variance_alerts(project_id)
        
        # Verify
        assert alerts is not None
        assert len(alerts) == 0  # No alerts for items within threshold

    @pytest.mark.asyncio
    async def test_generate_variance_alerts_with_overrun(self, sample_overrun_breakdown):
        """
        Test alert generation when item exceeds 50% threshold.
        
        **Validates: Requirements 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([sample_overrun_breakdown])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = UUID(sample_overrun_breakdown['project_id'])
        
        # Execute
        alerts = await service.generate_variance_alerts(project_id)
        
        # Verify
        assert alerts is not None
        assert len(alerts) == 1
        assert alerts[0].alert_type == VarianceAlertType.budget_exceeded
        assert alerts[0].severity == AlertSeverity.critical
        assert alerts[0].current_percentage > VARIANCE_THRESHOLDS['critical']
        assert len(alerts[0].recommended_actions) > 0

    @pytest.mark.asyncio
    async def test_alert_contains_recommended_actions(self, sample_overrun_breakdown):
        """
        Test that generated alerts include recommended actions.
        
        **Validates: Requirements 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([sample_overrun_breakdown])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = UUID(sample_overrun_breakdown['project_id'])
        
        # Execute
        alerts = await service.generate_variance_alerts(project_id)
        
        # Verify
        assert len(alerts) == 1
        alert = alerts[0]
        assert len(alert.recommended_actions) >= 3
        assert any('Review' in action for action in alert.recommended_actions)
        assert any('Investigate' in action or 'budget' in action for action in alert.recommended_actions)


# ============================================================================
# Test Class: Alert Management
# ============================================================================

class TestAlertManagement:
    """
    Test alert storage, retrieval, and management functionality.
    
    **Validates: Requirements 3.5, 5.6**
    """

    @pytest.mark.asyncio
    async def test_store_variance_alert(self, sample_overrun_breakdown):
        """
        Test storing a variance alert in the database.
        
        **Validates: Requirements 3.5, 5.6**
        """
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        alert_id = uuid4()
        stored_alert = {
            'id': str(alert_id),
            'project_id': sample_overrun_breakdown['project_id'],
            'wbs_element': sample_overrun_breakdown['id'],
            'variance_amount': '60000.00',
            'variance_percentage': '60.00',
            'severity': 'critical',
            'status': 'active',
            'message': 'Budget exceeded',
            'created_at': datetime.now().isoformat()
        }
        
        mock_table.insert.return_value.execute.return_value = MockSupabaseResponse([stored_alert])
        
        service = POBreakdownDatabaseService(mock_client)
        
        # Create alert
        alert = VarianceAlert(
            breakdown_id=UUID(sample_overrun_breakdown['id']),
            breakdown_name=sample_overrun_breakdown['name'],
            project_id=UUID(sample_overrun_breakdown['project_id']),
            alert_type=VarianceAlertType.budget_exceeded,
            severity=AlertSeverity.critical,
            threshold_exceeded=Decimal('50.0'),
            current_variance=Decimal('60000.00'),
            current_percentage=Decimal('60.00'),
            message='Budget exceeded by 60%',
            recommended_actions=['Review costs'],
            created_at=datetime.now()
        )
        
        # Execute
        result_id = await service.store_variance_alert(alert)
        
        # Verify
        assert result_id == alert_id

    @pytest.mark.asyncio
    async def test_get_variance_alerts(self, sample_overrun_breakdown):
        """
        Test retrieving variance alerts for a project.
        
        **Validates: Requirements 3.5, 5.6**
        """
        # Setup mock
        mock_client = Mock()
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        
        alert_data = {
            'id': str(uuid4()),
            'project_id': sample_overrun_breakdown['project_id'],
            'wbs_element': sample_overrun_breakdown['id'],
            'variance_amount': '60000.00',
            'variance_percentage': '60.00',
            'severity': 'critical',
            'status': 'active',
            'message': 'Budget exceeded by 60%',
            'details': {
                'breakdown_name': sample_overrun_breakdown['name'],
                'alert_type': 'budget_exceeded',
                'threshold_exceeded': '50.0',
                'recommended_actions': ['Review costs', 'Investigate overrun']
            },
            'acknowledged_by': None,
            'acknowledged_at': None,
            'created_at': datetime.now().isoformat()
        }
        
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([alert_data])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = UUID(sample_overrun_breakdown['project_id'])
        
        # Execute
        alerts = await service.get_variance_alerts(project_id)
        
        # Verify
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.critical
        assert alerts[0].is_acknowledged is False

    @pytest.mark.asyncio
    async def test_acknowledge_variance_alert(self):
        """
        Test acknowledging a variance alert.
        
        **Validates: Requirements 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        updated_alert = {
            'id': str(uuid4()),
            'status': 'acknowledged',
            'acknowledged_by': str(uuid4()),
            'acknowledged_at': datetime.now().isoformat()
        }
        
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_alert])
        
        service = POBreakdownDatabaseService(mock_client)
        alert_id = uuid4()
        user_id = uuid4()
        
        # Execute
        result = await service.acknowledge_variance_alert(alert_id, user_id)
        
        # Verify
        assert result is True

    @pytest.mark.asyncio
    async def test_resolve_variance_alert(self):
        """
        Test resolving a variance alert.
        
        **Validates: Requirements 3.5**
        """
        # Setup mock
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        resolved_alert = {
            'id': str(uuid4()),
            'status': 'resolved',
            'resolved_by': str(uuid4()),
            'resolved_at': datetime.now().isoformat()
        }
        
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([resolved_alert])
        
        service = POBreakdownDatabaseService(mock_client)
        alert_id = uuid4()
        user_id = uuid4()
        
        # Execute
        result = await service.resolve_variance_alert(alert_id, user_id)
        
        # Verify
        assert result is True

    @pytest.mark.asyncio
    async def test_get_variance_alerts_with_filters(self, sample_overrun_breakdown):
        """
        Test retrieving variance alerts with status and severity filters.
        
        **Validates: Requirements 5.6**
        """
        # Setup mock
        mock_client = Mock()
        mock_query = Mock()
        mock_client.table.return_value = mock_query
        
        alert_data = {
            'id': str(uuid4()),
            'project_id': sample_overrun_breakdown['project_id'],
            'wbs_element': sample_overrun_breakdown['id'],
            'variance_amount': '60000.00',
            'variance_percentage': '60.00',
            'severity': 'critical',
            'status': 'active',
            'message': 'Budget exceeded',
            'details': {
                'breakdown_name': 'Test',
                'alert_type': 'budget_exceeded',
                'threshold_exceeded': '50.0',
                'recommended_actions': []
            },
            'created_at': datetime.now().isoformat()
        }
        
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([alert_data])
        
        service = POBreakdownDatabaseService(mock_client)
        project_id = UUID(sample_overrun_breakdown['project_id'])
        
        # Execute with filters
        alerts = await service.get_variance_alerts(
            project_id,
            status='active',
            severity='critical'
        )
        
        # Verify
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.critical


# ============================================================================
# Test Class: Recommendations
# ============================================================================

class TestRecommendations:
    """
    Test recommendation generation functionality.
    
    **Validates: Requirements 3.5**
    """

    def test_generate_recommendations_critical_variance(self):
        """
        Test recommendation generation for critical variance.
        
        **Validates: Requirements 3.5**
        """
        # Setup
        mock_client = Mock()
        service = POBreakdownDatabaseService(mock_client)
        
        variance = VarianceData(
            planned_vs_actual=Decimal('-60000.00'),
            planned_vs_committed=Decimal('-50000.00'),
            committed_vs_actual=Decimal('-10000.00'),
            variance_percentage=Decimal('60.00'),
            variance_status=VarianceStatus.critical_variance,
            trend_direction=TrendDirection.stable,
            last_calculated=datetime.now()
        )
        
        # Execute
        recommendations = service._generate_recommendations(variance, [])
        
        # Verify
        assert len(recommendations) > 0
        assert any(rec.priority == 'high' for rec in recommendations)
        assert any('Critical' in rec.message for rec in recommendations)

    def test_generate_recommendations_favorable_variance(self):
        """
        Test recommendation generation for favorable variance (under budget).
        
        **Validates: Requirements 3.5**
        """
        # Setup
        mock_client = Mock()
        service = POBreakdownDatabaseService(mock_client)
        
        variance = VarianceData(
            planned_vs_actual=Decimal('15000.00'),
            planned_vs_committed=Decimal('10000.00'),
            committed_vs_actual=Decimal('5000.00'),
            variance_percentage=Decimal('-15.00'),  # Under budget
            variance_status=VarianceStatus.minor_variance,
            trend_direction=TrendDirection.stable,
            last_calculated=datetime.now()
        )
        
        # Execute
        recommendations = service._generate_recommendations(variance, [])
        
        # Verify
        assert len(recommendations) > 0
        assert any('Favorable' in rec.message or 'under budget' in rec.message for rec in recommendations)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
