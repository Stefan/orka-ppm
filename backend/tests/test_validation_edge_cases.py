"""
Unit Tests for Validation Edge Cases
Feature: project-import-mvp
Task: 2.8 Write unit tests for validation edge cases

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Tests edge cases for validation including:
- Empty strings vs null values
- Whitespace-only fields
- Maximum field lengths
"""

import pytest
from unittest.mock import Mock
from uuid import uuid4

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.validation_service import ValidationService
from models.base import ProjectStatus


class TestEmptyStringsVsNullValues:
    """
    Test empty strings vs null values for required fields.
    
    **Validates: Requirements 3.1, 8.4**
    
    Requirements 3.1: WHEN a project record is missing required fields (name, budget, status), 
    THE Validation_Engine SHALL reject that record
    
    Requirements 8.4: WHEN a required field is empty or null, THE Validation_Engine SHALL reject the record
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
    
    def test_null_name_rejected(self, validation_service):
        """Test that null name is rejected"""
        project = Mock()
        project.name = None
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
        assert "missing or empty" in error["error"].lower()
    
    def test_empty_string_name_rejected(self, validation_service):
        """Test that empty string name is rejected"""
        project = Mock()
        project.name = ""
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
        assert "missing or empty" in error["error"].lower()
    
    def test_null_budget_rejected(self, validation_service):
        """Test that null budget is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = None
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_null_status_rejected(self, validation_service):
        """Test that null status is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = None
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "status"
    
    def test_empty_string_status_rejected(self, validation_service):
        """Test that empty string status is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = ""
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "status"


class TestWhitespaceOnlyFields:
    """
    Test whitespace-only fields for required fields.
    
    **Validates: Requirements 3.1, 8.4**
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
    
    def test_spaces_only_name_rejected(self, validation_service):
        """Test that name with only spaces is rejected"""
        project = Mock()
        project.name = "   "
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_tabs_only_name_rejected(self, validation_service):
        """Test that name with only tabs is rejected"""
        project = Mock()
        project.name = "\t\t\t"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_newlines_only_name_rejected(self, validation_service):
        """Test that name with only newlines is rejected"""
        project = Mock()
        project.name = "\n\n\n"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_mixed_whitespace_name_rejected(self, validation_service):
        """Test that name with mixed whitespace is rejected"""
        project = Mock()
        project.name = " \t\n \r\n "
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "name"
    
    def test_spaces_only_status_rejected(self, validation_service):
        """Test that status with only spaces is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "   "
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "status"
    
    def test_name_with_leading_trailing_whitespace_accepted(self, validation_service):
        """Test that name with leading/trailing whitespace but valid content is accepted"""
        project = Mock()
        project.name = "  Valid Project Name  "
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Should be accepted since there's actual content
        assert error is None


class TestMaximumFieldLengths:
    """
    Test maximum field lengths for validation.
    
    **Validates: Requirements 3.1, 3.2**
    
    Note: The validation service doesn't currently enforce maximum field lengths,
    but these tests document expected behavior for very long inputs.
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
    
    def test_very_long_name_accepted(self, validation_service):
        """Test that very long names are accepted (no max length enforced)"""
        project = Mock()
        project.name = "A" * 1000  # 1000 character name
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Currently no max length validation, so should pass
        assert error is None
    
    def test_very_large_budget_accepted(self, validation_service):
        """Test that very large budgets are accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 1e15  # 1 quadrillion
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None
    
    def test_zero_budget_accepted(self, validation_service):
        """Test that zero budget is accepted (it's numeric)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None
    
    def test_negative_budget_accepted(self, validation_service):
        """Test that negative budget is accepted (it's numeric, business rules may differ)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = -1000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        # Negative is still numeric, so validation passes
        assert error is None


class TestBudgetEdgeCases:
    """
    Test budget validation edge cases.
    
    **Validates: Requirements 3.3, 8.1**
    
    Requirements 3.3: WHEN a budget field contains non-numeric data, 
    THE Validation_Engine SHALL reject that record
    
    Requirements 8.1: WHEN a budget value is provided, THE Validation_Engine 
    SHALL verify it can be parsed as a numeric value
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
    
    def test_empty_string_budget_rejected(self, validation_service):
        """Test that empty string budget is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = ""
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_whitespace_budget_rejected(self, validation_service):
        """Test that whitespace-only budget is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = "   "
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_nan_budget_rejected(self, validation_service):
        """Test that NaN budget is rejected"""
        import math
        project = Mock()
        project.name = "Test Project"
        project.budget = float('nan')
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_infinity_budget_rejected(self, validation_service):
        """Test that infinity budget is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = float('inf')
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_negative_infinity_budget_rejected(self, validation_service):
        """Test that negative infinity budget is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = float('-inf')
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "budget"
    
    def test_string_number_budget_accepted(self, validation_service):
        """Test that string representation of number is accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = "10000.50"
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None
    
    def test_scientific_notation_budget_accepted(self, validation_service):
        """Test that scientific notation budget is accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = "1e6"
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None


class TestDateEdgeCases:
    """
    Test date validation edge cases.
    
    **Validates: Requirements 3.4, 8.2**
    
    Requirements 3.4: WHEN a date field is not in ISO format, 
    THE Validation_Engine SHALL reject that record
    
    Requirements 8.2: WHEN a date value is provided, THE Validation_Engine 
    SHALL verify it matches ISO 8601 format (YYYY-MM-DD)
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
    
    def test_empty_string_date_rejected(self, validation_service):
        """Test that empty string date is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = ""
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
    
    def test_whitespace_date_rejected(self, validation_service):
        """Test that whitespace-only date is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "   "
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
    
    def test_null_dates_accepted(self, validation_service):
        """Test that null dates are accepted (optional fields)"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None
    
    def test_basic_iso_format_rejected(self, validation_service):
        """Test that basic ISO format (YYYYMMDD) is rejected - only extended format accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "20240115"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
    
    def test_invalid_month_rejected(self, validation_service):
        """Test that invalid month (13) is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "2024-13-01"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
    
    def test_invalid_day_rejected(self, validation_service):
        """Test that invalid day (32) is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "2024-01-32"
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
    
    def test_leap_year_feb_29_accepted(self, validation_service):
        """Test that Feb 29 on leap year is accepted"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "2024-02-29"  # 2024 is a leap year
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None
    
    def test_non_leap_year_feb_29_rejected(self, validation_service):
        """Test that Feb 29 on non-leap year is rejected"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = "2023-02-29"  # 2023 is not a leap year
        project.end_date = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is not None
        assert error["field"] == "start_date"
