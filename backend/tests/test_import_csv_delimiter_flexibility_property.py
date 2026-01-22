"""
Property-Based Test for CSV Delimiter Flexibility
Feature: project-import-mvp
Property 14: CSV delimiter flexibility

**Validates: Requirements 10.4**

Requirements 10.4: THE CSV_Parser SHALL accept both comma and semicolon as field delimiters
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from uuid import uuid4
from datetime import date
import sys
import os

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
    """
    # Generate valid name (non-empty, starts with letter)
    first_char = draw(st.sampled_from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'))
    rest_of_name = draw(st.text(
        min_size=0, 
        max_size=49,
        alphabet=st.characters(
            whitelist_categories=('L', 'N'),
            whitelist_characters='-_'
        )
    ))
    name = first_char + rest_of_name
    
    # Generate valid budget (positive number)
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate valid status
    status = draw(st.sampled_from(VALID_STATUSES))
    
    # Generate optional description
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
def csv_with_delimiter(draw, delimiter: str):
    """
    Generate CSV content with a specific delimiter.
    
    Args:
        delimiter: The delimiter to use (comma or semicolon)
    
    Returns:
        Dictionary with csv_content, row_data, and delimiter
    """
    # Generate row data
    row_data = draw(valid_csv_row_data())
    
    # Define columns
    columns = ["name", "budget", "status", "description", "start_date", "end_date"]
    
    # Build CSV header with specified delimiter
    header = delimiter.join(columns)
    
    # Build CSV row with values
    row_values = []
    for col in columns:
        value = row_data.get(col)
        if value is None:
            row_values.append("")
        elif isinstance(value, float):
            row_values.append(str(value))
        else:
            row_values.append(str(value))
    
    row = delimiter.join(row_values)
    csv_content = f"{header}\n{row}"
    
    return {
        "csv_content": csv_content,
        "row_data": row_data,
        "delimiter": delimiter
    }


@st.composite
def csv_with_comma_delimiter(draw):
    """Generate CSV content with comma delimiter"""
    return draw(csv_with_delimiter(","))


@st.composite
def csv_with_semicolon_delimiter(draw):
    """Generate CSV content with semicolon delimiter"""
    return draw(csv_with_delimiter(";"))


@st.composite
def csv_with_random_delimiter(draw):
    """Generate CSV content with randomly chosen delimiter (comma or semicolon)"""
    delimiter = draw(st.sampled_from([",", ";"]))
    return draw(csv_with_delimiter(delimiter))


class TestCSVDelimiterFlexibilityProperty:
    """
    Property-based tests for CSV delimiter flexibility.
    
    Property 14: CSV delimiter flexibility
    **Validates: Requirements 10.4**
    """
    
    @pytest.fixture
    def csv_parser(self):
        """Create a CSVParser instance"""
        return CSVParser()
    
    @pytest.fixture
    def portfolio_id(self):
        """Generate a portfolio ID for testing"""
        return uuid4()
    
    @given(csv_data=csv_with_random_delimiter())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_14_csv_delimiter_flexibility(
        self, 
        csv_data, 
        csv_parser, 
        portfolio_id
    ):
        """
        Property 14: CSV delimiter flexibility
        
        **Validates: Requirements 10.4**
        
        For any valid CSV file using either comma or semicolon as the field 
        delimiter, the CSV_Parser should successfully parse all rows into 
        project records.
        """
        csv_content = csv_data["csv_content"]
        expected_data = csv_data["row_data"]
        delimiter = csv_data["delimiter"]
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"Delimiter was: '{delimiter}'"
        )
        
        project = projects[0]
        
        # Verify name is preserved
        assert project.name == expected_data["name"], (
            f"Name not preserved with delimiter '{delimiter}'. "
            f"Expected '{expected_data['name']}', got '{project.name}'"
        )
        
        # Verify budget is preserved (with floating point tolerance)
        assert abs(project.budget - expected_data["budget"]) < 0.01, (
            f"Budget not preserved with delimiter '{delimiter}'. "
            f"Expected {expected_data['budget']}, got {project.budget}"
        )
        
        # Verify status is preserved
        expected_status = expected_data["status"]
        actual_status = project.status.value if hasattr(project.status, 'value') else str(project.status)
        assert actual_status == expected_status, (
            f"Status not preserved with delimiter '{delimiter}'. "
            f"Expected '{expected_status}', got '{actual_status}'"
        )
        
        # Verify description is preserved (if provided)
        if expected_data["description"]:
            assert project.description == expected_data["description"], (
                f"Description not preserved with delimiter '{delimiter}'. "
                f"Expected '{expected_data['description']}', got '{project.description}'"
            )
        
        # Verify start_date is preserved (if provided)
        if expected_data["start_date"]:
            assert str(project.start_date) == expected_data["start_date"], (
                f"Start date not preserved with delimiter '{delimiter}'. "
                f"Expected '{expected_data['start_date']}', got '{project.start_date}'"
            )
        
        # Verify end_date is preserved (if provided)
        if expected_data["end_date"]:
            assert str(project.end_date) == expected_data["end_date"], (
                f"End date not preserved with delimiter '{delimiter}'. "
                f"Expected '{expected_data['end_date']}', got '{project.end_date}'"
            )
    
    @given(csv_data=csv_with_comma_delimiter())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_14_comma_delimiter_parsing(
        self, 
        csv_data, 
        csv_parser, 
        portfolio_id
    ):
        """
        Property 14: CSV delimiter flexibility - Comma delimiter
        
        **Validates: Requirements 10.4**
        
        For any valid CSV file using comma as the field delimiter,
        the CSV_Parser should successfully parse all rows.
        """
        csv_content = csv_data["csv_content"]
        expected_data = csv_data["row_data"]
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project with comma delimiter, got {len(projects)}"
        )
        
        # Verify required fields are preserved
        project = projects[0]
        assert project.name == expected_data["name"]
        assert abs(project.budget - expected_data["budget"]) < 0.01
    
    @given(csv_data=csv_with_semicolon_delimiter())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_14_semicolon_delimiter_parsing(
        self, 
        csv_data, 
        csv_parser, 
        portfolio_id
    ):
        """
        Property 14: CSV delimiter flexibility - Semicolon delimiter
        
        **Validates: Requirements 10.4**
        
        For any valid CSV file using semicolon as the field delimiter,
        the CSV_Parser should successfully parse all rows.
        """
        csv_content = csv_data["csv_content"]
        expected_data = csv_data["row_data"]
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project with semicolon delimiter, got {len(projects)}"
        )
        
        # Verify required fields are preserved
        project = projects[0]
        assert project.name == expected_data["name"]
        assert abs(project.budget - expected_data["budget"]) < 0.01


