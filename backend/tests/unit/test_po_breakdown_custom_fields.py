"""
Unit Tests for PO Breakdown Custom Field and Metadata Management

This module contains comprehensive unit tests for custom field management,
tag operations, and category/subcategory functionality.

Task: 6.1 Add custom field and metadata support
**Validates: Requirements 4.1, 4.3, 4.4**

Tests Implemented:
- Custom field CRUD operations with JSONB storage
- Tag management (add, remove, search)
- Category and subcategory management
- Flexible metadata storage
"""

import pytest
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any, List
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.generic_construction_services import POBreakdownService


# ============================================================================
# Test Fixtures
# ============================================================================

class MockSupabaseResponse:
    """Mock Supabase response object."""
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


class MockSupabaseQuery:
    """Mock Supabase query builder."""
    def __init__(self, data: List[Dict[str, Any]] = None):
        self._data = data or []
    
    def select(self, *args, **kwargs):
        return self
    
    def update(self, data):
        if self._data:
            self._data[0].update(data)
        return self
    
    def eq(self, field, value):
        return self
    
    def execute(self):
        return MockSupabaseResponse(self._data)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    client = Mock()
    return client


@pytest.fixture
def sample_breakdown_data() -> Dict[str, Any]:
    """Create sample breakdown data for testing."""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Test Breakdown',
        'custom_fields': {'existing_field': 'existing_value'},
        'tags': ['tag1', 'tag2'],
        'category': 'Development',
        'subcategory': 'Phase 1',
        'version': 1,
        'is_active': True,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


# ============================================================================
# Test Class: Custom Field Management
# ============================================================================

class TestCustomFieldManagement:
    """
    Test custom field management operations.
    
    **Validates: Requirements 4.3 (flexible JSONB storage for custom fields)**
    """

    @pytest.mark.asyncio
    async def test_update_custom_fields_merge(self, mock_supabase, sample_breakdown_data):
        """
        Test updating custom fields with merge mode.
        
        **Validates: Requirements 4.3**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['custom_fields'] = {
            'existing_field': 'existing_value',
            'new_field': 'new_value'
        }
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.update_custom_fields(
            breakdown_id,
            {'new_field': 'new_value'},
            user_id,
            merge=True
        )
        
        # Verify
        assert result is not None
        assert 'existing_field' in result['custom_fields']
        assert 'new_field' in result['custom_fields']
        assert result['version'] == 2

    @pytest.mark.asyncio
    async def test_update_custom_fields_replace(self, mock_supabase, sample_breakdown_data):
        """
        Test updating custom fields with replace mode.
        
        **Validates: Requirements 4.3**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['custom_fields'] = {'new_field': 'new_value'}
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.update_custom_fields(
            breakdown_id,
            {'new_field': 'new_value'},
            user_id,
            merge=False
        )
        
        # Verify
        assert result is not None
        assert 'existing_field' not in result['custom_fields']
        assert 'new_field' in result['custom_fields']
        assert result['version'] == 2

    @pytest.mark.asyncio
    async def test_get_custom_field(self, mock_supabase, sample_breakdown_data):
        """
        Test retrieving a specific custom field value.
        
        **Validates: Requirements 4.3**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.get_custom_field(breakdown_id, 'existing_field')
        
        # Verify
        assert result == 'existing_value'

    @pytest.mark.asyncio
    async def test_get_custom_field_not_found(self, mock_supabase, sample_breakdown_data):
        """
        Test retrieving a non-existent custom field returns None.
        
        **Validates: Requirements 4.3**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.get_custom_field(breakdown_id, 'nonexistent_field')
        
        # Verify
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_custom_field(self, mock_supabase, sample_breakdown_data):
        """
        Test deleting a custom field.
        
        **Validates: Requirements 4.3**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['custom_fields'] = {}
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.delete_custom_field(breakdown_id, 'existing_field', user_id)
        
        # Verify
        assert result is not None
        assert 'existing_field' not in result['custom_fields']
        assert result['version'] == 2


# ============================================================================
# Test Class: Tag Management
# ============================================================================

class TestTagManagement:
    """
    Test tag management operations.
    
    **Validates: Requirements 4.4 (multiple tags for cross-cutting organization)**
    """

    @pytest.mark.asyncio
    async def test_add_tags(self, mock_supabase, sample_breakdown_data):
        """
        Test adding tags to a breakdown.
        
        **Validates: Requirements 4.4**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['tags'] = ['tag1', 'tag2', 'tag3', 'tag4']
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.add_tags(breakdown_id, ['tag3', 'tag4'], user_id)
        
        # Verify
        assert result is not None
        assert 'tag3' in result['tags']
        assert 'tag4' in result['tags']
        assert len(result['tags']) == 4
        assert result['version'] == 2

    @pytest.mark.asyncio
    async def test_add_duplicate_tags(self, mock_supabase, sample_breakdown_data):
        """
        Test adding duplicate tags doesn't create duplicates.
        
        **Validates: Requirements 4.4**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['tags'] = ['tag1', 'tag2']  # No duplicates
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.add_tags(breakdown_id, ['tag1', 'tag2'], user_id)
        
        # Verify
        assert result is not None
        assert len(result['tags']) == 2  # No duplicates added

    @pytest.mark.asyncio
    async def test_remove_tags(self, mock_supabase, sample_breakdown_data):
        """
        Test removing tags from a breakdown.
        
        **Validates: Requirements 4.4**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['tags'] = ['tag2']
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.remove_tags(breakdown_id, ['tag1'], user_id)
        
        # Verify
        assert result is not None
        assert 'tag1' not in result['tags']
        assert 'tag2' in result['tags']
        assert result['version'] == 2

    @pytest.mark.asyncio
    async def test_search_by_tags_match_any(self, mock_supabase):
        """
        Test searching breakdowns by tags (match any).
        
        **Validates: Requirements 4.4**
        """
        project_id = uuid4()
        
        # Create test data
        breakdown1 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 1',
            'tags': ['tag1', 'tag2'],
            'is_active': True
        }
        breakdown2 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 2',
            'tags': ['tag2', 'tag3'],
            'is_active': True
        }
        breakdown3 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 3',
            'tags': ['tag4'],
            'is_active': True
        }
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([
            breakdown1, breakdown2, breakdown3
        ])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute - search for tag1 or tag3
        result = await service.search_by_tags(project_id, ['tag1', 'tag3'], match_all=False)
        
        # Verify - should match breakdown1 (has tag1) and breakdown2 (has tag3)
        assert len(result) == 2
        names = [b['name'] for b in result]
        assert 'Breakdown 1' in names
        assert 'Breakdown 2' in names

    @pytest.mark.asyncio
    async def test_search_by_tags_match_all(self, mock_supabase):
        """
        Test searching breakdowns by tags (match all).
        
        **Validates: Requirements 4.4**
        """
        project_id = uuid4()
        
        # Create test data
        breakdown1 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 1',
            'tags': ['tag1', 'tag2', 'tag3'],
            'is_active': True
        }
        breakdown2 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 2',
            'tags': ['tag1', 'tag2'],
            'is_active': True
        }
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([
            breakdown1, breakdown2
        ])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute - search for tag1 AND tag2 AND tag3
        result = await service.search_by_tags(project_id, ['tag1', 'tag2', 'tag3'], match_all=True)
        
        # Verify - should only match breakdown1 (has all three tags)
        assert len(result) == 1
        assert result[0]['name'] == 'Breakdown 1'


