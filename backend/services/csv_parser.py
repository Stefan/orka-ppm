"""
CSV Parser Service for Project Import MVP

This service parses CSV files into project records using pandas.
Handles column mapping, validation, and type conversion.
"""

import pandas as pd
from typing import List, Dict, Any, Optional
from io import BytesIO
from uuid import UUID
from datetime import date
from models.projects import ProjectCreate
from models.base import ProjectStatus


class CSVParseError(Exception):
    """Exception raised for CSV parsing errors"""
    pass


class CSVParser:
    """
    Service for parsing CSV files into project records.
    
    Supports:
    - Header row with column name mapping
    - Multiple delimiters (comma, semicolon)
    - Quoted fields with embedded commas/newlines
    - Type conversion for dates and numbers
    """
    
    # Map CSV column names to ProjectCreate fields
    COLUMN_MAPPING = {
        "name": "name",
        "budget": "budget",
        "status": "status",
        "start_date": "start_date",
        "end_date": "end_date",
        "description": "description",
        "portfolio_id": "portfolio_id",
        "priority": "priority",
        "manager_id": "manager_id"
    }
    
    # Required columns that must be present in CSV
    REQUIRED_COLUMNS = ["name", "budget", "status"]
    
    def parse_csv(
        self,
        file_content: bytes,
        portfolio_id: Optional[UUID] = None
    ) -> List[ProjectCreate]:
        """
        Parse CSV file into list of ProjectCreate objects.

        Process:
        1. Read CSV with pandas (auto-detect delimiter)
        2. Validate header columns
        3. Map columns to project fields
        4. Convert each row to ProjectCreate
        5. Return list of projects

        Args:
            file_content: Raw CSV file bytes
            portfolio_id: Optional portfolio ID to assign to all imported projects; None = no portfolio

        Returns:
            List of ProjectCreate objects

        Raises:
            CSVParseError: If CSV cannot be parsed or has invalid structure
        """
        try:
            # Try to read CSV with pandas, auto-detecting delimiter
            # Support both comma and semicolon delimiters
            df = pd.read_csv(
                BytesIO(file_content),
                sep=None,  # Auto-detect delimiter
                engine='python',  # Required for auto-detection
                encoding='utf-8',
                quotechar='"',  # Handle quoted fields
                skipinitialspace=True  # Trim whitespace
            )
        except Exception as e:
            raise CSVParseError(f"Failed to parse CSV file: {str(e)}")
        
        # Check if DataFrame is empty
        if df.empty:
            raise CSVParseError("CSV file is empty")
        
        # Validate required columns are present
        self._validate_columns(df)
        
        # Convert each row to ProjectCreate object
        projects = []
        for index, row in df.iterrows():
            try:
                project = self._row_to_project(row, index, portfolio_id)
                projects.append(project)
            except Exception as e:
                raise CSVParseError(
                    f"Failed to parse row {int(index) + 1}: {str(e)}"
                )
        
        return projects
    
    def _validate_columns(
        self, 
        df: pd.DataFrame
    ) -> None:
        """
        Validate CSV has required columns.
        
        Args:
            df: Pandas DataFrame from CSV
            
        Raises:
            CSVParseError: If missing required columns
        """
        # Get column names (case-insensitive)
        csv_columns = [col.lower().strip() for col in df.columns]
        
        # Check each required column
        missing_columns = []
        for required_col in self.REQUIRED_COLUMNS:
            if required_col.lower() not in csv_columns:
                missing_columns.append(required_col)
        
        if missing_columns:
            raise CSVParseError(
                f"Missing required columns: {', '.join(missing_columns)}. "
                f"Expected columns: {', '.join(self.REQUIRED_COLUMNS)}"
            )
    
    def _row_to_project(
        self,
        row: pd.Series,
        index: int,
        portfolio_id: Optional[UUID] = None
    ) -> ProjectCreate:
        """
        Convert DataFrame row to ProjectCreate object.

        Args:
            row: Pandas Series representing one CSV row
            index: Row index for error reporting
            portfolio_id: Optional portfolio ID to assign to project; None = no portfolio

        Returns:
            ProjectCreate object

        Raises:
            CSVParseError: If row cannot be converted
        """
        try:
            # Normalize column names to lowercase for case-insensitive matching
            row_dict = {k.lower().strip(): v for k, v in row.items()}
            
            # Extract required fields
            name = self._get_field(row_dict, "name", required=True)
            budget = self._get_field(row_dict, "budget", required=True)
            status = self._get_field(row_dict, "status", required=True)
            
            # Extract optional fields
            description = self._get_field(row_dict, "description", required=False)
            start_date_str = self._get_field(row_dict, "start_date", required=False)
            end_date_str = self._get_field(row_dict, "end_date", required=False)
            priority = self._get_field(row_dict, "priority", required=False)
            manager_id_str = self._get_field(row_dict, "manager_id", required=False)
            
            # Convert budget to float
            try:
                budget_float = float(budget) if budget is not None else None
            except (ValueError, TypeError):
                raise CSVParseError(f"Invalid budget value: {budget}")
            
            # Convert dates to date objects
            start_date = self._parse_date(start_date_str) if start_date_str else None
            end_date = self._parse_date(end_date_str) if end_date_str else None
            
            # Convert status to ProjectStatus enum
            try:
                status_enum = ProjectStatus(status) if status else ProjectStatus.planning
            except ValueError:
                # If status is invalid, let validation service handle it
                # Just pass the string value
                status_enum = status
            
            # Convert manager_id to UUID if provided
            manager_id = None
            if manager_id_str and not pd.isna(manager_id_str):
                try:
                    manager_id = UUID(str(manager_id_str))
                except ValueError:
                    raise CSVParseError(f"Invalid manager_id UUID: {manager_id_str}")
            
            # Create ProjectCreate object (portfolio_id optional)
            return ProjectCreate(
                portfolio_id=portfolio_id,
                name=name,
                budget=budget_float,
                status=status_enum,
                description=description,
                start_date=start_date,
                end_date=end_date,
                priority=priority,
                manager_id=manager_id,
                team_members=[]  # CSV doesn't support team members in MVP
            )
            
        except CSVParseError:
            # Re-raise CSVParseError as-is
            raise
        except Exception as e:
            raise CSVParseError(f"Failed to convert row to project: {str(e)}")
    
    def _get_field(
        self,
        row_dict: Dict[str, Any],
        field_name: str,
        required: bool = False
    ) -> Any:
        """
        Get field value from row dictionary.
        
        Args:
            row_dict: Dictionary of row values with lowercase keys
            field_name: Field name to retrieve
            required: Whether field is required
            
        Returns:
            Field value or None if not present
            
        Raises:
            CSVParseError: If required field is missing
        """
        value = row_dict.get(field_name.lower())
        
        # Check if value is NaN (pandas uses NaN for missing values)
        if pd.isna(value):
            if required:
                raise CSVParseError(f"Required field '{field_name}' is missing")
            return None
        
        # Convert to string and strip whitespace
        if isinstance(value, str):
            value = value.strip()
            # Treat empty strings as None
            if not value:
                if required:
                    raise CSVParseError(f"Required field '{field_name}' is empty")
                return None
        
        return value
    
    def _parse_date(
        self,
        date_str: str
    ) -> date:
        """
        Parse date string to date object.
        
        Args:
            date_str: Date string in ISO format (YYYY-MM-DD)
            
        Returns:
            date object
            
        Raises:
            CSVParseError: If date cannot be parsed
        """
        try:
            # Try to parse as ISO format
            parsed = pd.to_datetime(date_str, format='ISO8601')
            return parsed.date()
        except Exception:
            raise CSVParseError(
                f"Invalid date format: {date_str}. Expected ISO 8601 format (YYYY-MM-DD)"
            )
