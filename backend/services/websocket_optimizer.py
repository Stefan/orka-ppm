"""
WebSocket Optimization Service
Implements connection pooling, message batching, and scalability improvements
"""

import os
import logging
import asyncio
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
from collections import defaultdict, deque
import json

try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = None

logger = logging.getLogger(__name__)


class MessageBatch:
    """Container for batched WebSocket messages"""
    
    def __init__(self, max_size: int = 10, max_wait_ms: int = 50):
        self.messages: List[Dict[str, Any]] = []
        self.max_size = max_size
        self.max_wait_ms = max_wait_ms
        self.created_at = datetime.utcnow()
    
    def add_message(self, message: Dict[str, Any]) -> bool:
        """Add message to batch, returns True if batch is full"""
        self.messages.append(message)
        return len(self.messages) >= self.max_size
    
    def is_ready(self) -> bool:
        """Check if batch is ready to send"""
        if len(self.messages) >= self.max_size:
            return True
        
        age_ms = (datetime.utcnow() - self.created_at).total_seconds() * 1000
        return age_ms >= self.max_wait_ms
    
    def get_messages(self) -> List[Dict[str, Any]]:
        """Get all messages in batch"""
        return self.messages
    
    def clear(self) -> None:
        """Clear batch"""
        self.messages = []
        self.created_at = datetime.utcnow()


class ConnectionPool:
    """Manages WebSocket connection pooling and lifecycle"""
    
    def __init__(self, max_connections_per_session: int = 100):
        self.max_connections_per_session = max_connections_per_session
        self.connections: Dict[str, Set[str]] = defaultdict(set)  # session_id -> set of user_ids
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}  # connection_id -> metadata
        self.last_activity: Dict[str, datetime] = {}  # connection_id -> last_activity
        
        logger.info(f"Connection pool initialized with max {max_connections_per_session} connections per session")
    
    def add_connection(
        self,
        session_id: str,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Add connection to pool"""
        try:
            # Check if session is at capacity
            if len(self.connections[session_id]) >= self.max_connections_per_session:
                logger.warning(f"Session {session_id} at max capacity")
                return False
            
            # Add connection
            self.connections[session_id].add(user_id)
            
            connection_id = f"{session_id}:{user_id}"
            self.connection_metadata[connection_id] = metadata or {}
            self.last_activity[connection_id] = datetime.utcnow()
            
            logger.debug(f"Added connection {connection_id} to pool")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add connection: {e}")
            return False
    
    def remove_connection(self, session_id: str, user_id: str) -> bool:
        """Remove connection from pool"""
        try:
            if session_id in self.connections:
                self.connections[session_id].discard(user_id)
                
                # Clean up empty sessions
                if not self.connections[session_id]:
                    del self.connections[session_id]
            
            connection_id = f"{session_id}:{user_id}"
            self.connection_metadata.pop(connection_id, None)
            self.last_activity.pop(connection_id, None)
            
            logger.debug(f"Removed connection {connection_id} from pool")
            return True
            
        except Exception as e:
            logger.error(f"Failed to remove connection: {e}")
            return False
    
    def update_activity(self, session_id: str, user_id: str) -> None:
        """Update last activity timestamp for connection"""
        connection_id = f"{session_id}:{user_id}"
        self.last_activity[connection_id] = datetime.utcnow()
    
    def get_session_connections(self, session_id: str) -> Set[str]:
        """Get all user IDs connected to a session"""
        return self.connections.get(session_id, set())
    
    def get_connection_count(self, session_id: Optional[str] = None) -> int:
        """Get connection count for session or total"""
        if session_id:
            return len(self.connections.get(session_id, set()))
        return sum(len(users) for users in self.connections.values())
    
    def cleanup_idle_connections(self, idle_timeout_minutes: int = 30) -> int:
        """Remove idle connections"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=idle_timeout_minutes)
            removed_count = 0
            
            # Find idle connections
            idle_connections = [
                conn_id for conn_id, last_active in self.last_activity.items()
                if last_active < cutoff_time
            ]
            
            # Remove idle connections
            for connection_id in idle_connections:
                session_id, user_id = connection_id.split(":", 1)
                if self.remove_connection(session_id, user_id):
                    removed_count += 1
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} idle connections")
            
            return removed_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup idle connections: {e}")
            return 0


