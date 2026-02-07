"""
SSO (Single Sign-On) provider config and optional callback.
Phase 1: Config only (GET/PUT). OAuth flow is Supabase-native; real keys live in Supabase Dashboard.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from auth.rbac import require_admin
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth/sso", tags=["auth-sso"])

# In-memory store (replace with DB later). Keys: provider id, value: { enabled, last_error }
_sso_config: dict = {
    "google": {"name": "Google", "enabled": False, "last_error": None},
    "azure": {"name": "Microsoft (Azure AD)", "enabled": False, "last_error": None},
    "okta": {"name": "Okta", "enabled": False, "last_error": None},
    "azure_ad": {"name": "Azure AD (SAML)", "enabled": False, "last_error": None},
}


class ProviderConfigUpdate(BaseModel):
    id: str = Field(..., description="Provider id: google, azure, okta, azure_ad")
    enabled: bool = False


class ConfigPutBody(BaseModel):
    providers: List[ProviderConfigUpdate] = Field(default_factory=list)


@router.get("/config")
async def get_sso_config(current_user: dict = Depends(require_admin())):
    """List SSO providers with status. Admin only."""
    return {
        "providers": [
            {"id": pid, "name": data["name"], "enabled": data["enabled"], "last_error": data["last_error"]}
            for pid, data in _sso_config.items()
        ]
    }


@router.put("/config")
async def put_sso_config(body: ConfigPutBody, current_user: dict = Depends(require_admin())):
    """Update enabled flag per provider. Admin only. Keys/Secrets are configured in Supabase Dashboard."""
    for p in body.providers:
        if p.id in _sso_config:
            _sso_config[p.id]["enabled"] = p.enabled
    return {"ok": True}
