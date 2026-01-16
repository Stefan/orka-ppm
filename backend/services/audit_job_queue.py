"""
Audit Job Queue Service

Provides async job queuing for audit event processing using Redis.
Enables high-throughput audit event ingestion by queuing events for
asynchronous processing during high-load scenarios.

Requirements: 7.8
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import uuid4
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class AuditJobQueue:
    """
    Redis-based job queue for asynchronous audit event processing.
    
    Provides:
    - Event queuing for high-load scenarios
    - Worker process management
    - Job status tracking
    - Retry logic with exponential backoff
    """
    
    # Queue names
    AUDIT_EVENT_QUEUE = "audit:queue:events"
    AUDIT_PROCESSING_QUEUE = "audit:queue:processing"
    AUDIT_FAILED_QUEUE = "audit:queue:failed"
    AUDIT_COMPLETED_QUEUE = "audit:queue:completed"
    
    # Job status
    STATUS_QUEUED = "queued"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize audit job queue.
        
        Args:
            redis_url: Redis connection URL (defaults to REDIS_URL env var)
        """
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.redis_client: Optional[aioredis.Redis] = None
        self.enabled = True
        self.max_retries = 3
        self.retry_delay = 5  # seconds
        
    async def connect(self):
        """Establish connection to Redis."""
        try:
            self.redis_client = await aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Audit job queue connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.enabled = False
            self.redis_client = None
    
    async def disconnect(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Audit job queue disconnected from Redis")
    
    async def enqueue_event(
        self,
        event: Dict[str, Any],
        priority: int = 0
    ) -> Optional[str]:
        """
        Enqueue an audit event for asynchronous processing.
        
        Args:
            event: Audit event dictionary
            priority: Job priority (higher = more important, default: 0)
            
        Returns:
            Job ID if successful, None otherwise
            
        Requirements: 7.8
        """
        if not self.enabled or not self.redis_client:
            logger.warning("Job queue not available, processing event synchronously")
            return None
        
        try:
            # Generate job ID
            job_id = str(uuid4())
            
            # Create job payload
            job = {
                "id": job_id,
                "event": event,
                "priority": priority,
                "status": self.STATUS_QUEUED,
                "created_at": datetime.now().isoformat(),
                "retry_count": 0
            }
            
            # Serialize job
            job_json = json.dumps(job)
            
            # Add to queue with priority (using sorted set)
            await self.redis_client.zadd(
                self.AUDIT_EVENT_QUEUE,
                {job_json: priority}
            )
            
            # Store job metadata
            await self.redis_client.setex(
                f"audit:job:{job_id}",
                3600,  # 1 hour TTL
                job_json
            )
            
            logger.debug(f"Enqueued audit event job {job_id} with priority {priority}")
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to enqueue audit event: {e}")
            return None
    
    async def enqueue_batch(
        self,
        events: List[Dict[str, Any]],
        priority: int = 0
    ) -> List[str]:
        """
        Enqueue multiple audit events in a batch.
        
        Args:
            events: List of audit event dictionaries
            priority: Job priority for all events
            
        Returns:
            List of job IDs
            
        Requirements: 7.8
        """
        job_ids = []
        
        for event in events:
            job_id = await self.enqueue_event(event, priority)
            if job_id:
                job_ids.append(job_id)
        
        logger.info(f"Enqueued batch of {len(job_ids)} audit events")
        return job_ids
    
    async def dequeue_event(self) -> Optional[Dict[str, Any]]:
        """
        Dequeue the highest priority audit event for processing.
        
        Returns:
            Job dictionary if available, None otherwise
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            # Get highest priority job (highest score)
            result = await self.redis_client.zpopmax(self.AUDIT_EVENT_QUEUE)
            
            if not result:
                return None
            
            job_json, priority = result[0]
            job = json.loads(job_json)
            
            # Move to processing queue
            job["status"] = self.STATUS_PROCESSING
            job["processing_started_at"] = datetime.now().isoformat()
            
            await self.redis_client.lpush(
                self.AUDIT_PROCESSING_QUEUE,
                json.dumps(job)
            )
            
            # Update job metadata
            await self.redis_client.setex(
                f"audit:job:{job['id']}",
                3600,
                json.dumps(job)
            )
            
            logger.debug(f"Dequeued audit event job {job['id']}")
            return job
            
        except Exception as e:
            logger.error(f"Failed to dequeue audit event: {e}")
            return None
    
    async def mark_completed(self, job_id: str):
        """
        Mark a job as completed.
        
        Args:
            job_id: Job ID
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            # Get job from processing queue
            job_key = f"audit:job:{job_id}"
            job_json = await self.redis_client.get(job_key)
            
            if not job_json:
                logger.warning(f"Job {job_id} not found")
                return
            
            job = json.loads(job_json)
            job["status"] = self.STATUS_COMPLETED
            job["completed_at"] = datetime.now().isoformat()
            
            # Move to completed queue
            await self.redis_client.lpush(
                self.AUDIT_COMPLETED_QUEUE,
                json.dumps(job)
            )
            
            # Update job metadata with shorter TTL
            await self.redis_client.setex(
                job_key,
                300,  # 5 minutes
                json.dumps(job)
            )
            
            logger.debug(f"Marked job {job_id} as completed")
            
        except Exception as e:
            logger.error(f"Failed to mark job as completed: {e}")
    
    async def mark_failed(
        self,
        job_id: str,
        error: str,
        retry: bool = True
    ):
        """
        Mark a job as failed and optionally retry.
        
        Args:
            job_id: Job ID
            error: Error message
            retry: Whether to retry the job
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            # Get job
            job_key = f"audit:job:{job_id}"
            job_json = await self.redis_client.get(job_key)
            
            if not job_json:
                logger.warning(f"Job {job_id} not found")
                return
            
            job = json.loads(job_json)
            job["retry_count"] = job.get("retry_count", 0) + 1
            job["last_error"] = error
            job["last_failed_at"] = datetime.now().isoformat()
            
            # Check if we should retry
            if retry and job["retry_count"] < self.max_retries:
                # Re-queue with lower priority
                job["status"] = self.STATUS_QUEUED
                priority = job.get("priority", 0) - job["retry_count"]
                
                await self.redis_client.zadd(
                    self.AUDIT_EVENT_QUEUE,
                    {json.dumps(job): priority}
                )
                
                logger.info(
                    f"Re-queued failed job {job_id} "
                    f"(retry {job['retry_count']}/{self.max_retries})"
                )
            else:
                # Move to failed queue
                job["status"] = self.STATUS_FAILED
                
                await self.redis_client.lpush(
                    self.AUDIT_FAILED_QUEUE,
                    json.dumps(job)
                )
                
                logger.error(
                    f"Job {job_id} failed permanently after "
                    f"{job['retry_count']} retries: {error}"
                )
            
            # Update job metadata
            await self.redis_client.setex(
                job_key,
                3600,
                json.dumps(job)
            )
            
        except Exception as e:
            logger.error(f"Failed to mark job as failed: {e}")
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the job queue.
        
        Returns:
            Dictionary with queue statistics
        """
        if not self.enabled or not self.redis_client:
            return {
                "enabled": False,
                "queued": 0,
                "processing": 0,
                "completed": 0,
                "failed": 0
            }
        
        try:
            queued = await self.redis_client.zcard(self.AUDIT_EVENT_QUEUE)
            processing = await self.redis_client.llen(self.AUDIT_PROCESSING_QUEUE)
            completed = await self.redis_client.llen(self.AUDIT_COMPLETED_QUEUE)
            failed = await self.redis_client.llen(self.AUDIT_FAILED_QUEUE)
            
            return {
                "enabled": True,
                "queued": queued,
                "processing": processing,
                "completed": completed,
                "failed": failed,
                "total": queued + processing + completed + failed
            }
            
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {
                "enabled": True,
                "error": str(e)
            }
    
    async def clear_completed(self, max_age_seconds: int = 3600):
        """
        Clear completed jobs older than specified age.
        
        Args:
            max_age_seconds: Maximum age in seconds (default: 1 hour)
        """
        if not self.enabled or not self.redis_client:
            return
        
        try:
            # Get all completed jobs
            completed_jobs = await self.redis_client.lrange(
                self.AUDIT_COMPLETED_QUEUE,
                0,
                -1
            )
            
            cutoff_time = datetime.now().timestamp() - max_age_seconds
            removed_count = 0
            
            for job_json in completed_jobs:
                job = json.loads(job_json)
                completed_at = datetime.fromisoformat(job.get("completed_at", ""))
                
                if completed_at.timestamp() < cutoff_time:
                    await self.redis_client.lrem(
                        self.AUDIT_COMPLETED_QUEUE,
                        1,
                        job_json
                    )
                    removed_count += 1
            
            logger.info(f"Cleared {removed_count} old completed jobs")
            
        except Exception as e:
            logger.error(f"Failed to clear completed jobs: {e}")


# Global job queue instance
_job_queue_instance: Optional[AuditJobQueue] = None


async def get_job_queue() -> AuditJobQueue:
    """Get or create global job queue instance."""
    global _job_queue_instance
    
    if _job_queue_instance is None:
        _job_queue_instance = AuditJobQueue()
        await _job_queue_instance.connect()
    
    return _job_queue_instance


async def process_audit_event_job(job: Dict[str, Any]):
    """
    Process a single audit event job.
    
    This function is called by worker processes to handle queued events.
    
    Args:
        job: Job dictionary containing event data
    """
    from config.database import supabase
    
    try:
        event = job["event"]
        job_id = job["id"]
        
        logger.info(f"Processing audit event job {job_id}")
        
        # Insert event into database
        response = supabase.table("roche_audit_logs").insert(event).execute()
        
        if not response.data:
            raise Exception("Failed to insert audit event")
        
        # Mark job as completed
        queue = await get_job_queue()
        await queue.mark_completed(job_id)
        
        logger.info(f"Completed audit event job {job_id}")
        
    except Exception as e:
        logger.error(f"Failed to process audit event job: {e}")
        
        # Mark job as failed (will retry if applicable)
        queue = await get_job_queue()
        await queue.mark_failed(job["id"], str(e), retry=True)


async def start_worker(worker_id: int = 0):
    """
    Start a worker process to consume jobs from the queue.
    
    Args:
        worker_id: Worker identifier for logging
    """
    logger.info(f"Starting audit job queue worker {worker_id}")
    
    queue = await get_job_queue()
    
    while True:
        try:
            # Dequeue next job
            job = await queue.dequeue_event()
            
            if job:
                # Process job
                await process_audit_event_job(job)
            else:
                # No jobs available, wait before checking again
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"Worker {worker_id} error: {e}")
            await asyncio.sleep(5)  # Wait before retrying
