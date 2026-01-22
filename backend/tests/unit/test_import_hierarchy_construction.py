"""
Unit Tests for Import Hierarchy Construction

Tests the automatic hierarchy construction from SAP structure codes,
including parent-child relationship building, missing parent creation,
and duplicate detection.

**Validates: Requirements 1.3, 1.4, 10.2**
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from services.import_processing_service import ImportProcessingService
from models.po_breakdown import (
    ImportConfig,
    ImportError,
    ImportWarning,
    ImportConflict,
    ConflictType,
    ConflictResolution,
    POBreakdownType,
    POBreakdownCreate,
    POBreakdownResponse,
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.update = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.execute = Mock(return_value=Mock(data=[]))
    return mock


@pytest.fixture
def import_service(mock_supabase):
    """Create an ImportProcessingService instance with mocked dependencies."""
    service = ImportProcessingService(mock_supabase)
    return service


@pytest.fixture
def basic_import_config():
    """Create a basic import configuration."""
    return ImportConfig(
        column_mappings={
            'name': 'Name',
            'code': 'Code',
            'planned_amount': 'Planned Amount'
        },
        hierarchy_column='Structure Code',
        parent_reference_column=None,
        skip_header_rows=1,
        currency_default='USD',
        breakdown_type_default=POBreakdownType.sap_standard,
        conflict_resolution=ConflictResolution.skip,
        validate_amounts=True,
        create_missing_parents=True,
        max_hierarchy_depth=10
    )


# =============================================================================
# SAP Structure Code Parsing Tests
# =============================================================================

def test_parse_sap_structure_code_root_level(import_service):
    """Test parsing root level structure code (e.g., '1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1',
        row_number=1,
        errors=errors
    )
    
    assert level == 0
    assert parent is None
    assert len(errors) == 0


def test_parse_sap_structure_code_level_1(import_service):
    """Test parsing level 1 structure code (e.g., '1.1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1.1',
        row_number=1,
        errors=errors
    )
    
    assert level == 1
    assert parent == '1'
    assert len(errors) == 0


def test_parse_sap_structure_code_level_2(import_service):
    """Test parsing level 2 structure code (e.g., '1.1.1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1.1.1',
        row_number=1,
        errors=errors
    )
    
    assert level == 2
    assert parent == '1.1'
    assert len(errors) == 0


def test_parse_sap_structure_code_deep_hierarchy(import_service):
    """Test parsing deep hierarchy structure code (e.g., '1.2.3.4.5')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1.2.3.4.5',
        row_number=1,
        errors=errors
    )
    
    assert level == 4
    assert parent == '1.2.3.4'
    assert len(errors) == 0


def test_parse_sap_structure_code_with_dashes(import_service):
    """Test parsing structure code with dashes (e.g., '1-1-1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1-1-1',
        row_number=1,
        errors=errors
    )
    
    assert level == 2
    assert parent == '1.1'  # Normalized to dots
    assert len(errors) == 0


def test_parse_sap_structure_code_with_slashes(import_service):
    """Test parsing structure code with slashes (e.g., '1/1/1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1/1/1',
        row_number=1,
        errors=errors
    )
    
    assert level == 2
    assert parent == '1.1'  # Normalized to dots
    assert len(errors) == 0


def test_parse_sap_structure_code_with_spaces(import_service):
    """Test parsing structure code with spaces (e.g., '1 . 1 . 1')."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='1 . 1 . 1',
        row_number=1,
        errors=errors
    )
    
    assert level == 2
    assert parent == '1.1'
    assert len(errors) == 0


def test_parse_sap_structure_code_empty(import_service):
    """Test parsing empty structure code."""
    errors = []
    
    level, parent = import_service._parse_sap_structure_code(
        structure_code='',
        row_number=1,
        errors=errors
    )
    
    assert level == 0
    assert parent is None
    assert len(errors) == 0


# =============================================================================
# Hierarchy Information Parsing Tests
# =============================================================================

