"""
Audit RAG Agent Service
Specialized RAG agent for semantic search and AI-powered analysis of audit logs
Extends the existing RAGReporterAgent infrastructure
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from openai import OpenAI
from supabase import Client
import redis.asyncio as aioredis

# Import base agent class
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_agents import AIAgentBase

logger = logging.getLogger(__name__)


class AuditRAGAgent(AIAgentBase):
    """
    RAG agent specialized for audit log semantic search and analysis.
    Extends existing RAGReporterAgent infrastructure with audit-specific functionality.
    """
    
    def __init__(self, supabase_client: Client, openai_api_key: str, redis_client: Optional[aioredis.Redis] = None):
        """
        Initialize Audit RAG Agent
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key for embeddings and chat
            redis_client: Optional Redis client for caching
        """
        super().__init__(supabase_client, openai_api_key)
        self.redis = redis_client
        self.embedding_model = "text-embedding-ada-002"
        self.chat_model = "gpt-4"
        self.embedding_dimension = 1536  # OpenAI ada-002 dimension
        self.cache_ttl = 600  # 10 minutes for search results
        
        logger.info("AuditRAGAgent initialized with embedding model: %s, chat model: %s", 
                   self.embedding_model, self.chat_model)
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using OpenAI ada-002
        
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
                raise ValueError(f"Expected embedding dimension {self.embedding_dimension}, got {len(embedding)}")
            
            logger.debug("Generated embedding for text of length %d", len(text))
            return embedding
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def index_audit_event(self, event: Dict[str, Any]) -> bool:
        """
        Generate and store embedding for audit event with tenant isolation
        
        Args:
            event: Audit event dictionary containing event data
            
        Returns:
            True if successful, False otherwise
            
        Requirements: 3.1, 3.10, 9.4
        """
        try:
            # Extract event data
            event_id = event.get("id")
            if not event_id:
                raise ValueError("Event ID is required")
            
            tenant_id = event.get("tenant_id")
            if not tenant_id:
                raise ValueError("Tenant ID is required for tenant isolation")
            
            # Build content text for embedding
            content_text = self._build_event_content_text(event)
            
            # Generate embedding
            embedding = await self.generate_embedding(content_text)
            
            # Store embedding in audit_embeddings table with tenant isolation
            self.supabase.table("audit_embeddings").upsert({
                "audit_event_id": event_id,
                "embedding": embedding,
                "content_text": content_text,
                "tenant_id": tenant_id,
                "created_at": datetime.now().isoformat()
            }, on_conflict="audit_event_id").execute()
            
            logger.info(f"Indexed audit event {event_id} for tenant {tenant_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index audit event: {e}")
            return False
    
    def _build_event_content_text(self, event: Dict[str, Any]) -> str:
        """
        Build searchable content text from audit event
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Formatted content text for embedding generation
        """
        # Extract key fields
        event_type = event.get("event_type", "unknown")
        user_id = event.get("user_id", "system")
        entity_type = event.get("entity_type", "unknown")
        entity_id = event.get("entity_id", "")
        severity = event.get("severity", "info")
        timestamp = event.get("timestamp", "")
        
        # Extract action details
        action_details = event.get("action_details", {})
        action_summary = json.dumps(action_details) if action_details else ""
        
        # Extract AI-generated fields
        category = event.get("category", "")
        risk_level = event.get("risk_level", "")
        tags = event.get("tags", {})
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
    
    async def semantic_search(
        self, 
        query: str, 
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
        tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search over audit logs using pgvector cosine similarity
        
        Args:
            query: Natural language search query
            filters: Optional filters (date range, event types, etc.)
            limit: Maximum number of results to return (default: 10)
            tenant_id: Tenant ID for isolation (required)
            
        Returns:
            List of matching audit events with similarity scores
            
        Requirements: 3.2, 3.3
        """
        try:
            if not tenant_id:
                raise ValueError("Tenant ID is required for semantic search")
            
            # Check cache first
            cache_key = self._build_cache_key("search", query, filters, tenant_id)
            if self.redis:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.debug(f"Cache hit for search query: {query}")
                    return cached_result
            
            # Generate query embedding
            query_embedding = await self.generate_embedding(query)
            
            # Build SQL query with pgvector cosine similarity
            # Use <=> operator for cosine distance (lower is more similar)
            # Convert to similarity score: 1 - distance
            sql_query = """
                SELECT 
                    ae.audit_event_id,
                    ae.content_text,
                    ae.tenant_id,
                    (1 - (ae.embedding <=> %s::vector)) as similarity_score,
                    al.event_type,
                    al.user_id,
                    al.entity_type,
                    al.entity_id,
                    al.action_details,
                    al.severity,
                    al.timestamp,
                    al.category,
                    al.risk_level,
                    al.tags,
                    al.ai_insights,
                    al.anomaly_score,
                    al.is_anomaly
                FROM audit_embeddings ae
                JOIN roche_audit_logs al ON ae.audit_event_id = al.id
                WHERE ae.tenant_id = %s
            """
            
            params = [json.dumps(query_embedding), tenant_id]
            
            # Apply additional filters
            if filters:
                if filters.get("start_date"):
                    sql_query += " AND al.timestamp >= %s"
                    params.append(filters["start_date"])
                
                if filters.get("end_date"):
                    sql_query += " AND al.timestamp <= %s"
                    params.append(filters["end_date"])
                
                if filters.get("event_types"):
                    placeholders = ",".join(["%s"] * len(filters["event_types"]))
                    sql_query += f" AND al.event_type IN ({placeholders})"
                    params.extend(filters["event_types"])
                
                if filters.get("severity"):
                    sql_query += " AND al.severity = %s"
                    params.append(filters["severity"])
                
                if filters.get("categories"):
                    placeholders = ",".join(["%s"] * len(filters["categories"]))
                    sql_query += f" AND al.category IN ({placeholders})"
                    params.extend(filters["categories"])
            
            # Order by similarity and limit results
            sql_query += " ORDER BY ae.embedding <=> %s::vector LIMIT %s"
            params.extend([json.dumps(query_embedding), limit])
            
            # Execute query using Supabase RPC or direct SQL
            # Note: This is a simplified version - actual implementation may need RPC function
            results = await self._execute_vector_search(sql_query, params)
            
            # Cache results
            if self.redis and results:
                await self._cache_result(cache_key, results, self.cache_ttl)
            
            logger.info(f"Semantic search returned {len(results)} results for query: {query}")
            return results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    async def _execute_vector_search(self, sql_query: str, params: List[Any]) -> List[Dict[str, Any]]:
        """
        Execute vector similarity search query
        
        This is a placeholder for the actual implementation which would use
        Supabase RPC or direct PostgreSQL connection
        """
        # TODO: Implement actual vector search execution
        # For now, return empty list as fallback
        logger.warning("Vector search execution not fully implemented - using fallback")
        return []
    
    async def generate_summary(
        self, 
        time_period: str,
        filters: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate AI summary of audit events for specified time period
        
        Args:
            time_period: 'daily', 'weekly', or 'monthly'
            filters: Optional additional filters
            tenant_id: Tenant ID for isolation (required)
            
        Returns:
            Dictionary containing summary text and statistics
            
        Requirements: 3.6, 3.7, 3.8, 3.9
        """
        try:
            if not tenant_id:
                raise ValueError("Tenant ID is required for summary generation")
            
            # Calculate time window
            end_time = datetime.now()
            if time_period == "daily":
                start_time = end_time - timedelta(days=1)
            elif time_period == "weekly":
                start_time = end_time - timedelta(days=7)
            elif time_period == "monthly":
                start_time = end_time - timedelta(days=30)
            else:
                raise ValueError(f"Invalid time period: {time_period}")
            
            # Fetch events in time window
            events = await self._fetch_events_in_timewindow(
                start_time, end_time, tenant_id, filters
            )
            
            # Calculate statistics
            stats = self._calculate_event_statistics(events)
            
            # Generate AI summary using GPT-4
            ai_summary = await self._generate_ai_summary(events, time_period, stats)
            
            return {
                "period": time_period,
                "start_date": start_time.isoformat(),
                "end_date": end_time.isoformat(),
                "total_events": stats["total_events"],
                "critical_changes": stats["critical_changes"],
                "budget_updates": stats["budget_updates"],
                "security_events": stats["security_events"],
                "anomalies_detected": stats["anomalies_detected"],
                "top_users": stats["top_users"],
                "top_event_types": stats["top_event_types"],
                "category_breakdown": stats["category_breakdown"],
                "ai_insights": ai_summary,
                "trend_analysis": stats.get("trend_analysis", {})
            }
            
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            raise
    
    async def _fetch_events_in_timewindow(
        self,
        start_time: datetime,
        end_time: datetime,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch audit events within time window"""
        try:
            query = self.supabase.table("roche_audit_logs").select("*").eq(
                "tenant_id", tenant_id
            ).gte("timestamp", start_time.isoformat()).lte(
                "timestamp", end_time.isoformat()
            )
            
            # Apply additional filters
            if filters:
                if filters.get("event_types"):
                    query = query.in_("event_type", filters["event_types"])
                if filters.get("severity"):
                    query = query.eq("severity", filters["severity"])
            
            response = query.execute()
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to fetch events: {e}")
            return []
    
    def _calculate_event_statistics(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics from events"""
        stats = {
            "total_events": len(events),
            "critical_changes": 0,
            "budget_updates": 0,
            "security_events": 0,
            "anomalies_detected": 0,
            "top_users": {},
            "top_event_types": {},
            "category_breakdown": {}
        }
        
        for event in events:
            # Count critical changes
            if event.get("severity") == "critical":
                stats["critical_changes"] += 1
            
            # Count budget updates
            if "budget" in event.get("event_type", "").lower():
                stats["budget_updates"] += 1
            
            # Count security events
            if event.get("category") == "Security Change":
                stats["security_events"] += 1
            
            # Count anomalies
            if event.get("is_anomaly"):
                stats["anomalies_detected"] += 1
            
            # Track top users
            user_id = event.get("user_id")
            if user_id:
                stats["top_users"][user_id] = stats["top_users"].get(user_id, 0) + 1
            
            # Track top event types
            event_type = event.get("event_type")
            if event_type:
                stats["top_event_types"][event_type] = stats["top_event_types"].get(event_type, 0) + 1
            
            # Track category breakdown
            category = event.get("category")
            if category:
                stats["category_breakdown"][category] = stats["category_breakdown"].get(category, 0) + 1
        
        # Convert to sorted lists
        stats["top_users"] = sorted(
            [{"user_id": k, "count": v} for k, v in stats["top_users"].items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]
        
        stats["top_event_types"] = sorted(
            [{"event_type": k, "count": v} for k, v in stats["top_event_types"].items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]
        
        return stats
    
    async def _generate_ai_summary(
        self,
        events: List[Dict[str, Any]],
        time_period: str,
        stats: Dict[str, Any]
    ) -> str:
        """Generate AI-powered summary using GPT-4"""
        try:
            # Build prompt for GPT-4
            system_prompt = """You are an AI assistant specialized in analyzing audit logs for a Project Portfolio Management platform.
Generate a concise executive summary of audit activity highlighting key trends, anomalies, and important events."""
            
            user_prompt = f"""Analyze the following audit log statistics for the past {time_period}:

Total Events: {stats['total_events']}
Critical Changes: {stats['critical_changes']}
Budget Updates: {stats['budget_updates']}
Security Events: {stats['security_events']}
Anomalies Detected: {stats['anomalies_detected']}

Top Event Types:
{self._format_top_items(stats['top_event_types'])}

Category Breakdown:
{self._format_category_breakdown(stats['category_breakdown'])}

Provide a 3-4 sentence executive summary highlighting the most important insights and any concerning trends."""
            
            response = self.openai_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=300
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"AI summary generation failed: {e}")
            return "Summary generation failed. Please review the statistics above."
    
    def _format_top_items(self, items: List[Dict[str, Any]]) -> str:
        """Format top items for prompt"""
        return "\n".join([f"- {item.get('event_type', 'unknown')}: {item.get('count', 0)}" for item in items[:5]])
    
    def _format_category_breakdown(self, breakdown: Dict[str, int]) -> str:
        """Format category breakdown for prompt"""
        return "\n".join([f"- {category}: {count}" for category, count in breakdown.items()])
    
    async def explain_event(self, event_id: str, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate natural language explanation of specific audit event
        
        Args:
            event_id: ID of the audit event to explain
            tenant_id: Tenant ID for isolation (required)
            
        Returns:
            Dictionary containing explanation with context and impact analysis
            
        Requirements: 3.4
        """
        try:
            if not tenant_id:
                raise ValueError("Tenant ID is required for event explanation")
            
            # Fetch event
            response = self.supabase.table("roche_audit_logs").select("*").eq(
                "id", event_id
            ).eq("tenant_id", tenant_id).execute()
            
            if not response.data:
                raise ValueError(f"Event {event_id} not found for tenant {tenant_id}")
            
            event = response.data[0]
            
            # Generate explanation using GPT-4
            explanation = await self._generate_event_explanation(event)
            
            return {
                "event_id": event_id,
                "event_type": event.get("event_type"),
                "timestamp": event.get("timestamp"),
                "explanation": explanation,
                "context": {
                    "severity": event.get("severity"),
                    "category": event.get("category"),
                    "risk_level": event.get("risk_level"),
                    "is_anomaly": event.get("is_anomaly"),
                    "anomaly_score": event.get("anomaly_score")
                },
                "impact_analysis": self._analyze_event_impact(event)
            }
            
        except Exception as e:
            logger.error(f"Event explanation failed: {e}")
            raise
    
    async def _generate_event_explanation(self, event: Dict[str, Any]) -> str:
        """Generate natural language explanation for event"""
        try:
            system_prompt = """You are an AI assistant that explains audit log events in clear, non-technical language.
Explain what happened, why it matters, and what the implications are."""
            
            user_prompt = f"""Explain this audit event:

Event Type: {event.get('event_type')}
User: {event.get('user_id', 'System')}
Entity: {event.get('entity_type')} {event.get('entity_id', '')}
Severity: {event.get('severity')}
Category: {event.get('category', 'Unknown')}
Risk Level: {event.get('risk_level', 'Unknown')}
Action Details: {json.dumps(event.get('action_details', {}), indent=2)}

Provide a clear 2-3 sentence explanation of what this event means and why it's important."""
            
            response = self.openai_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Event explanation generation failed: {e}")
            return "Unable to generate explanation for this event."
    
    def _analyze_event_impact(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze potential impact of event"""
        impact = {
            "severity_level": event.get("severity", "info"),
            "risk_assessment": event.get("risk_level", "Low"),
            "affected_entities": [],
            "recommended_actions": []
        }
        
        # Determine affected entities
        entity_type = event.get("entity_type")
        entity_id = event.get("entity_id")
        if entity_type and entity_id:
            impact["affected_entities"].append({
                "type": entity_type,
                "id": entity_id
            })
        
        # Generate recommended actions based on severity and category
        if event.get("is_anomaly"):
            impact["recommended_actions"].append("Review this anomaly for potential security concerns")
        
        if event.get("severity") == "critical":
            impact["recommended_actions"].append("Immediate investigation required")
        
        if event.get("category") == "Security Change":
            impact["recommended_actions"].append("Verify authorization for this security change")
        
        return impact
    
    def _build_cache_key(self, operation: str, *args) -> str:
        """Build cache key for Redis"""
        key_parts = [f"audit_rag:{operation}"]
        for arg in args:
            if isinstance(arg, dict):
                key_parts.append(json.dumps(arg, sort_keys=True))
            else:
                key_parts.append(str(arg))
        return ":".join(key_parts)
    
    async def _get_cached_result(self, cache_key: str) -> Optional[Any]:
        """Get cached result from Redis"""
        try:
            if not self.redis:
                return None
            
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)
            return None
            
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
            return None
    
    async def _cache_result(self, cache_key: str, result: Any, ttl: int):
        """Cache result in Redis"""
        try:
            if not self.redis:
                return
            
            await self.redis.setex(
                cache_key,
                ttl,
                json.dumps(result)
            )
            
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")
