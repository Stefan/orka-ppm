"""
WebSocket Connection Manager for Enhanced PMR
Optimized for scalability with connection pooling and Redis pub/sub
"""

import os
import json
import logging
import asyncio
from typing import Dict, Set, Optional, Any, Callable
from datetime import datetime
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """
    Manages WebSocket connections for real-time PMR collaboration
    Supports horizontal scaling via Redis pub/sub
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """Initialize WebSocket manager"""
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        
        # Active connections: report_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        
        # User presence: report_id -> user_id -> WebSocket
        self.user_presence: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)
        
        # Connection metadata: WebSocket -> metadata dict
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        
        # Redis pub/sub for multi-instance support
        self.redis_client: Optional[aioredis.Redis] = None
        self.pubsub: Optional[aioredis.client.PubSub] = None
        self.redis_enabled = False
        
        # Message handlers
        self.message_handlers: Dict[str, Callable] = {}
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "total_messages": 0,
            "total_broadcasts": 0,
            "connection_errors": 0
        }
    
    async def initialize_redis(self):
        """Initialize Redis pub/sub for multi-instance support"""
        try:
            self.redis_client = await aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5
            )
            await self.redis_client.ping()
            
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe('pmr:collaboration:*')
            
            self.redis_enabled = True
            logger.info("Redis pub/sub initialized for WebSocket scaling")
            
            # Start Redis message listener
            asyncio.create_task(self._redis_message_listener())
            
        except Exception as e:
            logger.warning(f"Redis pub/sub initialization failed: {e}. Running in single-instance mode.")
            self.redis_enabled = False
    
    async def _redis_message_listener(self):
        """Listen for Redis pub/sub messages"""
        if not self.pubsub:
            return
        
        try:
            async for message in self.pubsub.listen():
                if message['type'] == 'message':
                    await self._handle_redis_message(message)
        except Exception as e:
            logger.error(f"Redis message listener error: {e}")
    
    async def _handle_redis_message(self, message: Dict[str, Any]):
        """Handle incoming Redis pub/sub message"""
        try:
            channel = message['channel']
            data = json.loads(message['data'])
            
            # Extract report_id from channel name
            report_id = channel.split(':')[-1]
            
            # Broadcast to local connections
            await self._broadcast_to_local_connections(report_id, data)
            
        except Exception as e:
            logger.error(f"Error handling Redis message: {e}")
    
    # ========================================================================
    # Connection Management
    # ========================================================================
    
    async def connect(
        self,
        websocket: WebSocket,
        report_id: str,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Accept and register a new WebSocket connection
        
        Args:
            websocket: WebSocket connection
            report_id: Report UUID
            user_id: User UUID
            metadata: Optional connection metadata
        """
        try:
            await websocket.accept()
            
            # Register connection
            self.active_connections[report_id].add(websocket)
            self.user_presence[report_id][user_id] = websocket
            
            # Store metadata
            self.connection_metadata[websocket] = {
                "report_id": report_id,
                "user_id": user_id,
                "connected_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {}
            }
            
            # Update statistics
            self.stats["total_connections"] += 1
            
            # Notify other users about new connection
            await self.broadcast_to_report(
                report_id,
                {
                    "type": "user_joined",
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat()
                },
                exclude=websocket
            )
            
            # Send current user presence to new connection
            await self._send_user_presence(websocket, report_id)
            
            logger.info(f"WebSocket connected: user={user_id}, report={report_id}")
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket: {e}")
            self.stats["connection_errors"] += 1
            raise
    
    async def disconnect(self, websocket: WebSocket):
        """
        Disconnect and cleanup a WebSocket connection
        
        Args:
            websocket: WebSocket connection to disconnect
        """
        try:
            # Get connection metadata
            metadata = self.connection_metadata.get(websocket, {})
            report_id = metadata.get("report_id")
            user_id = metadata.get("user_id")
            
            if report_id:
                # Remove from active connections
                self.active_connections[report_id].discard(websocket)
                
                # Remove from user presence
                if user_id and user_id in self.user_presence[report_id]:
                    del self.user_presence[report_id][user_id]
                
                # Cleanup empty sets
                if not self.active_connections[report_id]:
                    del self.active_connections[report_id]
                if not self.user_presence[report_id]:
                    del self.user_presence[report_id]
                
                # Notify other users about disconnection
                if user_id:
                    await self.broadcast_to_report(
                        report_id,
                        {
                            "type": "user_left",
                            "user_id": user_id,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
            
            # Remove metadata
            if websocket in self.connection_metadata:
                del self.connection_metadata[websocket]
            
            logger.info(f"WebSocket disconnected: user={user_id}, report={report_id}")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")
    
    async def _send_user_presence(self, websocket: WebSocket, report_id: str):
        """Send current user presence to a connection"""
        try:
            active_users = [
                {
                    "user_id": user_id,
                    "connected_at": self.connection_metadata.get(ws, {}).get("connected_at")
                }
                for user_id, ws in self.user_presence[report_id].items()
            ]
            
            await websocket.send_json({
                "type": "user_presence",
                "active_users": active_users,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error sending user presence: {e}")
    
    # ========================================================================
    # Message Broadcasting
    # ========================================================================
    
    async def broadcast_to_report(
        self,
        report_id: str,
        message: Dict[str, Any],
        exclude: Optional[WebSocket] = None
    ):
        """
        Broadcast message to all connections for a report
        
        Args:
            report_id: Report UUID
            message: Message dictionary to broadcast
            exclude: Optional WebSocket to exclude from broadcast
        """
        try:
            # Publish to Redis for multi-instance support
            if self.redis_enabled and self.redis_client:
                await self.redis_client.publish(
                    f'pmr:collaboration:{report_id}',
                    json.dumps(message)
                )
            
            # Broadcast to local connections
            await self._broadcast_to_local_connections(report_id, message, exclude)
            
            self.stats["total_broadcasts"] += 1
            
        except Exception as e:
            logger.error(f"Error broadcasting to report {report_id}: {e}")
    
    async def _broadcast_to_local_connections(
        self,
        report_id: str,
        message: Dict[str, Any],
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast message to local WebSocket connections"""
        if report_id not in self.active_connections:
            return
        
        disconnected = []
        
        for connection in self.active_connections[report_id]:
            if connection == exclude:
                continue
            
            try:
                await connection.send_json(message)
                self.stats["total_messages"] += 1
            except WebSocketDisconnect:
                disconnected.append(connection)
            except Exception as e:
                logger.error(f"Error sending message to connection: {e}")
                disconnected.append(connection)
        
        # Cleanup disconnected connections
        for connection in disconnected:
            await self.disconnect(connection)
    
    async def send_to_user(
        self,
        report_id: str,
        user_id: str,
        message: Dict[str, Any]
    ):
        """
        Send message to a specific user
        
        Args:
            report_id: Report UUID
            user_id: User UUID
            message: Message dictionary to send
        """
        try:
            if report_id in self.user_presence and user_id in self.user_presence[report_id]:
                websocket = self.user_presence[report_id][user_id]
                await websocket.send_json(message)
                self.stats["total_messages"] += 1
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {e}")
    
    # ========================================================================
    # Message Handling
    # ========================================================================
    
    def register_handler(self, message_type: str, handler: Callable):
        """
        Register a message handler for a specific message type
        
        Args:
            message_type: Type of message to handle
            handler: Async function to handle the message
        """
        self.message_handlers[message_type] = handler
    
    async def handle_message(
        self,
        websocket: WebSocket,
        message: Dict[str, Any]
    ):
        """
        Handle incoming WebSocket message
        
        Args:
            websocket: WebSocket connection
            message: Message dictionary
        """
        try:
            message_type = message.get("type")
            
            if not message_type:
                logger.warning("Received message without type")
                return
            
            # Get connection metadata
            metadata = self.connection_metadata.get(websocket, {})
            report_id = metadata.get("report_id")
            user_id = metadata.get("user_id")
            
            # Add metadata to message
            message["report_id"] = report_id
            message["user_id"] = user_id
            message["timestamp"] = datetime.utcnow().isoformat()
            
            # Call registered handler if exists
            if message_type in self.message_handlers:
                await self.message_handlers[message_type](websocket, message)
            else:
                # Default: broadcast to all users in report
                await self.broadcast_to_report(report_id, message, exclude=websocket)
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    # ========================================================================
    # Connection Information
    # ========================================================================
    
    def get_active_users(self, report_id: str) -> list[str]:
        """Get list of active user IDs for a report"""
        if report_id not in self.user_presence:
            return []
        return list(self.user_presence[report_id].keys())
    
    def get_connection_count(self, report_id: str) -> int:
        """Get number of active connections for a report"""
        if report_id not in self.active_connections:
            return 0
        return len(self.active_connections[report_id])
    
    def get_total_connections(self) -> int:
        """Get total number of active connections"""
        return sum(len(connections) for connections in self.active_connections.values())
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get WebSocket manager statistics"""
        return {
            **self.stats,
            "active_reports": len(self.active_connections),
            "active_connections": self.get_total_connections(),
            "redis_enabled": self.redis_enabled
        }
    
    def get_report_info(self, report_id: str) -> Dict[str, Any]:
        """Get information about a specific report's connections"""
        return {
            "report_id": report_id,
            "active_users": self.get_active_users(report_id),
            "connection_count": self.get_connection_count(report_id),
            "user_details": [
                {
                    "user_id": user_id,
                    **self.connection_metadata.get(ws, {})
                }
                for user_id, ws in self.user_presence.get(report_id, {}).items()
            ]
        }
    
    # ========================================================================
    # Health Check
    # ========================================================================
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on WebSocket manager"""
        health = {
            "healthy": True,
            "active_connections": self.get_total_connections(),
            "active_reports": len(self.active_connections),
            "redis_enabled": self.redis_enabled
        }
        
        # Check Redis connection if enabled
        if self.redis_enabled and self.redis_client:
            try:
                await self.redis_client.ping()
                health["redis_status"] = "connected"
            except Exception as e:
                health["healthy"] = False
                health["redis_status"] = "error"
                health["redis_error"] = str(e)
        
        return health
    
    # ========================================================================
    # Cleanup
    # ========================================================================
    
    async def shutdown(self):
        """Shutdown WebSocket manager and cleanup resources"""
        logger.info("Shutting down WebSocket manager...")
        
        # Close all active connections
        for report_id, connections in list(self.active_connections.items()):
            for websocket in list(connections):
                try:
                    await websocket.close()
                except Exception:
                    pass
        
        # Cleanup Redis
        if self.pubsub:
            await self.pubsub.unsubscribe('pmr:collaboration:*')
            await self.pubsub.close()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("WebSocket manager shutdown complete")


# Global WebSocket manager instance
_ws_manager: Optional[WebSocketConnectionManager] = None


def get_websocket_manager() -> WebSocketConnectionManager:
    """Get or create global WebSocket manager instance"""
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = WebSocketConnectionManager()
    return _ws_manager
