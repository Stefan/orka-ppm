"""
Unit tests for PO Breakdown Version Tracking and Audit Trail

Tests comprehensive version tracking functionality including:
- Automatic version record creation
- Version history retrieval
- Audit trail queries
- Version restoration
- Export functionality

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import AsyncMock, MagicMock, patch

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownUpdate,
    POBreakdownType,
    POBreakdownVersion
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    mock = MagicMock()
    mock.table = MagicMock(return_value=mock)
    mock.select = MagicMock(return_value=mock)
    mock.insert = MagicMock(return_value=mock)
    mock.update = MagicMock(return_value=mock)
    mock.delete = MagicMock(return_value=mock)
    mock.eq = MagicMock(return_value=mock)
    mock.in_ = MagicMock(return_value=mock)
    mock.gte = MagicMock(return_value=mock)
    mock.lte = MagicMock(return_value=mock)
    mock.order = MagicMock(return_value=mock)
    mock.range = MagicMock(return_value=mock)
    mock.execute = MagicMock()
    return mock


@pytest.fixture
def service(mock_supabase):
    """Create POBreakdownDatabaseService instance with mock"""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def sample_breakdown_data():
    """Sample breakdown data for testing"""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Test Breakdown',
        'code': 'TB001',
        'sap_po_number': 'PO-12345',
        'sap_line_item': '10',
        'hierarchy_level': 0,
        'parent_breakdown_id': None,
        'cost_center': 'CC-100',
        'gl_account': 'GL-500',
        'planned_amount': '100000.00',
        'committed_amount': '80000.00',
        'actual_amount': '75000.00',
        'remaining_amount': '25000.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': 'Construction',
        'subcategory': 'Foundation',
        'custom_fields': {},
        'tags': ['critical', 'phase1'],
        'notes': 'Test notes',
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }


@pytest.fixture
def sample_version_record():
    """Sample version record for testing"""
    return {
        'id': str(uuid4()),
        'breakdown_id': str(uuid4()),
        'version_number': 1,
        'changes': {'action': 'create', 'data': {}},
        'change_type': 'create',
        'change_summary': 'Initial creation',
        'before_values': {},
        'after_values': {},
        'changed_by': str(uuid4()),
        'changed_at': datetime.now().isoformat(),
        'change_reason': None,
        'is_import': False,
        'import_batch_id': None,
        'ip_address': None,
        'user_agent': None
    }


class TestVersionRecordCreation:
    """Test automatic version record creation"""
    
    @pytest.mark.asyncio
    async def test_create_version_record_basic(self, service, mock_supabase):
        """
        Test basic version record creation
        **Validates: Requirement 6.1**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        changes = {'name': {'old': 'Old Name', 'new': 'New Name'}}
        
        # Mock successful insert
        mock_supabase.execute.return_value = MagicMock(data=[{'id': str(uuid4())}])
        
        # Execute
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=2,
            changes=changes,
            user_id=user_id
        )
        
        # Verify insert was called
        assert mock_supabase.table.called
        assert mock_supabase.insert.called
        
        # Verify data structure
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['breakdown_id'] == str(breakdown_id)
        assert insert_call['version_number'] == 2
        assert insert_call['changes'] == changes
        assert insert_call['changed_by'] == str(user_id)
        assert 'changed_at' in insert_call
    
    @pytest.mark.asyncio
    async def test_create_version_record_with_metadata(self, service, mock_supabase):
        """
        Test version record creation with full metadata
        **Validates: Requirements 6.1, 6.2**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        import_batch_id = uuid4()
        changes = {'planned_amount': {'old': '100000', 'new': '120000'}}
        
        mock_supabase.execute.return_value = MagicMock(data=[{'id': str(uuid4())}])
        
        # Execute with full metadata
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=3,
            changes=changes,
            user_id=user_id,
            change_type='financial_update',
            change_summary='Updated planned amount',
            before_values={'planned_amount': '100000'},
            after_values={'planned_amount': '120000'},
            change_reason='Budget revision',
            is_import=True,
            import_batch_id=import_batch_id,
            ip_address='192.168.1.1',
            user_agent='Mozilla/5.0'
        )
        
        # Verify all metadata was included
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['change_type'] == 'financial_update'
        assert insert_call['change_summary'] == 'Updated planned amount'
        assert insert_call['before_values'] == {'planned_amount': '100000'}
        assert insert_call['after_values'] == {'planned_amount': '120000'}
        assert insert_call['change_reason'] == 'Budget revision'
        assert insert_call['is_import'] is True
        assert insert_call['import_batch_id'] == str(import_batch_id)
        assert insert_call['ip_address'] == '192.168.1.1'
        assert insert_call['user_agent'] == 'Mozilla/5.0'
    
    @pytest.mark.asyncio
    async def test_create_version_record_auto_change_type(self, service, mock_supabase):
        """
        Test automatic change type detection
        **Validates: Requirement 6.1**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        mock_supabase.execute.return_value = MagicMock(data=[{'id': str(uuid4())}])
        
        # Test financial update detection
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=2,
            changes={'planned_amount': {'old': '100', 'new': '200'}},
            user_id=user_id
        )
        
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['change_type'] == 'financial_update'
        
        # Test move detection
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=3,
            changes={'parent_breakdown_id': {'old': None, 'new': str(uuid4())}},
            user_id=user_id
        )
        
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['change_type'] == 'move'
        
        # Test custom field update detection
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=4,
            changes={'custom_fields': {'old': {}, 'new': {'key': 'value'}}},
            user_id=user_id
        )
        
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['change_type'] == 'custom_field_update'


