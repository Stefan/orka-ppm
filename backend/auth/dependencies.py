"""
Authentication dependencies for FastAPI endpoints

This module provides authentication dependencies that integrate with the
SupabaseRBACBridge for enhanced JWT token handling with role information.
JWT is verified via JWKS (RS256/ES256) when SUPABASE_URL is set, or via
SUPABASE_JWT_SECRET (HS256) as fallback.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from uuid import UUID

from config.settings import settings

# Security scheme
security = HTTPBearer(auto_error=False)

def _allow_dev_default_user() -> bool:
    """Only allow unauthenticated default admin when explicitly enabled (e.g. local dev)."""
    return settings.ALLOW_DEV_DEFAULT_USER and settings.environment == "development"


def _default_user_dict() -> Dict[str, Any]:
    """Return the development default admin user (used when ALLOW_DEV_DEFAULT_USER=true)."""
    default_user_id = "00000000-0000-0000-0000-000000000001"
    return {
        "id": default_user_id,
        "user_id": default_user_id,
        "email": "dev@example.com",
        "tenant_id": default_user_id,
        "organization_id": default_user_id,
        "role": "admin",
        "roles": ["admin"],
        "permissions": ["user_manage"],
    }


def _payload_to_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build user dict from verified JWT payload.
    tenant_id / organization_id: from JWT top-level tenant_id, or app_metadata.tenant_id, else sub (user_id).
    Set in Supabase via Authentication → User → App Metadata: { "tenant_id": "your-org-uuid" }.
    """
    user_id = payload.get("sub") or ""
    app_meta = payload.get("app_metadata") or {}
    tenant_id = payload.get("tenant_id") or app_meta.get("tenant_id") or app_meta.get("organization_id") or user_id
    return {
        "user_id": user_id,
        "email": payload.get("email", "dev@example.com"),
        "roles": payload.get("roles", []),
        "permissions": payload.get("permissions", []),
        "tenant_id": tenant_id,
        "organization_id": tenant_id,
    }


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Extract user from JWT token. Verifies signature via JWKS (preferred) or SUPABASE_JWT_SECRET.
    Default admin fallback only when ALLOW_DEV_DEFAULT_USER=true and environment is development.
    """
    if not credentials:
        if _allow_dev_default_user():
            print("🔧 Development mode: No credentials provided, using default admin user (ALLOW_DEV_DEFAULT_USER=true)")
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    token = credentials.credentials
    secret_key = (settings.SUPABASE_JWT_SECRET or "").strip() or None

    try:
        payload: Optional[Dict[str, Any]] = None
        used_jwks = False

        # 1) Prefer JWKS (RS256/ES256) when SUPABASE_URL is set
        supabase_url = (settings.SUPABASE_URL or "").strip()
        if supabase_url:
            from .jwks_client import get_supabase_jwks_url, verify_token_with_jwks
            jwks_url = get_supabase_jwks_url(supabase_url)
            if jwks_url:
                payload = verify_token_with_jwks(token, jwks_url)
                if payload:
                    used_jwks = True

        # 2) Fallback: Bridge (decodes with HS256 if secret_key given)
        if not payload:
            try:
                from .supabase_rbac_bridge import get_supabase_rbac_bridge
                bridge = get_supabase_rbac_bridge()
                user_info = await bridge.get_user_from_jwt(token, secret_key=secret_key)
                if user_info:
                    user_id = user_info.get("user_id")
                    tid = user_info.get("tenant_id") or user_info.get("organization_id") or user_id
                    return {
                        "user_id": user_id,
                        "email": user_info.get("email", "dev@example.com"),
                        "roles": user_info.get("roles", []),
                        "permissions": user_info.get("permissions", []),
                        "effective_roles": user_info.get("effective_roles", []),
                        "tenant_id": tid,
                        "organization_id": tid,
                    }
            except ImportError:
                pass
            except Exception as bridge_error:
                if secret_key and not _allow_dev_default_user():
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
                if _allow_dev_default_user():
                    print(f"🔧 Development mode: Bridge error ({bridge_error}), using default admin user")
                    return _default_user_dict()
                print(f"🔧 Bridge error: {bridge_error}, falling back to basic decode")

        # 3) Fallback: verify with HS256 secret or decode without verification (legacy)
        if not payload:
            if secret_key:
                try:
                    payload = jwt.decode(token, secret_key, algorithms=["HS256"])
                except jwt.InvalidAlgorithmError:
                    # Token is RS256/ES256 (e.g. Supabase) but JWKS verification failed; decode without verification for dev
                    if _allow_dev_default_user():
                        payload = jwt.decode(token, options={"verify_signature": False})
                    else:
                        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
            else:
                payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        if not user_id or user_id == "anon":
            if _allow_dev_default_user():
                user_id = "00000000-0000-0000-0000-000000000001"
                print(f"🔧 Development mode: Using default user ID {user_id}")
            else:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        user = _payload_to_user(payload)
        if used_jwks:
            try:
                from .supabase_rbac_bridge import get_supabase_rbac_bridge
                bridge = get_supabase_rbac_bridge()
                enhanced = await bridge.get_enhanced_user_info(UUID(user_id))
                if enhanced:
                    user["roles"] = enhanced.get("roles", user["roles"])
                    user["permissions"] = enhanced.get("permissions", user["permissions"])
                    user["effective_roles"] = enhanced.get("effective_roles", [])
                    if enhanced.get("tenant_id") is not None:
                        user["tenant_id"] = enhanced["tenant_id"]
                        user["organization_id"] = enhanced.get("organization_id", enhanced["tenant_id"])
                    elif enhanced.get("organization_id") is not None:
                        user["organization_id"] = enhanced["organization_id"]
                        user["tenant_id"] = enhanced.get("tenant_id", enhanced["organization_id"])
            except Exception:
                pass
        return user
    except jwt.ExpiredSignatureError:
        if _allow_dev_default_user():
            print("🔧 Development mode: Token expired, using default admin user")
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        if _allow_dev_default_user():
            print("🔧 Development mode: Invalid token, using default admin user")
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        if _allow_dev_default_user():
            print(f"🔧 Development mode: Auth error ({e}), using default admin user")
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

async def get_current_user_light(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Lightweight auth: verify JWT only, no DB call for enhanced user/roles.
    Use for high-frequency endpoints (e.g. search) where a single DB round-trip matters.
    """
    if not credentials:
        if _allow_dev_default_user():
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    token = credentials.credentials
    secret_key = (settings.SUPABASE_JWT_SECRET or "").strip() or None

    try:
        payload: Optional[Dict[str, Any]] = None
        supabase_url = (settings.SUPABASE_URL or "").strip()
        if supabase_url:
            from .jwks_client import get_supabase_jwks_url, verify_token_with_jwks
            jwks_url = get_supabase_jwks_url(supabase_url)
            if jwks_url:
                payload = verify_token_with_jwks(token, jwks_url)
        if not payload:
            try:
                from .supabase_rbac_bridge import get_supabase_rbac_bridge
                bridge = get_supabase_rbac_bridge()
                user_info = await bridge.get_user_from_jwt(token, secret_key=secret_key)
                if user_info:
                    return {
                        "user_id": user_info.get("user_id", ""),
                        "email": user_info.get("email", "dev@example.com"),
                        "roles": user_info.get("roles", []),
                        "permissions": user_info.get("permissions", []),
                        "tenant_id": user_info.get("tenant_id") or user_info.get("organization_id") or user_info.get("user_id"),
                        "organization_id": user_info.get("organization_id") or user_info.get("tenant_id") or user_info.get("user_id"),
                    }
            except Exception:
                pass
        if not payload:
            if secret_key:
                payload = jwt.decode(token, secret_key, algorithms=["HS256"])
            else:
                payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub") or ""
        if not user_id or user_id == "anon":
            if _allow_dev_default_user():
                return _default_user_dict()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return _payload_to_user(payload)
    except jwt.ExpiredSignatureError:
        if _allow_dev_default_user():
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        if _allow_dev_default_user():
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception:
        if _allow_dev_default_user():
            return _default_user_dict()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")


