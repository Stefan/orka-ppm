"""
Costbook API Router
Cost Book columns: Pending/Approved Budget, Control Estimate, Open Committed,
Invoice Value, Remaining Commitment, VOWD, Accruals, ETC, EAC, Delta EAC, Variance.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
import logging

from auth.dependencies import get_current_user
from config.database import supabase
from services.costbook_aggregates import compute_costbook_rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/costbook", tags=["costbook"])


@router.get("/rows")
async def get_costbook_rows(
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    current_user: dict = Depends(get_current_user),
):
    """
    Return costbook aggregate rows per project with all Cost Book columns.
    Joins projects, commitments, actuals; computes VOWD, Accruals, ETC, EAC, Variance.
    """
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        # Fetch projects (optional organization_id filter when column exists)
        q = supabase.table("projects").select("id, name, budget, start_date, end_date, currency")
        if organization_id:
            q = q.eq("organization_id", organization_id)
        proj_res = q.execute()
        projects = proj_res.data or []
        if not projects:
            return {"rows": [], "count": 0}

        project_ids = [str(p["id"]) for p in projects]

        # Fetch commitments
        comm_res = supabase.table("commitments").select("*").in_("project_id", project_ids).execute()
        commitments_raw = comm_res.data or []
        commitments_by_project: dict = {}
        for c in commitments_raw:
            pid = str(c.get("project_id", ""))
            if pid not in commitments_by_project:
                commitments_by_project[pid] = []
            commitments_by_project[pid].append(c)

        # Fetch actuals
        act_res = supabase.table("actuals").select("*").in_("project_id", project_ids).execute()
        actuals_raw = act_res.data or []
        actuals_by_project: dict = {}
        for a in actuals_raw:
            pid = str(a.get("project_id", ""))
            if pid not in actuals_by_project:
                actuals_by_project[pid] = []
            actuals_by_project[pid].append(a)

        rows = compute_costbook_rows(projects, commitments_by_project, actuals_by_project)
        return {"rows": rows, "count": len(rows)}
    except Exception as e:
        logger.exception("Costbook rows failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/summary")
async def get_costbook_summary(
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    current_user: dict = Depends(get_current_user),
):
    """Return portfolio-level costbook summary (totals across projects)."""
    resp = await get_costbook_rows(organization_id=organization_id, current_user=current_user)
    rows = resp.get("rows") or []
    if not rows:
        return {
            "total_approved_budget": 0,
            "total_open_committed": 0,
            "total_invoice_value": 0,
            "total_vowd": 0,
            "total_eac": 0,
            "total_variance": 0,
            "project_count": 0,
        }
    return {
        "total_approved_budget": sum(r.get("approved_budget") or 0 for r in rows),
        "total_open_committed": sum(r.get("open_committed") or 0 for r in rows),
        "total_invoice_value": sum(r.get("invoice_value") or 0 for r in rows),
        "total_vowd": sum(r.get("vowd") or 0 for r in rows),
        "total_eac": sum(r.get("eac") or 0 for r in rows),
        "total_variance": sum(r.get("variance") or 0 for r in rows),
        "project_count": len(rows),
    }
