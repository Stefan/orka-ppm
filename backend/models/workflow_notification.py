"""
Workflow Notification Models

Models for workflow notification tracking and history.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID
from enum import Enum


class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    IN_APP = "in_app"
    EMAIL = "email"


class NotificationStatus(str, Enum):
    """Notification delivery status"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"


class WorkflowNotification(BaseModel):
    """Workflow notification model"""
    id: Optional[UUID] = Field(None, description="Notification ID")
    workflow_instance_id: UUID = Field(..., description="Workflow instance ID")
    user_id: UUID = Field(..., description="Recipient user ID")
    event_type: str = Field(..., description="Type of notification event")
    channel: NotificationChannel = Field(..., description="Delivery channel")
    title: str = Field(..., max_length=255, description="Notification title")
    message: str = Field(..., description="Notification message")
    priority: str = Field(default="normal", description="Notification priority")
    data: Dict[str, Any] = Field(default_factory=dict, description="Additional notification data")
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, description="Delivery status")
    sent_at: Optional[datetime] = Field(None, description="Sent timestamp")
    delivered_at: Optional[datetime] = Field(None, description="Delivered timestamp")
    read_at: Optional[datetime] = Field(None, description="Read timestamp")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "workflow_instance_id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "123e4567-e89b-12d3-a456-426614174001",
                "event_type": "approval_requested",
                "channel": "in_app",
                "title": "Approval Required: Budget Approval Workflow",
                "message": "You have been requested to approve a workflow",
                "priority": "normal",
                "status": "pending"
            }
        }


class NotificationPreferences(BaseModel):
    """User notification preferences model"""
    user_id: UUID = Field(..., description="User ID")
    in_app_notifications: bool = Field(default=True, description="Enable in-app notifications")
    email_notifications: bool = Field(default=True, description="Enable email notifications")
    workflow_notifications: bool = Field(default=True, description="Enable workflow notifications")
    reminder_notifications: bool = Field(default=True, description="Enable reminder notifications")
    sms_notifications: bool = Field(default=False, description="Enable SMS notifications")
    notification_types: List[str] = Field(default_factory=list, description="Enabled notification types")
    escalation_enabled: bool = Field(default=True, description="Enable escalation")
    reminder_frequency_hours: int = Field(default=24, ge=0, description="Reminder frequency in hours")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True,
                "reminder_notifications": True
            }
        }
