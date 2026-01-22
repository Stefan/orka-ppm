"""
Property-Based Test for Date Format Validation
Feature: project-import-mvp
Property 6: Invalid date formats are rejected

**Validates: Requirements 3.4, 8.2**

Requirements 3.4: WHEN a date field is not in ISO format, 
THE Validation_Engine SHALL reject that record

Requirements 8.2: WHEN a date value is provided, THE Validation_Engine 
SHALL verify it matches ISO 8601 format (YYYY-MM-DD)
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import Mock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


# Strategy for generating invalid date formats
@st.composite
def invalid_date_format(draw):
    """
    Generate date values that do not match ISO 8601 format (YYYY-MM-DD).
    
    Invalid formats include:
    - US format (MM/DD/YYYY)
    - European format (DD/MM/YYYY)
    - Reversed format (DD-MM-YYYY)
    - Missing separators
    - Invalid separators
    - Partial dates
    - Text dates
    - Invalid month/day values
    - Random strings
    """
    invalid_type = draw(st.sampled_from([
        "us_format",
        "european_format",
        "reversed_format",
        "no_separators",
        "wrong_separators",
        "partial_date",
        "text_date",
        "invalid_month",
        "invalid_day",
        "random_string",
        "timestamp_format",
        "year_only",
        "month_year",
        "extra_components"
    ]))
    
    if invalid_type == "us_format":
        # US format: MM/DD/YYYY
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{month:02d}/{day:02d}/{year}"
    elif invalid_type == "european_format":
        # European format: DD/MM/YYYY
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{day:02d}/{month:02d}/{year}"
    elif invalid_type == "reversed_format":
        # Reversed format: DD-MM-YYYY
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{day:02d}-{month:02d}-{year}"
    elif invalid_type == "no_separators":
        # No separators: YYYYMMDD
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{year}{month:02d}{day:02d}"
    elif invalid_type == "wrong_separators":
        # Wrong separators: YYYY.MM.DD or YYYY/MM/DD
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        sep = draw(st.sampled_from([".", "/", "_", " "]))
        value = f"{year}{sep}{month:02d}{sep}{day:02d}"
    elif invalid_type == "partial_date":
        # Partial dates: YYYY-MM or MM-DD
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = draw(st.sampled_from([f"{year}-{month:02d}", f"{month:02d}-{day:02d}"]))
    elif invalid_type == "text_date":
        # Text dates: "January 15, 2024" or "15 Jan 2024"
        value = draw(st.sampled_from([
            "January 15, 2024",
            "15 Jan 2024",
            "Jan 15 2024",
            "15th January 2024",
            "2024 January 15"
        ]))
    elif invalid_type == "invalid_month":
        # Invalid month values (13-99)
        month = draw(st.integers(min_value=13, max_value=99))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{year}-{month:02d}-{day:02d}"
    elif invalid_type == "invalid_day":
        # Invalid day values (32-99)
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=32, max_value=99))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{year}-{month:02d}-{day:02d}"
    elif invalid_type == "random_string":
        # Random non-date strings
        value = draw(st.sampled_from([
            "not-a-date",
            "invalid",
            "tomorrow",
            "yesterday",
            "next week",
            "TBD",
            "N/A",
            "???"
        ]))
    elif invalid_type == "timestamp_format":
        # Full timestamp format (not just date)
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        hour = draw(st.integers(min_value=0, max_value=23))
        minute = draw(st.integers(min_value=0, max_value=59))
        # Note: ISO 8601 with time is actually valid for fromisoformat, 
        # so we use a non-standard format
        value = f"{month:02d}/{day:02d}/{year} {hour:02d}:{minute:02d}"
    elif invalid_type == "year_only":
        # Year only
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = str(year)
    elif invalid_type == "month_year":
        # Month and year only
        month = draw(st.integers(min_value=1, max_value=12))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{year}-{month:02d}"
    elif invalid_type == "extra_components":
        # Extra components
        month = draw(st.integers(min_value=1, max_value=12))
        day = draw(st.integers(min_value=1, max_value=28))
        year = draw(st.integers(min_value=2000, max_value=2030))
        value = f"{year}-{month:02d}-{day:02d}-extra"
    else:
        value = "invalid-date"
    
    return {
        "value": value,
        "type": invalid_type
    }


# Strategy for generating valid project data with invalid date
@st.composite
def project_with_invalid_date(draw):
    """
    Generate complete project data with an invalid date format.
    All other fields are valid.
    """
    # Generate valid values for other fields
    valid_name = draw(st.text(
        min_size=1, 
        max_size=50, 
        alphabet=st.characters(whitelist_categories=('L', 'N'), blacklist_characters='\x00')
    ).filter(lambda x: x.strip()))
    
    valid_status = draw(st.sampled_from([s.value for s in ProjectStatus]))
    valid_budget = draw(st.floats(min_value=0, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate invalid date
    date_info = draw(invalid_date_format())
    
    # Decide which date field to make invalid
    date_field = draw(st.sampled_from(["start_date", "end_date"]))
    
    return {
        "name": valid_name,
        "budget": valid_budget,
        "status": valid_status,
        "invalid_date": date_info["value"],
        "invalid_date_type": date_info["type"],
        "date_field": date_field
    }


class TestDateValidationProperty:
    """
    Property-based tests for date format validation.
    
    Property 6: Invalid date formats are rejected
    **Validates: Requirements 3.4, 8.2**
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
    
    @given(project_data=project_with_invalid_date())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_6_invalid_date_formats_rejected(
        self, 
        project_data, 
        validation_service, 
        mock_db
    ):
        """
        Property 6: Invalid date formats are rejected
        
        **Validates: Requirements 3.4, 8.2**
        
        For any project record with a date field that does not match ISO 8601 format 
        (YYYY-MM-DD), the Validation_Engine should reject that record with an error 
        identifying the invalid date.
        """
        # Feature: project-import-mvp, Property 6: Invalid date formats are rejected
        
        # Create a mock project object that mimics ProjectCreate
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        
        # Set the invalid date on the appropriate field
        if project_data["date_field"] == "start_date":
            project.start_date = project_data["invalid_date"]
            project.end_date = None
        else:
            project.start_date = None
            project.end_date = project_data["invalid_date"]
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Invalid date formats MUST be rejected
        assert error is not None, (
            f"Expected validation error for invalid date format "
            f"(value: {project_data['invalid_date']!r}, type: {project_data['invalid_date_type']}, "
            f"field: {project_data['date_field']}), but validation passed"
        )
        
        # The error should identify the date field
        assert error["field"] == project_data["date_field"], (
            f"Expected error for field '{project_data['date_field']}', "
            f"but got error for field '{error['field']}'"
        )
        
        # The error should have proper structure
        assert "index" in error, "Error should contain 'index' field"
        assert "error" in error, "Error should contain 'error' message"
        assert "value" in error, "Error should contain 'value' field"
        assert error["index"] == 0, "Error index should match the provided index"
        
        # The error message should indicate date format issue
        error_msg = error["error"].lower()
        assert "date" in error_msg or "iso" in error_msg or "format" in error_msg, (
            f"Error message should indicate date format issue: {error['error']}"
        )


