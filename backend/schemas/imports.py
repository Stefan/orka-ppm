"""
Pydantic schemas for Bulk Import API endpoints
"""

from pydantic import BaseModel, Field
from typing import List, Any, Optional


class ImportRequest(BaseModel):
    """Request model for bulk import"""
    entity_type: str = Field(
        ...,
        pattern="^(projects|resources|financials)$",
        description="Type of entity to import: projects, resources, or financials"
    )


class ImportError(BaseModel):
    """Individual import validation error"""
    line_number: int = Field(..., description="Line number in the file where error occurred")
    field: str = Field(..., description="Field name that failed validation")
    message: str = Field(..., description="Error message describing the issue")
    value: Any = Field(None, description="The invalid value that caused the error")


class ImportResponse(BaseModel):
    """Response model for bulk import"""
    success_count: int = Field(..., ge=0, description="Number of successfully imported records")
    error_count: int = Field(..., ge=0, description="Number of records that failed validation")
    errors: List[ImportError] = Field(default_factory=list, description="List of validation errors")
    processing_time_seconds: float = Field(..., ge=0, description="Time taken to process the import")
