"""
Base Pydantic models and common enums
"""

from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from uuid import UUID
from typing import Optional

class HealthIndicator(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"

class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    on_hold = "on-hold"
    completed = "completed"
    cancelled = "cancelled"

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class BaseResponse(BaseModel):
    """Base response model with common fields"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True