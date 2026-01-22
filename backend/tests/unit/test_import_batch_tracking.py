"""
Unit Tests for Import Batch Tracking and Error Handling

Tests comprehensive batch tracking, error categorization, severity levels,
and rollback capabilities for SAP PO import processing.

**Validates: Requirements 1.5, 1.6, 10.3, 10.4**
"""

import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from services.import_processing_service import ImportProcessingService
from models.po_breakdown import (
    ImportConfig,
    ImportResult,
    ImportStatus,
    ImportError,
    ImportWarning,
    ImportConflict,
    ConflictType,
    ConflictResolution,
    POBreakdownType,
    ErrorSeverity,
    ErrorCategory,
    ImportBatchStatus,
    ImportBatchErrorDetail,
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.update = Mock(return_value=mock)
    mock.delete = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.in_ = Mock(return_value=mock)
    mock.order = Mock(return_value=mock)
    mock.limit = Mock(return_value=mock)
    mock.execute = Mock(return_value=Mock(data=[]))
    return mock


@pytest.fixture
def import_service(mock_supabase):
    """Create an ImportProcessingService instance with mocked dependencies."""
    service = ImportProcessingService(mock_supabase)
    service.po_service = AsyncMock()
    return service


@pytest.fixture
def default_import_config():
    """Create a default import configuration."""
    return ImportConfig(
        column_mappings={
            'name': 'Name',
            'code': 'Code',
            'planned_amount': 'Planned Amount',
            'actual_amount': 'Actual Amount'
        },
        skip_header_rows=1,
        currency_default='USD',
        breakdown_type_default=POBreakdownType.sap_standard,
        conflict_resolution=ConflictResolution.skip,
        validate_amounts=True
    )


class TestImportBatchCreation:
    """Test import batch creation with comprehensive tracking."""
    
    @pytest.mark.asyncio
    async def test_create_import_batch_with_full_metadata(self, import_service):
        """
        Test creating an import batch with complete metadata.
        
        **Validates: Requirements 1.6, 10.3**
        """
        project_id = uuid4()
        user_id = uuid4()
        file_name = "test_import.csv"
        file_size = 1024
        file_type = "csv"
        
        config = ImportConfig(
            column_mappings={'name': 'Name'},
            skip_header_rows=1
        )
        
        # Mock successful insert
        mock_result = Mock()
        mock_result.data = [{'id': str(uuid4())}]
        import_service.supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        batch_id = await import_service.create_import_batch(
            project_id=project_id,
            source=f"CSV: {file_name}",
            user_id=user_id,
            file_name=file_name,
            file_size_bytes=file_size,
            file_type=file_type,
            import_config=config
        )
        
        assert isinstance(batch_id, UUID)
        
        # Verify insert was called with correct data
        insert_call = import_service.supabase.table.return_value.insert.call_args
        batch_data = insert_call[0][0]
        
        assert batch_data['project_id'] == str(project_id)
        assert batch_data['file_name'] == file_name
        assert batch_data['file_size_bytes'] == file_size
        assert batch_data['file_type'] == file_type
        assert batch_data['status'] == ImportStatus.pending.value
        assert batch_data['can_rollback'] == True
        assert batch_data['error_count'] == 0
        assert batch_data['warning_count'] == 0
        assert batch_data['conflict_count'] == 0
    
    @pytest.mark.asyncio
    async def test_create_import_batch_handles_database_failure(self, import_service):
        """
        Test that batch creation continues even if database insert fails.
        
        **Validates: Requirements 1.6**
        """
        project_id = uuid4()
        user_id = uuid4()
        
        # Mock database failure
        import_service.supabase.table.return_value.insert.return_value.execute.side_effect = Exception("DB Error")
        
        # Should still return a batch_id
        batch_id = await import_service.create_import_batch(
            project_id=project_id,
            source="test.csv",
            user_id=user_id
        )
        
        assert isinstance(batch_id, UUID)


class TestErrorCategorization:
    """Test error categorization and severity levels."""
    
    @pytest.mark.asyncio
    async def test_error_with_severity_and_category(self, import_service):
        """
        Test that errors are created with proper severity and category.
        
        **Validates: Requirements 10.3, 10.4**
        """
        errors = []
        
        # Create a validation error
        error = ImportError(
            row_number=1,
            field='name',
            error_type='required_field_missing',
            severity=ErrorSeverity.error,
            category=ErrorCategory.validation,
            message="Name is required",
            raw_value=None,
            suggested_fix="Provide a non-empty name"
        )
        
        assert error.severity == ErrorSeverity.error
        assert error.category == ErrorCategory.validation
        assert error.suggested_fix is not None
    
    @pytest.mark.asyncio
    async def test_error_categorization_summary(self, import_service):
        """
        Test error summary by category and severity.
        
        **Validates: Requirements 10.3, 10.4**
        """
        errors = [
            ImportError(
                row_number=1,
                field='name',
                error_type='required_field_missing',
                severity=ErrorSeverity.error,
                category=ErrorCategory.validation,
                message="Name required"
            ),
            ImportError(
                row_number=2,
                field='amount',
                error_type='invalid_decimal',
                severity=ErrorSeverity.error,
                category=ErrorCategory.validation,
                message="Invalid amount"
            ),
            ImportError(
                row_number=3,
                field='hierarchy',
                error_type='circular_reference',
                severity=ErrorSeverity.critical,
                category=ErrorCategory.hierarchy,
                message="Circular reference detected"
            ),
        ]
        
        # Calculate summaries
        errors_by_category = {}
        errors_by_severity = {}
        
        for error in errors:
            category = error.category.value
            severity = error.severity.value
            errors_by_category[category] = errors_by_category.get(category, 0) + 1
            errors_by_severity[severity] = errors_by_severity.get(severity, 0) + 1
        
        assert errors_by_category['validation'] == 2
        assert errors_by_category['hierarchy'] == 1
        assert errors_by_severity['error'] == 2
        assert errors_by_severity['critical'] == 1


class TestBatchStatusTracking:
    """Test comprehensive batch status tracking."""
    
    @pytest.mark.asyncio
    async def test_get_import_status_comprehensive(self, import_service):
        """
        Test retrieving comprehensive import batch status.
        
        **Validates: Requirements 1.6, 10.3, 10.4**
        """
        batch_id = uuid4()
        project_id = uuid4()
        user_id = uuid4()
        
        # Mock batch data
        batch_data = {
            'id': str(batch_id),
            'project_id': str(project_id),
            'source': 'test.csv',
            'file_name': 'test.csv',
            'file_size_bytes': 1024,
            'file_type': 'csv',
            'status': 'completed',
            'status_message': 'Import completed successfully',
            'total_records': 10,
            'processed_records': 10,
            'successful_records': 8,
            'failed_records': 2,
            'skipped_records': 0,
            'updated_records': 0,
            'created_hierarchies': 3,
            'max_hierarchy_depth': 2,
            'error_count': 2,
            'warning_count': 1,
            'conflict_count': 0,
            'errors_by_category': {'validation': 2},
            'errors_by_severity': {'error': 2},
            'started_at': datetime.now().isoformat(),
            'completed_at': datetime.now().isoformat(),
            'processing_time_ms': 1500,
            'can_rollback': True,
            'rolled_back_at': None,
            'rolled_back_by': None,
            'rollback_reason': None,
            'created_breakdown_ids': [str(uuid4()), str(uuid4())],
            'imported_by': str(user_id),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [batch_data]
        import_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        status = await import_service.get_import_status(batch_id)
        
        assert isinstance(status, ImportBatchStatus)
        assert status.id == batch_id
        assert status.project_id == project_id
        assert status.status == ImportStatus.completed
        assert status.total_records == 10
        assert status.successful_records == 8
        assert status.failed_records == 2
        assert status.error_count == 2
        assert status.warning_count == 1
        assert status.errors_by_category == {'validation': 2}
        assert status.errors_by_severity == {'error': 2}
        assert status.can_rollback == True
        assert len(status.created_breakdown_ids) == 2
    
    @pytest.mark.asyncio
    async def test_update_batch_status_with_metrics(self, import_service):
        """
        Test updating batch status with comprehensive metrics.
        
        **Validates: Requirements 1.6, 10.3**
        """
        batch_id = uuid4()
        
        mock_result = Mock()
        mock_result.data = [{'id': str(batch_id)}]
        import_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
        
        await import_service._update_batch_status(
            batch_id=batch_id,
            status=ImportStatus.completed,
            status_message="Import completed successfully",
            metrics={
                'total_records': 10,
                'successful_records': 10,
                'error_count': 0,
                'processing_time_ms': 1000
            }
        )
        
        # Verify update was called
        update_call = import_service.supabase.table.return_value.update.call_args
        update_data = update_call[0][0]
        
        assert update_data['status'] == ImportStatus.completed.value
        assert update_data['status_message'] == "Import completed successfully"
        assert update_data['total_records'] == 10
        assert update_data['successful_records'] == 10
        assert 'completed_at' in update_data


class TestDetailedErrorStorage:
    """Test storing and retrieving detailed error information."""
    
    @pytest.mark.asyncio
    async def test_store_batch_errors(self, import_service):
        """
        Test storing detailed errors in database.
        
        **Validates: Requirements 10.3, 10.4**
        """
        batch_id = uuid4()
        
        errors = [
            ImportError(
                row_number=1,
                field='name',
                error_type='required_field_missing',
                severity=ErrorSeverity.error,
                category=ErrorCategory.validation,
                message="Name is required",
                raw_value=None,
                suggested_fix="Provide a name",
                can_auto_fix=False
            ),
            ImportError(
                row_number=2,
                field='amount',
                error_type='invalid_decimal',
                severity=ErrorSeverity.error,
                category=ErrorCategory.validation,
                message="Invalid amount",
                raw_value="abc",
                suggested_fix="Provide a numeric value",
                can_auto_fix=False
            )
        ]
        
        mock_result = Mock()
        mock_result.data = [{'id': str(uuid4())} for _ in errors]
        import_service.supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        await import_service._store_batch_errors(batch_id, errors)
        
        # Verify insert was called with error records
        insert_call = import_service.supabase.table.return_value.insert.call_args
        error_records = insert_call[0][0]
        
        assert len(error_records) == 2
        assert error_records[0]['batch_id'] == str(batch_id)
        assert error_records[0]['severity'] == ErrorSeverity.error.value
        assert error_records[0]['category'] == ErrorCategory.validation.value
        assert error_records[0]['suggested_fix'] is not None
    
    @pytest.mark.asyncio
    async def test_get_batch_errors_with_filters(self, import_service):
        """
        Test retrieving batch errors with severity and category filters.
        
        **Validates: Requirements 10.3, 10.4**
        """
        batch_id = uuid4()
        
        error_data = [
            {
                'id': str(uuid4()),
                'batch_id': str(batch_id),
                'row_number': 1,
                'field': 'name',
                'error_type': 'required_field_missing',
                'severity': 'error',
                'category': 'validation',
                'message': 'Name required',
                'raw_value': None,
                'suggested_fix': 'Provide a name',
                'can_auto_fix': False,
                'error_data': {},
                'created_at': datetime.now().isoformat()
            }
        ]
        
        mock_result = Mock()
        mock_result.data = error_data
        import_service.supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_result
        
        errors = await import_service.get_batch_errors(
            batch_id=batch_id,
            severity=ErrorSeverity.error,
            category=ErrorCategory.validation
        )
        
        assert len(errors) == 1
        assert isinstance(errors[0], ImportBatchErrorDetail)
        assert errors[0].severity == ErrorSeverity.error
        assert errors[0].category == ErrorCategory.validation
        assert errors[0].suggested_fix is not None


class TestRollbackCapability:
    """Test import batch rollback functionality."""
    
    @pytest.mark.asyncio
    async def test_rollback_import_batch(self, import_service):
        """
        Test rolling back an import batch by deleting created breakdowns.
        
        **Validates: Requirements 10.3**
        """
        batch_id = uuid4()
        user_id = uuid4()
        project_id = uuid4()
        
        created_ids = [uuid4(), uuid4(), uuid4()]
        
        # Mock batch status
        batch_data = {
            'id': str(batch_id),
            'project_id': str(project_id),
            'source': 'test.csv',
            'status': 'completed',
            'can_rollback': True,
            'created_breakdown_ids': [str(id) for id in created_ids],
            'imported_by': str(user_id),
            'total_records': 3,
            'processed_records': 3,
            'successful_records': 3,
            'failed_records': 0,
            'skipped_records': 0,
            'updated_records': 0,
            'created_hierarchies': 1,
            'max_hierarchy_depth': 0,
            'error_count': 0,
            'warning_count': 0,
            'conflict_count': 0,
            'errors_by_category': {},
            'errors_by_severity': {},
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [batch_data]
        import_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Mock successful deletion
        import_service.po_service.delete_breakdown = AsyncMock(return_value=True)
        
        # Mock batch update
        mock_update_result = Mock()
        mock_update_result.data = [{'id': str(batch_id)}]
        import_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result
        
        success = await import_service.rollback_import_batch(
            batch_id=batch_id,
            user_id=user_id,
            reason="Testing rollback"
        )
        
        assert success == True
        
        # Verify all breakdowns were deleted
        assert import_service.po_service.delete_breakdown.call_count == 3
        
        # Verify batch status was updated
        update_call = import_service.supabase.table.return_value.update.call_args
        update_data = update_call[0][0]
        assert update_data['status'] == ImportStatus.rolled_back.value
        assert 'rolled_back_at' in update_data
        assert update_data['can_rollback'] == False
    
    @pytest.mark.asyncio
    async def test_rollback_already_rolled_back_batch(self, import_service):
        """
        Test that rolling back an already rolled back batch raises an error.
        
        **Validates: Requirements 10.3**
        """
        batch_id = uuid4()
        user_id = uuid4()
        project_id = uuid4()
        
        # Mock already rolled back batch
        batch_data = {
            'id': str(batch_id),
            'project_id': str(project_id),
            'source': 'test.csv',
            'status': 'rolled_back',
            'can_rollback': False,
            'created_breakdown_ids': [],
            'imported_by': str(user_id),
            'total_records': 0,
            'processed_records': 0,
            'successful_records': 0,
            'failed_records': 0,
            'skipped_records': 0,
            'updated_records': 0,
            'created_hierarchies': 0,
            'max_hierarchy_depth': 0,
            'error_count': 0,
            'warning_count': 0,
            'conflict_count': 0,
            'errors_by_category': {},
            'errors_by_severity': {},
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        mock_result = Mock()
        mock_result.data = [batch_data]
        import_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        with pytest.raises(ValueError, match="already been rolled back"):
            await import_service.rollback_import_batch(
                batch_id=batch_id,
                user_id=user_id,
                reason="Testing"
            )


class TestImportResultEnhancements:
    """Test enhanced ImportResult with comprehensive tracking."""
    
    def test_import_result_with_error_summaries(self):
        """
        Test ImportResult includes error summaries by category and severity.
        
        **Validates: Requirements 10.3, 10.4**
        """
        batch_id = uuid4()
        
        errors = [
            ImportError(
                row_number=1,
                field='name',
                error_type='required_field_missing',
                severity=ErrorSeverity.error,
                category=ErrorCategory.validation,
                message="Name required"
            ),
            ImportError(
                row_number=2,
                field='hierarchy',
                error_type='circular_reference',
                severity=ErrorSeverity.critical,
                category=ErrorCategory.hierarchy,
                message="Circular reference"
            )
        ]
        
        result = ImportResult(
            batch_id=batch_id,
            status=ImportStatus.partially_completed,
            status_message="Import partially completed",
            total_records=10,
            processed_records=10,
            successful_records=8,
            failed_records=2,
            skipped_records=0,
            updated_records=0,
            errors=errors,
            warnings=[],
            conflicts=[],
            error_count=2,
            warning_count=0,
            conflict_count=0,
            errors_by_category={'validation': 1, 'hierarchy': 1},
            errors_by_severity={'error': 1, 'critical': 1},
            processing_time_ms=1000,
            created_hierarchies=2,
            max_hierarchy_depth=3,
            created_breakdown_ids=[uuid4(), uuid4()],
            can_rollback=True,
            rollback_instructions="Use rollback_import_batch to delete created items"
        )
        
        assert result.error_count == 2
        assert result.errors_by_category['validation'] == 1
        assert result.errors_by_category['hierarchy'] == 1
        assert result.errors_by_severity['error'] == 1
        assert result.errors_by_severity['critical'] == 1
        assert result.can_rollback == True
        assert result.rollback_instructions is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
