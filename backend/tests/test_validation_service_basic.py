"""
Basic unit tests for ValidationService

These tests verify the core functionality of the validation service including
required field validation, data type validation, and duplicate name checking.
"""

import pytest
from unittest.mock import Mock, MagicMock
from datetime import date
from uuid import uuid4

from services.validation_service import ValidationService
from models.projects import ProjectCreate
from models.base import ProjectStatus


class TestValidationService:
    """Test suite for ValidationService"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def validation_service(self, mock_db):
        """Create a ValidationService instance with mock database"""
        return ValidationService(db_client=mock_db)
    
    @pytest.fixture
    def portfolio_id(self):
        """Create a test portfolio ID"""
        return uuid4()
    
    def test_validate_project_success(self, validation_service, mock_db, portfolio_id):
        """Test validation of a valid project (with budget)"""
        # Arrange
        project = ProjectCreate(
            portfolio_id=portfolio_id,
            name="Test Project",
            budget=10000.0,
            status=ProjectStatus.planning,
            description="Test description"
        )
        
        # Mock no duplicate name
        mock_response = Mock()
        mock_response.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is None

    def test_validate_project_success_without_budget(self, validation_service, mock_db, portfolio_id):
        """Test validation passes when budget is None (budget is optional)"""
        # Arrange
        project = ProjectCreate(
            portfolio_id=portfolio_id,
            name="Test Project No Budget",
            budget=None,
            status=ProjectStatus.planning
        )
        
        # Mock no duplicate name
        mock_response = Mock()
        mock_response.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is None

    def test_validate_project_invalid_budget_value(self, validation_service, mock_db, portfolio_id):
        """Test validation fails when budget is provided but not numeric"""
        # Arrange - use Mock to pass non-numeric budget (Pydantic would reject it on ProjectCreate)
        project = Mock()
        project.name = "Test Project"
        project.budget = "not_a_number"
        project.status = ProjectStatus.planning
        project.start_date = None
        project.end_date = None
        
        # Mock no duplicate name
        mock_response = Mock()
        mock_response.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is not None
        assert error["field"] == "budget"
        assert "numeric" in error["error"].lower()
    
    def test_validate_project_missing_name(self, validation_service, mock_db, portfolio_id):
        """Test validation fails when name is missing"""
        # Arrange
        project = ProjectCreate(
            portfolio_id=portfolio_id,
            name="",
            budget=10000.0,
            status=ProjectStatus.planning
        )
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is not None
        assert error["field"] == "name"
        assert "missing or empty" in error["error"]
    
    def test_validate_project_invalid_status(self, validation_service, mock_db, portfolio_id):
        """Test validation fails with invalid status"""
        # Arrange - Create project with string status that will be validated
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = "invalid_status"
        project.start_date = None
        project.end_date = None
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is not None
        assert error["field"] == "status"
    
    def test_validate_project_duplicate_name(self, validation_service, mock_db, portfolio_id):
        """Test validation fails when project name already exists"""
        # Arrange
        project = ProjectCreate(
            portfolio_id=portfolio_id,
            name="Existing Project",
            budget=10000.0,
            status=ProjectStatus.planning
        )
        
        # Mock duplicate name found
        mock_response = Mock()
        mock_response.data = [{"id": "existing-id"}]
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is not None
        assert error["field"] == "name"
        assert "already exists" in error["error"]
    
    def test_validate_project_invalid_date_format(self, validation_service, mock_db, portfolio_id):
        """Test validation fails with invalid date format"""
        # Arrange - Use mock to bypass Pydantic validation
        project = Mock()
        project.name = "Test Project"
        project.budget = 10000.0
        project.status = ProjectStatus.planning
        project.start_date = "invalid-date"
        project.end_date = None
        
        # Mock no duplicate name
        mock_response = Mock()
        mock_response.data = []
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response
        
        # Act
        error = validation_service.validate_project(project, 0)
        
        # Assert
        assert error is not None
        assert error["field"] == "start_date"
        assert "ISO 8601" in error["error"]
    
    def test_validate_budget_numeric(self, validation_service):
        """Test budget validation with numeric values"""
        # Test valid numeric values
        assert validation_service._validate_budget(10000.0) is True
        assert validation_service._validate_budget(10000) is True
        assert validation_service._validate_budget("10000.50") is True
        
        # Test invalid values
        assert validation_service._validate_budget(None) is False
        assert validation_service._validate_budget("not_a_number") is False
        assert validation_service._validate_budget("") is False
    
    def test_validate_date_iso_format(self, validation_service):
        """Test date validation with ISO 8601 format"""
        # Test valid dates
        assert validation_service._validate_date("2024-01-15") is True
        assert validation_service._validate_date("2024-12-31") is True
        
        # Test invalid dates
        assert validation_service._validate_date("") is False
        assert validation_service._validate_date("01/15/2024") is False
        assert validation_service._validate_date("invalid") is False
    
    def test_validate_status_allowed_values(self, validation_service):
        """Test status validation with allowed values"""
        # Test valid statuses
        assert validation_service._validate_status("planning") is True
        assert validation_service._validate_status("active") is True
        assert validation_service._validate_status("completed") is True
        
        # Test invalid statuses
        assert validation_service._validate_status("") is False
        assert validation_service._validate_status("invalid") is False
        assert validation_service._validate_status(None) is False
    
    def test_check_required_fields(self, validation_service, portfolio_id):
        """Test required fields checking (required: name, status; budget is optional)"""
        # Test with all required fields present (with budget)
        project = ProjectCreate(
            portfolio_id=portfolio_id,
            name="Test Project",
            budget=10000.0,
            status=ProjectStatus.planning
        )
        assert validation_service._check_required_fields(project) is None

        # Test with required fields present but no budget (budget optional)
        project_no_budget = ProjectCreate(
            portfolio_id=portfolio_id,
            name="Test Project",
            budget=None,
            status=ProjectStatus.planning
        )
        assert validation_service._check_required_fields(project_no_budget) is None
        
        # Test with missing name
        project_no_name = ProjectCreate(
            portfolio_id=portfolio_id,
            name="",
            budget=10000.0,
            status=ProjectStatus.planning
        )
        assert validation_service._check_required_fields(project_no_name) == "name"
        
        # Test with whitespace-only name
        project_whitespace = ProjectCreate(
            portfolio_id=portfolio_id,
            name="   ",
            budget=10000.0,
            status=ProjectStatus.planning
        )
        assert validation_service._check_required_fields(project_whitespace) == "name"
