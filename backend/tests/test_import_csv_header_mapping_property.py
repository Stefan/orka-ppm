"""
Property-Based Test for CSV Header Mapping
Feature: project-import-mvp
Property 2: CSV header mapping preserves data

**Validates: Requirements 2.2, 10.1, 10.2**

Requirements 2.2: WHEN the CSV file contains a header row, THE CSV_Parser SHALL map column names to project fields
Requirements 10.1: THE CSV_Parser SHALL accept CSV files with a header row containing column names
Requirements 10.2: THE CSV_Parser SHALL map the following column names to project fields: 
                   name, budget, status, start_date, end_date, description
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from uuid import uuid4
import sys
import os
from io import BytesIO
import itertools

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.csv_parser import CSVParser, CSVParseError
from models.base import ProjectStatus


# Valid status values
VALID_STATUSES = [s.value for s in ProjectStatus]


@st.composite
def valid_csv_row_data(draw):
    """
    Generate valid CSV row data with all fields.
    Returns a dictionary with field names and values.
    
    Note: The CSV parser trims whitespace from fields, so we generate
    names and descriptions without leading/trailing whitespace to test
    that the core data mapping works correctly.
    
    Also, pandas may convert numeric-looking strings to numbers, so we
    ensure string fields start with a letter.
    """
    from datetime import date
    
    # Generate valid name (non-empty, starts with letter to avoid numeric-only names)
    # Avoid leading/trailing whitespace since CSV parser trims it
    first_char = draw(st.sampled_from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'))
    rest_of_name = draw(st.text(
        min_size=0, 
        max_size=49,
        alphabet=st.characters(
            whitelist_categories=('L', 'N'),
            whitelist_characters='-_'
        )
    ))
    # Add internal spaces but not leading/trailing
    name = first_char + rest_of_name
    
    # Generate valid budget (positive number)
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate valid status
    status = draw(st.sampled_from(VALID_STATUSES))
    
    # Generate optional description (starts with letter to avoid pandas numeric conversion)
    # Also avoid leading/trailing whitespace since CSV parser trims it
    has_description = draw(st.booleans())
    if has_description:
        desc_first_char = draw(st.sampled_from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'))
        desc_rest = draw(st.text(
            min_size=0, 
            max_size=99,
            alphabet=st.characters(
                whitelist_categories=('L', 'N'),
                whitelist_characters=' -_.'
            )
        ))
        description = (desc_first_char + desc_rest).strip()
        if not description:
            description = None
    else:
        description = None
    
    # Generate optional dates in ISO format
    start_date = draw(st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2030, 12, 31)
    ).map(lambda d: d.isoformat()) | st.none())
    
    end_date = draw(st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2030, 12, 31)
    ).map(lambda d: d.isoformat()) | st.none())
    
    return {
        "name": name,
        "budget": budget,
        "status": status,
        "description": description,
        "start_date": start_date,
        "end_date": end_date
    }


@st.composite
def csv_with_shuffled_columns(draw):
    """
    Generate CSV content with columns in random order.
    This tests that header mapping works regardless of column order.
    """
    # Generate row data
    row_data = draw(valid_csv_row_data())
    
    # Define all possible columns
    all_columns = ["name", "budget", "status", "description", "start_date", "end_date"]
    
    # Shuffle column order
    column_order = draw(st.permutations(all_columns))
    
    # Build CSV header
    header = ",".join(column_order)
    
    # Build CSV row with values in the shuffled order
    row_values = []
    for col in column_order:
        value = row_data.get(col)
        if value is None:
            row_values.append("")
        elif isinstance(value, float):
            row_values.append(str(value))
        else:
            row_values.append(str(value))
    
    row = ",".join(row_values)
    
    csv_content = f"{header}\n{row}"
    
    return {
        "csv_content": csv_content,
        "row_data": row_data,
        "column_order": list(column_order)
    }


@st.composite
def csv_with_case_variations(draw):
    """
    Generate CSV content with column names in various cases.
    Tests case-insensitive column mapping.
    """
    row_data = draw(valid_csv_row_data())
    
    # Define columns with case variations
    case_variations = {
        "name": draw(st.sampled_from(["name", "Name", "NAME", "NaMe"])),
        "budget": draw(st.sampled_from(["budget", "Budget", "BUDGET", "BuDgEt"])),
        "status": draw(st.sampled_from(["status", "Status", "STATUS", "StAtUs"])),
        "description": draw(st.sampled_from(["description", "Description", "DESCRIPTION"])),
        "start_date": draw(st.sampled_from(["start_date", "Start_Date", "START_DATE"])),
        "end_date": draw(st.sampled_from(["end_date", "End_Date", "END_DATE"]))
    }
    
    # Build CSV with case-varied headers
    columns = list(case_variations.keys())
    header = ",".join(case_variations[col] for col in columns)
    
    row_values = []
    for col in columns:
        value = row_data.get(col)
        if value is None:
            row_values.append("")
        elif isinstance(value, float):
            row_values.append(str(value))
        else:
            row_values.append(str(value))
    
    row = ",".join(row_values)
    csv_content = f"{header}\n{row}"
    
    return {
        "csv_content": csv_content,
        "row_data": row_data,
        "case_variations": case_variations
    }


class TestCSVHeaderMappingProperty:
    """
    Property-based tests for CSV header mapping.
    
    Property 2: CSV header mapping preserves data
    **Validates: Requirements 2.2, 10.1, 10.2**
    """
    
    @pytest.fixture
    def csv_parser(self):
        """Create a CSVParser instance"""
        return CSVParser()
    
    @pytest.fixture
    def portfolio_id(self):
        """Generate a portfolio ID for testing"""
        return uuid4()
    
    @given(csv_data=csv_with_shuffled_columns())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_2_csv_header_mapping_preserves_data(
        self, 
        csv_data, 
        csv_parser, 
        portfolio_id
    ):
        """
        Property 2: CSV header mapping preserves data
        
        **Validates: Requirements 2.2, 10.1, 10.2**
        
        For any valid CSV file with a header row, regardless of column order,
        the CSV_Parser should correctly map all columns to their corresponding
        project fields and preserve all data values.
        """
        csv_content = csv_data["csv_content"]
        expected_data = csv_data["row_data"]
        column_order = csv_data["column_order"]
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"Column order was: {column_order}"
        )
        
        project = projects[0]
        
        # Verify name is preserved
        assert project.name == expected_data["name"], (
            f"Name not preserved. Expected '{expected_data['name']}', "
            f"got '{project.name}'. Column order: {column_order}"
        )
        
        # Verify budget is preserved (with floating point tolerance)
        assert abs(project.budget - expected_data["budget"]) < 0.01, (
            f"Budget not preserved. Expected {expected_data['budget']}, "
            f"got {project.budget}. Column order: {column_order}"
        )
        
        # Verify status is preserved
        expected_status = expected_data["status"]
        actual_status = project.status.value if hasattr(project.status, 'value') else str(project.status)
        assert actual_status == expected_status, (
            f"Status not preserved. Expected '{expected_status}', "
            f"got '{actual_status}'. Column order: {column_order}"
        )
        
        # Verify description is preserved (if provided)
        if expected_data["description"]:
            assert project.description == expected_data["description"], (
                f"Description not preserved. Expected '{expected_data['description']}', "
                f"got '{project.description}'. Column order: {column_order}"
            )
        
        # Verify start_date is preserved (if provided)
        if expected_data["start_date"]:
            assert str(project.start_date) == expected_data["start_date"], (
                f"Start date not preserved. Expected '{expected_data['start_date']}', "
                f"got '{project.start_date}'. Column order: {column_order}"
            )
        
        # Verify end_date is preserved (if provided)
        if expected_data["end_date"]:
            assert str(project.end_date) == expected_data["end_date"], (
                f"End date not preserved. Expected '{expected_data['end_date']}', "
                f"got '{project.end_date}'. Column order: {column_order}"
            )
    
    @given(csv_data=csv_with_case_variations())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_2_csv_header_mapping_case_insensitive(
        self, 
        csv_data, 
        csv_parser, 
        portfolio_id
    ):
        """
        Property 2: CSV header mapping preserves data (case-insensitive)
        
        **Validates: Requirements 2.2, 10.1, 10.2**
        
        For any valid CSV file with header names in any case variation,
        the CSV_Parser should correctly map columns to project fields.
        """
        csv_content = csv_data["csv_content"]
        expected_data = csv_data["row_data"]
        case_variations = csv_data["case_variations"]
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"Case variations: {case_variations}"
        )
        
        project = projects[0]
        
        # Verify name is preserved regardless of header case
        assert project.name == expected_data["name"], (
            f"Name not preserved with case variation '{case_variations['name']}'. "
            f"Expected '{expected_data['name']}', got '{project.name}'"
        )
        
        # Verify budget is preserved regardless of header case
        assert abs(project.budget - expected_data["budget"]) < 0.01, (
            f"Budget not preserved with case variation '{case_variations['budget']}'. "
            f"Expected {expected_data['budget']}, got {project.budget}"
        )
        
        # Verify status is preserved regardless of header case
        expected_status = expected_data["status"]
        actual_status = project.status.value if hasattr(project.status, 'value') else str(project.status)
        assert actual_status == expected_status, (
            f"Status not preserved with case variation '{case_variations['status']}'. "
            f"Expected '{expected_status}', got '{actual_status}'"
        )


class TestCSVHeaderMappingEdgeCases:
    """
    Additional edge case tests for CSV header mapping.
    These complement the property-based tests with specific scenarios.
    """
    
    @pytest.fixture
    def csv_parser(self):
        """Create a CSVParser instance"""
        return CSVParser()
    
    @pytest.fixture
    def portfolio_id(self):
        """Generate a portfolio ID for testing"""
        return uuid4()
    
    def test_columns_in_reverse_order(self, csv_parser, portfolio_id):
        """Test CSV with columns in reverse alphabetical order"""
        csv_content = b"status,start_date,name,end_date,description,budget\nplanning,2024-01-15,Test Project,2024-12-31,A test project,50000.00"
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Test Project"
        assert projects[0].budget == 50000.00
        assert projects[0].status.value == "planning"
    
    def test_only_required_columns(self, csv_parser, portfolio_id):
        """Test CSV with only required columns"""
        csv_content = b"name,budget,status\nMinimal Project,10000,active"
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Minimal Project"
        assert projects[0].budget == 10000.0
        assert projects[0].status.value == "active"
        assert projects[0].description is None
        assert projects[0].start_date is None
        assert projects[0].end_date is None
    
    def test_multiple_rows_preserve_all_data(self, csv_parser, portfolio_id):
        """Test that multiple rows all have their data preserved"""
        csv_content = b"""name,budget,status,description
Project A,10000,planning,First project
Project B,20000,active,Second project
Project C,30000,completed,Third project"""
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 3
        assert projects[0].name == "Project A"
        assert projects[0].budget == 10000.0
        assert projects[1].name == "Project B"
        assert projects[1].budget == 20000.0
        assert projects[2].name == "Project C"
        assert projects[2].budget == 30000.0
