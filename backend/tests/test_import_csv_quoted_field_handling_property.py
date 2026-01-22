"""
Property-Based Test for CSV Quoted Field Handling
Feature: project-import-mvp
Property 15: Quoted field handling

**Validates: Requirements 10.5**

Requirements 10.5: THE CSV_Parser SHALL handle quoted fields containing commas or newlines
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
def text_with_embedded_commas(draw):
    """
    Generate text that contains embedded commas.
    Returns a string with at least one comma.
    """
    # Generate parts of text separated by commas
    num_parts = draw(st.integers(min_value=2, max_value=4))
    parts = []
    for _ in range(num_parts):
        part = draw(st.text(
            min_size=1,
            max_size=20,
            alphabet=st.characters(
                whitelist_categories=('L', 'N'),
                whitelist_characters=' -_.'
            )
        ))
        if part.strip():
            parts.append(part.strip())
    
    # Ensure we have at least 2 parts
    if len(parts) < 2:
        parts = ["Part A", "Part B"]
    
    return ", ".join(parts)


@st.composite
def text_with_embedded_newlines(draw):
    """
    Generate text that contains embedded newlines.
    Returns a string with at least one newline.
    """
    # Generate parts of text separated by newlines
    num_parts = draw(st.integers(min_value=2, max_value=3))
    parts = []
    for _ in range(num_parts):
        part = draw(st.text(
            min_size=1,
            max_size=20,
            alphabet=st.characters(
                whitelist_categories=('L', 'N'),
                whitelist_characters=' -_.'
            )
        ))
        if part.strip():
            parts.append(part.strip())
    
    # Ensure we have at least 2 parts
    if len(parts) < 2:
        parts = ["Line 1", "Line 2"]
    
    return "\n".join(parts)


@st.composite
def text_with_embedded_commas_and_newlines(draw):
    """
    Generate text that contains both embedded commas and newlines.
    """
    # Generate parts with commas
    comma_text = draw(text_with_embedded_commas())
    # Add a newline in the middle
    parts = comma_text.split(", ")
    if len(parts) >= 2:
        mid = len(parts) // 2
        return ", ".join(parts[:mid]) + "\n" + ", ".join(parts[mid:])
    return comma_text + "\nAdditional line"


@st.composite
def valid_project_name(draw):
    """Generate a valid project name (non-empty, starts with letter)"""
    first_char = draw(st.sampled_from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'))
    rest_of_name = draw(st.text(
        min_size=0,
        max_size=30,
        alphabet=st.characters(
            whitelist_categories=('L', 'N'),
            whitelist_characters='-_ '
        )
    ))
    return (first_char + rest_of_name).strip()


@st.composite
def csv_row_with_quoted_name_containing_comma(draw):
    """
    Generate CSV row data where the name field contains embedded commas.
    """
    # Generate name with embedded commas
    name_with_comma = draw(text_with_embedded_commas())
    # Ensure name starts with a letter
    if not name_with_comma[0].isalpha():
        name_with_comma = "Project " + name_with_comma
    
    # Generate valid budget
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate valid status
    status = draw(st.sampled_from(VALID_STATUSES))
    
    # Generate simple description (no special chars)
    description = draw(valid_project_name()) or "Test description"
    
    return {
        "name": name_with_comma,
        "budget": budget,
        "status": status,
        "description": description
    }


@st.composite
def csv_row_with_quoted_description_containing_comma(draw):
    """
    Generate CSV row data where the description field contains embedded commas.
    """
    # Generate simple name
    name = draw(valid_project_name()) or "Test Project"
    
    # Generate valid budget
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate valid status
    status = draw(st.sampled_from(VALID_STATUSES))
    
    # Generate description with embedded commas
    description_with_comma = draw(text_with_embedded_commas())
    
    return {
        "name": name,
        "budget": budget,
        "status": status,
        "description": description_with_comma
    }


@st.composite
def csv_row_with_quoted_description_containing_newline(draw):
    """
    Generate CSV row data where the description field contains embedded newlines.
    """
    # Generate simple name
    name = draw(valid_project_name()) or "Test Project"
    
    # Generate valid budget
    budget = draw(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    
    # Generate valid status
    status = draw(st.sampled_from(VALID_STATUSES))
    
    # Generate description with embedded newlines
    description_with_newline = draw(text_with_embedded_newlines())
    
    return {
        "name": name,
        "budget": budget,
        "status": status,
        "description": description_with_newline
    }


def build_csv_with_quoted_fields(row_data: dict, quote_field: str) -> str:
    """
    Build CSV content with properly quoted fields.
    
    Args:
        row_data: Dictionary with field values
        quote_field: The field that should be quoted (contains special chars)
    
    Returns:
        CSV content as string
    """
    columns = ["name", "budget", "status", "description"]
    header = ",".join(columns)
    
    row_values = []
    for col in columns:
        value = row_data.get(col)
        if value is None:
            row_values.append("")
        elif col == quote_field or (isinstance(value, str) and (',' in value or '\n' in value)):
            # Quote the field and escape any internal quotes
            escaped_value = str(value).replace('"', '""')
            row_values.append(f'"{escaped_value}"')
        elif isinstance(value, float):
            row_values.append(str(value))
        else:
            row_values.append(str(value))
    
    row = ",".join(row_values)
    return f"{header}\n{row}"


class TestCSVQuotedFieldHandlingProperty:
    """
    Property-based tests for CSV quoted field handling.
    
    Property 15: Quoted field handling
    **Validates: Requirements 10.5**
    """
    
    @pytest.fixture
    def csv_parser(self):
        """Create a CSVParser instance"""
        return CSVParser()
    
    @pytest.fixture
    def portfolio_id(self):
        """Generate a portfolio ID for testing"""
        return uuid4()
    
    @given(row_data=csv_row_with_quoted_name_containing_comma())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_15_quoted_name_with_embedded_comma(
        self,
        row_data,
        csv_parser,
        portfolio_id
    ):
        """
        Property 15: Quoted field handling - Name with embedded comma
        
        **Validates: Requirements 10.5**
        
        For any CSV file containing a quoted name field with embedded commas,
        the CSV_Parser should correctly parse the quoted content as a single
        field value without splitting on the embedded comma.
        """
        csv_content = build_csv_with_quoted_fields(row_data, "name")
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"CSV content:\n{csv_content}"
        )
        
        project = projects[0]
        
        # Verify name is preserved with embedded comma
        assert project.name == row_data["name"], (
            f"Name with embedded comma not preserved. "
            f"Expected '{row_data['name']}', got '{project.name}'"
        )
        
        # Verify the comma is actually in the name
        assert "," in row_data["name"], (
            f"Test data should contain comma in name: '{row_data['name']}'"
        )
    
    @given(row_data=csv_row_with_quoted_description_containing_comma())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_15_quoted_description_with_embedded_comma(
        self,
        row_data,
        csv_parser,
        portfolio_id
    ):
        """
        Property 15: Quoted field handling - Description with embedded comma
        
        **Validates: Requirements 10.5**
        
        For any CSV file containing a quoted description field with embedded commas,
        the CSV_Parser should correctly parse the quoted content as a single
        field value without splitting on the embedded comma.
        """
        csv_content = build_csv_with_quoted_fields(row_data, "description")
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"CSV content:\n{csv_content}"
        )
        
        project = projects[0]
        
        # Verify description is preserved with embedded comma
        assert project.description == row_data["description"], (
            f"Description with embedded comma not preserved. "
            f"Expected '{row_data['description']}', got '{project.description}'"
        )
        
        # Verify the comma is actually in the description
        assert "," in row_data["description"], (
            f"Test data should contain comma in description: '{row_data['description']}'"
        )
    
    @given(row_data=csv_row_with_quoted_description_containing_newline())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_property_15_quoted_description_with_embedded_newline(
        self,
        row_data,
        csv_parser,
        portfolio_id
    ):
        """
        Property 15: Quoted field handling - Description with embedded newline
        
        **Validates: Requirements 10.5**
        
        For any CSV file containing a quoted description field with embedded newlines,
        the CSV_Parser should correctly parse the quoted content as a single
        field value without splitting on the embedded newline.
        """
        csv_content = build_csv_with_quoted_fields(row_data, "description")
        
        # Parse the CSV
        projects = csv_parser.parse_csv(
            csv_content.encode('utf-8'),
            portfolio_id
        )
        
        # Should parse exactly one project
        assert len(projects) == 1, (
            f"Expected 1 project, got {len(projects)}. "
            f"CSV content:\n{csv_content}"
        )
        
        project = projects[0]
        
        # Verify description is preserved with embedded newline
        assert project.description == row_data["description"], (
            f"Description with embedded newline not preserved. "
            f"Expected '{row_data['description']}', got '{project.description}'"
        )
        
        # Verify the newline is actually in the description
        assert "\n" in row_data["description"], (
            f"Test data should contain newline in description: '{row_data['description']}'"
        )


class TestCSVQuotedFieldHandlingEdgeCases:
    """
    Additional edge case tests for CSV quoted field handling.
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
    
    def test_quoted_name_with_single_comma(self, csv_parser, portfolio_id):
        """Test quoted name field with a single embedded comma"""
        csv_content = b'''name,budget,status,description
"Project Alpha, Phase 1",10000,planning,Test description'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Project Alpha, Phase 1"
    
    def test_quoted_description_with_multiple_commas(self, csv_parser, portfolio_id):
        """Test quoted description field with multiple embedded commas"""
        csv_content = b'''name,budget,status,description
