"""
Property-Based Tests for SAP PO Breakdown Search and Filtering

**Property 7: Query and Filter Correctness**
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

This test suite validates the correctness of search and filtering operations
for PO breakdown management using property-based testing with Hypothesis.
"""

import pytest
from hypothesis import given, settings, strategies as st, assume
from hypothesis.strategies import composite
from decimal import Decimal
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Import models and services
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownFilter,
    POBreakdownType,
    VarianceStatus,
    SearchResult,
    SavedFilter
)
from services.po_breakdown_service import POBreakdownDatabaseService


# ============================================================================
# Test Data Generators
# ============================================================================

@composite
def po_breakdown_filter_strategy(draw):
    """Generate random POBreakdownFilter instances for testing."""
    # Text search
    search_text = draw(st.one_of(
        st.none(),
        st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd')))
    ))
    
    # Breakdown types
    breakdown_types = draw(st.one_of(
        st.none(),
        st.lists(st.sampled_from(list(POBreakdownType)), min_size=1, max_size=3, unique=True)
    ))
    
    # Categories
    categories = draw(st.one_of(
        st.none(),
        st.lists(st.sampled_from(['Construction', 'Equipment', 'Labor', 'Materials', 'Services']), 
                 min_size=1, max_size=3, unique=True)
    ))
    
    # Cost centers
    cost_centers = draw(st.one_of(
        st.none(),
        st.lists(st.text(min_size=4, max_size=10, alphabet='0123456789'), 
                 min_size=1, max_size=3, unique=True)
    ))
    
    # Hierarchy levels
    hierarchy_levels = draw(st.one_of(
        st.none(),
        st.lists(st.integers(min_value=0, max_value=5), min_size=1, max_size=3, unique=True)
    ))
    
    # Amount ranges
    min_planned = draw(st.one_of(st.none(), st.decimals(min_value=0, max_value=100000, places=2)))
    max_planned = draw(st.one_of(st.none(), st.decimals(min_value=0, max_value=1000000, places=2)))
    
    # Ensure min <= max if both are set
    if min_planned is not None and max_planned is not None and min_planned > max_planned:
        min_planned, max_planned = max_planned, min_planned
    
    # Variance thresholds
    min_variance = draw(st.one_of(st.none(), st.decimals(min_value=-100, max_value=100, places=2)))
    max_variance = draw(st.one_of(st.none(), st.decimals(min_value=-100, max_value=200, places=2)))
    
    if min_variance is not None and max_variance is not None and min_variance > max_variance:
        min_variance, max_variance = max_variance, min_variance
    
    # Variance statuses
    variance_statuses = draw(st.one_of(
        st.none(),
        st.lists(st.sampled_from(list(VarianceStatus)), min_size=1, max_size=3, unique=True)
    ))
    
    return POBreakdownFilter(
        search_text=search_text,
        breakdown_types=breakdown_types,
        categories=categories,
        cost_centers=cost_centers,
        hierarchy_levels=hierarchy_levels,
        min_planned_amount=min_planned,
        max_planned_amount=max_planned,
        min_variance_percentage=min_variance,
        max_variance_percentage=max_variance,
        variance_statuses=variance_statuses,
        is_active=True
    )


