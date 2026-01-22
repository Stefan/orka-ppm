"""
Property-Based Test for Status Validation
Feature: project-import-mvp
Property 9: Invalid status values are rejected

**Validates: Requirements 8.3**

Requirements 8.3: WHEN a status value is provided, THE Validation_Engine 
SHALL verify it matches one of the allowed status values
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import Mock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


# Valid status values from the ProjectStatus enum
VALID_STATUSES = [status.value for status in ProjectStatus]


# Strategy for generating invalid status values
@st.composite
def invalid_status(draw):
    """
    Generate status values that are NOT in the allowed set.
    
    Valid statuses are: planning, active, on-hold, completed, cancelled
    
    Invalid values include:
    - Misspelled valid statuses
    - Similar but incorrect values
    - Random strings
    - Numeric values
    - Empty-like values (but not empty string - that's a required field issue)
    - Case variations (if case-sensitive)
    """
    invalid_type = draw(st.sampled_from([
        "misspelled",
        "similar_incorrect",
        "random_string",
        "numeric_string",
        "case_variation",
        "special_chars",
        "whitespace_padded"
    ]))
    
    if invalid_type == "misspelled":
        # Misspelled versions of valid statuses
        value = draw(st.sampled_from([
            "planing",      # missing 'n'
            "actve",        # missing 'i'
            "onhold",       # missing hyphen
            "on_hold",      # underscore instead of hyphen
            "complted",     # missing 'e'
            "cancled",      # missing 'l'
            "canceled",     # American spelling (if British is expected)
            "cancelled ",   # trailing space
        ]))
    elif invalid_type == "similar_incorrect":
        # Similar but incorrect status values
        value = draw(st.sampled_from([
            "planned",
            "in_progress",
            "in-progress",
            "pending",
            "started",
            "finished",
            "done",
            "closed",
            "archived",
            "draft",
            "new",
            "open",
            "paused",
            "suspended",
            "terminated",
            "inactive"
        ]))
    elif invalid_type == "random_string":
        # Random alphabetic strings that aren't valid statuses
        value = draw(st.text(
            min_size=1,
            max_size=20,
            alphabet=st.characters(whitelist_categories=('L',))
        ).filter(lambda x: x.strip() and x.lower() not in [s.lower() for s in VALID_STATUSES]))
    elif invalid_type == "numeric_string":
        # Numeric values as strings
        value = draw(st.sampled_from([
            "0", "1", "2", "3", "4", "5",
            "100", "200", "999",
            "1.0", "2.5"
        ]))
    elif invalid_type == "case_variation":
        # Case variations of valid statuses (if validation is case-sensitive)
        value = draw(st.sampled_from([
            "PLANNING",
            "ACTIVE",
            "ON-HOLD",
            "COMPLETED",
            "CANCELLED",
            "Planning",
            "Active",
            "On-Hold",
            "Completed",
            "Cancelled",
            "PLANNING",
            "pLaNnInG"
        ]))
    elif invalid_type == "special_chars":
        # Status with special characters
        value = draw(st.sampled_from([
            "active!",
            "@planning",
            "completed#",
            "on-hold$",
            "cancelled%"
        ]))
    elif invalid_type == "whitespace_padded":
        # Valid statuses with whitespace padding
        value = draw(st.sampled_from([
            " planning",
            "active ",
            " on-hold ",
            "  completed",
            "cancelled  "
        ]))
    else:
        value = "invalid_status"
    
    return {
        "value": value,
        "type": invalid_type
    }


# Strategy for generating valid project data with invalid status
@st.composite
def project_with_invalid_status(draw):
    """
    Generate complete project data with an invalid status value.
    All other fields are valid.
    """
    # Generate valid values for other fields
    valid_name = draw(st.text(
        min_size=1,
        max_size=100,
        alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'S'), blacklist_characters='\x00')
    ).filter(lambda x: x.strip()))
    
    valid_budget = draw(st.floats(min_value=0, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate invalid status
    status_info = draw(invalid_status())
    
    return {
        "name": valid_name,
        "budget": valid_budget,
        "status": status_info["value"],
        "status_type": status_info["type"]
    }


class TestStatusValidationProperty:
    """
    Property-based tests for status validation.
    
    Property 9: Invalid status values are rejected
    **Validates: Requirements 8.3**
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
    
    @given(project_data=project_with_invalid_status())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_9_invalid_status_values_rejected(
        self,
        project_data,
        validation_service,
        mock_db
    ):
        """
        Property 9: Invalid status values are rejected
        
        **Validates: Requirements 8.3**
        
        For any project record with a status value not in the allowed set 
        (planning, active, on-hold, completed, cancelled), the Validation_Engine 
        should reject that record with an error identifying the invalid status.
        """
        # Feature: project-import-mvp, Property 9: Invalid status values are rejected
        
        # Create a mock project object that mimics ProjectCreate
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = None
        project.end_date = None
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Invalid status values MUST be rejected
        assert error is not None, (
            f"Expected validation error for invalid status "
            f"(value: {project_data['status']!r}, type: {project_data['status_type']}), "
            f"but validation passed. Valid statuses are: {VALID_STATUSES}"
        )
        
        # The error should identify the status field
        assert error["field"] == "status", (
            f"Expected error for field 'status', "
            f"but got error for field '{error['field']}'"
        )
        
        # The error should have proper structure
        assert "index" in error, "Error should contain 'index' field"
        assert "error" in error, "Error should contain 'error' message"
        assert "value" in error, "Error should contain 'value' field"
        assert error["index"] == 0, "Error index should match the provided index"
        
        # The error message should indicate valid status values
        error_msg = error["error"].lower()
        assert "status" in error_msg or any(s in error_msg for s in VALID_STATUSES), (
            f"Error message should reference status or valid values: {error['error']}"
        )


class TestStatusValidationEdgeCases:
    """
    Additional edge case tests for status validation.
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
    
    @pytest.mark.parametrize("valid_status", VALID_STATUSES)
    def test_valid_status_accepted(self, validation_service, valid_status):
        """Test that all valid status values are accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = valid_status
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should not have status error (may have other errors)
        if error is not None:
            assert error["field"] != "status", (
                f"Valid status '{valid_status}' should be accepted, "
                f"but got error: {error}"
            )
    
    def test_empty_status_rejected_as_required_field(self, validation_service):
        """Test that empty status is rejected (as missing required field)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = ""
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should be rejected (either as missing required field or invalid status)
        assert error is not None, "Empty status should be rejected"
    
    def test_none_status_rejected_as_required_field(self, validation_service):
        """Test that None status is rejected (as missing required field)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = None
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should be rejected (as missing required field)
        assert error is not None, "None status should be rejected"
    
    def test_whitespace_only_status_rejected(self, validation_service):
        """Test that whitespace-only status is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "   "
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should be rejected
        assert error is not None, "Whitespace-only status should be rejected"