class TestVersionHistoryRetrieval:
    """Test version history retrieval methods"""
    
    @pytest.mark.asyncio
    async def test_get_breakdown_version_history(self, service, mock_supabase, sample_version_record):
        """
        Test retrieving version history for a breakdown
        **Validates: Requirement 6.3**
        """
        breakdown_id = uuid4()
        
        # Mock version records
        version_records = [
            {**sample_version_record, 'version_number': 3, 'change_type': 'update'},
            {**sample_version_record, 'version_number': 2, 'change_type': 'update'},
            {**sample_version_record, 'version_number': 1, 'change_type': 'create'}
        ]
        
        mock_supabase.execute.return_value = MagicMock(data=version_records)
        
        # Execute
        versions = await service.get_breakdown_version_history(
            breakdown_id=breakdown_id,
            limit=50,
            offset=0
        )
        
        # Verify
        assert len(versions) == 3
        assert all(isinstance(v, POBreakdownVersion) for v in versions)
        assert versions[0].version_number == 3  # Most recent first
        assert versions[1].version_number == 2
        assert versions[2].version_number == 1
        
        # Verify query was built correctly
        assert mock_supabase.eq.called
        assert mock_supabase.order.called
        assert mock_supabase.range.called
    
    @pytest.mark.asyncio
    async def test_get_breakdown_version_history_pagination(self, service, mock_supabase, sample_version_record):
        """
        Test version history pagination
        **Validates: Requirement 6.3**
        """
        breakdown_id = uuid4()
        
        # Mock paginated results
        mock_supabase.execute.return_value = MagicMock(data=[sample_version_record])
        
        # Execute with pagination
        versions = await service.get_breakdown_version_history(
            breakdown_id=breakdown_id,
            limit=10,
            offset=20
        )
        
        # Verify range was called with correct parameters
        mock_supabase.range.assert_called_with(20, 29)  # offset to offset + limit - 1


