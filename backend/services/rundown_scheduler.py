"""
Rundown Profile Scheduler Service
Manages scheduled generation of rundown profiles
"""

import os
import logging
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from supabase import create_client, Client

from .rundown_generator import RundownGenerator, RundownGeneratorError

logger = logging.getLogger(__name__)

# Configuration from environment
RUNDOWN_CRON_SCHEDULE = os.getenv("RUNDOWN_CRON_SCHEDULE", "0 2 * * *")  # Daily at 02:00 UTC
RUNDOWN_CRON_ENABLED = os.getenv("RUNDOWN_CRON_ENABLED", "true").lower() == "true"
ALERT_WEBHOOK_URL = os.getenv("RUNDOWN_ALERT_WEBHOOK_URL", "")
ALERT_EMAIL = os.getenv("RUNDOWN_ALERT_EMAIL", "")


class RundownScheduler:
    """
    Manages scheduled execution of rundown profile generation.
    
    Features:
    - Daily scheduled generation at configurable time
    - Error notification via webhook or email
    - Execution logging
    """
    
    _instance: Optional['RundownScheduler'] = None
    _scheduler: Optional[AsyncIOScheduler] = None
    
    def __new__(cls):
        """Singleton pattern for scheduler."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the scheduler."""
        if self._scheduler is None:
            self._scheduler = AsyncIOScheduler(
                timezone="UTC",
                job_defaults={
                    'coalesce': True,  # Combine missed executions
                    'max_instances': 1,  # Only one instance at a time
                    'misfire_grace_time': 3600  # 1 hour grace period for missed jobs
                }
            )
            self._is_running = False
            
    def get_supabase_client(self) -> Client:
        """Create a new Supabase client for job execution."""
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase credentials not configured")
            
        return create_client(supabase_url, supabase_key)
    
    async def start(self):
        """Start the scheduler."""
        if self._is_running:
            logger.info("Rundown scheduler already running")
            return
            
        if not RUNDOWN_CRON_ENABLED:
            logger.info("Rundown cron job is disabled via configuration")
            return
            
        # Add event listeners
        self._scheduler.add_listener(
            self._on_job_executed,
            EVENT_JOB_EXECUTED
        )
        self._scheduler.add_listener(
            self._on_job_error,
            EVENT_JOB_ERROR
        )
        
        # Add the cron job
        self._scheduler.add_job(
            self._run_generation,
            CronTrigger.from_crontab(RUNDOWN_CRON_SCHEDULE),
            id="rundown_profile_generation",
            name="Daily Rundown Profile Generation",
            replace_existing=True
        )
        
        # Start the scheduler
        self._scheduler.start()
        self._is_running = True
        
        logger.info(f"Rundown scheduler started with schedule: {RUNDOWN_CRON_SCHEDULE}")
        
    async def stop(self):
        """Stop the scheduler."""
        if self._scheduler and self._is_running:
            self._scheduler.shutdown(wait=True)
            self._is_running = False
            logger.info("Rundown scheduler stopped")
            
    async def _run_generation(self):
        """Execute the scheduled profile generation."""
        logger.info("Starting scheduled rundown profile generation")
        start_time = datetime.utcnow()
        
        try:
            supabase = self.get_supabase_client()
            generator = RundownGenerator(supabase)
            
            result = await generator.generate(
                profile_types=["standard"],
                scenario_name="baseline",
                include_predictions=True
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            logger.info(
                f"Scheduled generation completed: "
                f"{result['projects_processed']} projects, "
                f"{result['profiles_created']} profiles, "
                f"{result['errors_count']} errors in {execution_time:.2f}s"
            )
            
            # Log to database
            await self._log_cron_execution(
                supabase,
                status="completed" if result["errors_count"] == 0 else "partial",
                message=f"Processed {result['projects_processed']} projects",
                projects_processed=result["projects_processed"],
                profiles_created=result["profiles_created"],
                errors_count=result["errors_count"],
                execution_time_ms=result["execution_time_ms"]
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Scheduled generation failed: {e}")
            
            try:
                supabase = self.get_supabase_client()
                await self._log_cron_execution(
                    supabase,
                    status="failed",
                    message=str(e),
                    errors_count=1
                )
            except Exception as log_error:
                logger.error(f"Failed to log execution error: {log_error}")
                
            # Send alert notification
            await self._send_alert(f"Rundown profile generation failed: {e}")
            
            raise
            
    async def _log_cron_execution(
        self,
        supabase: Client,
        status: str,
        message: str,
        projects_processed: int = 0,
        profiles_created: int = 0,
        errors_count: int = 0,
        execution_time_ms: int = None
    ):
        """Log cron execution to database."""
        import uuid
        
        try:
            log_entry = {
                "execution_id": str(uuid.uuid4()),
                "status": status,
                "message": f"[CRON] {message}",
                "projects_processed": projects_processed,
                "profiles_created": profiles_created,
                "errors_count": errors_count,
                "execution_time_ms": execution_time_ms
            }
            supabase.table("rundown_generation_logs").insert(log_entry).execute()
        except Exception as e:
            logger.warning(f"Failed to log cron execution: {e}")
            
    async def _send_alert(self, message: str):
        """Send alert notification for failed execution."""
        # Webhook notification
        if ALERT_WEBHOOK_URL:
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "text": f"🚨 Rundown Profile Alert\n{message}",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    async with session.post(ALERT_WEBHOOK_URL, json=payload) as resp:
                        if resp.status >= 400:
                            logger.warning(f"Alert webhook returned status {resp.status}")
            except Exception as e:
                logger.error(f"Failed to send webhook alert: {e}")
                
        # Email notification (would need SMTP configuration)
        if ALERT_EMAIL:
            logger.info(f"Alert email would be sent to {ALERT_EMAIL}: {message}")
            # Actual email sending would be implemented here
            
    def _on_job_executed(self, event):
        """Handle job execution event."""
        logger.debug(f"Job {event.job_id} executed successfully")
        
    def _on_job_error(self, event):
        """Handle job error event."""
        logger.error(f"Job {event.job_id} failed with exception: {event.exception}")
        
    def get_next_run_time(self) -> Optional[datetime]:
        """Get the next scheduled run time."""
        if not self._scheduler or not self._is_running:
            return None
            
        job = self._scheduler.get_job("rundown_profile_generation")
        if job:
            return job.next_run_time
        return None
        
    def is_running(self) -> bool:
        """Check if the scheduler is running."""
        return self._is_running
        
    async def trigger_immediate(self):
        """Trigger an immediate generation (outside of schedule)."""
        logger.info("Triggering immediate rundown profile generation")
        return await self._run_generation()


# Global scheduler instance
_scheduler_instance: Optional[RundownScheduler] = None


def get_rundown_scheduler() -> RundownScheduler:
    """Get the global scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = RundownScheduler()
    return _scheduler_instance


@asynccontextmanager
async def lifespan_scheduler():
    """Context manager for scheduler lifecycle."""
    scheduler = get_rundown_scheduler()
    await scheduler.start()
    try:
        yield scheduler
    finally:
        await scheduler.stop()
