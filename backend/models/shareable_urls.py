"""
Shareable Project URLs Pydantic models
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum

from .base import BaseResponse


class SharePermissionLevel(str, Enum):
    """Permission levels for share links"""
    VIEW_ONLY = "view_only"
    LIMITED_DATA = "limited_data"
    FULL_PROJECT = "full_project"


class ShareLinkCreate(BaseModel):
    """Request model for creating a share link"""
    project_id: UUID
    permission_level: SharePermissionLevel = SharePermissionLevel.VIEW_ONLY
    expiry_duration_days: int = Field(ge=1, le=365, description="Expiration duration in days (1-365)")
    custom_message: Optional[str] = Field(None, max_length=500, description="Optional custom message for recipients")
    
    @validator('custom_message')
    def validate_custom_message(cls, v):
        if v is not None and len(v.strip()) == 0:
            return None
        return v


class ShareLinkUpdate(BaseModel):
    """Request model for updating a share link"""
    permission_level: Optional[SharePermissionLevel] = None
    expires_at: Optional[datetime] = None
    custom_message: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ShareLinkRevoke(BaseModel):
    """Request model for revoking a share link"""
    revocation_reason: str = Field(..., min_length=1, max_length=500, description="Reason for revoking the share link")


class ShareLinkResponse(BaseResponse):
    """Response model for share link"""
    project_id: str
    token: str
    share_url: str
    permission_level: str
    expires_at: datetime
    is_active: bool
    custom_message: Optional[str]
    access_count: int
    last_accessed_at: Optional[datetime]
    last_accessed_ip: Optional[str]
    revoked_at: Optional[datetime]
    revoked_by: Optional[str]
    revocation_reason: Optional[str]
    created_by: str
    
    class Config:
        from_attributes = True


class ShareLinkListResponse(BaseModel):
    """Response model for list of share links"""
    share_links: List[ShareLinkResponse]
    total: int
    active_count: int
    expired_count: int


class FilteredProjectData(BaseModel):
    """Filtered project data based on permission level"""
    id: str
    name: str
    description: Optional[str]
    status: str
    progress_percentage: Optional[float]
    start_date: Optional[date]
    end_date: Optional[date]
    
    # Conditional fields based on permission level
    milestones: Optional[List[Dict[str, Any]]] = None
    team_members: Optional[List[Dict[str, Any]]] = None
    documents: Optional[List[Dict[str, Any]]] = None
    timeline: Optional[Dict[str, Any]] = None
    tasks: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class ShareAccessLog(BaseModel):
    """Model for share access log entry"""
    id: str
    share_id: str
    accessed_at: datetime
    ip_address: str
    user_agent: Optional[str]
    country_code: Optional[str]
    city: Optional[str]
    accessed_sections: List[str] = []
    session_duration: Optional[int]
    is_suspicious: bool
    suspicious_reasons: List[Dict[str, str]] = []
    
    class Config:
        from_attributes = True


class ShareAnalytics(BaseModel):
    """Analytics data for a share link"""
    total_accesses: int
    unique_visitors: int
    unique_countries: int
    access_by_day: List[Dict[str, Any]]
    geographic_distribution: List[Dict[str, Any]]
    most_viewed_sections: List[Dict[str, Any]]
    average_session_duration: Optional[float]
    suspicious_activity_count: int


class ShareAnalyticsRequest(BaseModel):
    """Request model for share analytics"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ShareLinkValidation(BaseModel):
    """Response model for share link validation"""
    is_valid: bool
    share_id: Optional[str]
    project_id: Optional[str]
    permission_level: Optional[str]
    error_message: Optional[str]


class GuestAccessRequest(BaseModel):
    """Request model for guest access logging"""
    accessed_sections: List[str] = []
    session_duration: Optional[int] = None


class SuspiciousAccessAlert(BaseModel):
    """Model for suspicious access alerts"""
    share_id: str
    project_id: str
    project_name: str
    accessed_at: datetime
    ip_address: str
    country_code: Optional[str]
    suspicious_reasons: List[Dict[str, str]]
    creator_email: str


class ShareLinkExtend(BaseModel):
    """Request model for extending share link expiration"""
    additional_days: int = Field(ge=1, le=365, description="Number of days to extend (1-365)")


class BulkShareLinkOperation(BaseModel):
    """Request model for bulk operations on share links"""
    share_ids: List[UUID] = Field(..., min_items=1, max_items=50, description="List of share link IDs (1-50)")
    operation: str = Field(..., description="Operation to perform: 'revoke', 'extend', 'deactivate'")
    operation_params: Optional[Dict[str, Any]] = Field(None, description="Additional parameters for the operation")


class BulkOperationResult(BaseModel):
    """Response model for bulk operations"""
    successful: List[str]
    failed: List[Dict[str, str]]
    total_processed: int
    success_count: int
    failure_count: int


class ShareLinkEmailTemplate(BaseModel):
    """Model for share link email template data"""
    recipient_email: str
    recipient_name: Optional[str]
    project_name: str
    share_url: str
    permission_level: str
    expires_at: datetime
    custom_message: Optional[str]
    sender_name: str


class ShareLinkNotification(BaseModel):
    """Model for share link notifications"""
    notification_type: str  # 'first_access', 'expiry_warning', 'suspicious_activity', 'revoked'
    share_id: str
    project_id: str
    project_name: str
    details: Dict[str, Any]
    created_at: datetime


class ShareLinkStats(BaseModel):
    """Statistics for share links across projects"""
    total_share_links: int
    active_share_links: int
    expired_share_links: int
    revoked_share_links: int
    total_accesses: int
    unique_visitors: int
    suspicious_accesses: int
    by_permission_level: Dict[str, int]
    by_project: List[Dict[str, Any]]


class RateLimitInfo(BaseModel):
    """Rate limit information for share link access"""
    ip_address: str
    requests_count: int
    window_start: datetime
    window_end: datetime
    is_limited: bool
    retry_after: Optional[int] = None  # seconds