class WebSocketOptimizer:
    """
    WebSocket optimization service for Enhanced PMR
    Implements message batching, connection pooling, and Redis pub/sub for scalability
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """Initialize WebSocket optimizer"""
        self.connection_pool = ConnectionPool()
        self.message_batches: Dict[str, MessageBatch] = {}  # session_id -> MessageBatch
        self.redis_client: Optional[Redis] = None
        self.redis_enabled = False
        
        # Configuration
        self.batch_max_size = int(os.getenv("WS_BATCH_MAX_SIZE", "10"))
        self.batch_max_wait_ms = int(os.getenv("WS_BATCH_MAX_WAIT_MS", "50"))
        self.enable_batching = os.getenv("WS_ENABLE_BATCHING", "true").lower() == "true"
        
        # Initialize Redis for pub/sub if available
        if REDIS_AVAILABLE:
            try:
                explicit_redis_url = redis_url or os.getenv("REDIS_URL")
                effective_url = explicit_redis_url or "redis://localhost:6379/0"
                self.redis_client = redis.from_url(
                    effective_url,
                    decode_responses=True,
                    socket_connect_timeout=5
                )
                self.redis_client.ping()
                self.redis_enabled = True
                logger.info("WebSocket optimizer initialized with Redis pub/sub")
            except Exception as e:
                # Only warn if Redis was explicitly configured (expected but unavailable)
                if explicit_redis_url:
                    logger.warning(
                        "Redis not available for WebSocket optimization: %s", e
                    )
                else:
                    logger.debug(
                        "Redis not available (not configured); WebSocket optimizer running without pub/sub: %s",
                        e,
                    )
        
        # Background tasks will be started when first needed
        self._background_tasks_started = False
        
        logger.info("WebSocket Optimizer initialized")
    
    def _start_background_tasks(self) -> None:
        """Start background tasks for optimization"""
        if self._background_tasks_started:
            return
        
        try:
            # Start batch flusher
            if self.enable_batching:
                asyncio.create_task(self._batch_flusher())
            
            # Start idle connection cleanup
            asyncio.create_task(self._idle_connection_cleanup())
            
            self._background_tasks_started = True
            logger.info("Background tasks started")
        except RuntimeError:
            # No event loop running, tasks will be started when needed
            logger.debug("Event loop not running, background tasks will start later")
    
    # Connection Management
    
    async def register_connection(
        self,
        session_id: str,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Register a new WebSocket connection"""
        # Start background tasks if not already started
        if not self._background_tasks_started:
            self._start_background_tasks()
        
        return self.connection_pool.add_connection(session_id, user_id, metadata)
    
    async def unregister_connection(self, session_id: str, user_id: str) -> bool:
        """Unregister a WebSocket connection"""
        return self.connection_pool.remove_connection(session_id, user_id)
    
    async def update_connection_activity(self, session_id: str, user_id: str) -> None:
        """Update connection activity timestamp"""
        self.connection_pool.update_activity(session_id, user_id)
    
    # Message Batching
    
    async def queue_message(
        self,
        session_id: str,
        message: Dict[str, Any],
        force_send: bool = False
    ) -> bool:
        """Queue message for batching"""
        if not self.enable_batching or force_send:
            # Send immediately without batching
            return await self._send_message_immediate(session_id, message)
        
        try:
            # Get or create batch for session
            if session_id not in self.message_batches:
                self.message_batches[session_id] = MessageBatch(
                    max_size=self.batch_max_size,
                    max_wait_ms=self.batch_max_wait_ms
                )
            
            batch = self.message_batches[session_id]
            is_full = batch.add_message(message)
            
            # Send immediately if batch is full
            if is_full:
                await self._flush_batch(session_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to queue message: {e}")
            return False
    
    async def _flush_batch(self, session_id: str) -> bool:
        """Flush message batch for a session"""
        if session_id not in self.message_batches:
            return False
        
        try:
            batch = self.message_batches[session_id]
            messages = batch.get_messages()
            
            if not messages:
                return True
            
            # Create batched message
            batched_message = {
                "type": "batch",
                "messages": messages,
                "count": len(messages),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Send via Redis pub/sub if enabled, otherwise direct send
            if self.redis_enabled:
                await self._publish_to_redis(session_id, batched_message)
            else:
                await self._send_message_immediate(session_id, batched_message)
            
            # Clear batch
            batch.clear()
            
            logger.debug(f"Flushed batch of {len(messages)} messages for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to flush batch: {e}")
            return False
    
    async def _batch_flusher(self) -> None:
        """Background task to flush ready batches"""
        while True:
            try:
                await asyncio.sleep(0.05)  # Check every 50ms
                
                # Check all batches
                sessions_to_flush = []
                for session_id, batch in self.message_batches.items():
                    if batch.is_ready():
                        sessions_to_flush.append(session_id)
                
                # Flush ready batches
                for session_id in sessions_to_flush:
                    await self._flush_batch(session_id)
                
            except Exception as e:
                logger.error(f"Batch flusher error: {e}")
                await asyncio.sleep(1)
    
    # Redis Pub/Sub for Multi-Instance Scalability
    
    async def _publish_to_redis(self, session_id: str, message: Dict[str, Any]) -> bool:
        """Publish message to Redis pub/sub channel"""
        if not self.redis_enabled:
            return False
        
        try:
            channel = f"pmr:session:{session_id}"
            message_json = json.dumps(message)
            
            self.redis_client.publish(channel, message_json)
            
            logger.debug(f"Published message to Redis channel {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish to Redis: {e}")
            return False
    
    async def subscribe_to_session(self, session_id: str, callback) -> bool:
        """Subscribe to session messages via Redis pub/sub"""
        if not self.redis_enabled:
            return False
        
        try:
            channel = f"pmr:session:{session_id}"
            pubsub = self.redis_client.pubsub()
            pubsub.subscribe(channel)
            
            # Start listener in background
            asyncio.create_task(self._redis_listener(pubsub, callback))
            
            logger.info(f"Subscribed to Redis channel {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to subscribe to Redis: {e}")
            return False
    
    async def _redis_listener(self, pubsub, callback) -> None:
        """Listen for Redis pub/sub messages"""
        try:
            for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await callback(data)
        except Exception as e:
            logger.error(f"Redis listener error: {e}")
    
    # Direct Message Sending (fallback)
    
    async def _send_message_immediate(
        self,
        session_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """Send message immediately without batching"""
        # This would integrate with the actual WebSocket connection manager
        # For now, it's a placeholder that would be implemented by the collaboration service
        logger.debug(f"Sending immediate message to session {session_id}")
        return True
    
    # Background Maintenance
    
    async def _idle_connection_cleanup(self) -> None:
        """Background task to cleanup idle connections"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                idle_timeout = int(os.getenv("WS_IDLE_TIMEOUT_MINUTES", "30"))
                removed = self.connection_pool.cleanup_idle_connections(idle_timeout)
                
                if removed > 0:
                    logger.info(f"Cleaned up {removed} idle WebSocket connections")
                
            except Exception as e:
                logger.error(f"Idle connection cleanup error: {e}")
                await asyncio.sleep(60)
    
    # Statistics and Monitoring
    
    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket optimizer statistics"""
        return {
            "enabled": True,
            "batching_enabled": self.enable_batching,
            "redis_enabled": self.redis_enabled,
            "total_connections": self.connection_pool.get_connection_count(),
            "active_sessions": len(self.connection_pool.connections),
            "pending_batches": len(self.message_batches),
            "batch_config": {
                "max_size": self.batch_max_size,
                "max_wait_ms": self.batch_max_wait_ms
            }
        }
    
    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """Get statistics for a specific session"""
        connections = self.connection_pool.get_session_connections(session_id)
        
        batch_info = {}
        if session_id in self.message_batches:
            batch = self.message_batches[session_id]
            batch_info = {
                "pending_messages": len(batch.messages),
                "batch_age_ms": (datetime.utcnow() - batch.created_at).total_seconds() * 1000
            }
        
        return {
            "session_id": session_id,
            "connection_count": len(connections),
            "connected_users": list(connections),
            "batch_info": batch_info
        }
    
    # Health Check
    
    def health_check(self) -> Dict[str, Any]:
        """Check WebSocket optimizer health"""
        try:
            health = {
                "status": "healthy",
                "batching_enabled": self.enable_batching,
                "redis_enabled": self.redis_enabled,
                "total_connections": self.connection_pool.get_connection_count(),
                "active_sessions": len(self.connection_pool.connections)
            }
            
            # Test Redis if enabled
            if self.redis_enabled:
                try:
                    self.redis_client.ping()
                    health["redis_status"] = "connected"
                except Exception as e:
                    health["redis_status"] = "disconnected"
                    health["redis_error"] = str(e)
                    health["status"] = "degraded"
            
            return health
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global WebSocket optimizer instance
websocket_optimizer = WebSocketOptimizer()
