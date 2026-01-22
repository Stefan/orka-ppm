"""
Property-Based Test for Missing Required Fields Validation
Feature: project-import-mvp
Property 3: Missing required fields are rejected

**Validates: Requirements 3.1, 8.4**

Requirements 3.1: WHEN a project record is missing required fields (name, budget, status), 
THE Validation_Engine SHALL reject that record

Requirements 8.4: WHEN a required field is empty or null, THE Validation_Engine SHALL reject the record
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import Mock
from uuid import uuid4
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


# Strategy for generating project data with missing required fields
@st.composite
def project_with_missing_required_field(draw):
    """
    Generate project data with at least one required field missing or empty.
    Required fields: name, budget, status
    
    For string fields (name, status): can be None, empty string, or whitespace-only
    For numeric fields (budget): can only be None (empty/whitespace don't apply)
    """
    # Decide which required field to make invalid
    missing_field = draw(st.sampled_from(["name", "budget", "status"]))
    
    # For budget, only None is a valid "missing" state
    # For string fields, we can have None, empty, or whitespace
    if missing_field == "budget":
        invalid_type = "none"  # Budget can only be None to be invalid
    else:
        invalid_type = draw(st.sampled_from(["none", "empty", "whitespace"]))
    
    # Generate valid values for other fields
    valid_name = draw(st.text(min_size=1, max_size=100, alphabet=st.characters(
        whitelist_categories=('L', 'N', 'P', 'S'),
        blacklist_characters='\x00'
    )).filter(lambda x: x.strip()))
    valid_budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    valid_status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    # Create project data with one invalid field
    project_data = {
        "name": valid_name,
        "budget": valid_budget,
        "status": valid_status,
    }
    
    # Make the selected field invalid
    if missing_field == "name":
        if invalid_type == "none":
            project_data["name"] = None
        elif invalid_type == "empty":
            project_data["name"] = ""
        else:  # whitespace
            project_data["name"] = "   "
    elif missing_field == "budget":
        # Budget is numeric, so only None makes it invalid
        project_data["budget"] = None
    elif missing_field == "status":
        if invalid_type == "none":
            project_data["status"] = None
        elif invalid_type == "empty":
            project_data["status"] = ""
        else:  # whitespace
            project_data["status"] = "   "
    
    return {
        "data": project_data,
        "missing_field": missing_field,
        "invalid_type": invalid_type
    }


class TestMissingRequiredFieldsProperty:
    """
    Property-based tests for missing required fields validation.
    
    Property 3: Missing required fields are rejected
    **Validates: Requirements 3.1, 8.4**
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
    
    @given(project_info=project_with_missing_required_field())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_3_missing_required_fields_rejected(
        self, 
        project_info, 
        validation_service, 
        mock_db
    ):
        """
        Property 3: Missing required fields are rejected
        
        **Validates: Requirements 3.1, 8.4**
        
        For any project record missing one or more required fields (name, budget, or status),
        the Validation_Engine should reject that record with an error identifying the missing field.
        """
        project_data = project_info["data"]
        missing_field = project_info["missing_field"]
        invalid_type = project_info["invalid_type"]
        
        # Create a mock project object that mimics ProjectCreate
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = None
        project.end_date = None
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Missing required fields MUST be rejected
        assert error is not None, (
            f"Expected validation error for missing/invalid {missing_field} "
            f"(type: {invalid_type}), but validation passed"
        )
        
        # The error should identify the correct field
        assert error["field"] == missing_field, (
            f"Expected error for field '{missing_field}', "
            f"but got error for field '{error['field']}'"
        )
        
        # The error should have proper structure
        assert "index" in error, "Error should contain 'index' field"
        assert "error" in error, "Error should contain 'error' message"
        assert error["index"] == 0, "Error index should match the provided index"
        
        # The error message should indicate the field is missing or empty
        error_msg = error["error"].lower()
        assert "missing" in error_msg or "empty" in error_msg, (
            f"Error message should indicate field is missing or empty: {error['error']}"
        )


class TestMissingRequiredFieldsEdgeCases:
    """
    Additional edge case tests for missing required fields.
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
    
    def test_all_required_fields_missing(self, validation_service):
        """Test when all required fields are missing"""
        project = Mock()
        project.name = None
        project.budget = None
        project.status = None
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should reject with error for first missing field found
        assert error is not None
        assert error["field"] in ["name", "budget", "status"]
    
    def test_name_with_only_newlines(self, validation_service):
        """Test name field with only newline characters"""
        project = Mock()
        project.name = "\n\n\n"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_name_with_only_tabs(self, validation_service):
        """Test name field with only tab characters"""
        project = Mock()
        project.name = "\t\t\t"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
