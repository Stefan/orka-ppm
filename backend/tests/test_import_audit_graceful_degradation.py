"""
Unit tests for audit logging failure graceful degradation

This test verifies that the import operation succeeds even when audit logging fails,
as specified in Requirement 5.5.

The AuditService handles failures gracefully internally - it catches exceptions
and logs warnings but doesn't propagate them. These tests verify that behavior
works correctly in the context of the ImportService.

Requirements: 5.5
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4, UUID
from datetime import date

from services.import_service import ImportService, ImportResult
from services.audit_service import AuditService
from services.validation_service import ValidationService
from models.projects import ProjectCreate
from models.base import ProjectStatus


class TestImportAuditGracefulDegradation:
    """
    Test suite for verifying import succeeds even when audit logging fails.
    
    Requirement 5.5: WHEN audit logging fails, THE Import_Service SHALL still 
    complete the import operation but log the audit failure.
    """
    
    @pytest.fixture
    def mock_db_for_projects(self):
        """Create a mock database client for successful project creation"""
        db = Mock()
        
        # Mock successful project insertion
        mock_response = Mock()
        mock_response.data = [
            {"id": str(uuid4()), "name": "Test Project"}
        ]
        db.table = Mock(return_value=Mock())
        db.table.return_value.insert.return_value.execute.return_value = mock_response
        
        # Mock empty result for duplicate check (no existing projects)
        db.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(data=[])
        
        return db
    
    @pytest.fixture
    def failing_audit_db(self):
        """Create a mock database client that fails for audit operations"""
        db = Mock()
        
        # Make audit table operations fail
        def table_side_effect(table_name):
            mock_table = Mock()
            if table_name == "admin_audit_log":
                # Audit operations fail
                mock_table.insert.return_value.execute.side_effect = Exception("Audit DB error")
                mock_table.select.return_value.eq.return_value.execute.side_effect = Exception("Audit DB error")
                mock_table.update.return_value.eq.return_value.execute.side_effect = Exception("Audit DB error")
            elif table_name == "projects":
                # Project operations succeed
                mock_response = Mock()
                mock_response.data = [{"id": str(uuid4()), "name": "Test Project"}]
                mock_table.insert.return_value.execute.return_value = mock_response
                mock_table.select.return_value.eq.return_value.execute.return_value = Mock(data=[])
            return mock_table
        
        db.table = Mock(side_effect=table_side_effect)
        return db
    
    @pytest.fixture
    def valid_project(self):
        """Create a valid project for import"""
        return ProjectCreate(
            portfolio_id=uuid4(),
            name="Test Project",
            description="A test project",
            status=ProjectStatus.planning,
            priority="medium",
            budget=100000.0,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            manager_id=None,
            team_members=[]
        )
    
    @pytest.mark.asyncio
    async def test_import_succeeds_when_audit_db_fails(self, failing_audit_db, valid_project):
        """
        Test that import succeeds even when audit database operations fail.
        
        Requirement 5.5: Import should complete successfully even if audit logging fails.
        The AuditService handles database failures gracefully by catching exceptions
        and logging warnings.
        """
        # Arrange
        import_service = ImportService(db_session=failing_audit_db, user_id="user-123")
        
        # Act
        result = await import_service.import_projects([valid_project], "json")
        
        # Assert - import should succeed despite audit failure
        assert result.success is True
        assert result.count == 1
        assert len(result.errors) == 0
        assert "Successfully imported" in result.message
    
    @pytest.mark.asyncio
    async def test_audit_service_returns_audit_id_on_failure(self):
        """
        Test that AuditService returns an audit_id even when database fails.
        
        Requirement 5.5: The audit service should degrade gracefully.
        """
        # Arrange - create audit service with failing database
        failing_db = Mock()
        failing_db.table.return_value.insert.return_value.execute.side_effect = Exception("DB error")
        
        audit_service = AuditService(db_session=failing_db)
        
        # Act
        audit_id = await audit_service.log_import_start(
            user_id="user-123",
            import_method="json",
            record_count=5
        )
        
        # Assert - should return audit_id even on failure
        assert audit_id is not None
        assert isinstance(audit_id, str)
        assert len(audit_id) > 0
    
    @pytest.mark.asyncio
    async def test_audit_service_log_complete_handles_failure(self):
        """
        Test that AuditService.log_import_complete handles failures gracefully.
        
        Requirement 5.5: Completion logging should not raise exceptions.
        """
        # Arrange - create audit service with failing database
        failing_db = Mock()
        failing_db.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB error")
        
        audit_service = AuditService(db_session=failing_db)
        
        # Act - should not raise exception
        await audit_service.log_import_complete(
            audit_id="audit-123",
            success=True,
            imported_count=5
        )
        
        # Assert - no exception raised (test passes if we get here)
    
    @pytest.mark.asyncio
    async def test_audit_service_with_no_database(self):
        """
        Test that AuditService works when database is None.
        
        Requirement 5.5: Should handle missing database gracefully.
        """
        # Arrange
        audit_service = AuditService(db_session=None)
        
        # Act
        audit_id = await audit_service.log_import_start(
            user_id="user-123",
            import_method="json",
            record_count=5
        )
        
        # Assert
        assert audit_id is not None
        
        # Act - completion should also work
        await audit_service.log_import_complete(
            audit_id=audit_id,
            success=True,
            imported_count=5
        )
        # Assert - no exception raised
    
    @pytest.mark.asyncio
    async def test_csv_import_succeeds_when_audit_fails(self, failing_audit_db, valid_project):
        """
        Test that CSV import succeeds even when audit logging fails.
        
        Requirement 5.5: Both JSON and CSV imports should handle audit failures gracefully.
        """
        # Arrange
        import_service = ImportService(db_session=failing_audit_db, user_id="user-123")
        
        # Act - use CSV import method
        result = await import_service.import_projects([valid_project], "csv")
        
        # Assert
        assert result.success is True
        assert result.count == 1
    
    @pytest.mark.asyncio
    async def test_multiple_projects_import_succeeds_when_audit_fails(self, failing_audit_db):
        """
        Test that importing multiple projects succeeds when audit fails.
        
        Requirement 5.5: Batch imports should also handle audit failures gracefully.
        """
        # Arrange
        projects = [
            ProjectCreate(
                portfolio_id=uuid4(),
                name=f"Project {i}",
                description=f"Description {i}",
                status=ProjectStatus.planning,
                priority="medium",
                budget=100000.0 * (i + 1),
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                manager_id=None,
                team_members=[]
            )
            for i in range(3)
        ]
        
        # Update mock to return multiple projects
        def table_side_effect(table_name):
            mock_table = Mock()
            if table_name == "admin_audit_log":
                mock_table.insert.return_value.execute.side_effect = Exception("Audit DB error")
                mock_table.select.return_value.eq.return_value.execute.side_effect = Exception("Audit DB error")
                mock_table.update.return_value.eq.return_value.execute.side_effect = Exception("Audit DB error")
            elif table_name == "projects":
                mock_response = Mock()
                mock_response.data = [
                    {"id": str(uuid4()), "name": f"Project {i}"}
                    for i in range(3)
                ]
                mock_table.insert.return_value.execute.return_value = mock_response
                mock_table.select.return_value.eq.return_value.execute.return_value = Mock(data=[])
            return mock_table
        
        failing_audit_db.table = Mock(side_effect=table_side_effect)
        
        import_service = ImportService(db_session=failing_audit_db, user_id="user-123")
        
        # Act
        result = await import_service.import_projects(projects, "json")
        
        # Assert
        assert result.success is True
        assert result.count == 3
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_import_with_validation_failure_and_audit_failure(self, failing_audit_db):
        """
        Test that validation errors are still returned when audit fails.
        
        Requirement 5.5: Audit failures should not affect validation error reporting.
        """
        # Arrange - create project with missing required field
        invalid_project = ProjectCreate(
            portfolio_id=uuid4(),
            name="",  # Empty name should fail validation
            description="A test project",
            status=ProjectStatus.planning,
            priority="medium",
            budget=100000.0,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            manager_id=None,
            team_members=[]
        )
        
        import_service = ImportService(db_session=failing_audit_db, user_id="user-123")
        
        # Act
        result = await import_service.import_projects([invalid_project], "json")
        
        # Assert - validation should still fail properly
        assert result.success is False
        assert result.count == 0
        assert len(result.errors) > 0
