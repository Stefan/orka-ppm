"""
Property-Based Test for Transaction Atomicity with Valid Batches
Feature: project-import-mvp
Property 11: Transaction atomicity for valid batches

**Validates: Requirements 9.2**

Requirements 9.2: WHEN all records in an import batch pass validation, 
THE Import_Service SHALL import all records in a single database transaction
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import Mock
from uuid import uuid4
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.import_service import ImportService, ImportResult
from models.base import ProjectStatus


# Strategy for generating valid project data
@st.composite
def valid_project(draw):
    """
    Generate valid project data that passes all validation rules.
    """
    name = draw(st.text(
        min_size=1, 
        max_size=50, 
        alphabet=st.characters(
            whitelist_categories=('L', 'N'),
            blacklist_characters='\x00\n\r\t'
        )
    ).filter(lambda x: x.strip()))
    
    budget = draw(st.floats(
        min_value=0.01, 
        max_value=1e9, 
        allow_nan=False, 
        allow_infinity=False
    ))
    
    status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
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


@st.composite
def valid_project_batch(draw):
    """
    Generate a batch of valid projects with unique names.
    Batch size between 1 and 10 projects.
    """
    batch_size = draw(st.integers(min_value=1, max_value=10))
    projects = []
    used_names = set()
    
    for _ in range(batch_size):
        project = draw(valid_project())
        
        # Ensure unique names within batch
        base_name = project.name
        counter = 1
        while project.name in used_names:
            project.name = f"{base_name}_{counter}"
            counter += 1
        
        used_names.add(project.name)
        projects.append(project)
    
    return projects


def create_mock_db(should_fail_on_insert=False):
    """
    Create a mock database client that tracks inserts.
    
    Args:
        should_fail_on_insert: If True, the insert operation will raise an exception
    """
    db = Mock()
    
    # Track inserted records and insert call count
    inserted_records = {"projects": [], "admin_audit_log": []}
    insert_call_count = {"projects": 0}
    
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
        
        # Mock insert
        def create_insert_mock():
            insert_mock = Mock()
            insert_mock._records = None
            
            def execute():
                if table_name == "projects":
                    insert_call_count["projects"] += 1
                    
                    if should_fail_on_insert:
                        raise Exception("Database connection error - simulated failure")
                
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
    db._insert_call_count = insert_call_count
    
    return db


class TestTransactionAtomicityProperty:
    """
    Property-based tests for transaction atomicity with valid batches.
    
    Property 11: Transaction atomicity for valid batches
    **Validates: Requirements 9.2**
    
    For any import batch where all records pass validation, the Import_Service 
    should create all projects in a single database transaction such that either 
    all projects are created or none are created (if a database error occurs).
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        return create_mock_db()
    
    @pytest.fixture
    def import_service(self, mock_db):
        """Create an ImportService instance with mock database"""
        return ImportService(db_session=mock_db, user_id="test-user-123")
    
    @given(projects=valid_project_batch())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_11_transaction_atomicity_all_created(
        self, 
        projects, 
        import_service, 
        mock_db
    ):
        """
        Property 11: Transaction atomicity for valid batches
        
        **Validates: Requirements 9.2**
        
        For any import batch where all records pass validation, the Import_Service 
        should create all projects in a single database transaction such that either 
        all projects are created or none are created.
        
        This test verifies the "all created" case - when the transaction succeeds,
        all projects should be created.
        """
        # Feature: project-import-mvp, Property 11: Transaction atomicity for valid batches
        
        # Ensure we have at least one project
        assume(len(projects) > 0)
        
        # Create fresh mock for this iteration
        fresh_mock_db = create_mock_db(should_fail_on_insert=False)
        import_service.db = fresh_mock_db
        import_service.validator.db = fresh_mock_db
        import_service.auditor.db = fresh_mock_db
        
        # Execute the import
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Property assertion 1: Import MUST succeed for valid batch
        assert result.success is True, (
            f"Expected import to succeed for batch of {len(projects)} valid projects, "
            f"but got failure: {result.message}. Errors: {result.errors}"
        )
        
        # Property assertion 2: Count MUST equal input count
        assert result.count == len(projects), (
            f"Expected count {len(projects)}, but got {result.count}. "
            f"All valid projects should be created in the transaction."
        )
        
        # Property assertion 3: All projects should be inserted into database
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == len(projects), (
            f"Expected {len(projects)} project records in database, "
            f"but found {len(project_inserts)} records inserted. "
            f"Transaction should create all projects."
        )
        
        # Property assertion 4: Insert should be called exactly once (batch insert)
        # This verifies single transaction behavior
        assert fresh_mock_db._insert_call_count["projects"] == 1, (
            f"Expected exactly 1 insert call (batch insert), "
            f"but got {fresh_mock_db._insert_call_count['projects']} calls. "
            f"All projects should be inserted in a single transaction."
        )
        
        # Property assertion 5: No errors should be returned
        assert len(result.errors) == 0, (
            f"Expected no errors for valid batch, but got: {result.errors}"
        )
    
    @given(projects=valid_project_batch())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_11_transaction_atomicity_none_created_on_db_error(
        self, 
        projects, 
        import_service, 
        mock_db
    ):
        """
        Property 11: Transaction atomicity for valid batches (database error case)
        
        **Validates: Requirements 9.2**
        
        For any import batch where all records pass validation, if a database error 
        occurs during the transaction, none of the projects should be created.
        
        This test verifies the "none created" case - when the transaction fails,
        no projects should be created (rollback behavior).
        """
        # Feature: project-import-mvp, Property 11: Transaction atomicity for valid batches
        
        # Ensure we have at least one project
        assume(len(projects) > 0)
        
        # Create fresh mock that will fail on insert
        fresh_mock_db = create_mock_db(should_fail_on_insert=True)
        import_service.db = fresh_mock_db
        import_service.validator.db = fresh_mock_db
        import_service.auditor.db = fresh_mock_db
        
        # Execute the import
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Property assertion 1: Import MUST fail when database error occurs
        assert result.success is False, (
            f"Expected import to fail when database error occurs, "
            f"but got success for batch of {len(projects)} projects"
        )
        
        # Property assertion 2: Count MUST be zero (no partial creates)
        assert result.count == 0, (
            f"Expected zero projects created when database error occurs, "
            f"but got count={result.count}. "
            f"Transaction should be atomic - all or nothing."
        )
        
        # Property assertion 3: No projects should be in the database
        # (The mock tracks what would have been inserted before the error)
        # Since the error occurs during execute(), no records should be committed
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == 0, (
            f"Expected zero project records in database when transaction fails, "
            f"but found {len(project_inserts)} records. "
            f"Transaction should rollback all changes on error."
        )
        
        # Property assertion 4: Error message should indicate database error
        assert result.message, (
            f"Result should have an error message"
        )
        assert "database" in result.message.lower() or "error" in result.message.lower(), (
            f"Error message should indicate database error: {result.message}"
        )


