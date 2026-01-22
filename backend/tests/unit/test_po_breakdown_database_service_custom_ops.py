"""
Unit tests for POBreakdownDatabaseService Custom Hierarchy Operations

Tests custom hierarchy operations including drag-and-drop reordering
and custom code validation for the POBreakdownDatabaseService class.

**Validates: Requirements 4.2, 4.5**
**Task: 6.2 - Implement custom hierarchy operations**
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from decimal import Decimal

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    POBreakdownResponse,
    POBreakdownType,
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    mock = Mock()
    
    # Create a mock table that returns itself for chaining
    mock_table = Mock()
    mock_table.select = Mock(return_value=mock_table)
    mock_table.insert = Mock(return_value=mock_table)
    mock_table.update = Mock(return_value=mock_table)
    mock_table.delete = Mock(return_value=mock_table)
    mock_table.eq = Mock(return_value=mock_table)
    mock_table.is_ = Mock(return_value=mock_table)
    mock_table.order = Mock(return_value=mock_table)
    mock_table.range = Mock(return_value=mock_table)
    mock_table.execute = Mock()
    
    mock.table = Mock(return_value=mock_table)
    
    return mock


@pytest.fixture
def service(mock_supabase):
    """Create POBreakdownDatabaseService instance with mock"""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def sample_project_id():
    """Sample project ID"""
    return uuid4()


@pytest.fixture
def sample_user_id():
    """Sample user ID"""
    return uuid4()


def create_mock_breakdown(
    breakdown_id: UUID,
    project_id: UUID,
    name: str,
    parent_id: Optional[UUID] = None,
    display_order: Optional[int] = None,
    code: Optional[str] = None
) -> Dict[str, Any]:
    """Helper to create mock breakdown data"""
    return {
        'id': str(breakdown_id),
        'project_id': str(project_id),
        'name': name,
        'code': code,
        'sap_po_number': None,
        'sap_line_item': None,
        'hierarchy_level': 0 if not parent_id else 1,
        'parent_breakdown_id': str(parent_id) if parent_id else None,
        'display_order': display_order,
        'cost_center': None,
        'gl_account': None,
        'planned_amount': '10000.00',
        'committed_amount': '5000.00',
        'actual_amount': '2000.00',
        'remaining_amount': '8000.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'custom_hierarchy',
        'category': None,
        'subcategory': None,
        'custom_fields': {},
        'tags': [],
        'notes': None,
        'import_batch_id': None,
        'import_source': None,
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


class TestReorderBreakdownItems:
    """Test suite for reorder_breakdown_items functionality"""
    
    @pytest.mark.asyncio
    async def test_reorder_root_level_items(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test reordering items at root level.
        
        **Validates: Requirement 4.2 - drag-and-drop reordering support**
        """
        item_ids = [uuid4(), uuid4(), uuid4()]
        
        # Mock get_breakdown_by_id calls for validation
        mock_breakdowns = [
            create_mock_breakdown(item_ids[i], sample_project_id, f"Item {i}", parent_id=None)
            for i in range(3)
        ]
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            # Setup mock to return appropriate breakdown for each ID
            async def get_breakdown_side_effect(breakdown_id):
                for i, item_id in enumerate(item_ids):
                    if breakdown_id == item_id:
                        data = mock_breakdowns[i]
                        return POBreakdownResponse(**{
                            **data,
                            'id': UUID(data['id']),
                            'project_id': UUID(data['project_id']),
                            'parent_breakdown_id': None,
                            'planned_amount': Decimal(data['planned_amount']),
                            'committed_amount': Decimal(data['committed_amount']),
                            'actual_amount': Decimal(data['actual_amount']),
                            'remaining_amount': Decimal(data['remaining_amount']),
                            'exchange_rate': Decimal(data['exchange_rate']),
                            'breakdown_type': POBreakdownType(data['breakdown_type']),
                            'created_at': datetime.fromisoformat(data['created_at']),
                            'updated_at': datetime.fromisoformat(data['updated_at']),
                        })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            # Mock update operations
            mock_table = mock_supabase.table.return_value
            mock_table.execute.side_effect = [
                Mock(data=[{**mock_breakdowns[0], 'display_order': 0}]),
                Mock(data=[{**mock_breakdowns[1], 'display_order': 1}]),
                Mock(data=[{**mock_breakdowns[2], 'display_order': 2}]),
            ]
            
            # Mock version record creation
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.reorder_breakdown_items(
                    parent_id=None,
                    ordered_item_ids=item_ids,
                    user_id=sample_user_id
                )
        
        assert len(result) == 3
        assert result[0].display_order == 0
        assert result[1].display_order == 1
        assert result[2].display_order == 2
    
    @pytest.mark.asyncio
    async def test_reorder_child_items(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test reordering items under a parent.
        
        **Validates: Requirement 4.2 - drag-and-drop reordering support**
        """
        parent_id = uuid4()
        item_ids = [uuid4(), uuid4()]
        
        # Mock get_breakdown_by_id calls
        mock_breakdowns = [
            create_mock_breakdown(item_ids[i], sample_project_id, f"Child {i}", parent_id=parent_id)
            for i in range(2)
        ]
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            async def get_breakdown_side_effect(breakdown_id):
                for i, item_id in enumerate(item_ids):
                    if breakdown_id == item_id:
                        data = mock_breakdowns[i]
                        return POBreakdownResponse(**{
                            **data,
                            'id': UUID(data['id']),
                            'project_id': UUID(data['project_id']),
                            'parent_breakdown_id': parent_id,
                            'planned_amount': Decimal(data['planned_amount']),
                            'committed_amount': Decimal(data['committed_amount']),
                            'actual_amount': Decimal(data['actual_amount']),
                            'remaining_amount': Decimal(data['remaining_amount']),
                            'exchange_rate': Decimal(data['exchange_rate']),
                            'breakdown_type': POBreakdownType(data['breakdown_type']),
                            'created_at': datetime.fromisoformat(data['created_at']),
                            'updated_at': datetime.fromisoformat(data['updated_at']),
                        })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            # Mock update operations
            mock_table = mock_supabase.table.return_value
            mock_table.execute.side_effect = [
                Mock(data=[{**mock_breakdowns[0], 'display_order': 0}]),
                Mock(data=[{**mock_breakdowns[1], 'display_order': 1}]),
            ]
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.reorder_breakdown_items(
                    parent_id=parent_id,
                    ordered_item_ids=item_ids,
                    user_id=sample_user_id
                )
        
        assert len(result) == 2
        assert result[0].display_order == 0
        assert result[1].display_order == 1
    
    @pytest.mark.asyncio
    async def test_reorder_fails_with_mismatched_parents(self, service, sample_project_id, sample_user_id):
        """
        Test that reordering fails when items have different parents.
        
        **Validates: Requirement 4.2 - validation of reorder operations**
        """
        parent_id = uuid4()
        other_parent_id = uuid4()
        item_ids = [uuid4(), uuid4()]
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            async def get_breakdown_side_effect(breakdown_id):
                if breakdown_id == item_ids[0]:
                    data = create_mock_breakdown(item_ids[0], sample_project_id, "Item 1", parent_id=parent_id)
                    return POBreakdownResponse(**{
                        **data,
                        'id': UUID(data['id']),
                        'project_id': UUID(data['project_id']),
                        'parent_breakdown_id': parent_id,
                        'planned_amount': Decimal(data['planned_amount']),
                        'committed_amount': Decimal(data['committed_amount']),
                        'actual_amount': Decimal(data['actual_amount']),
                        'remaining_amount': Decimal(data['remaining_amount']),
                        'exchange_rate': Decimal(data['exchange_rate']),
                        'breakdown_type': POBreakdownType(data['breakdown_type']),
                        'created_at': datetime.fromisoformat(data['created_at']),
                        'updated_at': datetime.fromisoformat(data['updated_at']),
                    })
                elif breakdown_id == item_ids[1]:
                    data = create_mock_breakdown(item_ids[1], sample_project_id, "Item 2", parent_id=other_parent_id)
                    return POBreakdownResponse(**{
                        **data,
                        'id': UUID(data['id']),
                        'project_id': UUID(data['project_id']),
                        'parent_breakdown_id': other_parent_id,
                        'planned_amount': Decimal(data['planned_amount']),
                        'committed_amount': Decimal(data['committed_amount']),
                        'actual_amount': Decimal(data['actual_amount']),
                        'remaining_amount': Decimal(data['remaining_amount']),
                        'exchange_rate': Decimal(data['exchange_rate']),
                        'breakdown_type': POBreakdownType(data['breakdown_type']),
                        'created_at': datetime.fromisoformat(data['created_at']),
                        'updated_at': datetime.fromisoformat(data['updated_at']),
                    })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            with pytest.raises(ValueError, match="does not belong to parent"):
                await service.reorder_breakdown_items(
                    parent_id=parent_id,
                    ordered_item_ids=item_ids,
                    user_id=sample_user_id
                )
    
    @pytest.mark.asyncio
    async def test_reorder_fails_with_nonexistent_item(self, service, sample_user_id):
        """
        Test that reordering fails when an item doesn't exist.
        
        **Validates: Requirement 4.2 - validation of reorder operations**
        """
        item_ids = [uuid4()]
        
        with patch.object(service, 'get_breakdown_by_id', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                await service.reorder_breakdown_items(
                    parent_id=None,
                    ordered_item_ids=item_ids,
                    user_id=sample_user_id
                )
    
    @pytest.mark.asyncio
    async def test_reorder_empty_list(self, service, sample_user_id):
        """
        Test reordering with empty list returns empty result.
        
        **Validates: Requirement 4.2 - edge case handling**
        """
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
        """
        Test validation of a unique code.
        
        **Validates: Requirement 4.5 - custom code validation with project-scope uniqueness**
        """
        code = "PO-001"
        
        # Mock query - no conflicts
        mock_table = mock_supabase.table.return_value
        mock_table.execute.return_value = Mock(data=[])
        
        result = await service.validate_custom_code(sample_project_id, code)
        
        assert result['is_valid'] is True
        assert result['is_unique'] is True
        assert len(result['conflicts']) == 0
        assert len(result['suggestions']) == 0
    
    @pytest.mark.asyncio
    async def test_validate_duplicate_code(self, service, mock_supabase, sample_project_id):
        """
        Test validation of a duplicate code.
        
        **Validates: Requirement 4.5 - custom code validation with project-scope uniqueness**
        """
        code = "PO-001"
        existing_id = uuid4()
        
        # Mock query - conflict found, then suggestions
        mock_table = mock_supabase.table.return_value
        mock_table.execute.side_effect = [
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
        assert 'PO-001_2' in result['suggestions']
        assert 'PO-001_3' in result['suggestions']
    
    @pytest.mark.asyncio
    async def test_validate_code_with_exclusion(self, service, mock_supabase, sample_project_id):
        """
        Test validation excluding current breakdown (for updates).
        
        **Validates: Requirement 4.5 - code validation during updates**
        """
        code = "PO-001"
        current_id = uuid4()
        
        # Mock query - only current item has this code
        mock_table = mock_supabase.table.return_value
        mock_table.execute.return_value = Mock(data=[{
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
        """
        Test validation of empty code.
        
        **Validates: Requirement 4.5 - code format validation**
        """
        result = await service.validate_custom_code(sample_project_id, "")
        
        assert result['is_valid'] is False
        assert result['is_unique'] is False
        assert 'error' in result
        assert 'empty' in result['error'].lower()
    
    @pytest.mark.asyncio
    async def test_validate_whitespace_only_code(self, service, sample_project_id):
        """
        Test validation of whitespace-only code.
        
        **Validates: Requirement 4.5 - code format validation**
        """
        result = await service.validate_custom_code(sample_project_id, "   ")
        
        assert result['is_valid'] is False
        assert result['is_unique'] is False
        assert 'error' in result
        assert 'empty' in result['error'].lower()
    
    @pytest.mark.asyncio
    async def test_validate_invalid_characters(self, service, sample_project_id):
        """
        Test validation of code with invalid characters.
        
        **Validates: Requirement 4.5 - code format validation**
        """
        invalid_codes = [
            "PO 001",  # Space
            "PO@001",  # Special character
            "PO.001",  # Period
            "PO/001",  # Slash
            "PO#001",  # Hash
            "PO$001",  # Dollar sign
        ]
        
        for code in invalid_codes:
            result = await service.validate_custom_code(sample_project_id, code)
            
            assert result['is_valid'] is False, f"Code '{code}' should be invalid"
            assert 'error' in result
            assert 'letters, numbers, hyphens, and underscores' in result['error']
    
    @pytest.mark.asyncio
    async def test_validate_valid_code_formats(self, service, mock_supabase, sample_project_id):
        """
        Test validation of various valid code formats.
        
        **Validates: Requirement 4.5 - code format validation**
        """
        valid_codes = [
            "PO-001",
            "PO_001",
            "PO001",
            "po-001",
            "PO-ITEM-001",
            "PO_ITEM_001",
            "ABC123",
            "test-code-123",
            "TEST_CODE_123",
        ]
        
        # Mock query - no conflicts for any code
        mock_table = mock_supabase.table.return_value
        mock_table.execute.return_value = Mock(data=[])
        
        for code in valid_codes:
            result = await service.validate_custom_code(sample_project_id, code)
            
            assert result['is_valid'] is True, f"Code '{code}' should be valid"
            assert result['is_unique'] is True


class TestBulkUpdateCodes:
    """Test suite for bulk_update_codes functionality"""
    
    @pytest.mark.asyncio
    async def test_bulk_update_all_valid(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test bulk update with all valid codes.
        
        **Validates: Requirement 4.5 - bulk code updates with validation**
        """
        breakdown_ids = [uuid4(), uuid4()]
        code_mappings = {
            breakdown_ids[0]: "PO-001",
            breakdown_ids[1]: "PO-002"
        }
        
        # Mock validation queries - all codes are unique
        mock_table = mock_supabase.table.return_value
        
        # Create mock breakdowns for get_breakdown_by_id
        mock_breakdowns = [
            create_mock_breakdown(breakdown_ids[i], sample_project_id, f"Item {i}", code=f"OLD-{i}")
            for i in range(2)
        ]
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            async def get_breakdown_side_effect(breakdown_id):
                for i, item_id in enumerate(breakdown_ids):
                    if breakdown_id == item_id:
                        data = mock_breakdowns[i]
                        return POBreakdownResponse(**{
                            **data,
                            'id': UUID(data['id']),
                            'project_id': UUID(data['project_id']),
                            'parent_breakdown_id': None,
                            'planned_amount': Decimal(data['planned_amount']),
                            'committed_amount': Decimal(data['committed_amount']),
                            'actual_amount': Decimal(data['actual_amount']),
                            'remaining_amount': Decimal(data['remaining_amount']),
                            'exchange_rate': Decimal(data['exchange_rate']),
                            'breakdown_type': POBreakdownType(data['breakdown_type']),
                            'created_at': datetime.fromisoformat(data['created_at']),
                            'updated_at': datetime.fromisoformat(data['updated_at']),
                        })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            # Mock validation and update queries
            mock_table.execute.side_effect = [
                Mock(data=[]),  # Validation for PO-001
                Mock(data=[]),  # Validation for PO-002
                Mock(data=[{**mock_breakdowns[0], 'code': 'PO-001'}]),  # Update item 1
                Mock(data=[{**mock_breakdowns[1], 'code': 'PO-002'}]),  # Update item 2
            ]
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.bulk_update_codes(
                    code_mappings, sample_project_id, sample_user_id, validate_first=True
                )
        
        assert len(result['successful']) == 2
        assert len(result['failed']) == 0
        assert len(result['validation_errors']) == 0
    
    @pytest.mark.asyncio
    async def test_bulk_update_with_validation_errors(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test bulk update with validation errors prevents all updates.
        
        **Validates: Requirement 4.5 - validation prevents invalid bulk updates**
        """
        breakdown_ids = [uuid4(), uuid4()]
        code_mappings = {
            breakdown_ids[0]: "PO-001",
            breakdown_ids[1]: "PO-001"  # Duplicate
        }
        
        # Mock validation queries - second code conflicts
        mock_table = mock_supabase.table.return_value
        mock_table.execute.side_effect = [
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
        """
        Test bulk update without pre-validation.
        
        **Validates: Requirement 4.5 - optional validation bypass**
        """
        breakdown_id = uuid4()
        code_mappings = {breakdown_id: "PO-001"}
        
        mock_breakdown = create_mock_breakdown(breakdown_id, sample_project_id, "Item", code="OLD-001")
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            async def get_breakdown_side_effect(bid):
                if bid == breakdown_id:
                    data = mock_breakdown
                    return POBreakdownResponse(**{
                        **data,
                        'id': UUID(data['id']),
                        'project_id': UUID(data['project_id']),
                        'parent_breakdown_id': None,
                        'planned_amount': Decimal(data['planned_amount']),
                        'committed_amount': Decimal(data['committed_amount']),
                        'actual_amount': Decimal(data['actual_amount']),
                        'remaining_amount': Decimal(data['remaining_amount']),
                        'exchange_rate': Decimal(data['exchange_rate']),
                        'breakdown_type': POBreakdownType(data['breakdown_type']),
                        'created_at': datetime.fromisoformat(data['created_at']),
                        'updated_at': datetime.fromisoformat(data['updated_at']),
                    })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            # Mock update query only (no validation)
            mock_table = mock_supabase.table.return_value
            mock_table.execute.return_value = Mock(data=[{**mock_breakdown, 'code': 'PO-001'}])
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.bulk_update_codes(
                    code_mappings, sample_project_id, sample_user_id, validate_first=False
                )
        
        assert len(result['successful']) == 1
        assert len(result['validation_errors']) == 0
    
    @pytest.mark.asyncio
    async def test_bulk_update_with_nonexistent_item(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test bulk update with nonexistent breakdown.
        
        **Validates: Requirement 4.5 - error handling for invalid items**
        """
        breakdown_id = uuid4()
        code_mappings = {breakdown_id: "PO-001"}
        
        # Mock validation - code is unique
        mock_table = mock_supabase.table.return_value
        mock_table.execute.return_value = Mock(data=[])
        
        # Mock get_breakdown_by_id - item not found
        with patch.object(service, 'get_breakdown_by_id', return_value=None):
            result = await service.bulk_update_codes(
                code_mappings, sample_project_id, sample_user_id, validate_first=True
            )
        
        assert len(result['successful']) == 0
        assert len(result['failed']) == 1
        assert 'not found' in result['failed'][0]['error'].lower()
    
    @pytest.mark.asyncio
    async def test_bulk_update_partial_success(self, service, mock_supabase, sample_project_id, sample_user_id):
        """
        Test bulk update with some successful and some failed updates.
        
        **Validates: Requirement 4.5 - partial success handling**
        """
        breakdown_ids = [uuid4(), uuid4()]
        code_mappings = {
            breakdown_ids[0]: "PO-001",
            breakdown_ids[1]: "PO-002"
        }
        
        mock_breakdowns = [
            create_mock_breakdown(breakdown_ids[0], sample_project_id, "Item 1", code="OLD-1"),
            None  # Second item doesn't exist
        ]
        
        with patch.object(service, 'get_breakdown_by_id') as mock_get:
            async def get_breakdown_side_effect(breakdown_id):
                if breakdown_id == breakdown_ids[0]:
                    data = mock_breakdowns[0]
                    return POBreakdownResponse(**{
                        **data,
                        'id': UUID(data['id']),
                        'project_id': UUID(data['project_id']),
                        'parent_breakdown_id': None,
                        'planned_amount': Decimal(data['planned_amount']),
                        'committed_amount': Decimal(data['committed_amount']),
                        'actual_amount': Decimal(data['actual_amount']),
                        'remaining_amount': Decimal(data['remaining_amount']),
                        'exchange_rate': Decimal(data['exchange_rate']),
                        'breakdown_type': POBreakdownType(data['breakdown_type']),
                        'created_at': datetime.fromisoformat(data['created_at']),
                        'updated_at': datetime.fromisoformat(data['updated_at']),
                    })
                return None
            
            mock_get.side_effect = get_breakdown_side_effect
            
            # Mock validation and update queries
            mock_table = mock_supabase.table.return_value
            mock_table.execute.side_effect = [
                Mock(data=[]),  # Validation for PO-001
                Mock(data=[]),  # Validation for PO-002
                Mock(data=[{**mock_breakdowns[0], 'code': 'PO-001'}]),  # Update item 1 success
            ]
            
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                result = await service.bulk_update_codes(
                    code_mappings, sample_project_id, sample_user_id, validate_first=True
                )
        
        assert len(result['successful']) == 1
        assert len(result['failed']) == 1
        assert result['successful'][0] == breakdown_ids[0]
        assert result['failed'][0]['breakdown_id'] == str(breakdown_ids[1])


# Add typing import at the top
from typing import Optional, Dict, Any
