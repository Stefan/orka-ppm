"""
Validation Service for Project Import MVP

This service validates project data against business rules before import.
Validates required fields, data types, duplicates, and business constraints.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from models.projects import ProjectCreate
from models.base import ProjectStatus
from supabase import Client


class ValidationService:
    """
    Service for validating project data against business rules.
    
    Validation rules:
    - Required fields must be present and non-empty
    - Budget must be numeric
    - Dates must be ISO 8601 format
    - Status must be in allowed values
    - Name must not duplicate existing project
    """
    
    REQUIRED_FIELDS = ["name", "budget", "status"]
    VALID_STATUSES = [status.value for status in ProjectStatus]
    
    def __init__(self, db_client: Client):
        """
        Initialize validation service.
        
        Args:
            db_client: Supabase client for database queries
        """
        self.db = db_client
    
    def validate_project(
        self, 
        project: ProjectCreate, 
        index: int
    ) -> Optional[Dict[str, Any]]:
        """
        Validate a single project record.
        
        Validation rules:
        - Required fields must be present and non-empty
        - Budget must be numeric
        - Dates must be ISO 8601 format
        - Status must be in allowed values
        - Name must not duplicate existing project
        
        Args:
            project: Project data to validate
            index: Record index for error reporting
            
        Returns:
            Error dict if validation fails, None if valid
            Error format: {
                "index": int,
                "field": str,
                "value": Any,
                "error": str
            }
        """
        # Check required fields
        required_error = self._check_required_fields(project)
        if required_error:
            return {
                "index": index,
                "field": required_error,
                "value": getattr(project, required_error, None),
                "error": f"Required field '{required_error}' is missing or empty"
            }
        
        # Validate budget
        if not self._validate_budget(project.budget):
            return {
                "index": index,
                "field": "budget",
                "value": project.budget,
                "error": "Budget must be a numeric value"
            }
        
        # Validate status
        if not self._validate_status(project.status):
            return {
                "index": index,
                "field": "status",
                "value": project.status,
                "error": f"Status must be one of: {', '.join(self.VALID_STATUSES)}"
            }
        
        # Validate start_date if provided
        if project.start_date is not None:
            if not self._validate_date(str(project.start_date)):
                return {
                    "index": index,
                    "field": "start_date",
                    "value": project.start_date,
                    "error": "Date must be in ISO 8601 format (YYYY-MM-DD)"
                }
        
        # Validate end_date if provided
        if project.end_date is not None:
            if not self._validate_date(str(project.end_date)):
                return {
                    "index": index,
                    "field": "end_date",
                    "value": project.end_date,
                    "error": "Date must be in ISO 8601 format (YYYY-MM-DD)"
                }
        
        # Check for duplicate name
        if self._check_duplicate_name(project.name):
            return {
                "index": index,
                "field": "name",
                "value": project.name,
                "error": f"Project with name '{project.name}' already exists"
            }
        
        # All validations passed
        return None
    
    def _check_required_fields(
        self, 
        project: ProjectCreate
    ) -> Optional[str]:
        """
        Check all required fields are present and non-empty.
        
        Args:
            project: Project data to validate
            
        Returns:
            Name of first missing/empty required field, or None if all present
        """
        for field in self.REQUIRED_FIELDS:
            value = getattr(project, field, None)
            
            # Check if field is None
            if value is None:
                return field
            
            # Check if string field is empty or whitespace-only
            if isinstance(value, str) and not value.strip():
                return field
        
        return None
    
    def _check_duplicate_name(
        self, 
        name: str
    ) -> bool:
        """
        Check if project name already exists in database.
        
        Args:
            name: Project name to check
            
        Returns:
            True if duplicate exists, False otherwise
        """
        try:
            # Query database for existing project with same name
            response = self.db.table("projects").select("id").eq("name", name).execute()
            
            # If any results returned, name is duplicate
            return len(response.data) > 0
        except Exception as e:
            # If database query fails, log error but don't fail validation
            # This allows import to proceed even if duplicate check fails
            print(f"Warning: Duplicate name check failed: {e}")
            return False
    
    def _validate_budget(
        self, 
        budget: Any
    ) -> bool:
        """
        Validate budget is numeric.
        
        Args:
            budget: Budget value to validate
            
        Returns:
            True if valid numeric value, False otherwise
        """
        import math
        
        if budget is None:
            return False
        
        # Check if already a number
        if isinstance(budget, (int, float)):
            # Reject NaN and infinity values
            if isinstance(budget, float) and (math.isnan(budget) or math.isinf(budget)):
                return False
            return True
        
        # Try to convert string to float
        if isinstance(budget, str):
            try:
                parsed = float(budget)
                # Reject NaN and infinity values
                if math.isnan(parsed) or math.isinf(parsed):
                    return False
                return True
            except ValueError:
                return False
        
        return False
    
    def _validate_date(
        self, 
        date_str: str
    ) -> bool:
        """
        Validate date is ISO 8601 extended format (YYYY-MM-DD).
        
        Args:
            date_str: Date string to validate
            
        Returns:
            True if valid ISO 8601 extended format (YYYY-MM-DD), False otherwise
        """
        import re
        
        if not date_str:
            return False
        
        date_string = str(date_str)
        
        # First check the format matches YYYY-MM-DD pattern
        # This ensures we only accept the extended format, not basic format (YYYYMMDD)
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_string):
            return False
        
        try:
            # Then verify it's a valid date (e.g., not 2024-13-45)
            datetime.fromisoformat(date_string)
            return True
        except (ValueError, TypeError):
            return False
    
    def _validate_status(
        self, 
        status: str
    ) -> bool:
        """
        Validate status is in allowed values.
        
        Args:
            status: Status value to validate
            
        Returns:
            True if valid status, False otherwise
        """
        if not status:
            return False
        
        # Check if status is in valid statuses list
        return status in self.VALID_STATUSES