def get_current_user_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """Extract user ID from current user"""
    return current_user.get("user_id", "00000000-0000-0000-0000-000000000001")

async def get_current_user_with_roles(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Extract user with full role and permission information from JWT token.
    
    This is an enhanced version of get_current_user that ensures role
    information is always included.
    """
    user = await get_current_user(credentials)
    
    # If roles are not in the token, fetch them from the bridge
    if "roles" not in user or not user["roles"]:
        # For development default user, provide admin roles
        if user.get("user_id") == "00000000-0000-0000-0000-000000000001":
            user["roles"] = ["admin"]
            user["permissions"] = ["user_manage"]
            user["effective_roles"] = ["admin"]
        else:
            try:
                from .supabase_rbac_bridge import get_supabase_rbac_bridge
                from uuid import UUID

                bridge = get_supabase_rbac_bridge()
                user_id = UUID(user["user_id"])

                # Get enhanced user info with roles
                enhanced_info = await bridge.get_enhanced_user_info(user_id)

                if enhanced_info:
                    user["roles"] = enhanced_info.get("roles", [])
                    user["permissions"] = enhanced_info.get("permissions", [])
                    user["effective_roles"] = enhanced_info.get("effective_roles", [])
            except Exception as e:
                print(f"🔧 Could not fetch roles for user: {e}")

    return user