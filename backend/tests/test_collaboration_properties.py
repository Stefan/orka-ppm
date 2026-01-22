"""
Property-based tests for Collaboration Features.

These tests validate Properties 17, 18, and 19 from the
Integrated Master Schedule System design document.

**Property 17: Progress Update Consistency**
For any progress update operation, actual dates and percentage completion
should be captured correctly with proper validation.

**Property 18: Real-time Notification Accuracy**
For any schedule change, real-time updates should be broadcast correctly
to all connected users.

**Property 19: Audit Trail Completeness**
For any schedule modification, audit trail should maintain complete history
with user attribution and timestamps.

**Validates: Requirements 9.1, 9.2, 9.4, 9.5**
"""

import sys
import os
import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any, Optional, Set
from uuid import uuid4, UUID
from datetime import datetime, date, timedelta
from enum import Enum
import json

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class TaskStatus(str, Enum):
    """Task status enum for testing"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"



class ProgressUpdateValidator:
    """
    Pure implementation of progress update validation for property testing.
    
    This validates progress updates according to Requirements 9.1:
    - Progress percentage must be 0-100
    - Actual dates must be valid
    - Status transitions must be valid
    """
    
    VALID_STATUS_TRANSITIONS = {
        TaskStatus.NOT_STARTED: {TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD, TaskStatus.CANCELLED},
        TaskStatus.IN_PROGRESS: {TaskStatus.COMPLETED, TaskStatus.ON_HOLD, TaskStatus.CANCELLED},
        TaskStatus.ON_HOLD: {TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED},
        TaskStatus.COMPLETED: set(),  # Cannot transition from completed
        TaskStatus.CANCELLED: set(),  # Cannot transition from cancelled
    }
    
    @staticmethod
    def validate_progress_percentage(progress: int) -> bool:
        """Validate that progress percentage is within valid range."""
        return 0 <= progress <= 100
    
    @staticmethod
    def validate_actual_dates(
        actual_start: Optional[date],
        actual_end: Optional[date],
        planned_start: date,
        planned_end: date
    ) -> Dict[str, Any]:
        """
        Validate actual dates for a progress update.
        
        Returns validation result with is_valid flag and any errors.
        """
        errors = []
        
        # If actual end is set, actual start must also be set
        if actual_end and not actual_start:
            errors.append("actual_end_without_start")
        
        # Actual end must be >= actual start
        if actual_start and actual_end and actual_end < actual_start:
            errors.append("actual_end_before_start")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
    
    @staticmethod
    def validate_status_transition(
        current_status: TaskStatus,
        new_status: TaskStatus
    ) -> bool:
        """Validate that a status transition is allowed."""
        if current_status == new_status:
            return True  # No change is always valid
        return new_status in ProgressUpdateValidator.VALID_STATUS_TRANSITIONS.get(current_status, set())
    
    @staticmethod
    def validate_progress_status_consistency(
        progress: int,
        status: TaskStatus
    ) -> Dict[str, Any]:
        """
        Validate that progress percentage is consistent with status.
        
        - NOT_STARTED should have 0% progress
        - COMPLETED should have 100% progress
        - IN_PROGRESS should have 1-99% progress
        """
        warnings = []
        
        if status == TaskStatus.NOT_STARTED and progress != 0:
            warnings.append("not_started_with_progress")
        
        if status == TaskStatus.COMPLETED and progress != 100:
            warnings.append("completed_without_100_percent")
        
        if status == TaskStatus.IN_PROGRESS and (progress == 0 or progress == 100):
            warnings.append("in_progress_at_boundary")
        
        return {
            "is_consistent": len(warnings) == 0,
            "warnings": warnings
        }
    
    @staticmethod
    def apply_progress_update(
        task: Dict[str, Any],
        progress: int,
        status: TaskStatus,
        actual_start: Optional[date] = None,
        actual_end: Optional[date] = None,
        notes: Optional[str] = None,
        updated_by: UUID = None
    ) -> Dict[str, Any]:
        """
        Apply a progress update to a task and return the updated task.
        
        Returns the updated task with all fields properly set.
        """
        updated_task = task.copy()
        
        # Validate progress percentage
        if not ProgressUpdateValidator.validate_progress_percentage(progress):
            raise ValueError(f"Invalid progress percentage: {progress}")
        
        # Validate dates
        date_validation = ProgressUpdateValidator.validate_actual_dates(
            actual_start,
            actual_end,
            task.get("planned_start_date"),
            task.get("planned_end_date")
        )
        if not date_validation["is_valid"]:
            raise ValueError(f"Invalid dates: {date_validation['errors']}")
        
        # Apply updates
        updated_task["progress_percentage"] = progress
        updated_task["status"] = status.value
        updated_task["updated_at"] = datetime.utcnow()
        updated_task["updated_by"] = str(updated_by) if updated_by else None
        
        if actual_start:
            updated_task["actual_start_date"] = actual_start
        if actual_end:
            updated_task["actual_end_date"] = actual_end
        if notes:
            updated_task["notes"] = notes
        
        return updated_task



class NotificationBroadcaster:
    """
    Pure implementation of notification broadcasting for property testing.
    
    This validates real-time notifications according to Requirements 9.2, 9.5:
    - All connected users should receive updates
    - Notifications should contain correct data
    - Sender should be excluded from broadcast
    """
    
    def __init__(self):
        self.connected_users: Set[str] = set()
        self.notifications_sent: List[Dict[str, Any]] = []
        self.notification_log: List[Dict[str, Any]] = []
    
    def connect_user(self, user_id: str) -> None:
        """Connect a user to receive notifications."""
        self.connected_users.add(user_id)
    
    def disconnect_user(self, user_id: str) -> None:
        """Disconnect a user from notifications."""
        self.connected_users.discard(user_id)
    
    def broadcast_notification(
        self,
        notification_type: str,
        data: Dict[str, Any],
        sender_id: str,
        exclude_sender: bool = True
    ) -> Dict[str, Any]:
        """
        Broadcast a notification to all connected users.
        
        Returns broadcast result with recipients and notification data.
        """
        timestamp = datetime.utcnow()
        
        # Determine recipients
        recipients = self.connected_users.copy()
        if exclude_sender and sender_id in recipients:
            recipients.discard(sender_id)
        
        notification = {
            "type": notification_type,
            "data": data,
            "sender_id": sender_id,
            "timestamp": timestamp.isoformat(),
            "recipients": list(recipients)
        }
        
        # Log the notification
        self.notification_log.append(notification)
        
        # Track sent notifications per recipient
        for recipient in recipients:
            self.notifications_sent.append({
                "recipient": recipient,
                "notification": notification
            })
        
        return {
            "success": True,
            "recipients_count": len(recipients),
            "recipients": list(recipients),
            "notification": notification
        }
    
    def get_user_notifications(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all notifications sent to a specific user."""
        return [
            n["notification"] for n in self.notifications_sent
            if n["recipient"] == user_id
        ]
    
    def get_notification_count(self) -> int:
        """Get total number of notifications sent."""
        return len(self.notifications_sent)
    
    def clear_notifications(self) -> None:
        """Clear all notification history."""
        self.notifications_sent.clear()
        self.notification_log.clear()



