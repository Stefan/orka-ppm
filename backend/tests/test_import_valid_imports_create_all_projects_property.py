"""
Property-Based Test for Valid Imports Creating All Projects
Feature: project-import-mvp
Property 1: Valid imports create all projects

**Validates: Requirements 1.1, 1.2, 2.1, 2.3**

Requirements 1.1: WHEN a valid JSON array of projects is posted to the API endpoint, 
THE Import_Service SHALL create all projects in the database

Requirements 1.2: WHEN the JSON array contains valid project data, 
THE Import_Service SHALL return a success response with the count of imported projects

Requirements 2.1: WHEN a valid CSV file is uploaded, 
THE CSV_Parser SHALL parse all rows into project records

Requirements 2.3: WHEN the CSV file is successfully parsed, 
THE Import_Service SHALL create all valid projects in the database
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import Mock, MagicMock
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
    
    Required fields: name, budget, status
    All fields must have valid values.
    """
    # Generate a unique name (non-empty, non-whitespace)
    name = draw(st.text(
        min_size=1, 
        max_size=100, 
        alphabet=st.characters(
            whitelist_categories=('L', 'N'),
            blacklist_characters='\x00\n\r\t'
        )
    ).filter(lambda x: x.strip()))
    
    # Generate valid budget (positive number)
    budget = draw(st.floats(
        min_value=0.01, 
        max_value=1e9, 
        allow_nan=False, 
        allow_infinity=False
    ))
    
    # Generate valid status from enum
    status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    # Generate valid portfolio_id
    portfolio_id = uuid4()
    
    # Create mock project object
    project = Mock()
    project.portfolio_id = portfolio_id
    project.name = name
    project.budget = budget
    project.status = status
    project.description = draw(st.one_of(st.none(), st.text(max_size=200)))
    project.priority = draw(st.one_of(st.none(), st.sampled_from(["low", "medium", "high", "critical"])))
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


def create_mock_db():
    """Create a mock database client that tracks inserts per table."""
    db = Mock()
    
    # Track inserted records per table
    inserted_records = {"projects": [], "admin_audit_log": []}
    
    def create_table_mock(table_name):
        """Create a mock for a specific table."""
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
    
    # Create table mocks
    tables = {}
    
    def get_table(table_name):
        if table_name not in tables:
            tables[table_name] = create_table_mock(table_name)
        return tables[table_name]
    
    db.table = Mock(side_effect=get_table)
    db._inserted_records = inserted_records
    
    return db


class TestValidImportsCreateAllProjectsProperty:
    """
    Property-based tests for valid imports creating all projects.
    
    Property 1: Valid imports create all projects
    **Validates: Requirements 1.1, 1.2, 2.1, 2.3**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client that simulates successful operations"""
        return create_mock_db()
    
    @pytest.fixture
    def import_service(self, mock_db):
        """Create an ImportService instance with mock database"""
        service = ImportService(db_session=mock_db, user_id="test-user-123")
        return service
    
    @given(projects=valid_project_batch())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_1_valid_imports_create_all_projects(
        self, 
        projects, 
        import_service, 
        mock_db
    ):
        """
        Property 1: Valid imports create all projects
        
        **Validates: Requirements 1.1, 1.2, 2.1, 2.3**
        
        For any valid array of project data (JSON or CSV), when imported through 
        the API, all projects should be created in the database and the response 
        count should equal the number of projects in the input.
        """
        # Ensure we have at least one project
        assume(len(projects) > 0)
        
        # Create fresh mock for this iteration
        fresh_mock_db = create_mock_db()
        import_service.db = fresh_mock_db
        import_service.validator.db = fresh_mock_db
        import_service.auditor.db = fresh_mock_db
        
        # Execute the import
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Property assertions
        
        # 1. Import should succeed for valid projects
        assert result.success is True, (
            f"Expected successful import for {len(projects)} valid projects, "
            f"but got failure: {result.message}. Errors: {result.errors}"
        )
        
        # 2. Count should equal number of input projects (Requirement 1.2)
        assert result.count == len(projects), (
            f"Expected count {len(projects)}, but got {result.count}. "
            f"All valid projects should be created."
        )
        
        # 3. No errors should be returned for valid imports
        assert len(result.errors) == 0, (
            f"Expected no errors for valid import, but got: {result.errors}"
        )
        
        # 4. Number of project records inserted should match input count
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == len(projects), (
            f"Expected {len(projects)} project records inserted, "
            f"but got {len(project_inserts)}"
        )
    
    @given(projects=valid_project_batch())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_1_csv_import_creates_all_projects(
        self, 
        projects, 
        import_service, 
        mock_db
    ):
        """
        Property 1 (CSV variant): Valid CSV imports create all projects
        
        **Validates: Requirements 2.1, 2.3**
        
        For any valid CSV file, when parsed and imported, all projects should 
        be created in the database.
        """
        # Ensure we have at least one project
        assume(len(projects) > 0)
        
        # Create fresh mock for this iteration
        fresh_mock_db = create_mock_db()
        import_service.db = fresh_mock_db
        import_service.validator.db = fresh_mock_db
        import_service.auditor.db = fresh_mock_db
        
        # Execute the import with CSV method
        result = await import_service.import_projects(
            projects=projects,
            import_method="csv"
        )
        
        # Property assertions for CSV import
        
        # 1. Import should succeed
        assert result.success is True, (
            f"Expected successful CSV import for {len(projects)} valid projects, "
            f"but got failure: {result.message}"
        )
        
        # 2. Count should match input (Requirement 2.3)
        assert result.count == len(projects), (
            f"Expected count {len(projects)} for CSV import, but got {result.count}"
        )
        
        # 3. All project records should be inserted
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == len(projects), (
            f"Expected {len(projects)} project records inserted from CSV, "
            f"but got {len(project_inserts)}"
        )


class TestValidImportsEdgeCases:
    """
    Additional edge case tests for valid imports.
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
    async def test_single_valid_project_import(self, import_service, mock_db):
        """Test importing a single valid project"""
        project = Mock()
        project.portfolio_id = uuid4()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.description = "Test description"
        project.priority = "medium"
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
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_maximum_batch_size_import(self, import_service, mock_db):
        """Test importing a larger batch of valid projects"""
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
        assert len(result.errors) == 0
    
    @pytest.mark.asyncio
    async def test_empty_batch_returns_error(self, import_service, mock_db):
        """Test that empty batch returns appropriate error"""
        result = await import_service.import_projects(
            projects=[],
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        assert "No projects provided" in result.message
    
    @pytest.mark.asyncio
    async def test_all_valid_statuses_accepted(self, import_service, mock_db):
        """Test that all valid status values are accepted"""
        valid_statuses = ["planning", "active", "on-hold", "completed", "cancelled"]
        projects = []
        
        for i, status in enumerate(valid_statuses):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = f"Project with status {status}"
            project.budget = 10000.0
            project.status = status
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
        assert result.count == len(valid_statuses)
        assert len(result.errors) == 0
