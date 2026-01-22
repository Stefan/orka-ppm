"""
Unit tests for Guest Access Controller Data Filtering

Tests permission-based data filtering, sanitization, and validation
for the shareable project URLs system.

Requirements: 2.2, 2.3, 2.4, 2.5, 5.2
"""

import pytest
from datetime import datetime, timezone, timedelta, date
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from services.guest_access_controller import GuestAccessController
from models.shareable_urls import SharePermissionLevel, FilteredProjectData


class TestDataSanitization:
    """Test suite for data sanitization"""
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.fixture
    def project_data_with_sensitive_fields(self):
        """Create project data with sensitive fields"""
        return {
            'id': str(uuid4()),
            'name': 'Test Project',
            'description': 'A test project',
            'status': 'active',
            'progress_percentage': 75.5,
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            # Sensitive financial data
            'budget': 1000000.00,
            'actual_cost': 750000.00,
            'spent': 750000.00,
            'financial_data': {'q1': 200000, 'q2': 250000},
            'cost_breakdown': {'labor': 500000, 'materials': 250000},
            # Sensitive internal notes
            'internal_notes': 'Confidential project notes',
            'private_notes': 'Private comments',
            'confidential_notes': 'Top secret information',
            # Sensitive metadata
            'created_by_email': 'admin@example.com',
            'updated_by_email': 'manager@example.com',
            # Non-sensitive fields
            'priority': 'high',
            'health': 'green'
        }
    
    def test_sanitize_removes_financial_data(self, controller, project_data_with_sensitive_fields):
        """Test that sanitization removes all financial data"""
        sanitized = controller._sanitize_project_data(project_data_with_sensitive_fields)
        
        # Financial fields should be removed
        assert 'budget' not in sanitized
        assert 'actual_cost' not in sanitized
        assert 'spent' not in sanitized
        assert 'financial_data' not in sanitized
        assert 'cost_breakdown' not in sanitized
        
        # Non-sensitive fields should remain
        assert sanitized['name'] == 'Test Project'
        assert sanitized['status'] == 'active'
    
    def test_sanitize_removes_internal_notes(self, controller, project_data_with_sensitive_fields):
        """Test that sanitization removes all internal notes"""
        sanitized = controller._sanitize_project_data(project_data_with_sensitive_fields)
        
        # Internal notes should be removed
        assert 'internal_notes' not in sanitized
        assert 'private_notes' not in sanitized
        assert 'confidential_notes' not in sanitized
    
    def test_sanitize_removes_sensitive_metadata(self, controller, project_data_with_sensitive_fields):
        """Test that sanitization removes sensitive metadata"""
        sanitized = controller._sanitize_project_data(project_data_with_sensitive_fields)
        
        # Sensitive metadata should be removed
        assert 'created_by_email' not in sanitized
        assert 'updated_by_email' not in sanitized
    
    def test_sanitize_preserves_non_sensitive_data(self, controller, project_data_with_sensitive_fields):
        """Test that sanitization preserves non-sensitive data"""
        sanitized = controller._sanitize_project_data(project_data_with_sensitive_fields)
        
        # Non-sensitive fields should be preserved
        assert sanitized['id'] == project_data_with_sensitive_fields['id']
        assert sanitized['name'] == 'Test Project'
        assert sanitized['description'] == 'A test project'
        assert sanitized['status'] == 'active'
        assert sanitized['progress_percentage'] == 75.5
        assert sanitized['priority'] == 'high'
        assert sanitized['health'] == 'green'
    
    def test_sanitize_empty_data(self, controller):
        """Test sanitization with empty data"""
        sanitized = controller._sanitize_project_data({})
        assert sanitized == {}
    
    def test_sanitize_does_not_modify_original(self, controller, project_data_with_sensitive_fields):
        """Test that sanitization does not modify the original data"""
        original_keys = set(project_data_with_sensitive_fields.keys())
        sanitized = controller._sanitize_project_data(project_data_with_sensitive_fields)
        
        # Original should still have all keys
        assert set(project_data_with_sensitive_fields.keys()) == original_keys
        # Sanitized should have fewer keys
        assert len(sanitized) < len(project_data_with_sensitive_fields)


