"""
Work Packages API Router
CRUD for work packages under projects.
"""

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from typing import Optional

from auth.dependencies import get_current_user
from models.project_controls import WorkPackageCreate, WorkPackageUpdate, WorkPackageResponse
from services.work_package_service import WorkPackageService

router = APIRouter(prefix="/projects", tags=["Work Packages"])

_wp_service = None


def _get_wp_service():
    global _wp_service
    if _wp_service is None:
        _wp_service = WorkPackageService()
    return _wp_service


def _serialize_wp(wp: dict) -> dict:
    """Ensure UUIDs and decimals are JSON-serializable."""
    if not wp:
        return wp
    out = dict(wp)
    for key in ("id", "project_id", "responsible_manager", "parent_package_id"):
        if key in out and out[key] is not None:
            out[key] = str(out[key])
    for key in ("budget", "percent_complete", "actual_cost", "earned_value"):
        if key in out and out[key] is not None:
            out[key] = float(out[key])
    return out


@router.get("/{project_id}/work-packages")
async def list_work_packages(
    project_id: UUID,
    active_only: bool = True,
    current_user=Depends(get_current_user),
):
    """List work packages for a project."""
    svc = _get_wp_service()
    items = await svc.get_work_packages(project_id, active_only=active_only)
    return [_serialize_wp(wp) for wp in items]


@router.post("/{project_id}/work-packages", status_code=201)
async def create_work_package(
    project_id: UUID,
    body: WorkPackageCreate,
    current_user=Depends(get_current_user),
):
    """Create a work package. Body.project_id must match path project_id."""
    if str(body.project_id) != str(project_id):
        raise HTTPException(status_code=400, detail="project_id in body must match path")
    svc = _get_wp_service()
    try:
        data = body.model_dump() if hasattr(body, "model_dump") else body.dict()
        wp = await svc.create_work_package(project_id, data)
        return _serialize_wp(wp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/work-packages/{wp_id}")
async def get_work_package(
    project_id: UUID,
    wp_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get one work package."""
    svc = _get_wp_service()
    wp = await svc.get_work_package(project_id, wp_id)
    if not wp:
        raise HTTPException(status_code=404, detail="Work package not found")
    return _serialize_wp(wp)


@router.patch("/{project_id}/work-packages/{wp_id}")
async def update_work_package(
    project_id: UUID,
    wp_id: UUID,
    body: WorkPackageUpdate,
    current_user=Depends(get_current_user),
):
    """Partial update of a work package."""
    svc = _get_wp_service()
    try:
        data = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else body.dict(exclude_unset=True)
        wp = await svc.update_work_package(project_id, wp_id, data)
        return _serialize_wp(wp)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/work-packages/{wp_id}", status_code=204)
async def delete_work_package(
    project_id: UUID,
    wp_id: UUID,
    current_user=Depends(get_current_user),
):
    """Delete a work package. Children get parent_package_id set to NULL."""
    svc = _get_wp_service()
    try:
        await svc.delete_work_package(project_id, wp_id)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
