"""
Integrations API: config + sync for SAP, Microsoft, Oracle, Jira, Slack.
Spec: .kiro/specs/integrations-erp/
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.dependencies import get_current_user
from services.erp_adapter import get_erp_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# In-memory config store (replace with DB in production)
_integration_config: Dict[str, Dict[str, Any]] = {}
_integration_status: Dict[str, Dict[str, Any]] = {}

SYSTEMS = ["sap", "microsoft", "oracle", "jira", "slack"]


class SyncBody(BaseModel):
    entity: str = "commitments"
    organization_id: Optional[str] = None


class ConfigBody(BaseModel):
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    client: Optional[str] = None
    base_url: Optional[str] = None
    token: Optional[str] = None
    webhook_url: Optional[str] = None
    account_id: Optional[str] = None
    host: Optional[str] = None


class SyncRequest(BaseModel):
    system: str = "sap"
    entity: str = "commitments"
    organization_id: Optional[str] = None


@router.get("/config")
async def list_integrations(current_user: dict = Depends(get_current_user)):
    """List all connectors with status (enabled, last_sync)."""
    result: List[Dict[str, Any]] = []
    for system in SYSTEMS:
        cfg = _integration_config.get(system, {})
        status = _integration_status.get(system, {})
        result.append({
            "system": system,
            "enabled": bool(cfg.get("api_key") or cfg.get("token") or cfg.get("webhook_url") or cfg.get("host")),
            "last_sync": status.get("last_sync"),
            "last_error": status.get("last_error"),
        })
    return result


@router.get("/{system}/config")
async def get_config(system: str, current_user: dict = Depends(get_current_user)):
    """Get config for one system (no sensitive values)."""
    if system not in SYSTEMS:
        raise HTTPException(status_code=404, detail="Unknown system")
    cfg = _integration_config.get(system, {})
    return {
        "system": system,
        "configured": bool(cfg),
        "has_api_key": "api_key" in cfg and bool(cfg["api_key"]),
        "has_token": "token" in cfg and bool(cfg["token"]),
    }


@router.put("/{system}/config")
async def put_config(
    system: str,
    body: ConfigBody,
    current_user: dict = Depends(get_current_user),
):
    """Save config for one system."""
    if system not in SYSTEMS:
        raise HTTPException(status_code=404, detail="Unknown system")
    cfg: Dict[str, Any] = {}
    if body.api_url is not None:
        cfg["api_url"] = body.api_url
    if body.api_key is not None:
        cfg["api_key"] = body.api_key
    if body.client is not None:
        cfg["client"] = body.client
    if body.base_url is not None:
        cfg["base_url"] = body.base_url
    if body.token is not None:
        cfg["token"] = body.token
    if body.webhook_url is not None:
        cfg["webhook_url"] = body.webhook_url
    if body.account_id is not None:
        cfg["account_id"] = body.account_id
    if body.host is not None:
        cfg["host"] = body.host
    _integration_config[system] = {**_integration_config.get(system, {}), **cfg}
    return {"system": system, "ok": True}


@router.post("/{system}/sync")
async def sync_system(
    system: str,
    body: SyncBody,
    current_user: dict = Depends(get_current_user),
):
    """Trigger sync for one system (commitments or actuals)."""
    if system not in SYSTEMS:
        raise HTTPException(status_code=404, detail="Unknown system")
    cfg = _integration_config.get(system, {})
    kwargs = {
        "host": cfg.get("host"),
        "client": cfg.get("client"),
        "base_url": cfg.get("base_url"),
        "api_key": cfg.get("api_key"),
        "token": cfg.get("token"),
        "webhook_url": cfg.get("webhook_url"),
        "account_id": cfg.get("account_id"),
    }
    adapter = get_erp_adapter(system, **kwargs)
    entity = body.entity if body.entity in ("commitments", "actuals") else "commitments"
    try:
        if entity == "commitments":
            result = adapter.sync_commitments(organization_id=body.organization_id)
        else:
            result = adapter.sync_actuals(organization_id=body.organization_id)
        _integration_status[system] = {
            "last_sync": result.get("synced_at"),
            "last_error": None,
        }
        return {
            "adapter": adapter.adapter_type,
            "entity": entity,
            "total": result.get("total", 0),
            "inserted": result.get("inserted", 0),
            "updated": result.get("updated", 0),
            "errors": result.get("errors", []),
            "synced_at": result.get("synced_at"),
        }
    except Exception as e:
        logger.exception("Integration sync failed: %s", e)
        _integration_status[system] = {
            "last_sync": _integration_status.get(system, {}).get("last_sync"),
            "last_error": str(e),
        }
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_body(
    body: SyncRequest,
    current_user: dict = Depends(get_current_user),
):
    """Trigger sync by body: system, entity, organization_id."""
    system = (body.system or "sap").lower()
    if system not in SYSTEMS and system != "csv":
        system = "sap"
    return await sync_system(
        system,
        SyncBody(entity=body.entity, organization_id=body.organization_id),
        current_user,
    )
