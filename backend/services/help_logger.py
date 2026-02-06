"""
Help Logger Service (AI Help Chat Enhancement)
Logs help queries, responses, errors, and feedback to help_logs and help_query_feedback.
All operations filter by organization_id where applicable.
"""

from typing import Dict, Any, List, Optional
from uuid import uuid4
from datetime import datetime
import logging
import os

from supabase import create_client, Client

logger = logging.getLogger(__name__)


class HelpLogger:
    """Logs help chat interactions to help_logs and help_query_feedback."""

    def __init__(self, supabase_client: Optional[Client] = None):
        self._client = supabase_client
        if self._client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY")
            if url and key:
                self._client = create_client(url, key)

    def _table(self, name: str):
        if self._client is None:
            raise RuntimeError("HelpLogger: Supabase client not configured")
        return self._client.table(name)

    def log_query(
        self,
        user_id: str,
        organization_id: Optional[str],
        query: str,
        page_context: Optional[Dict[str, Any]] = None,
        user_role: Optional[str] = None,
    ) -> str:
        """Insert a new help log row for a query; returns query_id (help_logs.id)."""
        query_id = str(uuid4())
        payload = {
            "id": query_id,
            "user_id": user_id,
            "organization_id": organization_id,
            "query": query,
            "page_context": page_context or {},
            "user_role": user_role,
            "success": False,
        }
        try:
            self._table("help_logs").insert(payload).execute()
            return query_id
        except Exception as e:
            logger.warning("HelpLogger.log_query failed: %s", e)
            return query_id

    def log_response(
        self,
        query_id: str,
        response: str,
        confidence_score: float,
        sources_used: Optional[List[Dict[str, Any]]] = None,
        response_time_ms: int = 0,
        success: bool = True,
    ) -> None:
        """Update the help_logs row with response data."""
        try:
            self._table("help_logs").update({
                "response": response,
                "confidence_score": round(min(1.0, max(0.0, confidence_score)), 2),
                "sources_used": sources_used or [],
                "response_time_ms": response_time_ms,
                "success": success,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", query_id).execute()
        except Exception as e:
            logger.warning("HelpLogger.log_response failed: %s", e)

    def log_error(
        self,
        query_id: str,
        error_type: str,
        error_message: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> None:
        """Update the help_logs row with error info."""
        try:
            payload = {
                "success": False,
                "error_type": error_type,
                "error_message": error_message or "",
                "updated_at": datetime.utcnow().isoformat(),
            }
            self._table("help_logs").update(payload).eq("id", query_id).execute()
        except Exception as e:
            logger.warning("HelpLogger.log_error failed: %s", e)

    def log_feedback(
        self,
        query_id: str,
        user_id: str,
        organization_id: Optional[str],
        rating: int,
        comments: Optional[str] = None,
    ) -> str:
        """Insert or update feedback for a query; returns feedback id."""
        feedback_id = str(uuid4())
        rating_val = max(1, min(5, rating))
        try:
            existing = (
                self._table("help_query_feedback")
                .select("id")
                .eq("query_id", query_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                self._table("help_query_feedback").update({
                    "rating": rating_val,
                    "comments": comments or "",
                }).eq("query_id", query_id).eq("user_id", user_id).execute()
                return existing.data[0]["id"]
            self._table("help_query_feedback").insert({
                "id": feedback_id,
                "query_id": query_id,
                "user_id": user_id,
                "organization_id": organization_id,
                "rating": rating_val,
                "comments": comments or "",
            }).execute()
            return feedback_id
        except Exception as e:
            logger.warning("HelpLogger.log_feedback failed: %s", e)
            return feedback_id

    def log_action(
        self,
        query_id: str,
        action_type: str,
        action_details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Update the help_logs row with action_type and action_details."""
        try:
            self._table("help_logs").update({
                "action_type": action_type,
                "action_details": action_details or {},
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", query_id).execute()
        except Exception as e:
            logger.warning("HelpLogger.log_action failed: %s", e)


def get_help_logger(supabase_client: Optional[Client] = None) -> HelpLogger:
    """Return a HelpLogger instance (uses config.database.supabase if available)."""
    try:
        from config.database import supabase
        return HelpLogger(supabase_client or supabase)
    except ImportError:
        return HelpLogger(supabase_client)