def test_parse_hierarchy_information_simple(import_service, basic_import_config):
    """Test parsing hierarchy information from simple data."""
    parsed_rows = [
        {'Structure Code': '1', 'Name': 'Root', 'Code': 'R1'},
        {'Structure Code': '1.1', 'Name': 'Child 1', 'Code': 'C1'},
        {'Structure Code': '1.2', 'Name': 'Child 2', 'Code': 'C2'},
    ]
    
    errors = []
    warnings = []
    
    hierarchy_info = import_service._parse_hierarchy_information(
        parsed_rows=parsed_rows,
        config=basic_import_config,
        errors=errors,
        warnings=warnings
    )
    
    assert len(hierarchy_info) == 3
    assert hierarchy_info[0]['hierarchy_level'] == 0
    assert hierarchy_info[0]['structure_code'] == '1'
    assert hierarchy_info[0]['parent_code'] is None
    
    assert hierarchy_info[1]['hierarchy_level'] == 1
    assert hierarchy_info[1]['structure_code'] == '1.1'
    assert hierarchy_info[1]['parent_code'] == '1'
    
    assert hierarchy_info[2]['hierarchy_level'] == 1
    assert hierarchy_info[2]['structure_code'] == '1.2'
    assert hierarchy_info[2]['parent_code'] == '1'


def test_parse_hierarchy_information_multi_level(import_service, basic_import_config):
    """Test parsing multi-level hierarchy."""
    parsed_rows = [
        {'Structure Code': '1', 'Name': 'Root'},
        {'Structure Code': '1.1', 'Name': 'Level 1'},
        {'Structure Code': '1.1.1', 'Name': 'Level 2'},
        {'Structure Code': '1.1.1.1', 'Name': 'Level 3'},
    ]
    
    errors = []
    warnings = []
    
    hierarchy_info = import_service._parse_hierarchy_information(
        parsed_rows=parsed_rows,
        config=basic_import_config,
        errors=errors,
        warnings=warnings
    )
    
    assert len(hierarchy_info) == 4
    assert hierarchy_info[0]['hierarchy_level'] == 0
    assert hierarchy_info[1]['hierarchy_level'] == 1
    assert hierarchy_info[2]['hierarchy_level'] == 2
    assert hierarchy_info[3]['hierarchy_level'] == 3


def test_parse_hierarchy_information_exceeds_max_depth(import_service, basic_import_config):
    """Test that exceeding max depth generates errors."""
    # Create a structure code that exceeds max depth
    deep_code = '.'.join(str(i) for i in range(1, 13))  # 12 levels
    
    parsed_rows = [
        {'Structure Code': deep_code, 'Name': 'Too Deep'},
    ]
    
    errors = []
    warnings = []
    
    hierarchy_info = import_service._parse_hierarchy_information(
        parsed_rows=parsed_rows,
        config=basic_import_config,
        errors=errors,
        warnings=warnings
    )
    
    assert len(hierarchy_info) == 0  # Item should be excluded
    assert len(errors) == 1
    assert errors[0].error_type == 'depth_exceeded'


def test_parse_hierarchy_information_with_parent_reference(import_service):
    """Test parsing with explicit parent reference column."""
    config = ImportConfig(
        column_mappings={'name': 'Name', 'code': 'Code'},
        hierarchy_column=None,
        parent_reference_column='Parent Code',
        skip_header_rows=1,
        create_missing_parents=True
    )
    
    parsed_rows = [
        {'Name': 'Root', 'Code': 'R1', 'Parent Code': ''},
        {'Name': 'Child 1', 'Code': 'C1', 'Parent Code': 'R1'},
        {'Name': 'Child 2', 'Code': 'C2', 'Parent Code': 'R1'},
    ]
    
    errors = []
    warnings = []
    
    hierarchy_info = import_service._parse_hierarchy_information(
        parsed_rows=parsed_rows,
        config=config,
        errors=errors,
        warnings=warnings
    )
    
    assert len(hierarchy_info) == 3
    # When parent_code is empty string after strip, it becomes empty but hierarchy_level stays 0
    # because the condition `if parent_code:` evaluates to False
    assert hierarchy_info[0]['hierarchy_level'] == 0
    assert hierarchy_info[1]['hierarchy_level'] == 1  # Has parent, so level 1
    assert hierarchy_info[2]['hierarchy_level'] == 1  # Has parent, so level 1


# =============================================================================
# Duplicate Detection Tests
# =============================================================================

