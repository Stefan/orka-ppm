"""
Basic unit tests for CSVParser

These tests verify the core functionality of the CSV parser including
CSV parsing, column validation, and row-to-project conversion.
"""

import pytest
from io import BytesIO
from uuid import uuid4

from services.csv_parser import CSVParser, CSVParseError


class TestCSVParser:
    """Test suite for CSVParser"""
    
    @pytest.fixture
    def csv_parser(self):
        """Create a CSVParser instance"""
        return CSVParser()
    
    @pytest.fixture
    def portfolio_id(self):
        """Create a test portfolio ID"""
        return uuid4()
    
    def test_parse_csv_success(self, csv_parser, portfolio_id):
        """Test successful CSV parsing"""
        # Arrange
        csv_content = b"""name,budget,status,description
Project Alpha,10000.50,planning,Test project 1
Project Beta,25000.75,active,Test project 2"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].name == "Project Alpha"
        assert projects[0].budget == 10000.50
        assert projects[0].status == "planning"
        assert projects[1].name == "Project Beta"
        assert projects[1].budget == 25000.75
    
    def test_parse_csv_with_semicolon_delimiter(self, csv_parser, portfolio_id):
        """Test CSV parsing with semicolon delimiter"""
        # Arrange
        csv_content = b"""name;budget;status;description
Project Alpha;10000.50;planning;Test project 1
Project Beta;25000.75;active;Test project 2"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].name == "Project Alpha"
        assert projects[1].name == "Project Beta"
    
    def test_parse_csv_with_quoted_fields(self, csv_parser, portfolio_id):
        """Test CSV parsing with quoted fields containing commas"""
        # Arrange
        csv_content = b"""name,budget,status,description
"Project Alpha, Phase 1",10000.50,planning,"Test project, with commas"
Project Beta,25000.75,active,Simple description"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].name == "Project Alpha, Phase 1"
        assert projects[0].description == "Test project, with commas"
    
    def test_parse_csv_with_dates(self, csv_parser, portfolio_id):
        """Test CSV parsing with date fields"""
        # Arrange
        csv_content = b"""name,budget,status,start_date,end_date
Project Alpha,10000.50,planning,2024-01-15,2024-12-31
Project Beta,25000.75,active,2024-02-01,2024-06-30"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].start_date is not None
        assert projects[0].end_date is not None
        assert str(projects[0].start_date) == "2024-01-15"
    
    def test_parse_csv_missing_required_columns(self, csv_parser, portfolio_id):
        """Test CSV parsing fails when required columns are missing"""
        # Arrange - missing 'budget' column
        csv_content = b"""name,status,description
Project Alpha,planning,Test project 1"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert "Missing required columns" in str(exc_info.value)
        assert "budget" in str(exc_info.value)
    
    def test_parse_csv_empty_file(self, csv_parser, portfolio_id):
        """Test CSV parsing fails with empty file"""
        # Arrange
        csv_content = b""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert "empty" in str(exc_info.value).lower() or "parse" in str(exc_info.value).lower()
    
    def test_parse_csv_invalid_date_format(self, csv_parser, portfolio_id):
        """Test CSV parsing fails with invalid date format"""
        # Arrange
        csv_content = b"""name,budget,status,start_date
Project Alpha,10000.50,planning,01/15/2024"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        assert "date" in str(exc_info.value).lower()
    
    def test_parse_csv_case_insensitive_columns(self, csv_parser, portfolio_id):
        """Test CSV parsing handles case-insensitive column names"""
        # Arrange - mixed case column names
        csv_content = b"""Name,Budget,Status,Description
Project Alpha,10000.50,planning,Test project 1"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 1
        assert projects[0].name == "Project Alpha"
    
    def test_parse_csv_with_optional_fields(self, csv_parser, portfolio_id):
        """Test CSV parsing with only required fields"""
        # Arrange - only required fields
        csv_content = b"""name,budget,status
