"""
RAG Orchestrator Service for Knowledge Base
Coordinates all RAG components: cache → retrieve → generate → log
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
import asyncio
import uuid

from services.context_retriever import ContextRetriever, UserContext, ContextRetrieverError
from services.response_generator import ResponseGenerator, ResponseGeneratorError, SensitiveInformationFilter
from services.response_cache import ResponseCache, ResponseCacheError

logger = logging.getLogger(__name__)


@dataclass
class QueryLog:
    """Log entry for query processing"""
    query_id: str
    query: str
    user_id: str
    user_context: Dict[str, Any]
    language: str
    cache_hit: bool
    response_time_ms: int
    confidence: float
    citations_count: int
    sources_count: int
    error_message: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "query_id": self.query_id,
            "query": self.query,
            "user_id": self.user_id,
            "user_context": self.user_context,
            "language": self.language,
            "cache_hit": self.cache_hit,
            "response_time_ms": self.response_time_ms,
            "confidence": self.confidence,
            "citations_count": self.citations_count,
            "sources_count": self.sources_count,
            "error_message": self.error_message,
            "timestamp": self.timestamp.isoformat()
        }


class RAGOrchestratorError(Exception):
    """Base exception for RAG orchestrator errors"""
    pass


class ConversationManager:
    """Manages conversation history for multi-turn dialogues"""

    def __init__(self, max_history_length: int = 10):
        self.conversations: Dict[str, List[Dict[str, Any]]] = {}
        self.max_history_length = max_history_length

    def add_message(self, session_id: str, message: Dict[str, Any]):
        """Add a message to conversation history"""
        if session_id not in self.conversations:
            self.conversations[session_id] = []

        self.conversations[session_id].append(message)

        # Trim history if too long
        if len(self.conversations[session_id]) > self.max_history_length:
            self.conversations[session_id] = self.conversations[session_id][-self.max_history_length:]

    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a session"""
        return self.conversations.get(session_id, [])

    def clear_history(self, session_id: str):
        """Clear conversation history for a session"""
        self.conversations.pop(session_id, None)


