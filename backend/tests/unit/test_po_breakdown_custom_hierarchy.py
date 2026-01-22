"""
Unit tests for PO Breakdown Custom Hierarchy Operations

Tests custom hierarchy operations including drag-and-drop reordering
and custom code validation.

**Validates: Requirements 4.2, 4.5**
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
from decimal import Decimal

from services.roche_construction_services import POBreakdownService


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.update = Mock(return_value=mock)
    mock.delete = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.is_ = Mock(return_value=mock)
    mock.order = Mock(return_value=mock)
    mock.range = Mock(return_value=mock)
    mock.execute = Mock()
    return mock


@pytest.fixture
def service(mock_supabase):
    """Create POBreakdownService instance with mock"""
    return POBreakdownService(mock_supabase)


@pytest.fixture
def sample_project_id():
    """Sample project ID"""
    return uuid4()


@pytest.fixture
def sample_user_id():
    """Sample user ID"""
    return uuid4()


class TestReorderBreakdownItems:
    """Test suite for reorder_breakdown_items functionality"""
    
    @pytest.mark.asyncio
    async def test_reorder_root_level_items(self, service, mock_supabase, sample_user_id):
        """Test reordering items at root level"""
        item_ids = [uuid4(), uuid4(), uuid4()]
        
        # Mock validation queries - all items have no parent
        mock_supabase.execute.side_effect = [
            Mock(data=[{'parent_breakdown_id': None}]),  # Item 1 validation
            Mock(data=[{'parent_breakdown_id': None}]),  # Item 2 validation
            Mock(data=[{'parent_breakdown_id': None}]),  # Item 3 validation
            Mock(data=[{'id': str(item_ids[0]), 'display_order': 0}]),  # Item 1 update
            Mock(data=[{'id': str(item_ids[1]), 'display_order': 1}]),  # Item 2 update
            Mock(data=[{'id': str(item_ids[2]), 'display_order': 2}]),  # Item 3 update
        ]
        
        result = await service.reorder_breakdown_items(
            parent_id=None,
            ordered_item_ids=item_ids,
            user_id=sample_user_id
        )
        
        assert len(result) == 3
        assert result[0]['display_order'] == 0
        assert result[1]['display_order'] == 1
        assert result[2]['display_order'] == 2
    
    @pytest.mark.asyncio
    async def test_reorder_child_items(self, service, mock_supabase, sample_user_id):
        """Test reordering items under a parent"""
        parent_id = uuid4()
        item_ids = [uuid4(), uuid4()]
        
        # Mock validation queries - all items have same parent
        mock_supabase.execute.side_effect = [
            Mock(data=[{'parent_breakdown_id': str(parent_id)}]),  # Item 1 validation
            Mock(data=[{'parent_breakdown_id': str(parent_id)}]),  # Item 2 validation
            Mock(data=[{'id': str(item_ids[0]), 'display_order': 0}]),  # Item 1 update
            Mock(data=[{'id': str(item_ids[1]), 'display_order': 1}]),  # Item 2 update
        ]
        
        result = await service.reorder_breakdown_items(
            parent_id=parent_id,
            ordered_item_ids=item_ids,
            user_id=sample_user_id
        )
        
        assert len(result) == 2
        assert result[0]['display_order'] == 0
        assert result[1]['display_order'] == 1
    
    @pytest.mark.asyncio
    async def test_reorder_fails_with_mismatched_parents(self, service, mock_supabase, sample_user_id):
        """Test that reordering fails when items have different parents"""
        parent_id = uuid4()
        other_parent_id = uuid4()
        item_ids = [uuid4(), uuid4()]
        
        # Mock validation queries - items have different parents
        mock_supabase.execute.side_effect = [
            Mock(data=[{'parent_breakdown_id': str(parent_id)}]),  # Item 1 has parent_id
            Mock(data=[{'parent_breakdown_id': str(other_parent_id)}]),  # Item 2 has different parent
        ]
        
        with pytest.raises(ValueError, match="does not belong to parent"):
            await service.reorder_breakdown_items(
                parent_id=parent_id,
                ordered_item_ids=item_ids,
                user_id=sample_user_id
            )
    
    @pytest.mark.asyncio
    async def test_reorder_fails_with_nonexistent_item(self, service, mock_supabase, sample_user_id):
        """Test that reordering fails when an item doesn't exist"""
        item_ids = [uuid4()]
        
        # Mock validation query - item not found
        mock_supabase.execute.return_value = Mock(data=[])
        
        with pytest.raises(ValueError, match="not found"):
            await service.reorder_breakdown_items(
                parent_id=None,
                ordered_item_ids=item_ids,
                user_id=sample_user_id
            )
    
    @pytest.mark.asyncio
    async def test_reorder_empty_list(self, service, sample_user_id):
        """Test reordering with empty list returns empty result"""
        result = await service.reorder_breakdown_items(
            parent_id=None,
            ordered_item_ids=[],
            user_id=sample_user_id
        )
        
        assert result == []


