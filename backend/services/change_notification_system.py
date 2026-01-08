"""
Change Notification System Service

Handles all notifications and communications for change management including:
- Stakeholder notification logic for different events
- Email template system for change communications
- In-app notification and alert system
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Set
from uuid import UUID, uuid4
from enum import Enum
import logging
import json
from pydantic import BaseModel

from config.database import supabase
from models.change_management import (
    ChangeStatus, ChangeType, PriorityLevel, NotificationPreferences
)

logger = logging.getLogger(__name__)

class NotificationEvent(str, Enum):
    """Types of notification events"""
    CHANGE_CREATED = "change_created"
    CHANGE_SUBMITTED = "change_submitted"
    CHANGE_APPROVED = "change_approved"
    CHANGE_REJECTED = "change_rejected"
    CHANGE_ON_HOLD = "change_on_hold"
    CHANGE_IMPLEMENTING = "change_implementing"
    CHANGE_IMPLEMENTED = "change_implemented"
    CHANGE_CLOSED = "change_closed"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_OVERDUE = "approval_overdue"
    APPROVAL_ESCALATED = "approval_escalated"
    IMPLEMENTATION_STARTED = "implementation_started"
    IMPLEMENTATION_OVERDUE = "implementation_overdue"
    EMERGENCY_CHANGE = "emergency_change"

class StakeholderRole(str, Enum):
    """Types of stakeholders in change process"""
    REQUESTOR = "requestor"
    APPROVER = "approver"
    PROJECT_MANAGER = "project_manager"
    IMPLEMENTATION_TEAM = "implementation_team"
    PROJECT_TEAM = "project_team"
    EXECUTIVE = "executive"
    EMERGENCY_CONTACT = "emergency_contact"

class UrgencyLevel(str, Enum):
    """Urgency levels for notifications"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

class DeliveryMethod(str, Enum):
    """Notification delivery methods"""
    EMAIL = "email"
    IN_APP = "in_app"
    SMS = "sms"
    PUSH = "push"

class NotificationType(str, Enum):
    """Types of change management notifications"""
    CHANGE_CREATED = "change_created"
    CHANGE_SUBMITTED = "change_submitted"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_DECISION = "approval_decision"
    CHANGE_APPROVED = "change_approved"
    CHANGE_REJECTED = "change_rejected"
    IMPLEMENTATION_STARTED = "implementation_started"
    IMPLEMENTATION_COMPLETED = "implementation_completed"
    DEADLINE_REMINDER = "deadline_reminder"
    ESCALATION_ALERT = "escalation_alert"
    EMERGENCY_CHANGE = "emergency_change"
    STATUS_UPDATE = "status_update"

