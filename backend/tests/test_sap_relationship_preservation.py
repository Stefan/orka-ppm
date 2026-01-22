"""
Unit tests for SAP Relationship Preservation (Task 6.3)

This module tests the SAP relationship tracking and restoration capabilities
that preserve original parent-child relationships during custom modifications.

**Validates: Requirements 4.6**
"""

import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownType,
    HierarchyMoveRequest,
    SAPRelationshipInfo,
    SAPRelationshipRestoreRequest,
    SAPRelationshipRestoreResult,
)


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
    mock.execute = Mock(return_value=Mock(data=[]))
    return mock


@pytest.fixture
def service(mock_supabase):
    """Create a POBreakdownDatabaseService instance with mock client"""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def sample_breakdown_data():
    """Create sample breakdown data for testing"""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'name': 'Test Breakdown',
        'code': 'TEST-001',
        'sap_po_number': 'PO-2024-001',
        'sap_line_item': 'L001',
        'hierarchy_level': 1,
        'parent_breakdown_id': str(uuid4()),
        'original_sap_parent_id': None,
        'sap_hierarchy_path': None,
        'has_custom_parent': False,
        'cost_center': 'CC-001',
        'gl_account': 'GL-001',
        'planned_amount': '10000.00',
        'committed_amount': '8000.00',
        'actual_amount': '7500.00',
        'remaining_amount': '2500.00',
        'currency': 'USD',
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': 'Construction',
        'subcategory': 'Materials',
        'custom_fields': {},
        'tags': [],
        'notes': None,
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


