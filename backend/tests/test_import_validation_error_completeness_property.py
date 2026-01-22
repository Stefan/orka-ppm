"""
Property-Based Test for Validation Error Completeness
Feature: project-import-mvp
Property 7: Validation errors are comprehensive

**Validates: Requirements 3.5, 7.1**

Requirements 3.5: WHEN validation fails for any record, THE Import_Service SHALL return 
detailed error messages identifying the invalid records and reasons

Requirements 7.1: WHEN validation fails, THE Import_Service SHALL return error messages 
that identify the specific record and field that failed
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.import_service import ImportService, ImportResult
from services.validation_service import ValidationService
from models.base import ProjectStatus


# Strategy for generating invalid project data with various validation errors
@st.composite
def invalid_project_data(draw):
    """
    Generate project data with a specific validation error.
    Returns the project data and metadata about what error it should produce.
    """
    # Choose which type of validation error to introduce
    error_type = draw(st.sampled_from([
        "missing_name",
        "missing_budget", 
        "missing_status",
        "invalid_budget",
        "invalid_status",
        "invalid_start_date",
        "invalid_end_date"
    ]))
    
    # Generate base valid values
    valid_name = draw(st.text(min_size=1, max_size=50, alphabet=st.characters(
        whitelist_categories=('L', 'N'),
        blacklist_characters='\x00'
    )).filter(lambda x: x.strip()))
    valid_budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    valid_status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    # Start with valid project data
    project_data = {
        "name": valid_name,
        "budget": valid_budget,
        "status": valid_status,
        "start_date": None,
        "end_date": None,
    }
    
    expected_field = None
    expected_value = None
    
    # Introduce the specific error
    if error_type == "missing_name":
        invalid_name_type = draw(st.sampled_from([None, "", "   "]))
        project_data["name"] = invalid_name_type
        expected_field = "name"
        expected_value = invalid_name_type
    elif error_type == "missing_budget":
        project_data["budget"] = None
        expected_field = "budget"
        expected_value = None
    elif error_type == "missing_status":
        invalid_status_type = draw(st.sampled_from([None, "", "   "]))
        project_data["status"] = invalid_status_type
        expected_field = "status"
        expected_value = invalid_status_type
    elif error_type == "invalid_budget":
        # Generate non-numeric budget string
        invalid_budget = draw(st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=('L',)
        )).filter(lambda x: x.strip()))
        project_data["budget"] = invalid_budget
        expected_field = "budget"
        expected_value = invalid_budget
    elif error_type == "invalid_status":
        # Generate invalid status value
        invalid_status = draw(st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=('L',)
        )).filter(lambda x: x.strip() and x not in [s.value for s in ProjectStatus]))
        project_data["status"] = invalid_status
        expected_field = "status"
        expected_value = invalid_status
    elif error_type == "invalid_start_date":
        # Generate invalid date format
        invalid_date = draw(st.sampled_from([
            "2024/01/15",  # Wrong separator
            "01-15-2024",  # Wrong order
            "2024-13-01",  # Invalid month
            "2024-01-32",  # Invalid day
            "not-a-date",
            "20240115",    # No separators
        ]))
        project_data["start_date"] = invalid_date
        expected_field = "start_date"
        expected_value = invalid_date
    elif error_type == "invalid_end_date":
        # Generate invalid date format
        invalid_date = draw(st.sampled_from([
            "2024/12/31",  # Wrong separator
            "12-31-2024",  # Wrong order
            "2024-00-15",  # Invalid month
            "2024-02-30",  # Invalid day
            "invalid",
            "20241231",    # No separators
        ]))
        project_data["end_date"] = invalid_date
        expected_field = "end_date"
        expected_value = invalid_date
    
    return {
        "data": project_data,
        "error_type": error_type,
        "expected_field": expected_field,
        "expected_value": expected_value
    }


@st.composite
def batch_with_invalid_projects(draw):
    """
    Generate a batch of projects where some are invalid.
    Returns the batch and metadata about expected errors.
    """
    # Generate 1-5 invalid projects
    num_invalid = draw(st.integers(min_value=1, max_value=5))
    
    invalid_projects = []
    expected_errors = []
    
    for i in range(num_invalid):
        invalid_info = draw(invalid_project_data())
        invalid_projects.append(invalid_info["data"])
        expected_errors.append({
            "index": i,
            "expected_field": invalid_info["expected_field"],
            "expected_value": invalid_info["expected_value"],
            "error_type": invalid_info["error_type"]
        })
    
    return {
        "projects": invalid_projects,
        "expected_errors": expected_errors,
        "num_invalid": num_invalid
    }


class TestValidationErrorCompletenessProperty:
    """
    Property-based tests for validation error completeness.
    
    Property 7: Validation errors are comprehensive
    **Validates: Requirements 3.5, 7.1**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        # Mock no duplicate names found
        mock_response = Mock()
        mock_response.data = []
        db.table = Mock(return_value=Mock())
        db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create a ValidationService instance with mock database"""
        return ValidationService(db_client=mock_db)
    
    @given(invalid_info=invalid_project_data())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_7_single_invalid_project_error_completeness(
        self, 
        invalid_info, 
        validation_service
    ):
        """
        Property 7: Validation errors are comprehensive (single project)
        
        **Validates: Requirements 3.5, 7.1**
        
        For any project record with a validation error, the error response should contain:
        - index: The record index
        - field: The specific field that failed
        - value: The invalid value
        - error: A human-readable error description
        """
        project_data = invalid_info["data"]
        expected_field = invalid_info["expected_field"]
        expected_value = invalid_info["expected_value"]
        error_type = invalid_info["error_type"]
        
        # Skip date validation tests if the date is actually valid
        # (some generated dates might accidentally be valid)
        if error_type in ["invalid_start_date", "invalid_end_date"]:
            # These are pre-selected invalid dates, so they should fail
            pass
        
        # Create a mock project object
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = project_data["start_date"]
        project.end_date = project_data["end_date"]
        
        test_index = 42  # Use a specific index to verify it's preserved
        
        # Validate the project
        error = validation_service.validate_project(project, index=test_index)
        
        # Property assertion: Invalid projects MUST produce an error
        assert error is not None, (
            f"Expected validation error for {error_type}, but validation passed. "
            f"Project data: {project_data}"
        )
        
        # Property assertion: Error MUST contain 'index' field
        assert "index" in error, (
            f"Error response missing 'index' field. Error: {error}"
        )
        assert error["index"] == test_index, (
            f"Error index should be {test_index}, got {error['index']}"
        )
        
        # Property assertion: Error MUST contain 'field' field
        assert "field" in error, (
            f"Error response missing 'field' field. Error: {error}"
        )
        assert isinstance(error["field"], str), (
            f"Error 'field' should be a string, got {type(error['field'])}"
        )
        assert len(error["field"]) > 0, (
            f"Error 'field' should not be empty"
        )
        
        # Property assertion: Error MUST contain 'value' field
        assert "value" in error, (
            f"Error response missing 'value' field. Error: {error}"
        )
        
        # Property assertion: Error MUST contain 'error' field with human-readable message
        assert "error" in error, (
            f"Error response missing 'error' field. Error: {error}"
        )
        assert isinstance(error["error"], str), (
            f"Error 'error' should be a string, got {type(error['error'])}"
        )
        assert len(error["error"]) > 0, (
            f"Error message should not be empty"
        )
        
        # Property assertion: Error message should be human-readable
        # (contains words, not just codes or symbols)
        error_msg = error["error"]
        assert any(c.isalpha() for c in error_msg), (
            f"Error message should contain readable text: {error_msg}"
        )
    
    @given(batch_info=batch_with_invalid_projects())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_7_batch_validation_error_completeness(
        self, 
        batch_info, 
        validation_service, 
        mock_db
    ):
        """
        Property 7: Validation errors are comprehensive (batch)
        
        **Validates: Requirements 3.5, 7.1**
        
        For any import batch containing invalid records, the Import_Service should 
        return error messages that identify every invalid record by index, the specific 
        field that failed, the invalid value, and a human-readable error description.
        """
        projects_data = batch_info["projects"]
        expected_errors = batch_info["expected_errors"]
        num_invalid = batch_info["num_invalid"]
        
        # Create mock project objects
        projects = []
        for project_data in projects_data:
            project = Mock()
            project.name = project_data["name"]
            project.budget = project_data["budget"]
            project.status = project_data["status"]
            project.start_date = project_data["start_date"]
            project.end_date = project_data["end_date"]
            projects.append(project)
        
        # Create ImportService with mock dependencies
        import_service = ImportService(db_session=mock_db, user_id="test-user")
        
        # Run the import (synchronously for testing)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                import_service.import_projects(projects, import_method="json")
            )
        finally:
            loop.close()
        
        # Property assertion: Import should fail for invalid batch
        assert result.success is False, (
            f"Expected import to fail for batch with {num_invalid} invalid projects"
        )
        
        # Property assertion: Errors list should not be empty
        assert len(result.errors) > 0, (
            f"Expected at least one error for batch with {num_invalid} invalid projects"
        )
        
        # Property assertion: Each error should have complete structure
        for error in result.errors:
            # Must have index
            assert "index" in error, (
                f"Error missing 'index' field: {error}"
            )
            assert isinstance(error["index"], int), (
                f"Error 'index' should be an integer: {error}"
            )
            
            # Must have field
            assert "field" in error, (
                f"Error missing 'field' field: {error}"
            )
            assert isinstance(error["field"], str), (
                f"Error 'field' should be a string: {error}"
            )
            
            # Must have value
            assert "value" in error, (
                f"Error missing 'value' field: {error}"
            )
            
            # Must have error message
            assert "error" in error, (
                f"Error missing 'error' field: {error}"
            )
            assert isinstance(error["error"], str), (
                f"Error 'error' should be a string: {error}"
            )
            assert len(error["error"]) > 0, (
                f"Error message should not be empty: {error}"
            )
        
        # Property assertion: Result should have a summary message
        assert result.message, (
            f"Result should have a summary message"
        )
        assert isinstance(result.message, str), (
            f"Result message should be a string"
        )


class TestValidationErrorCompletenessEdgeCases:
    """
    Edge case tests for validation error completeness.
    These complement the property-based tests with specific scenarios.
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        mock_response = Mock()
        mock_response.data = []
        db.table = Mock(return_value=Mock())
        db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create a ValidationService instance with mock database"""
        return ValidationService(db_client=mock_db)
    
    def test_error_contains_all_required_fields(self, validation_service):
        """Test that error response contains all required fields"""
        project = Mock()
        project.name = ""  # Invalid: empty name
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=5)
        
        assert error is not None
        assert "index" in error
        assert "field" in error
        assert "value" in error
        assert "error" in error
        
        # Verify specific values
        assert error["index"] == 5
        assert error["field"] == "name"
        assert error["value"] == ""
    
    def test_error_index_preserved_correctly(self, validation_service):
        """Test that error index matches the provided index"""
        project = Mock()
        project.name = None
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        # Test with various indices
        for test_index in [0, 1, 10, 100, 999]:
            error = validation_service.validate_project(project, index=test_index)
            assert error is not None
            assert error["index"] == test_index
    
    def test_error_value_captures_invalid_input(self, validation_service):
        """Test that error value captures the actual invalid input"""
        project = Mock()
        project.name = "Valid Name"
        project.budget = "not-a-number"  # Invalid budget
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
        assert error["value"] == "not-a-number"
    
    def test_error_message_is_descriptive(self, validation_service):
        """Test that error message provides useful information"""
        project = Mock()
        project.name = "Valid Name"
        project.budget = 10000.0
        project.status = "invalid_status_value"  # Invalid status
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "status"
        # Error message should mention valid status values
        assert "status" in error["error"].lower() or "must be" in error["error"].lower()
