"""
User management Pydantic models
"""

from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from enum import Enum

from .base import BaseResponse

class UserRole(str, Enum):
    admin = "admin"
    portfolio_manager = "portfolio_manager"
    project_manager = "project_manager"
    resource_manager = "resource_manager"
    team_member = "team_member"
    viewer = "viewer"

class UserStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    deactivated = "deactivated"

class UserCreateRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.team_member
    send_invite: bool = True
    
    @validator('email')
    def email_must_be_lowercase(cls, v):
        return v.lower()

class UserInviteRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.team_member
    
    @validator('email')
    def email_must_be_lowercase(cls, v):
        return v.lower()

class UserUpdateRequest(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    deactivation_reason: Optional[str] = None
    
    @validator('deactivation_reason')
    def validate_deactivation_reason(cls, v, values):
        if values.get('is_active') is False and not v:
            raise ValueError('Deactivation reason is required when deactivating user')
        return v

class UserResponse(BaseResponse):
    email: str
    role: str
    roles: Optional[List[str]] = None  # From user_roles table; preferred over role for display
    status: str
    is_active: bool
    last_login: Optional[str]
    deactivated_at: Optional[str]
    deactivated_by: Optional[str]
    deactivation_reason: Optional[str]
    sso_provider: Optional[str]

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total_count: int
    page: int
    per_page: int
    total_pages: int

class UserActivityLogCreate(BaseModel):
    user_id: UUID
    action: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class UserActivityLogResponse(BaseResponse):
    user_id: str
    action: str
    details: Optional[dict]
    ip_address: Optional[str]
    user_agent: Optional[str]

class UserDeactivationRequest(BaseModel):
    reason: str
    notify_user: bool = True

class UserRoleAssignment(BaseModel):
    user_id: UUID
    role_id: UUID

class UserRoleResponse(BaseResponse):
    user_id: str
    role_id: str
    role_name: str
    assigned_by: str
    assigned_at: datetime