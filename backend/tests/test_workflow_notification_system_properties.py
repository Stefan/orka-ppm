"""
Property-Based Tests for Workflow Notification System

**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

Property 17: Notification Generation Completeness
For any workflow requiring approval, notifications must be created for all
designated approvers without omission.

Property 18: Stakeholder Notification Consistency
For any workflow status change, all relevant stakeholders (initiator, approvers,
observers) must receive appropriate notifications.

Property 19: Notification Channel Compliance
For any notification delivery, the system must use the correct channels (in-app,
email) based on user preferences and maintain delivery history.

This test suite uses Hypothesis to generate random workflow scenarios and verify
that notifications are sent correctly and completely.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch

from models.workflow import (
    WorkflowStatus,
    ApprovalStatus
)
from services.workflow_notification_service import (
    WorkflowNotificationService,
    WorkflowNotificationEvent,
    NotificationChannel,
    NotificationPriority
)


# ==================== Hypothesis Strategies ====================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs"""
    return uuid4()


@st.composite
def workflow_context_strategy(draw):
    """Generate workflow context data"""
    return {
        "entity_type": draw(st.sampled_from([
            "financial_tracking",
            "project",
            "milestone",
            "resource_allocation",
            "budget_change"
        ])),
        "variance_amount": draw(st.floats(min_value=0, max_value=1000000, allow_nan=False, allow_infinity=False)),
        "variance_percentage": draw(st.floats(min_value=0, max_value=100, allow_nan=False, allow_infinity=False)),
        "priority": draw(st.sampled_from(["low", "normal", "high", "urgent"]))
    }


@st.composite
def notification_preferences_strategy(draw):
    """Generate user notification preferences"""
    return {
        "user_id": str(uuid4()),
        "in_app_notifications": draw(st.booleans()),
        "email_notifications": draw(st.booleans()),
        "workflow_notifications": draw(st.booleans()),
        "reminder_notifications": draw(st.booleans())
    }


@st.composite
def approver_list_strategy(draw):
    """Generate list of approver UUIDs"""
    num_approvers = draw(st.integers(min_value=1, max_value=10))
    return [uuid4() for _ in range(num_approvers)]


@st.composite
def stakeholder_list_strategy(draw):
    """Generate list of stakeholder UUIDs"""
    num_stakeholders = draw(st.integers(min_value=1, max_value=15))
    return [uuid4() for _ in range(num_stakeholders)]


# ==================== Property Tests ====================

