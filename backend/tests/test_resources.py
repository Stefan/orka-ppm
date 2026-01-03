"""
Tests for enhanced Resource model and endpoints
"""
import pytest
from unittest.mock import Mock, patch
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock environment variables before importing main
with patch.dict(os.environ, {
    'SUPABASE_URL': 'https://test.supabase.co',
    'SUPABASE_ANON_KEY': 'test_key',
    'SUPABASE_JWT_SECRET': 'test_secret',
    'OPENAI_API_KEY': 'test_openai_key'
}):
    from main import (
        calculate_advanced_skill_match_score,
        calculate_enhanced_resource_availability,
        ResourceCreate,
        ResourceUpdate,
        ResourceResponse
    )


class TestSkillMatching:
    """Test enhanced skill matching functionality"""
    
    def test_perfect_skill_match(self):
        """Test perfect skill match scenario"""
        required_skills = ["Python", "FastAPI", "PostgreSQL"]
        resource_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 1.0
        assert set(result['matching_skills']) == set(required_skills)
        assert result['missing_skills'] == []
        assert result['extra_skills'] == ["Docker"]
    
    def test_partial_skill_match(self):
        """Test partial skill match scenario"""
        required_skills = ["Python", "FastAPI", "PostgreSQL", "Redis"]
        resource_skills = ["Python", "FastAPI", "MongoDB"]
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 0.5  # 2 out of 4 skills match
        assert set(result['matching_skills']) == {"Python", "FastAPI"}
        assert set(result['missing_skills']) == {"PostgreSQL", "Redis"}
        assert result['extra_skills'] == ["MongoDB"]
    
    def test_no_skill_match(self):
        """Test no skill match scenario"""
        required_skills = ["Java", "Spring", "Oracle"]
        resource_skills = ["Python", "FastAPI", "PostgreSQL"]
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 0.0
        assert result['matching_skills'] == []
        assert set(result['missing_skills']) == set(required_skills)
        assert set(result['extra_skills']) == set(resource_skills)
    
    def test_case_insensitive_matching(self):
        """Test case insensitive skill matching"""
        required_skills = ["python", "FASTAPI", "PostgreSql"]
        resource_skills = ["Python", "fastapi", "postgresql"]
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 1.0
        assert len(result['matching_skills']) == 3
    
    def test_empty_required_skills(self):
        """Test when no skills are required"""
        required_skills = []
        resource_skills = ["Python", "FastAPI"]
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 1.0
        assert result['matching_skills'] == resource_skills
        assert result['missing_skills'] == []
        assert result['extra_skills'] == resource_skills
    
    def test_empty_resource_skills(self):
        """Test when resource has no skills"""
        required_skills = ["Python", "FastAPI"]
        resource_skills = []
        
        result = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        assert result['match_score'] == 0.0
        assert result['matching_skills'] == []
        assert set(result['missing_skills']) == set(required_skills)
        assert result['extra_skills'] == []


class TestResourceAvailability:
    """Test enhanced resource availability calculation"""
    
    def test_fully_available_resource(self):
        """Test resource with no current allocations"""
        resource = {
            'id': 'test-id',
            'capacity': 40,
            'availability': 100,
            'current_projects': []
        }
        
        with patch('main.supabase') as mock_supabase:
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
            
            result = calculate_enhanced_resource_availability(resource)
            
            assert result['utilization_percentage'] == 0.0
            assert result['available_hours'] == 40.0
            assert result['allocated_hours'] == 0.0
            assert result['capacity_hours'] == 40
            assert result['availability_status'] == 'available'
            assert result['can_take_more_work'] is True
    
    def test_partially_allocated_resource(self):
        """Test resource with partial allocation"""
        resource = {
            'id': 'test-id',
            'capacity': 40,
            'availability': 100,
            'current_projects': ['project1']
        }
        
        with patch('main.supabase') as mock_supabase:
            # Mock project allocation of 50%
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                {'allocation_percentage': 50}
            ]
            
            result = calculate_enhanced_resource_availability(resource)
            
            assert result['utilization_percentage'] == 50.0
            assert result['available_hours'] == 20.0
            assert result['allocated_hours'] == 20.0
            assert result['availability_status'] == 'partially_allocated'
            assert result['can_take_more_work'] is True
    
    def test_fully_allocated_resource(self):
        """Test resource that is fully allocated"""
        resource = {
            'id': 'test-id',
            'capacity': 40,
            'availability': 100,
            'current_projects': ['project1', 'project2']
        }
        
        with patch('main.supabase') as mock_supabase:
            # Mock two projects with 50% allocation each
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = [
                Mock(data=[{'allocation_percentage': 50}]),
                Mock(data=[{'allocation_percentage': 50}])
            ]
            
            result = calculate_enhanced_resource_availability(resource)
            
            assert result['utilization_percentage'] == 100.0
            assert result['available_hours'] == 0.0
            assert result['allocated_hours'] == 40.0
            assert result['availability_status'] == 'fully_allocated'
            assert result['can_take_more_work'] is False
    
    def test_reduced_availability_resource(self):
        """Test resource with reduced availability percentage"""
        resource = {
            'id': 'test-id',
            'capacity': 40,
            'availability': 75,  # Only 75% available
            'current_projects': []
        }
        
        with patch('main.supabase') as mock_supabase:
            mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
            
            result = calculate_enhanced_resource_availability(resource)
            
            assert result['utilization_percentage'] == 0.0
            assert result['available_hours'] == 30.0  # 40 * 0.75
            assert result['allocated_hours'] == 0.0
            assert result['availability_status'] == 'available'
            assert result['can_take_more_work'] is True


