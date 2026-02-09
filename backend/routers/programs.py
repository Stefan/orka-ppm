"""
Program management endpoints (Portfolio > Program > Project).
"""

import hashlib
import logging
import time
from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID
from typing import Optional, List, Any, Tuple

from auth.rbac import require_permission, Permission
from config.database import supabase, service_supabase
from models.projects import ProgramCreate, ProgramUpdate, ProgramResponse
from utils.converters import convert_uuids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/programs", tags=["programs"])


def _db():
    db = service_supabase if service_supabase else supabase
    if not db:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    return db


def _program_aggregates(db, program_id: str) -> dict:
    """Get total_budget, total_actual_cost, project_count, alert_count for a program."""
    try:
        r = db.table("projects").select("budget, actual_cost").eq("program_id", program_id).execute()
        data = r.data or []
        total_budget = sum((p.get("budget") or 0) for p in data)
        total_actual = sum((p.get("actual_cost") or 0) for p in data)
        alert_count = 0
        if total_budget is not None and total_actual is not None and total_budget > 0 and total_actual > total_budget:
            alert_count += 1
        return {
            "total_budget": total_budget,
            "total_actual_cost": total_actual,
            "project_count": len(data),
            "alert_count": alert_count,
        }
    except Exception:
        return {"total_budget": None, "total_actual_cost": None, "project_count": 0, "alert_count": 0}


@router.get("/", response_model=List[ProgramResponse])
async def list_programs(
    portfolio_id: UUID = Query(..., description="Filter by portfolio"),
    include_metrics: bool = Query(True, description="Include aggregated budget/cost/count"),
    current_user=Depends(require_permission(Permission.program_read)),
):
    """List programs for a portfolio."""
    db = _db()
    try:
        r = db.table("programs").select("*").eq("portfolio_id", str(portfolio_id)).order("sort_order").order("name").execute()
        items = []
        for row in (r.data or []):
            out = convert_uuids(row)
            if include_metrics:
                agg = _program_aggregates(db, row["id"])
                out["total_budget"] = agg["total_budget"]
                out["total_actual_cost"] = agg["total_actual_cost"]
                out["project_count"] = agg["project_count"]
                out["alert_count"] = agg["alert_count"]
            items.append(out)
        return items
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List programs failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ProgramResponse, status_code=201)
async def create_program(
    payload: ProgramCreate,
    current_user=Depends(require_permission(Permission.program_create)),
):
    """Create a new program."""
    db = _db()
    try:
        data = {
            "portfolio_id": str(payload.portfolio_id),
            "name": payload.name,
            "description": payload.description or None,
            "sort_order": payload.sort_order if payload.sort_order is not None else 0,
        }
        r = db.table("programs").insert(data).execute()
        if not r.data:
            raise HTTPException(status_code=400, detail="Failed to create program")
        row = r.data[0]
        out = convert_uuids(row)
        agg = _program_aggregates(db, row["id"])
        out["total_budget"] = agg["total_budget"]
        out["total_actual_cost"] = agg["total_actual_cost"]
        out["project_count"] = agg["project_count"]
        out["alert_count"] = agg["alert_count"]
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create program failed")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(
    program_id: UUID,
    include_metrics: bool = Query(True),
    current_user=Depends(require_permission(Permission.program_read)),
):
    """Get a program by id."""
    db = _db()
    try:
        r = db.table("programs").select("*").eq("id", str(program_id)).execute()
        if not r.data:
            raise HTTPException(status_code=404, detail="Program not found")
        row = r.data[0]
        out = convert_uuids(row)
        if include_metrics:
            agg = _program_aggregates(db, row["id"])
            out["total_budget"] = agg["total_budget"]
            out["total_actual_cost"] = agg["total_actual_cost"]
            out["project_count"] = agg["project_count"]
            out["alert_count"] = agg["alert_count"]
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get program failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: UUID,
    payload: ProgramUpdate,
    current_user=Depends(require_permission(Permission.program_update)),
):
    """Update a program (partial)."""
    db = _db()
    try:
        data = payload.dict(exclude_unset=True)
        if not data:
            r = db.table("programs").select("*").eq("id", str(program_id)).execute()
            if not r.data:
                raise HTTPException(status_code=404, detail="Program not found")
            out = convert_uuids(r.data[0])
            agg = _program_aggregates(db, r.data[0]["id"])
            out["total_budget"] = agg["total_budget"]
            out["total_actual_cost"] = agg["total_actual_cost"]
            out["project_count"] = agg["project_count"]
            out["alert_count"] = agg["alert_count"]
            return out
        r = db.table("programs").update(data).eq("id", str(program_id)).execute()
        if not r.data:
            raise HTTPException(status_code=404, detail="Program not found")
        row = r.data[0]
        out = convert_uuids(row)
        agg = _program_aggregates(db, row["id"])
        out["total_budget"] = agg["total_budget"]
        out["total_actual_cost"] = agg["total_actual_cost"]
        out["project_count"] = agg["project_count"]
        out["alert_count"] = agg["alert_count"]
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Update program failed")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{program_id}", status_code=204)
async def delete_program(
    program_id: UUID,
    current_user=Depends(require_permission(Permission.program_delete)),
):
    """Delete a program. Projects' program_id will be set to NULL (ON DELETE SET NULL)."""
    db = _db()
    try:
        r = db.table("programs").delete().eq("id", str(program_id)).execute()
        if r.data is None and getattr(r, "count", None) == 0:
            raise HTTPException(status_code=404, detail="Program not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Delete program failed")
        raise HTTPException(status_code=500, detail=str(e))


# --- AI suggest: thematic grouping ---
from pydantic import BaseModel as PydanticBase