Test Project,10000,planning,"First item, second item, third item"'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].description == "First item, second item, third item"
    
    def test_quoted_description_with_newline(self, csv_parser, portfolio_id):
        """Test quoted description field with embedded newline"""
        csv_content = b'''name,budget,status,description
Test Project,10000,planning,"Line 1
Line 2"'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].description == "Line 1\nLine 2"
    
    def test_quoted_description_with_comma_and_newline(self, csv_parser, portfolio_id):
        """Test quoted description field with both comma and newline"""
        csv_content = b'''name,budget,status,description
Test Project,10000,planning,"Item A, Item B
Item C, Item D"'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].description == "Item A, Item B\nItem C, Item D"
    
    def test_multiple_rows_with_quoted_fields(self, csv_parser, portfolio_id):
        """Test multiple rows where some have quoted fields"""
        csv_content = b'''name,budget,status,description
"Project A, Phase 1",10000,planning,Simple description
Project B,20000,active,"Complex, multi-part description"
"Project C, Phase 2",30000,completed,"Another complex
multi-line description"'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 3
        assert projects[0].name == "Project A, Phase 1"
        assert projects[0].description == "Simple description"
        assert projects[1].name == "Project B"
        assert projects[1].description == "Complex, multi-part description"
        assert projects[2].name == "Project C, Phase 2"
        assert "multi-line" in projects[2].description
    
    def test_quoted_field_with_escaped_quotes(self, csv_parser, portfolio_id):
        """Test quoted field containing escaped double quotes"""
        csv_content = b'''name,budget,status,description
Test Project,10000,planning,"Description with ""quoted"" text"'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].description == 'Description with "quoted" text'
    
    def test_semicolon_delimiter_with_quoted_comma_field(self, csv_parser, portfolio_id):
        """Test semicolon-delimited CSV with quoted field containing comma"""
        csv_content = b'''name;budget;status;description
"Project A, Phase 1";10000;planning;Test description'''
        
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert len(projects) == 1
        assert projects[0].name == "Project A, Phase 1"

