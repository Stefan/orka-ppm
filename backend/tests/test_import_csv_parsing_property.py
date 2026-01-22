"""
Property-based tests for CSV import parsing

Feature: ai-empowered-ppm-features
Property 26: CSV Import Parsing

For any valid CSV file uploaded to /projects/import, the system SHALL parse all rows
using pandas and validate each record against the appropriate Pydantic model.

Validates: Requirements 11.1, 11.3
"""

import pytest
from hypothesis import given, strategies as st, settings
from io import StringIO
import pandas as pd
from datetime import date, timedelta
from decimal import Decimal
import sys
import os

# Add parent directory to path to import import_processor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from import_processor import ImportProcessor, ProjectImportModel, ResourceImportModel, FinancialImportModel


# Custom strategies for generating valid CSV data
@st.composite
def valid_project_csv_data(draw):
    """Generate valid project data for CSV"""
    num_records = draw(st.integers(min_value=1, max_value=20))
    records = []
    
    for _ in range(num_records):
        start_date = draw(st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 12, 31)))
        end_date = start_date + timedelta(days=draw(st.integers(min_value=1, max_value=365)))
        
        # Generate valid text without control characters
        name = draw(st.text(
            min_size=1,
            max_size=100,
            alphabet=st.characters(
                blacklist_categories=('Cc', 'Cs'),  # Exclude control and surrogate characters
                blacklist_characters='\x00\r\n\t'  # Exclude null, newlines, tabs
            )
        ))
        
        record = {
            'name': name if name.strip() else 'Project',  # Ensure non-empty after strip
            'description': draw(st.one_of(st.none(), st.text(max_size=200, alphabet=st.characters(blacklist_categories=('Cc', 'Cs'))))),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'budget': float(draw(st.decimals(min_value=0, max_value=1000000, places=2))),
            'status': draw(st.sampled_from(['planning', 'active', 'on_hold', 'completed', 'cancelled'])),
            'priority': draw(st.one_of(st.none(), st.sampled_from(['low', 'medium', 'high', 'critical'])))
        }
        records.append(record)
    
    return records


@st.composite
def valid_resource_csv_data(draw):
    """Generate valid resource data for CSV"""
    num_records = draw(st.integers(min_value=1, max_value=20))
    records = []
    
    for i in range(num_records):
        name = draw(st.text(
            min_size=1,
            max_size=100,
            alphabet=st.characters(
                blacklist_categories=('Cc', 'Cs'),
                blacklist_characters='\x00\r\n\t'
            )
        ))
        
        record = {
            'name': name if name.strip() else 'Resource',
            'email': f"user{i}_{draw(st.integers(min_value=1, max_value=10000))}@example.com",
            'role': draw(st.sampled_from(['Developer', 'Manager', 'Designer', 'Analyst'])),
            'hourly_rate': float(draw(st.decimals(min_value=0, max_value=500, places=2))),
            'capacity': draw(st.integers(min_value=1, max_value=168)),
            'availability': draw(st.integers(min_value=0, max_value=100)),
            'location': draw(st.one_of(st.none(), st.sampled_from(['Remote', 'Office', 'Hybrid'])))
        }
        records.append(record)
    
    return records


def records_to_csv_bytes(records):
    """Convert list of records to CSV bytes"""
    df = pd.DataFrame(records)
    csv_string = df.to_csv(index=False)
    return csv_string.encode('utf-8')


class MockSupabaseClient:
    """Mock Supabase client for testing"""
    def __init__(self):
        self.inserted_data = {}
        self.current_table = None
    
    def table(self, table_name):
        self.current_table = table_name
        if table_name not in self.inserted_data:
            self.inserted_data[table_name] = []
        return self
    
    def insert(self, data):
        if self.current_table:
            records = data if isinstance(data, list) else [data]
            self.inserted_data[self.current_table].extend(records)
        return self
    
    def execute(self):
        class Result:
            def __init__(self, data):
                self.data = data
        if self.current_table:
            return Result(self.inserted_data[self.current_table])
        return Result([])


@pytest.mark.asyncio
@given(project_data=valid_project_csv_data())
@settings(max_examples=50, deadline=None)
async def test_property_26_csv_project_parsing(project_data):
    """
    Feature: ai-empowered-ppm-features
    Property 26: CSV Import Parsing
    
    For any valid CSV file with project data, the system SHALL:
    1. Parse all rows using pandas
    2. Validate each record against ProjectImportModel
    3. Return valid records without errors
    
    Validates: Requirements 11.1, 11.3
    """
    # Arrange
    csv_bytes = records_to_csv_bytes(project_data)
    mock_supabase = MockSupabaseClient()
    processor = ImportProcessor(mock_supabase)
    
    # Act
    result = await processor.process_import(
        file_content=csv_bytes,
        file_type='csv',
        entity_type='projects',
        organization_id='test-org-id',
        user_id='test-user-id'
    )
    
    # Assert
    # All records should be successfully parsed and validated
    assert result['success_count'] == len(project_data), \
        f"Expected {len(project_data)} successful imports, got {result['success_count']}"
    assert result['error_count'] == 0, \
        f"Expected no errors, got {result['error_count']} errors: {result['errors']}"
    assert len(result['errors']) == 0, \
        f"Expected empty error list, got: {result['errors']}"
    
    # Verify all records were inserted into projects table
    projects_table = mock_supabase.inserted_data.get('projects', [])
    assert len(projects_table) == len(project_data), \
        f"Expected {len(project_data)} records inserted, got {len(projects_table)}"
    
    # Verify each inserted record has organization_id
    for record in projects_table:
        assert 'organization_id' in record, "Record missing organization_id"
        assert record['organization_id'] == 'test-org-id', "Incorrect organization_id"


