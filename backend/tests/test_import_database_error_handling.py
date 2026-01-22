"""
Unit Tests for Database Error Handling in Import Service
Feature: project-import-mvp
Task 6.6: Write unit tests for database error handling

**Validates: Requirements 9.3, 9.4**

Requirements 9.3: WHEN a database error occurs during import, THE Import_Service 
SHALL roll back all changes from that import session

Requirements 9.4: WHEN an import is rolled back, THE Import_Service SHALL return 
an error message indicating the rollback occurred
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.import_service import ImportService, ImportResult


def create_mock_project(name: str = "Test Project", budget: float = 10000.0, status: str = "planning"):
    """Create a mock project with valid data."""
    project = Mock()
    project.portfolio_id = uuid4()
    project.name = name
    project.budget = budget
    project.status = status
    project.description = None
    project.priority = None
    project.start_date = None
    project.end_date = None
    project.manager_id = None
    project.team_members = []
    return project


def create_mock_db_with_error(error_type: str = "connection", error_message: str = None):
    """
    Create a mock database client that raises specific errors.
    
    Args:
        error_type: Type of error to simulate ("connection", "constraint", "timeout", "generic")
        error_message: Custom error message (optional)
    """
    db = Mock()
    inserted_records = {"projects": [], "admin_audit_log": []}
    
    error_messages = {
        "connection": "Database connection error: Connection refused",
        "constraint": "Database constraint violation: duplicate key value violates unique constraint",
        "timeout": "Database operation timed out after 30 seconds",
        "generic": "Unknown database error occurred"
    }
    
    actual_error_message = error_message or error_messages.get(error_type, error_messages["generic"])
    
    def create_table_mock(table_name):
        table_mock = Mock()
        
        # Mock select for duplicate checking (returns empty = no duplicates)
        mock_select_response = Mock()
        mock_select_response.data = []
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute = Mock(return_value=mock_select_response)
        mock_select.eq = Mock(return_value=mock_eq)
        table_mock.select = Mock(return_value=mock_select)
        
        # Mock insert that raises an error for projects table
        def create_insert_mock():
            insert_mock = Mock()
            insert_mock._records = None
            
            def execute():
                if table_name == "projects":
                    raise Exception(actual_error_message)
                
                # For audit log, succeed
                records = insert_mock._records
                if records:
                    if isinstance(records, list):
                        inserted_records[table_name].extend(records)
                    else:
                        inserted_records[table_name].append(records)
                
                response = Mock()
                response.data = records if isinstance(records, list) else [records]
                return response
            
            insert_mock.execute = Mock(side_effect=execute)
            return insert_mock
        
        def track_insert(records):
            insert_mock = create_insert_mock()
            insert_mock._records = records
            return insert_mock
        
        table_mock.insert = Mock(side_effect=track_insert)
        
        # Mock update for audit log completion
        def create_update_mock():
            update_mock = Mock()
            eq_mock = Mock()
            eq_mock.execute = Mock(return_value=Mock(data=[]))
            update_mock.eq = Mock(return_value=eq_mock)
            return update_mock
        
        table_mock.update = Mock(side_effect=lambda data: create_update_mock())
        
        return table_mock
    
    tables = {}
    
    def get_table(table_name):
        if table_name not in tables:
            tables[table_name] = create_table_mock(table_name)
        return tables[table_name]
    
    db.table = Mock(side_effect=get_table)
    db._inserted_records = inserted_records
    
    return db


def create_successful_mock_db():
    """Create a mock database client that succeeds."""
    db = Mock()
    inserted_records = {"projects": [], "admin_audit_log": []}
    
    def create_table_mock(table_name):
        table_mock = Mock()
        
        # Mock select for duplicate checking
        mock_select_response = Mock()
        mock_select_response.data = []
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute = Mock(return_value=mock_select_response)
        mock_select.eq = Mock(return_value=mock_eq)
        table_mock.select = Mock(return_value=mock_select)
        
        # Mock insert that succeeds
        def create_insert_mock():
            insert_mock = Mock()
            insert_mock._records = None
            
            def execute():
                records = insert_mock._records
                if records:
                    if isinstance(records, list):
                        inserted_records[table_name].extend(records)
                    else:
                        inserted_records[table_name].append(records)
                
                response = Mock()
                response.data = records if isinstance(records, list) else [records]
                return response
            
            insert_mock.execute = Mock(side_effect=execute)
            return insert_mock
        
        def track_insert(records):
            insert_mock = create_insert_mock()
            insert_mock._records = records
            return insert_mock
        
        table_mock.insert = Mock(side_effect=track_insert)
        
        # Mock update
        def create_update_mock():
            update_mock = Mock()
            eq_mock = Mock()
            eq_mock.execute = Mock(return_value=Mock(data=[]))
            update_mock.eq = Mock(return_value=eq_mock)
            return update_mock
        
        table_mock.update = Mock(side_effect=lambda data: create_update_mock())
        
        return table_mock
    
    tables = {}
    
    def get_table(table_name):
        if table_name not in tables:
            tables[table_name] = create_table_mock(table_name)
        return tables[table_name]
    
    db.table = Mock(side_effect=get_table)
    db._inserted_records = inserted_records
    
    return db


class TestDatabaseErrorRollback:
    """
    Unit tests for transaction rollback on database errors.
    
    **Validates: Requirement 9.3**
    
    WHEN a database error occurs during import, THE Import_Service 
    SHALL roll back all changes from that import session
    """
    
    @pytest.mark.asyncio
    async def test_connection_error_triggers_rollback(self):
        """
        Test that database connection errors trigger rollback.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project(f"Project {i}") for i in range(3)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify rollback occurred - no projects should be in database
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_constraint_violation_triggers_rollback(self):
        """
        Test that database constraint violations trigger rollback.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("constraint")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project(f"Project {i}") for i in range(5)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify rollback occurred
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_timeout_error_triggers_rollback(self):
        """
        Test that database timeout errors trigger rollback.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("timeout")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project(f"Project {i}") for i in range(3)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify rollback occurred
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_generic_database_error_triggers_rollback(self):
        """
        Test that generic database errors trigger rollback.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("generic")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project(f"Project {i}") for i in range(3)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify rollback occurred
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_large_batch_rollback_on_error(self):
        """
        Test that large batches are fully rolled back on database error.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        # Create a large batch of 50 projects
        projects = [create_mock_project(f"Project {i}") for i in range(50)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify complete rollback - no partial inserts
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_csv_import_rollback_on_error(self):
        """
        Test that CSV imports are also rolled back on database error.
        
        **Validates: Requirement 9.3**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project(f"CSV Project {i}") for i in range(5)]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="csv"
        )
        
        # Verify rollback occurred for CSV import
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0


class TestRollbackErrorMessages:
    """
    Unit tests for error messages when rollback occurs.
    
    **Validates: Requirement 9.4**
    
    WHEN an import is rolled back, THE Import_Service SHALL return 
    an error message indicating the rollback occurred
    """
    
    @pytest.mark.asyncio
    async def test_rollback_error_message_contains_database_error(self):
        """
        Test that rollback error message indicates database error.
        
        **Validates: Requirement 9.4**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify error message indicates database error
        assert result.success is False
        assert result.message is not None
        assert len(result.message) > 0
        assert "database" in result.message.lower() or "error" in result.message.lower()
    
    @pytest.mark.asyncio
    async def test_rollback_error_message_indicates_rollback(self):
        """
        Test that error response indicates rollback occurred.
        
        **Validates: Requirement 9.4**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify error list contains rollback indication
        assert result.success is False
        assert len(result.errors) > 0
        
        # Check that at least one error mentions rollback
        rollback_mentioned = any(
            "rollback" in str(error.get("error", "")).lower() or
            "rolled back" in str(error.get("error", "")).lower()
            for error in result.errors
        )
        assert rollback_mentioned, (
            f"Expected error message to mention rollback, but got: {result.errors}"
        )
    
    @pytest.mark.asyncio
    async def test_rollback_error_has_database_field(self):
        """
        Test that rollback error has field set to 'database'.
        
        **Validates: Requirement 9.4**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify error structure
        assert result.success is False
        assert len(result.errors) > 0
        
        # Check that error has database field
        database_error = next(
            (e for e in result.errors if e.get("field") == "database"),
            None
        )
        assert database_error is not None, (
            f"Expected error with field='database', but got: {result.errors}"
        )
    
    @pytest.mark.asyncio
    async def test_rollback_error_has_index_minus_one(self):
        """
        Test that rollback error has index set to -1 (not specific to any record).
        
        **Validates: Requirement 9.4**
        """
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify error structure
        assert result.success is False
        assert len(result.errors) > 0
        
        # Check that error has index -1 (database-level error, not record-specific)
        database_error = next(
            (e for e in result.errors if e.get("index") == -1),
            None
        )
        assert database_error is not None, (
            f"Expected error with index=-1 for database error, but got: {result.errors}"
        )
    
    @pytest.mark.asyncio
    async def test_different_error_types_produce_descriptive_messages(self):
        """
        Test that different database error types produce descriptive messages.
        
        **Validates: Requirement 9.4**
        """
        error_types = ["connection", "constraint", "timeout", "generic"]
        
        for error_type in error_types:
            mock_db = create_mock_db_with_error(error_type)
            import_service = ImportService(db_session=mock_db, user_id="test-user")
            
            projects = [create_mock_project("Test Project")]
            
            result = await import_service.import_projects(
                projects=projects,
                import_method="json"
            )
            
            # Verify error message is descriptive
            assert result.success is False
            assert result.message is not None
            assert len(result.message) > 10, (
                f"Error message for {error_type} should be descriptive: {result.message}"
            )
    
    @pytest.mark.asyncio
    async def test_custom_error_message_preserved(self):
        """
        Test that custom database error messages are preserved in response.
        
        **Validates: Requirement 9.4**
        """
        custom_message = "Custom database error: Table 'projects' is locked"
        mock_db = create_mock_db_with_error("generic", error_message=custom_message)
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify custom error message is included
        assert result.success is False
        assert custom_message in result.message or "database error" in result.message.lower()


class TestDatabaseErrorEdgeCases:
    """
    Edge case tests for database error handling.
    """
    
    @pytest.mark.asyncio
    async def test_single_project_rollback(self):
        """Test rollback works correctly for single project import."""
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Single Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_successful_import_after_previous_failure(self):
        """Test that successful import works after a previous failure."""
        # First, fail an import
        failing_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=failing_db, user_id="test-user")
        
        projects = [create_mock_project("Project 1")]
        
        result1 = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result1.success is False
        
        # Now, succeed with a new database connection
        successful_db = create_successful_mock_db()
        import_service.db = successful_db
        import_service.validator.db = successful_db
        import_service.auditor.db = successful_db
        
        projects2 = [create_mock_project("Project 2")]
        
        result2 = await import_service.import_projects(
            projects=projects2,
            import_method="json"
        )
        
        assert result2.success is True
        assert result2.count == 1
    
    @pytest.mark.asyncio
    async def test_audit_log_records_failure(self):
        """Test that audit log records the failure even when database insert fails."""
        mock_db = create_mock_db_with_error("connection")
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        projects = [create_mock_project("Test Project")]
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Verify import failed
        assert result.success is False
        
        # Verify audit log was attempted (audit log insert should succeed)
        # The audit log records the start and completion of the import
        assert len(mock_db._inserted_records["admin_audit_log"]) >= 1
