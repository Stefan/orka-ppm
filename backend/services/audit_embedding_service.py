"""
Audit Embedding Service
Background service for generating embeddings for audit logs

This service runs as a background job to:
1. Generate embeddings for new audit logs
2. Update embedding column when new logs are created
3. Process logs in batches for efficiency

Requirements: 14.1
"""

import os
import sys
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AuditEmbeddingService:
    """
    Background service for generating embeddings for audit logs
    
    This service:
    - Monitors audit logs for entries without embeddings
    - Generates embeddings using OpenAI API
    - Updates the embedding column in audit_logs table
    - Processes logs in batches for efficiency
    """
    
    def __init__(
        self,
        supabase_client: Client,
        openai_api_key: str,
        batch_size: int = 100,
        poll_interval_seconds: int = 60
    ):
        """
        Initialize Audit Embedding Service
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key for embeddings
            batch_size: Number of logs to process in each batch (default 100)
            poll_interval_seconds: Seconds to wait between polling (default 60)
        """
        self.supabase = supabase_client
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.batch_size = batch_size
        self.poll_interval = poll_interval_seconds
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002")
        self.embedding_dimension = 1536
        self.running = False
        
        logger.info(
            f"AuditEmbeddingService initialized with batch_size={batch_size}, "
            f"poll_interval={poll_interval_seconds}s, model={self.embedding_model}"
        )
    
    async def start(self):
        """Start the background embedding generation service"""
        self.running = True
        logger.info("Starting audit embedding service...")
        
        try:
            while self.running:
                await self.process_batch()
                await asyncio.sleep(self.poll_interval)
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
            self.stop()
        except Exception as e:
            logger.error(f"Fatal error in embedding service: {e}")
            raise
    
    def stop(self):
        """Stop the background embedding generation service"""
        self.running = False
        logger.info("Stopping audit embedding service...")
    
    async def process_batch(self):
        """
        Process a batch of audit logs without embeddings
        
        This method:
        1. Fetches logs without embeddings
        2. Generates embeddings for each log
        3. Updates the database with embeddings
        """
        try:
            # Get logs without embeddings
            logs = await self._get_logs_without_embeddings()
            
            if not logs:
                logger.debug("No logs without embeddings found")
                return
            
            logger.info(f"Processing {len(logs)} logs without embeddings")
            
            # Generate embeddings for all logs
            embeddings_data = []
            for log in logs:
                try:
                    # Build content text
                    content_text = self._build_content_text(log)
                    
                    # Generate embedding
                    embedding = await self._generate_embedding(content_text)
                    
                    embeddings_data.append({
                        "log_id": log["id"],
                        "embedding": embedding
                    })
                    
                except Exception as e:
                    logger.error(f"Failed to generate embedding for log {log['id']}: {e}")
                    continue
            
            # Batch update embeddings
            if embeddings_data:
                await self._batch_update_embeddings(embeddings_data)
                logger.info(f"Successfully updated {len(embeddings_data)} embeddings")
            
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
    
    async def _get_logs_without_embeddings(self) -> List[Dict[str, Any]]:
        """
        Fetch audit logs that don't have embeddings yet
        
        Returns:
            List of audit log dictionaries
        """
        try:
            # Query logs without embeddings, ordered by timestamp (oldest first)
            response = self.supabase.table("audit_logs").select(
                "id, event_type, user_id, entity_type, entity_id, action_details, "
                "severity, timestamp, category, risk_level, tags, tenant_id"
            ).is_(
                "embedding", "null"
            ).order(
                "timestamp", desc=False
            ).limit(
                self.batch_size
            ).execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to fetch logs without embeddings: {e}")
            return []
    
    def _build_content_text(self, log: Dict[str, Any]) -> str:
        """
        Build searchable content text from audit log
        
        Args:
            log: Audit log dictionary
            
        Returns:
            Formatted content text for embedding generation
        """
        import json
        
        # Extract key fields
        event_type = log.get("event_type", "unknown")
        user_id = log.get("user_id", "system")
        entity_type = log.get("entity_type", "unknown")
        entity_id = log.get("entity_id", "")
        severity = log.get("severity", "info")
        timestamp = log.get("timestamp", "")
        
        # Extract action details
        action_details = log.get("action_details", {})
        action_summary = json.dumps(action_details) if action_details else ""
        
        # Extract AI-generated fields
        category = log.get("category", "")
        risk_level = log.get("risk_level", "")
        tags = log.get("tags", {})
        tags_text = json.dumps(tags) if tags else ""
        
        # Build comprehensive content text
        content_parts = [
            f"Event Type: {event_type}",
            f"User: {user_id}",
            f"Entity: {entity_type} {entity_id}",
            f"Severity: {severity}",
            f"Timestamp: {timestamp}",
        ]
        
        if category:
            content_parts.append(f"Category: {category}")
        
        if risk_level:
            content_parts.append(f"Risk Level: {risk_level}")
        
        if action_summary:
            content_parts.append(f"Action Details: {action_summary}")
        
        if tags_text:
            content_parts.append(f"Tags: {tags_text}")
        
        return ". ".join(content_parts)
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using OpenAI
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception: If embedding generation fails
        """
        try:
            response = self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            
            embedding = response.data[0].embedding
            
            # Validate embedding dimension
            if len(embedding) != self.embedding_dimension:
                raise ValueError(
                    f"Expected embedding dimension {self.embedding_dimension}, got {len(embedding)}"
                )
            
            return embedding
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def _batch_update_embeddings(self, embeddings_data: List[Dict[str, Any]]):
        """
        Batch update embeddings in the database
        
        Args:
            embeddings_data: List of dicts with log_id and embedding
        """
        try:
            # Update each log with its embedding
            # Note: Supabase Python client doesn't support batch updates directly,
            # so we update one by one (could be optimized with RPC function)
            for data in embeddings_data:
                self.supabase.table("audit_logs").update({
                    "embedding": data["embedding"]
                }).eq(
                    "id", data["log_id"]
                ).execute()
            
            logger.debug(f"Batch updated {len(embeddings_data)} embeddings")
            
        except Exception as e:
            logger.error(f"Failed to batch update embeddings: {e}")
            raise
    
    async def generate_embedding_for_log(self, log_id: str) -> bool:
        """
        Generate embedding for a specific audit log (on-demand)
        
        Args:
            log_id: ID of the audit log
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Fetch the log
            response = self.supabase.table("audit_logs").select(
                "id, event_type, user_id, entity_type, entity_id, action_details, "
                "severity, timestamp, category, risk_level, tags, tenant_id"
            ).eq(
                "id", log_id
            ).execute()
            
            if not response.data:
                logger.error(f"Log {log_id} not found")
                return False
            
            log = response.data[0]
            
            # Build content text
            content_text = self._build_content_text(log)
            
            # Generate embedding
            embedding = await self._generate_embedding(content_text)
            
            # Update the log
            self.supabase.table("audit_logs").update({
                "embedding": embedding
            }).eq(
                "id", log_id
            ).execute()
            
            logger.info(f"Generated embedding for log {log_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate embedding for log {log_id}: {e}")
            return False
    
    async def get_embedding_stats(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get statistics about embedding coverage
        
        Args:
            tenant_id: Optional tenant ID to filter by
            
        Returns:
            Dictionary with embedding statistics
        """
        try:
            # Use the RPC function created in migration 028
            result = self.supabase.rpc(
                'get_audit_embedding_stats',
                {'p_tenant_id': tenant_id}
            ).execute()
            
            if result.data:
                stats = result.data[0] if isinstance(result.data, list) else result.data
                return stats
            
            return {
                "total_logs": 0,
                "logs_with_embeddings": 0,
                "logs_without_embeddings": 0,
                "embedding_coverage_percent": 0.0
            }
            
        except Exception as e:
            logger.error(f"Failed to get embedding stats: {e}")
            return {
                "error": str(e)
            }


def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    
    return create_client(supabase_url, supabase_key)


async def main():
    """Main entry point for running the service"""
    logger.info("=" * 80)
    logger.info("Audit Embedding Service")
    logger.info("=" * 80)
    
    try:
        # Get configuration from environment
        batch_size = int(os.getenv("EMBEDDING_BATCH_SIZE", "100"))
        poll_interval = int(os.getenv("EMBEDDING_POLL_INTERVAL", "60"))
        
        # Create clients
        supabase = get_supabase_client()
        openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if not openai_api_key:
            raise ValueError("Missing required environment variable: OPENAI_API_KEY")
        
        # Create and start service
        service = AuditEmbeddingService(
            supabase_client=supabase,
            openai_api_key=openai_api_key,
            batch_size=batch_size,
            poll_interval_seconds=poll_interval
        )
        
        # Get initial stats
        stats = await service.get_embedding_stats()
        logger.info("Initial embedding statistics:")
        logger.info(f"  Total logs: {stats.get('total_logs', 0)}")
        logger.info(f"  Logs with embeddings: {stats.get('logs_with_embeddings', 0)}")
        logger.info(f"  Logs without embeddings: {stats.get('logs_without_embeddings', 0)}")
        logger.info(f"  Coverage: {stats.get('embedding_coverage_percent', 0)}%")
        logger.info("")
        
        # Start the service
        await service.start()
        
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Service failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))

