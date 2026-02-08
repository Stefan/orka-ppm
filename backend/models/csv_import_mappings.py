"""
CSV import mapping rules (Cora-Surpass Phase 2.2).
Stored mappings: name + import_type + list of { source_header, target_field }.
"""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MappingEntry(BaseModel):
    """Single column mapping."""
    source_header: str
    target_field: str


class CsvImportMappingCreate(BaseModel):
    """Payload to save a mapping."""
    name: str = Field(..., min_length=1, max_length=255)
    import_type: str = Field(..., pattern="^(commitments|actuals)$")
    mapping: List[dict] = Field(default_factory=list)  # [{ source_header, target_field }]


class CsvImportMappingResponse(BaseModel):
    """Saved mapping as returned by API."""
    id: UUID
    organization_id: Optional[UUID]
    user_id: UUID
    name: str
    import_type: str
    mapping: List[dict]
    created_at: datetime

    class Config:
        from_attributes = True
