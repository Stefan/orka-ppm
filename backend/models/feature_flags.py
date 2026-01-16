"""
Feature flag models for Roche Construction PPM Features
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class FeatureFlagStatus(str, Enum):
    """Feature flag status"""
    ENABLED = "enabled"
    DISABLED = "disabled"
    BETA = "beta"
    DEPRECATED = "deprecated"


class RolloutStrategy(str, Enum):
    """Feature rollout strategy"""
    ALL_USERS = "all_users"
    PERCENTAGE = "percentage"
    USER_LIST = "user_list"
    ROLE_BASED = "role_based"


class FeatureFlagCreate(BaseModel):
    """Create feature flag request"""
    name: str = Field(..., description="Unique feature flag name")
    description: str = Field(..., description="Feature description")
    status: FeatureFlagStatus = Field(default=FeatureFlagStatus.DISABLED)
    rollout_strategy: RolloutStrategy = Field(default=RolloutStrategy.ALL_USERS)
    rollout_percentage: Optional[int] = Field(default=None, ge=0, le=100)
    allowed_user_ids: Optional[List[UUID]] = Field(default=None)
    allowed_roles: Optional[List[str]] = Field(default=None)
    metadata: Optional[Dict[str, Any]] = Field(default=None)


class FeatureFlagUpdate(BaseModel):
    """Update feature flag request"""
    description: Optional[str] = None
    status: Optional[FeatureFlagStatus] = None
    rollout_strategy: Optional[RolloutStrategy] = None
    rollout_percentage: Optional[int] = Field(default=None, ge=0, le=100)
    allowed_user_ids: Optional[List[UUID]] = None
    allowed_roles: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class FeatureFlagResponse(BaseModel):
    """Feature flag response"""
    id: UUID
    name: str
    description: str
    status: FeatureFlagStatus
    rollout_strategy: RolloutStrategy
    rollout_percentage: Optional[int]
    allowed_user_ids: Optional[List[UUID]]
    allowed_roles: Optional[List[str]]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    created_by: UUID


class FeatureFlagCheck(BaseModel):
    """Feature flag check request"""
    feature_name: str
    user_id: Optional[UUID] = None
    user_roles: Optional[List[str]] = None


class FeatureFlagCheckResponse(BaseModel):
    """Feature flag check response"""
    feature_name: str
    is_enabled: bool
    reason: str
    metadata: Optional[Dict[str, Any]] = None