class DeliveryStatus(str, Enum):
    """Notification delivery status"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"

class NotificationResult(BaseModel):
    """Result of notification operation"""
    success: bool
    message: str
    notification_ids: List[str]
    failed_recipients: List[str]

class ReminderResult(BaseModel):
    """Result of reminder operation"""
    reminders_sent: int
    failed_reminders: int
    recipients: List[str]

class EscalationResult(BaseModel):
    """Result of escalation operation"""
    escalations_triggered: int
    escalated_items: List[Dict[str, Any]]
    escalation_recipients: List[str]

class StatusReport(BaseModel):
    """Status report for change management"""
    report_type: str
    project_id: Optional[str]
    generated_at: datetime
    summary: Dict[str, Any]
    details: List[Dict[str, Any]]

class ChangeNotificationSystem:
    """
    Handles all notifications and communications for change management.
    
    Provides:
    - Stakeholder notification logic for different events
    - Email template system for change communications
    - In-app notification and alert system
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        # Email templates for different notification types
        self.email_templates = {
            NotificationEvent.CHANGE_CREATED: {
                "subject": "New Change Request Created: {change_number}",
                "template": "change_created_email.html"
            },
            NotificationEvent.CHANGE_SUBMITTED: {
                "subject": "Change Request Submitted for Review: {change_number}",
                "template": "change_submitted_email.html"
            },
            NotificationEvent.APPROVAL_REQUESTED: {
                "subject": "Approval Required: Change Request {change_number}",
                "template": "approval_requested_email.html"
            },
            NotificationEvent.CHANGE_APPROVED: {
                "subject": "Change Request Approved: {change_number}",
                "template": "change_approved_email.html"
            },
            NotificationEvent.CHANGE_REJECTED: {
                "subject": "Change Request Rejected: {change_number}",
                "template": "change_rejected_email.html"
            },
            NotificationEvent.APPROVAL_OVERDUE: {
                "subject": "OVERDUE: Approval Required for {change_number}",
                "template": "approval_overdue_email.html"
            },
            NotificationEvent.EMERGENCY_CHANGE: {
                "subject": "URGENT: Emergency Change Request {change_number}",
                "template": "emergency_change_email.html"
            }
        }
    
    async def notify_stakeholders(
        self,
        change_id: UUID,
        event_type: NotificationEvent,
        stakeholder_roles: List[StakeholderRole],
        urgency_level: UrgencyLevel = UrgencyLevel.NORMAL,
        custom_message: Optional[str] = None
    ) -> NotificationResult:
        """
        Send notifications to relevant stakeholders for a change event.
        
        Args:
            change_id: ID of the change request
            event_type: Type of notification event
            stakeholder_roles: List of stakeholder roles to notify
            urgency_level: Urgency level for the notification
            custom_message: Optional custom message to include
            
        Returns:
            NotificationResult: Result of notification operation
        """
        try:
            # Get change request details
            change_result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
            if not change_result.data:
                raise ValueError(f"Change request {change_id} not found")
            
            change_data = change_result.data[0]
            
            # Get stakeholders based on roles
            stakeholders = await self._get_stakeholders_by_roles(change_id, stakeholder_roles)
            
            if not stakeholders:
                return NotificationResult(
                    success=True,
                    message="No stakeholders found for specified roles",
                    notification_ids=[],
                    failed_recipients=[]
                )
            
            # Prepare notification content
            notification_content = await self._prepare_notification_content(
                change_data, event_type, custom_message
            )
            
            # Send notifications to each stakeholder
            notification_ids = []
            failed_recipients = []
            
            for stakeholder in stakeholders:
                try:
                    # Get user notification preferences
                    preferences = self.get_notification_preferences(UUID(stakeholder["user_id"]))
                    
                    # Determine delivery methods based on urgency and preferences
                    delivery_methods = self._determine_delivery_methods(urgency_level, preferences)
                    
                    # Send notifications via each method
                    for method in delivery_methods:
                        notification_id = await self._send_notification(
                            recipient_id=UUID(stakeholder["user_id"]),
                            change_id=change_id,
                            event_type=event_type,
                            delivery_method=method,
                            content=notification_content,
                            urgency_level=urgency_level
                        )
                        if notification_id:
                            notification_ids.append(notification_id)
                
                except Exception as e:
                    logger.error(f"Failed to notify stakeholder {stakeholder['user_id']}: {e}")
                    failed_recipients.append(stakeholder["user_id"])
            
            return NotificationResult(
                success=len(failed_recipients) == 0,
                message=f"Sent {len(notification_ids)} notifications to {len(stakeholders)} stakeholders",
                notification_ids=notification_ids,
                failed_recipients=failed_recipients
            )
            
        except Exception as e:
            logger.error(f"Error notifying stakeholders for change {change_id}: {e}")
            raise RuntimeError(f"Failed to notify stakeholders: {str(e)}")
    
    async def notify_change_created(
        self,
        change_request_id: UUID,
        change_data: Dict[str, Any],
        created_by: UUID
    ) -> List[UUID]:
        """
        Send notifications when a new change request is created.
        
        Args:
            change_request_id: ID of the created change request
            change_data: Change request data
            created_by: ID of the user who created the change
            
        Returns:
            List of notification IDs
        """
        try:
            # Determine stakeholders to notify
            stakeholders = await self._get_change_stakeholders(
                change_request_id, 
                change_data,
                NotificationType.CHANGE_CREATED
            )
            
            # Remove the creator from notifications (they already know)
            stakeholders.discard(created_by)
            
            notification_ids = []
            
            for stakeholder_id in stakeholders:
                # Get user preferences
                preferences = await self._get_user_notification_preferences(stakeholder_id)
                
                # Send notifications based on preferences
                if preferences.email_notifications:
                    notification_id = await self._send_email_notification(
                        recipient_id=stakeholder_id,
                        notification_type=NotificationType.CHANGE_CREATED,
                        change_request_id=change_request_id,
                        context_data=change_data
                    )
                    if notification_id:
                        notification_ids.append(notification_id)
                
                if preferences.in_app_notifications:
                    notification_id = await self._send_in_app_notification(
                        recipient_id=stakeholder_id,
                        notification_type=NotificationType.CHANGE_CREATED,
                        change_request_id=change_request_id,
                        context_data=change_data
                    )
                    if notification_id:
                        notification_ids.append(notification_id)
            
            return notification_ids
            
        except Exception as e:
            logger.error(f"Error sending change created notifications: {e}")
            return []
    
    async def send_approval_request(
        self,
        approval_id: UUID,
        approver_id: UUID,
        urgency_level: UrgencyLevel = UrgencyLevel.NORMAL
    ) -> bool:
        """
        Send approval request notification to a specific approver.
        
        Args:
            approval_id: ID of the approval request
            approver_id: ID of the approver
            urgency_level: Urgency level for the request
            
        Returns:
            bool: True if notification sent successfully
        """
        try:
            # Get approval details
            approval_result = self.db.table("change_approvals").select(
                "*, change_requests(*)"
            ).eq("id", str(approval_id)).execute()
            
            if not approval_result.data:
                raise ValueError(f"Approval {approval_id} not found")
            
            approval_data = approval_result.data[0]
            change_data = approval_data["change_requests"]
            
            # Prepare approval-specific content
            content = await self._prepare_approval_notification_content(
                change_data, approval_data, urgency_level
            )
            
            # Send notification
            notification_id = await self._send_notification(
                recipient_id=approver_id,
                change_id=UUID(change_data["id"]),
                event_type=NotificationEvent.APPROVAL_REQUESTED,
                delivery_method=DeliveryMethod.EMAIL,  # Always send email for approvals
                content=content,
                urgency_level=urgency_level
            )
            
            # Also send in-app notification
            await self._send_notification(
                recipient_id=approver_id,
                change_id=UUID(change_data["id"]),
                event_type=NotificationEvent.APPROVAL_REQUESTED,
                delivery_method=DeliveryMethod.IN_APP,
                content=content,
                urgency_level=urgency_level
            )
            
            return notification_id is not None
            
        except Exception as e:
            logger.error(f"Error sending approval request {approval_id}: {e}")
            return False
    
    async def send_deadline_reminders(self) -> List[ReminderResult]:
        """
        Send reminder notifications for approaching deadlines.
        
        Returns:
            List[ReminderResult]: Results of reminder operations
        """
        try:
            results = []
            
            # Get overdue approvals
            overdue_approvals = await self._get_overdue_approvals()
            if overdue_approvals:
                result = await self._send_approval_reminders(overdue_approvals, is_overdue=True)
                results.append(result)
            
            # Get approvals due soon (within 24 hours)
            upcoming_approvals = await self._get_upcoming_approvals(hours=24)
            if upcoming_approvals:
                result = await self._send_approval_reminders(upcoming_approvals, is_overdue=False)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error sending deadline reminders: {e}")
            raise RuntimeError(f"Failed to send deadline reminders: {str(e)}")
    
    async def escalate_overdue_items(self) -> List[EscalationResult]:
        """
        Escalate overdue approvals and implementations.
        
        Returns:
            List[EscalationResult]: Results of escalation operations
        """
        try:
            results = []
            
            # Escalate overdue approvals
            overdue_approvals = await self._get_overdue_approvals(escalation_threshold_hours=48)
            if overdue_approvals:
                result = await self._escalate_approvals(overdue_approvals)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error escalating overdue items: {e}")
            raise RuntimeError(f"Failed to escalate overdue items: {str(e)}")
    
    def get_notification_preferences(
        self,
        user_id: UUID
    ) -> NotificationPreferences:
        """
        Get notification preferences for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            NotificationPreferences: User's notification preferences
        """
        try:
            # Try to get existing preferences
            result = self.db.table("user_notification_preferences").select("*").eq("user_id", str(user_id)).execute()
            
            if result.data:
                prefs_data = result.data[0]
                return NotificationPreferences(
                    user_id=user_id,
                    email_notifications=prefs_data.get("email_notifications", True),
                    in_app_notifications=prefs_data.get("in_app_notifications", True),
                    sms_notifications=prefs_data.get("sms_notifications", False),
                    notification_types=prefs_data.get("notification_types", []),
                    escalation_enabled=prefs_data.get("escalation_enabled", True),
                    reminder_frequency_hours=prefs_data.get("reminder_frequency_hours", 24)
                )
            else:
                # Return default preferences
                return NotificationPreferences(user_id=user_id)
                
        except Exception as e:
            logger.error(f"Error getting notification preferences for user {user_id}: {e}")
            # Return default preferences on error
            return NotificationPreferences(user_id=user_id)
    
    # Private helper methods
    
    async def _get_stakeholders_by_roles(
        self,
        change_id: UUID,
        roles: List[StakeholderRole]
    ) -> List[Dict[str, Any]]:
        """Get stakeholders for a change request based on their roles."""
        stakeholders = []
        
        # Get change request details
        change_result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
        if not change_result.data:
            return stakeholders
        
        change_data = change_result.data[0]
        
        for role in roles:
            if role == StakeholderRole.REQUESTOR:
                # Add the person who requested the change
                stakeholders.append({
                    "user_id": change_data["requested_by"],
                    "role": role.value
                })
            
            elif role == StakeholderRole.APPROVER:
                # Get pending approvers
                approvers_result = self.db.table("change_approvals").select("approver_id").eq(
                    "change_request_id", str(change_id)
                ).is_("decision", "null").execute()
                
                for approver in approvers_result.data:
                    stakeholders.append({
                        "user_id": approver["approver_id"],
                        "role": role.value
                    })
        
        # Remove duplicates
        unique_stakeholders = []
        seen_users = set()
        for stakeholder in stakeholders:
            if stakeholder["user_id"] not in seen_users:
                unique_stakeholders.append(stakeholder)
                seen_users.add(stakeholder["user_id"])
        
        return unique_stakeholders
    
    async def _prepare_notification_content(
        self,
        change_data: Dict[str, Any],
        event_type: NotificationEvent,
        custom_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Prepare notification content based on event type and change data."""
        template_info = self.email_templates.get(event_type, {})
        
        content = {
            "subject": template_info.get("subject", "Change Request Notification").format(
                change_number=change_data.get("change_number", "Unknown")
            ),
            "change_number": change_data.get("change_number"),
            "change_title": change_data.get("title"),
            "change_description": change_data.get("description"),
            "change_type": change_data.get("change_type"),
            "priority": change_data.get("priority"),
            "status": change_data.get("status"),
            "estimated_cost_impact": change_data.get("estimated_cost_impact"),
            "required_by_date": change_data.get("required_by_date"),
            "custom_message": custom_message,
            "template": template_info.get("template", "default_email.html")
        }
        
        return content
    
    async def _prepare_approval_notification_content(
        self,
        change_data: Dict[str, Any],
        approval_data: Dict[str, Any],
        urgency_level: UrgencyLevel
    ) -> Dict[str, Any]:
        """Prepare approval-specific notification content."""
        content = await self._prepare_notification_content(
            change_data, NotificationEvent.APPROVAL_REQUESTED
        )
        
        content.update({
            "approval_step": approval_data.get("step_number"),
            "due_date": approval_data.get("due_date"),
            "urgency_level": urgency_level.value,
            "approval_url": f"/changes/{change_data['id']}/approve/{approval_data['id']}"
        })
        
        return content
    
    def _determine_delivery_methods(
        self,
        urgency_level: UrgencyLevel,
        preferences: NotificationPreferences
    ) -> List[DeliveryMethod]:
        """Determine delivery methods based on urgency and user preferences."""
        methods = []
        
        # Always include in-app notifications if enabled
        if preferences.in_app_notifications:
            methods.append(DeliveryMethod.IN_APP)
        
        # Email notifications
        if preferences.email_notifications:
            methods.append(DeliveryMethod.EMAIL)
        
        # SMS for high urgency if enabled
        if urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.EMERGENCY] and preferences.sms_notifications:
            methods.append(DeliveryMethod.SMS)
        
        # Ensure at least one method for critical/emergency
        if urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.EMERGENCY] and not methods:
            methods.append(DeliveryMethod.EMAIL)
        
        return methods
    
    async def _send_notification(
        self,
        recipient_id: UUID,
        change_id: UUID,
        event_type: NotificationEvent,
        delivery_method: DeliveryMethod,
        content: Dict[str, Any],
        urgency_level: UrgencyLevel
    ) -> Optional[str]:
        """Send a single notification via specified delivery method."""
        try:
            notification_data = {
                "id": str(uuid4()),
                "change_request_id": str(change_id),
                "notification_type": event_type.value,
                "recipient_id": str(recipient_id),
                "delivery_method": delivery_method.value,
                "subject": content.get("subject", ""),
                "message": self._format_message(content, delivery_method),
                "delivery_status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Insert notification record
            result = self.db.table("change_notifications").insert(notification_data).execute()
            
            if result.data:
                notification_id = result.data[0]["id"]
                
                # Actually send the notification based on delivery method
                success = await self._deliver_notification(
                    notification_id, delivery_method, recipient_id, content
                )
                
                # Update delivery status
                status = "sent" if success else "failed"
                self.db.table("change_notifications").update({
                    "delivery_status": status,
                    "sent_at": datetime.utcnow().isoformat() if success else None
                }).eq("id", notification_id).execute()
                
                return notification_id if success else None
            
            return None
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            return None
    
    def _format_message(self, content: Dict[str, Any], delivery_method: DeliveryMethod) -> str:
        """Format message content based on delivery method."""
        if delivery_method == DeliveryMethod.EMAIL:
            return self._format_email_message(content)
        elif delivery_method == DeliveryMethod.SMS:
            return self._format_sms_message(content)
        else:
            return self._format_in_app_message(content)
    
    def _format_email_message(self, content: Dict[str, Any]) -> str:
        """Format email message content."""
        message = f"""
        Change Request: {content.get('change_number', 'Unknown')}
        Title: {content.get('change_title', 'No title')}
        Type: {content.get('change_type', 'Unknown')}
        Priority: {content.get('priority', 'Unknown')}
        Status: {content.get('status', 'Unknown')}
        
        Description: {content.get('change_description', 'No description')}
        
        {content.get('custom_message', '')}
        """
        return message.strip()
    
    def _format_sms_message(self, content: Dict[str, Any]) -> str:
        """Format SMS message content (shorter)."""
        return f"Change {content.get('change_number')}: {content.get('change_title')} - {content.get('status')}"
    
    def _format_in_app_message(self, content: Dict[str, Any]) -> str:
        """Format in-app message content."""
        return f"Change Request {content.get('change_number')} ({content.get('change_title')}) - {content.get('status')}"
    
    async def _deliver_notification(
        self,
        notification_id: str,
        delivery_method: DeliveryMethod,
        recipient_id: UUID,
        content: Dict[str, Any]
    ) -> bool:
        """Actually deliver the notification via the specified method."""
        try:
            if delivery_method == DeliveryMethod.EMAIL:
                # In a real implementation, this would integrate with an email service
                # For now, we'll just log and mark as successful
                logger.info(f"Email notification sent to user {recipient_id}: {content.get('subject')}")
                return True
            
            elif delivery_method == DeliveryMethod.SMS:
                # In a real implementation, this would integrate with an SMS service
                logger.info(f"SMS notification sent to user {recipient_id}")
                return True
            
            elif delivery_method == DeliveryMethod.IN_APP:
                # Store in-app notification in database
                logger.info(f"In-app notification created for user {recipient_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error delivering notification {notification_id}: {e}")
            return False
    
    async def _get_overdue_approvals(self, escalation_threshold_hours: int = 24) -> List[Dict[str, Any]]:
        """Get overdue approval requests."""
        threshold_date = datetime.utcnow() - timedelta(hours=escalation_threshold_hours)
        
        result = self.db.table("change_approvals").select(
            "*, change_requests(*)"
        ).is_("decision", "null").lt("due_date", threshold_date.isoformat()).execute()
        
        return result.data if result.data else []
    
    async def _get_upcoming_approvals(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get approvals due within specified hours."""
        threshold_date = datetime.utcnow() + timedelta(hours=hours)
        
        result = self.db.table("change_approvals").select(
            "*, change_requests(*)"
        ).is_("decision", "null").lt("due_date", threshold_date.isoformat()).execute()
        
        return result.data if result.data else []
    
    async def _send_approval_reminders(
        self,
        approvals: List[Dict[str, Any]],
        is_overdue: bool = False
    ) -> ReminderResult:
        """Send reminder notifications for approvals."""
        reminders_sent = 0
        failed_reminders = 0
        recipients = []
        
        for approval in approvals:
            try:
                approver_id = UUID(approval["approver_id"])
                
                urgency = UrgencyLevel.HIGH if is_overdue else UrgencyLevel.NORMAL
                
                success = await self.send_approval_request(
                    UUID(approval["id"]), approver_id, urgency
                )
                
                if success:
                    reminders_sent += 1
                    recipients.append(approval["approver_id"])
                else:
                    failed_reminders += 1
                    
            except Exception as e:
                logger.error(f"Error sending approval reminder: {e}")
                failed_reminders += 1
        
        return ReminderResult(
            reminders_sent=reminders_sent,
            failed_reminders=failed_reminders,
            recipients=recipients
        )
    
    async def _escalate_approvals(self, approvals: List[Dict[str, Any]]) -> EscalationResult:
        """Escalate overdue approvals to higher authority."""
        escalations_triggered = 0
        escalated_items = []
        escalation_recipients = []
        
        for approval in approvals:
            try:
                # Find escalation target (manager, project manager, etc.)
                escalation_target = await self._find_escalation_target(
                    UUID(approval["approver_id"]), "approval"
                )
                
                if escalation_target:
                    # Update approval record with escalation
                    self.db.table("change_approvals").update({
                        "escalated_to": str(escalation_target),
                        "escalation_date": datetime.utcnow().isoformat()
                    }).eq("id", approval["id"]).execute()
                    
                    # Send escalation notification
                    change_id = UUID(approval["change_request_id"])
                    result = await self.notify_stakeholders(
                        change_id,
                        NotificationEvent.APPROVAL_ESCALATED,
                        [StakeholderRole.EXECUTIVE],
                        UrgencyLevel.CRITICAL
                    )
                    
                    if result.success:
                        escalations_triggered += 1
                        escalated_items.append({
                            "approval_id": approval["id"],
                            "change_id": approval["change_request_id"],
                            "original_approver": approval["approver_id"],
                            "escalated_to": str(escalation_target)
                        })
                        escalation_recipients.append(str(escalation_target))
                        
            except Exception as e:
                logger.error(f"Error escalating approval {approval['id']}: {e}")
        
        return EscalationResult(
            escalations_triggered=escalations_triggered,
            escalated_items=escalated_items,
            escalation_recipients=escalation_recipients
        )
    
    async def _find_escalation_target(self, user_id: UUID, escalation_type: str) -> Optional[UUID]:
        """Find appropriate escalation target for a user."""
        try:
            # This would typically look up organizational hierarchy
            # For now, we'll use a simple approach
            
            # Get user's manager from user profile
            user_result = self.db.table("user_profiles").select("manager_id").eq("user_id", str(user_id)).execute()
            
            if user_result.data and user_result.data[0].get("manager_id"):
                return UUID(user_result.data[0]["manager_id"])
            
            # Fallback to system admin or project manager
            admin_result = self.db.table("user_profiles").select("user_id").eq("role", "admin").limit(1).execute()
            
            if admin_result.data:
                return UUID(admin_result.data[0]["user_id"])
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding escalation target for user {user_id}: {e}")
            return None
    
    async def get_notification_statistics(self) -> Dict[str, Any]:
        """
        Get notification delivery statistics.
        
        Returns:
            Dict with notification statistics
        """
        try:
            # Get all notifications
            result = self.db.table("change_notifications").select("*").execute()
            notifications = result.data if result.data else []
            
            total_notifications = len(notifications)
            delivered_count = len([n for n in notifications if n.get("delivery_status") in [DeliveryStatus.DELIVERED.value, DeliveryStatus.READ.value]])
            failed_count = len([n for n in notifications if n.get("delivery_status") == DeliveryStatus.FAILED.value])
            read_count = len([n for n in notifications if n.get("delivery_status") == DeliveryStatus.READ.value])
            
            return {
                "total_notifications": total_notifications,
                "delivered_count": delivered_count,
                "failed_count": failed_count,
                "read_count": read_count,
                "delivery_rate": (delivered_count / total_notifications * 100) if total_notifications > 0 else 0,
                "read_rate": (read_count / delivered_count * 100) if delivered_count > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting notification statistics: {e}")
            return {
                "total_notifications": 0,
                "delivered_count": 0,
                "failed_count": 0,
                "read_count": 0,
                "delivery_rate": 0,
                "read_rate": 0
            }
    
    async def send_deadline_reminders(self) -> List[Dict[str, Any]]:
        """
        Send deadline reminders for overdue approvals.
        
        Returns:
            List of reminder results
        """
        try:
            results = []
            
            # Get overdue approvals
            overdue_approvals = await self._get_overdue_approvals()
            
            for approval in overdue_approvals:
                try:
                    # Get change data
                    change_data = await self._get_change_request_data(UUID(approval["change_request_id"]))
                    
                    # Send reminder notification
                    notification_id = await self._send_email_notification(
                        recipient_id=UUID(approval["approver_id"]),
                        notification_type=NotificationType.DEADLINE_REMINDER,
                        change_request_id=UUID(approval["change_request_id"]),
                        context_data=change_data
                    )
                    
                    results.append({
                        "approval_id": approval["id"],
                        "notification_id": str(notification_id) if notification_id else None,
                        "reminders_sent": 1 if notification_id else 0,
                        "success": notification_id is not None
                    })
                    
                except Exception as e:
                    logger.error(f"Error sending reminder for approval {approval['id']}: {e}")
                    results.append({
                        "approval_id": approval["id"],
                        "notification_id": None,
                        "reminders_sent": 0,
                        "success": False,
                        "error": str(e)
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error sending deadline reminders: {e}")
            return []
    
    async def escalate_overdue_items(self) -> List[Dict[str, Any]]:
        """
        Escalate overdue approvals to higher authorities.
        
        Returns:
            List of escalation results
        """
        try:
            results = []
            
            # Get severely overdue approvals (more than 48 hours)
            overdue_approvals = await self._get_overdue_approvals(escalation_threshold_hours=48)
            
            for approval in overdue_approvals:
                try:
                    # Get escalation recipients
                    escalation_recipients = await self._get_escalation_recipients(
                        UUID(approval["approver_id"]),
                        approval.get("priority", "medium")
                    )
                    
                    escalations_sent = 0
                    for recipient_id in escalation_recipients:
                        # Get change data
                        change_data = await self._get_change_request_data(UUID(approval["change_request_id"]))
                        
                        # Send escalation notification
                        notification_ids = await self._send_escalation_notification(
                            recipient_id,
                            UUID(approval["change_request_id"]),
                            change_data
                        )
                        
                        if notification_ids:
                            escalations_sent += len(notification_ids)
                    
                    results.append({
                        "approval_id": approval["id"],
                        "escalations_triggered": escalations_sent,
                        "success": escalations_sent > 0
                    })
                    
                except Exception as e:
                    logger.error(f"Error escalating approval {approval['id']}: {e}")
                    results.append({
                        "approval_id": approval["id"],
                        "escalations_triggered": 0,
                        "success": False,
                        "error": str(e)
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error escalating overdue items: {e}")
            return []
    
    async def send_escalation_alerts(self) -> List[Dict[str, Any]]:
        """
        Send escalation alerts for overdue approvals.
        
        Returns:
            List of escalation results
        """
        return await self.escalate_overdue_items()
    
    async def get_failed_notifications(self, hours_back: int = 24) -> List[Dict[str, Any]]:
        """
        Get failed notifications from the specified time period.
        
        Args:
            hours_back: Number of hours to look back
            
        Returns:
            List of failed notifications
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
            
            result = self.db.table("change_notifications").select("*").eq(
                "delivery_status", DeliveryStatus.FAILED.value
            ).gte("created_at", cutoff_time.isoformat()).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error getting failed notifications: {e}")
            return []
    
    async def retry_failed_notifications(self, notification_ids: List[str]) -> Dict[str, bool]:
        """
        Retry failed notifications.
        
        Args:
            notification_ids: List of notification IDs to retry
            
        Returns:
            Dict mapping notification ID to success status
        """
        try:
            results = {}
            
            for notification_id in notification_ids:
                try:
                    # Get notification details
                    result = self.db.table("change_notifications").select("*").eq(
                        "id", notification_id
                    ).execute()
                    
                    if not result.data:
                        results[notification_id] = False
                        continue
                    
                    notification = result.data[0]
                    
                    # Retry based on delivery method
                    if notification["delivery_method"] == DeliveryMethod.EMAIL.value:
                        # Queue for email retry
                        await self._queue_email_delivery(
                            UUID(notification_id),
                            UUID(notification["recipient_id"]),
                            notification["subject"],
                            notification["message"]
                        )
                        
                        # Update status to pending
                        self.db.table("change_notifications").update({
                            "delivery_status": DeliveryStatus.PENDING.value,
                            "retry_count": notification.get("retry_count", 0) + 1,
                            "last_retry_at": datetime.utcnow().isoformat()
                        }).eq("id", notification_id).execute()
                        
                        results[notification_id] = True
                    else:
                        # For in-app notifications, mark as delivered immediately
                        self.db.table("change_notifications").update({
                            "delivery_status": DeliveryStatus.DELIVERED.value,
                            "delivered_at": datetime.utcnow().isoformat(),
                            "retry_count": notification.get("retry_count", 0) + 1
                        }).eq("id", notification_id).execute()
                        
                        results[notification_id] = True
                        
                except Exception as e:
                    logger.error(f"Error retrying notification {notification_id}: {e}")
                    results[notification_id] = False
            
            return results
            
        except Exception as e:
            logger.error(f"Error retrying failed notifications: {e}")
            return {nid: False for nid in notification_ids}
    
    async def get_notification_metrics(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Get notification metrics for a date range.
        
        Args:
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            Dict with notification metrics
        """
        try:
            # Get notifications in date range
            result = self.db.table("change_notifications").select("*").gte(
                "created_at", start_date.isoformat()
            ).lte("created_at", end_date.isoformat()).execute()
            
            notifications = result.data if result.data else []
            
            total_sent = len(notifications)
            delivered = len([n for n in notifications if n.get("delivery_status") == DeliveryStatus.DELIVERED.value])
            failed = len([n for n in notifications if n.get("delivery_status") == DeliveryStatus.FAILED.value])
            read = len([n for n in notifications if n.get("delivery_status") == DeliveryStatus.READ.value])
            
            return {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "totals": {
                    "sent": total_sent,
                    "delivered": delivered,
                    "failed": failed,
                    "read": read
                },
                "rates": {
                    "delivery_rate": (delivered / total_sent * 100) if total_sent > 0 else 0,
                    "failure_rate": (failed / total_sent * 100) if total_sent > 0 else 0,
                    "read_rate": (read / delivered * 100) if delivered > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting notification metrics: {e}")
            return {
                "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
                "totals": {"sent": 0, "delivered": 0, "failed": 0, "read": 0},
                "rates": {"delivery_rate": 0, "failure_rate": 0, "read_rate": 0}
            }
    
    async def notify_emergency_change(
        self,
        change_request_id: UUID,
        change_data: Dict[str, Any],
        created_by: UUID
    ) -> List[UUID]:
        """
        Send emergency change notifications to all stakeholders.
        
        Args:
            change_request_id: ID of the emergency change request
            change_data: Change request data
            created_by: ID of the user who created the change
            
        Returns:
            List of notification IDs
        """
        try:
            # Get emergency stakeholders (broader audience than normal changes)
            stakeholders = await self._get_emergency_stakeholders(change_request_id, change_data)
            
            # Remove the creator from notifications
            stakeholders.discard(created_by)
            
            notification_ids = []
            
            for stakeholder_id in stakeholders:
                # For emergency changes, send via all methods regardless of preferences
                # Email notification
                notification_id = await self._send_email_notification(
                    recipient_id=stakeholder_id,
                    notification_type=NotificationType.EMERGENCY_CHANGE,
                    change_request_id=change_request_id,
                    context_data=change_data,
                    high_priority=True
                )
                if notification_id:
                    notification_ids.append(notification_id)
                
                # In-app notification
                notification_id = await self._send_in_app_notification(
                    recipient_id=stakeholder_id,
                    notification_type=NotificationType.EMERGENCY_CHANGE,
                    change_request_id=change_request_id,
                    context_data=change_data,
                    high_priority=True
                )
                if notification_id:
                    notification_ids.append(notification_id)
                
                # SMS notification (if user has SMS enabled)
                preferences = await self._get_user_notification_preferences(stakeholder_id)
                if preferences.sms_notifications:
                    notification_id = await self._send_sms_notification(
                        recipient_id=stakeholder_id,
                        notification_type=NotificationType.EMERGENCY_CHANGE,
                        change_request_id=change_request_id,
                        context_data=change_data
                    )
                    if notification_id:
                        notification_ids.append(notification_id)
            
            return notification_ids
            
        except Exception as e:
            logger.error(f"Error sending emergency change notifications: {e}")
            return []
    
    async def _get_overdue_approvals(self, escalation_threshold_hours: int = 24) -> List[Dict[str, Any]]:
        """
        Get overdue approvals based on threshold.
        
        Args:
            escalation_threshold_hours: Hours past due date to consider overdue
            
        Returns:
            List of overdue approval records
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=escalation_threshold_hours)
            
            result = self.db.table("change_approvals").select("*").lte(
                "due_date", cutoff_time.isoformat()
            ).execute()
            
            # Filter for approvals without decisions
            overdue = [a for a in (result.data or []) if not a.get("decision")]
            
            return overdue
            
        except Exception as e:
            logger.error(f"Error getting overdue approvals: {e}")
            return []
    
    async def _get_overdue_implementations(self) -> List[Dict[str, Any]]:
        """
        Get overdue implementations.
        
        Returns:
            List of overdue implementation records
        """
        try:
            # Get implementations that are past their planned completion date
            current_time = datetime.utcnow()
            
            result = self.db.table("change_implementations").select("*").lte(
                "planned_completion_date", current_time.isoformat()
            ).execute()
            
            # Filter for incomplete implementations
            overdue = [i for i in (result.data or []) if i.get("progress_percentage", 0) < 100]
            
            return overdue
            
        except Exception as e:
            logger.error(f"Error getting overdue implementations: {e}")
            return []
    
    async def _get_emergency_stakeholders(
        self,
        change_request_id: UUID,
        change_data: Dict[str, Any]
    ) -> Set[UUID]:
        """
        Get stakeholders for emergency change notifications.
        
        Args:
            change_request_id: ID of the change request
            change_data: Change request data
            
        Returns:
            Set of stakeholder user IDs
        """
        try:
            stakeholders = set()
            
            # Include all normal stakeholders
            normal_stakeholders = await self._get_change_stakeholders(
                change_request_id, 
                change_data,
                NotificationType.EMERGENCY_CHANGE
            )
            stakeholders.update(normal_stakeholders)
            
            # Add emergency contacts and executives
            # This would typically query for users with emergency notification roles
            # For now, return the normal stakeholders
            
            return stakeholders
            
        except Exception as e:
            logger.error(f"Error getting emergency stakeholders: {e}")
            return set()
    
    async def _get_escalation_recipients(
        self,
        approver_id: UUID,
        priority: str
    ) -> List[UUID]:
        """
        Get escalation recipients for an overdue approval.
        
        Args:
            approver_id: ID of the original approver
            priority: Priority level of the change
            
        Returns:
            List of escalation recipient IDs
        """
        try:
            # This would typically query organizational hierarchy
            # For testing, return a mock list
            escalation_recipients = []
            
            # Add manager and senior management based on priority
            if priority in ["high", "emergency"]:
                # Add more senior stakeholders for high priority
                escalation_recipients = [uuid4() for _ in range(3)]
            else:
                # Add immediate manager for normal priority
                escalation_recipients = [uuid4()]
            
            return escalation_recipients
            
        except Exception as e:
            logger.error(f"Error getting escalation recipients: {e}")
            return []
    
    async def _send_escalation_notification(
        self,
        recipient_id: UUID,
        change_request_id: UUID,
        context_data: Dict[str, Any]
    ) -> List[UUID]:
        """
        Send escalation notification to a recipient.
        
        Args:
            recipient_id: ID of the escalation recipient
            change_request_id: ID of the change request
            context_data: Change request data
            
        Returns:
            List of notification IDs
        """
        try:
            notification_ids = []
            
            # Send email escalation
            notification_id = await self._send_email_notification(
                recipient_id=recipient_id,
                notification_type=NotificationType.ESCALATION_ALERT,
                change_request_id=change_request_id,
                context_data=context_data,
                high_priority=True
            )
            if notification_id:
                notification_ids.append(notification_id)
            
            # Send in-app escalation
            notification_id = await self._send_in_app_notification(
                recipient_id=recipient_id,
                notification_type=NotificationType.ESCALATION_ALERT,
                change_request_id=change_request_id,
                context_data=context_data,
                high_priority=True
            )
            if notification_id:
                notification_ids.append(notification_id)
            
            return notification_ids
            
        except Exception as e:
            logger.error(f"Error sending escalation notification: {e}")
            return []
    
    async def _send_sms_notification(
        self,
        recipient_id: UUID,
        notification_type: NotificationType,
        change_request_id: UUID,
        context_data: Dict[str, Any]
    ) -> Optional[UUID]:
        """
        Send SMS notification to a recipient.
        
        Args:
            recipient_id: ID of the recipient
            notification_type: Type of notification
            change_request_id: ID of the change request
            context_data: Data for message generation
            
        Returns:
            Notification ID if successful, None otherwise
        """
        try:
            # Generate SMS message
            message = await self._generate_sms_message(notification_type, context_data)
            
            # Create notification record
            notification_data = {
                "change_request_id": str(change_request_id),
                "notification_type": notification_type.value,
                "recipient_id": str(recipient_id),
                "delivery_method": DeliveryMethod.SMS.value,
                "message": message,
                "delivery_status": DeliveryStatus.PENDING.value,
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("change_notifications").insert(notification_data).execute()
            
            if result.data:
                notification_id = UUID(result.data[0]["id"])
                
                # Queue for SMS delivery (placeholder)
                await self._queue_sms_delivery(notification_id, recipient_id, message)
                
                return notification_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error sending SMS notification: {e}")
            return None
    
    async def _generate_sms_message(
        self,
        notification_type: NotificationType,
        context_data: Dict[str, Any]
    ) -> str:
        """Generate SMS message content."""
        change_number = context_data.get('change_number', 'N/A')
        
        messages = {
            NotificationType.EMERGENCY_CHANGE: f"URGENT: Emergency change {change_number} requires immediate attention",
            NotificationType.ESCALATION_ALERT: f"ESCALATION: Overdue approval for change {change_number}",
            NotificationType.DEADLINE_REMINDER: f"Reminder: Approval due for change {change_number}"
        }
        
        return messages.get(notification_type, f"Change update: {change_number}")
    
    async def _queue_sms_delivery(
        self,
        notification_id: UUID,
        recipient_id: UUID,
        message: str
    ) -> None:
        """Queue SMS for delivery."""
        # Placeholder - would integrate with SMS service
        logger.info(f"Queued SMS notification {notification_id} for user {recipient_id}")
    
    async def _get_change_request_data(self, change_id: UUID) -> Dict[str, Any]:
        """
        Get change request data by ID.
        
        Args:
            change_id: ID of the change request
            
        Returns:
            Change request data
        """
        try:
            result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
            
            if result.data:
                return result.data[0]
            else:
                return {
                    "id": str(change_id),
                    "change_number": "CR-UNKNOWN",
                    "title": "Unknown Change",
                    "priority": "medium"
                }
                
        except Exception as e:
            logger.error(f"Error getting change request data: {e}")
            return {
                "id": str(change_id),
                "change_number": "CR-ERROR",
                "title": "Error Loading Change",
                "priority": "medium"
            }
    
    async def _get_change_stakeholders(
        self,
        change_request_id: UUID,
        change_data: Dict[str, Any],
        notification_type: NotificationType
    ) -> Set[UUID]:
        """
        Determine stakeholders who should receive notifications for a change.
        
        Args:
            change_request_id: ID of the change request
            change_data: Change request data
            notification_type: Type of notification
            
        Returns:
            Set of stakeholder user IDs
        """
        try:
            stakeholders = set()
            
            # Always include the change requestor
            if change_data.get("requested_by"):
                stakeholders.add(UUID(change_data["requested_by"]))
            
            # Include project manager and team members
            project_id = change_data.get("project_id")
            if project_id:
                project_stakeholders = await self._get_project_stakeholders(UUID(project_id))
                stakeholders.update(project_stakeholders)
            
            return stakeholders
            
        except Exception as e:
            logger.error(f"Error getting change stakeholders: {e}")
            return set()
    
    async def _get_user_notification_preferences(
        self,
        user_id: UUID
    ) -> 'NotificationPreferences':
        """
        Get notification preferences for a user.
        
        Args:
            user_id: ID of the user
            
        Returns:
            NotificationPreferences object
        """
        try:
            # Try to get user preferences from database
            result = self.db.table("user_notification_preferences").select("*").eq("user_id", str(user_id)).execute()
            
            if result.data:
                prefs_data = result.data[0]
                from models.change_management import NotificationPreferences
                return NotificationPreferences(
                    user_id=user_id,
                    email_notifications=prefs_data.get("email_notifications", True),
                    in_app_notifications=prefs_data.get("in_app_notifications", True),
                    sms_notifications=prefs_data.get("sms_notifications", False),
                    notification_types=prefs_data.get("notification_types", []),
                    escalation_enabled=prefs_data.get("escalation_enabled", True),
                    reminder_frequency_hours=prefs_data.get("reminder_frequency_hours", 24)
                )
            else:
                # Return default preferences
                from models.change_management import NotificationPreferences
                return NotificationPreferences(user_id=user_id)
                
        except Exception as e:
            logger.error(f"Error getting user notification preferences: {e}")
            # Return default preferences on error
            from models.change_management import NotificationPreferences
            return NotificationPreferences(user_id=user_id)
    
    async def _get_project_stakeholders(self, project_id: UUID) -> Set[UUID]:
        """Get stakeholders for a project."""
        try:
            stakeholders = set()
            
            # Get project manager
            project_result = self.db.table("projects").select("project_manager_id").eq("id", str(project_id)).execute()
            if project_result.data and project_result.data[0].get("project_manager_id"):
                stakeholders.add(UUID(project_result.data[0]["project_manager_id"]))
            
            return stakeholders
        except Exception as e:
            logger.error(f"Error getting project stakeholders: {e}")
            return set()
    
    async def _send_email_notification(
        self,
        recipient_id: UUID,
        notification_type: NotificationType,
        change_request_id: UUID,
        context_data: Dict[str, Any],
        high_priority: bool = False
    ) -> Optional[UUID]:
        """
        Send email notification to a recipient.
        
        Args:
            recipient_id: ID of the recipient
            notification_type: Type of notification
            change_request_id: ID of the change request
            context_data: Data for template rendering
            high_priority: Whether this is a high priority notification
            
        Returns:
            Notification ID if successful, None otherwise
        """
        try:
            # Get email template
            template_config = self.email_templates.get(notification_type)
            if not template_config:
                logger.warning(f"No email template found for {notification_type}")
                return None
            
            # Format subject line
            subject = template_config["subject"].format(**context_data)
            
            # Generate email content (placeholder - would integrate with actual email service)
            message = await self._generate_email_content(
                template_config["template"],
                context_data
            )
            
            # Create notification record
            notification_data = {
                "change_request_id": str(change_request_id),
                "notification_type": notification_type.value,
                "recipient_id": str(recipient_id),
                "delivery_method": DeliveryMethod.EMAIL.value,
                "subject": subject,
                "message": message,
                "delivery_status": DeliveryStatus.PENDING.value,
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("change_notifications").insert(notification_data).execute()
            
            if result.data:
                # The notification record should have the same change_request_id we passed in
                notification_id = UUID(result.data[0]["id"])
                
                # Queue for actual email delivery (placeholder)
                await self._queue_email_delivery(notification_id, recipient_id, subject, message, high_priority)
                
                return notification_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error sending email notification: {e}")
            return None
    
    async def _send_in_app_notification(
        self,
        recipient_id: UUID,
        notification_type: NotificationType,
        change_request_id: UUID,
        context_data: Dict[str, Any],
        high_priority: bool = False
    ) -> Optional[UUID]:
        """
        Send in-app notification to a recipient.
        
        Args:
            recipient_id: ID of the recipient
            notification_type: Type of notification
            change_request_id: ID of the change request
            context_data: Data for notification
            high_priority: Whether this is a high priority notification
            
        Returns:
            Notification ID if successful, None otherwise
        """
        try:
            # Generate in-app message
            message = await self._generate_in_app_message(notification_type, context_data)
            subject = await self._generate_in_app_subject(notification_type, context_data)
            
            # Create notification record
            notification_data = {
                "change_request_id": str(change_request_id),
                "notification_type": notification_type.value,
                "recipient_id": str(recipient_id),
                "delivery_method": DeliveryMethod.IN_APP.value,
                "subject": subject,
                "message": message,
                "delivery_status": DeliveryStatus.DELIVERED.value,  # In-app is immediately delivered
                "sent_at": datetime.utcnow().isoformat(),
                "delivered_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("change_notifications").insert(notification_data).execute()
            
            if result.data:
                return UUID(result.data[0]["id"])
            
            return None
            
        except Exception as e:
            logger.error(f"Error sending in-app notification: {e}")
            return None
    
    async def _generate_email_content(self, template_name: str, context_data: Dict[str, Any]) -> str:
        """Generate email content from template."""
        # Placeholder - would use actual template engine
        return f"Change Request {context_data.get('change_number', 'N/A')}: {context_data.get('title', 'No title')}"
    
    async def _generate_in_app_message(self, notification_type: NotificationType, context_data: Dict[str, Any]) -> str:
        """Generate in-app message."""
        change_number = context_data.get('change_number', 'N/A')
        title = context_data.get('title', 'No title')
        
        messages = {
            NotificationType.CHANGE_CREATED: f"New change request {change_number} has been created: {title}",
            NotificationType.APPROVAL_REQUESTED: f"Your approval is requested for change {change_number}: {title}",
            NotificationType.CHANGE_APPROVED: f"Change request {change_number} has been approved: {title}",
            NotificationType.EMERGENCY_CHANGE: f"URGENT: Emergency change {change_number} requires attention: {title}"
        }
        
        return messages.get(notification_type, f"Update for change {change_number}: {title}")
    
    async def _generate_in_app_subject(self, notification_type: NotificationType, context_data: Dict[str, Any]) -> str:
        """Generate in-app subject."""
        change_number = context_data.get('change_number', 'N/A')
        
        subjects = {
            NotificationType.CHANGE_CREATED: f"New Change: {change_number}",
            NotificationType.APPROVAL_REQUESTED: f"Approval Required: {change_number}",
            NotificationType.CHANGE_APPROVED: f"Approved: {change_number}",
            NotificationType.EMERGENCY_CHANGE: f"URGENT: {change_number}"
        }
        
        return subjects.get(notification_type, f"Change Update: {change_number}")
    
    async def _queue_email_delivery(
        self,
        notification_id: UUID,
        recipient_id: UUID,
        subject: str,
        message: str,
        high_priority: bool = False
    ) -> None:
        """Queue email for delivery."""
        # Placeholder - would integrate with actual email service
        logger.info(f"Queued email notification {notification_id} for user {recipient_id}")