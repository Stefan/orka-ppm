"""
Audit Scheduler Startup Module

This module provides functions to initialize and start the audit scheduler
when the application starts. It should be called from the FastAPI startup event.

Usage:
    from services.audit_scheduler_startup import initialize_audit_scheduler
    
    @app.on_event("startup")
    async def startup_event():
        await initialize_audit_scheduler()
"""

import logging
import os
from typing import Optional

from services.audit_scheduler import get_scheduler
from services.audit_scheduled_jobs import get_scheduled_jobs

logger = logging.getLogger(__name__)


async def initialize_audit_scheduler(
    supabase_client=None,
    redis_client=None,
    openai_api_key: Optional[str] = None
):
    """
    Initialize and start the audit scheduler with all scheduled jobs.
    
    This function should be called during application startup to register
    and start all background jobs for the audit trail system.
    
    Args:
        supabase_client: Supabase client for database operations
        redis_client: Redis client for caching
        openai_api_key: OpenAI API key for AI services
    """
    try:
        logger.info("Initializing audit scheduler...")
        
        # Get OpenAI API key from environment if not provided
        if openai_api_key is None:
            openai_api_key = os.getenv('OPENAI_API_KEY')
        
        # Get scheduler instance
        scheduler = get_scheduler()
        
        # Get scheduled jobs instance
        jobs = get_scheduled_jobs(
            supabase_client=supabase_client,
            redis_client=redis_client,
            openai_api_key=openai_api_key
        )
        
        # Register all jobs
        logger.info("Registering scheduled jobs...")
        
        # 1. Anomaly detection (hourly)
        scheduler.add_anomaly_detection_job(
            job_func=jobs.run_anomaly_detection,
            hour_interval=1
        )
        
        # 2. Embedding generation (every 5 minutes)
        scheduler.add_embedding_generation_job(
            job_func=jobs.run_embedding_generation,
            minute_interval=5
        )
        
        # 3. Anomaly model training (weekly on Sunday at 2 AM)
        scheduler.add_anomaly_model_training_job(
            job_func=jobs.run_anomaly_model_training,
            day_of_week='sun',
            hour=2
        )
        
        # 4. Classifier training (monthly on 1st at 3 AM)
        scheduler.add_classifier_training_job(
            job_func=jobs.run_classifier_training,
            day=1,
            hour=3
        )
        
        # 5. Scheduled reports check (every 10 minutes)
        scheduler.add_scheduled_reports_job(
            job_func=jobs.run_scheduled_reports,
            minute_interval=10
        )
        
        # Start the scheduler
        scheduler.start()
        
        logger.info("Audit scheduler started successfully")
        logger.info(f"Registered {len(scheduler.scheduler.get_jobs())} scheduled jobs")
        
        return scheduler
        
    except Exception as e:
        logger.error(f"Failed to initialize audit scheduler: {str(e)}")
        raise


async def shutdown_audit_scheduler():
    """
    Shutdown the audit scheduler gracefully.
    
    This function should be called during application shutdown to stop
    all background jobs and clean up resources.
    """
    try:
        logger.info("Shutting down audit scheduler...")
        
        scheduler = get_scheduler()
        scheduler.shutdown(wait=True)
        
        logger.info("Audit scheduler shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during scheduler shutdown: {str(e)}")


def get_scheduler_status() -> dict:
    """
    Get the current status of the audit scheduler.
    
    Returns:
        Dictionary with scheduler status and job statistics
    """
    try:
        scheduler = get_scheduler()
        return scheduler.get_job_stats()
    except Exception as e:
        logger.error(f"Failed to get scheduler status: {str(e)}")
        return {
            'error': str(e),
            'is_running': False
        }


# Example usage in FastAPI main.py:
"""
from fastapi import FastAPI
from services.audit_scheduler_startup import (
    initialize_audit_scheduler,
    shutdown_audit_scheduler,
    get_scheduler_status
)

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    # Initialize audit scheduler
    await initialize_audit_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    # Shutdown audit scheduler
    await shutdown_audit_scheduler()

@app.get("/api/audit/scheduler/status")
async def scheduler_status():
    # Get scheduler status
    return get_scheduler_status()
"""