class TestAuditTrail:
    """Test audit trail functionality"""
    
    @pytest.mark.asyncio
    async def test_get_project_audit_trail(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test retrieving project audit trail
        **Validates: Requirements 6.3, 6.5**
        """
        project_id = uuid4()
        
        # Mock breakdowns
        mock_supabase.execute.side_effect = [
            MagicMock(data=[sample_breakdown_data]),  # Breakdowns query
            MagicMock(data=[sample_version_record])   # Versions query
        ]
        
        # Execute
        audit_records = await service.get_project_audit_trail(
            project_id=project_id,
            limit=100,
            offset=0
        )
        
        # Verify
        assert len(audit_records) > 0
        assert 'breakdown_id' in audit_records[0]
        assert 'breakdown_name' in audit_records[0]
        assert 'change_type' in audit_records[0]
        assert 'changed_by' in audit_records[0]
        assert 'changed_at' in audit_records[0]
    
    @pytest.mark.asyncio
    async def test_get_project_audit_trail_with_filters(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test audit trail with date and type filters
        **Validates: Requirement 6.3**
        """
        project_id = uuid4()
        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()
        change_types = ['update', 'financial_update']
        
        mock_supabase.execute.side_effect = [
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_version_record])
        ]
        
        # Execute with filters
        audit_records = await service.get_project_audit_trail(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            change_types=change_types,
            limit=100,
            offset=0
        )
        
        # Verify filters were applied
        assert mock_supabase.gte.called  # start_date filter
        assert mock_supabase.lte.called  # end_date filter
        assert mock_supabase.in_.called  # change_types filter