class TestDateValidationEdgeCases:
    """
    Additional edge case tests for date validation.
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
    
    def test_valid_iso_date_accepted(self, validation_service):
        """Test that valid ISO 8601 dates are accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = "2024-01-15"
        project.end_date = "2024-12-31"
        
        error = validation_service.validate_project(project, index=0)
        
        # Should not have date error
        if error is not None:
            assert error["field"] not in ["start_date", "end_date"], (
                f"Valid ISO date should be accepted, got error: {error}"
            )
    
    def test_none_dates_accepted(self, validation_service):
        """Test that None dates are accepted (optional fields)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should not have date error
        if error is not None:
            assert error["field"] not in ["start_date", "end_date"], (
                f"None dates should be accepted, got error: {error}"
            )
    
    def test_us_date_format_rejected(self, validation_service):
        """Test that US date format (MM/DD/YYYY) is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = "01/15/2024"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None, "US date format should be rejected"
        assert error["field"] == "start_date", "Error should be for start_date field"
    
    def test_european_date_format_rejected(self, validation_service):
        """Test that European date format (DD/MM/YYYY) is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = None
        project.end_date = "15/01/2024"
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None, "European date format should be rejected"
        assert error["field"] == "end_date", "Error should be for end_date field"
    
    def test_text_date_rejected(self, validation_service):
        """Test that text dates are rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = "January 15, 2024"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None, "Text date should be rejected"
        assert error["field"] == "start_date", "Error should be for start_date field"
    
    def test_partial_date_rejected(self, validation_service):
        """Test that partial dates (YYYY-MM) are rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000
        project.status = "planning"
        project.start_date = "2024-01"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None, "Partial date should be rejected"
        assert error["field"] == "start_date", "Error should be for start_date field"