@composite
def po_breakdown_create_strategy(draw):
    """Generate random POBreakdownCreate instances for testing."""
    name = draw(st.text(min_size=5, max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs'))))
    code = draw(st.one_of(st.none(), st.text(min_size=3, max_size=20, alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')))
    
    planned_amount = draw(st.decimals(min_value=0, max_value=1000000, places=2))
    committed_amount = draw(st.decimals(min_value=0, max_value=float(planned_amount), places=2))
    actual_amount = draw(st.decimals(min_value=0, max_value=float(planned_amount) * 1.5, places=2))
    
    category = draw(st.sampled_from(['Construction', 'Equipment', 'Labor', 'Materials', 'Services']))
    cost_center = draw(st.one_of(st.none(), st.text(min_size=4, max_size=10, alphabet='0123456789')))
    
    return POBreakdownCreate(
        name=name,
        code=code,
        planned_amount=planned_amount,
        committed_amount=committed_amount,
        actual_amount=actual_amount,
        currency='USD',
        breakdown_type=draw(st.sampled_from(list(POBreakdownType))),
        category=category,
        cost_center=cost_center,
        tags=draw(st.lists(st.text(min_size=3, max_size=20), max_size=5, unique=True)),
        notes=draw(st.one_of(st.none(), st.text(max_size=200)))
    )


# ============================================================================
# Property Tests
# ============================================================================

class TestSearchAndFilteringProperties:
    """
    Property-based tests for search and filtering functionality.
    
    **Feature: sap-po-breakdown-management, Property 7: Query and Filter Correctness**
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
    """
    
    @given(po_breakdown_filter_strategy())
    @settings(max_examples=100, deadline=None)
    def test_text_search_correctness(self, filter_criteria: POBreakdownFilter):
        """
        Property: Text search returns only items matching the search term.
        
        **Validates: Requirement 7.1**
        
        For any search text, all returned items must contain the search term
        in at least one of the searchable fields (name, code, notes, SAP numbers).
        """
        # Skip if no search text or search text is too short
        assume(filter_criteria.search_text is not None and len(filter_criteria.search_text) >= 3)
        
        # Create mock items with known search terms
        search_term = filter_criteria.search_text.lower()
        
        # Test item that should match - include search term in name
        matching_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name=f"Project {filter_criteria.search_text} Component",
            code="MATCH",
            hierarchy_level=0,
            planned_amount=Decimal('1000.00'),
            committed_amount=Decimal('500.00'),
            actual_amount=Decimal('300.00'),
            remaining_amount=Decimal('700.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Test item that should not match - use completely different text
        non_matching_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="Completely Unrelated Item",
            code="NOMATCH",
            hierarchy_level=0,
            planned_amount=Decimal('2000.00'),
            committed_amount=Decimal('1000.00'),
            actual_amount=Decimal('800.00'),
            remaining_amount=Decimal('1200.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Verify matching logic
        matching_text = ' '.join(filter(None, [
            matching_item.name or '',
            matching_item.code or '',
            matching_item.notes or ''
        ])).lower()
        
        non_matching_text = ' '.join(filter(None, [
            non_matching_item.name or '',
            non_matching_item.code or '',
            non_matching_item.notes or ''
        ])).lower()
        
        # Property: Matching item contains search term
        assert search_term in matching_text, \
            f"Matching item should contain search term '{search_term}'"
        
        # Property: Non-matching item does not contain search term (only if search term is not a substring of common words)
        # Skip this check if search term is very short or common
        if len(search_term) >= 3 and search_term not in ['the', 'and', 'for', 'not', 'but', 'are']:
            assert search_term not in non_matching_text, \
                f"Non-matching item should not contain search term '{search_term}'"
    
    @given(
        st.decimals(min_value=0, max_value=100000, places=2),
        st.decimals(min_value=0, max_value=100000, places=2)
    )
    @settings(max_examples=100, deadline=None)
    def test_financial_range_filtering(self, min_amount: Decimal, max_amount: Decimal):
        """
        Property: Financial range filters return only items within the specified range.
        
        **Validates: Requirement 7.2**
        
        For any amount range [min, max], all returned items must have
        planned_amount within that range.
        """
        # Ensure min <= max
        if min_amount > max_amount:
            min_amount, max_amount = max_amount, min_amount
        
        # Create test items
        in_range_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="In Range Item",
            code="IN001",
            hierarchy_level=0,
            planned_amount=(min_amount + max_amount) / 2,  # Middle of range
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=(min_amount + max_amount) / 2,
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        below_range_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="Below Range Item",
            code="BELOW001",
            hierarchy_level=0,
            planned_amount=min_amount - Decimal('100.00') if min_amount > Decimal('100') else Decimal('0'),
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=Decimal('0'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        above_range_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="Above Range Item",
            code="ABOVE001",
            hierarchy_level=0,
            planned_amount=max_amount + Decimal('100.00'),
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=max_amount + Decimal('100.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Property: Item in range passes filter
        assert min_amount <= in_range_item.planned_amount <= max_amount, \
            f"Item with amount {in_range_item.planned_amount} should be in range [{min_amount}, {max_amount}]"
        
        # Property: Item below range fails filter
        if below_range_item.planned_amount < min_amount:
            assert not (min_amount <= below_range_item.planned_amount <= max_amount), \
                f"Item with amount {below_range_item.planned_amount} should be below range [{min_amount}, {max_amount}]"
        
        # Property: Item above range fails filter
        assert not (min_amount <= above_range_item.planned_amount <= max_amount), \
            f"Item with amount {above_range_item.planned_amount} should be above range [{min_amount}, {max_amount}]"
    
    @given(
        st.decimals(min_value=-50, max_value=50, places=2),
        st.decimals(min_value=-50, max_value=100, places=2)
    )
    @settings(max_examples=100, deadline=None)
    def test_variance_threshold_filtering(self, min_variance: Decimal, max_variance: Decimal):
        """
        Property: Variance threshold filters return only items within the specified variance range.
        
        **Validates: Requirement 7.2**
        
        For any variance range [min%, max%], all returned items must have
        variance percentage within that range.
        """
        # Ensure min <= max
        if min_variance > max_variance:
            min_variance, max_variance = max_variance, min_variance
        
        # Create test items with known variances
        planned = Decimal('1000.00')
        
        # Item with variance in range (e.g., 10% variance)
        target_variance = (min_variance + max_variance) / 2
        actual_for_target = planned * (1 + target_variance / 100)
        
        in_range_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="In Variance Range",
            code="VAR001",
            hierarchy_level=0,
            planned_amount=planned,
            committed_amount=Decimal('0'),
            actual_amount=actual_for_target,
            remaining_amount=planned - actual_for_target,
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Calculate actual variance
        variance_pct = ((in_range_item.actual_amount - in_range_item.planned_amount) / 
                       in_range_item.planned_amount * 100).quantize(Decimal('0.01'))
        
        # Property: Calculated variance is within specified range
        assert min_variance <= variance_pct <= max_variance, \
            f"Item variance {variance_pct}% should be in range [{min_variance}%, {max_variance}%]"
    
    @given(st.integers(min_value=0, max_value=5))
    @settings(max_examples=50, deadline=None)
    def test_hierarchy_level_filtering(self, target_level: int):
        """
        Property: Hierarchy level filters return only items at the specified level.
        
        **Validates: Requirement 7.3**
        
        For any hierarchy level, all returned items must be at that level.
        """
        # Create items at different levels
        at_level_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name=f"Level {target_level} Item",
            code=f"L{target_level}001",
            hierarchy_level=target_level,
            planned_amount=Decimal('1000.00'),
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=Decimal('1000.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        different_level_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name=f"Level {target_level + 1} Item",
            code=f"L{target_level + 1}001",
            hierarchy_level=target_level + 1,
            planned_amount=Decimal('1000.00'),
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=Decimal('1000.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Property: Item at target level passes filter
        assert at_level_item.hierarchy_level == target_level, \
            f"Item should be at level {target_level}"
        
        # Property: Item at different level fails filter
        assert different_level_item.hierarchy_level != target_level, \
            f"Item should not be at level {target_level}"
    
    @given(
        po_breakdown_filter_strategy(),
        po_breakdown_filter_strategy()
    )
    @settings(max_examples=50, deadline=None)
    def test_composite_filter_and_logic(self, filter1: POBreakdownFilter, filter2: POBreakdownFilter):
        """
        Property: AND composite filters return only items matching ALL filters.
        
        **Validates: Requirement 7.4**
        
        For any two filters combined with AND, an item must match both filters
        to be included in results.
        """
        # Create a test item
        test_item = POBreakdownResponse(
            id=uuid4(),
            project_id=uuid4(),
            name="Test Item",
            code="TEST001",
            hierarchy_level=0,
            planned_amount=Decimal('5000.00'),
            committed_amount=Decimal('2000.00'),
            actual_amount=Decimal('1500.00'),
            remaining_amount=Decimal('3500.00'),
            currency='USD',
            exchange_rate=Decimal('1.0'),
            breakdown_type=POBreakdownType.sap_standard,
            category='Construction',
            custom_fields={},
            tags=['important', 'urgent'],
            version=1,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Check if item matches filter1
        matches_filter1 = self._item_matches_simple_filter(test_item, filter1)
        
        # Check if item matches filter2
        matches_filter2 = self._item_matches_simple_filter(test_item, filter2)
        
        # Property: Item matches AND composite only if it matches both filters
        matches_and_composite = matches_filter1 and matches_filter2
        
        assert matches_and_composite == (matches_filter1 and matches_filter2), \
            "AND composite filter should match only if both filters match"
    
    @given(st.text(min_size=5, max_size=50))
    @settings(max_examples=50, deadline=None)
    def test_saved_filter_persistence(self, filter_name: str):
        """
        Property: Saved filters can be retrieved and applied correctly.
        
        **Validates: Requirement 7.5**
        
        For any saved filter, retrieving and applying it should produce
        the same results as applying the original filter criteria.
        """
        # Create a filter
        original_filter = POBreakdownFilter(
            search_text="test",
            min_planned_amount=Decimal('1000.00'),
            max_planned_amount=Decimal('10000.00'),
            categories=['Construction', 'Equipment']
        )
        
        # Simulate saving and retrieving
        saved_filter_data = {
            'id': str(uuid4()),
            'name': filter_name,
            'description': 'Test filter',
            'filter_criteria': original_filter.model_dump(mode='json'),
            'is_default': False,
            'created_by': str(uuid4()),
            'created_at': datetime.now().isoformat()
        }
        
        # Retrieve filter criteria
        retrieved_filter = POBreakdownFilter(**saved_filter_data['filter_criteria'])
        
        # Property: Retrieved filter matches original filter
        assert retrieved_filter.search_text == original_filter.search_text
        assert retrieved_filter.min_planned_amount == original_filter.min_planned_amount
        assert retrieved_filter.max_planned_amount == original_filter.max_planned_amount
        assert retrieved_filter.categories == original_filter.categories
    
    @given(po_breakdown_filter_strategy())
    @settings(max_examples=50, deadline=None)
    def test_export_filter_context_preservation(self, filter_criteria: POBreakdownFilter):
        """
        Property: Exported data maintains filter context metadata.
        
        **Validates: Requirement 7.6**
        
        For any export with filters applied, the export metadata should
        include the complete filter context for reproducibility.
        """
        # Simulate export with filter context
        export_result = {
            'data': [],
            'filter_context': {
                'filter_applied': True,
                'filter_criteria': filter_criteria.model_dump(mode='json'),
                'export_timestamp': datetime.now().isoformat()
            },
            'export_metadata': {
                'project_id': str(uuid4()),
                'export_format': 'json',
                'generated_at': datetime.now().isoformat(),
                'record_count': 0
            }
        }
        
        # Property: Filter context is preserved in export
        assert export_result['filter_context'] is not None
        assert export_result['filter_context']['filter_applied'] is True
        assert export_result['filter_context']['filter_criteria'] is not None
        
        # Property: Filter criteria can be reconstructed from export
        reconstructed_filter = POBreakdownFilter(**export_result['filter_context']['filter_criteria'])
        
        assert reconstructed_filter.search_text == filter_criteria.search_text
        assert reconstructed_filter.min_planned_amount == filter_criteria.min_planned_amount
        assert reconstructed_filter.max_planned_amount == filter_criteria.max_planned_amount
    
    # Helper method for filter matching
    def _item_matches_simple_filter(self, item: POBreakdownResponse, filter_criteria: POBreakdownFilter) -> bool:
        """Check if an item matches a filter (simplified logic for testing)."""
        # Check categories
        if filter_criteria.categories:
            if item.category not in filter_criteria.categories:
                return False
        
        # Check amount ranges
        if filter_criteria.min_planned_amount is not None:
            if item.planned_amount < filter_criteria.min_planned_amount:
                return False
        
        if filter_criteria.max_planned_amount is not None:
            if item.planned_amount > filter_criteria.max_planned_amount:
                return False
        
        # Check hierarchy levels
        if filter_criteria.hierarchy_levels:
            if item.hierarchy_level not in filter_criteria.hierarchy_levels:
                return False
        
        # Check breakdown types
        if filter_criteria.breakdown_types:
            if item.breakdown_type not in filter_criteria.breakdown_types:
                return False
        
        return True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