class RAGOrchestrator:
    """
    Orchestrates the complete RAG pipeline.

    Features:
    - Cache-first query processing
    - Context retrieval and ranking
    - Response generation with citations
    - Conversation history management
    - Performance metrics tracking
    - Graceful error handling with fallbacks
    """

    def __init__(
        self,
        context_retriever: ContextRetriever,
        response_generator: ResponseGenerator,
        response_cache: ResponseCache,
        conversation_manager: Optional[ConversationManager] = None,
        enable_pii_anonymization: bool = True
    ):
        self.context_retriever = context_retriever
        self.response_generator = response_generator
        self.response_cache = response_cache
        self.conversation_manager = conversation_manager or ConversationManager()
        self.enable_pii_anonymization = enable_pii_anonymization
        self.pii_filter = SensitiveInformationFilter() if enable_pii_anonymization else None

        # Performance tracking
        self.query_count = 0
        self.cache_hit_count = 0
        self.error_count = 0
        self.total_response_time = 0

        # Usage metrics
        self.usage_metrics = {
            "total_tokens_processed": 0,
            "average_confidence": 0.0,
            "language_distribution": {},
            "error_types": {},
            "peak_hourly_queries": 0,
            "most_common_categories": {}
        }

    async def process_query(
        self,
        query: str,
        user_context: Dict[str, Any],
        language: str = "en",
        session_id: Optional[str] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Process a user query through the complete RAG pipeline.

        Args:
            query: User query string
            user_context: User context (role, current_page, etc.)
            language: Query language
            session_id: Conversation session ID
            use_cache: Whether to use response cache

        Returns:
            Response dictionary with content, sources, metadata
        """
        start_time = datetime.now()
        query_id = str(uuid.uuid4())
        session_id = session_id or f"session_{query_id}"

        try:
            logger.info(f"Processing query {query_id}: {query[:100]}...")

            # 1. Check cache first
            cache_hit = False
            cached_response = None

            if use_cache:
                cache_key = self.response_cache.generate_key(query, user_context, language)
                cached_response = await self.response_cache.get(cache_key)
                cache_hit = cached_response is not None

            if cache_hit:
                logger.debug(f"Cache hit for query {query_id}")
                response = cached_response
                response["cache_hit"] = True
            else:
                # 2. Retrieve context
                user_ctx = UserContext(
                    user_id=user_context.get("user_id", "anonymous"),
                    role=user_context.get("role", "user"),
                    current_page=user_context.get("current_page", ""),
                    current_project=user_context.get("current_project"),
                    current_portfolio=user_context.get("current_portfolio"),
                    user_preferences=user_context.get("preferences", {})
                )

                context_results = await self.context_retriever.retrieve(
                    query=query,
                    user_context=user_ctx,
                    language=language
                )

                # 3. Generate response
                response = await self.response_generator.generate_response(
                    query=query,
                    context_results=context_results,
                    user_context=user_context,
                    language=language
                )

                # 4. Cache the response (if not an error/fallback)
                if use_cache and not response.get("is_error", False) and not response.get("is_fallback", False):
                    await self.response_cache.set(cache_key, response)

                response["cache_hit"] = False

            # 5. Add conversation context if available
            if session_id:
                conversation_history = self.conversation_manager.get_history(session_id)
                response["conversation_context"] = len(conversation_history)

                # Add this query to conversation history
                conversation_entry = {
                    "query_id": query_id,
                    "query": query,
                    "response": response["response"],
                    "timestamp": datetime.now().isoformat(),
                    "cache_hit": cache_hit
                }
                self.conversation_manager.add_message(session_id, conversation_entry)

            # 6. Log the query
            await self._log_query(
                query_id=query_id,
                query=query,
                user_context=user_context,
                language=language,
                cache_hit=cache_hit,
                response=response,
                response_time_ms=int((datetime.now() - start_time).total_seconds() * 1000)
            )

            # 7. Update performance metrics
            self._update_metrics(cache_hit, response_time_ms=int((datetime.now() - start_time).total_seconds() * 1000))

            # 8. Add metadata
            response.update({
                "query_id": query_id,
                "session_id": session_id,
                "processed_at": datetime.now().isoformat(),
                "performance_metrics": self.get_performance_metrics()
            })

            logger.info(f"Successfully processed query {query_id}")
            return response

        except Exception as e:
            error_msg = f"Failed to process query: {str(e)}"
            logger.error(f"{error_msg} (query_id: {query_id})")

            # Log error
            await self._log_query(
                query_id=query_id,
                query=query,
                user_context=user_context,
                language=language,
                cache_hit=False,
                response={},
                response_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                error_message=str(e)
            )

            self.error_count += 1

            # Return graceful error response
            return self._create_error_response(query_id, session_id, error_msg)

    async def _log_query(
        self,
        query_id: str,
        query: str,
        user_context: Dict[str, Any],
        language: str,
        cache_hit: bool,
        response: Dict[str, Any],
        response_time_ms: int,
        error_message: Optional[str] = None
    ):
        """Log query processing details"""
        try:
            # Anonymize PII in query before logging
            logged_query = query
            if self.enable_pii_anonymization and self.pii_filter:
                logged_query = self.pii_filter.filter_response(query)

                if logged_query != query:
                    logger.debug("PII anonymized in query log")

            query_log = QueryLog(
                query_id=query_id,
                query=logged_query,
                user_id=user_context.get("user_id", "anonymous"),
                user_context=user_context,
                language=language,
                cache_hit=cache_hit,
                response_time_ms=response_time_ms,
                confidence=response.get("confidence", 0.0),
                citations_count=len(response.get("citations", [])),
                sources_count=len(response.get("sources", [])),
                error_message=error_message
            )

            # Update usage metrics
            self._update_usage_metrics(query_log, response)

            # In a real implementation, this would be stored in a database
            # For now, just log it
            logger.debug(f"Query log: {query_log.to_dict()}")

        except Exception as e:
            logger.error(f"Failed to log query: {str(e)}")

    def _update_metrics(self, cache_hit: bool, response_time_ms: int):
        """Update performance metrics"""
        self.query_count += 1
        self.total_response_time += response_time_ms
        if cache_hit:
            self.cache_hit_count += 1

    def _update_usage_metrics(self, query_log: QueryLog, response: Dict[str, Any]):
        """Update usage metrics"""
        try:
            # Track language distribution
            lang = query_log.language
            self.usage_metrics["language_distribution"][lang] = \
                self.usage_metrics["language_distribution"].get(lang, 0) + 1

            # Track confidence scores
            confidence = response.get("confidence", 0.0)
            total_queries = self.usage_metrics["language_distribution"].get(lang, 0)
            current_avg = self.usage_metrics.get("average_confidence", 0.0)
            self.usage_metrics["average_confidence"] = \
                (current_avg * (total_queries - 1) + confidence) / total_queries

            # Track error types
            if query_log.error_message:
                error_type = "unknown"
                if "timeout" in query_log.error_message.lower():
                    error_type = "timeout"
                elif "rate limit" in query_log.error_message.lower():
                    error_type = "rate_limit"
                elif "api" in query_log.error_message.lower():
                    error_type = "api_error"
                elif "network" in query_log.error_message.lower():
                    error_type = "network_error"

                self.usage_metrics["error_types"][error_type] = \
                    self.usage_metrics["error_types"].get(error_type, 0) + 1

            # Track most common categories from sources
            sources = response.get("sources", [])
            for source in sources:
                category = source.get("category", "unknown")
                self.usage_metrics["most_common_categories"][category] = \
                    self.usage_metrics["most_common_categories"].get(category, 0) + 1

        except Exception as e:
            logger.error(f"Failed to update usage metrics: {str(e)}")

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        avg_response_time = (
            self.total_response_time / self.query_count
            if self.query_count > 0 else 0
        )

        cache_hit_rate = (
            self.cache_hit_count / self.query_count
            if self.query_count > 0 else 0
        )

        return {
            "total_queries": self.query_count,
            "cache_hit_rate": cache_hit_rate,
            "average_response_time_ms": avg_response_time,
            "error_rate": self.error_count / self.query_count if self.query_count > 0 else 0
        }

    def get_usage_metrics(self) -> Dict[str, Any]:
        """Get comprehensive usage metrics"""
        return {
            "performance": self.get_performance_metrics(),
            "usage": self.usage_metrics,
            "timestamp": datetime.now().isoformat()
        }

    def _create_error_response(self, query_id: str, session_id: str, error_msg: str) -> Dict[str, Any]:
        """Create a graceful error response"""
        return {
            "query_id": query_id,
            "session_id": session_id,
            "response": "I'm experiencing technical difficulties. Please try again later or contact support if the problem persists.",
            "citations": [],
            "sources": [],
            "confidence": 0.0,
            "language": "en",
            "processed_at": datetime.now().isoformat(),
            "is_error": True,
            "error_message": error_msg,
            "cache_hit": False
        }

    async def clear_cache(self) -> None:
        """Clear the response cache"""
        await self.response_cache.clear()
        logger.info("Response cache cleared")

    async def invalidate_cache_for_user(self, user_id: str) -> int:
        """Invalidate cache entries for a specific user"""
        # This is a simplified implementation
        # In practice, you'd need to track cache keys by user
        pattern = f"user_{user_id}"
        return await self.response_cache.invalidate_by_pattern(pattern)

    def clear_conversation_history(self, session_id: str):
        """Clear conversation history for a session"""
        self.conversation_manager.clear_history(session_id)
        logger.info(f"Cleared conversation history for session: {session_id}")

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return await self.response_cache.get_stats()