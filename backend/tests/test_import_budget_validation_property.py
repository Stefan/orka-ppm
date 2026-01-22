"""
Property-Based Test for Budget Validation
Feature: project-import-mvp
Property 5: Non-numeric budgets are rejected

**Validates: Requirements 3.3, 8.1**

Requirements 3.3: WHEN a budget field contains non-numeric data, 
THE Validation_Engine SHALL reject that record

Requirements 8.1: WHEN a budget value is provided, THE Validation_Engine 
SHALL verify it can be parsed as a numeric value
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import Mock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


# Strategy for generating non-numeric budget values
@st.composite
def non_numeric_budget(draw):
    """
    Generate budget values that cannot be parsed as numeric.
    
    Non-numeric values include:
    - Alphabetic strings
    - Mixed alphanumeric strings
    - Special characters
    - Currency symbols with text
    - Empty strings (handled separately as missing field)
    """
    non_numeric_type = draw(st.sampled_from([
        "alphabetic",
        "alphanumeric", 
        "special_chars",
        "currency_text",
        "boolean_string",
        "nan_string",
        "inf_string",
        "list_value",
        "dict_value"
    ]))
    
    if non_numeric_type == "alphabetic":
        # Pure alphabetic strings
        value = draw(st.text(
            min_size=1, 
            max_size=20, 
            alphabet=st.characters(whitelist_categories=('L',))
        ).filter(lambda x: x.strip() and not _is_numeric(x)))
    elif non_numeric_type == "alphanumeric":
        # Mixed letters and numbers that can't be parsed as float
        letters = draw(st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=('L',))))
        numbers = draw(st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=('N',))))
        value = draw(st.sampled_from([letters + numbers, numbers + letters]))
    elif non_numeric_type == "special_chars":
        # Special characters that aren't valid numbers
        value = draw(st.sampled_from(["@#$", "!@#", "***", "---", "...", "///"]))
    elif non_numeric_type == "currency_text":
        # Currency with text that can't be parsed
        value = draw(st.sampled_from(["$abc", "€xyz", "USD", "EUR", "one hundred", "fifty thousand"]))
    elif non_numeric_type == "boolean_string":
        # Boolean-like strings
        value = draw(st.sampled_from(["true", "false", "True", "False", "yes", "no"]))
    elif non_numeric_type == "nan_string":
        # NaN-like strings (not valid float in Python)
        value = draw(st.sampled_from(["NaN", "nan", "NAN", "null", "NULL", "None", "undefined"]))
    elif non_numeric_type == "inf_string":
        # Infinity-like strings
        value = draw(st.sampled_from(["infinity", "Infinity", "INFINITY", "-infinity"]))
    elif non_numeric_type == "list_value":
        # List values (not numeric)
        value = [1, 2, 3]
    elif non_numeric_type == "dict_value":
        # Dict values (not numeric)
        value = {"amount": 1000}
    else:
        value = "invalid"
    
    return {
        "value": value,
        "type": non_numeric_type
    }


def _is_numeric(value):
    """Helper to check if a value can be parsed as numeric"""
    if value is None:
        return False
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


# Strategy for generating valid project data with non-numeric budget
@st.composite
def project_with_non_numeric_budget(draw):
    """
    Generate complete project data with a non-numeric budget value.
    All other fields are valid.
    """
    # Generate valid values for other fields
    valid_name = draw(st.text(
        min_size=1, 
        max_size=100, 
        alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'S'), blacklist_characters='\x00')
    ).filter(lambda x: x.strip()))
    
    valid_status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    
    # Generate non-numeric budget
    budget_info = draw(non_numeric_budget())
    
    return {
        "name": valid_name,
        "budget": budget_info["value"],
        "status": valid_status,
        "budget_type": budget_info["type"]
    }


class TestBudgetValidationProperty:
    """
    Property-based tests for budget validation.
    
    Property 5: Non-numeric budgets are rejected
    **Validates: Requirements 3.3, 8.1**
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
    
    @given(project_data=project_with_non_numeric_budget())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_5_non_numeric_budgets_rejected(
        self, 
        project_data, 
        validation_service, 
        mock_db
    ):
        """
        Property 5: Non-numeric budgets are rejected
        
        **Validates: Requirements 3.3, 8.1**
        
        For any project record with a budget value that cannot be parsed as a number,
        the Validation_Engine should reject that record with an error identifying 
        the invalid budget.
        """
        # Create a mock project object that mimics ProjectCreate
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = None
        project.end_date = None
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Non-numeric budgets MUST be rejected
        assert error is not None, (
            f"Expected validation error for non-numeric budget "
            f"(value: {project_data['budget']!r}, type: {project_data['budget_type']}), "
            f"but validation passed"
        )
        
        # The error should identify the budget field
        assert error["field"] == "budget", (
            f"Expected error for field 'budget', "
            f"but got error for field '{error['field']}'"
        )
        
        # The error should have proper structure
        assert "index" in error, "Error should contain 'index' field"
        assert "error" in error, "Error should contain 'error' message"
        assert "value" in error, "Error should contain 'value' field"
        assert error["index"] == 0, "Error index should match the provided index"
        
        # The error message should indicate budget must be numeric
        error_msg = error["error"].lower()
        assert "numeric" in error_msg or "number" in error_msg, (
            f"Error message should indicate budget must be numeric: {error['error']}"
        )


class TestBudgetValidationEdgeCases:
    """
    Additional edge case tests for budget validation.
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
    
    def test_valid_integer_budget_accepted(self, validation_service):
        """Test that valid integer budgets are accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should not have budget error (may have other errors)
        if error is not None:
            assert error["field"] != "budget", "Valid integer budget should be accepted"
    
    def test_valid_float_budget_accepted(self, validation_service):
        """Test that valid float budgets are accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.50
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        if error is not None:
            assert error["field"] != "budget", "Valid float budget should be accepted"
    
    def test_valid_string_number_budget_accepted(self, validation_service):
        """Test that valid numeric strings are accepted as budgets"""
        project = Mock()
        project.name = "Test Project"
        project.budget = "10000.50"
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        if error is not None:
            assert error["field"] != "budget", "Valid numeric string budget should be accepted"
    
    def test_zero_budget_accepted(self, validation_service):
        """Test that zero budget is accepted (it's numeric)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        if error is not None:
            assert error["field"] != "budget", "Zero budget should be accepted"
    
    def test_negative_budget_accepted_as_numeric(self, validation_service):
        """Test that negative budget is accepted (it's numeric, business rules may differ)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = -1000
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        if error is not None:
            assert error["field"] != "budget", "Negative budget should be accepted as numeric"
    
    def test_scientific_notation_budget_accepted(self, validation_service):
        """Test that scientific notation is accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = "1e6"  # 1,000,000
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        if error is not None:
            assert error["field"] != "budget", "Scientific notation budget should be accepted"
