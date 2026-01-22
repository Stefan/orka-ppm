"""
Unit Tests for PO Breakdown Financial Tracking Integration

This module contains comprehensive unit tests for the integration between
PO breakdown management and existing financial tracking systems.

Task: 7.1 Create integration with existing financial tracking
**Validates: Requirements 5.1, 5.2**

Tests Implemented:
- Link PO breakdowns to financial tracking records
- Unlink PO breakdowns from financial tracking records
- Get linked financial records
- Calculate comprehensive variance including both data sources
- Sync financial tracking records to PO breakdown structure
- Prevent double-counting of linked records
- Handle cross-system data aggregation
"""

import pytest
from decimal import Decimal
from datetime import datetime, date
from typing import Dict, Any, List
from uuid import UUID, uuid4
from unittest.mock import Mock, MagicMock, AsyncMock, patch
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownType,
    VarianceStatus,
)
from services.po_breakdown_service import POBreakdownDatabaseService


# ============================================================================
# Test Fixtures
# ============================================================================


class MockSupabaseResponse:
    """Mock Supabase response object."""
    def __init__(self, data: List[Dict[str, Any]], count: Optional[int] = None):
        self.data = data
        self.count = count if count is not None else len(data)


class MockSupabaseQuery:
    """Mock Supabase query builder."""
    def __init__(self, data: List[Dict[str, Any]] = None, table_name: str = None):
        self._data = data or []
        self._filters = {}
        self._table_name = table_name
    
    def select(self, *args, **kwargs):
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
    
    def in_(self, field, values):
        # Filter data based on 'in' condition
        if self._data:
            self._data = [d for d in self._data if d.get(field) in values]
        return self
    
    def execute(self):
        return MockSupabaseResponse(self._data)
    
    def range(self, start, end):
        return self


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    client = Mock()
    client.table = Mock()
    return client


@pytest.fixture
def service(mock_supabase):
    """Create a POBreakdownDatabaseService instance with mock client."""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def test_project_id():
    """Generate a test project ID."""
    return uuid4()


@pytest.fixture
def test_user_id():
    """Generate a test user ID."""
    return uuid4()


