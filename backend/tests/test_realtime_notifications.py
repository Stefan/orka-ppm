"""
Real-time Updates and Notification System Integration Tests

This module contains integration tests for real-time updates, notification systems,
and event-driven workflows in the AI-PPM platform.

Test Coverage:
- Real-time dashboard updates via Supabase subscriptions
- Notification system workflows (email, in-app, webhook)
- Event-driven workflow triggers
- WebSocket communication patterns
- Cross-component notification propagation
- Notification delivery reliability and retry mechanisms

Requirements Validated: 1.1, 7.5, 8.4, 9.1
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor

# Import test setup
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from main import app
from test_e2e_integration import TestDataManager, test_supabase

client = TestClient(app)


class MockSupabaseRealtime:
    """Mock Supabase real-time subscription system"""
    
    def __init__(self):
        self.subscriptions = {}
        self.event_handlers = {}
        self.is_connected = False
        
    def subscribe(self, table: str, event: str = "*"):
        """Mock subscription to table changes"""
        subscription_id = f"{table}_{event}_{uuid.uuid4().hex[:8]}"
        self.subscriptions[subscription_id] = {
            "table": table,
            "event": event,
            "active": True
        }
        return subscription_id
    
    def on(self, event: str, handler):
        """Register event handler"""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    def trigger_event(self, event: str, payload: Dict[str, Any]):
        """Simulate real-time event"""
        if event in self.event_handlers:
            for handler in self.event_handlers[event]:
                try:
                    handler(payload)
                except Exception as e:
                    print(f"Event handler error: {e}")
    
    def connect(self):
        """Mock connection"""
        self.is_connected = True
        return True
    
    def disconnect(self):
        """Mock disconnection"""
        self.is_connected = False
        self.subscriptions.clear()
        self.event_handlers.clear()


class MockNotificationService:
    """Mock notification service for testing"""
    
    def __init__(self):
        self.sent_notifications = []
        self.email_queue = []
        self.webhook_queue = []
        self.in_app_notifications = []
        
    def send_email(self, to: str, subject: str, body: str, template: str = None):
        """Mock email sending"""
        notification = {
            "type": "email",
            "to": to,
            "subject": subject,
            "body": body,
            "template": template,
            "sent_at": datetime.now(),
            "status": "sent"
        }
        self.email_queue.append(notification)
        self.sent_notifications.append(notification)
        return {"message_id": f"email_{uuid.uuid4().hex[:8]}", "status": "sent"}
    
    def send_webhook(self, url: str, payload: Dict[str, Any], headers: Dict[str, str] = None):
        """Mock webhook sending"""
        notification = {
            "type": "webhook",
            "url": url,
            "payload": payload,
            "headers": headers or {},
            "sent_at": datetime.now(),
            "status": "sent"
        }
        self.webhook_queue.append(notification)
        self.sent_notifications.append(notification)
        return {"status": "sent", "response_code": 200}
    
    def create_in_app_notification(self, user_id: str, title: str, message: str, 
                                 notification_type: str = "info", action_url: str = None):
        """Mock in-app notification creation"""
        notification = {
            "type": "in_app",
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "action_url": action_url,
            "created_at": datetime.now(),
            "read": False,
            "id": f"notif_{uuid.uuid4().hex[:8]}"
        }
        self.in_app_notifications.append(notification)
        self.sent_notifications.append(notification)
        return notification
    
    def get_notifications_for_user(self, user_id: str, unread_only: bool = False):
        """Get notifications for a specific user"""
        user_notifications = [
            n for n in self.in_app_notifications 
            if n.get("user_id") == user_id
        ]
        
        if unread_only:
            user_notifications = [n for n in user_notifications if not n.get("read", False)]
        
        return user_notifications
    
    def mark_as_read(self, notification_id: str):
        """Mark notification as read"""
        for notification in self.in_app_notifications:
            if notification["id"] == notification_id:
                notification["read"] = True
                return True
        return False


@pytest.fixture
def mock_realtime():
    """Fixture providing mock real-time system"""
    return MockSupabaseRealtime()


@pytest.fixture
def mock_notifications():
    """Fixture providing mock notification service"""
    return MockNotificationService()


class TestRealtimeUpdates:
    """Test real-time update functionality"""
    
    def test_project_status_realtime_updates(self, mock_realtime, mock_notifications):
        """
        Test real-time updates when project status changes
        Validates: Requirements 1.1, 8.4
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Realtime Test Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Realtime Test Project")
            
            # Setup real-time subscription mock
            subscription_events = []
            
            def capture_event(payload):
                subscription_events.append(payload)
            
            mock_realtime.on("project_update", capture_event)
            mock_realtime.connect()
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.supabase.realtime', mock_realtime), \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Subscribe to project updates
                subscription_request = {
                    "table": "projects",
                    "event": "UPDATE",
                    "filter": f"id=eq.{project['id']}"
                }
                
                response = client.post("/realtime/subscribe", json=subscription_request)
                assert response.status_code == 200
                subscription = response.json()
                assert "subscription_id" in subscription
                
                # Step 2: Update project status (should trigger real-time event)
                update_data = {
                    "status": "active",
                    "health": "green"
                }
                
                response = client.put(f"/projects/{project['id']}", json=update_data)
                assert response.status_code == 200
                updated_project = response.json()
                
                # Step 3: Simulate real-time event trigger
                realtime_payload = {
                    "table": "projects",
                    "event": "UPDATE",
                    "new": updated_project,
                    "old": {"status": "planning", "health": "yellow"},
                    "timestamp": datetime.now().isoformat()
                }
                
                mock_realtime.trigger_event("project_update", realtime_payload)
                
                # Step 4: Verify event was captured
                assert len(subscription_events) == 1
                captured_event = subscription_events[0]
                assert captured_event["table"] == "projects"
                assert captured_event["event"] == "UPDATE"
                assert captured_event["new"]["status"] == "active"
                assert captured_event["old"]["status"] == "planning"
                
                # Step 5: Verify dashboard data reflects changes
                response = client.get("/dashboard")
                assert response.status_code == 200
                dashboard_data = response.json()
                
                # Find updated project in dashboard
                dashboard_projects = dashboard_data.get("projects", [])
                updated_dashboard_project = next(
                    (p for p in dashboard_projects if p["id"] == project["id"]), 
                    None
                )
                
                assert updated_dashboard_project is not None
                assert updated_dashboard_project["status"] == "active"
                assert updated_dashboard_project["health"] == "green"
                
        finally:
            test_data_manager.cleanup()
    
    def test_portfolio_metrics_realtime_aggregation(self, mock_realtime, mock_notifications):
        """
        Test real-time portfolio metrics updates when projects change
        Validates: Requirements 1.2, 1.1
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Metrics Test Portfolio")
            project1 = test_data_manager.create_test_project(portfolio["id"], "Project One")
            project2 = test_data_manager.create_test_project(portfolio["id"], "Project Two")
            
            metrics_updates = []
            
            def capture_metrics_update(payload):
                metrics_updates.append(payload)
            
            mock_realtime.on("portfolio_metrics_update", capture_metrics_update)
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.supabase.realtime', mock_realtime):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Get initial portfolio metrics
                response = client.get("/portfolio/metrics")
                assert response.status_code == 200
                initial_metrics = response.json()
                initial_project_count = initial_metrics.get("total_projects", 0)
                
                # Step 2: Update project budget (should trigger metrics recalculation)
                budget_update = {"budget": 150000.0}
                response = client.put(f"/projects/{project1['id']}", json=budget_update)
                assert response.status_code == 200
                
                # Step 3: Simulate portfolio metrics update event
                metrics_payload = {
                    "portfolio_id": portfolio["id"],
                    "metrics": {
                        "total_projects": initial_project_count,
                        "total_budget": 200000.0,  # Updated total
                        "active_projects": 2,
                        "completed_projects": 0,
                        "average_health_score": 0.8
                    },
                    "updated_at": datetime.now().isoformat()
                }
                
                mock_realtime.trigger_event("portfolio_metrics_update", metrics_payload)
                
                # Step 4: Verify metrics update was captured
                assert len(metrics_updates) == 1
                captured_update = metrics_updates[0]
                assert captured_update["portfolio_id"] == portfolio["id"]
                assert captured_update["metrics"]["total_budget"] == 200000.0
                
                # Step 5: Verify updated metrics are available via API
                response = client.get("/portfolio/metrics")
                assert response.status_code == 200
                updated_metrics = response.json()
                
                # Metrics should reflect the changes
                assert updated_metrics["total_projects"] >= initial_project_count
                
        finally:
            test_data_manager.cleanup()
    
    def test_resource_allocation_realtime_updates(self, mock_realtime):
        """
        Test real-time updates for resource allocation changes
        Validates: Requirements 2.5, 8.4
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Resource Test Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Resource Test Project")
            resource = test_data_manager.create_test_resource("Test Resource")
            
            allocation_events = []
            
            def capture_allocation_event(payload):
                allocation_events.append(payload)
            
            mock_realtime.on("resource_allocation_update", capture_allocation_event)
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.supabase.realtime', mock_realtime):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Allocate resource to project
                allocation_data = {
                    "allocation_percentage": 75,
                    "role": "Developer",
                    "start_date": datetime.now().date().isoformat(),
                    "end_date": (datetime.now() + timedelta(days=30)).date().isoformat()
                }
                
                response = client.post(
                    f"/resources/{resource['id']}/allocate/{project['id']}", 
                    json=allocation_data
                )
                assert response.status_code == 200
                allocation_result = response.json()
                
                # Step 2: Simulate real-time allocation update event
                allocation_payload = {
                    "resource_id": resource["id"],
                    "project_id": project["id"],
                    "allocation_percentage": 75,
                    "previous_allocation": 0,
                    "utilization_change": {
                        "before": 0.0,
                        "after": 0.75
                    },
                    "timestamp": datetime.now().isoformat()
                }
                
                mock_realtime.trigger_event("resource_allocation_update", allocation_payload)
                
                # Step 3: Verify event was captured
                assert len(allocation_events) == 1
                captured_event = allocation_events[0]
                assert captured_event["resource_id"] == resource["id"]
                assert captured_event["allocation_percentage"] == 75
                assert captured_event["utilization_change"]["after"] == 0.75
                
                # Step 4: Verify resource utilization summary reflects changes
                response = client.get("/resources/utilization/summary")
                assert response.status_code == 200
                utilization_summary = response.json()
                
                # Should show updated utilization
                assert utilization_summary["total_resources"] >= 1
                
        finally:
            test_data_manager.cleanup()