class TestResourceModels:
    """Test Resource Pydantic models"""
    
    def test_resource_create_model(self):
        """Test ResourceCreate model validation"""
        resource_data = {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "Senior Developer",
            "capacity": 40,
            "availability": 100,
            "hourly_rate": 75.0,
            "skills": ["Python", "FastAPI"],
            "location": "Remote"
        }
        
        resource = ResourceCreate(**resource_data)
        
        assert resource.name == "John Doe"
        assert resource.email == "john@example.com"
        assert resource.role == "Senior Developer"
        assert resource.capacity == 40
        assert resource.availability == 100
        assert resource.hourly_rate == 75.0
        assert resource.skills == ["Python", "FastAPI"]
        assert resource.location == "Remote"
    
    def test_resource_create_defaults(self):
        """Test ResourceCreate model with default values"""
        resource_data = {
            "name": "Jane Doe",
            "email": "jane@example.com"
        }
        
        resource = ResourceCreate(**resource_data)
        
        assert resource.name == "Jane Doe"
        assert resource.email == "jane@example.com"
        assert resource.role is None
        assert resource.capacity == 40  # Default
        assert resource.availability == 100  # Default
        assert resource.hourly_rate is None
        assert resource.skills == []  # Default
        assert resource.location is None
    
    def test_resource_update_model(self):
        """Test ResourceUpdate model with partial updates"""
        update_data = {
            "role": "Lead Developer",
            "hourly_rate": 85.0,
            "skills": ["Python", "FastAPI", "PostgreSQL"]
        }
        
        resource_update = ResourceUpdate(**update_data)
        
        assert resource_update.name is None
        assert resource_update.email is None
        assert resource_update.role == "Lead Developer"
        assert resource_update.capacity is None
        assert resource_update.availability is None
        assert resource_update.hourly_rate == 85.0
        assert resource_update.skills == ["Python", "FastAPI", "PostgreSQL"]
        assert resource_update.location is None
    
    def test_resource_response_model(self):
        """Test ResourceResponse model with all fields"""
        response_data = {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "John Doe",
            "email": "john@example.com",
            "role": "Senior Developer",
            "capacity": 40,
            "availability": 100,
            "hourly_rate": 75.0,
            "skills": ["Python", "FastAPI"],
            "location": "Remote",
            "current_projects": ["project1", "project2"],
            "utilization_percentage": 75.0,
            "available_hours": 10.0,
            "allocated_hours": 30.0,
            "capacity_hours": 40,
            "availability_status": "mostly_allocated",
            "can_take_more_work": True,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        
        resource = ResourceResponse(**response_data)
        
        assert resource.id == "123e4567-e89b-12d3-a456-426614174000"
        assert resource.name == "John Doe"
        assert resource.email == "john@example.com"
        assert resource.utilization_percentage == 75.0
        assert resource.availability_status == "mostly_allocated"
        assert resource.can_take_more_work is True


if __name__ == "__main__":
    pytest.main([__file__])