class TestValidateCustomCode:
    """Test suite for validate_custom_code functionality"""
    
    @pytest.mark.asyncio
    async def test_validate_unique_code(self, service, mock_supabase, sample_project_id):
        """Test validation of a unique code"""
        code = "PO-001"
        
        # Mock query - no conflicts
        mock_supabase.execute.return_value = Mock(data=[])
        
        result = await service.validate_custom_code(sample_project_id, code)
        
        assert result['is_valid'] is True
        assert result['is_unique'] is True
        assert len(result['conflicts']) == 0
        assert len(result['suggestions']) == 0
    
    @pytest.mark.asyncio
    async def test_validate_duplicate_code(self, service, mock_supabase, sample_project_id):
        """Test validation of a duplicate code"""
        code = "PO-001"
        existing_id = uuid4()
        
        # Mock query - conflict found
        mock_supabase.execute.side_effect = [
            Mock(data=[{
                'id': str(existing_id),
                'name': 'Existing Item',
                'code': code
            }]),
            # Suggestions checks
            Mock(data=[]),  # PO-001_1 is available
            Mock(data=[]),  # PO-001_2 is available
            Mock(data=[]),  # PO-001_3 is available
        ]
        
        result = await service.validate_custom_code(sample_project_id, code)
        
        assert result['is_valid'] is False
        assert result['is_unique'] is False
        assert len(result['conflicts']) == 1
        assert result['conflicts'][0]['id'] == str(existing_id)
        assert len(result['suggestions']) == 3
        assert 'PO-001_1' in result['suggestions']
    
    @pytest.mark.asyncio
    async def test_validate_code_with_exclusion(self, service, mock_supabase, sample_project_id):
        """Test validation excluding current breakdown (for updates)"""
        code = "PO-001"
        current_id = uuid4()
        
        # Mock query - only current item has this code
        mock_supabase.execute.return_value = Mock(data=[{
            'id': str(current_id),
            'name': 'Current Item',
            'code': code
        }])
        
        result = await service.validate_custom_code(
            sample_project_id, code, exclude_breakdown_id=current_id
        )
        
        assert result['is_valid'] is True
        assert result['is_unique'] is True
        assert len(result['conflicts']) == 0
    
    @pytest.mark.asyncio
    async def test_validate_empty_code(self, service, sample_project_id):
        """Test validation of empty code"""
        result = await service.validate_custom_code(sample_project_id, "")
        
        assert result['is_valid'] is False
        assert result['is_unique'] is False
        assert 'error' in result
        assert 'empty' in result['error'].lower()
    
    @pytest.mark.asyncio
    async def test_validate_invalid_characters(self, service, sample_project_id):
        """Test validation of code with invalid characters"""
        invalid_codes = [
            "PO 001",  # Space
            "PO@001",  # Special character
            "PO.001",  # Period
            "PO/001",  # Slash
        ]
        
        for code in invalid_codes:
            result = await service.validate_custom_code(sample_project_id, code)
            
            assert result['is_valid'] is False
            assert 'error' in result
            assert 'letters, numbers, hyphens, and underscores' in result['error']
    
    @pytest.mark.asyncio
    async def test_validate_valid_code_formats(self, service, mock_supabase, sample_project_id):
        """Test validation of various valid code formats"""
        valid_codes = [
            "PO-001",
            "PO_001",
            "PO001",
            "po-001",
            "PO-ITEM-001",
            "PO_ITEM_001",
        ]
        
        # Mock query - no conflicts for any code
        mock_supabase.execute.return_value = Mock(data=[])
        
        for code in valid_codes:
            result = await service.validate_custom_code(sample_project_id, code)
            
            assert result['is_valid'] is True, f"Code {code} should be valid"
            assert result['is_unique'] is True


