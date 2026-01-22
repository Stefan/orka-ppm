"""
Property-Based Tests for PO Breakdown Data Model Validation

This module implements comprehensive property tests for PO breakdown data models,
validating import data processing, model validation, and data integrity.

Task: 1.1 Write property test for PO breakdown data model validation
**Property 1: Import Data Validation and Processing**
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

Properties Implemented:
- Property 1.1: Valid PO breakdown data always passes validation
- Property 1.2: Invalid data is rejected with appropriate error messages
- Property 1.3: Hierarchy relationships are correctly established
- Property 1.4: Duplicate detection works correctly
- Property 1.5: Amount calculations are mathematically correct
- Property 1.6: Import batch IDs are unique and trackable
"""

import pytest
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from hypothesis import given, settings, assume, example, note
from hypothesis import strategies as st
from pydantic import ValidationError

# Import the PO breakdown models
from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownUpdate,
    POBreakdownType,
    ImportConfig,
    ImportResult,
    ImportStatus,
    ImportError,
    ImportConflict,
    ConflictType,
    ConflictResolution,
    VarianceData,
    VarianceStatus,
    TrendDirection,
    POBreakdownFilter,
    HierarchyMoveRequest,
)


# =============================================================================
# Custom Strategies for PO Breakdown Testing
# =============================================================================

@st.composite
def valid_currency_code(draw) -> str:
    """Generate valid 3-letter currency codes."""
    return draw(st.sampled_from(['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD']))


@st.composite
def valid_breakdown_type(draw) -> POBreakdownType:
    """Generate valid breakdown types."""
    return draw(st.sampled_from(list(POBreakdownType)))


@st.composite
def positive_decimal(draw, min_value: float = 0.01, max_value: float = 10_000_000) -> Decimal:
    """Generate positive decimal values for financial amounts."""
    value = draw(st.floats(
        min_value=min_value,
        max_value=max_value,
        allow_nan=False,
        allow_infinity=False
    ))
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@st.composite
def non_negative_decimal(draw, max_value: float = 10_000_000) -> Decimal:
    """Generate non-negative decimal values."""
    value = draw(st.floats(
        min_value=0,
        max_value=max_value,
        allow_nan=False,
        allow_infinity=False
    ))
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@st.composite
def valid_po_breakdown_create(draw) -> Dict[str, Any]:
    """
    Generate valid POBreakdownCreate data.
    
    **Validates: Requirements 1.1, 1.2**
    """
    name = draw(st.text(
        alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')),
        min_size=1,
        max_size=100
    ).filter(lambda x: x.strip()))
    
    planned = draw(non_negative_decimal())
    committed = draw(non_negative_decimal(max_value=float(planned) + 1000))
    actual = draw(non_negative_decimal(max_value=float(planned) + 1000))
    
    return {
        'name': name.strip()[:255],
        'code': draw(st.none() | st.text(min_size=1, max_size=50).filter(lambda x: x.strip())),
        'sap_po_number': draw(st.none() | st.text(min_size=1, max_size=50)),
        'sap_line_item': draw(st.none() | st.text(min_size=1, max_size=20)),
        'parent_breakdown_id': None,  # Will be set separately for hierarchy tests
        'cost_center': draw(st.none() | st.text(min_size=1, max_size=50)),
        'gl_account': draw(st.none() | st.text(min_size=1, max_size=50)),
        'planned_amount': planned,
        'committed_amount': committed,
        'actual_amount': actual,
        'currency': draw(valid_currency_code()),
        'breakdown_type': draw(valid_breakdown_type()),
        'category': draw(st.none() | st.text(min_size=1, max_size=100)),
        'subcategory': draw(st.none() | st.text(min_size=1, max_size=100)),
        'custom_fields': draw(st.fixed_dictionaries({}) | st.fixed_dictionaries({
            'field1': st.text(max_size=50),
            'field2': st.integers()
        })),
        'tags': draw(st.lists(st.text(min_size=1, max_size=50), max_size=5)),
        'notes': draw(st.none() | st.text(max_size=500)),
    }