# ============================================================================
# Test Class: Category Management
# ============================================================================

class TestCategoryManagement:
    """
    Test category and subcategory management operations.
    
    **Validates: Requirements 4.1 (user-defined categories and subcategories)**
    """

    @pytest.mark.asyncio
    async def test_update_category(self, mock_supabase, sample_breakdown_data):
        """
        Test updating category and subcategory.
        
        **Validates: Requirements 4.1**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([sample_breakdown_data])
        
        # Mock update query
        updated_data = sample_breakdown_data.copy()
        updated_data['category'] = 'Construction'
        updated_data['subcategory'] = 'Phase 2'
        updated_data['version'] = 2
        mock_table.update.return_value.eq.return_value.execute.return_value = MockSupabaseResponse([updated_data])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.update_category(breakdown_id, 'Construction', 'Phase 2', user_id)
        
        # Verify
        assert result is not None
        assert result['category'] == 'Construction'
        assert result['subcategory'] == 'Phase 2'
        assert result['version'] == 2

    @pytest.mark.asyncio
    async def test_get_project_categories(self, mock_supabase):
        """
        Test retrieving all categories and subcategories for a project.
        
        **Validates: Requirements 4.1**
        """
        project_id = uuid4()
        
        # Create test data
        breakdowns = [
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'category': 'Development',
                'subcategory': 'Phase 1',
                'is_active': True
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'category': 'Development',
                'subcategory': 'Phase 2',
                'is_active': True
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'category': 'Construction',
                'subcategory': 'Foundation',
                'is_active': True
            },
            {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'category': 'Construction',
                'subcategory': 'Framing',
                'is_active': True
            }
        ]
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock select query
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MockSupabaseResponse(breakdowns)
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.get_project_categories(project_id)
        
        # Verify
        assert 'Development' in result
        assert 'Construction' in result
        assert 'Phase 1' in result['Development']
        assert 'Phase 2' in result['Development']
        assert 'Foundation' in result['Construction']
        assert 'Framing' in result['Construction']

    @pytest.mark.asyncio
    async def test_search_by_category(self, mock_supabase):
        """
        Test searching breakdowns by category.
        
        **Validates: Requirements 4.1**
        """
        project_id = uuid4()
        
        # Create test data
        breakdown1 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 1',
            'category': 'Development',
            'subcategory': 'Phase 1',
            'is_active': True
        }
        breakdown2 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 2',
            'category': 'Development',
            'subcategory': 'Phase 2',
            'is_active': True
        }
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock query chain
        mock_query = Mock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([breakdown1, breakdown2])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.search_by_category(project_id, category='Development')
        
        # Verify
        assert len(result) == 2
        assert all(b['category'] == 'Development' for b in result)

    @pytest.mark.asyncio
    async def test_search_by_subcategory(self, mock_supabase):
        """
        Test searching breakdowns by subcategory.
        
        **Validates: Requirements 4.1**
        """
        project_id = uuid4()
        
        # Create test data
        breakdown1 = {
            'id': str(uuid4()),
            'project_id': str(project_id),
            'name': 'Breakdown 1',
            'category': 'Development',
            'subcategory': 'Phase 1',
            'is_active': True
        }
        
        # Setup mock
        mock_table = Mock()
        mock_supabase.table.return_value = mock_table
        
        # Mock query chain
        mock_query = Mock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_query.execute.return_value = MockSupabaseResponse([breakdown1])
        
        service = POBreakdownService(mock_supabase)
        
        # Execute
        result = await service.search_by_category(
            project_id,
            category='Development',
            subcategory='Phase 1'
        )
        
        # Verify
        assert len(result) == 1
        assert result[0]['subcategory'] == 'Phase 1'
