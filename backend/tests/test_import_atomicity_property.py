"""
Property-Based Test for Import Atomicity
Feature: project-import-mvp
Property 8: Import atomicity (all-or-nothing)

**Validates: Requirements 3.6, 9.1, 9.5**

Requirements 3.6: WHEN some records are valid and others invalid, THE Import_Service 
SHALL reject the entire import batch and maintain database consistency

Requirements 9.1: WHEN any record in an import batch fails validation, THE Import_Service 
SHALL reject the entire batch

Requirements 9.5: THE Import_Service SHALL ensure no partial imports are committed to the database
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import Mock
from uuid import uuid4
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.import_service import ImportService, ImportResult
from services.validation_service import ValidationService
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


# Strategy for generating invalid project data
@st.composite
def invalid_project(draw):
    """
    Generate project data with a validation error.
    """
    error_type = draw(st.sampled_from([
        "missing_name",
        "missing_budget", 
        "missing_status",
        "invalid_budget",
        "invalid_status",
    ]))
    
    project = Mock()
    project.portfolio_id = uuid4()
    project.description = None
    project.priority = None
    project.start_date = None
    project.end_date = None
    project.manager_id = None
    project.team_members = []
    
    # Set valid defaults
    project.name = draw(st.text(
        min_size=1, 
        max_size=50, 
        alphabet=st.characters(whitelist_categories=('L', 'N'))
    ).filter(lambda x: x.strip()))
    project.budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    project.status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    # Introduce the specific error
    if error_type == "missing_name":
        project.name = draw(st.sampled_from([None, "", "   "]))
    elif error_type == "missing_budget":
        project.budget = None
    elif error_type == "missing_status":
        project.status = draw(st.sampled_from([None, "", "   "]))
    elif error_type == "invalid_budget":
        project.budget = draw(st.text(
            min_size=1, 
            max_size=20, 
            alphabet=st.characters(whitelist_categories=('L',))
        ).filter(lambda x: x.strip()))
    elif error_type == "invalid_status":
        project.status = draw(st.text(
            min_size=1, 
            max_size=20, 
            alphabet=st.characters(whitelist_categories=('L',))
        ).filter(lambda x: x.strip() and x not in [s.value for s in ProjectStatus]))
    
    return project


@st.composite
def mixed_batch_with_invalid(draw):
    """
    Generate a batch containing both valid and invalid projects.
    At least one project must be invalid.
    """
    # Generate 1-5 valid projects
    num_valid = draw(st.integers(min_value=1, max_value=5))
    valid_projects = []
    used_names = set()
    
    for _ in range(num_valid):
        project = draw(valid_project())
        # Ensure unique names
        base_name = project.name
        counter = 1
        while project.name in used_names:
            project.name = f"{base_name}_{counter}"
            counter += 1
        used_names.add(project.name)
        valid_projects.append(project)
    
    # Generate 1-3 invalid projects
    num_invalid = draw(st.integers(min_value=1, max_value=3))
    invalid_projects = []
    
    for _ in range(num_invalid):
        project = draw(invalid_project())
        # Ensure unique names for invalid projects too (if they have names)
        if project.name and project.name.strip():
            base_name = project.name
            counter = 1
            while project.name in used_names:
                project.name = f"{base_name}_{counter}"
                counter += 1
            used_names.add(project.name)
        invalid_projects.append(project)
    
    # Randomly interleave valid and invalid projects
    all_projects = valid_projects + invalid_projects
    # Shuffle using hypothesis
    indices = draw(st.permutations(range(len(all_projects))))
    shuffled = [all_projects[i] for i in indices]
    
    return {
        "projects": shuffled,
        "num_valid": num_valid,
        "num_invalid": num_invalid,
        "total": num_valid + num_invalid
    }


def create_mock_db():
    """Create a mock database client that tracks inserts."""
    db = Mock()
    
    # Track inserted records
    inserted_records = {"projects": [], "admin_audit_log": []}
    
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


class TestImportAtomicityProperty:
    """
    Property-based tests for import atomicity.
    
    Property 8: Import atomicity (all-or-nothing)
    **Validates: Requirements 3.6, 9.1, 9.5**
    
    For any import batch containing at least one invalid record, the Import_Service 
    should reject the entire batch and ensure zero projects from that batch are 
    created in the database.
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        return create_mock_db()
    
    @pytest.fixture
    def import_service(self, mock_db):
        """Create an ImportService instance with mock database"""
        return ImportService(db_session=mock_db, user_id="test-user-123")
    
    @given(batch_info=mixed_batch_with_invalid())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_8_import_atomicity_with_invalid_records(
        self, 
        batch_info, 
        import_service, 
        mock_db
    ):
        """
        Property 8: Import atomicity (all-or-nothing)
        
        **Validates: Requirements 3.6, 9.1, 9.5**
        
        For any import batch containing at least one invalid record, the Import_Service 
        should reject the entire batch and ensure zero projects from that batch are 
        created in the database.
        """
        projects = batch_info["projects"]
        num_valid = batch_info["num_valid"]
        num_invalid = batch_info["num_invalid"]
        total = batch_info["total"]
        
        # Ensure we have at least one invalid project
        assume(num_invalid > 0)
        
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
        
        # Property assertion 1: Import MUST fail when batch contains invalid records
        # (Requirement 9.1)
        assert result.success is False, (
            f"Expected import to fail for batch with {num_invalid} invalid projects "
            f"out of {total} total, but import succeeded. "
            f"Valid: {num_valid}, Invalid: {num_invalid}"
        )
        
        # Property assertion 2: Count MUST be zero (no partial imports)
        # (Requirement 9.5)
        assert result.count == 0, (
            f"Expected zero projects imported when batch contains invalid records, "
            f"but got count={result.count}. "
            f"Valid: {num_valid}, Invalid: {num_invalid}"
        )
        
        # Property assertion 3: No projects should be inserted into database
        # (Requirement 3.6 - maintain database consistency)
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == 0, (
            f"Expected zero project records in database when batch contains invalid records, "
            f"but found {len(project_inserts)} records inserted. "
            f"This violates atomicity - partial imports should not occur. "
            f"Valid: {num_valid}, Invalid: {num_invalid}"
        )
        
        # Property assertion 4: Errors list should not be empty
        assert len(result.errors) > 0, (
            f"Expected at least one error for batch with {num_invalid} invalid projects"
        )
        
        # Property assertion 5: Result should have a failure message
        assert result.message, (
            f"Result should have a failure message"
        )
        assert "fail" in result.message.lower() or "validation" in result.message.lower(), (
            f"Failure message should indicate validation failure: {result.message}"
        )
    
    @given(
        num_valid=st.integers(min_value=1, max_value=10),
        invalid_position=st.sampled_from(["first", "middle", "last"])
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_8_single_invalid_rejects_entire_batch(
        self, 
        num_valid, 
        invalid_position, 
        import_service, 
        mock_db
    ):
        """
        Property 8: Single invalid record rejects entire batch
        
        **Validates: Requirements 3.6, 9.1, 9.5**
        
        For any batch of valid projects with a single invalid project inserted at 
        any position, the entire batch should be rejected with zero projects created.
        """
        # Create fresh mock for this iteration
        fresh_mock_db = create_mock_db()
        import_service.db = fresh_mock_db
        import_service.validator.db = fresh_mock_db
        import_service.auditor.db = fresh_mock_db
        
        # Create valid projects
        valid_projects = []
        for i in range(num_valid):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = f"Valid Project {i}"
            project.budget = 10000.0 + i
            project.status = "planning"
            project.description = None
            project.priority = None
            project.start_date = None
            project.end_date = None
            project.manager_id = None
            project.team_members = []
            valid_projects.append(project)
        
        # Create one invalid project
        invalid_project = Mock()
        invalid_project.portfolio_id = uuid4()
        invalid_project.name = None  # Invalid: missing required field
        invalid_project.budget = 10000.0
        invalid_project.status = "planning"
        invalid_project.description = None
        invalid_project.priority = None
        invalid_project.start_date = None
        invalid_project.end_date = None
        invalid_project.manager_id = None
        invalid_project.team_members = []
        
        # Insert invalid project at specified position
        if invalid_position == "first":
            projects = [invalid_project] + valid_projects
        elif invalid_position == "last":
            projects = valid_projects + [invalid_project]
        else:  # middle
            mid = len(valid_projects) // 2
            projects = valid_projects[:mid] + [invalid_project] + valid_projects[mid:]
        
        # Execute the import
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        # Property assertion: Import MUST fail
        assert result.success is False, (
            f"Expected import to fail with single invalid project at {invalid_position} "
            f"position in batch of {num_valid + 1} projects"
        )
        
        # Property assertion: Zero projects created
        assert result.count == 0, (
            f"Expected zero projects imported, but got {result.count}"
        )
        
        # Property assertion: No database inserts
        project_inserts = fresh_mock_db._inserted_records["projects"]
        assert len(project_inserts) == 0, (
            f"Expected zero database inserts, but found {len(project_inserts)}. "
            f"Single invalid project at {invalid_position} should reject entire batch."
        )


class TestImportAtomicityEdgeCases:
    """
    Edge case tests for import atomicity.
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
    async def test_all_invalid_batch_creates_zero_projects(self, import_service, mock_db):
        """Test that a batch with all invalid projects creates zero projects"""
        # Create all invalid projects
        invalid_projects = []
        for i in range(5):
            project = Mock()
            project.portfolio_id = uuid4()
            project.name = None  # Invalid
            project.budget = 10000.0
            project.status = "planning"
            project.description = None
            project.priority = None
            project.start_date = None
            project.end_date = None
            project.manager_id = None
            project.team_members = []
            invalid_projects.append(project)
        
        result = await import_service.import_projects(
            projects=invalid_projects,
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_first_project_invalid_rejects_batch(self, import_service, mock_db):
        """Test that invalid first project rejects entire batch"""
        projects = []
        
        # First project is invalid
        invalid = Mock()
        invalid.portfolio_id = uuid4()
        invalid.name = ""  # Invalid: empty name
        invalid.budget = 10000.0
        invalid.status = "planning"
        invalid.description = None
        invalid.priority = None
        invalid.start_date = None
        invalid.end_date = None
        invalid.manager_id = None
        invalid.team_members = []
        projects.append(invalid)
        
        # Rest are valid
        for i in range(4):
            valid = Mock()
            valid.portfolio_id = uuid4()
            valid.name = f"Valid Project {i}"
            valid.budget = 10000.0
            valid.status = "planning"
            valid.description = None
            valid.priority = None
            valid.start_date = None
            valid.end_date = None
            valid.manager_id = None
            valid.team_members = []
            projects.append(valid)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_last_project_invalid_rejects_batch(self, import_service, mock_db):
        """Test that invalid last project rejects entire batch"""
        projects = []
        
        # First projects are valid
        for i in range(4):
            valid = Mock()
            valid.portfolio_id = uuid4()
            valid.name = f"Valid Project {i}"
            valid.budget = 10000.0
            valid.status = "planning"
            valid.description = None
            valid.priority = None
            valid.start_date = None
            valid.end_date = None
            valid.manager_id = None
            valid.team_members = []
            projects.append(valid)
        
        # Last project is invalid
        invalid = Mock()
        invalid.portfolio_id = uuid4()
        invalid.name = "Invalid Project"
        invalid.budget = "not-a-number"  # Invalid budget
        invalid.status = "planning"
        invalid.description = None
        invalid.priority = None
        invalid.start_date = None
        invalid.end_date = None
        invalid.manager_id = None
        invalid.team_members = []
        projects.append(invalid)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="json"
        )
        
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0
    
    @pytest.mark.asyncio
    async def test_csv_import_atomicity(self, import_service, mock_db):
        """Test that CSV imports also maintain atomicity"""
        projects = []
        
        # Mix of valid and invalid
        valid = Mock()
        valid.portfolio_id = uuid4()
        valid.name = "Valid CSV Project"
        valid.budget = 10000.0
        valid.status = "planning"
        valid.description = None
        valid.priority = None
        valid.start_date = None
        valid.end_date = None
        valid.manager_id = None
        valid.team_members = []
        projects.append(valid)
        
        invalid = Mock()
        invalid.portfolio_id = uuid4()
        invalid.name = "Invalid CSV Project"
        invalid.budget = 10000.0
        invalid.status = "invalid_status"  # Invalid status
        invalid.description = None
        invalid.priority = None
        invalid.start_date = None
        invalid.end_date = None
        invalid.manager_id = None
        invalid.team_members = []
        projects.append(invalid)
        
        result = await import_service.import_projects(
            projects=projects,
            import_method="csv"
        )
        
        assert result.success is False
        assert result.count == 0
        assert len(mock_db._inserted_records["projects"]) == 0

