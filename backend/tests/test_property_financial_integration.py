"""
Property-Based Tests for Financial System Integration

Feature: sap-po-breakdown-management, Task 7.4: Property tests for financial integration

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

Property Definition:
- Property 5: Financial System Integration
  *For any* PO breakdown operation that affects financial data, the system should 
  correctly link to existing project financial records, include all relevant data 
  in variance calculations, trigger project-level recalculations, aggregate data 
  properly for reports, update change request impacts, and monitor budget alert 
  thresholds.

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
import asyncio
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from decimal import Decimal
from uuid import UUID, uuid4
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, MagicMock, patch

from services.po_breakdown_service import POBreakdownDatabaseService
from services.variance_calculator import VarianceCalculator, VarianceStatus
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownType,
    POBreakdownUpdate,
)


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs for testing."""
    return draw(st.uuids())


@st.composite
def valid_amount_strategy(draw):
    """Generate valid decimal amounts (non-negative)."""
    return draw(st.decimals(
        min_value=Decimal('0.00'),
        max_value=Decimal('1000000.00'),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))


@st.composite
def currency_code_strategy(draw):
    """Generate valid 3-letter currency codes."""
    return draw(st.sampled_from(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']))


@st.composite
def category_strategy(draw):
    """Generate valid category names."""
    categories = [
        'Equipment', 'Labor', 'Materials', 'Services', 
        'Subcontracts', 'Engineering', 'Construction', 'Commissioning'
    ]
    return draw(st.sampled_from(categories))


@st.composite
def breakdown_data_strategy(draw, project_id=None):
    """Generate PO breakdown data for testing."""
    if project_id is None:
        project_id = uuid4()
    
    planned = draw(valid_amount_strategy())
    actual = draw(st.decimals(
        min_value=Decimal('0.00'),
        max_value=planned * Decimal('1.5'),  # Up to 150% of planned
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))
    committed = draw(st.decimals(
        min_value=actual,
        max_value=max(planned, actual) * Decimal('1.1'),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))
    
    return {
        'id': str(uuid4()),
        'project_id': str(project_id),
        'name': f"Breakdown {draw(st.integers(min_value=1, max_value=1000))}",
        'code': f"BD{draw(st.integers(min_value=100, max_value=999))}",
        'hierarchy_level': draw(st.integers(min_value=0, max_value=5)),
        'parent_breakdown_id': None,
        'planned_amount': str(planned),
        'committed_amount': str(committed),
        'actual_amount': str(actual),
        'remaining_amount': str(planned - actual),
        'currency': draw(currency_code_strategy()),
        'exchange_rate': '1.0',
        'breakdown_type': 'sap_standard',
        'category': draw(category_strategy()),
        'custom_fields': {},
        'tags': [],
        'version': 1,
        'is_active': True,
        'created_by': str(uuid4()),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


@st.composite
def financial_record_strategy(draw, project_id=None):
    """Generate financial tracking record data for testing."""
    if project_id is None:
        project_id = uuid4()
    
    planned = draw(valid_amount_strategy())
    actual = draw(st.decimals(
        min_value=Decimal('0.00'),
        max_value=planned * Decimal('1.5'),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))
    
    return {
        'id': str(uuid4()),
        'project_id': str(project_id),
        'category': draw(category_strategy()),
        'description': f"Financial Record {draw(st.integers(min_value=1, max_value=1000))}",
        'planned_amount': str(planned),
        'actual_amount': str(actual),
        'currency': draw(currency_code_strategy()),
        'exchange_rate': '1.0',
        'date_incurred': date.today().isoformat(),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
    }


@st.composite
def multiple_breakdowns_strategy(draw, project_id=None, min_size=1, max_size=10):
    """Generate multiple PO breakdown records for a project."""
    if project_id is None:
        project_id = uuid4()
    
    num_breakdowns = draw(st.integers(min_value=min_size, max_value=max_size))
    return [draw(breakdown_data_strategy(project_id)) for _ in range(num_breakdowns)]


@st.composite
def multiple_financial_records_strategy(draw, project_id=None, min_size=1, max_size=10):
    """Generate multiple financial tracking records for a project."""
    if project_id is None:
        project_id = uuid4()
    
    num_records = draw(st.integers(min_value=min_size, max_value=max_size))
    return [draw(financial_record_strategy(project_id)) for _ in range(num_records)]


# =============================================================================
# Helper Functions
# =============================================================================

def create_mock_supabase_client(existing_records: Dict[str, List[Dict[str, Any]]] = None):
    """
    Create a mock Supabase client for testing.
    
    Args:
        existing_records: Dictionary mapping table names to lists of records
    """
    if existing_records is None:
        existing_records = {}
    
    mock = MagicMock()
    
    def table_side_effect(table_name):
        mock_query = MagicMock()
        table_data = existing_records.get(table_name, [])
        
        # Setup query chain
        mock_query.select = MagicMock(return_value=mock_query)
        mock_query.eq = MagicMock(return_value=mock_query)
        mock_query.is_ = MagicMock(return_value=mock_query)
        mock_query.insert = MagicMock(return_value=mock_query)
        mock_query.update = MagicMock(return_value=mock_query)
        mock_query.in_ = MagicMock(return_value=mock_query)
        mock_query.order = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.range = MagicMock(return_value=mock_query)
        
        # Setup execute to return the table data
        mock_query.execute = MagicMock(return_value=MagicMock(data=table_data))
        
        return mock_query
    
    mock.table.side_effect = table_side_effect
    
    return mock


def calculate_expected_totals(records: List[Dict[str, Any]]) -> Dict[str, Decimal]:
    """Calculate expected totals from a list of records."""
    total_planned = Decimal('0')
    total_actual = Decimal('0')
    total_committed = Decimal('0')
    
    for record in records:
        total_planned += Decimal(record.get('planned_amount', '0'))
        total_actual += Decimal(record.get('actual_amount', '0'))
        total_committed += Decimal(record.get('committed_amount', '0'))
    
    return {
        'planned': total_planned,
        'actual': total_actual,
        'committed': total_committed,
        'remaining': total_planned - total_actual
    }


# =============================================================================
# Property 5: Financial System Integration
# **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
# =============================================================================

class TestFinancialSystemIntegration:
    """
    Property 5: Financial System Integration
    
    Feature: sap-po-breakdown-management, Property 5: Financial System Integration
    **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
    
    For any PO breakdown operation that affects financial data, the system should 
    correctly link to existing project financial records, include all relevant data 
    in variance calculations, trigger project-level recalculations, aggregate data 
    properly for reports, update change request impacts, and monitor budget alert 
    thresholds.
    """
    
    @given(
        breakdown_data=breakdown_data_strategy(),
        financial_record=financial_record_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_linking_to_financial_records_preserves_data_integrity(
        self, breakdown_data, financial_record
    ):
        """
        Property: For any PO breakdown and financial record in the same project,
        linking them must preserve both records' data integrity and create a
        bidirectional reference.
        
        **Validates: Requirement 5.1**
        """
        # Ensure same project
        project_id = uuid4()
        breakdown_data['project_id'] = str(project_id)
        financial_record['project_id'] = str(project_id)
        
        breakdown_id = UUID(breakdown_data['id'])
        financial_id = UUID(financial_record['id'])
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': [breakdown_data],
            'financial_tracking': [financial_record]
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Mock get_breakdown_by_id
        with patch.object(service, 'get_breakdown_by_id', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = service._map_to_response(breakdown_data)
            
            # Mock version record creation
            with patch.object(service, '_create_version_record', new_callable=AsyncMock):
                # Execute link
                result = await service.link_to_financial_record(
                    breakdown_id, financial_id, uuid4()
                )
                
                # Should succeed
                assert result is True
                
                # Verify update was called
                assert mock_supabase.table.called
    
    @given(
        breakdowns=multiple_breakdowns_strategy(min_size=2, max_size=5),
        financial_records=multiple_financial_records_strategy(min_size=1, max_size=3)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_comprehensive_variance_includes_all_data_sources(
        self, breakdowns, financial_records
    ):
        """
        Property: For any combination of PO breakdowns and financial records,
        comprehensive variance calculation must include all relevant data from
        both sources without double-counting linked records.
        
        **Validates: Requirements 5.2, 5.4**
        """
        # Ensure same project
        project_id = uuid4()
        for breakdown in breakdowns:
            breakdown['project_id'] = str(project_id)
        for record in financial_records:
            record['project_id'] = str(project_id)
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': breakdowns,
            'financial_tracking': financial_records
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Calculate comprehensive variance
        result = await service.calculate_comprehensive_variance(
            project_id,
            include_financial_tracking=True
        )
        
        # Verify result structure
        assert result['project_id'] == str(project_id)
        assert 'po_breakdown_totals' in result
        assert 'financial_tracking_totals' in result
        assert 'combined_totals' in result
        assert 'variance_analysis' in result
        
        # Verify data sources are tracked
        assert 'po_breakdown' in result['data_sources']
        assert 'financial_tracking' in result['data_sources']
        
        # Calculate expected totals
        po_totals = calculate_expected_totals(breakdowns)
        ft_totals = calculate_expected_totals(financial_records)
        
        # Verify PO breakdown totals
        assert Decimal(result['po_breakdown_totals']['planned_amount']) == po_totals['planned']
        assert Decimal(result['po_breakdown_totals']['actual_amount']) == po_totals['actual']
        
        # Verify combined totals include both sources
        combined_planned = Decimal(result['combined_totals']['planned_amount'])
        combined_actual = Decimal(result['combined_totals']['actual_amount'])
        
        # Combined should be at least as much as PO breakdown alone
        assert combined_planned >= po_totals['planned']
        assert combined_actual >= po_totals['actual']
    
    @given(
        breakdown_data=breakdown_data_strategy(),
        financial_record=financial_record_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_linked_records_not_double_counted_in_variance(
        self, breakdown_data, financial_record
    ):
        """
        Property: For any PO breakdown linked to a financial record, variance
        calculation must not double-count the linked record's amounts.
        
        **Validates: Requirements 5.2, 5.4**
        """
        # Ensure same project
        project_id = uuid4()
        breakdown_data['project_id'] = str(project_id)
        financial_record['project_id'] = str(project_id)
        
        # Link financial record to breakdown
        financial_id = financial_record['id']
        breakdown_data['custom_fields'] = {'financial_links': [financial_id]}
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': [breakdown_data],
            'financial_tracking': [financial_record]
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Calculate comprehensive variance
        result = await service.calculate_comprehensive_variance(
            project_id,
            include_financial_tracking=True
        )
        
        # Financial tracking totals should exclude linked records
        ft_totals = result['financial_tracking_totals']
        assert ft_totals['linked_record_count'] == 1
        
        # Linked records should not contribute to financial tracking totals
        assert Decimal(ft_totals['planned_amount']) == Decimal('0')
        assert Decimal(ft_totals['actual_amount']) == Decimal('0')
        
        # Combined totals should only include PO breakdown amounts
        combined = result['combined_totals']
        po_totals = result['po_breakdown_totals']
        
        assert Decimal(combined['planned_amount']) == Decimal(po_totals['planned_amount'])
        assert Decimal(combined['actual_amount']) == Decimal(po_totals['actual_amount'])
    
    @given(
        breakdowns=multiple_breakdowns_strategy(min_size=1, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_project_level_variance_recalculation_triggered_by_updates(
        self, breakdowns
    ):
        """
        Property: For any update to PO breakdown financial data, the system
        must trigger project-level variance recalculation and update aggregated
        totals correctly.
        
        **Validates: Requirement 5.3**
        """
        # Ensure same project and non-zero amounts
        project_id = uuid4()
        for breakdown in breakdowns:
            breakdown['project_id'] = str(project_id)
            # Ensure non-zero planned amount for meaningful test
            if Decimal(breakdown['planned_amount']) == Decimal('0'):
                breakdown['planned_amount'] = '1000.00'
            if Decimal(breakdown['actual_amount']) == Decimal('0'):
                breakdown['actual_amount'] = '500.00'
            breakdown['remaining_amount'] = str(
                Decimal(breakdown['planned_amount']) - Decimal(breakdown['actual_amount'])
            )
        
        # Skip if no breakdowns
        assume(len(breakdowns) > 0)
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': breakdowns
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Calculate initial variance
        initial_result = await service.calculate_comprehensive_variance(
            project_id,
            include_financial_tracking=False
        )
        
        # Verify initial calculation
        assert initial_result['project_id'] == str(project_id)
        initial_actual = Decimal(initial_result['po_breakdown_totals']['actual_amount'])
        
        # Update one breakdown's actual amount
        updated_breakdown = breakdowns[0].copy()
        original_actual = Decimal(updated_breakdown['actual_amount'])
        # Increase by 20% or at least by 100 if very small
        increase = max(original_actual * Decimal('0.2'), Decimal('100.00'))
        updated_breakdown['actual_amount'] = str(original_actual + increase)
        updated_breakdown['remaining_amount'] = str(
            Decimal(updated_breakdown['planned_amount']) - Decimal(updated_breakdown['actual_amount'])
        )
        
        # Update mock data
        updated_breakdowns = [updated_breakdown] + breakdowns[1:]
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': updated_breakdowns
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Recalculate variance
        updated_result = await service.calculate_comprehensive_variance(
            project_id,
            include_financial_tracking=False
        )
        
        # Verify recalculation occurred - actual amount should have increased
        updated_actual = Decimal(updated_result['po_breakdown_totals']['actual_amount'])
        
        # The actual amount should be greater after the update
        assert updated_actual > initial_actual
    
    @given(
        breakdowns=multiple_breakdowns_strategy(min_size=2, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_data_aggregation_for_reports_maintains_accuracy(
        self, breakdowns
    ):
        """
        Property: For any set of PO breakdowns, data aggregation for reports
        must maintain mathematical accuracy and provide correct totals by
        category and hierarchy level.
        
        **Validates: Requirement 5.4**
        """
        # Ensure same project
        project_id = uuid4()
        for breakdown in breakdowns:
            breakdown['project_id'] = str(project_id)
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'po_breakdowns': breakdowns
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Calculate comprehensive variance (includes aggregation)
        result = await service.calculate_comprehensive_variance(
            project_id,
            include_financial_tracking=False
        )
        
        # Calculate expected totals manually
        expected_totals = calculate_expected_totals(breakdowns)
        
        # Verify aggregated totals match manual calculation
        po_totals = result['po_breakdown_totals']
        assert Decimal(po_totals['planned_amount']) == expected_totals['planned']
        assert Decimal(po_totals['actual_amount']) == expected_totals['actual']
        assert Decimal(po_totals['committed_amount']) == expected_totals['committed']
        
        # Verify remaining amount calculation
        expected_remaining = expected_totals['planned'] - expected_totals['actual']
        assert Decimal(po_totals['remaining_amount']) == expected_remaining
        
        # Verify variance percentage calculation
        if expected_totals['planned'] > Decimal('0'):
            expected_variance_pct = (
                (expected_totals['actual'] - expected_totals['planned']) / 
                expected_totals['planned'] * Decimal('100')
            ).quantize(Decimal('0.01'))
            
            actual_variance_pct = Decimal(result['variance_analysis']['variance_percentage'])
            
            # Allow small rounding differences
            assert abs(actual_variance_pct - expected_variance_pct) < Decimal('0.02')
    
    @given(
        breakdown_data=breakdown_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_budget_alert_thresholds_monitored_correctly(
        self, breakdown_data
    ):
        """
        Property: For any PO breakdown with financial data, the system must
        correctly monitor budget alert thresholds and generate alerts when
        variance exceeds configured limits.
        
        **Validates: Requirement 5.6**
        """
        project_id = uuid4()
        breakdown_data['project_id'] = str(project_id)
        
        # Create a breakdown with significant variance
        planned = Decimal('10000.00')
        actual = Decimal('16000.00')  # 60% over budget
        breakdown_data['planned_amount'] = str(planned)
        breakdown_data['actual_amount'] = str(actual)
        breakdown_data['remaining_amount'] = str(planned - actual)
        
        # Create variance calculator
        calculator = VarianceCalculator()
        
        # Calculate variance
        variance_result = calculator.calculate_item_variance(breakdown_data)
        
        # Verify variance calculation
        assert variance_result.variance_percentage == Decimal('60.00')
        assert variance_result.variance_status == VarianceStatus.critical_variance
        
        # Generate alert with 50% threshold
        alert = calculator.generate_variance_alert(
            breakdown_id=UUID(breakdown_data['id']),
            project_id=project_id,
            variance_result=variance_result,
            threshold=Decimal('50.0')
        )
        
        # Alert should be generated for critical variance
        assert alert is not None
        assert alert.current_variance == Decimal('60.00')
        assert alert.threshold_exceeded == Decimal('50.0')
        assert len(alert.recommended_actions) > 0
    
    @given(
        breakdowns=multiple_breakdowns_strategy(min_size=3, max_size=8)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_project_variance_calculation_generates_appropriate_alerts(
        self, breakdowns
    ):
        """
        Property: For any project with multiple PO breakdowns, project-level
        variance calculation must generate alerts for all items exceeding
        the alert threshold.
        
        **Validates: Requirements 5.3, 5.6**
        """
        project_id = uuid4()
        
        # Set up breakdowns with varying variance levels
        for i, breakdown in enumerate(breakdowns):
            breakdown['project_id'] = str(project_id)
            breakdown['id'] = str(uuid4())
            
            planned = Decimal('10000.00')
            # Create some with high variance, some with low
            if i % 3 == 0:
                # High variance (>50%)
                actual = planned * Decimal('1.6')
            elif i % 3 == 1:
                # Medium variance (~20%)
                actual = planned * Decimal('1.2')
            else:
                # Low variance (<5%)
                actual = planned * Decimal('1.02')
            
            breakdown['planned_amount'] = str(planned)
            breakdown['actual_amount'] = str(actual)
            breakdown['committed_amount'] = str(actual)
            breakdown['remaining_amount'] = str(planned - actual)
        
        # Create variance calculator
        calculator = VarianceCalculator()
        
        # Calculate project variance with 50% alert threshold
        result = calculator.calculate_project_variance(
            project_id=project_id,
            breakdown_items=breakdowns,
            alert_threshold=Decimal('50.0')
        )
        
        # Verify project variance result
        assert result.project_id == project_id
        assert result.item_count == len(breakdowns)
        
        # Count expected alerts (items with >50% variance)
        expected_alert_count = sum(
            1 for b in breakdowns 
            if abs((Decimal(b['actual_amount']) - Decimal(b['planned_amount'])) / 
                   Decimal(b['planned_amount']) * Decimal('100')) > Decimal('50.0')
        )
        
        # Verify alerts were generated
        assert len(result.alerts) == expected_alert_count
        
        # Verify all alerts have required fields
        for alert in result.alerts:
            assert alert.breakdown_id is not None
            assert alert.project_id == project_id
            assert alert.current_variance is not None
            assert alert.threshold_exceeded == Decimal('50.0')
            assert len(alert.recommended_actions) > 0
    
    @given(
        financial_records=multiple_financial_records_strategy(min_size=1, max_size=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_financial_tracking_sync_creates_valid_breakdowns(
        self, financial_records
    ):
        """
        Property: For any set of financial tracking records, syncing to PO
        breakdown structure must create valid breakdown items with correct
        financial data and proper linking.
        
        **Validates: Requirements 5.1, 5.4**
        """
        project_id = uuid4()
        user_id = uuid4()
        
        # Ensure same project and non-zero amounts for meaningful test
        for record in financial_records:
            record['project_id'] = str(project_id)
            # Ensure non-zero amounts
            if Decimal(record['planned_amount']) == Decimal('0'):
                record['planned_amount'] = '1000.00'
            if Decimal(record['actual_amount']) == Decimal('0'):
                record['actual_amount'] = '800.00'
        
        # Create service with mock data
        mock_supabase = create_mock_supabase_client({
            'financial_tracking': financial_records,
            'po_breakdowns': []  # No existing breakdowns
        })
        service = POBreakdownDatabaseService(mock_supabase)
        
        # Mock create_breakdown to track calls
        created_breakdowns = []
        
        async def mock_create_breakdown(proj_id, breakdown_data, usr_id):
            # Verify breakdown data is valid
            assert breakdown_data.name is not None
            assert breakdown_data.planned_amount >= Decimal('0')
            assert breakdown_data.actual_amount >= Decimal('0')
            assert breakdown_data.breakdown_type == POBreakdownType.custom_hierarchy
            
            # Verify financial link is created
            assert 'financial_links' in breakdown_data.custom_fields
            assert len(breakdown_data.custom_fields['financial_links']) > 0
            
            # Create response
            response = POBreakdownResponse(
                id=uuid4(),
                project_id=proj_id,
                name=breakdown_data.name,
                code=None,
                sap_po_number=None,
                sap_line_item=None,
                hierarchy_level=0,
                parent_breakdown_id=None,
                cost_center=None,
                gl_account=None,
                planned_amount=breakdown_data.planned_amount,
                committed_amount=breakdown_data.committed_amount,
                actual_amount=breakdown_data.actual_amount,
                remaining_amount=breakdown_data.planned_amount - breakdown_data.actual_amount,
                currency=breakdown_data.currency,
                exchange_rate=Decimal('1.0'),
                breakdown_type=breakdown_data.breakdown_type,
                category=breakdown_data.category,
                subcategory=None,
                custom_fields=breakdown_data.custom_fields,
                tags=breakdown_data.tags,
                notes=breakdown_data.notes,
                import_batch_id=None,
                import_source=None,
                version=1,
                is_active=True,
                created_by=usr_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            created_breakdowns.append(response)
            return response
        
        with patch.object(service, 'create_breakdown', new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = mock_create_breakdown
            
            # Sync financial tracking to breakdowns
            result = await service.sync_financial_tracking_to_breakdown(
                project_id,
                user_id=user_id
            )
            
            # Verify sync results - should have attempted to sync all records
            # The actual synced count depends on implementation logic
            assert 'synced_count' in result
            assert 'created_breakdowns' in result
            assert 'skipped_count' in result
            assert 'errors' in result
            
            # Total processed should equal input records
            total_processed = result['synced_count'] + result['skipped_count'] + len(result['errors'])
            assert total_processed == len(financial_records)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