class TestNotificationWorkflows:
    """Test notification system workflows"""
    
    def test_budget_alert_notification_workflow(self, mock_notifications):
        """
        Test complete budget alert notification workflow
        Validates: Requirements 5.3, 7.5
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Budget Alert Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Budget Alert Project")
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Create budget alert rule
                alert_rule_data = {
                    "project_id": project["id"],
                    "threshold_percentage": 80.0,
                    "alert_type": "budget_overrun",
                    "notification_emails": ["pm@example.com", "finance@example.com"],
                    "webhook_url": "https://slack.com/webhook/budget-alerts",
                    "is_active": True
                }
                
                response = client.post("/budget-alerts/rules/", json=alert_rule_data)
                assert response.status_code == 201
                alert_rule = response.json()
                
                # Step 2: Add costs to trigger alert
                cost_data = {
                    "category": "Development",
                    "amount": 45000.0,  # 90% of 50k budget
                    "currency": "USD",
                    "date": datetime.now().date().isoformat(),
                    "description": "Development costs exceeding threshold"
                }
                
                response = client.post(f"/projects/{project['id']}/costs", json=cost_data)
                assert response.status_code == 201
                
                # Step 3: Trigger budget alert check (normally done by background job)
                response = client.post(f"/budget-alerts/check/{project['id']}")
                assert response.status_code == 200
                alert_check_result = response.json()
                
                assert alert_check_result["alerts_triggered"] > 0
                
                # Step 4: Verify notifications were sent
                sent_notifications = mock_notifications.sent_notifications
                assert len(sent_notifications) >= 2  # Email + webhook
                
                # Check email notifications
                email_notifications = [n for n in sent_notifications if n["type"] == "email"]
                assert len(email_notifications) == 2  # pm@ and finance@
                
                pm_email = next((n for n in email_notifications if n["to"] == "pm@example.com"), None)
                assert pm_email is not None
                assert "Budget Alert" in pm_email["subject"]
                assert "90%" in pm_email["body"]  # Should mention percentage
                
                # Check webhook notifications
                webhook_notifications = [n for n in sent_notifications if n["type"] == "webhook"]
                assert len(webhook_notifications) == 1
                
                webhook = webhook_notifications[0]
                assert webhook["url"] == "https://slack.com/webhook/budget-alerts"
                assert "budget_overrun" in webhook["payload"]["alert_type"]
                
                # Step 5: Test notification preferences and delivery
                response = client.get(f"/budget-alerts/project/{project['id']}")
                assert response.status_code == 200
                project_alerts = response.json()
                
                assert len(project_alerts) > 0
                latest_alert = project_alerts[0]
                assert latest_alert["alert_type"] == "budget_overrun"
                assert latest_alert["notification_status"] == "sent"
                
        finally:
            test_data_manager.cleanup()
    
    def test_workflow_approval_notification_workflow(self, mock_notifications):
        """
        Test workflow approval notification system
        Validates: Requirements 7.2, 7.5
        """
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Create workflow template with notification settings
                workflow_data = {
                    "name": "Project Approval Workflow",
                    "description": "Multi-step approval with notifications",
                    "steps": [
                        {
                            "id": "manager_approval",
                            "name": "Manager Approval",
                            "type": "approval",
                            "approvers": ["manager@example.com"],
                            "timeout_hours": 48
                        },
                        {
                            "id": "finance_approval",
                            "name": "Finance Approval", 
                            "type": "approval",
                            "approvers": ["finance@example.com"],
                            "timeout_hours": 24
                        }
                    ],
                    "notification_settings": {
                        "notify_on_submission": True,
                        "notify_on_approval": True,
                        "notify_on_rejection": True,
                        "notify_on_timeout": True,
                        "reminder_intervals": [24, 12, 2]  # hours before timeout
                    },
                    "is_active": True
                }
                
                response = client.post("/workflow-templates/", json=workflow_data)
                assert response.status_code == 201
                workflow_template = response.json()
                
                # Step 2: Submit approval request
                approval_request = {
                    "workflow_template_id": workflow_template["id"],
                    "context": {
                        "project_name": "Critical Project Alpha",
                        "budget_amount": 250000.0,
                        "justification": "Strategic initiative for Q2"
                    },
                    "priority": "high",
                    "requester_email": "requester@example.com"
                }
                
                response = client.post("/approval-requests/", json=approval_request)
                assert response.status_code == 201
                approval_process = response.json()
                
                # Step 3: Verify submission notifications were sent
                sent_notifications = mock_notifications.sent_notifications
                submission_notifications = [
                    n for n in sent_notifications 
                    if n["type"] == "email" and "Approval Request Submitted" in n.get("subject", "")
                ]
                
                assert len(submission_notifications) >= 1
                
                # Should notify requester and first approver
                approver_notification = next(
                    (n for n in submission_notifications if n["to"] == "manager@example.com"), 
                    None
                )
                assert approver_notification is not None
                assert "Critical Project Alpha" in approver_notification["body"]
                
                # Step 4: Simulate approval response
                approval_response = {
                    "decision": "approved",
                    "comments": "Approved with budget monitoring"
                }
                
                response = client.post(
                    f"/approval-processes/{approval_process['id']}/respond/manager_approval",
                    json=approval_response
                )
                assert response.status_code == 200
                
                # Step 5: Verify approval notifications
                approval_notifications = [
                    n for n in mock_notifications.sent_notifications
                    if "Approved" in n.get("subject", "") or "approved" in n.get("body", "").lower()
                ]
                
                assert len(approval_notifications) >= 1
                
                # Should notify requester and next approver
                next_approver_notification = next(
                    (n for n in approval_notifications if n["to"] == "finance@example.com"),
                    None
                )
                assert next_approver_notification is not None
                
                # Step 6: Test timeout reminder notifications
                # Simulate timeout approaching
                timeout_request = {
                    "process_id": approval_process["id"],
                    "step_id": "finance_approval",
                    "hours_remaining": 2
                }
                
                response = client.post("/workflow/send-reminder", json=timeout_request)
                assert response.status_code == 200
                
                # Verify reminder notification
                reminder_notifications = [
                    n for n in mock_notifications.sent_notifications
                    if "Reminder" in n.get("subject", "") or "reminder" in n.get("body", "").lower()
                ]
                
                assert len(reminder_notifications) >= 1
                
        finally:
            test_data_manager.cleanup()
    
    def test_risk_materialization_notification_workflow(self, mock_notifications):
        """
        Test notifications when risks materialize into issues
        Validates: Requirements 6.5, 8.4
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Risk Notification Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Risk Notification Project")
            risk = test_data_manager.create_test_risk(project["id"])
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Create issue from risk (risk materialization)
                issue_data = {
                    "project_id": project["id"],
                    "related_risk_id": risk["id"],
                    "title": "Technical Risk Materialized",
                    "description": "The predicted technical risk has become an active issue",
                    "severity": "high",
                    "status": "open",
                    "assigned_to": "developer@example.com",
                    "notification_settings": {
                        "notify_project_manager": True,
                        "notify_risk_owner": True,
                        "notify_stakeholders": True,
                        "escalation_emails": ["escalation@example.com"]
                    }
                }
                
                response = client.post("/issues/", json=issue_data)
                assert response.status_code == 201
                issue = response.json()
                test_data_manager.created_issues.append(issue["id"])
                
                # Step 2: Verify risk materialization notifications
                sent_notifications = mock_notifications.sent_notifications
                
                # Should have notifications for different stakeholders
                risk_notifications = [
                    n for n in sent_notifications
                    if n["type"] == "email" and ("Risk" in n.get("subject", "") or "Issue" in n.get("subject", ""))
                ]
                
                assert len(risk_notifications) >= 2
                
                # Check assignee notification
                assignee_notification = next(
                    (n for n in risk_notifications if n["to"] == "developer@example.com"),
                    None
                )
                assert assignee_notification is not None
                assert "Technical Risk Materialized" in assignee_notification["subject"]
                assert "high" in assignee_notification["body"].lower()
                
                # Check escalation notification
                escalation_notification = next(
                    (n for n in risk_notifications if n["to"] == "escalation@example.com"),
                    None
                )
                assert escalation_notification is not None
                
                # Step 3: Test in-app notifications
                in_app_notifications = mock_notifications.get_notifications_for_user("test-user")
                assert len(in_app_notifications) >= 1
                
                risk_in_app = next(
                    (n for n in in_app_notifications if "Risk" in n["title"]),
                    None
                )
                assert risk_in_app is not None
                assert risk_in_app["notification_type"] == "warning"
                assert not risk_in_app["read"]
                
                # Step 4: Test notification read status
                response = client.post(f"/notifications/{risk_in_app['id']}/mark-read")
                assert response.status_code == 200
                
                # Verify notification was marked as read
                updated_notifications = mock_notifications.get_notifications_for_user("test-user")
                updated_notification = next(
                    (n for n in updated_notifications if n["id"] == risk_in_app["id"]),
                    None
                )
                assert updated_notification["read"] is True
                
        finally:
            test_data_manager.cleanup()


