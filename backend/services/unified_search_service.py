"""
Unified Search Service for Topbar Search.
Fast path: fulltext (pg_trgm) + navigation + static suggestions only.
Semantic (RAG) is disabled on the hot path for speed.
"""

import os
import asyncio
import logging
import time
from typing import List, Dict, Any, Optional, Tuple

from config.database import supabase

logger = logging.getLogger(__name__)

# In-memory cache for search results (same query within TTL returns instantly).
_SEARCH_CACHE: Dict[Tuple[str, int], Tuple[Dict[str, Any], float]] = {}
_SEARCH_CACHE_TTL_SEC = 20
_SEARCH_CACHE_MAX_ENTRIES = 200

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

# App navigation: all main app pages so the topbar search finds them by keyword.
# (RAG can complement this by indexing app structure as KB documents with metadata href.)
# Each entry: (list of keywords, { type, id, title, snippet, href })
APP_NAVIGATION = [
    (["user management", "user management page", "users", "admin users", "manage users", "roles", "rbac"], {
        "type": "navigation",
        "id": "nav-admin-users",
        "title": "User Management",
        "snippet": "Manage users, roles and permissions",
        "href": "/admin/users",
    }),
    (["admin", "system admin", "administration"], {
        "type": "navigation",
        "id": "nav-admin",
        "title": "System Admin",
        "snippet": "Admin dashboard, user management, performance",
        "href": "/admin",
    }),
    (["performance", "performance monitor", "performance dashboard", "slow queries", "cache stats"], {
        "type": "navigation",
        "id": "nav-admin-performance",
        "title": "Performance Monitor",
        "snippet": "Performance metrics, cache, slow queries",
        "href": "/admin/performance",
    }),
    (["feature toggles", "feature flags", "feature flags toggles"], {
        "type": "navigation",
        "id": "nav-admin-feature-toggles",
        "title": "Feature Toggles",
        "snippet": "Enable or disable features",
        "href": "/admin/feature-toggles",
    }),
    (["audit", "audit trail", "audit log", "compliance", "anomalies", "audit logs"], {
        "type": "navigation",
        "id": "nav-audit",
        "title": "Audit Trail",
        "snippet": "Audit logs, timeline, anomalies and compliance",
        "href": "/audit",
    }),
    (["dashboard", "dashboards", "portfolio", "overview", "projects overview", "kpi", "metrics"], {
        "type": "navigation",
        "id": "nav-dashboards",
        "title": "Portfolio Dashboards",
        "snippet": "Overview of projects and key metrics",
        "href": "/dashboards",
    }),
    (["resources", "resource management", "team", "allocation", "capacity", "utilization"], {
        "type": "navigation",
        "id": "nav-resources",
        "title": "Resource Management",
        "snippet": "Team resources and allocations",
        "href": "/resources",
    }),
    (["financial", "financials", "budget", "cost", "expense", "money", "tracking", "commitments"], {
        "type": "navigation",
        "id": "nav-financials",
        "title": "Financial Tracking",
        "snippet": "Budgets, costs and financial performance",
        "href": "/financials",
    }),
    (["reports", "analytics", "ai reports", "insights"], {
        "type": "navigation",
        "id": "nav-reports",
        "title": "AI Reports & Analytics",
        "snippet": "AI-powered insights and reports",
        "href": "/reports",
    }),
    (["risk", "risks", "issue", "register", "mitigation"], {
        "type": "navigation",
        "id": "nav-risks",
        "title": "Risk/Issue Registers",
        "snippet": "Manage project risks and issues",
        "href": "/risks",
    }),
    (["monte carlo", "simulation", "statistics", "probability"], {
        "type": "navigation",
        "id": "nav-monte-carlo",
        "title": "Monte Carlo Analysis",
        "snippet": "Statistical analysis and simulations",
        "href": "/monte-carlo",
    }),
    (["scenarios", "what-if", "planning", "outcomes"], {
        "type": "navigation",
        "id": "nav-scenarios",
        "title": "What-If Scenarios",
        "snippet": "Explore project scenarios and outcomes",
        "href": "/scenarios",
    }),
    (["changes", "change management", "approval", "change requests"], {
        "type": "navigation",
        "id": "nav-changes",
        "title": "Change Management",
        "snippet": "Track and manage project changes",
        "href": "/changes",
    }),
    (["projects", "project list", "project list page"], {
        "type": "navigation",
        "id": "nav-projects",
        "title": "Projects",
        "snippet": "Project list and details",
        "href": "/projects",
    }),
    (["help", "documentation", "help chat", "support"], {
        "type": "navigation",
        "id": "nav-help",
        "title": "Help & Documentation",
        "snippet": "Help chat and documentation",
        "href": "/help",
    }),
    (["settings", "preferences", "user settings"], {
        "type": "navigation",
        "id": "nav-settings",
        "title": "Settings",
        "snippet": "User preferences and settings",
        "href": "/settings",
    }),
    (["import", "import projects", "csv import"], {
        "type": "navigation",
        "id": "nav-import",
        "title": "Import",
        "snippet": "Import projects or data",
        "href": "/import",
    }),
]


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


