"""
Property-Based Test for Duplicate Name Detection
Feature: project-import-mvp
Property 4: Duplicate names are rejected

**Validates: Requirements 3.2**

Requirements 3.2: WHEN a project name already exists in the database, 
THE Validation_Engine SHALL reject that record as a duplicate
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import Mock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


# Strategy for generating valid project names
@st.composite
def valid_project_name(draw):
    """
    Generate valid project names that are non-empty and non-whitespace.
    """
    name = draw(st.text(
        min_size=1, 
        max_size=100, 
        alphabet=st.characters(
            whitelist_categories=('L', 'N', 'P', 'S'),
            blacklist_characters='\x00'
        )
    ).filter(lambda x: x.strip()))
    return name


# Strategy for generating valid project data
@st.composite
def valid_project_data(draw):
    """
    Generate valid project data with all required fields.
    """
    name = draw(valid_project_name())
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    return {
        "name": name,
        "budget": budget,
        "status": status
    }


class TestDuplicateNameProperty:
    """
    Property-based tests for duplicate name detection.
    
    Property 4: Duplicate names are rejected
    **Validates: Requirements 3.2**
    """
    
    @pytest.fixture
    def mock_db_with_duplicate(self):
        """Create a mock database client that returns a duplicate"""
        db = Mock()
        mock_response = Mock()
        # Simulate finding an existing project with the same name
        mock_response.data = [{"id": "existing-project-id"}]
        
        mock_table = Mock()
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        db.table.return_value = mock_table
        
        return db
    
    @pytest.fixture
    def mock_db_no_duplicate(self):
        """Create a mock database client that returns no duplicate"""
        db = Mock()
        mock_response = Mock()
        # Simulate no existing project with the same name
        mock_response.data = []
        
        mock_table = Mock()
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        db.table.return_value = mock_table
        
        return db
    
    @given(project_data=valid_project_data())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_4_duplicate_names_rejected(
        self, 
        project_data, 
        mock_db_with_duplicate
    ):
        """
        Property 4: Duplicate names are rejected
        
        **Validates: Requirements 3.2**
        
        For any project record with a name that already exists in the database,
        the Validation_Engine should reject that record with an error identifying 
        the duplicate name.
        """
        validation_service = ValidationService(db_client=mock_db_with_duplicate)
        
        # Create a mock project object
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = None
        project.end_date = None
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Duplicate names MUST be rejected
        assert error is not None, (
            f"Expected validation error for duplicate name '{project_data['name']}', "
            f"but validation passed"
        )
        
        # The error should identify the name field
        assert error["field"] == "name", (
            f"Expected error for field 'name', "
            f"but got error for field '{error['field']}'"
        )
        
        # The error should have proper structure
        assert "index" in error, "Error should contain 'index' field"
        assert "error" in error, "Error should contain 'error' message"
        assert "value" in error, "Error should contain 'value' field"
        assert error["index"] == 0, "Error index should match the provided index"
        
        # The error message should indicate duplicate
        error_msg = error["error"].lower()
        assert "already exists" in error_msg or "duplicate" in error_msg, (
            f"Error message should indicate duplicate: {error['error']}"
        )
        
        # The error value should be the duplicate name
        assert error["value"] == project_data["name"], (
            f"Error value should be the duplicate name '{project_data['name']}', "
            f"but got '{error['value']}'"
        )
    
    @given(project_data=valid_project_data())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_4_unique_names_accepted(
        self, 
        project_data, 
        mock_db_no_duplicate
    ):
        """
        Property 4 (inverse): Unique names are accepted
        
        **Validates: Requirements 3.2**
        
        For any project record with a name that does NOT exist in the database,
        the Validation_Engine should accept that record (assuming all other 
        validations pass).
        """
        validation_service = ValidationService(db_client=mock_db_no_duplicate)
        
        # Create a mock project object with valid data
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = None
        project.end_date = None
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Unique names should be accepted
        assert error is None, (
            f"Expected validation to pass for unique name '{project_data['name']}', "
            f"but got error: {error}"
        )


class TestDuplicateNameEdgeCases:
    """
    Additional edge case tests for duplicate name detection.
    These complement the property-based tests with specific scenarios.
    """
    
    @pytest.fixture
    def mock_db_with_duplicate(self):
        """Create a mock database client that returns a duplicate"""
        db = Mock()
        mock_response = Mock()
        mock_response.data = [{"id": "existing-project-id"}]
        
        mock_table = Mock()
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        db.table.return_value = mock_table
        
        return db
    
    @pytest.fixture
    def mock_db_no_duplicate(self):
        """Create a mock database client that returns no duplicate"""
        db = Mock()
        mock_response = Mock()
        mock_response.data = []
        
        mock_table = Mock()
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        db.table.return_value = mock_table
        
        return db
    
    def test_exact_duplicate_name_rejected(self, mock_db_with_duplicate):
        """Test exact duplicate name is rejected"""
        validation_service = ValidationService(db_client=mock_db_with_duplicate)
        
        project = Mock()
        project.name = "Existing Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
        assert "already exists" in error["error"].lower()
    
    def test_database_query_uses_correct_name(self, mock_db_no_duplicate):
        """Test that database query uses the exact project name"""
        validation_service = ValidationService(db_client=mock_db_no_duplicate)
        
        project = Mock()
        project.name = "Test Project Name"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        validation_service.validate_project(project, index=0)
        
        # Verify the database was queried with the correct name
        mock_db_no_duplicate.table.assert_called_with("projects")
        mock_db_no_duplicate.table.return_value.select.assert_called_with("id")
        mock_db_no_duplicate.table.return_value.select.return_value.eq.assert_called_with("name", "Test Project Name")
    
    def test_multiple_duplicates_in_database(self):
        """Test when multiple projects with same name exist in database"""
        db = Mock()
        mock_response = Mock()
        # Simulate multiple existing projects with the same name
        mock_response.data = [
            {"id": "project-1"},
            {"id": "project-2"}
        ]
        
        mock_table = Mock()
        mock_select = Mock()
        mock_eq = Mock()
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        db.table.return_value = mock_table
        
        validation_service = ValidationService(db_client=db)
        
        project = Mock()
        project.name = "Duplicate Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_database_error_graceful_handling(self):
        """Test that database errors are handled gracefully"""
        db = Mock()
        # Simulate database error
        db.table.side_effect = Exception("Database connection failed")
        
        validation_service = ValidationService(db_client=db)
        
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        # Should not raise exception, should pass validation
        # (as per implementation: if duplicate check fails, don't fail validation)
        error = validation_service.validate_project(project, index=0)
        
        # Validation should pass when database check fails
        assert error is None
