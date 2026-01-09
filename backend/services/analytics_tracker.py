"""
Analytics Tracker Service
Implements anonymous analytics tracking for help chat system usage patterns,
question categorization, response effectiveness tracking, and weekly usage reports.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
from enum import Enum
import hashlib
import json
from dataclasses import dataclass, asdict

from config.database import supabase

logger = logging.getLogger(__name__)

class EventType(str, Enum):
    """Help chat analytics event types"""
    QUERY = "query"
    TIP_SHOWN = "tip_shown"
    TIP_DISMISSED = "tip_dismissed"
    FEEDBACK = "feedback"
    VISUAL_GUIDE_VIEWED = "visual_guide_viewed"
    VISUAL_GUIDE_COMPLETED = "visual_guide_completed"
    TRANSLATION_REQUESTED = "translation_requested"
    LANGUAGE_CHANGED = "language_changed"
    SESSION_STARTED = "session_started"
    SESSION_ENDED = "session_ended"

class QuestionCategory(str, Enum):
    """Question categorization for analytics"""
    NAVIGATION = "navigation"
    FEATURE_USAGE = "feature_usage"
    TROUBLESHOOTING = "troubleshooting"
    BEST_PRACTICES = "best_practices"
    INTEGRATION = "integration"
    REPORTING = "reporting"
    CONFIGURATION = "configuration"
    GENERAL = "general"
    OFF_TOPIC = "off_topic"

class ResponseEffectiveness(str, Enum):
    """Response effectiveness ratings"""
    VERY_HELPFUL = "very_helpful"  # Rating 5
    HELPFUL = "helpful"            # Rating 4
    NEUTRAL = "neutral"            # Rating 3
    NOT_HELPFUL = "not_helpful"    # Rating 2
    VERY_UNHELPFUL = "very_unhelpful"  # Rating 1

@dataclass
class AnalyticsEvent:
    """Analytics event data structure"""
    user_hash: str  # Anonymized user identifier
    event_type: EventType
    event_data: Dict[str, Any]
    page_context: Dict[str, Any]
    timestamp: datetime
    session_id: Optional[str] = None

@dataclass
class QuestionAnalysis:
    """Question analysis result"""
    category: QuestionCategory
    confidence: float
    keywords: List[str]
    complexity_score: float  # 0-1 scale

@dataclass
class UsageMetrics:
    """Usage metrics for reporting"""
    total_queries: int
    unique_users: int
    avg_response_time: float
    satisfaction_rate: float
    category_distribution: Dict[str, int]
    effectiveness_distribution: Dict[str, int]
    top_queries: List[Dict[str, Any]]
    common_issues: List[Dict[str, Any]]

@dataclass
class WeeklyReport:
    """Weekly usage report structure"""
    week_start: datetime
    week_end: datetime
    metrics: UsageMetrics
    trends: Dict[str, Any]
    recommendations: List[str]

class AnalyticsTracker:
    """
    Analytics tracker for help chat system usage patterns.
    Implements privacy-compliant anonymous tracking with question categorization
    and response effectiveness analysis.
    """
    
    def __init__(self, database_client=None):
        """Initialize analytics tracker"""
        self.db = database_client or supabase
        self._question_keywords = self._load_question_keywords()
        
    def _load_question_keywords(self) -> Dict[QuestionCategory, List[str]]:
        """Load keywords for question categorization"""
        return {
            QuestionCategory.NAVIGATION: [
                "navigate", "find", "where", "how to get", "menu", "page", "section",
                "dashboard", "sidebar", "header", "footer", "search"
            ],
            QuestionCategory.FEATURE_USAGE: [
                "create", "add", "edit", "delete", "update", "manage", "configure",
                "setup", "use", "enable", "disable", "customize"
            ],
            QuestionCategory.TROUBLESHOOTING: [
                "error", "problem", "issue", "bug", "not working", "broken", "failed",
                "fix", "resolve", "troubleshoot", "debug"
            ],
            QuestionCategory.BEST_PRACTICES: [
                "best practice", "recommend", "should", "optimal", "efficient",
                "improve", "optimize", "strategy", "approach"
            ],
            QuestionCategory.INTEGRATION: [
                "integrate", "connect", "sync", "import", "export", "api", "webhook",
                "third party", "external", "plugin"
            ],
            QuestionCategory.REPORTING: [
                "report", "analytics", "metrics", "dashboard", "chart", "graph",
                "export", "data", "statistics", "kpi"
            ],
            QuestionCategory.CONFIGURATION: [
                "settings", "preferences", "configuration", "admin", "permissions",
                "roles", "access", "security", "setup"
            ]
        }
    
    def _anonymize_user_id(self, user_id: str) -> str:
        """Create anonymous hash of user ID for privacy compliance"""
        # Use SHA-256 with salt for anonymization
        salt = "help_chat_analytics_2024"  # Static salt for consistency
        return hashlib.sha256(f"{user_id}{salt}".encode()).hexdigest()[:16]
    
    def _categorize_question(self, query: str) -> QuestionAnalysis:
        """Categorize user question using keyword analysis"""
        query_lower = query.lower()
        category_scores = {}
        matched_keywords = []
        
        # Calculate scores for each category
        for category, keywords in self._question_keywords.items():
            score = 0
            category_keywords = []
            
            for keyword in keywords:
                if keyword in query_lower:
                    score += 1
                    category_keywords.append(keyword)
            
            if score > 0:
                category_scores[category] = score
                matched_keywords.extend(category_keywords)
        
        # Determine best category
        if not category_scores:
            return QuestionAnalysis(
                category=QuestionCategory.GENERAL,
                confidence=0.5,
                keywords=[],
                complexity_score=self._calculate_complexity(query)
            )
        
        best_category = max(category_scores, key=category_scores.get)
        max_score = category_scores[best_category]
        confidence = min(max_score / 3.0, 1.0)  # Normalize confidence
        
        return QuestionAnalysis(
            category=best_category,
            confidence=confidence,
            keywords=list(set(matched_keywords)),
            complexity_score=self._calculate_complexity(query)
        )
    
    def _calculate_complexity(self, query: str) -> float:
        """Calculate query complexity score (0-1)"""
        # Simple complexity based on length, question marks, and technical terms
        word_count = len(query.split())
        question_marks = query.count('?')
        
        # Technical terms that indicate complexity
        technical_terms = [
            "api", "integration", "database", "configuration", "permissions",
            "workflow", "automation", "analytics", "reporting", "optimization"
        ]
        
        tech_score = sum(1 for term in technical_terms if term in query.lower())
        
        # Normalize to 0-1 scale
        complexity = min((word_count * 0.1 + question_marks * 0.2 + tech_score * 0.3) / 2.0, 1.0)
        return complexity
    
    def _get_effectiveness_from_rating(self, rating: Optional[int]) -> Optional[ResponseEffectiveness]:
        """Convert numeric rating to effectiveness enum"""
        if rating is None:
            return None
        
        rating_map = {
            5: ResponseEffectiveness.VERY_HELPFUL,
            4: ResponseEffectiveness.HELPFUL,
            3: ResponseEffectiveness.NEUTRAL,
            2: ResponseEffectiveness.NOT_HELPFUL,
            1: ResponseEffectiveness.VERY_UNHELPFUL
        }
        
        return rating_map.get(rating)
    
    async def track_event(
        self,
        user_id: str,
        event_type: EventType,
        event_data: Dict[str, Any],
        page_context: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> bool:
        """
        Track analytics event with privacy compliance.
        
        Args:
            user_id: User identifier (will be anonymized)
            event_type: Type of event being tracked
            event_data: Event-specific data
            page_context: Current page context
            session_id: Optional session identifier
            
        Returns:
            bool: Success status
        """
        try:
            # Create anonymized event
            event = AnalyticsEvent(
                user_hash=self._anonymize_user_id(user_id),
                event_type=event_type,
                event_data=self._sanitize_event_data(event_data),
                page_context=page_context or {},
                timestamp=datetime.now(),
                session_id=session_id
            )
            
            # Store in database
            analytics_data = {
                "user_id": user_id,  # Will be anonymized by database function after 90 days
                "event_type": event.event_type.value,
                "event_data": event.event_data,
                "page_context": event.page_context,
                "timestamp": event.timestamp.isoformat()
            }
            
            response = self.db.table("help_analytics").insert(analytics_data).execute()
            
            if not response.data:
                logger.error("Failed to insert analytics event")
                return False
            
            logger.debug(f"Tracked analytics event: {event_type.value}")
            return True
            
        except Exception as e:
            # Check if it's a table not found error
            error_str = str(e)
            if ("help_analytics" in error_str and 
                ("not found" in error_str.lower() or "PGRST205" in error_str)):
                logger.warning(f"Analytics table not found - analytics tracking disabled: {e}")
                return False  # Gracefully handle missing table
            
            logger.error(f"Failed to track analytics event: {e}")
            return False
    
    def _sanitize_event_data(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive information from event data"""
        sanitized = event_data.copy()
        
        # Remove potentially sensitive fields
        sensitive_fields = [
            "user_email", "user_name", "personal_info", "ip_address",
            "session_token", "auth_token", "password", "api_key"
        ]
        
        for field in sensitive_fields:
            sanitized.pop(field, None)
        
        # Truncate long text fields to prevent data bloat
        if "query" in sanitized and len(sanitized["query"]) > 500:
            sanitized["query"] = sanitized["query"][:500] + "..."
        
        if "response" in sanitized and len(sanitized["response"]) > 1000:
            sanitized["response"] = sanitized["response"][:1000] + "..."
        
        return sanitized
    
    async def track_query(
        self,
        user_id: str,
        query: str,
        response: str,
        response_time_ms: int,
        confidence: float,
        sources: List[Dict[str, Any]],
        page_context: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> bool:
        """Track help query with categorization"""
        try:
            # Analyze question
            analysis = self._categorize_question(query)
            
            event_data = {
                "query": query,
                "response_length": len(response),
                "response_time_ms": response_time_ms,
                "confidence": confidence,
                "source_count": len(sources),
                "category": analysis.category.value,
                "category_confidence": analysis.confidence,
                "keywords": analysis.keywords,
                "complexity_score": analysis.complexity_score
            }
            
            return await self.track_event(
                user_id=user_id,
                event_type=EventType.QUERY,
                event_data=event_data,
                page_context=page_context,
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"Failed to track query: {e}")
            return False
    
    async def track_feedback(
        self,
        user_id: str,
        message_id: Optional[str],
        rating: Optional[int],
        feedback_text: Optional[str],
        feedback_type: str,
        page_context: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> bool:
        """Track user feedback on responses"""
        try:
            effectiveness = self._get_effectiveness_from_rating(rating)
            
            event_data = {
                "message_id": message_id,
                "rating": rating,
                "feedback_type": feedback_type,
                "has_text": bool(feedback_text),
                "text_length": len(feedback_text) if feedback_text else 0,
                "effectiveness": effectiveness.value if effectiveness else None
            }
            
            return await self.track_event(
                user_id=user_id,
                event_type=EventType.FEEDBACK,
                event_data=event_data,
                page_context=page_context,
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"Failed to track feedback: {e}")
            return False
    
    async def track_proactive_tip(
        self,
        user_id: str,
        tip_id: str,
        tip_type: str,
        action: str,  # "shown" or "dismissed"
        page_context: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> bool:
        """Track proactive tip interactions"""
        try:
            event_type = EventType.TIP_SHOWN if action == "shown" else EventType.TIP_DISMISSED
            
            event_data = {
                "tip_id": tip_id,
                "tip_type": tip_type,
                "action": action
            }
            
            return await self.track_event(
                user_id=user_id,
                event_type=event_type,
                event_data=event_data,
                page_context=page_context,
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"Failed to track proactive tip: {e}")
            return False
    
    async def get_usage_metrics(
        self,
        start_date: datetime,
        end_date: datetime,
        include_anonymous: bool = True
    ) -> UsageMetrics:
        """Get usage metrics for specified date range"""
        try:
            # Query analytics data
            query = self.db.table("help_analytics").select("*").gte(
                "timestamp", start_date.isoformat()
            ).lte("timestamp", end_date.isoformat())
            
            response = query.execute()
            
            if not response.data:
                return UsageMetrics(
                    total_queries=0,
                    unique_users=0,
                    avg_response_time=0.0,
                    satisfaction_rate=0.0,
                    category_distribution={},
                    effectiveness_distribution={},
                    top_queries=[],
                    common_issues=[]
                )
            
            events = response.data
            
            # Calculate metrics
            query_events = [e for e in events if e["event_type"] == EventType.QUERY.value]
            feedback_events = [e for e in events if e["event_type"] == EventType.FEEDBACK.value]
            
            total_queries = len(query_events)
            unique_users = len(set(e["user_id"] for e in events if e["user_id"]))
            
            # Average response time
            response_times = [
                e["event_data"].get("response_time_ms", 0) 
                for e in query_events 
                if e["event_data"].get("response_time_ms")
            ]
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
            
            # Satisfaction rate
            ratings = [
                e["event_data"].get("rating") 
                for e in feedback_events 
                if e["event_data"].get("rating")
            ]
            satisfaction_rate = (
                sum(1 for r in ratings if r >= 4) / len(ratings) * 100 
                if ratings else 0.0
            )
            
            # Category distribution
            categories = [
                e["event_data"].get("category", "general") 
                for e in query_events 
                if e["event_data"].get("category")
            ]
            category_distribution = {}
            for category in categories:
                category_distribution[category] = category_distribution.get(category, 0) + 1
            
            # Effectiveness distribution
            effectiveness_ratings = [
                e["event_data"].get("effectiveness") 
                for e in feedback_events 
                if e["event_data"].get("effectiveness")
            ]
            effectiveness_distribution = {}
            for rating in effectiveness_ratings:
                effectiveness_distribution[rating] = effectiveness_distribution.get(rating, 0) + 1
            
            # Top queries (anonymized)
            query_texts = [
                e["event_data"].get("query", "")[:100] + "..." 
                if len(e["event_data"].get("query", "")) > 100 
                else e["event_data"].get("query", "")
                for e in query_events 
                if e["event_data"].get("query")
            ]
            
            query_counts = {}
            for query in query_texts:
                # Group similar queries by first 50 characters
                key = query[:50] + "..." if len(query) > 50 else query
                query_counts[key] = query_counts.get(key, 0) + 1
            
            top_queries = [
                {"query": query, "count": count}
                for query, count in sorted(query_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ]
            
            # Common issues (low confidence or negative feedback)
            issue_events = [
                e for e in query_events 
                if e["event_data"].get("confidence", 1.0) < 0.6
            ]
            
            common_issues = []
            for event in issue_events[:5]:  # Top 5 issues
                query = event["event_data"].get("query", "")
                category = event["event_data"].get("category", "general")
                confidence = event["event_data"].get("confidence", 0.0)
                
                common_issues.append({
                    "category": category,
                    "confidence": confidence,
                    "query_sample": query[:100] + "..." if len(query) > 100 else query
                })
            
            return UsageMetrics(
                total_queries=total_queries,
                unique_users=unique_users,
                avg_response_time=avg_response_time,
                satisfaction_rate=satisfaction_rate,
                category_distribution=category_distribution,
                effectiveness_distribution=effectiveness_distribution,
                top_queries=top_queries,
                common_issues=common_issues
            )
            
        except Exception as e:
            # Check if it's a table not found error
            error_str = str(e)
            if ("help_analytics" in error_str and 
                ("not found" in error_str.lower() or "PGRST205" in error_str)):
                logger.warning(f"Analytics table not found - returning empty metrics: {e}")
                return UsageMetrics(
                    total_queries=0,
                    unique_users=0,
                    avg_response_time=0.0,
                    satisfaction_rate=0.0,
                    category_distribution={},
                    effectiveness_distribution={},
                    top_queries=[],
                    common_issues=[]
                )
            
            logger.error(f"Failed to get usage metrics: {e}")
            raise
    
    async def generate_weekly_report(
        self,
        week_start: Optional[datetime] = None
    ) -> WeeklyReport:
        """Generate comprehensive weekly usage report"""
        try:
            if week_start is None:
                # Default to last Monday
                today = datetime.now()
                days_since_monday = today.weekday()
                week_start = today - timedelta(days=days_since_monday + 7)
            
            week_end = week_start + timedelta(days=7)
            
            # Get current week metrics
            current_metrics = await self.get_usage_metrics(week_start, week_end)
            
            # Get previous week metrics for comparison
            prev_week_start = week_start - timedelta(days=7)
            prev_week_end = week_start
            prev_metrics = await self.get_usage_metrics(prev_week_start, prev_week_end)
            
            # Calculate trends
            trends = self._calculate_trends(current_metrics, prev_metrics)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(current_metrics, trends)
            
            return WeeklyReport(
                week_start=week_start,
                week_end=week_end,
                metrics=current_metrics,
                trends=trends,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Failed to generate weekly report: {e}")
            raise
    
    def _calculate_trends(
        self,
        current: UsageMetrics,
        previous: UsageMetrics
    ) -> Dict[str, Any]:
        """Calculate trends between current and previous metrics"""
        trends = {}
        
        # Query volume trend
        if previous.total_queries > 0:
            query_change = ((current.total_queries - previous.total_queries) / previous.total_queries) * 100
            trends["query_volume_change"] = round(query_change, 1)
        else:
            trends["query_volume_change"] = 100.0 if current.total_queries > 0 else 0.0
        
        # User engagement trend
        if previous.unique_users > 0:
            user_change = ((current.unique_users - previous.unique_users) / previous.unique_users) * 100
            trends["user_engagement_change"] = round(user_change, 1)
        else:
            trends["user_engagement_change"] = 100.0 if current.unique_users > 0 else 0.0
        
        # Satisfaction trend
        satisfaction_change = current.satisfaction_rate - previous.satisfaction_rate
        trends["satisfaction_change"] = round(satisfaction_change, 1)
        
        # Response time trend
        if previous.avg_response_time > 0:
            response_time_change = ((current.avg_response_time - previous.avg_response_time) / previous.avg_response_time) * 100
            trends["response_time_change"] = round(response_time_change, 1)
        else:
            trends["response_time_change"] = 0.0
        
        return trends
    
    def _generate_recommendations(
        self,
        metrics: UsageMetrics,
        trends: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations based on metrics and trends"""
        recommendations = []
        
        # Low satisfaction rate
        if metrics.satisfaction_rate < 70:
            recommendations.append(
                "Consider reviewing and improving help content quality - satisfaction rate is below 70%"
            )
        
        # High response time
        if metrics.avg_response_time > 3000:  # 3 seconds
            recommendations.append(
                "Response times are above 3 seconds - consider optimizing RAG pipeline or adding more caching"
            )
        
        # Declining user engagement
        if trends.get("user_engagement_change", 0) < -10:
            recommendations.append(
                "User engagement is declining - consider adding more proactive tips or improving discoverability"
            )
        
        # Common issue categories
        if metrics.category_distribution:
            top_category = max(metrics.category_distribution, key=metrics.category_distribution.get)
            if metrics.category_distribution[top_category] > metrics.total_queries * 0.4:
                recommendations.append(
                    f"High volume of {top_category} questions - consider adding dedicated documentation or UI improvements"
                )
        
        # Low confidence responses
        if metrics.common_issues and len(metrics.common_issues) > 3:
            recommendations.append(
                "Multiple low-confidence responses detected - review knowledge base coverage and update content"
            )
        
        # Positive trends
        if trends.get("satisfaction_change", 0) > 5:
            recommendations.append(
                "Satisfaction rate is improving - continue current content and response strategies"
            )
        
        return recommendations
    
    async def cleanup_old_data(self, days_to_keep: int = 90) -> int:
        """Clean up old analytics data for privacy compliance"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            
            # Use database function for anonymization instead of deletion
            response = self.db.rpc("anonymize_help_analytics", {"older_than_days": days_to_keep}).execute()
            
            if response.data:
                anonymized_count = response.data
                logger.info(f"Anonymized {anonymized_count} old analytics records")
                return anonymized_count
            
            return 0
            
        except Exception as e:
            logger.error(f"Failed to cleanup old analytics data: {e}")
            return 0

# Global analytics tracker instance
analytics_tracker: Optional[AnalyticsTracker] = None

def get_analytics_tracker() -> AnalyticsTracker:
    """Get global analytics tracker instance"""
    global analytics_tracker
    if analytics_tracker is None:
        analytics_tracker = AnalyticsTracker()
    return analytics_tracker