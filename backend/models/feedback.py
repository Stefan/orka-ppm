"""
Feedback system Pydantic models
"""

from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from .base import BaseResponse

class FeatureRequestCreate(BaseModel):
    title: str
    description: str
    priority: str = "medium"  # low, medium, high, critical
    tags: List[str] = []

class FeatureRequestResponse(BaseResponse):
    title: str
    description: str
    priority: str
    tags: List[str]
    status: str  # pending, in_progress, completed, rejected
    votes_count: int
    comments_count: int
    submitted_by: str
    assigned_to: Optional[str]
    estimated_effort: Optional[str]
    completed_at: Optional[datetime]

class FeatureVoteCreate(BaseModel):
    vote_type: str  # 'upvote' or 'downvote'

class FeatureCommentCreate(BaseModel):
    content: str

class FeatureCommentResponse(BaseResponse):
    feature_id: str
    content: str
    author_id: str

class BugReportCreate(BaseModel):
    title: str
    description: str
    severity: str = "medium"  # low, medium, high, critical
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    browser_info: Optional[str] = None
    category: str = "functionality"

class BugReportResponse(BaseResponse):
    title: str
    description: str
    severity: str
    steps_to_reproduce: Optional[str]
    expected_behavior: Optional[str]
    actual_behavior: Optional[str]
    browser_info: Optional[str]
    category: str
    status: str  # open, in_progress, resolved, closed
    priority: str
    submitted_by: str
    assigned_to: Optional[str]
    resolution: Optional[str]
    resolved_at: Optional[datetime]

class FeedbackStatsResponse(BaseModel):
    total_features: int
    pending_features: int
    in_progress_features: int
    completed_features: int
    total_bugs: int
    open_bugs: int
    resolved_bugs: int
    critical_bugs: int
    avg_resolution_time_days: Optional[float]
    user_satisfaction_score: Optional[float]

class NotificationCreate(BaseModel):
    user_id: UUID
    title: str
    message: str
    type: str = "info"  # info, warning, error, success
    action_url: Optional[str] = None

class NotificationResponse(BaseResponse):
    user_id: str
    title: str
    message: str
    type: str
    action_url: Optional[str]
    is_read: bool
    read_at: Optional[datetime]