class TestBulkUpdateCodes:
    """Test suite for bulk_update_codes functionality"""
    
    @pytest.mark.asyncio
    async def test_bulk_update_all_valid(self, service, mock_supabase, sample_project_id, sample_user_id):
        """Test bulk update with all valid codes"""
        breakdown_ids = [uuid4(), uuid4()]
        code_mappings = {
            breakdown_ids[0]: "PO-001",
            breakdown_ids[1]: "PO-002"
        }
        
        # Mock validation queries - all codes are unique
        # Mock update queries - all successful
        mock_supabase.execute.side_effect = [
            Mock(data=[]),  # Validation for PO-001
            Mock(data=[]),  # Validation for PO-002
            Mock(data=[{'version': 1}]),  # Get version for item 1
            Mock(data=[{'id': str(breakdown_ids[0])}]),  # Update item 1
            Mock(data=[{'version': 1}]),  # Get version for item 2
            Mock(data=[{'id': str(breakdown_ids[1])}]),  # Update item 2
        ]
        
        result = await service.bulk_update_codes(
            code_mappings, sample_project_id, sample_user_id, validate_first=True
        )
        
        assert len(result['successful']) == 2
        assert len(result['failed']) == 0
        assert len(result['validation_errors']) == 0
    
    @pytest.mark.asyncio
    async def test_bulk_update_with_validation_errors(self, service, mock_supabase, sample_project_id, sample_user_id):
        """Test bulk update with validation errors prevents all updates"""
        breakdown_ids = [uuid4(), uuid4()]
        code_mappings = {
            breakdown_ids[0]: "PO-001",
            breakdown_ids[1]: "PO-001"  # Duplicate
        }
        
        # Mock validation queries - second code conflicts
        mock_supabase.execute.side_effect = [
            Mock(data=[]),  # Validation for first PO-001 - unique
            Mock(data=[{  # Validation for second PO-001 - conflict
                'id': str(breakdown_ids[0]),
                'name': 'First Item',
                'code': 'PO-001'
            }]),
            Mock(data=[]),  # Suggestion check
            Mock(data=[]),  # Suggestion check
            Mock(data=[]),  # Suggestion check
        ]
        
        result = await service.bulk_update_codes(
            code_mappings, sample_project_id, sample_user_id, validate_first=True
        )
        
        assert len(result['successful']) == 0
        assert len(result['failed']) == 0
        assert len(result['validation_errors']) == 1
        assert result['validation_errors'][0]['code'] == 'PO-001'
    
    @pytest.mark.asyncio
    async def test_bulk_update_without_validation(self, service, mock_supabase, sample_project_id, sample_user_id):
        """Test bulk update without pre-validation"""
        breakdown_id = uuid4()
        code_mappings = {breakdown_id: "PO-001"}
        
        # Mock update queries only (no validation)
        mock_supabase.execute.side_effect = [
            Mock(data=[{'version': 1}]),  # Get version
            Mock(data=[{'id': str(breakdown_id)}]),  # Update
        ]
        
        result = await service.bulk_update_codes(
            code_mappings, sample_project_id, sample_user_id, validate_first=False
        )
        
        assert len(result['successful']) == 1
        assert len(result['validation_errors']) == 0
    
    @pytest.mark.asyncio
    async def test_bulk_update_with_nonexistent_item(self, service, mock_supabase, sample_project_id, sample_user_id):
        """Test bulk update with nonexistent breakdown"""
        breakdown_id = uuid4()
        code_mappings = {breakdown_id: "PO-001"}
        
        # Mock queries
        mock_supabase.execute.side_effect = [
            Mock(data=[]),  # Validation - code is unique
            Mock(data=[]),  # Get version - item not found
        ]
        
        result = await service.bulk_update_codes(
            code_mappings, sample_project_id, sample_user_id, validate_first=True
        )
        
        assert len(result['successful']) == 0
        assert len(result['failed']) == 1
        assert 'not found' in result['failed'][0]['error'].lower()


class TestGetHierarchyWithCustomOrder:
    """Test suite for get_hierarchy_with_custom_order functionality"""
    
    @pytest.mark.asyncio
    async def test_get_root_items_with_order(self, service, mock_supabase, sample_project_id):
        """Test getting root items with custom display order"""
        item1_id = uuid4()
        item2_id = uuid4()
        
        # Mock query - root items ordered by display_order
        mock_supabase.execute.return_value = Mock(data=[
            {
                'id': str(item1_id),
                'name': 'Item 1',
                'display_order': 0,
                'parent_breakdown_id': None
            },
            {
                'id': str(item2_id),
                'name': 'Item 2',
                'display_order': 1,
                'parent_breakdown_id': None
            }
        ])
        
        result = await service.get_hierarchy_with_custom_order(
            sample_project_id, parent_id=None, include_children=False
        )
        
        assert len(result) == 2
        assert result[0]['display_order'] == 0
        assert result[1]['display_order'] == 1
    
    @pytest.mark.asyncio
    async def test_get_hierarchy_with_children(self, service, mock_supabase, sample_project_id):
        """Test getting hierarchy with recursive children"""
        parent_id = uuid4()
        child_id = uuid4()
        
        # Mock queries - parent and child
        mock_supabase.execute.side_effect = [
            Mock(data=[{  # Root level
                'id': str(parent_id),
                'name': 'Parent',
                'display_order': 0,
                'parent_breakdown_id': None
            }]),
            Mock(data=[{  # Children of parent
                'id': str(child_id),
                'name': 'Child',
                'display_order': 0,
                'parent_breakdown_id': str(parent_id)
            }]),
            Mock(data=[]),  # Children of child (none)
        ]
        
        result = await service.get_hierarchy_with_custom_order(
            sample_project_id, parent_id=None, include_children=True
        )
        
        assert len(result) == 1
        assert 'children' in result[0]
        assert len(result[0]['children']) == 1
        assert result[0]['children'][0]['id'] == str(child_id)
    
    @pytest.mark.asyncio
    async def test_get_items_by_parent(self, service, mock_supabase, sample_project_id):
        """Test getting items filtered by parent"""
        parent_id = uuid4()
        child_id = uuid4()
        
        # Mock query - children of specific parent
        mock_supabase.execute.return_value = Mock(data=[{
            'id': str(child_id),
            'name': 'Child',
            'display_order': 0,
            'parent_breakdown_id': str(parent_id)
        }])
        
        result = await service.get_hierarchy_with_custom_order(
            sample_project_id, parent_id=parent_id, include_children=False
        )
        
        assert len(result) == 1
        assert result[0]['parent_breakdown_id'] == str(parent_id)