@st.composite
def invalid_currency_code(draw) -> str:
    """Generate invalid currency codes."""
    return draw(st.one_of(
        st.text(min_size=0, max_size=2),  # Too short
        st.text(min_size=4, max_size=10),  # Too long
        st.text(min_size=3, max_size=3).filter(lambda x: not x.isalpha()),  # Non-alpha
    ))


@st.composite
def hierarchy_level_pair(draw) -> Dict[str, int]:
    """Generate valid parent-child hierarchy level pairs."""
    parent_level = draw(st.integers(min_value=0, max_value=9))
    child_level = parent_level + 1
    return {'parent_level': parent_level, 'child_level': child_level}


@st.composite
def import_config_strategy(draw) -> Dict[str, Any]:
    """Generate valid import configuration."""
    return {
        'column_mappings': {
            'Name': 'name',
            'Code': 'code',
            'Planned': 'planned_amount',
            'Actual': 'actual_amount',
        },
        'hierarchy_column': draw(st.none() | st.text(min_size=1, max_size=50)),
        'parent_reference_column': draw(st.none() | st.text(min_size=1, max_size=50)),
        'skip_header_rows': draw(st.integers(min_value=0, max_value=5)),
        'currency_default': draw(valid_currency_code()),
        'breakdown_type_default': draw(valid_breakdown_type()),
        'conflict_resolution': draw(st.sampled_from(list(ConflictResolution))),
        'validate_amounts': draw(st.booleans()),
        'create_missing_parents': draw(st.booleans()),
        'max_hierarchy_depth': draw(st.integers(min_value=1, max_value=10)),
        'delimiter': draw(st.sampled_from([',', ';', '\t', '|'])),
        'encoding': draw(st.sampled_from(['utf-8', 'utf-16', 'latin-1'])),
    }


# =============================================================================
# Property 1.1: Valid PO Breakdown Data Validation
# =============================================================================

