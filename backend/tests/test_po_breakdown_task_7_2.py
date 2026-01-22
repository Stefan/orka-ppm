#!/usr/bin/env python3
"""
Unit tests for Task 7.2: Project-Level Financial Aggregation

Tests automatic project-level variance recalculation triggers and
financial report aggregation with multiple cost source integration.

**Validates: Requirements 5.3, 5.4**
"""

import pytest
import asyncio
from datetime import datetime
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownUpdate,
    POBreakdownType,
    VarianceStatus
)


class MockSupabaseResult:
    """Mock Supabase query result"""
    def __init__(self, data=None, count=None):
        self.data = data or []
        self.count = count or len(self.data)


class MockSupabaseQuery:
    """Mock Supabase query builder"""
    def __init__(self, table_name, mock_data=None):
        self.table_name = table_name
        self.mock_data = mock_data or {}
        self.filters = {}
        self._select_cols = '*'
        self._insert_data = None
        self._update_data = None
        
    def select(self, columns='*', count=None):
        self._select_cols = columns
        return self
    
    def eq(self, column, value):
        self.filters[column] = value
        return self
    
    def in_(self, column, values):
        self.filters[f'{column}_in'] = values
        return self
    
    def order(self, column, desc=False):
        return self
    
    def limit(self, count):
        return self
    
    def insert(self, data):
        self._insert_data = data
        return self
    
    def update(self, data):
        self._update_data = data
        return self
    
    def execute(self):
        """Execute the query and return mock results"""
        if self._insert_data:
            # Return inserted data with generated ID
            result_data = self._insert_data.copy()
            if 'id' not in result_data:
                result_data['id'] = str(uuid4())
            return MockSupabaseResult([result_data])
        
        if self._update_data:
            # Return updated data
            return MockSupabaseResult([self._update_data])
        
        # Return mock data based on table and filters
        table_data = self.mock_data.get(self.table_name, [])
        
        # Apply filters
        filtered_data = table_data
        if 'project_id' in self.filters:
            filtered_data = [
                d for d in filtered_data 
                if d.get('project_id') == self.filters['project_id']
            ]
        
        if 'is_active' in self.filters:
            filtered_data = [
                d for d in filtered_data 
                if d.get('is_active') == self.filters['is_active']
            ]
        
        if 'id' in self.filters:
            filtered_data = [
                d for d in filtered_data 
                if d.get('id') == self.filters['id']
            ]
        
        return MockSupabaseResult(filtered_data)


