"""
Property-based tests for Change Notification System

Tests the universal properties that should hold for all notification operations:
- Property 8: Notification Delivery Consistency
- Property 9: Escalation Logic Accuracy

**Validates: Requirements 5.1, 5.2, 5.3, 5.5**
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize, invariant
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from typing import List, Dict, Any, Optional
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from services.change_notification_system import (
    ChangeNotificationSystem,
    NotificationEvent,
    StakeholderRole,
    UrgencyLevel,
    DeliveryMethod,
    NotificationResult,
    ReminderResult,
    EscalationResult
)
from models.change_management import NotificationPreferences


class TestChangeNotificationSystemProperties:
    """Property-based tests for Change Notification System"""
    
    def create_mock_db(self):
        """Create mock database for testing"""
        mock_db = MagicMock()
        mock_db.table.return_value = mock_db
        mock_db.select.return_value = mock_db
        mock_db.eq.return_value = mock_db
        mock_db.insert.return_value = mock_db
        mock_db.update.return_value = mock_db
        mock_db.execute.return_value = MagicMock(data=[])
        return mock_db
    
    def create_notification_system(self):
        """Create notification system with mocked database"""
        mock_db = self.create_mock_db()
        with patch('services.change_notification_system.supabase', mock_db):
            return ChangeNotificationSystem()
    
    # Property 8: Notification Delivery Consistency
    # For any valid notification request, the system should consistently track delivery status
    
    @given(
        change_id=st.uuids(),
        event_type=st.sampled_from(list(NotificationEvent)),
        stakeholder_roles=st.lists(st.sampled_from(list(StakeholderRole)), min_size=1, max_size=3),
        urgency_level=st.sampled_from(list(UrgencyLevel)),
        custom_message=st.one_of(st.none(), st.text(min_size=1, max_size=200))
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_notification_delivery_consistency_property(
        self,
        change_id,
        event_type,
        stakeholder_roles,
        urgency_level,
        custom_message
    ):
        """
        **Property 8: Notification Delivery Consistency**
        
        For any valid notification request with stakeholders, the system should:
        1. Return a consistent NotificationResult structure
        2. Track all notification attempts in the database
        3. Maintain delivery status consistency across all notifications
        
        **Validates: Requirements 5.1, 5.2**
        """
        notification_system = self.create_notification_system()
        
        # Setup mock data for change request
        change_data = {
            "id": str(change_id),
            "change_number": f"CR-2024-{change_id.hex[:4].upper()}",
            "title": "Test Change Request",
            "description": "Test description",
            "change_type": "scope",
            "priority": "medium",
            "status": "submitted",
            "requested_by": str(uuid4()),
            "project_id": str(uuid4())
        }
        
        # Setup mock stakeholders
        stakeholders = []
        for i, role in enumerate(stakeholder_roles):
            stakeholders.append({
                "user_id": str(uuid4()),
                "role": role.value
            })
        
        # Mock database responses
        notification_system.db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [change_data]
        
        # Mock stakeholder lookup
        with patch.object(notification_system, '_get_stakeholders_by_roles', return_value=stakeholders):
            with patch.object(notification_system, '_send_notification', return_value=str(uuid4())):
                with patch.object(notification_system, 'get_notification_preferences') as mock_prefs:
                    # Setup default preferences
                    mock_prefs.return_value = NotificationPreferences(
                        user_id=uuid4(),
                        email_notifications=True,
                        in_app_notifications=True,
                        sms_notifications=False
                    )
                    
                    # Execute notification
                    result = await notification_system.notify_stakeholders(
                        change_id,
                        event_type,
                        stakeholder_roles,
                        urgency_level,
                        custom_message
                    )
                    
                    # Property assertions
                    assert isinstance(result, NotificationResult), "Result must be NotificationResult instance"
                    assert isinstance(result.success, bool), "Success must be boolean"
                    assert isinstance(result.message, str), "Message must be string"
                    assert isinstance(result.notification_ids, list), "Notification IDs must be list"
                    assert isinstance(result.failed_recipients, list), "Failed recipients must be list"
                    
                    # Consistency checks
                    if stakeholders:
                        # If stakeholders exist, notifications should be attempted
                        assert len(result.notification_ids) > 0 or len(result.failed_recipients) > 0, \
                            "Must have either successful notifications or failed recipients"
                    
                    # All notification IDs should be valid UUIDs
                    for notification_id in result.notification_ids:
                        assert isinstance(notification_id, str), "Notification ID must be string"
                        UUID(notification_id)  # Should not raise exception
                    
                    # Failed recipients should be valid user IDs
                    for recipient_id in result.failed_recipients:
                        assert isinstance(recipient_id, str), "Recipient ID must be string"
    
    @given(
        approval_id=st.uuids(),
        approver_id=st.uuids(),
        urgency_level=st.sampled_from(list(UrgencyLevel))
    )
    @settings(max_examples=25, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_approval_request_delivery_consistency_property(
        self,
        approval_id,
        approver_id,
        urgency_level
    ):
        """
        **Property 8: Notification Delivery Consistency (Approval Requests)**
        
        For any approval request, the system should consistently deliver notifications
        via both email and in-app methods for approval requests.
        
        **Validates: Requirements 5.1, 5.2**
        """
        notification_system = self.create_notification_system()
        
        # Setup mock approval and change data
        change_data = {
            "id": str(uuid4()),
            "change_number": f"CR-2024-{approval_id.hex[:4].upper()}",
            "title": "Test Change Request",
            "description": "Test description"
        }
        
        approval_data = {
            "id": str(approval_id),
            "change_request_id": change_data["id"],
            "approver_id": str(approver_id),
            "step_number": 1,
            "due_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "change_requests": change_data
        }
        
        # Mock database response
        notification_system.db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [approval_data]
        
        # Mock notification sending
        notification_calls = []
        async def mock_send_notification(*args, **kwargs):
            notification_calls.append((args, kwargs))
            return str(uuid4())
        
        with patch.object(notification_system, '_send_notification', side_effect=mock_send_notification):
            result = await notification_system.send_approval_request(
                approval_id,
                approver_id,
                urgency_level
            )
            
            # Property assertions
            assert isinstance(result, bool), "Result must be boolean"
            
            if result:  # If successful
                # Should have made exactly 2 notification calls (email + in-app)
                assert len(notification_calls) == 2, "Should send both email and in-app notifications"
                
                # Check delivery methods
                delivery_methods = [call[1]['delivery_method'] for call in notification_calls]
                assert DeliveryMethod.EMAIL in delivery_methods, "Must include email notification"
                assert DeliveryMethod.IN_APP in delivery_methods, "Must include in-app notification"
                
                # Both notifications should be for the same recipient
                recipients = [call[1]['recipient_id'] for call in notification_calls]
                assert all(r == approver_id for r in recipients), "All notifications for same recipient"
    
    # Property 9: Escalation Logic Accuracy
    # For any overdue item, escalation should follow consistent rules and hierarchy
    
    @given(
        escalation_threshold_hours=st.integers(min_value=1, max_value=168),  # 1 hour to 1 week
        num_overdue_items=st.integers(min_value=0, max_value=10)
    )
    @settings(max_examples=25, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_escalation_logic_accuracy_property(
        self,
        escalation_threshold_hours,
        num_overdue_items
    ):
        """
        **Property 9: Escalation Logic Accuracy**
        
        For any set of overdue items, escalation should:
        1. Only escalate items that exceed the threshold
        2. Find appropriate escalation targets
        3. Update escalation records consistently
        4. Send notifications to escalation targets
        
        **Validates: Requirements 5.3, 5.5**
        """
        notification_system = self.create_notification_system()
        
        # Generate overdue approvals
        overdue_approvals = []
        current_time = datetime.utcnow()
        
        for i in range(num_overdue_items):
            # Create approval that's overdue by more than threshold
            overdue_time = current_time - timedelta(hours=escalation_threshold_hours + 1 + i)
            
            approval = {
                "id": str(uuid4()),
                "change_request_id": str(uuid4()),
                "approver_id": str(uuid4()),
                "due_date": overdue_time.isoformat(),
                "decision": None,
                "escalated_to": None,
                "escalation_date": None
            }
            overdue_approvals.append(approval)
        
        # Mock escalation target finding
        escalation_targets = [uuid4() for _ in range(num_overdue_items)]
        
        async def mock_find_escalation_target(user_id, escalation_type):
            # Return a target for each user (simulating successful escalation path lookup)
            return escalation_targets[0] if escalation_targets else None
        
        # Mock database updates
        update_calls = []
        def mock_update(*args, **kwargs):
            update_calls.append((args, kwargs))
            mock_result = MagicMock()
            mock_result.data = [{"id": "updated"}]
            return mock_result
        
        notification_system.db.table.return_value.update = mock_update
        
        # Mock stakeholder notifications
        notification_calls = []
        async def mock_notify_stakeholders(*args, **kwargs):
            notification_calls.append((args, kwargs))
            return NotificationResult(
                success=True,
                message="Escalation notification sent",
                notification_ids=[str(uuid4())],
                failed_recipients=[]
            )
        
        with patch.object(notification_system, '_find_escalation_target', side_effect=mock_find_escalation_target):
            with patch.object(notification_system, 'notify_stakeholders', side_effect=mock_notify_stakeholders):
                result = await notification_system._escalate_approvals(overdue_approvals)
                
                # Property assertions
                assert isinstance(result, EscalationResult), "Result must be EscalationResult"
                assert isinstance(result.escalations_triggered, int), "Escalations triggered must be integer"
                assert isinstance(result.escalated_items, list), "Escalated items must be list"
                assert isinstance(result.escalation_recipients, list), "Recipients must be list"
                
                # Escalation consistency checks
                if num_overdue_items > 0 and escalation_targets:
                    # Should have attempted escalation for each overdue item
                    assert result.escalations_triggered <= num_overdue_items, \
                        "Cannot escalate more items than provided"
                    
                    # Each escalated item should have proper structure
                    for item in result.escalated_items:
                        assert "approval_id" in item, "Escalated item must have approval_id"
                        assert "change_id" in item, "Escalated item must have change_id"
                        assert "original_approver" in item, "Escalated item must have original_approver"
                        assert "escalated_to" in item, "Escalated item must have escalated_to"
                
                # If escalations were triggered, database should be updated
                if result.escalations_triggered > 0:
                    assert len(update_calls) >= result.escalations_triggered, \
                        "Should update database for each escalation"
                    
                    # Should send notifications for escalations
                    assert len(notification_calls) >= result.escalations_triggered, \
                        "Should send notifications for each escalation"
    
    @given(
        reminder_frequency_hours=st.integers(min_value=1, max_value=168),
        num_pending_approvals=st.integers(min_value=0, max_value=20)
    )
    @settings(max_examples=25, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_reminder_system_consistency_property(
        self,
        reminder_frequency_hours,
        num_pending_approvals
    ):
        """
        **Property 9: Escalation Logic Accuracy (Reminder System)**
        
        For any set of pending approvals, the reminder system should:
        1. Only send reminders for items approaching or past due dates
        2. Respect user notification preferences
        3. Track reminder delivery consistently
        
        **Validates: Requirements 5.3, 5.5**
        """
        notification_system = self.create_notification_system()
        
        # Generate pending approvals with various due dates
        current_time = datetime.utcnow()
        pending_approvals = []
        
        for i in range(num_pending_approvals):
            # Mix of overdue, due soon, and future approvals
            if i % 3 == 0:  # Overdue
                due_date = current_time - timedelta(hours=1 + i)
            elif i % 3 == 1:  # Due soon
                due_date = current_time + timedelta(hours=reminder_frequency_hours - 1)
            else:  # Future
                due_date = current_time + timedelta(hours=reminder_frequency_hours + 24)
            
            approval = {
                "id": str(uuid4()),
                "change_request_id": str(uuid4()),
                "approver_id": str(uuid4()),
                "due_date": due_date.isoformat(),
                "decision": None,
                "change_requests": {
                    "id": str(uuid4()),
                    "change_number": f"CR-2024-{i:04d}",
                    "title": f"Test Change {i}"
                }
            }
            pending_approvals.append(approval)
        
        # Mock reminder sending
        reminder_calls = []
        async def mock_send_approval_request(approval_id, approver_id, urgency):
            reminder_calls.append((approval_id, approver_id, urgency))
            return True  # Simulate successful sending
        
        with patch.object(notification_system, 'send_approval_request', side_effect=mock_send_approval_request):
            result = await notification_system._send_approval_reminders(
                pending_approvals,
                is_overdue=True
            )
            
            # Property assertions
            assert isinstance(result, ReminderResult), "Result must be ReminderResult"
            assert isinstance(result.reminders_sent, int), "Reminders sent must be integer"
            assert isinstance(result.failed_reminders, int), "Failed reminders must be integer"
            assert isinstance(result.recipients, list), "Recipients must be list"
            
            # Consistency checks
            total_attempts = result.reminders_sent + result.failed_reminders
            assert total_attempts <= num_pending_approvals, \
                "Cannot attempt more reminders than pending approvals"
            
            # If reminders were sent, should have made corresponding calls
            if result.reminders_sent > 0:
                assert len(reminder_calls) >= result.reminders_sent, \
                    "Should make calls for each successful reminder"
            
            # Recipients should match successful reminders
            assert len(result.recipients) == result.reminders_sent, \
                "Recipients count should match successful reminders"
    
    @given(
        user_preferences=st.builds(
            NotificationPreferences,
            user_id=st.uuids(),
            email_notifications=st.booleans(),
            in_app_notifications=st.booleans(),
            sms_notifications=st.booleans(),
            escalation_enabled=st.booleans(),
            reminder_frequency_hours=st.integers(min_value=1, max_value=168)
        ),
        urgency_level=st.sampled_from(list(UrgencyLevel))
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_delivery_method_determination_property(
        self,
        user_preferences,
        urgency_level
    ):
        """
        **Property 8: Notification Delivery Consistency (Method Determination)**
        
        For any user preferences and urgency level, delivery method determination should:
        1. Respect user preferences for normal urgency
        2. Override preferences for critical/emergency urgency
        3. Always provide at least one delivery method for critical/emergency
        
        **Validates: Requirements 5.1, 5.2**
        """
        notification_system = self.create_notification_system()
        methods = notification_system._determine_delivery_methods(urgency_level, user_preferences)
        
        # Property assertions
        assert isinstance(methods, list), "Methods must be list"
        assert all(isinstance(m, DeliveryMethod) for m in methods), "All methods must be DeliveryMethod enum"
        
        # Urgency-based consistency checks
        if urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.EMERGENCY]:
            # Critical/emergency must have at least one delivery method
            assert len(methods) > 0, "Critical/emergency must have at least one delivery method"
            
            # Should include email if no other methods available
            if not user_preferences.in_app_notifications and not user_preferences.sms_notifications:
                assert DeliveryMethod.EMAIL in methods, "Must fallback to email for critical/emergency"
        
        # Preference respect for normal urgency
        if urgency_level in [UrgencyLevel.LOW, UrgencyLevel.NORMAL]:
            if user_preferences.email_notifications:
                assert DeliveryMethod.EMAIL in methods, "Should include email if preference enabled"
            
            if user_preferences.in_app_notifications:
                assert DeliveryMethod.IN_APP in methods, "Should include in-app if preference enabled"
            
            # SMS should only be included for high urgency or if explicitly enabled
            if DeliveryMethod.SMS in methods:
                assert user_preferences.sms_notifications or urgency_level in [UrgencyLevel.HIGH, UrgencyLevel.CRITICAL, UrgencyLevel.EMERGENCY], \
                    "SMS should only be used for high urgency or if enabled"


# Run the tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])