# In-memory cache for suggest results (same portfolio + project set) to avoid repeated slow OpenAI calls.
_SUGGEST_CACHE: dict[str, Tuple[list, float]] = {}
_SUGGEST_CACHE_TTL_SEC = 60
_SUGGEST_CACHE_MAX_ENTRIES = 50
OPENAI_SUGGEST_TIMEOUT_SEC = 8


class SuggestRequest(PydanticBase):
    portfolio_id: UUID
    project_ids: Optional[List[UUID]] = None  # if None, use all projects in portfolio


class SuggestGroup(PydanticBase):
    program_name: str
    project_ids: List[str]


class SuggestResponse(PydanticBase):
    suggestions: List[SuggestGroup]


def _heuristic_group_projects(projects: List[dict]) -> List[dict]:
    """Group by first word of name or 'Other'. No OpenAI."""
    groups: dict[str, list[str]] = {}
    for p in projects:
        name = (p.get("name") or "").strip()
        first = name.split()[0] if name else "Other"
        key = first[:30]
        groups.setdefault(key, []).append(p["id"])
    return [{"program_name": k, "project_ids": v} for k, v in groups.items()]


def _suggest_cache_key(portfolio_id: str, project_ids: List[str]) -> str:
    ids = sorted(project_ids) if project_ids else []
    raw = f"{portfolio_id}:{','.join(ids)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _suggest_cache_evict_if_needed():
    if len(_SUGGEST_CACHE) <= _SUGGEST_CACHE_MAX_ENTRIES:
        return
    now = time.time()
    expired = [k for k, (_, exp) in _SUGGEST_CACHE.items() if exp <= now]
    for k in expired:
        _SUGGEST_CACHE.pop(k, None)
    if len(_SUGGEST_CACHE) > _SUGGEST_CACHE_MAX_ENTRIES:
        for k in list(_SUGGEST_CACHE.keys())[:_SUGGEST_CACHE_MAX_ENTRIES // 2]:
            _SUGGEST_CACHE.pop(k, None)


async def _ai_group_projects(projects: List[dict], openai_available: bool, timeout_sec: float = OPENAI_SUGGEST_TIMEOUT_SEC) -> List[dict]:
    """Use OpenAI to suggest thematic groups if available; else heuristic."""
    if not openai_available or not projects:
        return _heuristic_group_projects(projects)
    try:
        from config.settings import settings
        try:
            from openai import AsyncOpenAI
        except ImportError:
            return _heuristic_group_projects(projects)
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL or None,
            timeout=timeout_sec,
        )
        names_descs = [
            f"- {p.get('name', '')}: {p.get('description', '') or 'no description'}"
            for p in projects[:50]
        ]
        text = "\n".join(names_descs)
        prompt = (
            "Group these PPM projects into thematic programs. Reply with a JSON array of objects: "
            '{"program_name": "string", "project_names": ["name1", "name2"]}. '
            "Use short program names (e.g. 'Infrastructure', 'Product Launch'). "
            f"Projects:\n{text}"
        )
        resp = await client.chat.completions.create(
            model=getattr(settings, "OPENAI_MODEL", "gpt-4"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
        )
        content = (resp.choices[0].message.content or "").strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        import json
        arr = json.loads(content)
        id_by_name = {p.get("name", ""): p["id"] for p in projects}
        result = []
        for obj in arr:
            program_name = obj.get("program_name") or "Other"
            names = obj.get("project_names") or []
            ids = [id_by_name[n] for n in names if n in id_by_name]
            if ids:
                result.append({"program_name": program_name, "project_ids": ids})
        return result if result else _heuristic_group_projects(projects)
    except Exception as e:
        logger.warning("AI suggest failed, using heuristic: %s", e)
        return _heuristic_group_projects(projects)


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_programs(
    payload: SuggestRequest,
    current_user=Depends(require_permission(Permission.program_read)),
):
    """Suggest thematic program groupings for projects in a portfolio (AI or heuristic)."""
    db = _db()
    try:
        t0 = time.perf_counter()
        query = db.table("projects").select("id, name, description").eq("portfolio_id", str(payload.portfolio_id)).limit(100)
        if payload.project_ids:
            query = query.in_("id", [str(x) for x in payload.project_ids])
        r = query.execute()
        projects = list(r.data or [])
        for p in projects:
            p["id"] = str(p["id"])
        db_ms = (time.perf_counter() - t0) * 1000

        cache_key = _suggest_cache_key(str(payload.portfolio_id), [p["id"] for p in projects])
        now = time.time()
        if cache_key in _SUGGEST_CACHE:
            cached, exp = _SUGGEST_CACHE[cache_key]
            if exp > now:
                logger.info("programs/suggest cache hit, db_ms=%.0f", db_ms)
                return SuggestResponse(suggestions=cached)
            _SUGGEST_CACHE.pop(cache_key, None)
        _suggest_cache_evict_if_needed()

        from config.settings import settings
        openai_ok = bool(getattr(settings, "OPENAI_API_KEY", None))
        ai_start = time.perf_counter()
        suggestions = await _ai_group_projects(projects, openai_ok)
        ai_ms = (time.perf_counter() - ai_start) * 1000
        total_ms = (time.perf_counter() - t0) * 1000
        logger.info("programs/suggest db_ms=%.0f ai_ms=%.0f total_ms=%.0f", db_ms, ai_ms, total_ms)

        out = [SuggestGroup(program_name=s["program_name"], project_ids=[str(x) for x in s["project_ids"]]) for s in suggestions]
        _SUGGEST_CACHE[cache_key] = (out, now + _SUGGEST_CACHE_TTL_SEC)
        return SuggestResponse(suggestions=out)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Suggest programs failed")
        raise HTTPException(status_code=500, detail=str(e))