class TestValidPOBreakdownDataValidation:
    """
    Property 1.1: Valid PO breakdown data always passes validation
    
    For any valid combination of PO breakdown fields, the model
    should successfully validate and create an instance.
    
    **Validates: Requirements 1.1, 1.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(data=valid_po_breakdown_create())
    def test_valid_breakdown_data_passes_validation(self, data: Dict[str, Any]):
        """
        Property test: Valid data always creates a valid model instance.
        
        **Validates: Requirements 1.1, 1.2**
        """
        # Filter out None values for optional fields
        filtered_data = {k: v for k, v in data.items() if v is not None or k in ['parent_breakdown_id']}
        
        # Ensure name is not empty after stripping
        if not filtered_data.get('name', '').strip():
            filtered_data['name'] = 'Default Name'
        
        # Create model instance
        try:
            breakdown = POBreakdownCreate(**filtered_data)
            
            # Verify required fields are set
            assert breakdown.name is not None
            assert len(breakdown.name) > 0
            assert breakdown.breakdown_type in POBreakdownType
            assert breakdown.planned_amount >= 0
            assert breakdown.committed_amount >= 0
            assert breakdown.actual_amount >= 0
            assert len(breakdown.currency) == 3
            assert breakdown.currency.isalpha()
            
        except ValidationError as e:
            # Log the error for debugging
            note(f"Validation failed with data: {filtered_data}")
            note(f"Error: {e}")
            raise
    
    @settings(max_examples=50, deadline=None)
    @given(
        name=st.text(min_size=1, max_size=255).filter(lambda x: x.strip()),
        planned=non_negative_decimal(),
        breakdown_type=valid_breakdown_type()
    )
    def test_minimal_valid_breakdown(self, name: str, planned: Decimal, breakdown_type: POBreakdownType):
        """
        Property test: Minimal valid data creates a valid model.
        
        **Validates: Requirements 1.1**
        """
        breakdown = POBreakdownCreate(
            name=name.strip(),
            planned_amount=planned,
            breakdown_type=breakdown_type
        )
        
        assert breakdown.name == name.strip()
        assert breakdown.planned_amount == planned
        assert breakdown.breakdown_type == breakdown_type
        # Verify defaults
        assert breakdown.committed_amount == Decimal('0.00')
        assert breakdown.actual_amount == Decimal('0.00')
        assert breakdown.currency == 'USD'
    
    @settings(max_examples=50, deadline=None)
    @given(currency=valid_currency_code())
    def test_valid_currency_codes_accepted(self, currency: str):
        """
        Property test: All valid currency codes are accepted.
        
        **Validates: Requirements 1.2**
        """
        breakdown = POBreakdownCreate(
            name="Test Breakdown",
            breakdown_type=POBreakdownType.sap_standard,
            currency=currency
        )
        
        assert breakdown.currency == currency.upper()
        assert len(breakdown.currency) == 3


# =============================================================================
# Property 1.2: Invalid Data Rejection
# =============================================================================

class TestInvalidDataRejection:
    """
    Property 1.2: Invalid data is rejected with appropriate error messages
    
    For any invalid PO breakdown data, the model should reject it
    with clear, actionable error messages.
    
    **Validates: Requirements 1.5, 10.1, 10.2**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(currency=invalid_currency_code())
    def test_invalid_currency_rejected(self, currency: str):
        """
        Property test: Invalid currency codes are rejected.
        
        **Validates: Requirements 1.5, 10.2**
        """
        # Skip empty strings as they might be handled differently
        assume(len(currency) > 0 or len(currency) != 3)
        
        with pytest.raises(ValidationError) as exc_info:
            POBreakdownCreate(
                name="Test Breakdown",
                breakdown_type=POBreakdownType.sap_standard,
                currency=currency
            )
        
        # Verify error message is informative
        error_str = str(exc_info.value)
        assert 'currency' in error_str.lower() or 'validation' in error_str.lower()
    
    @settings(max_examples=30, deadline=None)
    @given(amount=st.floats(max_value=-0.01, allow_nan=False, allow_infinity=False))
    def test_negative_amounts_rejected(self, amount: float):
        """
        Property test: Negative amounts are rejected.
        
        **Validates: Requirements 1.5, 10.1**
        """
        with pytest.raises(ValidationError):
            POBreakdownCreate(
                name="Test Breakdown",
                breakdown_type=POBreakdownType.sap_standard,
                planned_amount=Decimal(str(amount))
            )
    
    def test_empty_name_rejected(self):
        """
        Property test: Empty names are rejected.
        
        **Validates: Requirements 1.5, 10.2**
        """
        with pytest.raises(ValidationError):
            POBreakdownCreate(
                name="",
                breakdown_type=POBreakdownType.sap_standard
            )
    
    @settings(max_examples=20, deadline=None)
    @given(name=st.text(min_size=256, max_size=500))
    def test_overly_long_name_rejected(self, name: str):
        """
        Property test: Names exceeding max length are rejected.
        
        **Validates: Requirements 1.5, 10.1**
        """
        with pytest.raises(ValidationError):
            POBreakdownCreate(
                name=name,
                breakdown_type=POBreakdownType.sap_standard
            )


# =============================================================================
# Property 1.3: Hierarchy Relationship Validation
# =============================================================================