class TestAuditExport:
    """Test audit data export functionality"""
    
    @pytest.mark.asyncio
    async def test_export_audit_data(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test exporting audit data in machine-readable format
        **Validates: Requirement 6.5**
        """
        project_id = uuid4()
        
        # Mock data
        mock_supabase.execute.side_effect = [
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_version_record])
        ]
        
        # Execute
        export_data = await service.export_audit_data(
            project_id=project_id,
            format='json'
        )
        
        # Verify export structure
        assert 'project_id' in export_data
        assert 'export_date' in export_data
        assert 'date_range' in export_data
        assert 'total_records' in export_data
        assert 'format' in export_data
        assert 'audit_records' in export_data
        assert export_data['format'] == 'json'
        assert isinstance(export_data['audit_records'], list)
    
    @pytest.mark.asyncio
    async def test_export_audit_data_with_date_range(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test exporting audit data with date range filter
        **Validates: Requirement 6.5**
        """
        project_id = uuid4()
        start_date = datetime.now() - timedelta(days=30)
        end_date = datetime.now()
        
        mock_supabase.execute.side_effect = [
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_version_record])
        ]
        
        # Execute
        export_data = await service.export_audit_data(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Verify date range is included
        assert export_data['date_range']['start'] == start_date.isoformat()
        assert export_data['date_range']['end'] == end_date.isoformat()


class TestVersionStatistics:
    """Test version statistics functionality"""
    
    @pytest.mark.asyncio
    async def test_get_version_statistics(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test retrieving version statistics for a project
        **Validates: Requirements 6.1, 6.3**
        """
        project_id = uuid4()
        
        # Mock multiple version records with different types
        version_records = [
            {**sample_version_record, 'change_type': 'create'},
            {**sample_version_record, 'change_type': 'update'},
            {**sample_version_record, 'change_type': 'update'},
            {**sample_version_record, 'change_type': 'financial_update'},
            {**sample_version_record, 'change_type': 'move'}
        ]
        
        mock_supabase.execute.side_effect = [
            MagicMock(data=[sample_breakdown_data]),  # Breakdowns
            MagicMock(data=version_records),          # Versions
            MagicMock(data=[sample_breakdown_data]),  # For recent activity
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_breakdown_data]),
            MagicMock(data=[sample_breakdown_data])
        ]
        
        # Execute
        stats = await service.get_version_statistics(project_id=project_id)
        
        # Verify statistics structure
        assert 'total_versions' in stats
        assert 'total_breakdowns' in stats
        assert 'changes_by_type' in stats
        assert 'changes_by_user' in stats
        assert 'recent_activity' in stats
        
        # Verify counts
        assert stats['total_versions'] == 5
        assert stats['changes_by_type']['update'] == 2
        assert stats['changes_by_type']['create'] == 1
        assert stats['changes_by_type']['financial_update'] == 1
        assert stats['changes_by_type']['move'] == 1


class TestVersionRestoration:
    """Test version restoration functionality"""
    
    @pytest.mark.asyncio
    async def test_restore_breakdown_version(self, service, mock_supabase, sample_breakdown_data, sample_version_record):
        """
        Test restoring a breakdown to a previous version
        **Validates: Requirements 6.2, 6.4**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        # Mock version record with before_values
        version_with_snapshot = {
            **sample_version_record,
            'version_number': 2,
            'before_values': {
                'name': 'Original Name',
                'planned_amount': '100000.00',
                'category': 'Original Category'
            }
        }
        
        # Mock current breakdown
        current_breakdown = {
            **sample_breakdown_data,
            'id': str(breakdown_id),
            'name': 'Modified Name',
            'planned_amount': '150000.00',
            'category': 'Modified Category',
            'version': 5
        }
        
        mock_supabase.execute.side_effect = [
            MagicMock(data=[version_with_snapshot]),  # Get version
            MagicMock(data=[current_breakdown]),      # Get current breakdown
            MagicMock(data=[current_breakdown])       # Update result
        ]
        
        # Mock get_breakdown_by_id
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(current_breakdown)
            
            # Mock _create_version_record
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                # Execute
                restored = await service.restore_breakdown_version(
                    breakdown_id=breakdown_id,
                    version_number=2,
                    user_id=user_id,
                    restore_reason='Reverting incorrect changes'
                )
                
                # Verify update was called
                assert mock_supabase.update.called
                
                # Verify version record was created
                assert service._create_version_record.called
    
    @pytest.mark.asyncio
    async def test_restore_breakdown_version_no_snapshot(self, service, mock_supabase, sample_version_record):
        """
        Test restoration fails when version has no before_values
        **Validates: Requirement 6.4**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        # Mock version without before_values
        version_without_snapshot = {
            **sample_version_record,
            'before_values': {}
        }
        
        mock_supabase.execute.return_value = MagicMock(data=[version_without_snapshot])
        
        # Execute and expect error
        with pytest.raises(ValueError, match="Cannot restore"):
            await service.restore_breakdown_version(
                breakdown_id=breakdown_id,
                version_number=1,
                user_id=user_id
            )


class TestTimestampAndUserTracking:
    """Test timestamp and user identification tracking"""
    
    @pytest.mark.asyncio
    async def test_version_record_includes_timestamp(self, service, mock_supabase):
        """
        Test that version records include accurate timestamps
        **Validates: Requirement 6.1**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        mock_supabase.execute.return_value = MagicMock(data=[{'id': str(uuid4())}])
        
        before_time = datetime.now()
        
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=1,
            changes={'action': 'create'},
            user_id=user_id
        )
        
        after_time = datetime.now()
        
        # Verify timestamp was included
        insert_call = mock_supabase.insert.call_args[0][0]
        assert 'changed_at' in insert_call
        
        # Parse and verify timestamp is within expected range
        changed_at = datetime.fromisoformat(insert_call['changed_at'])
        assert before_time <= changed_at <= after_time
    
    @pytest.mark.asyncio
    async def test_version_record_includes_user_id(self, service, mock_supabase):
        """
        Test that version records include user identification
        **Validates: Requirement 6.1**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        mock_supabase.execute.return_value = MagicMock(data=[{'id': str(uuid4())}])
        
        await service._create_version_record(
            breakdown_id=breakdown_id,
            version_number=1,
            changes={'action': 'create'},
            user_id=user_id
        )
        
        # Verify user ID was included
        insert_call = mock_supabase.insert.call_args[0][0]
        assert insert_call['changed_by'] == str(user_id)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