class MockSupabaseClient:
    """Mock Supabase client for testing"""
    def __init__(self, mock_data=None):
        self.mock_data = mock_data or {}
        
    def table(self, table_name):
        return MockSupabaseQuery(table_name, self.mock_data)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client with test data"""
    project_id = uuid4()
    user_id = uuid4()
    
    mock_data = {
        'po_breakdowns': [
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'name': 'PO Item 1',
                'code': 'PO-001',
                'hierarchy_level': 0,
                'parent_breakdown_id': None,
                'planned_amount': '50000.00',
                'committed_amount': '25000.00',
                'actual_amount': '20000.00',
                'remaining_amount': '30000.00',
                'currency': 'USD',
                'exchange_rate': '1.0',
                'breakdown_type': 'sap_standard',
                'category': 'Development',
                'custom_fields': {},
                'tags': [],
                'version': 1,
                'is_active': True,
                'created_by': str(user_id),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'original_sap_parent_id': None,
                'sap_hierarchy_path': None,
                'has_custom_parent': False
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'name': 'PO Item 2',
                'code': 'PO-002',
                'hierarchy_level': 0,
                'parent_breakdown_id': None,
                'planned_amount': '30000.00',
                'committed_amount': '15000.00',
                'actual_amount': '18000.00',
                'remaining_amount': '12000.00',
                'currency': 'USD',
                'exchange_rate': '1.0',
                'breakdown_type': 'sap_standard',
                'category': 'Testing',
                'custom_fields': {},
                'tags': [],
                'version': 1,
                'is_active': True,
                'created_by': str(user_id),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'original_sap_parent_id': None,
                'sap_hierarchy_path': None,
                'has_custom_parent': False
            }
        ],
        'financial_tracking': [
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'description': 'Direct Cost 1',
                'planned_amount': '10000.00',
                'actual_amount': '12000.00',
                'currency': 'USD',
                'category': 'Materials'
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'description': 'Direct Cost 2',
                'planned_amount': '5000.00',
                'actual_amount': '4500.00',
                'currency': 'USD',
                'category': 'Labor'
            }
        ],
        'change_requests': [
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'title': 'Change Request 1',
                'financial_impact': '8000.00',
                'status': 'approved'
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'title': 'Change Request 2',
                'financial_impact': '5000.00',
                'status': 'pending'
            }
        ],
        'projects': [
            {
                'id': str(project_id),
                'name': 'Test Project',
                'budget': '120000.00',
                'allocated_budget': '95000.00'
            }
        ],
        'variance_alerts': [],
        'po_breakdown_versions': []
    }
    
    return MockSupabaseClient(mock_data), project_id, user_id


class TestProjectLevelVarianceRecalculation:
    """
    Test automatic project-level variance recalculation triggers.
    
    **Validates: Requirement 5.3**
    """
    
    @pytest.mark.asyncio
    async def test_trigger_project_variance_recalculation_basic(self, mock_supabase):
        """
        Test that project-level variance recalculation is triggered correctly.
        
        **Validates: Requirement 5.3**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Mock the methods that will be called
        service.calculate_comprehensive_variance = AsyncMock(return_value={
            'project_id': str(project_id),
            'variance_analysis': {
                'variance_amount': '8000.00',
                'variance_percentage': '10.00',
                'variance_status': 'minor_variance'
            }
        })
        
        service.generate_and_store_variance_alerts = AsyncMock(return_value=[])
        
        # Execute recalculation
        result = await service.trigger_project_variance_recalculation(project_id)
        
        # Verify result structure
        assert result is not None
        assert result['project_id'] == str(project_id)
        assert result['variance_updated'] is True
        assert 'alerts_generated' in result
        assert 'calculation_time_ms' in result
        assert 'timestamp' in result
        assert 'variance_summary' in result
        
        # Verify methods were called
        service.calculate_comprehensive_variance.assert_called_once_with(
            project_id=project_id,
            include_financial_tracking=True
        )
        service.generate_and_store_variance_alerts.assert_called_once_with(project_id)
        
        print("✅ Project variance recalculation triggered successfully")
    
    @pytest.mark.asyncio
    async def test_trigger_recalculation_with_alerts(self, mock_supabase):
        """
        Test that variance alerts are generated during recalculation.
        
        **Validates: Requirement 5.3**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Mock methods
        service.calculate_comprehensive_variance = AsyncMock(return_value={
            'project_id': str(project_id),
            'variance_analysis': {
                'variance_amount': '50000.00',
                'variance_percentage': '60.00',
                'variance_status': 'critical_variance'
            }
        })
        
        # Mock alerts being generated
        from models.po_breakdown import VarianceAlert, VarianceAlertType, AlertSeverity
        mock_alerts = [
            VarianceAlert(
                breakdown_id=uuid4(),
                breakdown_name='Test Item',
                project_id=project_id,
                alert_type=VarianceAlertType.budget_exceeded,
                severity=AlertSeverity.critical,
                threshold_exceeded=Decimal('50.0'),
                current_variance=Decimal('50000.00'),
                current_percentage=Decimal('60.00'),
                message='Budget exceeded',
                recommended_actions=['Review costs'],
                created_at=datetime.now()
            )
        ]
        service.generate_and_store_variance_alerts = AsyncMock(return_value=mock_alerts)
        
        # Execute recalculation
        result = await service.trigger_project_variance_recalculation(project_id)
        
        # Verify alerts were generated
        assert result['alerts_generated'] == 1
        assert result['variance_summary']['variance_status'] == 'critical_variance'
        
        print("✅ Variance alerts generated during recalculation")
    
    @pytest.mark.asyncio
    async def test_schedule_automatic_variance_recalculation(self, mock_supabase):
        """
        Test scheduling automatic variance recalculation on trigger events.
        
        **Validates: Requirement 5.3**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Mock the trigger method
        service.trigger_project_variance_recalculation = AsyncMock(return_value={
            'project_id': str(project_id),
            'variance_updated': True,
            'alerts_generated': 0,
            'calculation_time_ms': 50.0,
            'timestamp': datetime.now().isoformat()
        })
        
        # Test different trigger events
        trigger_events = [
            ('breakdown_created', {'breakdown_id': str(uuid4()), 'name': 'New Item'}),
            ('breakdown_updated', {'breakdown_id': str(uuid4()), 'changes': ['actual_amount']}),
            ('breakdown_deleted', {'breakdown_id': str(uuid4())}),
            ('financial_record_linked', {'breakdown_id': str(uuid4()), 'financial_record_id': str(uuid4())}),
        ]
        
        for event_type, event_data in trigger_events:
            result = await service.schedule_automatic_variance_recalculation(
                project_id=project_id,
                trigger_event=event_type,
                event_data=event_data
            )
            
            assert result is True
            print(f"✅ Recalculation scheduled for event: {event_type}")
        
        # Verify trigger was called for each event
        assert service.trigger_project_variance_recalculation.call_count == len(trigger_events)
    
    @pytest.mark.asyncio
    async def test_recalculation_on_breakdown_create(self, mock_supabase):
        """
        Test that variance recalculation is triggered when creating a breakdown.
        
        **Validates: Requirement 5.3**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Mock the schedule method
        service.schedule_automatic_variance_recalculation = AsyncMock(return_value=True)
        service._create_version_record = AsyncMock()
        service._check_code_exists = AsyncMock(return_value=False)
        
        # Create a breakdown
        breakdown_data = POBreakdownCreate(
            name='New PO Item',
            code='PO-NEW-001',
            planned_amount=Decimal('25000.00'),
            committed_amount=Decimal('10000.00'),
            actual_amount=Decimal('5000.00'),
            currency='USD',
            breakdown_type=POBreakdownType.sap_standard,
            category='Development'
        )
        
        result = await service.create_breakdown(project_id, breakdown_data, user_id)
        
        # Verify recalculation was scheduled
        service.schedule_automatic_variance_recalculation.assert_called_once()
        call_args = service.schedule_automatic_variance_recalculation.call_args
        assert call_args[1]['trigger_event'] == 'breakdown_created'
        
        print("✅ Variance recalculation triggered on breakdown creation")
    
    @pytest.mark.asyncio
    async def test_recalculation_on_breakdown_update(self, mock_supabase):
        """
        Test that variance recalculation is triggered when updating amounts.
        
        **Validates: Requirement 5.3**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Get existing breakdown
        breakdown_id = UUID(mock_client.mock_data['po_breakdowns'][0]['id'])
        breakdown_data = mock_client.mock_data['po_breakdowns'][0]
        
        # Mock methods
        service.schedule_automatic_variance_recalculation = AsyncMock(return_value=True)
        service._create_version_record = AsyncMock()
        service._trigger_variance_recalculation = AsyncMock()
        
        # Mock the update to return complete data
        original_table = mock_client.table
        def mock_table(table_name):
            query = original_table(table_name)
            if table_name == 'po_breakdowns':
                original_update = query.update
                def mock_update(data):
                    query._update_data = {**breakdown_data, **data, 'id': str(breakdown_id)}
                    return query
                query.update = mock_update
            return query
        mock_client.table = mock_table
        
        # Update breakdown amounts
        updates = POBreakdownUpdate(
            actual_amount=Decimal('25000.00')
        )
        
        result = await service.update_breakdown(breakdown_id, updates, user_id)
        
        # Verify recalculation was scheduled
        service.schedule_automatic_variance_recalculation.assert_called_once()
        call_args = service.schedule_automatic_variance_recalculation.call_args
        assert call_args[1]['trigger_event'] == 'breakdown_updated'
        
        print("✅ Variance recalculation triggered on breakdown update")