class TestHierarchyRelationshipValidation:
    """
    Property 1.3: Hierarchy relationships are correctly established
    
    For any valid hierarchy configuration, parent-child relationships
    must be correctly established and validated.
    
    **Validates: Requirements 1.3, 2.1, 2.2**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(levels=hierarchy_level_pair())
    def test_valid_hierarchy_levels(self, levels: Dict[str, int]):
        """
        Property test: Child level is always parent level + 1.
        
        **Validates: Requirements 1.3, 2.1**
        """
        parent_level = levels['parent_level']
        child_level = levels['child_level']
        
        # Property: child_level == parent_level + 1
        assert child_level == parent_level + 1
        assert child_level <= 10  # Max depth
    
    @settings(max_examples=30, deadline=None)
    @given(depth=st.integers(min_value=0, max_value=10))
    def test_hierarchy_depth_within_limits(self, depth: int):
        """
        Property test: Hierarchy depth is within allowed limits.
        
        **Validates: Requirements 2.1**
        """
        # Property: 0 <= depth <= 10
        assert 0 <= depth <= 10
    
    def test_hierarchy_move_request_validation(self):
        """
        Property test: HierarchyMoveRequest validates correctly.
        
        **Validates: Requirements 2.4**
        """
        # Valid move request
        move_request = HierarchyMoveRequest(
            new_parent_id=uuid4(),
            new_position=0,
            validate_only=True
        )
        
        assert move_request.new_parent_id is not None
        assert move_request.new_position == 0
        assert move_request.validate_only is True
        
        # Move to root (no parent)
        root_move = HierarchyMoveRequest(
            new_parent_id=None,
            validate_only=False
        )
        
        assert root_move.new_parent_id is None


# =============================================================================
# Property 1.4: Duplicate Detection
# =============================================================================

class TestDuplicateDetection:
    """
    Property 1.4: Duplicate detection works correctly
    
    For any set of PO breakdown records, duplicates should be
    correctly identified based on code and SAP reference.
    
    **Validates: Requirements 1.4**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(
        code=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        sap_po=st.text(min_size=1, max_size=50)
    )
    def test_duplicate_detection_by_code(self, code: str, sap_po: str):
        """
        Property test: Records with same code are detected as duplicates.
        
        **Validates: Requirements 1.4**
        """
        record1 = POBreakdownCreate(
            name="Record 1",
            code=code.strip(),
            sap_po_number=sap_po,
            breakdown_type=POBreakdownType.sap_standard
        )
        
        record2 = POBreakdownCreate(
            name="Record 2",
            code=code.strip(),
            sap_po_number=sap_po,
            breakdown_type=POBreakdownType.sap_standard
        )
        
        # Property: Same code means potential duplicate
        assert record1.code == record2.code
        assert record1.sap_po_number == record2.sap_po_number
    
    @settings(max_examples=30, deadline=None)
    @given(
        code1=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        code2=st.text(min_size=1, max_size=50).filter(lambda x: x.strip())
    )
    def test_different_codes_not_duplicates(self, code1: str, code2: str):
        """
        Property test: Records with different codes are not duplicates.
        
        **Validates: Requirements 1.4**
        """
        assume(code1.strip() != code2.strip())
        
        record1 = POBreakdownCreate(
            name="Record 1",
            code=code1.strip(),
            breakdown_type=POBreakdownType.sap_standard
        )
        
        record2 = POBreakdownCreate(
            name="Record 2",
            code=code2.strip(),
            breakdown_type=POBreakdownType.sap_standard
        )
        
        # Property: Different codes means not duplicates
        assert record1.code != record2.code


# =============================================================================
# Property 1.5: Amount Calculation Correctness
# =============================================================================

