"""
Audit Trail Background Job Scheduler

This module provides background job scheduling for the AI-Empowered Audit Trail feature.
It uses APScheduler to run periodic tasks for anomaly detection, embedding generation,
model training, and scheduled reports.

Requirements: 1.1, 1.6, 4.11, 5.9, 5.10
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
import asyncio

logger = logging.getLogger(__name__)


class AuditScheduler:
    """
    Background job scheduler for audit trail operations.
    
    Manages scheduled jobs for:
    - Anomaly detection (hourly)
    - Embedding generation (continuous)
    - Model training (weekly/monthly)
    - Scheduled reports (configurable)
    """
    
    def __init__(self):
        """Initialize the scheduler with AsyncIOScheduler."""
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
        
        # Job monitoring
        self.job_stats = {
            'anomaly_detection': {'runs': 0, 'errors': 0, 'last_run': None},
            'embedding_generation': {'runs': 0, 'errors': 0, 'last_run': None},
            'anomaly_model_training': {'runs': 0, 'errors': 0, 'last_run': None},
            'classifier_training': {'runs': 0, 'errors': 0, 'last_run': None},
            'scheduled_reports': {'runs': 0, 'errors': 0, 'last_run': None}
        }
        
        # Add event listeners for monitoring
        self.scheduler.add_listener(
            self._job_executed_listener,
            EVENT_JOB_EXECUTED
        )
        self.scheduler.add_listener(
            self._job_error_listener,
            EVENT_JOB_ERROR
        )
        
        logger.info("AuditScheduler initialized")
    
    def _job_executed_listener(self, event):
        """Log successful job execution."""
        job_id = event.job_id
        if job_id in self.job_stats:
            self.job_stats[job_id]['runs'] += 1
            self.job_stats[job_id]['last_run'] = datetime.now()
            logger.info(f"Job {job_id} executed successfully")
    
    def _job_error_listener(self, event):
        """Log job execution errors."""
        job_id = event.job_id
        if job_id in self.job_stats:
            self.job_stats[job_id]['errors'] += 1
            logger.error(f"Job {job_id} failed: {event.exception}")
    
    def add_anomaly_detection_job(self, job_func, hour_interval: int = 1):
        """
        Add hourly anomaly detection job.
        
        Args:
            job_func: Async function to execute for anomaly detection
            hour_interval: Hours between runs (default: 1)
        
        Requirements: 1.1, 1.4, 1.5
        """
        self.scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(hours=hour_interval),
            id='anomaly_detection',
            name='Audit Anomaly Detection',
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
        logger.info(f"Added anomaly detection job (every {hour_interval} hour(s))")
    
    def add_embedding_generation_job(self, job_func, minute_interval: int = 5):
        """
        Add periodic embedding generation job.
        
        Args:
            job_func: Async function to execute for embedding generation
            minute_interval: Minutes between runs (default: 5)
        
        Requirements: 3.10
        """
        self.scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(minutes=minute_interval),
            id='embedding_generation',
            name='Audit Embedding Generation',
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
        logger.info(f"Added embedding generation job (every {minute_interval} minute(s))")
    
    def add_anomaly_model_training_job(self, job_func, day_of_week: str = 'sun', hour: int = 2):
        """
        Add weekly anomaly detector training job.
        
        Args:
            job_func: Async function to execute for model training
            day_of_week: Day to run (default: 'sun' for Sunday)
            hour: Hour to run (default: 2 AM)
        
        Requirements: 1.6
        """
        self.scheduler.add_job(
            job_func,
            trigger=CronTrigger(day_of_week=day_of_week, hour=hour, minute=0),
            id='anomaly_model_training',
            name='Anomaly Detector Training',
            replace_existing=True,
            max_instances=1
        )
        logger.info(f"Added anomaly model training job (weekly on {day_of_week} at {hour}:00)")
    
    def add_classifier_training_job(self, job_func, day: int = 1, hour: int = 3):
        """
        Add monthly classifier training job.
        
        Args:
            job_func: Async function to execute for classifier training
            day: Day of month to run (default: 1st)
            hour: Hour to run (default: 3 AM)
        
        Requirements: 4.11
        """
        self.scheduler.add_job(
            job_func,
            trigger=CronTrigger(day=day, hour=hour, minute=0),
            id='classifier_training',
            name='ML Classifier Training',
            replace_existing=True,
            max_instances=1
        )
        logger.info(f"Added classifier training job (monthly on day {day} at {hour}:00)")
    
    def add_scheduled_reports_job(self, job_func, minute_interval: int = 10):
        """
        Add periodic scheduled reports check job.
        
        Args:
            job_func: Async function to check and generate scheduled reports
            minute_interval: Minutes between checks (default: 10)
        
        Requirements: 5.9, 5.10
        """
        self.scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(minutes=minute_interval),
            id='scheduled_reports',
            name='Scheduled Reports Check',
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
        logger.info(f"Added scheduled reports job (every {minute_interval} minute(s))")
    
    def start(self):
        """Start the scheduler."""
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("AuditScheduler started")
        else:
            logger.warning("AuditScheduler is already running")
    
    def shutdown(self, wait: bool = True):
        """
        Shutdown the scheduler.
        
        Args:
            wait: Whether to wait for running jobs to complete
        """
        if self.is_running:
            self.scheduler.shutdown(wait=wait)
            self.is_running = False
            logger.info("AuditScheduler shutdown")
        else:
            logger.warning("AuditScheduler is not running")
    
    def get_job_stats(self) -> dict:
        """
        Get statistics for all scheduled jobs.
        
        Returns:
            Dictionary with job statistics
        """
        return {
            'is_running': self.is_running,
            'jobs': self.job_stats,
            'scheduled_jobs': [
                {
                    'id': job.id,
                    'name': job.name,
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None
                }
                for job in self.scheduler.get_jobs()
            ]
        }
    
    def pause_job(self, job_id: str):
        """Pause a specific job."""
        self.scheduler.pause_job(job_id)
        logger.info(f"Job {job_id} paused")
    
    def resume_job(self, job_id: str):
        """Resume a paused job."""
        self.scheduler.resume_job(job_id)
        logger.info(f"Job {job_id} resumed")
    
    def remove_job(self, job_id: str):
        """Remove a job from the scheduler."""
        self.scheduler.remove_job(job_id)
        logger.info(f"Job {job_id} removed")


# Global scheduler instance
_scheduler_instance: Optional[AuditScheduler] = None


def get_scheduler() -> AuditScheduler:
    """
    Get the global scheduler instance.
    
    Returns:
        AuditScheduler instance
    """
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = AuditScheduler()
    return _scheduler_instance


def initialize_scheduler():
    """Initialize and return the global scheduler instance."""
    return get_scheduler()