class AuditTrailManager:
    """
    Pure implementation of audit trail management for property testing.
    
    This validates audit trail according to Requirements 9.4:
    - All modifications should be logged
    - User attribution should be captured
    - Timestamps should be accurate
    - Complete history should be maintained
    """
    
    def __init__(self):
        self.audit_entries: List[Dict[str, Any]] = []
    
    def log_modification(
        self,
        action: str,
        resource_type: str,
        resource_id: UUID,
        user_id: UUID,
        changes: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Log a modification to the audit trail.
        
        Returns the created audit entry.
        """
        timestamp = datetime.utcnow()
        
        audit_entry = {
            "id": str(uuid4()),
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "user_id": str(user_id),
            "changes": changes,
            "metadata": metadata or {},
            "timestamp": timestamp.isoformat(),
            "created_at": timestamp.isoformat()
        }
        
        self.audit_entries.append(audit_entry)
        return audit_entry
    
    def get_resource_history(
        self,
        resource_id: UUID,
        resource_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get complete audit history for a resource."""
        history = [
            entry for entry in self.audit_entries
            if entry["resource_id"] == str(resource_id)
        ]
        
        if resource_type:
            history = [e for e in history if e["resource_type"] == resource_type]
        
        # Sort by timestamp (newest first)
        history.sort(key=lambda x: x["timestamp"], reverse=True)
        return history
    
    def get_user_activity(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get all audit entries for a specific user."""
        activity = [
            entry for entry in self.audit_entries
            if entry["user_id"] == str(user_id)
        ]
        
        if start_date:
            activity = [
                e for e in activity
                if datetime.fromisoformat(e["timestamp"]) >= start_date
            ]
        
        if end_date:
            activity = [
                e for e in activity
                if datetime.fromisoformat(e["timestamp"]) <= end_date
            ]
        
        return activity
    
    def verify_entry_completeness(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify that an audit entry has all required fields.
        
        Returns validation result with missing fields if any.
        """
        required_fields = ["id", "action", "resource_type", "resource_id", 
                          "user_id", "timestamp", "created_at"]
        
        missing_fields = [f for f in required_fields if f not in entry or entry[f] is None]
        
        return {
            "is_complete": len(missing_fields) == 0,
            "missing_fields": missing_fields
        }
    
    def get_entry_count(self) -> int:
        """Get total number of audit entries."""
        return len(self.audit_entries)
    
    def clear_entries(self) -> None:
        """Clear all audit entries (for testing)."""
        self.audit_entries.clear()



# Hypothesis strategies for generating test data
@st.composite
def progress_update_strategy(draw):
    """Generate a valid progress update."""
    progress = draw(st.integers(min_value=0, max_value=100))
    status = draw(st.sampled_from(list(TaskStatus)))
    
    # Generate dates
    base_date = date(2025, 1, 1)
    actual_start = draw(st.one_of(
        st.none(),
        st.dates(min_value=base_date, max_value=date(2026, 12, 31))
    ))
    
    # If actual_start is set, actual_end should be >= actual_start
    if actual_start:
        actual_end = draw(st.one_of(
            st.none(),
            st.dates(min_value=actual_start, max_value=date(2026, 12, 31))
        ))
    else:
        actual_end = None
    
    notes = draw(st.one_of(st.none(), st.text(min_size=0, max_size=500)))
    
    return {
        "progress": progress,
        "status": status,
        "actual_start": actual_start,
        "actual_end": actual_end,
        "notes": notes
    }


@st.composite
def task_strategy(draw):
    """Generate a task for testing."""
    base_date = date(2025, 1, 1)
    planned_start = draw(st.dates(min_value=base_date, max_value=date(2025, 12, 31)))
    duration = draw(st.integers(min_value=1, max_value=365))
    planned_end = planned_start + timedelta(days=duration)
    
    return {
        "id": str(uuid4()),
        "name": draw(st.text(min_size=1, max_size=100, alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')))),
        "planned_start_date": planned_start,
        "planned_end_date": planned_end,
        "progress_percentage": draw(st.integers(min_value=0, max_value=100)),
        "status": draw(st.sampled_from([s.value for s in TaskStatus])),
        "actual_start_date": None,
        "actual_end_date": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }


@st.composite
def user_ids_strategy(draw, min_size=1, max_size=10):
    """Generate a list of user IDs."""
    count = draw(st.integers(min_value=min_size, max_value=max_size))
    return [str(uuid4()) for _ in range(count)]


@st.composite
def notification_data_strategy(draw):
    """Generate notification data."""
    notification_types = [
        "task_updated", "progress_changed", "status_changed",
        "dependency_added", "dependency_removed", "comment_added",
        "milestone_reached", "schedule_changed"
    ]
    
    return {
        "type": draw(st.sampled_from(notification_types)),
        "task_id": str(uuid4()),
        "changes": {
            "field": draw(st.sampled_from(["progress", "status", "dates", "assignee"])),
            "old_value": draw(st.text(min_size=0, max_size=50)),
            "new_value": draw(st.text(min_size=0, max_size=50))
        }
    }


@st.composite
def audit_action_strategy(draw):
    """Generate an audit action."""
    actions = [
        "task_created", "task_updated", "task_deleted",
        "progress_updated", "status_changed", "dependency_added",
        "dependency_removed", "resource_assigned", "resource_removed",
        "comment_added", "comment_resolved", "milestone_updated"
    ]
    return draw(st.sampled_from(actions))



class TestProgressUpdateConsistencyProperties:
    """
    Property-based tests for Property 17: Progress Update Consistency.
    
    For any progress update operation, actual dates and percentage completion
    should be captured correctly with proper validation.
    
    **Validates: Requirements 9.1, 10.2**
    """
    
    def setup_method(self):
        """Set up test environment."""
        self.validator = ProgressUpdateValidator()
    
    @given(st.integers(min_value=0, max_value=100))
    @settings(max_examples=100)
    def test_property_17_valid_progress_percentage_accepted(self, progress: int):
        """
        Property 17.1: Valid Progress Percentage Accepted
        
        Any progress percentage between 0 and 100 should be accepted.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        is_valid = self.validator.validate_progress_percentage(progress)
        assert is_valid, f"Progress {progress} should be valid"
    
    @given(st.integers().filter(lambda x: x < 0 or x > 100))
    @settings(max_examples=100)
    def test_property_17_invalid_progress_percentage_rejected(self, progress: int):
        """
        Property 17.2: Invalid Progress Percentage Rejected
        
        Any progress percentage outside 0-100 should be rejected.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        is_valid = self.validator.validate_progress_percentage(progress)
        assert not is_valid, f"Progress {progress} should be invalid"
    
    @given(
        st.dates(min_value=date(2025, 1, 1), max_value=date(2025, 12, 31)),
        st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=100)
    def test_property_17_actual_dates_consistency(self, start_date: date, duration: int):
        """
        Property 17.3: Actual Dates Consistency
        
        When actual_end is set, actual_start must also be set, and
        actual_end must be >= actual_start.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        end_date = start_date + timedelta(days=duration)
        planned_start = date(2025, 1, 1)
        planned_end = date(2025, 12, 31)
        
        # Valid case: both dates set with end >= start
        result = self.validator.validate_actual_dates(
            start_date, end_date, planned_start, planned_end
        )
        assert result["is_valid"], "Valid dates should pass validation"
        
        # Invalid case: end without start
        result = self.validator.validate_actual_dates(
            None, end_date, planned_start, planned_end
        )
        assert not result["is_valid"], "End without start should fail"
        assert "actual_end_without_start" in result["errors"]
    
    @given(
        st.dates(min_value=date(2025, 1, 1), max_value=date(2025, 6, 30)),
        st.dates(min_value=date(2025, 7, 1), max_value=date(2025, 12, 31))
    )
    @settings(max_examples=100)
    def test_property_17_actual_end_before_start_rejected(self, early_date: date, late_date: date):
        """
        Property 17.4: Actual End Before Start Rejected
        
        When actual_end is before actual_start, validation should fail.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        planned_start = date(2025, 1, 1)
        planned_end = date(2025, 12, 31)
        
        # Invalid: end before start
        result = self.validator.validate_actual_dates(
            late_date, early_date, planned_start, planned_end
        )
        assert not result["is_valid"], "End before start should fail"
        assert "actual_end_before_start" in result["errors"]
    
    @given(st.sampled_from(list(TaskStatus)), st.sampled_from(list(TaskStatus)))
    @settings(max_examples=100)
    def test_property_17_status_transition_validation(
        self, current_status: TaskStatus, new_status: TaskStatus
    ):
        """
        Property 17.5: Status Transition Validation
        
        Status transitions should follow valid transition rules.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        is_valid = self.validator.validate_status_transition(current_status, new_status)
        
        # Same status is always valid
        if current_status == new_status:
            assert is_valid, "Same status transition should be valid"
        
        # Completed and Cancelled cannot transition
        if current_status in {TaskStatus.COMPLETED, TaskStatus.CANCELLED}:
            if new_status != current_status:
                assert not is_valid, f"Cannot transition from {current_status}"


    
    @given(st.integers(min_value=0, max_value=100), st.sampled_from(list(TaskStatus)))
    @settings(max_examples=100)
    def test_property_17_progress_status_consistency_check(
        self, progress: int, status: TaskStatus
    ):
        """
        Property 17.6: Progress Status Consistency Check
        
        Progress percentage should be consistent with task status.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        result = self.validator.validate_progress_status_consistency(progress, status)
        
        # NOT_STARTED with progress > 0 should warn
        if status == TaskStatus.NOT_STARTED and progress != 0:
            assert not result["is_consistent"]
            assert "not_started_with_progress" in result["warnings"]
        
        # COMPLETED without 100% should warn
        if status == TaskStatus.COMPLETED and progress != 100:
            assert not result["is_consistent"]
            assert "completed_without_100_percent" in result["warnings"]
    
    @given(task_strategy(), progress_update_strategy())
    @settings(max_examples=100)
    def test_property_17_progress_update_captures_all_fields(
        self, task: Dict[str, Any], update: Dict[str, Any]
    ):
        """
        Property 17.7: Progress Update Captures All Fields
        
        A progress update should correctly capture all provided fields.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        user_id = uuid4()
        
        try:
            updated_task = self.validator.apply_progress_update(
                task,
                update["progress"],
                update["status"],
                update["actual_start"],
                update["actual_end"],
                update["notes"],
                user_id
            )
            
            # Verify progress was captured
            assert updated_task["progress_percentage"] == update["progress"]
            
            # Verify status was captured
            assert updated_task["status"] == update["status"].value
            
            # Verify dates were captured if provided
            if update["actual_start"]:
                assert updated_task["actual_start_date"] == update["actual_start"]
            if update["actual_end"]:
                assert updated_task["actual_end_date"] == update["actual_end"]
            
            # Verify user attribution
            assert updated_task["updated_by"] == str(user_id)
            
            # Verify timestamp was updated
            assert updated_task["updated_at"] is not None
            
        except ValueError:
            # Invalid updates should raise ValueError
            pass
    
    @given(task_strategy())
    @settings(max_examples=100)
    def test_property_17_progress_update_is_deterministic(self, task: Dict[str, Any]):
        """
        Property 17.8: Progress Update Is Deterministic
        
        The same progress update applied to the same task should produce
        consistent results.
        
        **Feature: integrated-master-schedule, Property 17: Progress Update Consistency**
        **Validates: Requirements 9.1**
        """
        user_id = uuid4()
        progress = 50
        status = TaskStatus.IN_PROGRESS
        
        result1 = self.validator.apply_progress_update(
            task.copy(), progress, status, None, None, None, user_id
        )
        result2 = self.validator.apply_progress_update(
            task.copy(), progress, status, None, None, None, user_id
        )
        
        # Core fields should match
        assert result1["progress_percentage"] == result2["progress_percentage"]
        assert result1["status"] == result2["status"]
        assert result1["updated_by"] == result2["updated_by"]



class TestRealTimeNotificationAccuracyProperties:
    """
    Property-based tests for Property 18: Real-time Notification Accuracy.
    
    For any schedule change, real-time updates should be broadcast correctly
    to all connected users.
    
    **Validates: Requirements 9.2, 9.5**
    """
    
    def setup_method(self):
        """Set up test environment with fresh broadcaster."""
        self.broadcaster = NotificationBroadcaster()
        # Clear any existing state
        self.broadcaster.connected_users.clear()
        self.broadcaster.notifications_sent.clear()
        self.broadcaster.notification_log.clear()
    
    @given(user_ids_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_property_18_all_connected_users_receive_notification(
        self, user_ids: List[str]
    ):
        """
        Property 18.1: All Connected Users Receive Notification
        
        When a notification is broadcast, all connected users (except sender)
        should receive it.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        
        result = broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4()), "changes": {"progress": 50}},
            sender_id,
            exclude_sender=True
        )
        
        # All users except sender should receive
        expected_recipients = set(user_ids) - {sender_id}
        actual_recipients = set(result["recipients"])
        
        assert actual_recipients == expected_recipients, \
            f"Expected {expected_recipients}, got {actual_recipients}"
        
        # Verify each recipient got the notification
        for user_id in expected_recipients:
            notifications = broadcaster.get_user_notifications(user_id)
            assert len(notifications) == 1, f"User {user_id} should have 1 notification"
    
    @given(user_ids_strategy(min_size=2, max_size=10), notification_data_strategy())
    @settings(max_examples=100)
    def test_property_18_notification_data_integrity(
        self, user_ids: List[str], notification_data: Dict[str, Any]
    ):
        """
        Property 18.2: Notification Data Integrity
        
        The notification data received by users should match the original data.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        
        result = broadcaster.broadcast_notification(
            notification_data["type"],
            notification_data,
            sender_id
        )
        
        # Verify notification data matches
        notification = result["notification"]
        assert notification["type"] == notification_data["type"]
        assert notification["data"] == notification_data
        assert notification["sender_id"] == sender_id
    
    @given(user_ids_strategy(min_size=1, max_size=10))
    @settings(max_examples=100)
    def test_property_18_sender_excluded_when_requested(self, user_ids: List[str]):
        """
        Property 18.3: Sender Excluded When Requested
        
        When exclude_sender is True, the sender should not receive the notification.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        
        broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4())},
            sender_id,
            exclude_sender=True
        )
        
        # Sender should not have received the notification
        sender_notifications = broadcaster.get_user_notifications(sender_id)
        assert len(sender_notifications) == 0, "Sender should not receive notification"
    
    @given(user_ids_strategy(min_size=1, max_size=10))
    @settings(max_examples=100)
    def test_property_18_sender_included_when_not_excluded(self, user_ids: List[str]):
        """
        Property 18.4: Sender Included When Not Excluded
        
        When exclude_sender is False, the sender should also receive the notification.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        
        broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4())},
            sender_id,
            exclude_sender=False
        )
        
        # Sender should have received the notification
        sender_notifications = broadcaster.get_user_notifications(sender_id)
        assert len(sender_notifications) == 1, "Sender should receive notification"


    
    @given(user_ids_strategy(min_size=3, max_size=10))
    @settings(max_examples=100)
    def test_property_18_disconnected_users_not_notified(self, user_ids: List[str]):
        """
        Property 18.5: Disconnected Users Not Notified
        
        Users who have disconnected should not receive notifications.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        # Disconnect one user
        disconnected_user = user_ids[1]
        broadcaster.disconnect_user(disconnected_user)
        
        sender_id = user_ids[0]
        
        result = broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4())},
            sender_id,
            exclude_sender=True
        )
        
        # Disconnected user should not be in recipients
        assert disconnected_user not in result["recipients"]
        
        # Disconnected user should not have notifications
        notifications = broadcaster.get_user_notifications(disconnected_user)
        assert len(notifications) == 0
    
    @given(user_ids_strategy(min_size=2, max_size=5), st.integers(min_value=1, max_value=5))
    @settings(max_examples=100)
    def test_property_18_multiple_notifications_delivered_in_order(
        self, user_ids: List[str], notification_count: int
    ):
        """
        Property 18.6: Multiple Notifications Delivered In Order
        
        Multiple notifications should be delivered to users in the order sent.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        recipient_id = user_ids[1]
        
        # Send multiple notifications
        for i in range(notification_count):
            broadcaster.broadcast_notification(
                f"notification_{i}",
                {"sequence": i},
                sender_id,
                exclude_sender=True
            )
        
        # Verify recipient received all notifications in order
        notifications = broadcaster.get_user_notifications(recipient_id)
        assert len(notifications) == notification_count
        
        for i, notification in enumerate(notifications):
            assert notification["data"]["sequence"] == i
    
    @given(user_ids_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_property_18_notification_contains_timestamp(self, user_ids: List[str]):
        """
        Property 18.7: Notification Contains Timestamp
        
        Every notification should contain a valid timestamp.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2, 9.5**
        """
        # Create fresh broadcaster for each test example
        broadcaster = NotificationBroadcaster()
        
        # Connect all users
        for user_id in user_ids:
            broadcaster.connect_user(user_id)
        
        sender_id = user_ids[0]
        
        result = broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4())},
            sender_id
        )
        
        # Verify timestamp exists and is valid
        notification = result["notification"]
        assert "timestamp" in notification
        
        # Verify timestamp can be parsed
        timestamp = datetime.fromisoformat(notification["timestamp"])
        assert timestamp is not None
    
    def test_property_18_empty_connected_users_no_notifications(self):
        """
        Property 18.8: Empty Connected Users No Notifications
        
        When no users are connected, no notifications should be sent.
        
        **Feature: integrated-master-schedule, Property 18: Real-time Notification Accuracy**
        **Validates: Requirements 9.2**
        """
        # Create fresh broadcaster for this test
        broadcaster = NotificationBroadcaster()
        
        sender_id = str(uuid4())
        
        result = broadcaster.broadcast_notification(
            "task_updated",
            {"task_id": str(uuid4())},
            sender_id
        )
        
        assert result["recipients_count"] == 0
        assert len(result["recipients"]) == 0



class TestAuditTrailCompletenessProperties:
    """
    Property-based tests for Property 19: Audit Trail Completeness.
    
    For any schedule modification, audit trail should maintain complete history
    with user attribution and timestamps.
    
    **Validates: Requirements 9.4**
    """
    
    def setup_method(self):
        """Set up test environment with fresh audit manager."""
        self.audit_manager = AuditTrailManager()
        # Clear any existing state
        self.audit_manager.audit_entries.clear()
    
    @given(audit_action_strategy(), st.text(min_size=1, max_size=50))
    @settings(max_examples=100)
    def test_property_19_all_modifications_logged(
        self, action: str, resource_type: str
    ):
        """
        Property 19.1: All Modifications Logged
        
        Every modification should create an audit entry.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        changes = {"field": "value", "old": "old_value", "new": "new_value"}
        
        initial_count = audit_manager.get_entry_count()
        
        entry = audit_manager.log_modification(
            action, resource_type, resource_id, user_id, changes
        )
        
        # Verify entry was created
        assert audit_manager.get_entry_count() == initial_count + 1
        assert entry is not None
        assert entry["action"] == action
    
    @given(audit_action_strategy())
    @settings(max_examples=100)
    def test_property_19_user_attribution_captured(self, action: str):
        """
        Property 19.2: User Attribution Captured
        
        Every audit entry should have user attribution.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        entry = audit_manager.log_modification(
            action, "task", resource_id, user_id, {"change": "value"}
        )
        
        # Verify user attribution
        assert entry["user_id"] == str(user_id)
        assert entry["user_id"] is not None
    
    @given(audit_action_strategy())
    @settings(max_examples=100)
    def test_property_19_timestamp_captured(self, action: str):
        """
        Property 19.3: Timestamp Captured
        
        Every audit entry should have a valid timestamp.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        before_time = datetime.utcnow()
        
        entry = audit_manager.log_modification(
            action, "task", resource_id, user_id, {"change": "value"}
        )
        
        after_time = datetime.utcnow()
        
        # Verify timestamp exists and is valid
        assert "timestamp" in entry
        timestamp = datetime.fromisoformat(entry["timestamp"])
        
        # Timestamp should be between before and after
        assert before_time <= timestamp <= after_time
    
    @given(st.integers(min_value=1, max_value=10))
    @settings(max_examples=100)
    def test_property_19_complete_history_maintained(self, modification_count: int):
        """
        Property 19.4: Complete History Maintained
        
        All modifications to a resource should be retrievable.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        # Make multiple modifications
        for i in range(modification_count):
            audit_manager.log_modification(
                f"modification_{i}",
                "task",
                resource_id,
                user_id,
                {"sequence": i}
            )
        
        # Retrieve history
        history = audit_manager.get_resource_history(resource_id)
        
        # All modifications should be in history
        assert len(history) == modification_count
        
        # Verify all modifications are present
        sequences = {entry["changes"]["sequence"] for entry in history}
        expected_sequences = set(range(modification_count))
        assert sequences == expected_sequences


    
    @given(audit_action_strategy())
    @settings(max_examples=100)
    def test_property_19_entry_completeness_validation(self, action: str):
        """
        Property 19.5: Entry Completeness Validation
        
        Every audit entry should have all required fields.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        entry = audit_manager.log_modification(
            action, "task", resource_id, user_id, {"change": "value"}
        )
        
        # Verify completeness
        result = audit_manager.verify_entry_completeness(entry)
        
        assert result["is_complete"], f"Entry missing fields: {result['missing_fields']}"
        assert len(result["missing_fields"]) == 0
    
    @given(st.integers(min_value=2, max_value=5))
    @settings(max_examples=100)
    def test_property_19_user_activity_tracking(self, activity_count: int):
        """
        Property 19.6: User Activity Tracking
        
        All activities by a user should be retrievable.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        user_id = uuid4()
        
        # Create activities for the user
        for i in range(activity_count):
            audit_manager.log_modification(
                f"action_{i}",
                "task",
                uuid4(),
                user_id,
                {"activity": i}
            )
        
        # Create activities for another user
        other_user_id = uuid4()
        audit_manager.log_modification(
            "other_action",
            "task",
            uuid4(),
            other_user_id,
            {"activity": "other"}
        )
        
        # Retrieve user activity
        activity = audit_manager.get_user_activity(user_id)
        
        # Should only contain the user's activities
        assert len(activity) == activity_count
        for entry in activity:
            assert entry["user_id"] == str(user_id)
    
    @given(st.integers(min_value=1, max_value=5))
    @settings(max_examples=100)
    def test_property_19_history_ordered_by_timestamp(self, modification_count: int):
        """
        Property 19.7: History Ordered By Timestamp
        
        Resource history should be ordered by timestamp (newest first).
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        # Make modifications
        for i in range(modification_count):
            audit_manager.log_modification(
                f"modification_{i}",
                "task",
                resource_id,
                user_id,
                {"sequence": i}
            )
        
        # Retrieve history
        history = audit_manager.get_resource_history(resource_id)
        
        # Verify ordering (newest first)
        timestamps = [datetime.fromisoformat(e["timestamp"]) for e in history]
        for i in range(len(timestamps) - 1):
            assert timestamps[i] >= timestamps[i + 1], "History should be newest first"
    
    @given(audit_action_strategy(), st.dictionaries(
        st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L',))),
        st.text(min_size=0, max_size=50),
        min_size=1,
        max_size=5
    ))
    @settings(max_examples=100)
    def test_property_19_changes_captured_accurately(
        self, action: str, changes: Dict[str, str]
    ):
        """
        Property 19.8: Changes Captured Accurately
        
        The changes dictionary should be captured exactly as provided.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        entry = audit_manager.log_modification(
            action, "task", resource_id, user_id, changes
        )
        
        # Verify changes match
        assert entry["changes"] == changes
    
    @given(audit_action_strategy())
    @settings(max_examples=100)
    def test_property_19_unique_entry_ids(self, action: str):
        """
        Property 19.9: Unique Entry IDs
        
        Every audit entry should have a unique ID.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for each test example
        audit_manager = AuditTrailManager()
        
        resource_id = uuid4()
        user_id = uuid4()
        
        # Create multiple entries
        entries = []
        for _ in range(5):
            entry = audit_manager.log_modification(
                action, "task", resource_id, user_id, {"change": "value"}
            )
            entries.append(entry)
        
        # Verify all IDs are unique
        ids = [e["id"] for e in entries]
        assert len(ids) == len(set(ids)), "All entry IDs should be unique"
    
    def test_property_19_empty_history_for_new_resource(self):
        """
        Property 19.10: Empty History For New Resource
        
        A resource with no modifications should have empty history.
        
        **Feature: integrated-master-schedule, Property 19: Audit Trail Completeness**
        **Validates: Requirements 9.4**
        """
        # Create fresh audit manager for this test
        audit_manager = AuditTrailManager()
        
        new_resource_id = uuid4()
        
        history = audit_manager.get_resource_history(new_resource_id)
        
        assert len(history) == 0, "New resource should have empty history"



def run_property_tests():
    """Run all property-based tests."""
    print("🚀 Running Collaboration Property Tests")
    print("=" * 60)
    print("Property 17: Progress Update Consistency")
    print("Property 18: Real-time Notification Accuracy")
    print("Property 19: Audit Trail Completeness")
    print("Validates: Requirements 9.1, 9.2, 9.4, 9.5")
    print("=" * 60)
    
    # Run pytest with this file
    test_file = __file__
    exit_code = pytest.main([
        test_file,
        "-v",
        "--tb=short",
        "-x"  # Stop on first failure
    ])
    
    return exit_code == 0


if __name__ == "__main__":
    success = run_property_tests()
    if success:
        print("\n🎉 All collaboration property tests passed!")
    else:
        print("\n❌ Some property tests failed.")
    
    sys.exit(0 if success else 1)