def _fulltext_projects_sync(q: str, limit: int) -> List[Dict[str, Any]]:
    """Sync projects search (run in executor)."""
    if supabase is None:
        return []
    results: List[Dict[str, Any]] = []
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
    return results


def _fulltext_commitments_sync(q: str, limit: int) -> List[Dict[str, Any]]:
    """Sync commitments search (run in executor)."""
    if supabase is None:
        return []
    results: List[Dict[str, Any]] = []
    try:
        r = (
            supabase.table("commitments")
            .select("id, po_number, description")
            .ilike("po_number", f"%{q}%")
            .limit(limit)
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
    return results


async def fulltext_search(
    q: str,
    limit: int = 10,
    user: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Fulltext search via Supabase. Projects and commitments run in parallel."""
    if not q or not q.strip():
        return []
    if supabase is None:
        return []
    q = q.strip()
    try:
        loop = asyncio.get_event_loop()
        half = max(limit // 2, 1)
        projects_task = loop.run_in_executor(None, _fulltext_projects_sync, q, half)
        commitments_task = loop.run_in_executor(None, _fulltext_commitments_sync, q, half)
        projects, commitments = await asyncio.gather(projects_task, commitments_task)
        results = (projects or []) + (commitments or [])
        return results[:limit]
    except Exception as e:
        logger.warning("Fulltext search error: %s", e)
        return []


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
    """Instant static suggestions (no LLM). Used for fast search bar."""
    ql = q.lower()
    candidates = [
        "Audit",
        "Audit trail",
        "Costbook",
        "Cost tracking",
        "Dashboard",
        "Documentation",
        "Financials",
        "Help",
        "Projects",
        "Project list",
        "Reports",
        "Resource management",
        "Resources",
        "Risks",
        "User management",
        "Variance",
        "Budget variance",
    ]
    return [c for c in candidates if ql in c.lower()][:limit]


def _prune_search_cache() -> None:
    now = time.monotonic()
    to_drop = [k for k, (_, ts) in _SEARCH_CACHE.items() if now - ts > _SEARCH_CACHE_TTL_SEC]
    for k in to_drop:
        _SEARCH_CACHE.pop(k, None)
    while len(_SEARCH_CACHE) > _SEARCH_CACHE_MAX_ENTRIES:
        oldest = min(_SEARCH_CACHE.keys(), key=lambda key: _SEARCH_CACHE[key][1])
        _SEARCH_CACHE.pop(oldest, None)


async def unified_search(
    q: str,
    limit: int = 10,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Fast path: fulltext + navigation + static suggestions only.
    Semantic (RAG) is not called so the bar stays under ~100–200 ms when cached or indexed.
    Results are cached for a short TTL for repeated queries.
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

    cache_key = (q.strip().lower(), limit)
    _prune_search_cache()
    if cache_key in _SEARCH_CACHE:
        cached, cached_at = _SEARCH_CACHE[cache_key]
        if time.monotonic() - cached_at <= _SEARCH_CACHE_TTL_SEC:
            return cached

    limit_ft = min(limit, 10)
    limit_sug = 10
    suggestions = _fallback_suggestions(q, limit_sug)

    fulltext = await fulltext_search(q, limit=limit_ft, user=user)

    ql = q.strip().lower()
    nav_hrefs = set()
    nav_results = []
    for keywords, nav_item in APP_NAVIGATION:
        if any(kw in ql for kw in keywords) and nav_item.get("href") not in nav_hrefs:
            nav_hrefs.add(nav_item.get("href"))
            nav_results.append(dict(nav_item, metadata={}))
    fulltext = nav_results + [r for r in fulltext if r.get("href") not in nav_hrefs]

    role = (user or {}).get("roles") or (user or {}).get("role")
    if isinstance(role, list) and role:
        role = role[0]
    elif not role and user:
        role = user.get("role", "user")

    result = {
        "fulltext": fulltext,
        "semantic": [],
        "suggestions": suggestions,
        "meta": {"role": role},
    }
    _SEARCH_CACHE[cache_key] = (result, time.monotonic())
    return result