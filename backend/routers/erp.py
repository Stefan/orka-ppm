"""
Phase 2 – Integration & Customizability: ERP sync API
Enterprise Readiness: SAP + CSV adapter sync
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal

from auth.dependencies import get_current_user
from services.erp_adapter import get_erp_adapter

router = APIRouter(prefix="/api/v1/erp", tags=["erp"])


class ErpSyncRequest(BaseModel):
    adapter: Literal["sap", "csv"] = "csv"
    entity: Literal["commitments", "actuals"] = "commitments"
    organization_id: Optional[str] = None


@router.post("/sync")
async def erp_sync(req: ErpSyncRequest, current_user: dict = Depends(get_current_user)):
    """Trigger ERP sync for commitments or actuals."""
    adapter = get_erp_adapter(adapter_type=req.adapter)
    if req.entity == "commitments":
        result = adapter.sync_commitments(organization_id=req.organization_id)
    else:
        result = adapter.sync_actuals(organization_id=req.organization_id)
    return {
        "adapter": adapter.adapter_type,
        "entity": req.entity,
        "total": result.get("total", 0),
        "inserted": result.get("inserted", 0),
        "updated": result.get("updated", 0),
        "errors": result.get("errors", []),
        "synced_at": result.get("synced_at"),
    }