class TestPermissionFiltering:
    """Test suite for permission-based filtering"""
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.fixture
    def sanitized_project_data(self):
        """Create sanitized project data (no sensitive fields)"""
        return {
            'id': str(uuid4()),
            'name': 'Test Project',
            'description': 'A test project',
            'status': 'active',
            'progress_percentage': 75.5,
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-06-01T00:00:00Z',
            'priority': 'high',
            'health': 'green',
            'portfolio_id': str(uuid4()),
            'manager_id': str(uuid4()),
            'milestones': [],
            'timeline': {},
            'documents': [],
            'team_members': [],
            'tasks': [],
            'schedules': [],
            'risks': [],
            'dependencies': [],
            'resources': []
        }
    
    def test_view_only_includes_basic_fields(self, controller, sanitized_project_data):
        """Test VIEW_ONLY permission includes only basic fields"""
        filtered = controller._filter_sensitive_fields(
            sanitized_project_data, 
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Should include basic fields
        assert 'id' in filtered
        assert 'name' in filtered
        assert 'description' in filtered
        assert 'status' in filtered
        assert 'progress_percentage' in filtered
        assert 'start_date' in filtered
        assert 'end_date' in filtered
        assert 'created_at' in filtered
        assert 'updated_at' in filtered
        
        # Should NOT include extended fields
        assert 'milestones' not in filtered
        assert 'timeline' not in filtered
        assert 'documents' not in filtered
        assert 'team_members' not in filtered
        assert 'tasks' not in filtered
        assert 'priority' not in filtered
        assert 'health' not in filtered
    
    def test_limited_data_includes_additional_fields(self, controller, sanitized_project_data):
        """Test LIMITED_DATA permission includes additional fields"""
        filtered = controller._filter_sensitive_fields(
            sanitized_project_data,
            SharePermissionLevel.LIMITED_DATA
        )
        
        # Should include basic fields
        assert 'id' in filtered
        assert 'name' in filtered
        assert 'status' in filtered
        
        # Should include additional fields
        assert 'milestones' in filtered
        assert 'timeline' in filtered
        assert 'documents' in filtered
        assert 'team_members' in filtered
        assert 'priority' in filtered
        assert 'health' in filtered
        assert 'portfolio_id' in filtered
        
        # Should NOT include full project fields
        assert 'tasks' not in filtered
        assert 'schedules' not in filtered
        assert 'risks' not in filtered
    
    def test_full_project_includes_all_allowed_fields(self, controller, sanitized_project_data):
        """Test FULL_PROJECT permission includes all allowed fields"""
        filtered = controller._filter_sensitive_fields(
            sanitized_project_data,
            SharePermissionLevel.FULL_PROJECT
        )
        
        # Should include basic fields
        assert 'id' in filtered
        assert 'name' in filtered
        
        # Should include limited data fields
        assert 'milestones' in filtered
        assert 'team_members' in filtered
        
        # Should include full project fields
        assert 'tasks' in filtered
        assert 'schedules' in filtered
        assert 'risks' in filtered
        assert 'dependencies' in filtered
        assert 'resources' in filtered
        assert 'manager_id' in filtered
    
    def test_unknown_permission_defaults_to_view_only(self, controller, sanitized_project_data):
        """Test unknown permission level defaults to VIEW_ONLY"""
        # Use an invalid permission level
        filtered = controller._filter_sensitive_fields(
            sanitized_project_data,
            "invalid_permission"
        )
        
        # Should behave like VIEW_ONLY
        assert 'id' in filtered
        assert 'name' in filtered
        assert 'milestones' not in filtered
        assert 'tasks' not in filtered
    
    def test_filtering_preserves_field_values(self, controller, sanitized_project_data):
        """Test that filtering preserves the values of included fields"""
        filtered = controller._filter_sensitive_fields(
            sanitized_project_data,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Values should be preserved
        assert filtered['name'] == sanitized_project_data['name']
        assert filtered['status'] == sanitized_project_data['status']
        assert filtered['progress_percentage'] == sanitized_project_data['progress_percentage']


class TestGetFilteredProjectData:
    """Test suite for get_filtered_project_data method"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=db)
        db.select = Mock(return_value=db)
        db.eq = Mock(return_value=db)
        db.in_ = Mock(return_value=db)
        db.execute = Mock()
        return db
    
    @pytest.fixture
    def controller(self, mock_db):
        """Create a GuestAccessController instance with mock database"""
        return GuestAccessController(db_session=mock_db)
    
    @pytest.fixture
    def project_id(self):
        """Generate a project ID"""
        return uuid4()
    
    @pytest.fixture
    def mock_project_data(self, project_id):
        """Create mock project data from database"""
        return {
            'id': str(project_id),
            'name': 'Construction Project Alpha',
            'description': 'Major construction project',
            'status': 'active',
            'progress_percentage': 65.0,
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'priority': 'high',
            'health': 'green',
            'portfolio_id': str(uuid4()),
            'manager_id': str(uuid4()),
            # Sensitive data that should be removed
            'budget': 5000000.00,
            'actual_cost': 3250000.00,
            'internal_notes': 'Confidential project information',
            'created_by_email': 'admin@example.com'
        }
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_view_only(self, controller, mock_db, project_id, mock_project_data):
        """Test getting filtered data with VIEW_ONLY permission"""
        # Setup mock response
        mock_db.execute.return_value = Mock(data=[mock_project_data])
        
        # Get filtered data
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Assertions
        assert result is not None
        assert isinstance(result, FilteredProjectData)
        assert result.id == str(project_id)
        assert result.name == 'Construction Project Alpha'
        assert result.status == 'active'
        assert result.progress_percentage == 65.0
        
        # Extended fields should be None for VIEW_ONLY
        assert result.milestones is None
        assert result.team_members is None
        assert result.documents is None
        assert result.timeline is None
        assert result.tasks is None
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_limited_data(self, controller, mock_db, project_id, mock_project_data):
        """Test getting filtered data with LIMITED_DATA permission"""
        # Setup mock responses
        mock_db.execute.side_effect = [
            Mock(data=[mock_project_data]),  # Project query
            Mock(data=[  # Milestones query
                {'id': str(uuid4()), 'name': 'Milestone 1', 'status': 'completed'},
                {'id': str(uuid4()), 'name': 'Milestone 2', 'status': 'in_progress'}
            ]),
            Mock(data=[  # Team members query
                {'user_id': str(uuid4()), 'role': 'engineer'}
            ]),
            Mock(data=[  # Users query
                {'id': str(uuid4()), 'email': 'user@example.com', 'raw_user_meta_data': {'full_name': 'John Doe'}}
            ]),
            Mock(data=[  # Documents query
                {'id': str(uuid4()), 'name': 'Project Plan.pdf', 'file_type': 'pdf'}
            ])
        ]
        
        # Get filtered data
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.LIMITED_DATA
        )
        
        # Assertions
        assert result is not None
        assert result.name == 'Construction Project Alpha'
        
        # Extended fields should be populated for LIMITED_DATA
        assert result.milestones is not None
        assert len(result.milestones) == 2
        assert result.team_members is not None
        assert result.documents is not None
        assert result.timeline is not None
        
        # Tasks should still be None for LIMITED_DATA
        assert result.tasks is None
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_full_project(self, controller, mock_db, project_id, mock_project_data):
        """Test getting filtered data with FULL_PROJECT permission"""
        # Setup mock responses
        mock_db.execute.side_effect = [
            Mock(data=[mock_project_data]),  # Project query
            Mock(data=[]),  # Milestones query
            Mock(data=[]),  # Team members query
            Mock(data=[]),  # Documents query
            Mock(data=[  # Tasks query
                {'id': str(uuid4()), 'name': 'Task 1', 'status': 'completed'},
                {'id': str(uuid4()), 'name': 'Task 2', 'status': 'in_progress'}
            ])
        ]
        
        # Get filtered data
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.FULL_PROJECT
        )
        
        # Assertions
        assert result is not None
        assert result.name == 'Construction Project Alpha'
        
        # Tasks should be populated for FULL_PROJECT
        assert result.tasks is not None
        assert len(result.tasks) == 2
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_project_not_found(self, controller, mock_db, project_id):
        """Test getting filtered data when project doesn't exist"""
        # Setup mock response - no data
        mock_db.execute.return_value = Mock(data=[])
        
        # Get filtered data
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Should return None
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_no_database(self, project_id):
        """Test getting filtered data when database is not available"""
        controller = GuestAccessController(db_session=None)
        controller.db = None
        
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Should return None
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_filtered_data_database_error(self, controller, mock_db, project_id):
        """Test getting filtered data when database error occurs"""
        # Setup mock to raise exception
        mock_db.execute.side_effect = Exception("Database connection failed")
        
        # Get filtered data
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Should return None
        assert result is None
    
    @pytest.mark.asyncio
    async def test_sensitive_data_never_exposed_view_only(self, controller, mock_db, project_id, mock_project_data):
        """Test that sensitive data is NEVER exposed with VIEW_ONLY permission"""
        mock_db.execute.return_value = Mock(data=[mock_project_data])
        
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Verify result doesn't contain sensitive data
        result_dict = result.dict()
        assert 'budget' not in result_dict
        assert 'actual_cost' not in result_dict
        assert 'internal_notes' not in result_dict
        assert 'created_by_email' not in result_dict
    
    @pytest.mark.asyncio
    async def test_sensitive_data_never_exposed_limited_data(self, controller, mock_db, project_id, mock_project_data):
        """Test that sensitive data is NEVER exposed with LIMITED_DATA permission"""
        mock_db.execute.side_effect = [
            Mock(data=[mock_project_data]),
            Mock(data=[]),  # Milestones
            Mock(data=[]),  # Team members
            Mock(data=[])   # Documents
        ]
        
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.LIMITED_DATA
        )
        
        # Verify result doesn't contain sensitive data
        result_dict = result.dict()
        assert 'budget' not in result_dict
        assert 'actual_cost' not in result_dict
        assert 'internal_notes' not in result_dict
    
    @pytest.mark.asyncio
    async def test_sensitive_data_never_exposed_full_project(self, controller, mock_db, project_id, mock_project_data):
        """Test that sensitive data is NEVER exposed with FULL_PROJECT permission"""
        mock_db.execute.side_effect = [
            Mock(data=[mock_project_data]),
            Mock(data=[]),  # Milestones
            Mock(data=[]),  # Team members
            Mock(data=[]),  # Documents
            Mock(data=[])   # Tasks
        ]
        
        result = await controller.get_filtered_project_data(
            project_id,
            SharePermissionLevel.FULL_PROJECT
        )
        
        # Verify result doesn't contain sensitive data
        result_dict = result.dict()
        assert 'budget' not in result_dict
        assert 'actual_cost' not in result_dict
        assert 'internal_notes' not in result_dict
        assert 'created_by_email' not in result_dict


class TestEdgeCases:
    """Test edge cases for data filtering"""
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    def test_sanitize_with_none_values(self, controller):
        """Test sanitization with None values"""
        data = {
            'name': 'Test',
            'budget': None,
            'internal_notes': None
        }
        sanitized = controller._sanitize_project_data(data)
        
        # Sensitive fields should be removed even if None
        assert 'budget' not in sanitized
        assert 'internal_notes' not in sanitized
        assert 'name' in sanitized
    
    def test_filter_with_missing_fields(self, controller):
        """Test filtering when expected fields are missing"""
        data = {
            'id': str(uuid4()),
            'name': 'Test Project'
            # Missing other expected fields
        }
        
        filtered = controller._filter_sensitive_fields(
            data,
            SharePermissionLevel.VIEW_ONLY
        )
        
        # Should only include fields that exist
        assert 'id' in filtered
        assert 'name' in filtered
        assert 'description' not in filtered  # Wasn't in original data
    
    def test_sanitize_with_nested_sensitive_data(self, controller):
        """Test sanitization doesn't affect nested data structures"""
        data = {
            'name': 'Test',
            'metadata': {
                'budget': 1000000,  # This is nested, not top-level
                'notes': 'Some notes'
            }
        }
        sanitized = controller._sanitize_project_data(data)
        
        # Top-level budget would be removed, but nested data is preserved
        assert 'metadata' in sanitized
        assert sanitized['metadata']['budget'] == 1000000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