def test_check_batch_duplicate_no_duplicates(import_service):
    """Test duplicate check with no duplicates."""
    breakdown_data = POBreakdownCreate(
        name='Test Item',
        code='T1',
        breakdown_type=POBreakdownType.sap_standard
    )
    
    hierarchy_map = {
        'S1': uuid4(),
        'S2': uuid4()
    }
    
    result = import_service._check_batch_duplicate(
        breakdown_data=breakdown_data,
        hierarchy_map=hierarchy_map,
        structure_code='S3',
        row_number=1
    )
    
    assert result is None


def test_check_batch_duplicate_structure_code(import_service):
    """Test duplicate detection for structure code."""
    breakdown_data = POBreakdownCreate(
        name='Test Item',
        code='T1',
        breakdown_type=POBreakdownType.sap_standard
    )
    
    hierarchy_map = {
        'S1': uuid4(),
        'S2': uuid4()
    }
    
    result = import_service._check_batch_duplicate(
        breakdown_data=breakdown_data,
        hierarchy_map=hierarchy_map,
        structure_code='S1',  # Duplicate
        row_number=1
    )
    
    assert result is not None
    assert 'Duplicate structure code' in result


def test_check_batch_duplicate_code(import_service):
    """Test duplicate detection for item code."""
    breakdown_data = POBreakdownCreate(
        name='Test Item',
        code='T1',
        breakdown_type=POBreakdownType.sap_standard
    )
    
    hierarchy_map = {
        'T1': uuid4(),  # Same as breakdown_data.code
    }
    
    result = import_service._check_batch_duplicate(
        breakdown_data=breakdown_data,
        hierarchy_map=hierarchy_map,
        structure_code='S3',
        row_number=1
    )
    
    assert result is not None
    assert 'Duplicate code' in result


@pytest.mark.asyncio
async def test_detect_import_duplicates_within_batch(import_service, basic_import_config):
    """Test detecting duplicates within the import batch."""
    parsed_rows = [
        {'code': 'C1', 'name': 'Item 1'},
        {'code': 'C2', 'name': 'Item 2'},
        {'code': 'C1', 'name': 'Item 3'},  # Duplicate code
    ]
    
    project_id = uuid4()
    
    conflicts = await import_service.detect_import_duplicates(
        parsed_rows=parsed_rows,
        project_id=project_id,
        config=basic_import_config
    )
    
    assert len(conflicts) == 1
    assert conflicts[0].conflict_type == ConflictType.duplicate_code
    # Row numbers start at skip_header_rows + 1, so row 3 becomes row 4
    assert conflicts[0].row_number == 4


@pytest.mark.asyncio
async def test_detect_import_duplicates_sap_reference(import_service, basic_import_config):
    """Test detecting duplicate SAP references."""
    parsed_rows = [
        {'sap_po_number': 'PO001', 'sap_line_item': 'L1', 'name': 'Item 1'},
        {'sap_po_number': 'PO002', 'sap_line_item': 'L1', 'name': 'Item 2'},
        {'sap_po_number': 'PO001', 'sap_line_item': 'L1', 'name': 'Item 3'},  # Duplicate
    ]
    
    project_id = uuid4()
    
    conflicts = await import_service.detect_import_duplicates(
        parsed_rows=parsed_rows,
        project_id=project_id,
        config=basic_import_config
    )
    
    assert len(conflicts) == 1
    assert conflicts[0].conflict_type == ConflictType.duplicate_sap_reference
    # Row numbers start at skip_header_rows + 1, so row 3 becomes row 4
    assert conflicts[0].row_number == 4


