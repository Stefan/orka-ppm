"""
Workflow Notification Service

Handles all notifications for workflow events including:
- Approval request notifications
- Workflow status change notifications
- Deadline reminder notifications
- Stakeholder notifications

Requirements: 5.1, 5.2, 5.3
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set
from uuid import UUID, uuid4
from enum import Enum

from config.database import supabase
from models.workflow import (
    WorkflowStatus,
    ApprovalStatus,
    WorkflowInstance,
    WorkflowApproval
)

logger = logging.getLogger(__name__)


class WorkflowNotificationEvent(str, Enum):
    """Types of workflow notification events"""
    WORKFLOW_INITIATED = "workflow_initiated"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    APPROVAL_DELEGATED = "approval_delegated"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_REJECTED = "workflow_rejected"
    WORKFLOW_CANCELLED = "workflow_cancelled"
    APPROVAL_REMINDER = "approval_reminder"
    APPROVAL_OVERDUE = "approval_overdue"
    WORKFLOW_ESCALATED = "workflow_escalated"
    WORKFLOW_RESTARTED = "workflow_restarted"
    STEP_ADVANCED = "step_advanced"


class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    IN_APP = "in_app"
    EMAIL = "email"


class NotificationPriority(str, Enum):
    """Notification priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class WorkflowNotificationService:
    """
    Service for managing workflow notifications.
    
    Handles:
    - Notification generation for workflow events
    - Reminder notifications for approaching deadlines
    - Status change notifications for stakeholders
    """
    
    def __init__(self, db=None):
        """
        Initialize workflow notification service.
        
        Args:
            db: Database client (defaults to supabase)
        """
        self.db = db or supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    # ==================== Approval Request Notifications ====================
    
    async def notify_approval_requested(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        approver_id: UUID,
        workflow_name: str,
        entity_type: str,
        entity_id: UUID,
        initiated_by: UUID,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send notification when approval is requested.
        
        Args:
            approval_id: Approval record ID
            workflow_instance_id: Workflow instance ID
            approver_id: ID of the approver
            workflow_name: Name of the workflow
            entity_type: Type of entity
            entity_id: ID of the entity
            initiated_by: User who initiated the workflow
            context: Optional workflow context data
            
        Returns:
            bool: True if notification sent successfully
            
        Requirements: 5.1
        """
        try:
            # Get user preferences
            preferences = await self._get_user_notification_preferences(approver_id)
            
            notification_ids = []
            
            # Prepare notification content
            content = {
                "workflow_name": workflow_name,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "initiated_by": str(initiated_by),
                "approval_id": str(approval_id),
                "workflow_instance_id": str(workflow_instance_id),
                "context": context or {}
            }
            
            # Send in-app notification if enabled
            if preferences.get("in_app_notifications", True):
                notification_id = await self._create_in_app_notification(
                    user_id=approver_id,
                    event_type=WorkflowNotificationEvent.APPROVAL_REQUESTED,
                    title=f"Approval Required: {workflow_name}",
                    message=f"You have been requested to approve a workflow for {entity_type}",
                    priority=NotificationPriority.NORMAL,
                    data=content
                )
                if notification_id:
                    notification_ids.append(notification_id)
            
            # Send email notification if enabled
            if preferences.get("email_notifications", True):
                notification_id = await self._send_email_notification(
                    user_id=approver_id,
                    event_type=WorkflowNotificationEvent.APPROVAL_REQUESTED,
                    subject=f"Approval Required: {workflow_name}",
                    content=content
                )
                if notification_id:
                    notification_ids.append(notification_id)
            
            logger.info(
                f"Sent approval request notification to user {approver_id} "
                f"for approval {approval_id} ({len(notification_ids)} channels)"
            )
            
            return len(notification_ids) > 0
            
        except Exception as e:
            logger.error(f"Error sending approval request notification: {e}")
            return False
    
    # ==================== Workflow Status Change Notifications ====================
    
    async def notify_workflow_initiated(
        self,
        workflow_instance_id: UUID,
        workflow_name: str,
        entity_type: str,
        entity_id: UUID,
        initiated_by: UUID,
        stakeholders: List[UUID]
    ) -> int:
        """
        Notify stakeholders when a workflow is initiated.
        
        Args:
            workflow_instance_id: Workflow instance ID
            workflow_name: Name of the workflow
            entity_type: Type of entity
            entity_id: ID of the entity
            initiated_by: User who initiated the workflow
            stakeholders: List of stakeholder user IDs to notify
            
        Returns:
            int: Number of notifications sent
            
        Requirements: 5.3
        """
        try:
            notifications_sent = 0
            
            # Remove initiator from stakeholders (they already know)
            stakeholders_to_notify = [s for s in stakeholders if s != initiated_by]
            
            content = {
                "workflow_name": workflow_name,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "initiated_by": str(initiated_by),
                "workflow_instance_id": str(workflow_instance_id)
            }
            
            for stakeholder_id in stakeholders_to_notify:
                try:
                    preferences = await self._get_user_notification_preferences(stakeholder_id)
                    
                    # Send in-app notification
                    if preferences.get("in_app_notifications", True):
                        await self._create_in_app_notification(
                            user_id=stakeholder_id,
                            event_type=WorkflowNotificationEvent.WORKFLOW_INITIATED,
                            title=f"Workflow Initiated: {workflow_name}",
                            message=f"A new workflow has been initiated for {entity_type}",
                            priority=NotificationPriority.LOW,
                            data=content
                        )
                        notifications_sent += 1
                
                except Exception as e:
                    logger.error(f"Error notifying stakeholder {stakeholder_id}: {e}")
            
            logger.info(
                f"Sent workflow initiated notifications for instance {workflow_instance_id} "
                f"to {notifications_sent} stakeholders"
            )
            
            return notifications_sent
            
        except Exception as e:
            logger.error(f"Error sending workflow initiated notifications: {e}")
            return 0
    
    async def notify_workflow_status_change(
        self,
        workflow_instance_id: UUID,
        workflow_name: str,
        old_status: WorkflowStatus,
        new_status: WorkflowStatus,
        initiated_by: UUID,
        stakeholders: List[UUID],
        context: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Notify stakeholders when workflow status changes.
        
        Args:
            workflow_instance_id: Workflow instance ID
            workflow_name: Name of the workflow
            old_status: Previous workflow status
            new_status: New workflow status
            initiated_by: User who initiated the workflow
            stakeholders: List of stakeholder user IDs to notify
            context: Optional context data
            
        Returns:
            int: Number of notifications sent
            
        Requirements: 5.3
        """
        try:
            notifications_sent = 0
            
            # Determine event type based on new status
            event_type = self._get_event_type_for_status(new_status)
            if not event_type:
                return 0
            
            # Determine priority based on status
            priority = self._get_priority_for_status(new_status)
            
            content = {
                "workflow_name": workflow_name,
                "workflow_instance_id": str(workflow_instance_id),
                "old_status": old_status.value,
                "new_status": new_status.value,
                "initiated_by": str(initiated_by),
                "context": context or {}
            }
            
            for stakeholder_id in stakeholders:
                try:
                    preferences = await self._get_user_notification_preferences(stakeholder_id)
                    
                    # Send in-app notification
                    if preferences.get("in_app_notifications", True):
                        await self._create_in_app_notification(
                            user_id=stakeholder_id,
                            event_type=event_type,
                            title=f"Workflow {new_status.value.title()}: {workflow_name}",
                            message=f"Workflow status changed from {old_status.value} to {new_status.value}",
                            priority=priority,
                            data=content
                        )
                        notifications_sent += 1
                    
                    # Send email for important status changes
                    if new_status in [WorkflowStatus.COMPLETED, WorkflowStatus.REJECTED, WorkflowStatus.CANCELLED]:
                        if preferences.get("email_notifications", True):
                            await self._send_email_notification(
                                user_id=stakeholder_id,
                                event_type=event_type,
                                subject=f"Workflow {new_status.value.title()}: {workflow_name}",
                                content=content
                            )
                            notifications_sent += 1
                
                except Exception as e:
                    logger.error(f"Error notifying stakeholder {stakeholder_id}: {e}")
            
            logger.info(
                f"Sent workflow status change notifications for instance {workflow_instance_id} "
                f"({old_status.value} -> {new_status.value}) to {notifications_sent} recipients"
            )
            
            return notifications_sent
            
        except Exception as e:
            logger.error(f"Error sending workflow status change notifications: {e}")
            return 0
    
    async def notify_approval_decision(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        workflow_name: str,
        approver_id: UUID,
        decision: ApprovalStatus,
        initiated_by: UUID,
        comments: Optional[str] = None
    ) -> bool:
        """
        Notify workflow initiator of approval decision.
        
        Args:
            approval_id: Approval record ID
            workflow_instance_id: Workflow instance ID
            workflow_name: Name of the workflow
            approver_id: ID of the approver who made the decision
            decision: Approval decision
            initiated_by: User who initiated the workflow
            comments: Optional approval comments
            
        Returns:
            bool: True if notification sent successfully
            
        Requirements: 5.3
        """
        try:
            # Determine event type based on decision
            if decision == ApprovalStatus.APPROVED:
                event_type = WorkflowNotificationEvent.APPROVAL_APPROVED
                title = f"Approval Granted: {workflow_name}"
                message = "Your workflow approval request has been approved"
                priority = NotificationPriority.NORMAL
            elif decision == ApprovalStatus.REJECTED:
                event_type = WorkflowNotificationEvent.APPROVAL_REJECTED
                title = f"Approval Rejected: {workflow_name}"
                message = "Your workflow approval request has been rejected"
                priority = NotificationPriority.HIGH
            elif decision == ApprovalStatus.DELEGATED:
                event_type = WorkflowNotificationEvent.APPROVAL_DELEGATED
                title = f"Approval Delegated: {workflow_name}"
                message = "Your workflow approval request has been delegated"
                priority = NotificationPriority.NORMAL
            else:
                return False
            
            preferences = await self._get_user_notification_preferences(initiated_by)
            
            content = {
                "workflow_name": workflow_name,
                "workflow_instance_id": str(workflow_instance_id),
                "approval_id": str(approval_id),
                "approver_id": str(approver_id),
                "decision": decision.value,
                "comments": comments
            }
            
            notifications_sent = 0
            
            # Send in-app notification
            if preferences.get("in_app_notifications", True):
                await self._create_in_app_notification(
                    user_id=initiated_by,
                    event_type=event_type,
                    title=title,
                    message=message,
                    priority=priority,
                    data=content
                )
                notifications_sent += 1
            
            # Send email notification
            if preferences.get("email_notifications", True):
                await self._send_email_notification(
                    user_id=initiated_by,
                    event_type=event_type,
                    subject=title,
                    content=content
                )
                notifications_sent += 1
            
            logger.info(
                f"Sent approval decision notification to user {initiated_by} "
                f"for approval {approval_id} (decision: {decision.value})"
            )
            
            return notifications_sent > 0
            
        except Exception as e:
            logger.error(f"Error sending approval decision notification: {e}")
            return False
    
    # ==================== Reminder Notifications ====================
    
    async def send_approval_reminders(
        self,
        hours_before_deadline: int = 24
    ) -> int:
        """
        Send reminder notifications for approvals approaching deadline.
        
        Args:
            hours_before_deadline: Hours before deadline to send reminder
            
        Returns:
            int: Number of reminders sent
            
        Requirements: 5.2
        """
        try:
            # Calculate deadline threshold
            threshold_time = datetime.utcnow() + timedelta(hours=hours_before_deadline)
            
            # Get pending approvals with approaching deadlines
            approvals_result = self.db.table("workflow_approvals").select(
                "*, workflow_instances(workflow_id, workflows(name))"
            ).eq("status", ApprovalStatus.PENDING.value).lte(
                "expires_at", threshold_time.isoformat()
            ).gte(
                "expires_at", datetime.utcnow().isoformat()
            ).execute()
            
            if not approvals_result.data:
                logger.info("No approvals with approaching deadlines found")
                return 0
            
            reminders_sent = 0
            
            for approval in approvals_result.data:
                try:
                    approver_id = UUID(approval["approver_id"])
                    workflow_instance_id = UUID(approval["workflow_instance_id"])
                    
                    # Get workflow name
                    workflow_name = "Unknown Workflow"
                    if approval.get("workflow_instances"):
                        workflows_data = approval["workflow_instances"].get("workflows", {})
                        workflow_name = workflows_data.get("name", workflow_name)
                    
                    # Calculate hours until deadline
                    expires_at = datetime.fromisoformat(approval["expires_at"])
                    hours_remaining = (expires_at - datetime.utcnow()).total_seconds() / 3600
                    
                    preferences = await self._get_user_notification_preferences(approver_id)
                    
                    content = {
                        "workflow_name": workflow_name,
                        "workflow_instance_id": str(workflow_instance_id),
                        "approval_id": approval["id"],
                        "expires_at": approval["expires_at"],
                        "hours_remaining": round(hours_remaining, 1)
                    }
                    
                    # Send in-app notification
                    if preferences.get("in_app_notifications", True):
                        await self._create_in_app_notification(
                            user_id=approver_id,
                            event_type=WorkflowNotificationEvent.APPROVAL_REMINDER,
                            title=f"Approval Reminder: {workflow_name}",
                            message=f"Approval deadline approaching in {round(hours_remaining, 1)} hours",
                            priority=NotificationPriority.HIGH,
                            data=content
                        )
                        reminders_sent += 1
                    
                    # Send email notification
                    if preferences.get("email_notifications", True):
                        await self._send_email_notification(
                            user_id=approver_id,
                            event_type=WorkflowNotificationEvent.APPROVAL_REMINDER,
                            subject=f"Approval Reminder: {workflow_name}",
                            content=content
                        )
                        reminders_sent += 1
                
                except Exception as e:
                    logger.error(f"Error sending reminder for approval {approval['id']}: {e}")
            
            logger.info(f"Sent {reminders_sent} approval reminder notifications")
            
            return reminders_sent
            
        except Exception as e:
            logger.error(f"Error sending approval reminders: {e}")
            return 0
    
    async def send_overdue_notifications(self) -> int:
        """
        Send notifications for overdue approvals.
        
        Returns:
            int: Number of notifications sent
            
        Requirements: 5.2
        """
        try:
            # Get overdue approvals
            approvals_result = self.db.table("workflow_approvals").select(
                "*, workflow_instances(workflow_id, workflows(name))"
            ).eq("status", ApprovalStatus.PENDING.value).lt(
                "expires_at", datetime.utcnow().isoformat()
            ).execute()
            
            if not approvals_result.data:
                logger.info("No overdue approvals found")
                return 0
            
            notifications_sent = 0
            
            for approval in approvals_result.data:
                try:
                    approver_id = UUID(approval["approver_id"])
                    workflow_instance_id = UUID(approval["workflow_instance_id"])
                    
                    # Get workflow name
                    workflow_name = "Unknown Workflow"
                    if approval.get("workflow_instances"):
                        workflows_data = approval["workflow_instances"].get("workflows", {})
                        workflow_name = workflows_data.get("name", workflow_name)
                    
                    # Calculate hours overdue
                    expires_at = datetime.fromisoformat(approval["expires_at"])
                    hours_overdue = (datetime.utcnow() - expires_at).total_seconds() / 3600
                    
                    preferences = await self._get_user_notification_preferences(approver_id)
                    
                    content = {
                        "workflow_name": workflow_name,
                        "workflow_instance_id": str(workflow_instance_id),
                        "approval_id": approval["id"],
                        "expires_at": approval["expires_at"],
                        "hours_overdue": round(hours_overdue, 1)
                    }
                    
                    # Send in-app notification
                    if preferences.get("in_app_notifications", True):
                        await self._create_in_app_notification(
                            user_id=approver_id,
                            event_type=WorkflowNotificationEvent.APPROVAL_OVERDUE,
                            title=f"OVERDUE: Approval Required - {workflow_name}",
                            message=f"Approval is overdue by {round(hours_overdue, 1)} hours",
                            priority=NotificationPriority.URGENT,
                            data=content
                        )
                        notifications_sent += 1
                    
                    # Send email notification
                    if preferences.get("email_notifications", True):
                        await self._send_email_notification(
                            user_id=approver_id,
                            event_type=WorkflowNotificationEvent.APPROVAL_OVERDUE,
                            subject=f"OVERDUE: Approval Required - {workflow_name}",
                            content=content
                        )
                        notifications_sent += 1
                
                except Exception as e:
                    logger.error(f"Error sending overdue notification for approval {approval['id']}: {e}")
            
            logger.info(f"Sent {notifications_sent} overdue approval notifications")
            
            return notifications_sent
            
        except Exception as e:
            logger.error(f"Error sending overdue notifications: {e}")
            return 0
    
    # ==================== Helper Methods ====================
    
    async def _get_user_notification_preferences(
        self,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Get notification preferences for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with notification preferences
        """
        try:
            # Try to get user preferences from database
            result = self.db.table("user_notification_preferences").select("*").eq(
                "user_id", str(user_id)
            ).execute()
            
            if result.data:
                return result.data[0]
            else:
                # Return default preferences
                return {
                    "user_id": str(user_id),
                    "in_app_notifications": True,
                    "email_notifications": True,
                    "workflow_notifications": True
                }
        
        except Exception as e:
            logger.error(f"Error getting notification preferences for user {user_id}: {e}")
            # Return default preferences on error
            return {
                "user_id": str(user_id),
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True
            }
    
    async def _create_in_app_notification(
        self,
        user_id: UUID,
        event_type: WorkflowNotificationEvent,
        title: str,
        message: str,
        priority: NotificationPriority,
        data: Dict[str, Any]
    ) -> Optional[str]:
        """
        Create an in-app notification.
        
        Args:
            user_id: User ID to notify
            event_type: Type of notification event
            title: Notification title
            message: Notification message
            priority: Notification priority
            data: Additional notification data
            
        Returns:
            Optional[str]: Notification ID if successful
        """
        try:
            notification_data = {
                "id": str(uuid4()),
                "user_id": str(user_id),
                "type": "workflow",
                "event_type": event_type.value,
                "title": title,
                "message": message,
                "priority": priority.value,
                "data": data,
                "is_read": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("notifications").insert(notification_data).execute()
            
            if result.data:
                return result.data[0]["id"]
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating in-app notification: {e}")
            return None
    
    async def _send_email_notification(
        self,
        user_id: UUID,
        event_type: WorkflowNotificationEvent,
        subject: str,
        content: Dict[str, Any]
    ) -> Optional[str]:
        """
        Send an email notification.
        
        Args:
            user_id: User ID to notify
            event_type: Type of notification event
            subject: Email subject
            content: Email content data
            
        Returns:
            Optional[str]: Notification ID if successful
        """
        try:
            # In a real implementation, this would integrate with an email service
            # For now, we'll create a notification record and log
            
            notification_data = {
                "id": str(uuid4()),
                "user_id": str(user_id),
                "type": "workflow_email",
                "event_type": event_type.value,
                "subject": subject,
                "content": content,
                "delivery_status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_notifications").insert(notification_data).execute()
            
            if result.data:
                notification_id = result.data[0]["id"]
                logger.info(f"Email notification queued for user {user_id}: {subject}")
                return notification_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error sending email notification: {e}")
            return None
    
    def _get_event_type_for_status(
        self,
        status: WorkflowStatus
    ) -> Optional[WorkflowNotificationEvent]:
        """Get notification event type for workflow status."""
        status_event_map = {
            WorkflowStatus.COMPLETED: WorkflowNotificationEvent.WORKFLOW_COMPLETED,
            WorkflowStatus.REJECTED: WorkflowNotificationEvent.WORKFLOW_REJECTED,
            WorkflowStatus.CANCELLED: WorkflowNotificationEvent.WORKFLOW_CANCELLED
        }
        return status_event_map.get(status)
    
    def _get_priority_for_status(
        self,
        status: WorkflowStatus
    ) -> NotificationPriority:
        """Get notification priority for workflow status."""
        if status in [WorkflowStatus.REJECTED, WorkflowStatus.CANCELLED]:
            return NotificationPriority.HIGH
        elif status == WorkflowStatus.COMPLETED:
            return NotificationPriority.NORMAL
        else:
            return NotificationPriority.LOW