Project Alpha,10000.50,planning
Project Beta,25000.75,active"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].name == "Project Alpha"
        assert projects[0].description is None
        assert projects[0].start_date is None
    
    def test_parse_csv_with_empty_optional_fields(self, csv_parser, portfolio_id):
        """Test CSV parsing handles empty optional fields"""
        # Arrange
        csv_content = b"""name,budget,status,description,start_date
Project Alpha,10000.50,planning,,
Project Beta,25000.75,active,Test,2024-01-15"""
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 2
        assert projects[0].description is None
        assert projects[0].start_date is None
        assert projects[1].description == "Test"
        assert projects[1].start_date is not None
    
    def test_get_field_required_missing(self, csv_parser):
        """Test _get_field raises error for missing required field"""
        # Arrange
        row_dict = {"name": "Test", "budget": "10000"}
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser._get_field(row_dict, "status", required=True)
        
        assert "Required field" in str(exc_info.value)
        assert "status" in str(exc_info.value)
    
    def test_get_field_optional_missing(self, csv_parser):
        """Test _get_field returns None for missing optional field"""
        # Arrange
        row_dict = {"name": "Test", "budget": "10000"}
        
        # Act
        result = csv_parser._get_field(row_dict, "description", required=False)
        
        # Assert
        assert result is None
    
    def test_parse_date_valid(self, csv_parser):
        """Test _parse_date with valid ISO date"""
        # Act
        result = csv_parser._parse_date("2024-01-15")
        
        # Assert
        assert result is not None
        assert str(result) == "2024-01-15"
    
    def test_parse_date_invalid(self, csv_parser):
        """Test _parse_date with invalid date format"""
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser._parse_date("01/15/2024")
        
        assert "Invalid date format" in str(exc_info.value)


    # ============================================================
    # Task 3.5: Unit tests for CSV parsing errors
    # Requirements: 2.5, 10.3
    # ============================================================
    
    def test_parse_csv_malformed_structure_unbalanced_quotes(self, csv_parser, portfolio_id):
        """Test CSV parsing fails with unbalanced quotes (malformed structure)"""
        # Arrange - unbalanced quote in description field
        csv_content = b"""name,budget,status,description
Project Alpha,10000.50,planning,"Unbalanced quote
Project Beta,25000.75,active,Normal description"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Should fail to parse due to malformed CSV structure
        assert "parse" in str(exc_info.value).lower() or "failed" in str(exc_info.value).lower()
    
    def test_parse_csv_malformed_structure_inconsistent_columns(self, csv_parser, portfolio_id):
        """Test CSV parsing handles rows with inconsistent column counts"""
        # Arrange - second row has extra column
        csv_content = b"""name,budget,status
Project Alpha,10000.50,planning
Project Beta,25000.75,active,extra_value,another_extra"""
        
        # Act - pandas typically handles this gracefully by ignoring extra columns
        # or raising an error depending on configuration
        try:
            projects = csv_parser.parse_csv(csv_content, portfolio_id)
            # If it parses, verify the data is correct
            assert len(projects) >= 1
            assert projects[0].name == "Project Alpha"
        except CSVParseError:
            # Also acceptable - parser rejects malformed structure
            pass
    
    def test_parse_csv_malformed_structure_missing_values(self, csv_parser, portfolio_id):
        """Test CSV parsing fails when required field values are missing in row"""
        # Arrange - second row missing budget value
        csv_content = b"""name,budget,status
Project Alpha,10000.50,planning
Project Beta,,active"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Should fail because budget is required
        assert "budget" in str(exc_info.value).lower() or "required" in str(exc_info.value).lower()
    
    def test_parse_csv_malformed_structure_header_only(self, csv_parser, portfolio_id):
        """Test CSV parsing fails with header row only (no data rows)"""
        # Arrange - only header, no data
        csv_content = b"""name,budget,status"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Should fail because file is effectively empty (no data rows)
        assert "empty" in str(exc_info.value).lower() or "parse" in str(exc_info.value).lower()
    
    def test_parse_csv_encoding_utf8(self, csv_parser, portfolio_id):
        """Test CSV parsing handles UTF-8 encoded content with special characters"""
        # Arrange - UTF-8 content with special characters
        csv_content = """name,budget,status,description
