"""
Context Retriever Service for RAG Knowledge Base
Retrieves and ranks relevant context chunks for user queries
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
import asyncio

from services.translation_service import TranslationService
from services.vector_store import VectorStore, SearchResult, VectorStoreError
from services.embedding_service import EmbeddingService, EmbeddingServiceError

logger = logging.getLogger(__name__)


@dataclass
class UserContext:
    """User context for query processing"""
    user_id: str
    role: str
    current_page: str
    current_project: Optional[str] = None
    current_portfolio: Optional[str] = None
    user_preferences: Dict[str, Any] = None

    def __post_init__(self):
        if self.user_preferences is None:
            self.user_preferences = {}


@dataclass
class ContextualResult:
    """Search result with contextual scoring"""
    search_result: SearchResult
    contextual_score: float
    role_relevance: float
    page_relevance: float
    recency_score: float

    @property
    def total_score(self) -> float:
        """Calculate total weighted score"""
        return (
            self.search_result.similarity_score * 0.4 +
            self.contextual_score * 0.3 +
            self.role_relevance * 0.2 +
            self.recency_score * 0.1
        )


class ContextRetrieverError(Exception):
    """Base exception for context retriever errors"""
    pass


class ContextRetriever:
    """
    Service for retrieving and ranking relevant context for user queries.

    Features:
    - Multi-language query processing with translation
    - Role-based access control filtering
    - Contextual boosting based on user location
    - Metadata filtering for category-specific searches
    - Result re-ranking with multiple signals
    """

    def __init__(
        self,
        vector_store: VectorStore,
        embedding_service: EmbeddingService,
        translation_service: TranslationService,
        max_results: int = 10,
        similarity_threshold: float = 0.1
    ):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.translation_service = translation_service
        self.max_results = max_results
        self.similarity_threshold = similarity_threshold

    async def retrieve(
        self,
        query: str,
        user_context: UserContext,
        language: str = "en"
    ) -> List[ContextualResult]:
        """
        Retrieve relevant context for a query.

        Args:
            query: User query string
            user_context: User context information
            language: Query language code

        Returns:
            List of contextual search results
        """
        try:
            logger.debug(f"Retrieving context for query: {query[:100]}...")

            # Translate query if needed
            translated_query = await self._translate_query(query, language)

            # Generate embedding
            query_embedding = await self.embedding_service.embed_text(translated_query)

            # Perform similarity search
            search_results = await self.vector_store.similarity_search(
                query_embedding=query_embedding,
                limit=self.max_results * 2,  # Get more for re-ranking
                threshold=self.similarity_threshold
            )

            # Apply contextual filtering and ranking
            contextual_results = []
            for result in search_results:
                contextual_result = await self._apply_contextual_scoring(
                    result, translated_query, user_context
                )
                contextual_results.append(contextual_result)

            # Sort by total score and filter
            contextual_results.sort(key=lambda x: x.total_score, reverse=True)
            filtered_results = [
                r for r in contextual_results
                if r.total_score > self.similarity_threshold
            ][:self.max_results]

            logger.debug(f"Retrieved {len(filtered_results)} contextual results")
            return filtered_results

        except Exception as e:
            logger.error(f"Error retrieving context: {str(e)}")
            raise ContextRetrieverError(f"Failed to retrieve context: {str(e)}") from e

    async def _translate_query(self, query: str, language: str) -> str:
        """Translate query to English if needed"""
        if language == "en":
            return query

        try:
            return await self.translation_service.translate_to_english(query, language)
        except Exception as e:
            logger.warning(f"Translation failed for query: {e}, using original: {query}")
            return query

    async def _apply_contextual_scoring(
        self,
        search_result: SearchResult,
        query: str,
        user_context: UserContext
    ) -> ContextualResult:
        """Apply contextual scoring to search result"""
        # Base scores
        role_relevance = self._calculate_role_relevance(
            search_result.metadata, user_context.role
        )
        page_relevance = self._calculate_page_relevance(
            search_result.metadata, user_context.current_page
        )
        recency_score = self._calculate_recency_score(search_result.metadata)

        # Contextual boost based on user location and query
        contextual_score = self._apply_contextual_boost(
            search_result, query, user_context
        )

        return ContextualResult(
            search_result=search_result,
            contextual_score=contextual_score,
            role_relevance=role_relevance,
            page_relevance=page_relevance,
            recency_score=recency_score
        )

    def _calculate_role_relevance(self, metadata: Dict[str, Any], user_role: str) -> float:
        """Calculate relevance based on user role"""
        access_control = metadata.get("access_control", {})
        allowed_roles = access_control.get("roles", [])

        if not allowed_roles:
            return 1.0  # No restrictions

        if user_role in allowed_roles:
            return 1.0

        # Partial relevance for related roles
        role_hierarchy = {
            "admin": ["admin", "manager", "user"],
            "manager": ["manager", "user"],
            "user": ["user"]
        }

        user_role_hierarchy = role_hierarchy.get(user_role, [user_role])
        for role in user_role_hierarchy:
            if role in allowed_roles:
                return 0.8

        return 0.0  # No access

    def _calculate_page_relevance(self, metadata: Dict[str, Any], current_page: str) -> float:
        """Calculate relevance based on current page context"""
        page_keywords = self._extract_page_keywords(current_page)
        content_keywords = set(metadata.get("keywords", []))

        if not page_keywords or not content_keywords:
            return 0.5  # Neutral score

        overlap = len(page_keywords.intersection(content_keywords))
        return min(1.0, overlap / len(page_keywords))

    def _calculate_recency_score(self, metadata: Dict[str, Any]) -> float:
        """Calculate recency score based on document age"""
        created_at_str = metadata.get("created_at")
        if not created_at_str:
            return 0.5  # Neutral score

        try:
            created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            days_old = (datetime.now() - created_at).days

            # Exponential decay: newer documents get higher scores
            if days_old <= 1:
                return 1.0
            elif days_old <= 7:
                return 0.9
            elif days_old <= 30:
                return 0.7
            elif days_old <= 90:
                return 0.5
            else:
                return 0.3
        except (ValueError, TypeError):
            return 0.5

    def _apply_contextual_boost(
        self,
        search_result: SearchResult,
        query: str,
        user_context: UserContext
    ) -> float:
        """Apply contextual boosting based on user context"""
        boost_score = 0.5  # Base score

        # Boost based on category relevance
        category = search_result.metadata.get("category", "")
        if self._is_category_relevant(category, user_context.current_page):
            boost_score += 0.2

        # Boost based on project/portfolio context
        if user_context.current_project:
            project_keywords = [user_context.current_project.lower()]
            content_lower = search_result.content.lower()
            if any(kw in content_lower for kw in project_keywords):
                boost_score += 0.1

        if user_context.current_portfolio:
            portfolio_keywords = [user_context.current_portfolio.lower()]
            content_lower = search_result.content.lower()
            if any(kw in content_lower for kw in portfolio_keywords):
                boost_score += 0.1

        # Boost based on user preferences
        preferences = user_context.user_preferences
        preferred_categories = preferences.get("preferred_categories", [])
        if category in preferred_categories:
            boost_score += 0.1

        return min(1.0, boost_score)

    def _extract_page_keywords(self, page_path: str) -> set:
        """Extract keywords from page path"""
        # Simple keyword extraction from URL/path
        keywords = set()

        # Extract from path segments
        segments = page_path.strip('/').split('/')
        for segment in segments:
            # Convert kebab-case and camelCase to words
            words = segment.replace('-', ' ').replace('_', ' ').split()
            keywords.update(word.lower() for word in words if len(word) > 2)

        return keywords

    def _is_category_relevant(self, category: str, page_path: str) -> bool:
        """Check if category is relevant to current page"""
        page_keywords = self._extract_page_keywords(page_path)

        category_keywords = {
            "dashboard": {"dashboard", "overview", "summary"},
            "projects": {"project", "projects", "task", "tasks"},
            "resources": {"resource", "resources", "allocation"},
            "financial": {"budget", "cost", "financial", "finance"},
            "risks": {"risk", "risks", "mitigation"},
            "reports": {"report", "reports", "analytics"},
            "settings": {"setting", "settings", "configuration"}
        }

        relevant_keywords = category_keywords.get(category.lower(), set())
        return bool(page_keywords.intersection(relevant_keywords))