class TestSAPRelationshipPreservation:
    """Test SAP relationship preservation functionality"""
    
    @pytest.mark.asyncio
    async def test_preserve_sap_relationship_success(self, service, sample_breakdown_data):
        """
        Test successful preservation of SAP relationship.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        parent_id = UUID(sample_breakdown_data['parent_breakdown_id'])
        
        # Mock get_breakdown_by_id to return breakdown
        service.get_breakdown_by_id = AsyncMock(return_value=POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'parent_breakdown_id': parent_id,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }))
        
        # Mock _calculate_hierarchy_path
        service._calculate_hierarchy_path = AsyncMock(return_value=[parent_id, breakdown_id])
        
        # Mock database update
        service.supabase.table().update().eq().execute.return_value = Mock(
            data=[{**sample_breakdown_data, 'original_sap_parent_id': str(parent_id)}]
        )
        
        # Mock version record creation
        service._create_version_record = AsyncMock()
        
        # Execute
        result = await service.preserve_sap_relationship(breakdown_id, user_id)
        
        # Verify
        assert result is True
        # Check that update was called (don't check exact count due to mock chaining)
        assert service.supabase.table().update.called
        service._create_version_record.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_preserve_sap_relationship_already_preserved(self, service, sample_breakdown_data):
        """
        Test that preservation is skipped if already preserved.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Mock breakdown with custom parent already set
        service.get_breakdown_by_id = AsyncMock(return_value=POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'parent_breakdown_id': UUID(sample_breakdown_data['parent_breakdown_id']),
            'has_custom_parent': True,  # Already preserved
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }))
        
        # Execute
        result = await service.preserve_sap_relationship(breakdown_id, user_id)
        
        # Verify - should return False (not preserved again)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_preserve_sap_relationship_not_found(self, service):
        """
        Test preservation fails when breakdown not found.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        # Mock breakdown not found
        service.get_breakdown_by_id = AsyncMock(return_value=None)
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="not found"):
            await service.preserve_sap_relationship(breakdown_id, user_id)
    
    @pytest.mark.asyncio
    async def test_move_breakdown_with_sap_preservation(self, service, sample_breakdown_data):
        """
        Test moving breakdown while preserving SAP relationships.
        
        **Validates: Requirements 2.2, 2.4, 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        old_parent_id = UUID(sample_breakdown_data['parent_breakdown_id'])
        new_parent_id = uuid4()
        
        current_breakdown = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'parent_breakdown_id': old_parent_id,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock methods
        service.get_breakdown_by_id = AsyncMock(return_value=current_breakdown)
        service.preserve_sap_relationship = AsyncMock(return_value=True)
        service.move_breakdown = AsyncMock(return_value=(current_breakdown, Mock(is_valid=True)))
        service.supabase.table().update().eq().execute.return_value = Mock(data=[sample_breakdown_data])
        
        # Execute
        move_request = HierarchyMoveRequest(new_parent_id=new_parent_id)
        result, validation = await service.move_breakdown_with_sap_preservation(
            breakdown_id, move_request, user_id
        )
        
        # Verify
        service.preserve_sap_relationship.assert_called_once_with(breakdown_id, user_id)
        service.move_breakdown.assert_called_once()
        assert validation.is_valid is True
    
    @pytest.mark.asyncio
    async def test_get_sap_relationship_info_with_original_parent(self, service, sample_breakdown_data):
        """
        Test getting SAP relationship info when original parent exists.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        original_parent_id = uuid4()
        current_parent_id = uuid4()
        
        # Mock breakdown with preserved SAP relationship
        breakdown = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'parent_breakdown_id': current_parent_id,
            'original_sap_parent_id': original_parent_id,
            'sap_hierarchy_path': [original_parent_id, breakdown_id],
            'has_custom_parent': True,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock original parent exists
        original_parent = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': original_parent_id,
            'is_active': True,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        service.get_breakdown_by_id = AsyncMock(side_effect=[breakdown, original_parent])
        
        # Execute
        info = await service.get_sap_relationship_info(breakdown_id)
        
        # Verify
        assert info.breakdown_id == breakdown_id
        assert info.original_parent_id == original_parent_id
        assert info.current_parent_id == current_parent_id
        assert info.has_custom_parent is True
        assert info.can_restore is True
        assert len(info.restore_warnings) == 0
    
    @pytest.mark.asyncio
    async def test_get_sap_relationship_info_parent_not_found(self, service, sample_breakdown_data):
        """
        Test getting SAP relationship info when original parent doesn't exist.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        original_parent_id = uuid4()
        
        # Mock breakdown with preserved SAP relationship
        breakdown = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'original_sap_parent_id': original_parent_id,
            'has_custom_parent': True,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock original parent not found
        service.get_breakdown_by_id = AsyncMock(side_effect=[breakdown, None])
        
        # Execute
        info = await service.get_sap_relationship_info(breakdown_id)
        
        # Verify
        assert info.can_restore is False
        assert "no longer exists" in info.restore_warnings[0]
    
    @pytest.mark.asyncio
    async def test_restore_sap_relationships_success(self, service, sample_breakdown_data):
        """
        Test successful restoration of SAP relationships.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        original_parent_id = uuid4()
        user_id = uuid4()
        
        # Mock breakdown with custom parent
        breakdown = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'parent_breakdown_id': uuid4(),  # Current custom parent
            'original_sap_parent_id': original_parent_id,
            'has_custom_parent': True,
            'hierarchy_level': 2,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock original parent
        original_parent = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': original_parent_id,
            'hierarchy_level': 1,
            'is_active': True,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock SAP relationship info
        sap_info = SAPRelationshipInfo(
            breakdown_id=breakdown_id,
            original_parent_id=original_parent_id,
            current_parent_id=breakdown.parent_breakdown_id,
            has_custom_parent=True,
            sap_hierarchy_path=[original_parent_id, breakdown_id],
            can_restore=True,
            restore_warnings=[]
        )
        
        service.get_sap_relationship_info = AsyncMock(return_value=sap_info)
        service.get_breakdown_by_id = AsyncMock(side_effect=[breakdown, original_parent])
        service._update_children_levels = AsyncMock()
        service._recalculate_parent_totals = AsyncMock()
        service._create_version_record = AsyncMock()
        service._get_all_descendants = AsyncMock(return_value=[])
        
        # Mock database update
        service.supabase.table().update().eq().execute.return_value = Mock(
            data=[{**sample_breakdown_data, 'has_custom_parent': False}]
        )
        
        # Execute
        restore_request = SAPRelationshipRestoreRequest(
            breakdown_ids=[breakdown_id],
            restore_descendants=False,
            validate_only=False
        )
        result = await service.restore_sap_relationships(restore_request, user_id)
        
        # Verify
        assert result.total_restored == 1
        assert result.total_failed == 0
        assert breakdown_id in result.successful_restorations
        service._update_children_levels.assert_called_once()
        service._recalculate_parent_totals.assert_called()
    
    @pytest.mark.asyncio
    async def test_restore_sap_relationships_validate_only(self, service, sample_breakdown_data):
        """
        Test validation-only mode for SAP relationship restoration.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Mock SAP relationship info
        sap_info = SAPRelationshipInfo(
            breakdown_id=breakdown_id,
            original_parent_id=uuid4(),
            current_parent_id=uuid4(),
            has_custom_parent=True,
            sap_hierarchy_path=[],
            can_restore=True,
            restore_warnings=[]
        )
        
        service.get_sap_relationship_info = AsyncMock(return_value=sap_info)
        
        # Execute with validate_only=True
        restore_request = SAPRelationshipRestoreRequest(
            breakdown_ids=[breakdown_id],
            restore_descendants=False,
            validate_only=True
        )
        result = await service.restore_sap_relationships(restore_request, user_id)
        
        # Verify - should succeed without actually updating
        assert result.total_restored == 1
        assert breakdown_id in result.successful_restorations
    
    @pytest.mark.asyncio
    async def test_restore_sap_relationships_cannot_restore(self, service):
        """
        Test restoration fails when original parent doesn't exist.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        # Mock SAP relationship info with cannot restore
        sap_info = SAPRelationshipInfo(
            breakdown_id=breakdown_id,
            original_parent_id=uuid4(),
            current_parent_id=uuid4(),
            has_custom_parent=True,
            sap_hierarchy_path=[],
            can_restore=False,
            restore_warnings=["Original SAP parent no longer exists"]
        )
        
        service.get_sap_relationship_info = AsyncMock(return_value=sap_info)
        
        # Execute
        restore_request = SAPRelationshipRestoreRequest(
            breakdown_ids=[breakdown_id],
            restore_descendants=False,
            validate_only=False
        )
        result = await service.restore_sap_relationships(restore_request, user_id)
        
        # Verify
        assert result.total_restored == 0
        assert result.total_failed == 1
        assert len(result.failed_restorations) == 1
        assert result.failed_restorations[0]['breakdown_id'] == str(breakdown_id)
    
    @pytest.mark.asyncio
    async def test_restore_sap_relationships_with_descendants(self, service, sample_breakdown_data):
        """
        Test restoration with descendants option.
        
        **Validates: Requirements 4.6**
        """
        parent_id = UUID(sample_breakdown_data['id'])
        child_id = uuid4()
        user_id = uuid4()
        
        # Mock parent breakdown
        parent = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': parent_id,
            'has_custom_parent': True,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock child breakdown
        child = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': child_id,
            'parent_breakdown_id': parent_id,
            'has_custom_parent': True,
            'planned_amount': Decimal('5000.00'),
            'committed_amount': Decimal('4000.00'),
            'actual_amount': Decimal('3500.00'),
            'remaining_amount': Decimal('1500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        # Mock methods
        service.get_sap_relationship_info = AsyncMock(return_value=SAPRelationshipInfo(
            breakdown_id=parent_id,
            original_parent_id=uuid4(),
            current_parent_id=uuid4(),
            has_custom_parent=True,
            sap_hierarchy_path=[],
            can_restore=True,
            restore_warnings=[]
        ))
        service.get_breakdown_by_id = AsyncMock(side_effect=[parent, Mock(hierarchy_level=0)])
        service._get_all_descendants = AsyncMock(return_value=[child])
        service._update_children_levels = AsyncMock()
        service._recalculate_parent_totals = AsyncMock()
        service._create_version_record = AsyncMock()
        
        # Mock database update
        service.supabase.table().update().eq().execute.return_value = Mock(
            data=[sample_breakdown_data]
        )
        
        # Execute with restore_descendants=True
        restore_request = SAPRelationshipRestoreRequest(
            breakdown_ids=[parent_id],
            restore_descendants=True,
            validate_only=False
        )
        result = await service.restore_sap_relationships(restore_request, user_id)
        
        # Verify
        assert result.total_restored >= 1
        service._get_all_descendants.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_calculate_hierarchy_path(self, service, sample_breakdown_data):
        """
        Test calculation of hierarchy path from root to breakdown.
        
        **Validates: Requirements 4.6**
        """
        root_id = uuid4()
        parent_id = uuid4()
        child_id = UUID(sample_breakdown_data['id'])
        
        # Mock hierarchy: root -> parent -> child
        root = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': root_id,
            'parent_breakdown_id': None,
            'hierarchy_level': 0,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        parent = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': parent_id,
            'parent_breakdown_id': root_id,
            'hierarchy_level': 1,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        child = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': child_id,
            'parent_breakdown_id': parent_id,
            'hierarchy_level': 2,
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        service.get_breakdown_by_id = AsyncMock(side_effect=[child, parent, root])
        
        # Execute
        path = await service._calculate_hierarchy_path(child_id)
        
        # Verify
        assert len(path) == 3
        assert path[0] == root_id
        assert path[1] == parent_id
        assert path[2] == child_id


class TestSAPRelationshipEdgeCases:
    """Test edge cases for SAP relationship preservation"""
    
    @pytest.mark.asyncio
    async def test_preserve_custom_hierarchy_type(self, service, sample_breakdown_data):
        """
        Test that custom hierarchy types are not preserved.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        user_id = uuid4()
        
        # Mock breakdown with custom_hierarchy type
        service.get_breakdown_by_id = AsyncMock(return_value=POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'project_id': UUID(sample_breakdown_data['project_id']),
            'breakdown_type': POBreakdownType.custom_hierarchy,  # Not SAP standard
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }))
        
        # Execute
        result = await service.preserve_sap_relationship(breakdown_id, user_id)
        
        # Verify - should not preserve non-SAP types
        assert result is False
    
    @pytest.mark.asyncio
    async def test_restore_already_at_original_parent(self, service):
        """
        Test restoration when breakdown is already at original parent.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = uuid4()
        user_id = uuid4()
        
        # Mock SAP relationship info - already at original parent
        sap_info = SAPRelationshipInfo(
            breakdown_id=breakdown_id,
            original_parent_id=uuid4(),
            current_parent_id=uuid4(),
            has_custom_parent=False,  # Already at original
            sap_hierarchy_path=[],
            can_restore=True,
            restore_warnings=[]
        )
        
        service.get_sap_relationship_info = AsyncMock(return_value=sap_info)
        
        # Execute
        restore_request = SAPRelationshipRestoreRequest(
            breakdown_ids=[breakdown_id],
            restore_descendants=False,
            validate_only=False
        )
        result = await service.restore_sap_relationships(restore_request, user_id)
        
        # Verify - should succeed with warning
        assert result.total_restored == 1
        assert len(result.warnings) > 0
        assert "already has original SAP parent" in result.warnings[0]
    
    @pytest.mark.asyncio
    async def test_hierarchy_path_prevents_infinite_loop(self, service, sample_breakdown_data):
        """
        Test that hierarchy path calculation prevents infinite loops.
        
        **Validates: Requirements 4.6**
        """
        breakdown_id = UUID(sample_breakdown_data['id'])
        
        # Mock circular reference (should not happen, but test safety)
        circular_breakdown = POBreakdownResponse(**{
            **sample_breakdown_data,
            'id': breakdown_id,
            'parent_breakdown_id': breakdown_id,  # Points to itself
            'planned_amount': Decimal('10000.00'),
            'committed_amount': Decimal('8000.00'),
            'actual_amount': Decimal('7500.00'),
            'remaining_amount': Decimal('2500.00'),
            'exchange_rate': Decimal('1.0'),
            'breakdown_type': POBreakdownType.sap_standard,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        })
        
        service.get_breakdown_by_id = AsyncMock(return_value=circular_breakdown)
        
        # Execute - should not hang
        path = await service._calculate_hierarchy_path(breakdown_id)
        
        # Verify - should stop at max iterations
        assert len(path) <= 11  # MAX_HIERARCHY_DEPTH + 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