@pytest.mark.asyncio
@given(resource_data=valid_resource_csv_data())
@settings(max_examples=50, deadline=None)
async def test_property_26_csv_resource_parsing(resource_data):
    """
    Feature: ai-empowered-ppm-features
    Property 26: CSV Import Parsing
    
    For any valid CSV file with resource data, the system SHALL:
    1. Parse all rows using pandas
    2. Validate each record against ResourceImportModel
    3. Return valid records without errors
    
    Validates: Requirements 11.1, 11.3
    """
    # Arrange
    csv_bytes = records_to_csv_bytes(resource_data)
    mock_supabase = MockSupabaseClient()
    processor = ImportProcessor(mock_supabase)
    
    # Act
    result = await processor.process_import(
        file_content=csv_bytes,
        file_type='csv',
        entity_type='resources',
        organization_id='test-org-id',
        user_id='test-user-id'
    )
    
    # Assert
    assert result['success_count'] == len(resource_data), \
        f"Expected {len(resource_data)} successful imports, got {result['success_count']}"
    assert result['error_count'] == 0, \
        f"Expected no errors, got {result['error_count']} errors"
    assert len(result['errors']) == 0
    
    # Verify all records were inserted into resources table
    resources_table = mock_supabase.inserted_data.get('resources', [])
    assert len(resources_table) == len(resource_data)
    
    # Verify each inserted record has organization_id
    for record in resources_table:
        assert 'organization_id' in record
        assert record['organization_id'] == 'test-org-id'


@pytest.mark.asyncio
async def test_property_26_csv_invalid_data_validation():
    """
    Feature: ai-empowered-ppm-features
    Property 26: CSV Import Parsing
    
    For any CSV file with invalid data, the system SHALL:
    1. Parse the CSV successfully
    2. Detect validation errors
    3. Return detailed error information with line numbers
    
    Validates: Requirements 11.1, 11.3
    """
    # Arrange - Create CSV with invalid project data
    invalid_data = [
        {
            'name': 'Valid Project',
            'start_date': '2024-01-01',
            'end_date': '2023-12-31',  # Invalid: end before start
            'budget': 10000,
            'status': 'planning'
        },
        {
            'name': '',  # Invalid: empty name
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'budget': 10000,
            'status': 'planning'
        }
    ]
    
    csv_bytes = records_to_csv_bytes(invalid_data)
    mock_supabase = MockSupabaseClient()
    processor = ImportProcessor(mock_supabase)
    
    # Act
    result = await processor.process_import(
        file_content=csv_bytes,
        file_type='csv',
        entity_type='projects',
        organization_id='test-org-id',
        user_id='test-user-id'
    )
    
    # Assert
    assert result['success_count'] == 0, "Should have no successful imports"
    assert result['error_count'] == 2, f"Should have 2 errors, got {result['error_count']}"
    assert len(result['errors']) == 2, "Should have 2 error details"
    
    # Verify error details include line numbers
    for error in result['errors']:
        assert 'line_number' in error, "Error missing line_number"
        assert 'field' in error, "Error missing field"
        assert 'message' in error, "Error missing message"
        assert error['line_number'] in [1, 2], f"Invalid line number: {error['line_number']}"


@pytest.mark.asyncio
async def test_property_26_csv_encoding_handling():
    """
    Feature: ai-empowered-ppm-features
    Property 26: CSV Import Parsing
    
    The system SHALL handle various CSV encodings (UTF-8, Latin-1, etc.)
    
    Validates: Requirements 11.1
    """
    # Arrange - Create CSV with special characters
    data = [
        {
            'name': 'Café Project',  # Special character
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'budget': 10000,
            'status': 'planning'
        }
    ]
    
    csv_string = pd.DataFrame(data).to_csv(index=False)
    
    # Test UTF-8 encoding
    csv_bytes_utf8 = csv_string.encode('utf-8')
    mock_supabase = MockSupabaseClient()
    processor = ImportProcessor(mock_supabase)
    
    result = await processor.process_import(
        file_content=csv_bytes_utf8,
        file_type='csv',
        entity_type='projects',
        organization_id='test-org-id',
        user_id='test-user-id'
    )
    
    # Assert
    assert result['success_count'] == 1, "Should successfully parse UTF-8 encoded CSV"
    assert result['error_count'] == 0
    
    # Test Latin-1 encoding
    csv_bytes_latin1 = csv_string.encode('latin-1')
    mock_supabase2 = MockSupabaseClient()
    processor2 = ImportProcessor(mock_supabase2)
    
    result2 = await processor2.process_import(
        file_content=csv_bytes_latin1,
        file_type='csv',
        entity_type='projects',
        organization_id='test-org-id',
        user_id='test-user-id'
    )
    
    # Assert
    assert result2['success_count'] == 1, "Should successfully parse Latin-1 encoded CSV"
    assert result2['error_count'] == 0