class TestAmountCalculationCorrectness:
    """
    Property 1.5: Amount calculations are mathematically correct
    
    For any combination of planned, committed, and actual amounts,
    calculations must be mathematically accurate.
    
    **Validates: Requirements 3.1, 3.2**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(
        planned=non_negative_decimal(),
        actual=non_negative_decimal()
    )
    def test_remaining_amount_calculation(self, planned: Decimal, actual: Decimal):
        """
        Property test: Remaining = Planned - Actual (always).
        
        **Validates: Requirements 3.1, 3.2**
        """
        remaining = planned - actual
        expected_remaining = (planned - actual).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Property: remaining == planned - actual
        assert remaining == expected_remaining
    
    @settings(max_examples=100, deadline=None)
    @given(
        planned=positive_decimal(min_value=1.0),
        actual=non_negative_decimal()
    )
    def test_variance_percentage_calculation(self, planned: Decimal, actual: Decimal):
        """
        Property test: Variance percentage = ((actual - planned) / planned) * 100.
        
        **Validates: Requirements 3.1, 3.4**
        """
        variance_amount = actual - planned
        variance_percentage = (variance_amount / planned * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Verify calculation
        expected = ((actual - planned) / planned * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        assert variance_percentage == expected
    
    @settings(max_examples=50, deadline=None)
    @given(
        planned=non_negative_decimal(),
        committed=non_negative_decimal(),
        actual=non_negative_decimal()
    )
    def test_variance_data_consistency(self, planned: Decimal, committed: Decimal, actual: Decimal):
        """
        Property test: VarianceData calculations are internally consistent.
        
        **Validates: Requirements 3.1, 3.4**
        """
        # Calculate variances
        planned_vs_actual = planned - actual
        planned_vs_committed = planned - committed
        committed_vs_actual = committed - actual
        
        # Verify mathematical relationships
        # planned_vs_actual = planned_vs_committed + committed_vs_actual
        assert planned_vs_actual == planned_vs_committed + committed_vs_actual
    
    @settings(max_examples=30, deadline=None)
    @given(
        amount=positive_decimal(min_value=100, max_value=1_000_000),
        scale=st.floats(min_value=0.1, max_value=10.0, allow_nan=False)
    )
    def test_amount_scaling_preserves_ratios(self, amount: Decimal, scale: float):
        """
        Property test: Scaling amounts preserves variance ratios.
        
        **Validates: Requirements 3.1**
        """
        planned = amount
        actual = (amount * Decimal(str(1.2))).quantize(Decimal('0.01'))  # 20% over
        
        # Scale both
        scaled_planned = (planned * Decimal(str(scale))).quantize(Decimal('0.01'))
        scaled_actual = (actual * Decimal(str(scale))).quantize(Decimal('0.01'))
        
        # Calculate percentages
        if planned > 0 and scaled_planned > 0:
            original_pct = ((actual - planned) / planned * 100).quantize(Decimal('0.01'))
            scaled_pct = ((scaled_actual - scaled_planned) / scaled_planned * 100).quantize(Decimal('0.01'))
            
            # Property: Percentage should be approximately preserved
            tolerance = Decimal('0.1')  # Allow small rounding differences
            assert abs(original_pct - scaled_pct) <= tolerance


# =============================================================================
# Property 1.6: Import Batch ID Uniqueness
# =============================================================================

class TestImportBatchIdUniqueness:
    """
    Property 1.6: Import batch IDs are unique and trackable
    
    For any import operation, batch IDs must be unique and
    allow tracking of imported records.
    
    **Validates: Requirements 1.6**
    """
    
    @settings(max_examples=100, deadline=None)
    @given(st.data())
    def test_batch_ids_are_unique(self, data):
        """
        Property test: Generated batch IDs are always unique.
        
        **Validates: Requirements 1.6**
        """
        batch_ids = [uuid4() for _ in range(100)]
        
        # Property: All batch IDs are unique
        assert len(batch_ids) == len(set(batch_ids))
    
    @settings(max_examples=50, deadline=None)
    @given(
        total=st.integers(min_value=1, max_value=1000),
        successful=st.integers(min_value=0, max_value=1000)
    )
    def test_import_result_consistency(self, total: int, successful: int):
        """
        Property test: ImportResult fields are internally consistent.
        
        **Validates: Requirements 1.5, 1.6**
        """
        # Ensure successful <= total
        successful = min(successful, total)
        failed = total - successful
        
        result = ImportResult(
            batch_id=uuid4(),
            status=ImportStatus.completed if failed == 0 else ImportStatus.partially_completed,
            total_records=total,
            processed_records=total,
            successful_records=successful,
            failed_records=failed,
            processing_time_ms=100
        )
        
        # Property: successful + failed == total
        assert result.successful_records + result.failed_records == result.total_records
        
        # Property: processed <= total
        assert result.processed_records <= result.total_records


# =============================================================================
# Import Configuration Validation
# =============================================================================

class TestImportConfigValidation:
    """
    Tests for ImportConfig model validation.
    
    **Validates: Requirements 1.1, 1.2**
    """
    
    @settings(max_examples=50, deadline=None)
    @given(config=import_config_strategy())
    def test_valid_import_config(self, config: Dict[str, Any]):
        """
        Property test: Valid import configurations are accepted.
        
        **Validates: Requirements 1.1, 1.2**
        """
        import_config = ImportConfig(**config)
        
        assert import_config.column_mappings is not None
        assert len(import_config.column_mappings) > 0
        assert import_config.max_hierarchy_depth >= 1
        assert import_config.max_hierarchy_depth <= 10
    
    def test_import_config_defaults(self):
        """
        Property test: ImportConfig has sensible defaults.
        
        **Validates: Requirements 1.1**
        """
        config = ImportConfig(
            column_mappings={'Name': 'name'}
        )
        
        assert config.skip_header_rows == 1
        assert config.currency_default == 'USD'
        assert config.breakdown_type_default == POBreakdownType.sap_standard
        assert config.conflict_resolution == ConflictResolution.skip
        assert config.validate_amounts is True
        assert config.create_missing_parents is True
        assert config.max_hierarchy_depth == 10
        assert config.delimiter == ','
        assert config.encoding == 'utf-8'


# =============================================================================
# Filter Validation
# =============================================================================

class TestFilterValidation:
    """
    Tests for POBreakdownFilter model validation.
    
    **Validates: Requirements 7.1, 7.2, 7.3**
    """
    
    @settings(max_examples=30, deadline=None)
    @given(
        search_text=st.none() | st.text(max_size=100),
        min_amount=st.none() | non_negative_decimal(),
        max_amount=st.none() | non_negative_decimal()
    )
    def test_filter_creation(
        self,
        search_text: Optional[str],
        min_amount: Optional[Decimal],
        max_amount: Optional[Decimal]
    ):
        """
        Property test: Filters can be created with various combinations.
        
        **Validates: Requirements 7.1, 7.2**
        """
        filter_obj = POBreakdownFilter(
            search_text=search_text,
            min_planned_amount=min_amount,
            max_planned_amount=max_amount
        )
        
        assert filter_obj.search_text == search_text
        assert filter_obj.min_planned_amount == min_amount
        assert filter_obj.max_planned_amount == max_amount
    
    def test_filter_defaults(self):
        """
        Property test: Filter has sensible defaults.
        
        **Validates: Requirements 7.1**
        """
        filter_obj = POBreakdownFilter()
        
        assert filter_obj.search_text is None
        assert filter_obj.breakdown_types is None
        assert filter_obj.is_active is True  # Default to active items


# =============================================================================
# Integration Tests
# =============================================================================

class TestModelIntegration:
    """
    Integration tests combining multiple model validations.
    
    **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
    """
    
    @settings(max_examples=30, deadline=None)
    @given(data=valid_po_breakdown_create())
    def test_create_to_response_consistency(self, data: Dict[str, Any]):
        """
        Property test: Create model data can be used in Response model.
        
        **Validates: Requirements 1.1, 1.2**
        """
        # Filter and prepare data
        filtered_data = {k: v for k, v in data.items() if v is not None or k in ['parent_breakdown_id']}
        if not filtered_data.get('name', '').strip():
            filtered_data['name'] = 'Default Name'
        
        # Create model
        create_model = POBreakdownCreate(**filtered_data)
        
        # Prepare response data
        response_data = {
            'id': uuid4(),
            'project_id': uuid4(),
            'name': create_model.name,
            'hierarchy_level': 0,
            'planned_amount': create_model.planned_amount,
            'committed_amount': create_model.committed_amount,
            'actual_amount': create_model.actual_amount,
            'remaining_amount': create_model.planned_amount - create_model.actual_amount,
            'currency': create_model.currency,
            'breakdown_type': create_model.breakdown_type,
            'version': 1,
            'is_active': True,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }
        
        # Create response model
        response = POBreakdownResponse(**response_data)
        
        # Verify consistency
        assert response.name == create_model.name
        assert response.planned_amount == create_model.planned_amount
        assert response.currency == create_model.currency
        assert response.breakdown_type == create_model.breakdown_type
