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

class AnalysisLevel(str, Enum):
    """Analysis level for variance and performance analysis"""
    project = "project"
    phase = "phase"
    work_package = "work_package"
    activity = "activity"

class AlertSeverity(str, Enum):
    """Alert severity levels for project controls"""
    info = "info"
    warning = "warning"
    critical = "critical"
    urgent = "urgent"

class ApprovalStatus(str, Enum):
    """Approval status for calculations and forecasts"""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    under_review = "under_review"

class ContentType(str, Enum):
    """Content types for PMR and help systems"""
    guide = "guide"
    faq = "faq"
    tutorial = "tutorial"
    feature_doc = "feature_doc"
    help_content = "help_content"
    walkthrough = "walkthrough"

class LanguageCode(str, Enum):
    """Supported language codes"""
    en = "en"
    de = "de"
    fr = "fr"
    es = "es"
    it = "it"

class BaseResponse(BaseModel):
    """Base response model with common fields"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True