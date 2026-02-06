"""
Unified Search Service for Topbar Search.
Combines fulltext (pg_trgm), semantic (RAG/embeddings), and AI auto-suggest.
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional

from config.database import supabase

logger = logging.getLogger(__name__)

# Route hints for result types (hrefs)
ROUTE_HINTS = {
    "project": "/projects/{id}",
    "projects": "/projects",
    "commitment": "/financials/commitments",
    "commitments": "/financials/commitments",
    "knowledge_base": "/help",
    "document": "/help",
    "resource": "/resources",
    "portfolio": "/dashboards",
}


def _href_for(item: Dict[str, Any]) -> str:
    t = (item.get("type") or "project").lower()
    cid = item.get("id") or item.get("content_id")
    template = ROUTE_HINTS.get(t, "/projects")
    if "{id}" in template and cid:
        return template.format(id=cid)
    return template


def _snippet(text: Optional[str], max_len: int = 100) -> str:
    if not text:
        return ""
    text = (text or "").strip().replace("\n", " ")
    return (text[:max_len] + "…") if len(text) > max_len else text


async def fulltext_search(
    q: str,
    limit: int = 10,
    user: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Fulltext search via Supabase (uses pg_trgm index when available)."""
    if not q or not q.strip():
        return []
    if supabase is None:
        return []
    q = q.strip()
    results: List[Dict[str, Any]] = []
    try:
        # Projects: name + description
        try:
            r = (
                supabase.table("projects")
                .select("id, name, description")
                .ilike("name", f"%{q}%")
                .limit(limit)
                .execute()
            )
            for row in (r.data or []):
                results.append({
                    "type": "project",
                    "id": str(row.get("id", "")),
                    "title": row.get("name") or "Project",
                    "snippet": _snippet(row.get("description")),
                    "href": _href_for({"type": "project", "id": row.get("id")}),
                    "metadata": {},
                })
        except Exception as e:
            logger.debug("Projects fulltext search failed: %s", e)

        # Commitments (PO) if table exists
        if len(results) < limit:
            try:
                r = (
                    supabase.table("commitments")
                    .select("id, po_number, description")
                    .ilike("po_number", f"%{q}%")
                    .limit(limit - len(results))
                    .execute()
                )
                for row in (r.data or []):
                    results.append({
                        "type": "commitment",
                        "id": str(row.get("id", "")),
                        "title": row.get("po_number") or "PO",
                        "snippet": _snippet(row.get("description")),
                        "href": _href_for({"type": "commitment", "id": row.get("id")}),
                        "metadata": {},
                    })
            except Exception as e:
                logger.debug("Commitments fulltext search failed: %s", e)

        # Personalization: if user has role, could filter/prioritize (e.g. own projects first)
        role = (user or {}).get("roles") or (user or {}).get("role")
        if isinstance(role, list) and role:
            role = role[0] if role else "user"
        # For now we return all; could sort by user's project_ids later
        return results[:limit]
    except Exception as e:
        logger.warning("Fulltext search error: %s", e)
        return results[:limit]


async def semantic_search(
    q: str,
    limit: int = 5,
    user: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Semantic search via RAG embeddings (KB, documents)."""
    if not q or not q.strip():
        return []
    try:
        from ai_agents import RAGReporterAgent
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key or supabase is None:
            return []
        base_url = os.getenv("OPENAI_BASE_URL")
        agent = RAGReporterAgent(supabase, openai_api_key, base_url=base_url)
        similar = await agent.search_similar_content(
            q,
            content_types=["knowledge_base", "document", "project"],
            limit=limit,
        )
        results = []
        for item in (similar or []):
            content_type = item.get("content_type") or "document"
            content_id = item.get("content_id") or item.get("id", "")
            content_text = item.get("content_text") or ""
            score = item.get("similarity_score") or 0
            results.append({
                "type": content_type,
                "id": str(content_id),
                "title": (item.get("metadata") or {}).get("title") or content_type,
                "snippet": _snippet(content_text, 120),
                "href": _href_for({"type": content_type, "id": content_id}),
                "score": round(score, 3),
                "metadata": item.get("metadata") or {},
            })
        return results
    except Exception as e:
        logger.warning("Semantic search error: %s", e)
        return []


def get_suggestions_sync(q: str, limit: int = 10) -> List[str]:
    """AI auto-suggest (sync): expand partial query to completion suggestions."""
    if not q or len(q.strip()) < 2:
        return []
    q = q.strip()
    try:
        from openai import OpenAI
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            return _fallback_suggestions(q, limit)
        base_url = os.getenv("OPENAI_BASE_URL")
        client = OpenAI(api_key=openai_api_key, base_url=base_url) if base_url else OpenAI(api_key=openai_api_key)
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a search assistant for a PPM (Project Portfolio Management) app. Given a partial search query, return only up to 10 short completion suggestions. One suggestion per line, no numbering. Examples: 'pro' -> Projects, Project list; 'cos' -> Costbook, Cost tracking. Only output the suggestions.",
                },
                {"role": "user", "content": f"Partial query: \"{q}\""},
            ],
            temperature=0.3,
            max_tokens=150,
        )
        text = (response.choices[0].message.content or "").strip()
        suggestions = [s.strip() for s in text.split("\n") if s.strip()][:limit]
        return suggestions
    except Exception as e:
        logger.debug("Auto-suggest LLM failed: %s", e)
        return _fallback_suggestions(q, limit)


def _fallback_suggestions(q: str, limit: int) -> List[str]:
    """Static fallback suggestions for common prefixes."""
    ql = q.lower()
    candidates = [
        "Costbook",
        "Cost tracking",
        "Projects",
        "Project list",
        "Resources",
        "Resource management",
        "Variance",
        "Budget variance",
        "Dashboard",
        "Reports",
        "Help",
        "Documentation",
    ]
    return [c for c in candidates if ql in c.lower()][:limit]


async def unified_search(
    q: str,
    limit: int = 10,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run fulltext, semantic, and suggestions in parallel; return unified response.
    """
    if not q or not q.strip():
        role = (user or {}).get("roles") or (user or {}).get("role")
        if isinstance(role, list) and role:
            role = role[0]
        elif not role and user:
            role = (user or {}).get("role", "user")
        return {
            "fulltext": [],
            "semantic": [],
            "suggestions": [],
            "meta": {"role": role},
        }
    limit_ft = min(limit, 10)
    limit_sem = min(5, limit)
    limit_sug = 10

    loop = asyncio.get_event_loop()
    fulltext_task = fulltext_search(q, limit=limit_ft, user=user)
    semantic_task = semantic_search(q, limit=limit_sem, user=user)
    suggest_task = loop.run_in_executor(None, lambda: get_suggestions_sync(q, limit_sug))

    fulltext, semantic, suggestions = await asyncio.gather(fulltext_task, semantic_task, suggest_task)

    role = (user or {}).get("roles") or (user or {}).get("role")
    if isinstance(role, list) and role:
        role = role[0]
    elif not role and user:
        role = user.get("role", "user")

    return {
        "fulltext": fulltext,
        "semantic": semantic,
        "suggestions": suggestions,
        "meta": {"role": role},
    }
