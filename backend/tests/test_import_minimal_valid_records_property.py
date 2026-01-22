"""
Property-Based Test for Minimal Valid Records Acceptance
Feature: project-import-mvp
Property 10: Minimal valid records are accepted

**Validates: Requirements 8.5**

Requirements 8.5: WHEN optional fields are missing, THE Validation_Engine SHALL accept 
the record and use default values
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


# Strategy for generating minimal valid project data
@st.composite
def minimal_valid_project(draw):
    """
    Generate project data with only required fields (name, budget, status).
    Optional fields (start_date, end_date, description) are explicitly set to None.
    
    Required fields:
    - name: non-empty, non-whitespace string
    - budget: positive numeric value
    - status: valid status from ProjectStatus enum
    
    Optional fields (set to None):
    - start_date
    - end_date
    - description
    """
    # Generate valid required fields
    name = draw(st.text(
        min_size=1, 
        max_size=100, 
        alphabet=st.characters(
            whitelist_categories=('L', 'N', 'P', 'S'),
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
    
    return {
        "name": name,
        "budget": budget,
        "status": status,
        "start_date": None,
        "end_date": None,
        "description": None
    }


class TestMinimalValidRecordsProperty:
    """
    Property-based tests for minimal valid records acceptance.
    
    Property 10: Minimal valid records are accepted
    **Validates: Requirements 8.5**
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
    
    @given(project_data=minimal_valid_project())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_10_minimal_valid_records_accepted(
        self, 
        project_data, 
        validation_service, 
        mock_db
    ):
        """
        Property 10: Minimal valid records are accepted
        
        **Validates: Requirements 8.5**
        
        For any project record containing only required fields (name, budget, status) 
        with valid values, the Validation_Engine should accept that record even when 
        optional fields (start_date, end_date, description) are missing.
        """
        # Create a mock project object that mimics ProjectCreate
        project = Mock()
        project.name = project_data["name"]
        project.budget = project_data["budget"]
        project.status = project_data["status"]
        project.start_date = project_data["start_date"]
        project.end_date = project_data["end_date"]
        project.description = project_data.get("description")
        
        # Validate the project
        error = validation_service.validate_project(project, index=0)
        
        # Property assertion: Minimal valid records MUST be accepted
        assert error is None, (
            f"Expected validation to pass for minimal valid record with "
            f"name='{project_data['name']}', budget={project_data['budget']}, "
            f"status='{project_data['status']}', but got error: {error}"
        )


class TestMinimalValidRecordsEdgeCases:
    """
    Additional edge case tests for minimal valid records.
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
    
    def test_minimal_record_with_single_char_name(self, validation_service):
        """Test minimal record with single character name"""
        project = Mock()
        project.name = "A"
        project.budget = 1000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        project.description = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None, f"Single character name should be valid, got error: {error}"
    
    def test_minimal_record_with_minimum_budget(self, validation_service):
        """Test minimal record with very small budget"""
        project = Mock()
        project.name = "Minimal Budget Project"
        project.budget = 0.01
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        project.description = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None, f"Minimal budget should be valid, got error: {error}"
    
    def test_minimal_record_with_each_status(self, validation_service):
        """Test minimal record with each valid status value"""
        valid_statuses = [s.value for s in ProjectStatus]
        
        for status in valid_statuses:
            project = Mock()
            project.name = f"Project with {status} status"
            project.budget = 10000.0
            project.status = status
            project.start_date = None
            project.end_date = None
            project.description = None
            
            error = validation_service.validate_project(project, index=0)
            
            assert error is None, (
                f"Minimal record with status '{status}' should be valid, got error: {error}"
            )
    
    def test_minimal_record_with_empty_string_description(self, validation_service):
        """Test that empty string description is treated same as None"""
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        project.description = ""
        
        error = validation_service.validate_project(project, index=0)
        
        # Empty description should be acceptable (it's optional)
        assert error is None, f"Empty description should be valid, got error: {error}"
    
    def test_minimal_record_with_integer_budget(self, validation_service):
        """Test minimal record with integer budget (not float)"""
        project = Mock()
        project.name = "Integer Budget Project"
        project.budget = 50000  # Integer, not float
        project.status = "active"
        project.start_date = None
        project.end_date = None
        project.description = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None, f"Integer budget should be valid, got error: {error}"
    
    def test_minimal_record_with_large_budget(self, validation_service):
        """Test minimal record with very large budget"""
        project = Mock()
        project.name = "Large Budget Project"
        project.budget = 999999999.99
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        project.description = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None, f"Large budget should be valid, got error: {error}"
    
    def test_minimal_record_with_special_chars_in_name(self, validation_service):
        """Test minimal record with special characters in name"""
        project = Mock()
        project.name = "Project-2024: Phase #1 (Q1)"
        project.budget = 75000.0
        project.status = "planning"
        project.start_date = None
        project.end_date = None
        project.description = None
        
        error = validation_service.validate_project(project, index=0)
        
        assert error is None, f"Name with special characters should be valid, got error: {error}"