class TestEventDrivenWorkflows:
    """Test event-driven workflow triggers and automation"""
    
    def test_project_status_change_triggers(self, mock_realtime, mock_notifications):
        """
        Test automated workflows triggered by project status changes
        Validates: Requirements 7.1, 7.5, 8.4
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Event Trigger Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Event Trigger Project")
            
            triggered_workflows = []
            
            def capture_workflow_trigger(payload):
                triggered_workflows.append(payload)
            
            mock_realtime.on("workflow_triggered", capture_workflow_trigger)
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.supabase.realtime', mock_realtime), \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Create event-driven workflow rule
                workflow_rule_data = {
                    "name": "Project Completion Workflow",
                    "trigger_event": "project_status_change",
                    "trigger_conditions": {
                        "status_from": "active",
                        "status_to": "completed"
                    },
                    "actions": [
                        {
                            "type": "send_notification",
                            "config": {
                                "recipients": ["pm@example.com", "stakeholder@example.com"],
                                "template": "project_completion",
                                "include_metrics": True
                            }
                        },
                        {
                            "type": "update_portfolio_metrics",
                            "config": {
                                "recalculate_immediately": True
                            }
                        },
                        {
                            "type": "archive_project_data",
                            "config": {
                                "archive_after_days": 30,
                                "preserve_reports": True
                            }
                        }
                    ],
                    "is_active": True
                }
                
                response = client.post("/workflow-rules/", json=workflow_rule_data)
                assert response.status_code == 201
                workflow_rule = response.json()
                
                # Step 2: Change project status to trigger workflow
                status_update = {
                    "status": "completed",
                    "completion_date": datetime.now().date().isoformat(),
                    "final_cost": 48000.0
                }
                
                response = client.put(f"/projects/{project['id']}", json=status_update)
                assert response.status_code == 200
                updated_project = response.json()
                
                # Step 3: Simulate workflow trigger event
                trigger_payload = {
                    "rule_id": workflow_rule["id"],
                    "trigger_event": "project_status_change",
                    "project_id": project["id"],
                    "trigger_data": {
                        "status_from": "active",
                        "status_to": "completed",
                        "project_data": updated_project
                    },
                    "triggered_at": datetime.now().isoformat()
                }
                
                mock_realtime.trigger_event("workflow_triggered", trigger_payload)
                
                # Step 4: Verify workflow was triggered
                assert len(triggered_workflows) == 1
                triggered_workflow = triggered_workflows[0]
                assert triggered_workflow["rule_id"] == workflow_rule["id"]
                assert triggered_workflow["project_id"] == project["id"]
                
                # Step 5: Verify workflow actions were executed
                # Check notifications were sent
                completion_notifications = [
                    n for n in mock_notifications.sent_notifications
                    if n["type"] == "email" and "Completion" in n.get("subject", "")
                ]
                
                assert len(completion_notifications) >= 2  # pm@ and stakeholder@
                
                pm_notification = next(
                    (n for n in completion_notifications if n["to"] == "pm@example.com"),
                    None
                )
                assert pm_notification is not None
                assert project["name"] in pm_notification["body"]
                
                # Step 6: Verify portfolio metrics were updated
                response = client.get("/portfolio/metrics")
                assert response.status_code == 200
                metrics = response.json()
                
                # Should show at least one completed project
                assert metrics.get("completed_projects", 0) >= 1
                
        finally:
            test_data_manager.cleanup()
    
    def test_resource_allocation_automation(self, mock_realtime, mock_notifications):
        """
        Test automated resource allocation based on events
        Validates: Requirements 2.5, 7.1
        """
        test_data_manager = TestDataManager()
        try:
            portfolio = test_data_manager.create_test_portfolio("Auto Allocation Portfolio")
            project = test_data_manager.create_test_project(portfolio["id"], "Auto Allocation Project")
            resource1 = test_data_manager.create_test_resource("Available Resource 1")
            resource2 = test_data_manager.create_test_resource("Available Resource 2")
            
            allocation_events = []
            
            def capture_allocation_event(payload):
                allocation_events.append(payload)
            
            mock_realtime.on("auto_allocation_triggered", capture_allocation_event)
            
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.supabase.realtime', mock_realtime), \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Create auto-allocation rule
                allocation_rule_data = {
                    "name": "Auto-assign Available Resources",
                    "trigger_event": "project_status_change",
                    "trigger_conditions": {
                        "status_to": "active",
                        "has_unallocated_resources": True
                    },
                    "allocation_criteria": {
                        "skill_match_threshold": 0.7,
                        "max_utilization": 80,
                        "prefer_available_resources": True
                    },
                    "actions": [
                        {
                            "type": "auto_allocate_resources",
                            "config": {
                                "allocation_percentage": 60,
                                "notify_resources": True,
                                "notify_project_manager": True
                            }
                        }
                    ],
                    "is_active": True
                }
                
                response = client.post("/allocation-rules/", json=allocation_rule_data)
                assert response.status_code == 201
                allocation_rule = response.json()
                
                # Step 2: Activate project to trigger auto-allocation
                activation_data = {
                    "status": "active",
                    "required_skills": ["Python", "FastAPI"],
                    "team_size_target": 2
                }
                
                response = client.put(f"/projects/{project['id']}", json=activation_data)
                assert response.status_code == 200
                
                # Step 3: Simulate auto-allocation trigger
                allocation_payload = {
                    "rule_id": allocation_rule["id"],
                    "project_id": project["id"],
                    "allocated_resources": [
                        {
                            "resource_id": resource1["id"],
                            "allocation_percentage": 60,
                            "skill_match_score": 0.85,
                            "role": "Backend Developer"
                        },
                        {
                            "resource_id": resource2["id"],
                            "allocation_percentage": 60,
                            "skill_match_score": 0.75,
                            "role": "API Developer"
                        }
                    ],
                    "triggered_at": datetime.now().isoformat()
                }
                
                mock_realtime.trigger_event("auto_allocation_triggered", allocation_payload)
                
                # Step 4: Verify auto-allocation was triggered
                assert len(allocation_events) == 1
                allocation_event = allocation_events[0]
                assert allocation_event["project_id"] == project["id"]
                assert len(allocation_event["allocated_resources"]) == 2
                
                # Step 5: Verify notifications were sent to resources
                allocation_notifications = [
                    n for n in mock_notifications.sent_notifications
                    if n["type"] == "email" and "Allocation" in n.get("subject", "")
                ]
                
                assert len(allocation_notifications) >= 2  # One per resource
                
                # Step 6: Verify resource utilization was updated
                response = client.get("/resources/utilization/summary")
                assert response.status_code == 200
                utilization_summary = response.json()
                
                # Should show updated utilization
                assert utilization_summary["total_resources"] >= 2
                
        finally:
            test_data_manager.cleanup()


class TestNotificationReliability:
    """Test notification delivery reliability and retry mechanisms"""
    
    def test_notification_retry_mechanism(self, mock_notifications):
        """
        Test notification retry logic for failed deliveries
        Validates: Requirements 7.5, 9.1
        """
        # Mock failed notification service
        class FailingNotificationService(MockNotificationService):
            def __init__(self):
                super().__init__()
                self.failure_count = 0
                self.max_failures = 2
                
            def send_email(self, to: str, subject: str, body: str, template: str = None):
                self.failure_count += 1
                if self.failure_count <= self.max_failures:
                    # Simulate failure
                    notification = {
                        "type": "email",
                        "to": to,
                        "subject": subject,
                        "body": body,
                        "sent_at": datetime.now(),
                        "status": "failed",
                        "error": "SMTP connection timeout"
                    }
                    self.sent_notifications.append(notification)
                    raise Exception("SMTP connection timeout")
                else:
                    # Succeed after retries
                    return super().send_email(to, subject, body, template)
        
        failing_service = FailingNotificationService()
        
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.notification_service', failing_service):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Trigger notification that will initially fail
                notification_request = {
                    "type": "email",
                    "to": "test@example.com",
                    "subject": "Test Notification",
                    "body": "This is a test notification",
                    "retry_config": {
                        "max_retries": 3,
                        "retry_delay_seconds": 1,
                        "exponential_backoff": True
                    }
                }
                
                response = client.post("/notifications/send", json=notification_request)
                
                # Should eventually succeed after retries
                assert response.status_code == 200
                result = response.json()
                assert result["status"] == "sent"
                assert result["retry_count"] > 0
                
                # Step 2: Verify retry attempts were logged
                response = client.get("/notifications/delivery-log")
                assert response.status_code == 200
                delivery_log = response.json()
                
                # Should show failed attempts and final success
                failed_attempts = [
                    log for log in delivery_log 
                    if log["status"] == "failed"
                ]
                assert len(failed_attempts) == 2  # max_failures
                
                successful_attempts = [
                    log for log in delivery_log
                    if log["status"] == "sent"
                ]
                assert len(successful_attempts) == 1
                
        finally:
            test_data_manager.cleanup()
    
    def test_notification_queue_processing(self, mock_notifications):
        """
        Test notification queue processing and batch delivery
        Validates: Requirements 9.2, 9.3
        """
        test_data_manager = TestDataManager()
        try:
            with patch('main.get_current_user') as mock_auth, \
                 patch('main.notification_service', mock_notifications):
                
                mock_auth.return_value = {"id": "test-user", "email": "test@example.com"}
                
                # Step 1: Queue multiple notifications
                notifications_to_queue = [
                    {
                        "type": "email",
                        "to": f"user{i}@example.com",
                        "subject": f"Batch Notification {i}",
                        "body": f"This is batch notification number {i}",
                        "priority": "normal" if i % 2 == 0 else "high"
                    }
                    for i in range(10)
                ]
                
                queued_notifications = []
                for notification in notifications_to_queue:
                    response = client.post("/notifications/queue", json=notification)
                    assert response.status_code == 201
                    queued_notifications.append(response.json())
                
                # Step 2: Process notification queue
                response = client.post("/notifications/process-queue")
                assert response.status_code == 200
                processing_result = response.json()
                
                assert processing_result["processed_count"] == 10
                assert processing_result["success_count"] == 10
                assert processing_result["failure_count"] == 0
                
                # Step 3: Verify high priority notifications were processed first
                sent_notifications = mock_notifications.sent_notifications
                assert len(sent_notifications) == 10
                
                # High priority notifications should be processed first
                high_priority_notifications = [
                    n for n in sent_notifications[:5]  # First 5 processed
                    if "1" in n["subject"] or "3" in n["subject"] or "5" in n["subject"] or "7" in n["subject"] or "9" in n["subject"]
                ]
                # Should have most high priority notifications in first batch
                assert len(high_priority_notifications) >= 3
                
                # Step 4: Check queue status
                response = client.get("/notifications/queue-status")
                assert response.status_code == 200
                queue_status = response.json()
                
                assert queue_status["pending_count"] == 0
                assert queue_status["processing_count"] == 0
                assert queue_status["completed_count"] == 10
                
        finally:
            test_data_manager.cleanup()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])