class TestTransactionAtomicityEdgeCases:
    """
    Edge case tests for transaction atomicity.
    These complement the property-based tests with specific scenarios.
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        return create_mock_db()
    
    @pytest.fixture
    def import_service(self, mock_db):
        """Create an ImportService instance with mock database"""
        return ImportService(db_session=mock_db, user_id="test-user-123")
    
    @pytest.mark.asyncio
    async def test_single_project_transaction(self, import_service, mock_db):
        """Test that single project import uses transaction"""
        project = Mock()
        project.portfolio_id = uuid4()
        project.name = "Single Project"
        project.budget = 10000.0
        project.status = "planning"
        project.description = None
        project.priority = None
        project.start_date = None
        project.end_date = None
        project.manager_id = None
        project.team_members = []
        
        result = await import_service.import_projects(
            projects=[project],
            import_method="json"
        )
        
        assert result.success is True
        assert result.count == 1
        assert mock_db._insert_call_count["projects"] == 1
    
    @pytest.mark.asyncio
    async def test_large_batch_single_transaction(self, import_service, mock_db):
        """Test that large batch is inserted in single transaction"""
        projects = []
        for i in range(50):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = f"Project {i}"
            project.budget = 10000.0 + i
            project.status = "planning"
            project.description = None
            project.priority = None
            project.start_date = None
            project.end_date = None
            project.manager_id = None
            project.team_members = []
            projects.append(project)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result.success is True
        assert result.count == 50
        # Verify single transaction (one insert call)
        assert mock_db._insert_call_count["projects"] == 1
        # Verify all records inserted
        assert len(mock_db._inserted_records["projects"]) == 50
    
    @pytest.mark.asyncio
    async def test_database_error_rollback(self, import_service, mock_db):
        """Test that database error causes rollback with zero records"""
        # Create mock that fails on insert
        failing_mock_db = create_mock_db(should_fail_on_insert=True)
        import_service.db = failing_mock_db
        import_service.validator.db = failing_mock_db
        import_service.auditor.db = failing_mock_db
        
        projects = []
        for i in range(5):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = f"Project {i}"
            project.budget = 10000.0
            project.status = "planning"
            project.description = None
            project.priority = None
            project.start_date = None
            project.end_date = None
            project.manager_id = None
            project.team_members = []
            projects.append(project)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        # No records should be committed
        assert len(failing_mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_csv_import_uses_transaction(self, import_service, mock_db):
        """Test that CSV imports also use single transaction"""
        projects = []
        for i in range(10):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = f"CSV Project {i}"
            project.budget = 10000.0 + i
            project.status = "active"
            project.description = None
            project.priority = None
            project.start_date = None
            project.end_date = None
            project.manager_id = None
            project.team_members = []
            projects.append(project)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="csv"
        )
        
        assert result.success is True
        assert result.count == 10
        # Verify single transaction
        assert mock_db._insert_call_count["projects"] == 1
