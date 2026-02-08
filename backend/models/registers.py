"""
Unified Registers (Register-Arten) Pydantic models.
Types: risk, change, cost, issue, benefits, lessons_learned, decision, opportunities.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

REGISTER_TYPES = (
    "risk", "change", "cost", "issue", "benefits",
    "lessons_learned", "decision", "opportunities"
)


class RegisterCreate(BaseModel):
    """Create a register entry. type is set by path."""
    project_id: Optional[UUID] = None
    data: Dict[str, Any] = Field(default_factory=dict, description="Type-specific fields")
    status: str = "open"


class RegisterUpdate(BaseModel):
    """Update a register entry (partial)."""
    project_id: Optional[UUID] = None
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class RegisterResponse(BaseModel):
    """Single register entry response."""
    id: UUID
    type: str
    project_id: Optional[UUID] = None
    organization_id: UUID
    data: Dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegisterListResponse(BaseModel):
    """Paginated list of register entries."""
    items: list[RegisterResponse]
    total: int
    limit: int
    offset: int


class AIRecommendRequest(BaseModel):
    """Optional context for AI recommendations."""
    project_id: Optional[UUID] = None
    context: Optional[Dict[str, Any]] = None


class AIRecommendResponse(BaseModel):
    """AI-generated recommendation (data snippet + optional explanation)."""
    data: Dict[str, Any] = Field(default_factory=dict)
    explanation: Optional[str] = None