class TestCSVDelimiterFlexibilityEdgeCases:
    """
    Additional edge case tests for CSV delimiter flexibility.
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
    
    def test_comma_delimiter_multiple_rows(self, csv_parser, portfolio_id):
        """Test comma-delimited CSV with multiple rows"""
        csv_content = b"""name,budget,status,description
Project A,10000,planning,First project
Project B,20000,active,Second project
Project C,30000,completed,Third project"""
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 3
        assert projects[0].name == "Project A"
        assert projects[1].name == "Project B"
        assert projects[2].name == "Project C"
    
    def test_semicolon_delimiter_multiple_rows(self, csv_parser, portfolio_id):
        """Test semicolon-delimited CSV with multiple rows"""
        csv_content = b"""name;budget;status;description
Project A;10000;planning;First project
Project B;20000;active;Second project
Project C;30000;completed;Third project"""
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 3
        assert projects[0].name == "Project A"
        assert projects[1].name == "Project B"
        assert projects[2].name == "Project C"
    
    def test_semicolon_delimiter_with_dates(self, csv_parser, portfolio_id):
        """Test semicolon-delimited CSV with date fields"""
        csv_content = b"""name;budget;status;start_date;end_date
Test Project;50000;planning;2024-01-15;2024-12-31"""
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Test Project"
        assert projects[0].budget == 50000.0
        assert str(projects[0].start_date) == "2024-01-15"
        assert str(projects[0].end_date) == "2024-12-31"
    
    def test_comma_delimiter_only_required_fields(self, csv_parser, portfolio_id):
        """Test comma-delimited CSV with only required fields"""
        csv_content = b"name,budget,status\nMinimal Project,10000,active"
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Minimal Project"
        assert projects[0].budget == 10000.0
    
    def test_semicolon_delimiter_only_required_fields(self, csv_parser, portfolio_id):
        """Test semicolon-delimited CSV with only required fields"""
        csv_content = b"name;budget;status\nMinimal Project;10000;active"
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Minimal Project"
        assert projects[0].budget == 10000.0