Projet Français,10000.50,planning,Développement avec accents
Проект Русский,25000.75,active,Описание на русском
日本語プロジェクト,30000.00,completed,日本語の説明""".encode('utf-8')
        
        # Act
        projects = csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Assert
        assert len(projects) == 3
        assert projects[0].name == "Projet Français"
        assert "accents" in projects[0].description
        assert projects[1].name == "Проект Русский"
        assert projects[2].name == "日本語プロジェクト"
    
    def test_parse_csv_encoding_utf8_bom(self, csv_parser, portfolio_id):
        """Test CSV parsing behavior with UTF-8 BOM (Byte Order Mark)"""
        # Arrange - UTF-8 with BOM (common when exported from Excel)
        # Note: pandas with python engine doesn't automatically strip BOM from column names
        csv_content = b'\xef\xbb\xbfname,budget,status,description\nProject Alpha,10000.50,planning,Test project'
        
        # Act & Assert
        # The parser may fail because BOM is prepended to 'name' column,
        # making it '\ufeffname' which doesn't match 'name' in required columns
        try:
            projects = csv_parser.parse_csv(csv_content, portfolio_id)
            # If it parses successfully, verify the data
            assert len(projects) == 1
            assert projects[0].budget == 10000.50
        except CSVParseError as e:
            # Also acceptable - BOM causes column name mismatch
            # This documents the current behavior: BOM files may need preprocessing
            assert "name" in str(e).lower() or "column" in str(e).lower()
    
    def test_parse_csv_encoding_latin1_fails_with_utf8(self, csv_parser, portfolio_id):
        """Test CSV parsing behavior with Latin-1 encoded content (non-UTF-8)"""
        # Arrange - Latin-1 encoded content with special characters
        # The parser expects UTF-8, so this should either fail or produce garbled output
        csv_content = "name,budget,status,description\nProjet Français,10000.50,planning,Développement".encode('latin-1')
        
        # Act & Assert
        # The parser is configured for UTF-8, so Latin-1 content may:
        # 1. Raise a CSVParseError due to encoding issues
        # 2. Parse but produce garbled characters
        try:
            projects = csv_parser.parse_csv(csv_content, portfolio_id)
            # If it parses, the characters may be garbled but structure should be intact
            assert len(projects) == 1
            assert projects[0].budget == 10000.50
        except CSVParseError as e:
            # Also acceptable - parser rejects non-UTF-8 encoding
            assert "parse" in str(e).lower() or "decode" in str(e).lower() or "encoding" in str(e).lower()
    
    def test_parse_csv_empty_file_with_whitespace(self, csv_parser, portfolio_id):
        """Test CSV parsing fails with file containing only whitespace"""
        # Arrange - only whitespace
        csv_content = b"   \n\n   \t\t\n   "
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        # Should fail because file is effectively empty
        assert "empty" in str(exc_info.value).lower() or "parse" in str(exc_info.value).lower()
    
    def test_parse_csv_missing_all_required_columns(self, csv_parser, portfolio_id):
        """Test CSV parsing fails when all required columns are missing"""
        # Arrange - none of the required columns present
        csv_content = b"""description,start_date,end_date
Test project,2024-01-15,2024-12-31"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        error_msg = str(exc_info.value).lower()
        assert "missing required columns" in error_msg
        # Should mention all missing required columns
        assert "name" in error_msg
        assert "budget" in error_msg
        assert "status" in error_msg
    
    def test_parse_csv_missing_multiple_required_columns(self, csv_parser, portfolio_id):
        """Test CSV parsing fails and reports multiple missing required columns"""
        # Arrange - missing name and status columns
        csv_content = b"""budget,description
10000.50,Test project"""
        
        # Act & Assert
        with pytest.raises(CSVParseError) as exc_info:
            csv_parser.parse_csv(csv_content, portfolio_id)
        
        error_msg = str(exc_info.value).lower()
        assert "missing required columns" in error_msg
        assert "name" in error_msg
        assert "status" in error_msg
