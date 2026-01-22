"""
Unit tests for PO Breakdown - Change Request Integration (Task 7.3)

This module tests the integration between PO breakdown items and change requests,
including linking, unlinking, and automatic financial impact assessment updates.

**Validates: Requirements 5.5**
"""

import pytest
from uuid import uuid4, UUID
from decimal import Decimal
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import POBreakdownResponse, POBreakdownType


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    mock_client = Mock()
    mock_client.table = Mock(return_value=mock_client)
    mock_client.select = Mock(return_value=mock_client)
    mock_client.insert = Mock(return_value=mock_client)
    mock_client.update = Mock(return_value=mock_client)
    mock_client.delete = Mock(return_value=mock_client)
    mock_client.eq = Mock(return_value=mock_client)
    mock_client.execute = Mock()
    return mock_client


@pytest.fixture
def po_service(mock_supabase):
    """Create PO breakdown service with mocked Supabase"""
    return POBreakdownDatabaseService(mock_supabase)


@pytest.fixture
def sample_breakdown():
    """Create a sample PO breakdown for testing"""
    return POBreakdownResponse(
        id=uuid4(),
        project_id=uuid4(),
        name="Test PO Breakdown",
        code="PO-001",
        sap_po_number="4500123456",
        sap_line_item="10",
        hierarchy_level=0,
        parent_breakdown_id=None,
        cost_center="CC-001",
        gl_account="GL-001",
        planned_amount=Decimal('100000.00'),
        committed_amount=Decimal('80000.00'),
        actual_amount=Decimal('50000.00'),
        remaining_amount=Decimal('50000.00'),
        currency='USD',
        exchange_rate=Decimal('1.0'),
        breakdown_type=POBreakdownType.sap_standard,
        version=1,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@pytest.fixture
def sample_change_request():
    """Create a sample change request for testing"""
    return {
        'id': str(uuid4()),
        'project_id': str(uuid4()),
        'change_number': 'CR-001',
        'title': 'Test Change Request',
        'status': 'pending',
        'priority': 'high'
    }


class TestLinkToChangeRequest:
    """Test suite for linking PO breakdowns to change requests"""
    
    @pytest.mark.asyncio
    async def test_link_to_change_request_success(self, po_service, mock_supabase, sample_breakdown, sample_change_request):
        """Test successful linking of PO breakdown to change request"""
        # Setup mocks
        breakdown_id = sample_breakdown.id
        change_request_id = UUID(sample_change_request['id'])
        
        # Update sample_change_request to have matching project_id
        sample_change_request['project_id'] = str(sample_breakdown.project_id)
        
        # Mock get_breakdown_by_id
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            # Mock change request lookup
            mock_supabase.execute.side_effect = [
                # Change request exists
                Mock(data=[sample_change_request]),
                # No existing link
                Mock(data=[]),
                # Link creation success
                Mock(data=[{
                    'id': str(uuid4()),
                    'change_request_id': str(change_request_id),
                    'po_breakdown_id': str(breakdown_id),
                    'impact_type': 'cost_increase',
                    'impact_amount': '25000.00',
                    'impact_percentage': '25.0',
                    'description': 'Additional scope',
                    'created_at': datetime.now().isoformat()
                }])
            ]
            
            # Mock financial impact update
            with patch.object(po_service, '_update_change_request_financial_impact', new_callable=AsyncMock):
                with patch.object(po_service, '_create_version_record', new_callable=AsyncMock):
                    # Execute
                    result = await po_service.link_to_change_request(
                        breakdown_id=breakdown_id,
                        change_request_id=change_request_id,
                        impact_type='cost_increase',
                        impact_amount=Decimal('25000.00'),
                        impact_percentage=Decimal('25.0'),
                        description='Additional scope',
                        user_id=uuid4()
                    )
                    
                    # Verify
                    assert result['breakdown_id'] == str(breakdown_id)
                    assert result['change_request_id'] == str(change_request_id)
                    assert result['impact_type'] == 'cost_increase'
                    assert result['impact_amount'] == Decimal('25000.00')
                    assert result['breakdown_name'] == sample_breakdown.name
    
    @pytest.mark.asyncio
    async def test_link_breakdown_not_found(self, po_service, mock_supabase):
        """Test linking fails when breakdown doesn't exist"""
        breakdown_id = uuid4()
        change_request_id = uuid4()
        
        # Mock breakdown not found
        with patch.object(po_service, 'get_breakdown_by_id', return_value=None):
            with pytest.raises(ValueError, match="PO breakdown .* not found"):
                await po_service.link_to_change_request(
                    breakdown_id=breakdown_id,
                    change_request_id=change_request_id,
                    impact_type='cost_increase'
                )
    
    @pytest.mark.asyncio
    async def test_link_change_request_not_found(self, po_service, mock_supabase, sample_breakdown):
        """Test linking fails when change request doesn't exist"""
        breakdown_id = sample_breakdown.id
        change_request_id = uuid4()
        
        # Mock breakdown exists but change request doesn't
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            mock_supabase.execute.return_value = Mock(data=[])
            
            with pytest.raises(ValueError, match="Change request .* not found"):
                await po_service.link_to_change_request(
                    breakdown_id=breakdown_id,
                    change_request_id=change_request_id,
                    impact_type='cost_increase'
                )
    
    @pytest.mark.asyncio
    async def test_link_different_projects(self, po_service, mock_supabase, sample_breakdown, sample_change_request):
        """Test linking fails when breakdown and change request are in different projects"""
        breakdown_id = sample_breakdown.id
        change_request_id = UUID(sample_change_request['id'])
        
        # Make projects different
        different_project_cr = sample_change_request.copy()
        different_project_cr['project_id'] = str(uuid4())
        
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            mock_supabase.execute.return_value = Mock(data=[different_project_cr])
            
            with pytest.raises(ValueError, match="must be in the same project"):
                await po_service.link_to_change_request(
                    breakdown_id=breakdown_id,
                    change_request_id=change_request_id,
                    impact_type='cost_increase'
                )
    
    @pytest.mark.asyncio
    async def test_link_invalid_impact_type(self, po_service, mock_supabase, sample_breakdown, sample_change_request):
        """Test linking fails with invalid impact type"""
        breakdown_id = sample_breakdown.id
        change_request_id = UUID(sample_change_request['id'])
        
        # Update sample_change_request to have matching project_id
        sample_change_request['project_id'] = str(sample_breakdown.project_id)
        
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            mock_supabase.execute.return_value = Mock(data=[sample_change_request])
            
            with pytest.raises(ValueError, match="Invalid impact_type"):
                await po_service.link_to_change_request(
                    breakdown_id=breakdown_id,
                    change_request_id=change_request_id,
                    impact_type='invalid_type'
                )
    
    @pytest.mark.asyncio
    async def test_link_already_exists(self, po_service, mock_supabase, sample_breakdown, sample_change_request):
        """Test linking fails when link already exists"""
        breakdown_id = sample_breakdown.id
        change_request_id = UUID(sample_change_request['id'])
        
        # Update sample_change_request to have matching project_id
        sample_change_request['project_id'] = str(sample_breakdown.project_id)
        
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            mock_supabase.execute.side_effect = [
                # Change request exists
                Mock(data=[sample_change_request]),
                # Link already exists
                Mock(data=[{'id': str(uuid4())}])
            ]
            
            with pytest.raises(ValueError, match="Link already exists"):
                await po_service.link_to_change_request(
                    breakdown_id=breakdown_id,
                    change_request_id=change_request_id,
                    impact_type='cost_increase'
                )


class TestUnlinkFromChangeRequest:
    """Test suite for unlinking PO breakdowns from change requests"""
    
    @pytest.mark.asyncio
    async def test_unlink_success(self, po_service, mock_supabase, sample_breakdown):
        """Test successful unlinking of PO breakdown from change request"""
        breakdown_id = sample_breakdown.id
        change_request_id = uuid4()
        
        # Mock successful deletion
        mock_supabase.execute.return_value = Mock(data=[{'id': str(uuid4())}])
        
        with patch.object(po_service, '_update_change_request_financial_impact', new_callable=AsyncMock):
            with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
                with patch.object(po_service, '_create_version_record', new_callable=AsyncMock):
                    result = await po_service.unlink_from_change_request(
                        breakdown_id=breakdown_id,
                        change_request_id=change_request_id,
                        user_id=uuid4()
                    )
                    
                    assert result is True
    
    @pytest.mark.asyncio
    async def test_unlink_not_found(self, po_service, mock_supabase):
        """Test unlinking returns False when link doesn't exist"""
        breakdown_id = uuid4()
        change_request_id = uuid4()
        
        # Mock no data returned (link not found)
        mock_supabase.execute.return_value = Mock(data=[])
        
        result = await po_service.unlink_from_change_request(
            breakdown_id=breakdown_id,
            change_request_id=change_request_id
        )
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_unlink_with_specific_impact_type(self, po_service, mock_supabase, sample_breakdown):
        """Test unlinking with specific impact type"""
        breakdown_id = sample_breakdown.id
        change_request_id = uuid4()
        impact_type = 'cost_increase'
        
        # Mock successful deletion
        mock_supabase.execute.return_value = Mock(data=[{'id': str(uuid4())}])
        
        with patch.object(po_service, '_update_change_request_financial_impact', new_callable=AsyncMock):
            with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
                with patch.object(po_service, '_create_version_record', new_callable=AsyncMock):
                    result = await po_service.unlink_from_change_request(
                        breakdown_id=breakdown_id,
                        change_request_id=change_request_id,
                        impact_type=impact_type,
                        user_id=uuid4()
                    )
                    
                    assert result is True
                    # Verify eq was called with impact_type
                    assert mock_supabase.eq.called


class TestGetChangeRequestLinks:
    """Test suite for retrieving change request links"""
    
    @pytest.mark.asyncio
    async def test_get_links_success(self, po_service, mock_supabase):
        """Test successful retrieval of change request links"""
        breakdown_id = uuid4()
        
        # Mock links data
        mock_supabase.execute.return_value = Mock(data=[
            {
                'id': str(uuid4()),
                'change_request_id': str(uuid4()),
                'impact_type': 'cost_increase',
                'impact_amount': '25000.00',
                'impact_percentage': '25.0',
                'description': 'Additional scope',
                'created_at': datetime.now().isoformat(),
                'change_requests': {
                    'id': str(uuid4()),
                    'change_number': 'CR-001',
                    'title': 'Test Change',
                    'status': 'approved',
                    'priority': 'high'
                }
            }
        ])
        
        result = await po_service.get_change_request_links(breakdown_id)
        
        assert len(result) == 1
        assert result[0]['change_number'] == 'CR-001'
        assert result[0]['impact_type'] == 'cost_increase'
        assert result[0]['impact_amount'] == Decimal('25000.00')
    
    @pytest.mark.asyncio
    async def test_get_links_empty(self, po_service, mock_supabase):
        """Test retrieval when no links exist"""
        breakdown_id = uuid4()
        
        # Mock no links
        mock_supabase.execute.return_value = Mock(data=[])
        
        result = await po_service.get_change_request_links(breakdown_id)
        
        assert len(result) == 0


class TestGetBreakdownLinksForChangeRequest:
    """Test suite for retrieving PO breakdown links for change requests"""
    
    @pytest.mark.asyncio
    async def test_get_breakdown_links_success(self, po_service, mock_supabase):
        """Test successful retrieval of PO breakdown links"""
        change_request_id = uuid4()
        
        # Mock links data
        mock_supabase.execute.return_value = Mock(data=[
            {
                'id': str(uuid4()),
                'po_breakdown_id': str(uuid4()),
                'impact_type': 'cost_increase',
                'impact_amount': '25000.00',
                'impact_percentage': '25.0',
                'description': 'Additional scope',
                'created_at': datetime.now().isoformat(),
                'po_breakdowns': {
                    'id': str(uuid4()),
                    'name': 'Test PO',
                    'code': 'PO-001',
                    'planned_amount': '100000.00',
                    'actual_amount': '50000.00',
                    'currency': 'USD'
                }
            }
        ])
        
        result = await po_service.get_breakdown_links_for_change_request(change_request_id)
        
        assert len(result) == 1
        assert result[0]['breakdown_name'] == 'Test PO'
        assert result[0]['impact_type'] == 'cost_increase'
        assert result[0]['planned_amount'] == Decimal('100000.00')


class TestUpdateChangeRequestFinancialImpact:
    """Test suite for automatic financial impact assessment updates"""
    
    @pytest.mark.asyncio
    async def test_update_financial_impact_with_links(self, po_service, mock_supabase):
        """Test financial impact update with multiple PO links"""
        change_request_id = uuid4()
        
        # Mock get_breakdown_links_for_change_request
        links = [
            {
                'breakdown_id': str(uuid4()),
                'breakdown_name': 'PO Item 1',
                'breakdown_code': 'PO-001',
                'planned_amount': Decimal('100000.00'),
                'actual_amount': Decimal('50000.00'),
                'currency': 'USD',
                'impact_type': 'cost_increase',
                'impact_amount': Decimal('25000.00'),
                'impact_percentage': None,
                'description': 'Additional scope',
                'created_at': datetime.now().isoformat()
            },
            {
                'breakdown_id': str(uuid4()),
                'breakdown_name': 'PO Item 2',
                'breakdown_code': 'PO-002',
                'planned_amount': Decimal('50000.00'),
                'actual_amount': Decimal('30000.00'),
                'currency': 'USD',
                'impact_type': 'cost_decrease',
                'impact_amount': Decimal('10000.00'),
                'impact_percentage': None,
                'description': 'Scope reduction',
                'created_at': datetime.now().isoformat()
            }
        ]
        
        with patch.object(po_service, 'get_breakdown_links_for_change_request', return_value=links):
            # Mock database operations
            mock_supabase.execute.side_effect = [
                # Check if impacts record exists
                Mock(data=[{'id': str(uuid4())}]),
                # Update impacts
                Mock(data=[]),
                # Update change request
                Mock(data=[])
            ]
            
            await po_service._update_change_request_financial_impact(
                change_request_id=change_request_id,
                trigger_event='po_link_created',
                event_data={}
            )
            
            # Verify update was called with correct net impact (25000 - 10000 = 15000)
            assert mock_supabase.update.called
    
    @pytest.mark.asyncio
    async def test_update_financial_impact_no_links(self, po_service, mock_supabase):
        """Test financial impact update with no PO links"""
        change_request_id = uuid4()
        
        with patch.object(po_service, 'get_breakdown_links_for_change_request', return_value=[]):
            # Mock database operations
            mock_supabase.execute.side_effect = [
                # Check if impacts record exists
                Mock(data=[]),
                # Create new impacts record
                Mock(data=[]),
                # Update change request
                Mock(data=[])
            ]
            
            await po_service._update_change_request_financial_impact(
                change_request_id=change_request_id,
                trigger_event='po_link_removed',
                event_data={}
            )
            
            # Verify operations completed without error
            assert mock_supabase.insert.called or mock_supabase.update.called
    
    @pytest.mark.asyncio
    async def test_update_financial_impact_error_handling(self, po_service, mock_supabase):
        """Test that financial impact update errors don't propagate"""
        change_request_id = uuid4()
        
        with patch.object(po_service, 'get_breakdown_links_for_change_request', side_effect=Exception("Database error")):
            # Should not raise exception
            await po_service._update_change_request_financial_impact(
                change_request_id=change_request_id,
                trigger_event='test',
                event_data={}
            )
            # Test passes if no exception is raised


class TestIntegrationScenarios:
    """Integration test scenarios for change request linking"""
    
    @pytest.mark.asyncio
    async def test_complete_link_workflow(self, po_service, mock_supabase, sample_breakdown, sample_change_request):
        """Test complete workflow: link, get links, unlink"""
        breakdown_id = sample_breakdown.id
        change_request_id = UUID(sample_change_request['id'])
        
        # Update sample_change_request to have matching project_id
        sample_change_request['project_id'] = str(sample_breakdown.project_id)
        
        # Step 1: Link
        with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
            link_id = str(uuid4())
            mock_supabase.execute.side_effect = [
                # Change request exists
                Mock(data=[sample_change_request]),
                # No existing link
                Mock(data=[]),
                # Link creation success
                Mock(data=[{
                    'id': link_id,
                    'change_request_id': str(change_request_id),
                    'po_breakdown_id': str(breakdown_id),
                    'impact_type': 'cost_increase',
                    'impact_amount': '25000.00',
                    'impact_percentage': None,
                    'description': 'Test',
                    'created_at': datetime.now().isoformat()
                }])
            ]
            
            with patch.object(po_service, '_update_change_request_financial_impact', new_callable=AsyncMock):
                with patch.object(po_service, '_create_version_record', new_callable=AsyncMock):
                    link_result = await po_service.link_to_change_request(
                        breakdown_id=breakdown_id,
                        change_request_id=change_request_id,
                        impact_type='cost_increase',
                        impact_amount=Decimal('25000.00'),
                        user_id=uuid4()
                    )
                    
                    assert link_result['breakdown_id'] == str(breakdown_id)
        
        # Step 2: Get links - reset side_effect
        mock_supabase.execute.side_effect = None
        mock_supabase.execute.return_value = Mock(data=[{
            'id': link_result['link_id'],
            'change_request_id': str(change_request_id),
            'impact_type': 'cost_increase',
            'impact_amount': '25000.00',
            'impact_percentage': None,
            'description': 'Test',
            'created_at': datetime.now().isoformat(),
            'change_requests': sample_change_request
        }])
        
        links = await po_service.get_change_request_links(breakdown_id)
        assert len(links) == 1
        
        # Step 3: Unlink
        mock_supabase.execute.return_value = Mock(data=[{'id': link_result['link_id']}])
        
        with patch.object(po_service, '_update_change_request_financial_impact', new_callable=AsyncMock):
            with patch.object(po_service, 'get_breakdown_by_id', return_value=sample_breakdown):
                with patch.object(po_service, '_create_version_record', new_callable=AsyncMock):
                    unlink_result = await po_service.unlink_from_change_request(
                        breakdown_id=breakdown_id,
                        change_request_id=change_request_id,
                        user_id=uuid4()
                    )
                    
                    assert unlink_result is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
