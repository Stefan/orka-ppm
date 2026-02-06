"""
Unified Search API Router (Topbar Search).
GET /api/v1/search?q=...&limit=10
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from auth.dependencies import get_current_user
from services.unified_search_service import unified_search

router = APIRouter(prefix="/api/v1", tags=["search"])


@router.get("/search")
async def search(
    q: Optional[str] = Query(None, description="Search query"),
    limit: int = Query(10, ge=1, le=20, description="Max results per category"),
    current_user: dict = Depends(get_current_user),
):
    """
    Unified search: fulltext (pg_trgm) + semantic (RAG) + AI suggestions.
    Results are personalized by user role.
    """
    if not q or not q.strip():
        roles = current_user.get("roles")
        role = roles[0] if isinstance(roles, list) and roles else current_user.get("role", "user")
        return {
            "fulltext": [],
            "semantic": [],
            "suggestions": [],
            "meta": {"role": role},
        }
    result = await unified_search(q.strip(), limit=limit, user=current_user)
    return result
