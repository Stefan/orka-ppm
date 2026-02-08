"""
Saved Views model – No-Code-Views (Cora-Surpass Phase 2.3).
View definition: filters, sort, visible columns per scope (financials, projects, etc.).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SavedViewDefinition(BaseModel):
    """JSON definition stored in saved_views.definition."""
    filters: Dict[str, Any] = Field(default_factory=dict, description="Filter key-value or query")
    sortBy: Optional[str] = Field(None, description="Column/key to sort by")
    sortOrder: Optional[str] = Field("asc", description="asc | desc")
    visibleColumns: Optional[List[str]] = Field(None, description="Column IDs to show")
    pageSize: Optional[int] = Field(None, ge=1, le=500)


class SavedViewCreate(BaseModel):
    """Payload to create a saved view."""
    name: str = Field(..., min_length=1, max_length=255)
    scope: str = Field(default="financials", min_length=1, max_length=64)
    definition: Dict[str, Any] = Field(default_factory=dict)


class SavedViewUpdate(BaseModel):
    """Payload to update a saved view."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    definition: Optional[Dict[str, Any]] = None


class SavedViewResponse(BaseModel):
    """Saved view as returned by API."""
    id: UUID
    user_id: UUID
    organization_id: Optional[UUID]
    name: str
    scope: str
    definition: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
