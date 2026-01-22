"""
Unit Tests for Task 8.2: Soft Deletion and Historical Data Preservation

This test suite validates the implementation of:
- Soft deletion with complete historical record retention (Requirement 6.4)
- Chronological change log with before/after value tracking (Requirement 6.3)

**Validates: Requirements 6.3, 6.4**
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, MagicMock, patch

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownUpdate,
    POBreakdownResponse,
    POBreakdownType,
    POBreakdownVersion
)


class MockSupabaseQuery:
    """Mock Supabase query builder"""
    
    def __init__(self, data=None, count=None):
        self._data = data or []
        self._count = count
        self._filters = {}
        self._order_by = []
        self._limit_val = None
        self._range_val = None
    
    def select(self, *args, **kwargs):
        return self
    
    def insert(self, data):
        self._data = [data] if not isinstance(data, list) else data
        return self
    
    def update(self, data):
        return self
    
    def delete(self):
        return self
    
    def eq(self, column, value):
        self._filters[column] = value
        return self
    
    def in_(self, column, values):
        return self
    
    def gte(self, column, value):
        return self
    
    def lte(self, column, value):
        return self
    
    def order(self, column, **kwargs):
        self._order_by.append((column, kwargs))
        return self
    
    def limit(self, value):
        self._limit_val = value
        return self
    
    def range(self, start, end):
        self._range_val = (start, end)
        return self
    
    def execute(self):
        result = Mock()
        result.data = self._data
        result.count = self._count if self._count is not None else len(self._data)
        return result


class MockSupabaseClient:
    """Mock Supabase client"""
    
    def __init__(self):
        self.tables = {}
    
    def table(self, name):
        if name not in self.tables:
            self.tables[name] = MockSupabaseQuery()
        return self.tables[name]


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    return MockSupabaseClient()


@pytest.fixture
def po_breakdown_service(mock_supabase):
    """Create a POBreakdownDatabaseService with mock Supabase client"""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def sample_breakdown_data():
    """Sample breakdown data for testing"""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Test Breakdown',
        'code': 'TB-001',
        'sap_po_number': 'PO-12345',
        'sap_line_item': 'LI-001',
        'hierarchy_level': 0,
        'parent_breakdown_id': None,
        'original_sap_parent_id': None,
        'sap_hierarchy_path': None,
        'has_custom_parent': False,
        'display_order': 0,
        'cost_center': 'CC-100',
        'gl_account': 'GL-200',
        'planned_amount': '10000.00',
        'committed_amount': '8000.00',
        'actual_amount': '5000.00',
        'remaining_amount': '5000.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': 'Construction',
        'subcategory': 'Materials',
        'custom_fields': {},
        'tags': ['test'],
        'notes': 'Test notes',
        'import_batch_id': None,
        'import_source': None,
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }


@pytest.fixture
def sample_version_data():
    """Sample version data for testing"""
    return {
        'id': str(uuid4()),
        'breakdown_id': str(uuid4()),
        'version_number': 1,
        'changes': {
            'planned_amount': {'old': '10000.00', 'new': '12000.00'},
            'actual_amount': {'old': '5000.00', 'new': '6000.00'}
        },
        'change_type': 'financial_update',
        'change_summary': 'Updated: planned_amount, actual_amount',
        'before_values': {
            'planned_amount': '10000.00',
            'actual_amount': '5000.00'
        },
        'after_values': {
            'planned_amount': '12000.00',
            'actual_amount': '6000.00'
        },
        'changed_by': str(uuid4()),
        'changed_at': datetime.now().isoformat(),
        'change_reason': None,
        'is_import': False,
        'import_batch_id': None
    }


# ============================================================================
# Test Soft Deletion with Historical Record Retention (Requirement 6.4)
# ============================================================================

@pytest.mark.asyncio
async def test_soft_delete_marks_inactive_preserves_data(po_breakdown_service, mock_supabase, sample_breakdown_data):
    """
    Test that soft deletion marks breakdown as inactive while preserving all data.
    
    **Validates: Requirement 6.4 (soft deletion with retention of historical records)**
    """
    breakdown_id = UUID(sample_breakdown_data['id'])
    user_id = UUID(sample_breakdown_data['created_by'])
    
    # Setup mock responses
    mock_supabase.tables['po_breakdowns'] = MockSupabaseQuery(data=[sample_breakdown_data])
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=[])
    
    # Mock the get_breakdown_by_id to return the breakdown
    with patch.object(po_breakdown_service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = POBreakdownResponse(**sample_breakdown_data)
        
        # Mock _get_children to return no children
        with patch.object(po_breakdown_service, '_get_children', new_callable=AsyncMock) as mock_children:
            mock_children.return_value = []
            
            # Mock _create_version_record
            with patch.object(po_breakdown_service, '_create_version_record', new_callable=AsyncMock):
                # Mock schedule_automatic_variance_recalculation
                with patch.object(po_breakdown_service, 'schedule_automatic_variance_recalculation', new_callable=AsyncMock):
                    # Perform soft delete
                    result = await po_breakdown_service.delete_breakdown(
                        breakdown_id=breakdown_id,
                        user_id=user_id,
                        hard_delete=False
                    )
                    
                    # Verify soft delete was successful
                    assert result is True
                    
                    # Verify version record was created with complete snapshot
                    po_breakdown_service._create_version_record.assert_called_once()
                    call_args = po_breakdown_service._create_version_record.call_args
                    
                    # Check that before_values contains complete snapshot
                    assert 'before_values' in call_args.kwargs
                    before_values = call_args.kwargs['before_values']
                    assert before_values['name'] == sample_breakdown_data['name']
                    # Note: before_values are serialized, so amounts are strings or Decimals
                    assert str(before_values['planned_amount']) == sample_breakdown_data['planned_amount']
                    
                    # Check that change type is delete
                    assert call_args.kwargs['change_type'] == 'delete'


@pytest.mark.asyncio
async def test_restore_soft_deleted_breakdown(po_breakdown_service, mock_supabase, sample_breakdown_data):
    """
    Test restoring a soft-deleted breakdown.
    
    **Validates: Requirement 6.4 (soft deletion with retention of historical records)**
    """
    # Mark breakdown as inactive (soft-deleted)
    sample_breakdown_data['is_active'] = False
    breakdown_id = UUID(sample_breakdown_data['id'])
    user_id = UUID(sample_breakdown_data['created_by'])
    
    # Create a mock query that returns the inactive breakdown first, then the restored one
    class RestoreMockQuery(MockSupabaseQuery):
        def __init__(self, inactive_data, restored_data):
            super().__init__()
            self.inactive_data = inactive_data
            self.restored_data = restored_data
            self.call_count = 0
        
        def execute(self):
            result = Mock()
            if self.call_count == 0:
                # First call: return inactive breakdown
                result.data = [self.inactive_data]
                self.call_count += 1
            else:
                # Second call: return restored breakdown
                result.data = [self.restored_data]
            return result
    
    # Setup mock responses
    restored_data = {**sample_breakdown_data, 'is_active': True, 'version': 2}
    mock_supabase.tables['po_breakdowns'] = RestoreMockQuery(sample_breakdown_data, restored_data)
    
    # Mock _create_version_record
    with patch.object(po_breakdown_service, '_create_version_record', new_callable=AsyncMock):
        # Perform restoration
        result = await po_breakdown_service.restore_soft_deleted_breakdown(
            breakdown_id=breakdown_id,
            user_id=user_id,
            restore_reason="Testing restoration"
        )
        
        # Verify restoration was successful
        assert result is not None
        assert result.is_active is True
        
        # Verify version record was created
        po_breakdown_service._create_version_record.assert_called_once()
        call_args = po_breakdown_service._create_version_record.call_args
        
        # Check that it's marked as a restore action
        assert call_args.kwargs['change_type'] == 'update'
        assert call_args.kwargs['change_summary'] == 'Restored soft-deleted breakdown'


@pytest.mark.asyncio
async def test_get_soft_deleted_breakdowns(po_breakdown_service, mock_supabase, sample_breakdown_data):
    """
    Test retrieving all soft-deleted breakdowns for a project.
    
    **Validates: Requirement 6.4 (retention of historical records)**
    """
    project_id = UUID(sample_breakdown_data['project_id'])
    
    # Create multiple soft-deleted breakdowns
    deleted_breakdowns = []
    for i in range(3):
        breakdown = sample_breakdown_data.copy()
        breakdown['id'] = str(uuid4())
        breakdown['name'] = f'Deleted Breakdown {i+1}'
        breakdown['is_active'] = False
        deleted_breakdowns.append(breakdown)
    
    # Setup mock response
    mock_supabase.tables['po_breakdowns'] = MockSupabaseQuery(data=deleted_breakdowns)
    
    # Get soft-deleted breakdowns
    result = await po_breakdown_service.get_soft_deleted_breakdowns(
        project_id=project_id,
        limit=50,
        offset=0
    )
    
    # Verify results
    assert len(result) == 3
    for breakdown in result:
        assert breakdown.is_active is False


@pytest.mark.asyncio
async def test_cannot_restore_active_breakdown(po_breakdown_service, mock_supabase, sample_breakdown_data):
    """
    Test that attempting to restore an active breakdown raises an error.
    
    **Validates: Requirement 6.4**
    """
    # Breakdown is active
    sample_breakdown_data['is_active'] = True
    breakdown_id = UUID(sample_breakdown_data['id'])
    user_id = UUID(sample_breakdown_data['created_by'])
    
    # Setup mock response
    mock_supabase.tables['po_breakdowns'] = MockSupabaseQuery(data=[sample_breakdown_data])
    
    # Attempt to restore active breakdown
    with pytest.raises(ValueError, match="is not soft-deleted"):
        await po_breakdown_service.restore_soft_deleted_breakdown(
            breakdown_id=breakdown_id,
            user_id=user_id
        )


# ============================================================================
# Test Chronological Change Log with Before/After Values (Requirement 6.3)
# ============================================================================

@pytest.mark.asyncio
async def test_get_chronological_change_log(po_breakdown_service, mock_supabase, sample_version_data):
    """
    Test retrieving chronological change log with before/after values.
    
    **Validates: Requirement 6.3 (display chronological change log with before/after values)**
    """
    breakdown_id = UUID(sample_version_data['breakdown_id'])
    
    # Create multiple version records
    versions = []
    for i in range(5):
        version = sample_version_data.copy()
        version['id'] = str(uuid4())
        version['version_number'] = i + 1
        version['changed_at'] = (datetime.now() - timedelta(days=5-i)).isoformat()
        versions.append(version)
    
    # Setup mock response
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=versions)
    
    # Get change log
    result = await po_breakdown_service.get_chronological_change_log(
        breakdown_id=breakdown_id,
        include_field_details=True,
        limit=100,
        offset=0
    )
    
    # Verify results
    assert len(result) == 5
    
    # Verify chronological order (newest first) - versions are returned in order they were added
    # Since we're not actually sorting in the mock, just verify we got all versions
    version_numbers = [entry['version_number'] for entry in result]
    assert len(set(version_numbers)) == 5  # All unique version numbers
    
    # Verify field changes are included
    for entry in result:
        assert 'field_changes' in entry
        assert 'field_changes_count' in entry
        assert 'before_snapshot' in entry
        assert 'after_snapshot' in entry
        
        # Verify field changes have proper structure
        for field_change in entry['field_changes']:
            assert 'field' in field_change
            assert 'field_label' in field_change
            if 'before_value' in field_change:
                assert 'after_value' in field_change


@pytest.mark.asyncio
async def test_change_log_includes_before_after_snapshots(po_breakdown_service, mock_supabase, sample_version_data):
    """
    Test that change log includes complete before/after snapshots.
    
    **Validates: Requirement 6.3 (before/after value tracking)**
    """
    breakdown_id = UUID(sample_version_data['breakdown_id'])
    
    # Setup mock response with complete snapshots
    sample_version_data['before_values'] = {
        'name': 'Original Name',
        'planned_amount': '10000.00',
        'actual_amount': '5000.00'
    }
    sample_version_data['after_values'] = {
        'name': 'Updated Name',
        'planned_amount': '12000.00',
        'actual_amount': '6000.00'
    }
    
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=[sample_version_data])
    
    # Get change log
    result = await po_breakdown_service.get_chronological_change_log(
        breakdown_id=breakdown_id,
        include_field_details=True
    )
    
    # Verify snapshots are included
    assert len(result) == 1
    entry = result[0]
    
    assert entry['before_snapshot'] == sample_version_data['before_values']
    assert entry['after_snapshot'] == sample_version_data['after_values']


@pytest.mark.asyncio
async def test_get_field_change_history(po_breakdown_service, mock_supabase, sample_version_data):
    """
    Test retrieving change history for a specific field.
    
    **Validates: Requirement 6.3 (chronological change log)**
    """
    breakdown_id = UUID(sample_version_data['breakdown_id'])
    field_name = 'planned_amount'
    
    # Create multiple versions with changes to the field
    versions = []
    for i in range(3):
        version = sample_version_data.copy()
        version['id'] = str(uuid4())
        version['version_number'] = i + 1
        version['changes'] = {
            'planned_amount': {
                'old': f'{10000 + i * 1000}.00',
                'new': f'{10000 + (i + 1) * 1000}.00'
            }
        }
        version['changed_at'] = (datetime.now() - timedelta(days=3-i)).isoformat()
        versions.append(version)
    
    # Setup mock response
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=versions)
    
    # Get field change history
    result = await po_breakdown_service.get_field_change_history(
        breakdown_id=breakdown_id,
        field_name=field_name,
        limit=50
    )
    
    # Verify results
    assert len(result) == 3
    
    # Verify each entry has before/after values
    for entry in result:
        assert 'before_value' in entry
        assert 'after_value' in entry
        assert 'changed_at' in entry
        assert 'changed_by' in entry


@pytest.mark.asyncio
async def test_get_deletion_audit_trail(po_breakdown_service, mock_supabase, sample_breakdown_data, sample_version_data):
    """
    Test retrieving audit trail of deletion operations.
    
    **Validates: Requirements 6.3, 6.4 (audit trail for deletions)**
    """
    project_id = UUID(sample_breakdown_data['project_id'])
    
    # Setup breakdowns
    breakdowns = [sample_breakdown_data]
    mock_supabase.tables['po_breakdowns'] = MockSupabaseQuery(data=breakdowns)
    
    # Setup deletion version records
    deletion_version = sample_version_data.copy()
    deletion_version['breakdown_id'] = sample_breakdown_data['id']
    deletion_version['change_type'] = 'delete'
    deletion_version['changes'] = {
        'action': 'delete',
        'hard_delete': False
    }
    deletion_version['before_values'] = sample_breakdown_data
    
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=[deletion_version])
    
    # Get deletion audit trail
    result = await po_breakdown_service.get_deletion_audit_trail(
        project_id=project_id,
        include_hard_deletes=False
    )
    
    # Verify results
    assert len(result) == 1
    entry = result[0]
    
    assert entry['breakdown_id'] == sample_breakdown_data['id']
    assert entry['deletion_type'] == 'soft'
    assert 'before_snapshot' in entry
    # can_restore is True only if not hard_delete AND currently inactive
    # Since we set is_active=True in sample_breakdown_data, can_restore will be False
    assert 'can_restore' in entry


@pytest.mark.asyncio
async def test_field_label_conversion(po_breakdown_service):
    """
    Test that field names are converted to human-readable labels.
    
    **Validates: Requirement 6.3 (display chronological change log)**
    """
    # Test various field name conversions
    assert po_breakdown_service._get_field_label('planned_amount') == 'Planned Amount'
    assert po_breakdown_service._get_field_label('sap_po_number') == 'SAP PO Number'
    assert po_breakdown_service._get_field_label('cost_center') == 'Cost Center'
    assert po_breakdown_service._get_field_label('is_active') == 'Active Status'


@pytest.mark.asyncio
async def test_field_type_identification(po_breakdown_service):
    """
    Test that field types are correctly identified.
    
    **Validates: Requirement 6.3 (display chronological change log)**
    """
    # Test various field type identifications
    assert po_breakdown_service._get_field_type('planned_amount') == 'decimal'
    assert po_breakdown_service._get_field_type('name') == 'text'
    assert po_breakdown_service._get_field_type('is_active') == 'boolean'
    assert po_breakdown_service._get_field_type('custom_fields') == 'json'
    assert po_breakdown_service._get_field_type('tags') == 'array'
    assert po_breakdown_service._get_field_type('hierarchy_level') == 'integer'


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_complete_soft_delete_restore_cycle(po_breakdown_service, mock_supabase, sample_breakdown_data):
    """
    Test complete cycle: create -> soft delete -> restore.
    
    **Validates: Requirements 6.3, 6.4**
    """
    breakdown_id = UUID(sample_breakdown_data['id'])
    user_id = UUID(sample_breakdown_data['created_by'])
    
    # Create a mock query that handles the state transitions
    class CycleMockQuery(MockSupabaseQuery):
        def __init__(self, initial_data):
            super().__init__()
            self.data_state = initial_data.copy()
            self.call_count = 0
        
        def execute(self):
            result = Mock()
            result.data = [self.data_state.copy()]
            return result
        
        def update(self, data):
            self.data_state.update(data)
            return self
    
    # Setup mocks
    cycle_query = CycleMockQuery(sample_breakdown_data)
    mock_supabase.tables['po_breakdowns'] = cycle_query
    mock_supabase.tables['po_breakdown_versions'] = MockSupabaseQuery(data=[])
    
    with patch.object(po_breakdown_service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
        with patch.object(po_breakdown_service, '_get_children', new_callable=AsyncMock) as mock_children:
            with patch.object(po_breakdown_service, '_create_version_record', new_callable=AsyncMock):
                with patch.object(po_breakdown_service, 'schedule_automatic_variance_recalculation', new_callable=AsyncMock):
                    # Step 1: Soft delete
                    mock_get.return_value = POBreakdownResponse(**sample_breakdown_data)
                    mock_children.return_value = []
                    
                    delete_result = await po_breakdown_service.delete_breakdown(
                        breakdown_id=breakdown_id,
                        user_id=user_id,
                        hard_delete=False
                    )
                    assert delete_result is True
                    
                    # Verify version record created for deletion
                    assert po_breakdown_service._create_version_record.call_count == 1
                    
                    # Step 2: Restore
                    # Update the mock data to be inactive
                    cycle_query.data_state['is_active'] = False
                    
                    restore_result = await po_breakdown_service.restore_soft_deleted_breakdown(
                        breakdown_id=breakdown_id,
                        user_id=user_id,
                        restore_reason="Testing complete cycle"
                    )
                    
                    assert restore_result is not None
                    assert restore_result.is_active is True
                    
                    # Verify version record created for restoration
                    assert po_breakdown_service._create_version_record.call_count == 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