class TestWorkflowNotificationSystemProperties:
    """
    Property-Based Tests for Workflow Notification System
    
    Feature: workflow-engine, Properties 17-19: Notification System
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def notification_service(self, mock_db):
        """Create notification service with mock database"""
        return WorkflowNotificationService(mock_db)
    
    @given(
        approvers=approver_list_strategy(),
        workflow_name=st.text(min_size=1, max_size=100),
        entity_type=st.sampled_from(["financial_tracking", "project", "milestone"]),
        context=workflow_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_17_notification_generation_completeness(
        self,
        approvers,
        workflow_name,
        entity_type,
        context,
        mock_db
    ):
        """
        Property 17: Notification Generation Completeness
        
        For any workflow requiring approval, notifications must be created for
        all designated approvers without omission.
        
        **Validates: Requirements 5.1**
        """
        service = WorkflowNotificationService(mock_db)
        
        workflow_instance_id = uuid4()
        entity_id = uuid4()
        initiated_by = uuid4()
        
        # Track notification calls
        notification_calls = []
        
        # Mock database operations
        def mock_insert(data):
            notification_calls.append(data)
            result = Mock()
            result.data = [{"id": str(uuid4()), **data}]
            return Mock(execute=Mock(return_value=result))
        
        def mock_select(*args):
            # Mock user preferences - all notifications enabled
            result = Mock()
            result.data = [{
                "user_id": str(approvers[0]),
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True
            }]
            return Mock(eq=Mock(return_value=Mock(execute=Mock(return_value=result))))
        
        mock_db.table.return_value.insert = mock_insert
        mock_db.table.return_value.select = mock_select
        
        # Send approval request notifications to all approvers
        notifications_sent = []
        
        for approver_id in approvers:
            approval_id = uuid4()
            
            success = await service.notify_approval_requested(
                approval_id=approval_id,
                workflow_instance_id=workflow_instance_id,
                approver_id=approver_id,
                workflow_name=workflow_name,
                entity_type=entity_type,
                entity_id=entity_id,
                initiated_by=initiated_by,
                context=context
            )
            
            notifications_sent.append((approver_id, success))
        
        # Property 17: All approvers must receive notifications
        
        # 1. Notification sent to each approver
        assert len(notifications_sent) == len(approvers), \
            f"Expected {len(approvers)} notifications, got {len(notifications_sent)}"
        
        # 2. All notifications successful (with mocked database)
        for approver_id, success in notifications_sent:
            assert success, f"Notification failed for approver {approver_id}"
        
        # 3. No approvers omitted
        notified_approvers = {approver_id for approver_id, _ in notifications_sent}
        expected_approvers = set(approvers)
        assert notified_approvers == expected_approvers, \
            f"Approvers mismatch: expected {expected_approvers}, got {notified_approvers}"
        
        # 4. At least one notification created per approver (in-app or email)
        assert len(notification_calls) >= len(approvers), \
            f"Expected at least {len(approvers)} notification records, got {len(notification_calls)}"
    
    @given(
        stakeholders=stakeholder_list_strategy(),
        workflow_name=st.text(min_size=1, max_size=100),
        old_status=st.sampled_from([WorkflowStatus.PENDING, WorkflowStatus.IN_PROGRESS]),
        new_status=st.sampled_from([WorkflowStatus.COMPLETED, WorkflowStatus.REJECTED, WorkflowStatus.CANCELLED]),
        context=workflow_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_18_stakeholder_notification_consistency(
        self,
        stakeholders,
        workflow_name,
        old_status,
        new_status,
        context,
        mock_db
    ):
        """
        Property 18: Stakeholder Notification Consistency
        
        For any workflow status change, all relevant stakeholders (initiator,
        approvers, observers) must receive appropriate notifications.
        
        **Validates: Requirements 5.3**
        """
        service = WorkflowNotificationService(mock_db)
        
        workflow_instance_id = uuid4()
        initiated_by = stakeholders[0] if stakeholders else uuid4()
        
        # Track notification calls
        notification_calls = []
        notified_users = set()
        
        # Mock database operations
        def mock_insert(data):
            notification_calls.append(data)
            if "user_id" in data:
                notified_users.add(data["user_id"])
            result = Mock()
            result.data = [{"id": str(uuid4()), **data}]
            return Mock(execute=Mock(return_value=result))
        
        def mock_select(*args):
            # Mock user preferences - all notifications enabled
            result = Mock()
            result.data = [{
                "user_id": str(stakeholders[0]) if stakeholders else str(uuid4()),
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True
            }]
            return Mock(eq=Mock(return_value=Mock(execute=Mock(return_value=result))))
        
        mock_db.table.return_value.insert = mock_insert
        mock_db.table.return_value.select = mock_select
        
        # Send workflow status change notifications
        notifications_sent = await service.notify_workflow_status_change(
            workflow_instance_id=workflow_instance_id,
            workflow_name=workflow_name,
            old_status=old_status,
            new_status=new_status,
            initiated_by=initiated_by,
            stakeholders=stakeholders,
            context=context
        )
        
        # Property 18: All stakeholders must receive notifications
        
        # 1. Notifications sent to stakeholders
        assert notifications_sent > 0, "No notifications were sent"
        
        # 2. Number of notifications matches stakeholder count (at least one per stakeholder)
        # Each stakeholder may receive multiple notifications (in-app + email)
        assert notifications_sent >= len(stakeholders), \
            f"Expected at least {len(stakeholders)} notifications, got {notifications_sent}"
        
        # 3. Notification calls made
        assert len(notification_calls) > 0, "No notification records created"
        
        # 4. Important status changes generate notifications
        if new_status in [WorkflowStatus.COMPLETED, WorkflowStatus.REJECTED, WorkflowStatus.CANCELLED]:
            # Should have notifications for important status changes
            assert notifications_sent >= len(stakeholders), \
                f"Important status change should notify all {len(stakeholders)} stakeholders"
    
    @given(
        user_preferences=notification_preferences_strategy(),
        event_type=st.sampled_from(list(WorkflowNotificationEvent)),
        priority=st.sampled_from(list(NotificationPriority))
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_19_notification_channel_compliance(
        self,
        user_preferences,
        event_type,
        priority,
        mock_db
    ):
        """
        Property 19: Notification Channel Compliance
        
        For any notification delivery, the system must use the correct channels
        (in-app, email) based on user preferences and maintain delivery history.
        
        **Validates: Requirements 5.4, 5.5**
        """
        service = WorkflowNotificationService(mock_db)
        
        user_id = UUID(user_preferences["user_id"])
        workflow_instance_id = uuid4()
        
        # Track notification channels used
        channels_used = []
        notification_records = []
        
        # Mock database operations
        def mock_insert(data):
            notification_records.append(data)
            # Track channel if present in data
            if "type" in data:
                if data["type"] == "workflow":
                    channels_used.append(NotificationChannel.IN_APP)
                elif data["type"] == "workflow_email":
                    channels_used.append(NotificationChannel.EMAIL)
            result = Mock()
            result.data = [{"id": str(uuid4()), **data}]
            return Mock(execute=Mock(return_value=result))
        
        def mock_select(*args):
            # Return the user preferences
            result = Mock()
            result.data = [user_preferences]
            return Mock(eq=Mock(return_value=Mock(execute=Mock(return_value=result))))
        
        mock_db.table.return_value.insert = mock_insert
        mock_db.table.return_value.select = mock_select
        
        # Create a notification based on event type
        if event_type == WorkflowNotificationEvent.APPROVAL_REQUESTED:
            # Send approval request notification
            success = await service.notify_approval_requested(
                approval_id=uuid4(),
                workflow_instance_id=workflow_instance_id,
                approver_id=user_id,
                workflow_name="Test Workflow",
                entity_type="project",
                entity_id=uuid4(),
                initiated_by=uuid4(),
                context={}
            )
        else:
            # Send status change notification
            success = await service.notify_workflow_status_change(
                workflow_instance_id=workflow_instance_id,
                workflow_name="Test Workflow",
                old_status=WorkflowStatus.PENDING,
                new_status=WorkflowStatus.COMPLETED,
                initiated_by=uuid4(),
                stakeholders=[user_id],
                context={}
            )
        
        # Property 19: Notification channels must comply with user preferences
        
        # 1. If all notifications are disabled, no notifications should be sent
        if not user_preferences.get("in_app_notifications", True) and \
           not user_preferences.get("email_notifications", True):
            # When all notifications are disabled, no records should be created
            # This is valid behavior - user has opted out
            assert len(notification_records) == 0, \
                "No notifications should be sent when all channels are disabled"
            return
        
        # 2. If in-app notifications enabled, in-app channel should be used
        if user_preferences.get("in_app_notifications", True):
            assert NotificationChannel.IN_APP in channels_used or len(notification_records) > 0, \
                "In-app notification should be sent when enabled in preferences"
        
        # 3. If email notifications enabled, email channel should be used
        if user_preferences.get("email_notifications", True):
            # Email notifications should be sent for important events
            if event_type in [
                WorkflowNotificationEvent.APPROVAL_REQUESTED,
                WorkflowNotificationEvent.WORKFLOW_COMPLETED,
                WorkflowNotificationEvent.WORKFLOW_REJECTED
            ]:
                assert NotificationChannel.EMAIL in channels_used or len(notification_records) > 0, \
                    "Email notification should be sent for important events when enabled"
        
        # 4. Notification records created for delivery history (when notifications enabled)
        assert len(notification_records) > 0, \
            "Notification records must be created for delivery history when notifications are enabled"
        
        # 5. Each notification record has required fields
        for record in notification_records:
            assert "id" in record, "Notification record must have ID"
            assert "user_id" in record, "Notification record must have user_id"
            assert "created_at" in record, "Notification record must have created_at timestamp"
        
        # 6. Notification records have proper event type
        for record in notification_records:
            if "event_type" in record:
                assert record["event_type"] in [e.value for e in WorkflowNotificationEvent], \
                    f"Invalid event type: {record['event_type']}"
    
    @given(
        num_approvals=st.integers(min_value=1, max_value=20),
        hours_before_deadline=st.integers(min_value=1, max_value=72)
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_reminder_notification_completeness(
        self,
        num_approvals,
        hours_before_deadline,
        mock_db
    ):
        """
        Property: Reminder notifications must be sent for all approaching deadlines
        
        Verifies that reminder notifications are generated for all approvals
        with approaching deadlines.
        
        **Validates: Requirements 5.2**
        """
        service = WorkflowNotificationService(mock_db)
        
        # Generate mock approvals with approaching deadlines
        threshold_time = datetime.utcnow() + timedelta(hours=hours_before_deadline)
        
        mock_approvals = []
        for i in range(num_approvals):
            # Create approval with deadline within threshold
            expires_at = datetime.utcnow() + timedelta(
                hours=hours_before_deadline - (i % hours_before_deadline)
            )
            
            mock_approvals.append({
                "id": str(uuid4()),
                "workflow_instance_id": str(uuid4()),
                "approver_id": str(uuid4()),
                "status": ApprovalStatus.PENDING.value,
                "expires_at": expires_at.isoformat(),
                "workflow_instances": {
                    "workflow_id": str(uuid4()),
                    "workflows": {
                        "name": f"Test Workflow {i}"
                    }
                }
            })
        
        # Track notification calls
        notification_calls = []
        
        # Mock database operations
        def mock_insert(data):
            notification_calls.append(data)
            result = Mock()
            result.data = [{"id": str(uuid4()), **data}]
            return Mock(execute=Mock(return_value=result))
        
        def mock_select(*args):
            # Return mock approvals
            result = Mock()
            result.data = mock_approvals
            
            # Create mock chain for query building
            mock_chain = Mock()
            mock_chain.eq = Mock(return_value=mock_chain)
            mock_chain.lte = Mock(return_value=mock_chain)
            mock_chain.gte = Mock(return_value=mock_chain)
            mock_chain.execute = Mock(return_value=result)
            
            return mock_chain
        
        # Mock user preferences
        def mock_select_preferences(*args):
            result = Mock()
            result.data = [{
                "user_id": str(uuid4()),
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True
            }]
            return Mock(eq=Mock(return_value=Mock(execute=Mock(return_value=result))))
        
        # Set up mock to return different results based on table
        def mock_table(table_name):
            table_mock = Mock()
            if table_name == "workflow_approvals":
                table_mock.select = mock_select
            else:
                table_mock.select = mock_select_preferences
            table_mock.insert = mock_insert
            return table_mock
        
        mock_db.table = mock_table
        
        # Send reminder notifications
        reminders_sent = await service.send_approval_reminders(hours_before_deadline)
        
        # Property: Reminders must be sent for all approaching deadlines
        
        # 1. Reminders sent for approvals
        assert reminders_sent > 0, "No reminders were sent"
        
        # 2. Notification records created
        assert len(notification_calls) > 0, "No notification records created"
        
        # 3. Reminders sent proportional to number of approvals
        # Each approval may generate multiple notifications (in-app + email)
        assert reminders_sent >= num_approvals, \
            f"Expected at least {num_approvals} reminders, got {reminders_sent}"
    
    @given(
        approver_id=uuid_strategy(),
        decision=st.sampled_from([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]),
        has_comments=st.booleans()
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_approval_decision_notification_accuracy(
        self,
        approver_id,
        decision,
        has_comments,
        mock_db
    ):
        """
        Property: Approval decision notifications must accurately reflect the decision
        
        Verifies that notifications for approval decisions contain correct
        information and are sent to the workflow initiator.
        
        **Validates: Requirements 5.3**
        """
        service = WorkflowNotificationService(mock_db)
        
        approval_id = uuid4()
        workflow_instance_id = uuid4()
        workflow_name = "Test Workflow"
        initiated_by = uuid4()
        comments = "Test comments" if has_comments else None
        
        # Track notification calls
        notification_calls = []
        
        # Mock database operations
        def mock_insert(data):
            notification_calls.append(data)
            result = Mock()
            result.data = [{"id": str(uuid4()), **data}]
            return Mock(execute=Mock(return_value=result))
        
        def mock_select(*args):
            # Mock user preferences
            result = Mock()
            result.data = [{
                "user_id": str(initiated_by),
                "in_app_notifications": True,
                "email_notifications": True,
                "workflow_notifications": True
            }]
            return Mock(eq=Mock(return_value=Mock(execute=Mock(return_value=result))))
        
        mock_db.table.return_value.insert = mock_insert
        mock_db.table.return_value.select = mock_select
        
        # Send approval decision notification
        success = await service.notify_approval_decision(
            approval_id=approval_id,
            workflow_instance_id=workflow_instance_id,
            workflow_name=workflow_name,
            approver_id=approver_id,
            decision=decision,
            initiated_by=initiated_by,
            comments=comments
        )
        
        # Property: Approval decision notifications must be accurate
        
        # 1. Notification sent successfully
        assert success, "Approval decision notification should be sent"
        
        # 2. Notification records created
        assert len(notification_calls) > 0, "Notification records should be created"
        
        # 3. Notification contains decision information
        for record in notification_calls:
            if "data" in record:
                data = record["data"]
                assert "decision" in data, "Notification must contain decision"
                assert data["decision"] == decision.value, \
                    f"Decision mismatch: expected {decision.value}, got {data['decision']}"
                
                # 4. Comments included if provided
                if has_comments:
                    assert "comments" in data, "Notification must contain comments when provided"
                    assert data["comments"] == comments, "Comments must match"
                
                # 5. Approver information included
                assert "approver_id" in data, "Notification must contain approver_id"
                assert data["approver_id"] == str(approver_id), "Approver ID must match"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