# =============================================================================
# Missing Parent Creation Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_missing_parent_simple(import_service, basic_import_config, mock_supabase):
    """Test creating a simple missing parent."""
    from datetime import datetime
    
    project_id = uuid4()
    user_id = uuid4()
    batch_id = uuid4()
    hierarchy_map = {}
    warnings = []
    
    # Mock database responses
    mock_supabase.execute.return_value = Mock(data=[])  # Parent doesn't exist
    
    # Mock po_service.create_breakdown
    mock_created = POBreakdownResponse(
        id=uuid4(),
        project_id=project_id,
        name='Auto-created: 1',
        code='1',
        hierarchy_level=0,
        parent_breakdown_id=None,
        planned_amount=Decimal('0'),
        committed_amount=Decimal('0'),
        actual_amount=Decimal('0'),
        remaining_amount=Decimal('0'),
        currency='USD',
        exchange_rate=Decimal('1'),
        breakdown_type=POBreakdownType.sap_standard,
        custom_fields={'auto_created': True},
        tags=[],
        version=1,
        is_active=True,
        created_by=user_id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    import_service.po_service.create_breakdown = AsyncMock(return_value=mock_created)
    
    parent_id = await import_service._create_missing_parent(
        parent_code='1',
        project_id=project_id,
        user_id=user_id,
        batch_id=batch_id,
        config=basic_import_config,
        hierarchy_map=hierarchy_map,
        warnings=warnings,
        row_number=2
    )
    
    assert parent_id is not None
    assert '1' in hierarchy_map
    assert hierarchy_map['1'] == mock_created.id
    assert len(warnings) == 1
    assert 'Auto-created missing parent' in warnings[0].message


@pytest.mark.asyncio
async def test_create_missing_parent_recursive(import_service, basic_import_config, mock_supabase):
    """Test recursively creating missing parents (grandparent, parent)."""
    from datetime import datetime
    
    project_id = uuid4()
    user_id = uuid4()
    batch_id = uuid4()
    hierarchy_map = {}
    warnings = []
    
    # Mock database responses - no parents exist
    mock_supabase.execute.return_value = Mock(data=[])
    
    # Mock po_service.create_breakdown to return different IDs
    created_ids = [uuid4(), uuid4()]
    call_count = [0]
    
    async def mock_create_breakdown(*args, **kwargs):
        breakdown_data = kwargs.get('breakdown_data')
        result = POBreakdownResponse(
            id=created_ids[call_count[0]],
            project_id=project_id,
            name=breakdown_data.name,
            code=breakdown_data.code,
            hierarchy_level=0,
            parent_breakdown_id=breakdown_data.parent_breakdown_id,
            planned_amount=Decimal('0'),
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=Decimal('0'),
            currency='USD',
            exchange_rate=Decimal('1'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={'auto_created': True},
            tags=[],
            version=1,
            is_active=True,
            created_by=user_id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        call_count[0] += 1
        return result
    
    import_service.po_service.create_breakdown = AsyncMock(side_effect=mock_create_breakdown)
    
    # Create parent '1.1' which should also create grandparent '1'
    parent_id = await import_service._create_missing_parent(
        parent_code='1.1',
        project_id=project_id,
        user_id=user_id,
        batch_id=batch_id,
        config=basic_import_config,
        hierarchy_map=hierarchy_map,
        warnings=warnings,
        row_number=3
    )
    
    assert parent_id is not None
    assert '1' in hierarchy_map  # Grandparent created
    assert '1.1' in hierarchy_map  # Parent created
    assert len(warnings) == 2  # One for each auto-created parent


@pytest.mark.asyncio
async def test_create_missing_parent_already_exists(import_service, basic_import_config, mock_supabase):
    """Test that existing parent is reused instead of creating duplicate."""
    project_id = uuid4()
    user_id = uuid4()
    batch_id = uuid4()
    hierarchy_map = {}
    warnings = []
    
    existing_id = uuid4()
    
    # Mock database response - parent exists
    mock_supabase.execute.return_value = Mock(data=[{
        'id': str(existing_id),
        'code': '1',
        'name': 'Existing Parent'
    }])
    
    parent_id = await import_service._create_missing_parent(
        parent_code='1',
        project_id=project_id,
        user_id=user_id,
        batch_id=batch_id,
        config=basic_import_config,
        hierarchy_map=hierarchy_map,
        warnings=warnings,
        row_number=2
    )
    
    assert parent_id == existing_id
    assert '1' in hierarchy_map
    assert hierarchy_map['1'] == existing_id
    assert len(warnings) == 0  # No warning since parent already existed


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.asyncio
async def test_construct_hierarchy_simple(import_service, basic_import_config, mock_supabase):
    """Test constructing a simple hierarchy from import data."""
    from datetime import datetime
    
    project_id = uuid4()
    user_id = uuid4()
    batch_id = uuid4()
    errors = []
    warnings = []
    
    parsed_rows = [
        {'Structure Code': '1', 'Name': 'Root', 'Code': 'R1', 'Planned Amount': '1000'},
        {'Structure Code': '1.1', 'Name': 'Child 1', 'Code': 'C1', 'Planned Amount': '500'},
        {'Structure Code': '1.2', 'Name': 'Child 2', 'Code': 'C2', 'Planned Amount': '500'},
    ]
    
    # Mock database responses
    mock_supabase.execute.return_value = Mock(data=[])
    
    # Mock po_service.create_breakdown
    created_ids = [uuid4() for _ in range(3)]
    call_count = [0]
    
    async def mock_create_breakdown(*args, **kwargs):
        breakdown_data = kwargs.get('breakdown_data')
        result = POBreakdownResponse(
            id=created_ids[call_count[0]],
            project_id=project_id,
            name=breakdown_data.name,
            code=breakdown_data.code,
            hierarchy_level=0,
            parent_breakdown_id=breakdown_data.parent_breakdown_id,
            planned_amount=breakdown_data.planned_amount,
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=breakdown_data.planned_amount,
            currency='USD',
            exchange_rate=Decimal('1'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields={},
            tags=[],
            version=1,
            is_active=True,
            created_by=user_id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        call_count[0] += 1
        return result
    
    import_service.po_service.create_breakdown = AsyncMock(side_effect=mock_create_breakdown)
    
    # Mock _update_import_metadata to avoid database calls
    import_service._update_import_metadata = AsyncMock()
    
    created_breakdown_ids, hierarchy_count = await import_service.construct_hierarchy_from_import(
        parsed_rows=parsed_rows,
        project_id=project_id,
        config=basic_import_config,
        user_id=user_id,
        batch_id=batch_id,
        errors=errors,
        warnings=warnings
    )
    
    assert len(created_breakdown_ids) == 3
    assert hierarchy_count == 2  # Levels 0 and 1
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_construct_hierarchy_with_missing_parents(import_service, basic_import_config, mock_supabase):
    """Test constructing hierarchy with automatic parent creation."""
    from datetime import datetime
    
    project_id = uuid4()
    user_id = uuid4()
    batch_id = uuid4()
    errors = []
    warnings = []
    
    # Import only child items - parents should be auto-created
    parsed_rows = [
        {'Structure Code': '1.1.1', 'Name': 'Grandchild', 'Code': 'GC1', 'Planned Amount': '100'},
    ]
    
    # Mock database responses - no parents exist
    mock_supabase.execute.return_value = Mock(data=[])
    
    # Mock po_service.create_breakdown
    created_ids = [uuid4() for _ in range(3)]  # For 1, 1.1, and 1.1.1
    call_count = [0]
    
    async def mock_create_breakdown(*args, **kwargs):
        breakdown_data = kwargs.get('breakdown_data')
        result = POBreakdownResponse(
            id=created_ids[call_count[0]],
            project_id=project_id,
            name=breakdown_data.name,
            code=breakdown_data.code,
            hierarchy_level=0,
            parent_breakdown_id=breakdown_data.parent_breakdown_id,
            planned_amount=breakdown_data.planned_amount,
            committed_amount=Decimal('0'),
            actual_amount=Decimal('0'),
            remaining_amount=breakdown_data.planned_amount,
            currency='USD',
            exchange_rate=Decimal('1'),
            breakdown_type=POBreakdownType.sap_standard,
            custom_fields=breakdown_data.custom_fields,
            tags=[],
            version=1,
            is_active=True,
            created_by=user_id,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        call_count[0] += 1
        return result
    
    import_service.po_service.create_breakdown = AsyncMock(side_effect=mock_create_breakdown)
    
    # Mock _update_import_metadata to avoid database calls
    import_service._update_import_metadata = AsyncMock()
    
    created_breakdown_ids, hierarchy_count = await import_service.construct_hierarchy_from_import(
        parsed_rows=parsed_rows,
        project_id=project_id,
        config=basic_import_config,
        user_id=user_id,
        batch_id=batch_id,
        errors=errors,
        warnings=warnings
    )
    
    assert len(created_breakdown_ids) == 1  # Only the actual import item
    assert len(warnings) >= 2  # Warnings for auto-created parents
    assert any('Auto-created missing parent' in w.message for w in warnings)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