class TestFinancialReportAggregation:
    """
    Test financial report aggregation with multiple cost sources.
    
    **Validates: Requirement 5.4**
    """
    
    @pytest.mark.asyncio
    async def test_generate_financial_report_basic(self, mock_supabase):
        """
        Test basic financial report generation with all cost sources.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Generate report
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify report structure
        assert report is not None
        assert report['project_id'] == str(project_id)
        assert 'report_date' in report
        assert 'cost_sources' in report
        assert 'aggregated_totals' in report
        assert 'variance_analysis' in report
        assert 'recommendations' in report
        
        # Verify cost sources
        assert 'po_breakdown' in report['cost_sources']
        assert 'financial_tracking' in report['cost_sources']
        assert 'change_requests' in report['cost_sources']
        assert 'budget' in report['cost_sources']
        
        print("✅ Financial report generated with all cost sources")
    
    @pytest.mark.asyncio
    async def test_report_aggregates_po_breakdown_data(self, mock_supabase):
        """
        Test that PO breakdown data is correctly aggregated.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify PO breakdown aggregation
        po_source = report['cost_sources']['po_breakdown']
        assert po_source['item_count'] == 2
        assert Decimal(po_source['planned_amount']) == Decimal('80000.00')
        assert Decimal(po_source['actual_amount']) == Decimal('38000.00')
        
        print("✅ PO breakdown data aggregated correctly")
    
    @pytest.mark.asyncio
    async def test_report_aggregates_financial_tracking_data(self, mock_supabase):
        """
        Test that financial tracking data is correctly aggregated.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify financial tracking aggregation
        ft_source = report['cost_sources']['financial_tracking']
        assert ft_source['record_count'] == 2
        assert Decimal(ft_source['planned_amount']) == Decimal('15000.00')
        assert Decimal(ft_source['actual_amount']) == Decimal('16500.00')
        
        print("✅ Financial tracking data aggregated correctly")
    
    @pytest.mark.asyncio
    async def test_report_aggregates_change_request_data(self, mock_supabase):
        """
        Test that change request data is correctly aggregated.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify change request aggregation
        cr_source = report['cost_sources']['change_requests']
        assert cr_source['request_count'] == 2
        assert Decimal(cr_source['approved_amount']) == Decimal('8000.00')
        assert Decimal(cr_source['pending_amount']) == Decimal('5000.00')
        assert Decimal(cr_source['total_impact']) == Decimal('13000.00')
        
        print("✅ Change request data aggregated correctly")
    
    @pytest.mark.asyncio
    async def test_report_includes_budget_data(self, mock_supabase):
        """
        Test that budget data is included in the report.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify budget data
        budget_source = report['cost_sources']['budget']
        assert Decimal(budget_source['total_budget']) == Decimal('120000.00')
        assert Decimal(budget_source['allocated_budget']) == Decimal('95000.00')
        assert Decimal(budget_source['unallocated_budget']) == Decimal('25000.00')
        
        print("✅ Budget data included in report")
    
    @pytest.mark.asyncio
    async def test_report_calculates_aggregated_totals(self, mock_supabase):
        """
        Test that aggregated totals are calculated correctly.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify aggregated totals
        totals = report['aggregated_totals']
        
        # PO breakdown: 80000 planned, 38000 actual
        # Financial tracking: 15000 planned, 16500 actual
        # Total: 95000 planned, 54500 actual
        assert Decimal(totals['total_planned']) == Decimal('95000.00')
        assert Decimal(totals['total_actual']) == Decimal('54500.00')
        
        # With approved change requests: 95000 + 8000 = 103000
        assert Decimal(totals['total_planned_with_approved_changes']) == Decimal('103000.00')
        
        # Budget utilization: 54500 / 120000 * 100 = 45.42%
        assert Decimal(totals['budget_utilization_pct']) > Decimal('45.00')
        assert Decimal(totals['budget_utilization_pct']) < Decimal('46.00')
        
        print("✅ Aggregated totals calculated correctly")
    
    @pytest.mark.asyncio
    async def test_report_includes_variance_analysis(self, mock_supabase):
        """
        Test that variance analysis is included in the report.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify variance analysis
        variance = report['variance_analysis']
        assert 'variance_amount' in variance
        assert 'variance_percentage' in variance
        assert 'variance_status' in variance
        assert 'over_budget' in variance
        assert 'budget_variance' in variance
        
        # Variance: 54500 - 95000 = -40500 (under budget)
        assert Decimal(variance['variance_amount']) == Decimal('-40500.00')
        assert variance['under_budget'] is True
        assert variance['over_budget'] is False
        
        print("✅ Variance analysis included in report")
    
    @pytest.mark.asyncio
    async def test_report_groups_by_category(self, mock_supabase):
        """
        Test that report includes category breakdown.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify category breakdown
        category_breakdown = report['category_breakdown']
        assert 'Development' in category_breakdown
        assert 'Testing' in category_breakdown
        
        # Check Development category
        dev_cat = category_breakdown['Development']
        assert dev_cat['item_count'] == 1
        assert Decimal(dev_cat['planned_amount']) == Decimal('50000.00')
        assert Decimal(dev_cat['actual_amount']) == Decimal('20000.00')
        
        print("✅ Report grouped by category")
    
    @pytest.mark.asyncio
    async def test_report_groups_by_hierarchy_level(self, mock_supabase):
        """
        Test that report includes hierarchy level breakdown.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify level breakdown
        level_breakdown = report['level_breakdown']
        assert '0' in level_breakdown
        
        # Check level 0
        level_0 = level_breakdown['0']
        assert level_0['item_count'] == 2
        assert Decimal(level_0['planned_amount']) == Decimal('80000.00')
        
        print("✅ Report grouped by hierarchy level")
    
    @pytest.mark.asyncio
    async def test_report_generates_recommendations(self, mock_supabase):
        """
        Test that report includes recommendations based on analysis.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify recommendations
        recommendations = report['recommendations']
        assert isinstance(recommendations, list)
        
        # Should have recommendation about pending change requests
        has_pending_cr_recommendation = any(
            'pending change requests' in rec.lower() 
            for rec in recommendations
        )
        assert has_pending_cr_recommendation
        
        print("✅ Report includes recommendations")
    
    @pytest.mark.asyncio
    async def test_report_with_custom_config(self, mock_supabase):
        """
        Test report generation with custom configuration.
        
        **Validates: Requirement 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Generate report with custom config
        config = {
            'include_financial_tracking': False,
            'include_change_requests': False,
            'group_by_category': False,
            'include_variance_analysis': True
        }
        
        report = await service.generate_financial_report_aggregation(
            project_id, 
            report_config=config
        )
        
        # Verify config was applied
        assert 'po_breakdown' in report['data_sources_included']
        assert 'financial_tracking' not in report['data_sources_included']
        assert 'change_requests' not in report['data_sources_included']
        assert report['category_breakdown'] == {}
        assert report['variance_analysis'] != {}
        
        print("✅ Report generated with custom configuration")


class TestIntegrationScenarios:
    """
    Test integration scenarios combining multiple features.
    
    **Validates: Requirements 5.3, 5.4**
    """
    
    @pytest.mark.asyncio
    async def test_end_to_end_financial_workflow(self, mock_supabase):
        """
        Test complete workflow: create breakdown -> update amounts -> generate report.
        
        **Validates: Requirements 5.3, 5.4**
        """
        mock_client, project_id, user_id = mock_supabase
        service = POBreakdownDatabaseService(mock_client)
        
        # Mock methods
        service.schedule_automatic_variance_recalculation = AsyncMock(return_value=True)
        service._create_version_record = AsyncMock()
        service._check_code_exists = AsyncMock(return_value=False)
        
        # 1. Create a new breakdown
        breakdown_data = POBreakdownCreate(
            name='Integration Test Item',
            code='INT-001',
            planned_amount=Decimal('10000.00'),
            committed_amount=Decimal('5000.00'),
            actual_amount=Decimal('3000.00'),
            currency='USD',
            breakdown_type=POBreakdownType.sap_standard,
            category='Integration'
        )
        
        created = await service.create_breakdown(project_id, breakdown_data, user_id)
        assert created is not None
        
        # Verify recalculation was triggered
        assert service.schedule_automatic_variance_recalculation.call_count >= 1
        
        # 2. Generate financial report
        report = await service.generate_financial_report_aggregation(project_id)
        
        # Verify report includes all data
        assert report is not None
        assert len(report['cost_sources']) >= 2
        assert report['aggregated_totals']['total_planned'] is not None
        
        print("✅ End-to-end financial workflow completed successfully")


def run_tests():
    """Run all tests"""
    print("\n" + "="*80)
    print("🧪 Running Task 7.2 Tests: Project-Level Financial Aggregation")
    print("="*80 + "\n")
    
    # Run pytest
    pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '--asyncio-mode=auto'
    ])


if __name__ == '__main__':
    run_tests()
