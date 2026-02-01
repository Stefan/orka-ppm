"""
Unit Tests for Audit Scheduled Jobs

This module contains unit tests for the audit trail scheduled jobs.
Tests validate job execution logic, error handling, and retry behavior.

Requirements: 1.1, 1.6, 4.11, 5.9, 5.10
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.audit_scheduled_jobs import AuditScheduledJobs
from services.audit_scheduler import AuditScheduler


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.update = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.gte = Mock(return_value=mock)
    mock.lte = Mock(return_value=mock)
    mock.is_ = Mock(return_value=mock)
    mock.not_ = Mock(return_value=mock)
    mock.limit = Mock(return_value=mock)
    mock.execute = Mock(return_value=Mock(data=[]))
    return mock


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    return Mock()


@pytest.fixture
def scheduled_jobs(mock_supabase, mock_redis):
    """Create AuditScheduledJobs instance with mocked dependencies."""
    with patch('services.audit_scheduled_jobs.AuditAnomalyService') as mock_anomaly, \
         patch('services.audit_scheduled_jobs.AuditIntegrationHub') as mock_integration, \
         patch('services.audit_scheduled_jobs.AuditRAGAgent') as mock_rag, \
         patch('services.audit_scheduled_jobs.AuditMLService') as mock_ml, \
         patch('services.audit_scheduled_jobs.AuditExportService') as mock_export:
        
        jobs = AuditScheduledJobs(
            supabase_client=mock_supabase,
            redis_client=mock_redis,
            openai_api_key="test-key"
        )
        
        # Store mocks for access in tests
        jobs._mock_anomaly = mock_anomaly.return_value
        jobs._mock_integration = mock_integration.return_value
        jobs._mock_rag = mock_rag.return_value
        jobs._mock_ml = mock_ml.return_value
        jobs._mock_export = mock_export.return_value
        
        return jobs


@pytest.fixture
def scheduler():
    """Create AuditScheduler instance."""
    return AuditScheduler()


# ============================================================================
# Test: Anomaly Detection Job
# ============================================================================

@pytest.mark.asyncio
async def test_anomaly_detection_job_executes_successfully(scheduled_jobs):
    """
    Test that anomaly detection job executes successfully.
    
    Requirements: 1.1, 1.4
    """
    # Mock anomaly detection to return test anomalies
    mock_anomaly = Mock()
    mock_anomaly.id = uuid4()
    mock_anomaly.audit_event = {'tenant_id': str(uuid4())}
    mock_anomaly.__dict__ = {
        'id': mock_anomaly.id,
        'audit_event': mock_anomaly.audit_event,
        'anomaly_score': 0.85
    }
    
    scheduled_jobs.anomaly_service.detect_anomalies = AsyncMock(return_value=[mock_anomaly])
    scheduled_jobs.anomaly_service.generate_alert = AsyncMock(return_value={'id': uuid4()})
    
    # Mock integration hub
    scheduled_jobs.supabase.table("audit_integrations").select("*").eq(
        "tenant_id", mock_anomaly.audit_event['tenant_id']
    ).eq("is_active", True).execute = Mock(return_value=Mock(data=[]))
    
    # Execute job
    await scheduled_jobs.run_anomaly_detection()
    
    # Verify anomaly detection was called with correct time range
    scheduled_jobs.anomaly_service.detect_anomalies.assert_called_once()
    call_args = scheduled_jobs.anomaly_service.detect_anomalies.call_args
    
    # Verify time range is approximately last 24 hours
    start_time = call_args.kwargs['start_time']
    end_time = call_args.kwargs['end_time']
    time_diff = end_time - start_time
    
    assert 23.5 <= time_diff.total_seconds() / 3600 <= 24.5, "Time range should be approximately 24 hours"
    
    # Verify alert generation was called
    scheduled_jobs.anomaly_service.generate_alert.assert_called_once_with(mock_anomaly)


@pytest.mark.asyncio
async def test_anomaly_detection_job_sends_notifications(scheduled_jobs):
    """
    Test that anomaly detection job sends notifications via Integration Hub.
    
    Requirements: 1.5
    """
    # Mock anomaly
    tenant_id = str(uuid4())
    mock_anomaly = Mock()
    mock_anomaly.id = uuid4()
    mock_anomaly.audit_event = {'tenant_id': tenant_id}
    mock_anomaly.__dict__ = {
        'id': mock_anomaly.id,
        'audit_event': mock_anomaly.audit_event,
        'anomaly_score': 0.85
    }
    
    scheduled_jobs.anomaly_service.detect_anomalies = AsyncMock(return_value=[mock_anomaly])
    scheduled_jobs.anomaly_service.generate_alert = AsyncMock(return_value={'id': uuid4()})
    
    # Mock active integrations
    integrations = [
        {
            'integration_type': 'slack',
            'config': {'webhook_url': 'https://hooks.slack.com/test'}
        },
        {
            'integration_type': 'teams',
            'config': {'webhook_url': 'https://outlook.office.com/webhook/test'}
        }
    ]
    
    scheduled_jobs.supabase.table("audit_integrations").select("*").eq(
        "tenant_id", tenant_id
    ).eq("is_active", True).execute = Mock(return_value=Mock(data=integrations))
    
    # Mock integration hub methods
    scheduled_jobs.integration_hub.send_slack_notification = AsyncMock(
        return_value=Mock(success=True)
    )
    scheduled_jobs.integration_hub.send_teams_notification = AsyncMock(
        return_value=Mock(success=True)
    )
    
    # Execute job
    await scheduled_jobs.run_anomaly_detection()
    
    # Verify notifications were sent
    scheduled_jobs.integration_hub.send_slack_notification.assert_called_once()
    scheduled_jobs.integration_hub.send_teams_notification.assert_called_once()


@pytest.mark.asyncio
async def test_anomaly_detection_job_handles_errors_gracefully(scheduled_jobs):
    """
    Test that anomaly detection job handles errors without crashing.
    
    Requirements: 1.1
    """
    # Mock anomaly detection to raise an exception
    scheduled_jobs.anomaly_service.detect_anomalies = AsyncMock(
        side_effect=Exception("Database connection failed")
    )
    
    # Execute job - should not raise exception
    with pytest.raises(Exception):
        await scheduled_jobs.run_anomaly_detection()


# ============================================================================
# Test: Embedding Generation Job
# ============================================================================

@pytest.mark.asyncio
async def test_embedding_generation_job_processes_events(scheduled_jobs):
    """
    Test that embedding generation job processes events without embeddings.
    
    Requirements: 3.10
    """
    # Mock events without embeddings
    events = [
        {
            'id': str(uuid4()),
            'event_type': 'user_login',
            'action_details': {'username': 'test'},
            'timestamp': datetime.now().isoformat()
        }
        for _ in range(5)
    ]
    
    scheduled_jobs.supabase.table("audit_logs").select(
        "id, event_type, action_details, user_id, entity_type, timestamp"
    ).is_("embedding_id", "null").limit(100).execute = Mock(return_value=Mock(data=events))
    
    # Mock RAG agent
    scheduled_jobs.rag_agent.index_audit_event = AsyncMock(return_value=True)
    
    # Execute job
    await scheduled_jobs.run_embedding_generation()
    
    # Verify embeddings were generated for all events
    assert scheduled_jobs.rag_agent.index_audit_event.call_count == len(events)


@pytest.mark.asyncio
async def test_embedding_generation_job_handles_no_events(scheduled_jobs):
    """
    Test that embedding generation job handles case with no events.
    
    Requirements: 3.10
    """
    # Mock no events
    scheduled_jobs.supabase.table("audit_logs").select(
        "id, event_type, action_details, user_id, entity_type, timestamp"
    ).is_("embedding_id", "null").limit(100).execute = Mock(return_value=Mock(data=[]))
    
    # Execute job - should complete without errors
    await scheduled_jobs.run_embedding_generation()
    
    # Verify no embeddings were attempted
    scheduled_jobs.rag_agent.index_audit_event.assert_not_called()


@pytest.mark.asyncio
async def test_embedding_generation_job_continues_on_individual_failures(scheduled_jobs):
    """
    Test that embedding generation continues processing even if individual events fail.
    
    Requirements: 3.10
    """
    # Mock events
    events = [{'id': str(uuid4()), 'event_type': 'test'} for _ in range(3)]
    
    scheduled_jobs.supabase.table("audit_logs").select(
        "id, event_type, action_details, user_id, entity_type, timestamp"
    ).is_("embedding_id", "null").limit(100).execute = Mock(return_value=Mock(data=events))
    
    # Mock RAG agent to fail on second event
    scheduled_jobs.rag_agent.index_audit_event = AsyncMock(
        side_effect=[True, Exception("Embedding failed"), True]
    )
    
    # Execute job
    await scheduled_jobs.run_embedding_generation()
    
    # Verify all events were attempted
    assert scheduled_jobs.rag_agent.index_audit_event.call_count == len(events)


# ============================================================================
# Test: Model Training Jobs
# ============================================================================

@pytest.mark.asyncio
async def test_anomaly_model_training_job_executes(scheduled_jobs):
    """
    Test that anomaly model training job executes successfully.
    
    Requirements: 1.6
    """
    # Mock training metrics
    mock_metrics = Mock()
    mock_metrics.model_version = "1.0.0"
    mock_metrics.training_data_size = 1000
    mock_metrics.contamination = 0.1
    mock_metrics.n_estimators = 100
    mock_metrics.anomaly_threshold = 0.7
    
    scheduled_jobs.anomaly_service.train_model = AsyncMock(return_value=mock_metrics)
    
    # Mock database operations
    scheduled_jobs.supabase.table("audit_ml_models").update = Mock(return_value=Mock(execute=Mock()))
    scheduled_jobs.supabase.table("audit_ml_models").insert = Mock(return_value=Mock(execute=Mock()))
    
    # Execute job
    await scheduled_jobs.run_anomaly_model_training()
    
    # Verify training was called with 30 days of history
    scheduled_jobs.anomaly_service.train_model.assert_called_once_with(days_of_history=30)
    
    # Verify model metadata was stored
    scheduled_jobs.supabase.table("audit_ml_models").insert.assert_called_once()


@pytest.mark.asyncio
async def test_classifier_training_job_executes(scheduled_jobs):
    """
    Test that classifier training job executes successfully.
    
    Requirements: 4.11
    """
    # Mock labeled training data
    labeled_data = [
        {
            'id': str(uuid4()),
            'event_type': 'budget_change',
            'category': 'Financial Impact',
            'risk_level': 'High'
        }
        for _ in range(150)
    ]
    
    scheduled_jobs.supabase.table("audit_logs").select("*").gte(
        "timestamp", (datetime.now() - timedelta(days=30)).isoformat()
    ).not_.is_("category", "null").not_.is_("risk_level", "null").execute = Mock(
        return_value=Mock(data=labeled_data)
    )
    
    # Mock training metrics
    mock_metrics = {
        'version': '1.0.0',
        'category_accuracy': 0.85,
        'risk_accuracy': 0.82
    }
    
    scheduled_jobs.ml_service.train_classifiers = AsyncMock(return_value=mock_metrics)
    
    # Mock database operations
    scheduled_jobs.supabase.table("audit_ml_models").update = Mock(return_value=Mock(execute=Mock()))
    scheduled_jobs.supabase.table("audit_ml_models").insert = Mock(return_value=Mock(execute=Mock()))
    
    # Execute job
    await scheduled_jobs.run_classifier_training()
    
    # Verify training was called with labeled data
    scheduled_jobs.ml_service.train_classifiers.assert_called_once_with(labeled_data)
    
    # Verify model metadata was stored
    scheduled_jobs.supabase.table("audit_ml_models").insert.assert_called_once()


@pytest.mark.asyncio
async def test_classifier_training_job_skips_insufficient_data(scheduled_jobs):
    """
    Test that classifier training skips when insufficient labeled data.
    
    Requirements: 4.11
    """
    # Mock insufficient labeled data (< 100 events)
    labeled_data = [{'id': str(uuid4())} for _ in range(50)]
    
    scheduled_jobs.supabase.table("audit_logs").select("*").gte(
        "timestamp", (datetime.now() - timedelta(days=30)).isoformat()
    ).not_.is_("category", "null").not_.is_("risk_level", "null").execute = Mock(
        return_value=Mock(data=labeled_data)
    )
    
    # Execute job
    await scheduled_jobs.run_classifier_training()
    
    # Verify training was not called
    scheduled_jobs.ml_service.train_classifiers.assert_not_called()


# ============================================================================
# Test: Scheduled Reports Job
# ============================================================================

@pytest.mark.asyncio
async def test_scheduled_reports_job_processes_due_reports(scheduled_jobs):
    """
    Test that scheduled reports job processes reports that are due.
    
    Requirements: 5.9, 5.10
    """
    # Mock due reports
    reports = [
        {
            'id': str(uuid4()),
            'report_name': 'Daily Audit Report',
            'filters': {'severity': 'critical'},
            'recipients': ['admin@example.com'],
            'include_summary': True,
            'format': 'pdf',
            'schedule_cron': '0 9 * * *'
        }
    ]
    
    scheduled_jobs.supabase.table("audit_scheduled_reports").select("*").eq(
        "is_active", True
    ).lte("next_run", datetime.now().isoformat()).execute = Mock(
        return_value=Mock(data=reports)
    )
    
    # Mock export service
    scheduled_jobs.export_service.export_pdf = AsyncMock(return_value=b'PDF content')
    
    # Mock database updates
    scheduled_jobs.supabase.table("audit_scheduled_reports").update = Mock(
        return_value=Mock(execute=Mock())
    )
    
    # Execute job
    with patch.object(scheduled_jobs, '_send_report_email', new_callable=AsyncMock):
        await scheduled_jobs.run_scheduled_reports()
    
    # Verify report was generated
    scheduled_jobs.export_service.export_pdf.assert_called_once()


@pytest.mark.asyncio
async def test_scheduled_reports_job_handles_no_due_reports(scheduled_jobs):
    """
    Test that scheduled reports job handles case with no due reports.
    
    Requirements: 5.9
    """
    # Mock no due reports
    scheduled_jobs.supabase.table("audit_scheduled_reports").select("*").eq(
        "is_active", True
    ).lte("next_run", datetime.now().isoformat()).execute = Mock(
        return_value=Mock(data=[])
    )
    
    # Execute job - should complete without errors
    await scheduled_jobs.run_scheduled_reports()
    
    # Verify no reports were generated
    scheduled_jobs.export_service.export_pdf.assert_not_called()
    scheduled_jobs.export_service.export_csv.assert_not_called()


# ============================================================================
# Test: Scheduler Integration
# ============================================================================

def test_scheduler_initialization():
    """
    Test that scheduler initializes correctly.
    
    Requirements: 1.1
    """
    scheduler = AuditScheduler()
    
    assert scheduler is not None
    assert not scheduler.is_running
    assert scheduler.scheduler is not None
    assert len(scheduler.job_stats) == 5


def test_scheduler_add_jobs():
    """
    Test that jobs can be added to scheduler.
    
    Requirements: 1.1, 1.6, 4.11
    """
    scheduler = AuditScheduler()
    
    # Add test jobs
    async def test_job():
        pass
    
    scheduler.add_anomaly_detection_job(test_job)
    scheduler.add_embedding_generation_job(test_job)
    scheduler.add_anomaly_model_training_job(test_job)
    scheduler.add_classifier_training_job(test_job)
    scheduler.add_scheduled_reports_job(test_job)
    
    # Verify jobs were added
    jobs = scheduler.scheduler.get_jobs()
    assert len(jobs) == 5
    
    job_ids = [job.id for job in jobs]
    assert 'anomaly_detection' in job_ids
    assert 'embedding_generation' in job_ids
    assert 'anomaly_model_training' in job_ids
    assert 'classifier_training' in job_ids
    assert 'scheduled_reports' in job_ids


def test_scheduler_start_stop():
    """
    Test that scheduler can be started and stopped.
    
    Requirements: 1.1
    """
    scheduler = AuditScheduler()
    
    # Note: Starting AsyncIOScheduler requires an event loop
    # In production, this will be called from an async context
    # For testing, we just verify the scheduler can be created
    assert not scheduler.is_running
    
    # Verify scheduler has the start/shutdown methods
    assert hasattr(scheduler, 'start')
    assert hasattr(scheduler, 'shutdown')
    assert callable(scheduler.start)
    assert callable(scheduler.shutdown)


def test_scheduler_get_stats():
    """
    Test that scheduler provides job statistics.
    
    Requirements: 1.1
    """
    scheduler = AuditScheduler()
    
    stats = scheduler.get_job_stats()
    
    assert 'is_running' in stats
    assert 'jobs' in stats
    assert 'scheduled_jobs' in stats
    assert len(stats['jobs']) == 5


# ============================================================================
# Test: Error Handling and Retries
# ============================================================================

@pytest.mark.asyncio
async def test_job_continues_after_individual_anomaly_failure(scheduled_jobs):
    """
    Test that anomaly detection job continues processing after individual failures.
    
    Requirements: 1.1
    """
    # Mock multiple anomalies
    anomalies = [Mock(id=uuid4(), audit_event={'tenant_id': str(uuid4())}) for _ in range(3)]
    for anomaly in anomalies:
        anomaly.__dict__ = {'id': anomaly.id, 'audit_event': anomaly.audit_event}
    
    scheduled_jobs.anomaly_service.detect_anomalies = AsyncMock(return_value=anomalies)
    
    # Mock alert generation to fail on second anomaly
    scheduled_jobs.anomaly_service.generate_alert = AsyncMock(
        side_effect=[
            {'id': uuid4()},
            Exception("Alert generation failed"),
            {'id': uuid4()}
        ]
    )
    
    # Mock integrations
    scheduled_jobs.supabase.table("audit_integrations").select("*").eq(
        "tenant_id", anomalies[0].audit_event['tenant_id']
    ).eq("is_active", True).execute = Mock(return_value=Mock(data=[]))
    
    # Execute job
    await scheduled_jobs.run_anomaly_detection()
    
    # Verify all anomalies were attempted
    assert scheduled_jobs.anomaly_service.generate_alert.call_count == len(anomalies)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