@pytest.fixture
def sample_breakdown_data(test_project_id):
    """Create sample breakdown data."""
    return {
        'id': str(uuid4()),
        'project_id': str(test_project_id),
        'name': 'Test Breakdown',
        'code': 'TEST-001',
        'hierarchy_level': 0,
        'parent_breakdown_id': None,
        'planned_amount': '10000.00',
        'committed_amount': '8000.00',
        'actual_amount': '7500.00',
        'remaining_amount': '2500.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'custom_fields': {},
        'tags': [],
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


@pytest.fixture
def sample_financial_record(test_project_id):
    """Create sample financial tracking record."""
    return {
        'id': str(uuid4()),
        'project_id': str(test_project_id),
        'category': 'Labor',
        'description': 'Engineering costs',
        'planned_amount': '5000.00',
        'actual_amount': '4800.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'date_incurred': date.today().isoformat(),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


# ============================================================================
# Test Financial Record Linking
# ============================================================================


class TestFinancialRecordLinking:
    """
    Test linking PO breakdowns to financial tracking records.
    
    **Validates: Requirements 5.1**
    """
    
    @pytest.mark.asyncio
    async def test_link_to_financial_record_success(
        self,
        service,
        mock_supabase,
        sample_breakdown_data,
        sample_financial_record,
        test_user_id
    ):
        """Test successfully linking a breakdown to a financial record."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = UUID(sample_financial_record['id'])
        
        # Mock get_breakdown_by_id
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            # Mock financial record lookup
            financial_query = MockSupabaseQuery([sample_financial_record])
            mock_supabase.table.return_value = financial_query
            
            # Mock update
            updated_data = sample_breakdown_data.copy()
            updated_data['custom_fields'] = {'financial_links': [str(financial_id)]}
            update_query = MockSupabaseQuery([updated_data])
            
            # Mock version record creation
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                # Setup table mock to return different queries
                def table_side_effect(table_name):
                    if table_name == 'financial_tracking':
                        return financial_query
                    elif table_name == 'po_breakdowns':
                        return update_query
                    elif table_name == 'po_breakdown_versions':
                        return MockSupabaseQuery([])
                    return MockSupabaseQuery([])
                
                mock_supabase.table.side_effect = table_side_effect
                
                # Execute link
                result = await service.link_to_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
                
                assert result is True
    
    @pytest.mark.asyncio
    async def test_link_to_financial_record_breakdown_not_found(
        self,
        service,
        test_user_id
    ):
        """Test linking fails when breakdown doesn't exist."""
        breakdown_id = uuid4()
        financial_id = uuid4()
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None
            
            with pytest.raises(ValueError, match="Breakdown .* not found"):
                await service.link_to_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
    
    @pytest.mark.asyncio
    async def test_link_to_financial_record_financial_not_found(
        self,
        service,
        mock_supabase,
        sample_breakdown_data,
        test_user_id
    ):
        """Test linking fails when financial record doesn't exist."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = uuid4()
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            # Mock empty financial record lookup
            financial_query = MockSupabaseQuery([])
            mock_supabase.table.return_value = financial_query
            
            with pytest.raises(ValueError, match="Financial record .* not found"):
                await service.link_to_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
    
    @pytest.mark.asyncio
    async def test_link_to_financial_record_different_projects(
        self,
        service,
        mock_supabase,
        sample_breakdown_data,
        sample_financial_record,
        test_user_id
    ):
        """Test linking fails when breakdown and financial record are in different projects."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = UUID(sample_financial_record['id'])
        
        # Change financial record to different project
        different_financial = sample_financial_record.copy()
        different_financial['project_id'] = str(uuid4())
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            financial_query = MockSupabaseQuery([different_financial])
            mock_supabase.table.return_value = financial_query
            
            with pytest.raises(ValueError, match="same project"):
                await service.link_to_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
    
    @pytest.mark.asyncio
    async def test_unlink_from_financial_record_success(
        self,
        service,
        mock_supabase,
        sample_breakdown_data,
        test_user_id
    ):
        """Test successfully unlinking a breakdown from a financial record."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = uuid4()
        
        # Add financial link to breakdown
        sample_breakdown_data['custom_fields'] = {'financial_links': [str(financial_id)]}
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            # Mock update
            updated_data = sample_breakdown_data.copy()
            updated_data['custom_fields'] = {'financial_links': []}
            update_query = MockSupabaseQuery([updated_data])
            mock_supabase.table.return_value = update_query
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.unlink_from_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
                
                assert result is True
    
    @pytest.mark.asyncio
    async def test_get_linked_financial_records_success(
        self,
        service,
        mock_supabase,
        sample_breakdown_data,
        sample_financial_record
    ):
        """Test retrieving linked financial records."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = UUID(sample_financial_record['id'])
        
        # Add financial link to breakdown
        sample_breakdown_data['custom_fields'] = {'financial_links': [str(financial_id)]}
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            # Mock financial records lookup
            financial_query = MockSupabaseQuery([sample_financial_record])
            mock_supabase.table.return_value = financial_query
            
            records = await service.get_linked_financial_records(breakdown_id)
            
            assert len(records) == 1
            assert records[0]['id'] == str(financial_id)
    
    @pytest.mark.asyncio
    async def test_get_linked_financial_records_no_links(
        self,
        service,
        sample_breakdown_data
    ):
        """Test retrieving linked financial records when there are none."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            records = await service.get_linked_financial_records(breakdown_id)
            
            assert len(records) == 0


# ============================================================================
# Test Comprehensive Variance Calculation
# ============================================================================


class TestComprehensiveVarianceCalculation:
    """
    Test comprehensive variance calculation including both PO breakdown
    and financial tracking data.
    
    **Validates: Requirements 5.2**
    """
    
    @pytest.mark.asyncio
    async def test_calculate_comprehensive_variance_po_only(
        self,
        service,
        mock_supabase,
        test_project_id,
        sample_breakdown_data
    ):
        """Test variance calculation with only PO breakdown data."""
        # Mock PO breakdown query
        po_query = MockSupabaseQuery([sample_breakdown_data])
        mock_supabase.table.return_value = po_query
        
        result = await service.calculate_comprehensive_variance(
            test_project_id,
            include_financial_tracking=False
        )
        
        assert result['project_id'] == str(test_project_id)
        assert 'po_breakdown_totals' in result
        assert 'combined_totals' in result
        assert 'variance_analysis' in result
        assert result['data_sources'] == ['po_breakdown']
        
        # Verify PO totals
        po_totals = result['po_breakdown_totals']
        assert Decimal(po_totals['planned_amount']) == Decimal('10000.00')
        assert Decimal(po_totals['actual_amount']) == Decimal('7500.00')
    
    @pytest.mark.asyncio
    async def test_calculate_comprehensive_variance_with_financial_tracking(
        self,
        service,
        mock_supabase,
        test_project_id,
        sample_breakdown_data,
        sample_financial_record
    ):
        """Test variance calculation including financial tracking data."""
        # Setup mock to return different data for different tables
        def table_side_effect(table_name):
            if table_name == 'po_breakdowns':
                return MockSupabaseQuery([sample_breakdown_data], table_name)
            elif table_name == 'financial_tracking':
                return MockSupabaseQuery([sample_financial_record], table_name)
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect
        
        result = await service.calculate_comprehensive_variance(
            test_project_id,
            include_financial_tracking=True
        )
        
        assert result['project_id'] == str(test_project_id)
        assert 'financial_tracking' in result['data_sources']
        
        # Verify combined totals include both sources
        combined = result['combined_totals']
        expected_planned = Decimal('10000.00') + Decimal('5000.00')  # PO + Financial
        expected_actual = Decimal('7500.00') + Decimal('4800.00')
        
        assert Decimal(combined['planned_amount']) == expected_planned
        assert Decimal(combined['actual_amount']) == expected_actual
    
    @pytest.mark.asyncio
    async def test_calculate_comprehensive_variance_prevents_double_counting(
        self,
        service,
        mock_supabase,
        test_project_id,
        sample_breakdown_data,
        sample_financial_record
    ):
        """Test that linked financial records are not double-counted."""
        financial_id = sample_financial_record['id']
        
        # Link financial record to breakdown
        sample_breakdown_data['custom_fields'] = {'financial_links': [financial_id]}
        
        def table_side_effect(table_name):
            if table_name == 'po_breakdowns':
                return MockSupabaseQuery([sample_breakdown_data], table_name)
            elif table_name == 'financial_tracking':
                return MockSupabaseQuery([sample_financial_record], table_name)
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect
        
        result = await service.calculate_comprehensive_variance(
            test_project_id,
            include_financial_tracking=True
        )
        
        # Financial tracking totals should be zero since record is linked
        ft_totals = result['financial_tracking_totals']
        assert Decimal(ft_totals['planned_amount']) == Decimal('0')
        assert Decimal(ft_totals['actual_amount']) == Decimal('0')
        assert ft_totals['linked_record_count'] == 1
        
        # Combined totals should only include PO breakdown amounts
        combined = result['combined_totals']
        assert Decimal(combined['planned_amount']) == Decimal('10000.00')
        assert Decimal(combined['actual_amount']) == Decimal('7500.00')
    
    @pytest.mark.asyncio
    async def test_calculate_comprehensive_variance_status_determination(
        self,
        service,
        mock_supabase,
        test_project_id
    ):
        """Test variance status determination based on thresholds."""
        # Create breakdown with critical variance (>50%)
        critical_breakdown = {
            'id': str(uuid4()),
            'project_id': str(test_project_id),
            'name': 'Critical Variance Item',
            'planned_amount': '10000.00',
            'committed_amount': '0.00',
            'actual_amount': '16000.00',  # 60% over budget
            'remaining_amount': '-6000.00',
            'custom_fields': {},
            'is_active': True,
        }
        
        po_query = MockSupabaseQuery([critical_breakdown])
        mock_supabase.table.return_value = po_query
        
        result = await service.calculate_comprehensive_variance(
            test_project_id,
            include_financial_tracking=False
        )
        
        variance_analysis = result['variance_analysis']
        assert variance_analysis['variance_status'] == 'critical_variance'
        assert variance_analysis['over_budget'] is True
        assert Decimal(variance_analysis['variance_percentage']) == Decimal('60.00')


# ============================================================================
# Test Financial Tracking Sync
# ============================================================================


class TestFinancialTrackingSync:
    """
    Test syncing financial tracking records to PO breakdown structure.
    
    **Validates: Requirements 5.1, 5.4**
    """
    
    @pytest.mark.asyncio
    async def test_sync_financial_tracking_to_breakdown_success(
        self,
        service,
        mock_supabase,
        test_project_id,
        test_user_id,
        sample_financial_record
    ):
        """Test successfully syncing financial records to breakdowns."""
        # Mock financial tracking query
        financial_query = MockSupabaseQuery([sample_financial_record])
        
        # Mock PO breakdown query (empty - no existing breakdowns)
        po_query = MockSupabaseQuery([])
        
        def table_side_effect(table_name):
            if table_name == 'financial_tracking':
                return financial_query
            elif table_name == 'po_breakdowns':
                return po_query
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect
        
        # Mock create_breakdown
        with patch.object(service, 'create_breakdown', new_callable=AsyncMock) as mock_create:
            created_breakdown = POBreakdownResponse(
                id=uuid4(),
                project_id=test_project_id,
                name=sample_financial_record['description'],
                code=None,
                sap_po_number=None,
                sap_line_item=None,
                hierarchy_level=0,
                parent_breakdown_id=None,
                cost_center=None,
                gl_account=None,
                planned_amount=Decimal(sample_financial_record['planned_amount']),
                committed_amount=Decimal('0'),
                actual_amount=Decimal(sample_financial_record['actual_amount']),
                remaining_amount=Decimal('200.00'),
                currency='USD',
                exchange_rate=Decimal('1.0'),
                breakdown_type=POBreakdownType.custom_hierarchy,
                category=sample_financial_record['category'],
                subcategory=None,
                custom_fields={'financial_links': [sample_financial_record['id']]},
                tags=[],
                notes=f"Synced from financial tracking record {sample_financial_record['id']}",
                import_batch_id=None,
                import_source=None,
                version=1,
                is_active=True,
                created_by=test_user_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            mock_create.return_value = created_breakdown
            
            result = await service.sync_financial_tracking_to_breakdown(
                test_project_id,
                user_id=test_user_id
            )
            
            assert result['synced_count'] == 1
            assert len(result['created_breakdowns']) == 1
            assert result['skipped_count'] == 0
            assert len(result['errors']) == 0
    
    @pytest.mark.asyncio
    async def test_sync_financial_tracking_skips_linked_records(
        self,
        service,
        mock_supabase,
        test_project_id,
        test_user_id,
        sample_financial_record,
        sample_breakdown_data
    ):
        """Test that sync skips already-linked financial records."""
        financial_id = sample_financial_record['id']
        
        # Link financial record to existing breakdown
        sample_breakdown_data['custom_fields'] = {'financial_links': [financial_id]}
        
        financial_query = MockSupabaseQuery([sample_financial_record])
        po_query = MockSupabaseQuery([sample_breakdown_data])
        
        def table_side_effect(table_name):
            if table_name == 'financial_tracking':
                return financial_query
            elif table_name == 'po_breakdowns':
                return po_query
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect
        
        result = await service.sync_financial_tracking_to_breakdown(
            test_project_id,
            user_id=test_user_id
        )
        
        assert result['synced_count'] == 0
        assert result['skipped_count'] == 1
    
    @pytest.mark.asyncio
    async def test_sync_financial_tracking_with_category_mapping(
        self,
        service,
        mock_supabase,
        test_project_id,
        test_user_id,
        sample_financial_record
    ):
        """Test syncing with category mapping."""
        category_mapping = {
            'Labor': 'Engineering Labor',
            'Materials': 'Construction Materials'
        }
        
        financial_query = MockSupabaseQuery([sample_financial_record])
        po_query = MockSupabaseQuery([])
        
        def table_side_effect(table_name):
            if table_name == 'financial_tracking':
                return financial_query
            elif table_name == 'po_breakdowns':
                return po_query
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect
        
        with patch.object(service, 'create_breakdown', new_callable=AsyncMock) as mock_create:
            # Verify category mapping is applied
            async def verify_category(project_id, breakdown_data, user_id):
                assert breakdown_data.category == 'Engineering Labor'
                return POBreakdownResponse(
                    id=uuid4(),
                    project_id=project_id,
                    name=breakdown_data.name,
                    code=None,
                    sap_po_number=None,
                    sap_line_item=None,
                    hierarchy_level=0,
                    parent_breakdown_id=None,
                    cost_center=None,
                    gl_account=None,
                    planned_amount=breakdown_data.planned_amount,
                    committed_amount=breakdown_data.committed_amount,
                    actual_amount=breakdown_data.actual_amount,
                    remaining_amount=Decimal('0'),
                    currency=breakdown_data.currency,
                    exchange_rate=Decimal('1.0'),
                    breakdown_type=breakdown_data.breakdown_type,
                    category=breakdown_data.category,
                    subcategory=None,
                    custom_fields=breakdown_data.custom_fields,
                    tags=breakdown_data.tags,
                    notes=breakdown_data.notes,
                    import_batch_id=None,
                    import_source=None,
                    version=1,
                    is_active=True,
                    created_by=user_id,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
            
            mock_create.side_effect = verify_category
            
            result = await service.sync_financial_tracking_to_breakdown(
                test_project_id,
                category_mapping=category_mapping,
                user_id=test_user_id
            )
            
            assert result['synced_count'] == 1


# ============================================================================
# Integration Tests
# ============================================================================


class TestFinancialIntegrationEndToEnd:
    """
    End-to-end integration tests for financial tracking integration.
    
    **Validates: Requirements 5.1, 5.2**
    """
    
    @pytest.mark.asyncio
    async def test_complete_financial_integration_workflow(
        self,
        service,
        mock_supabase,
        test_project_id,
        test_user_id,
        sample_breakdown_data,
        sample_financial_record
    ):
        """Test complete workflow: link, calculate variance, unlink."""
        breakdown_id = UUID(sample_breakdown_data['id'])
        financial_id = UUID(sample_financial_record['id'])
        
        # Step 1: Link financial record to breakdown
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            financial_query = MockSupabaseQuery([sample_financial_record])
            updated_data = sample_breakdown_data.copy()
            updated_data['custom_fields'] = {'financial_links': [str(financial_id)]}
            update_query = MockSupabaseQuery([updated_data])
            
            def table_side_effect(table_name):
                if table_name == 'financial_tracking':
                    return financial_query
                elif table_name == 'po_breakdowns':
                    return update_query
                return MockSupabaseQuery([])
            
            mock_supabase.table.side_effect = table_side_effect
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                link_result = await service.link_to_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
                assert link_result is True
        
        # Step 2: Calculate comprehensive variance
        sample_breakdown_data['custom_fields'] = {'financial_links': [str(financial_id)]}
        
        def table_side_effect_variance(table_name):
            if table_name == 'po_breakdowns':
                return MockSupabaseQuery([sample_breakdown_data])
            elif table_name == 'financial_tracking':
                return MockSupabaseQuery([sample_financial_record])
            return MockSupabaseQuery([])
        
        mock_supabase.table.side_effect = table_side_effect_variance
        
        variance_result = await service.calculate_comprehensive_variance(
            test_project_id,
            include_financial_tracking=True
        )
        
        # Verify no double-counting
        ft_totals = variance_result['financial_tracking_totals']
        assert ft_totals['linked_record_count'] == 1
        
        # Step 3: Unlink financial record
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(sample_breakdown_data)
            
            unlinked_data = sample_breakdown_data.copy()
            unlinked_data['custom_fields'] = {'financial_links': []}
            unlink_query = MockSupabaseQuery([unlinked_data])
            mock_supabase.table.return_value = unlink_query
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                unlink_result = await service.unlink_from_financial_record(
                    breakdown_id, financial_id, test_user_id
                )
                assert unlink_result is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
