"""
Pydantic schemas for Feature Toggle System API.
Design: .kiro/specs/feature-toggle-system/design.md
"""

import re
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class FeatureToggleCreate(BaseModel):
    """Create feature toggle request."""
    name: str = Field(..., min_length=1, max_length=100)
    enabled: bool = False
    organization_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Name must contain only alphanumeric, underscore, hyphen")
        return v


class FeatureToggleUpdate(BaseModel):
    """Update feature toggle request (name cannot be changed)."""
    enabled: Optional[bool] = None
    organization_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)


class FeatureToggleResponse(BaseModel):
    """Feature toggle API response."""
    id: str
    name: str
    enabled: bool
    organization_id: Optional[str]
    description: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
