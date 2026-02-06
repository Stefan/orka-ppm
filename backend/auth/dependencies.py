"""
Authentication dependencies for FastAPI endpoints

This module provides authentication dependencies that integrate with the
SupabaseRBACBridge for enhanced JWT token handling with role information.
JWT signature is verified when SUPABASE_JWT_SECRET is set.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from config.settings import settings

# Security scheme
security = HTTPBearer(auto_error=False)

def _allow_dev_default_user() -> bool:
    """Only allow unauthenticated default admin when explicitly enabled (e.g. local dev)."""
    return settings.ALLOW_DEV_DEFAULT_USER and settings.environment == "development"

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Extract user from JWT token. Verifies signature when SUPABASE_JWT_SECRET is set.
    Default admin fallback only when ALLOW_DEV_DEFAULT_USER=true and environment is development.
    """
    if not credentials:
        if _allow_dev_default_user():
            default_user_id = "00000000-0000-0000-0000-000000000001"
            print("🔧 Development mode: No credentials provided, using default admin user (ALLOW_DEV_DEFAULT_USER=true)")
            return {
                "user_id": default_user_id,
                "email": "dev@example.com",
                "tenant_id": default_user_id,
                "role": "admin",
                "roles": ["admin"],
                "permissions": ["user_manage"],
            }
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")

    token = credentials.credentials
    secret_key = settings.SUPABASE_JWT_SECRET if settings.SUPABASE_JWT_SECRET else None

    try:
        try:
            from .supabase_rbac_bridge import get_supabase_rbac_bridge
            bridge = get_supabase_rbac_bridge()
            user_info = await bridge.get_user_from_jwt(token, secret_key=secret_key)
            if user_info:
                user_id = user_info.get("user_id")
                return {
                    "user_id": user_id,
                    "email": user_info.get("email", "dev@example.com"),
                    "roles": user_info.get("roles", []),
                    "permissions": user_info.get("permissions", []),
                    "effective_roles": user_info.get("effective_roles", []),
                    "tenant_id": user_info.get("tenant_id") or user_id,
                }
        except ImportError:
            pass
        except Exception as bridge_error:
            if secret_key:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
            print(f"🔧 Bridge error: {bridge_error}, falling back to basic decode")

        # Fallback: verify with secret if set, otherwise decode only (legacy)
        if secret_key:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        else:
            payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        if not user_id or user_id == "anon":
            if _allow_dev_default_user():
                user_id = "00000000-0000-0000-0000-000000000001"
                print(f"🔧 Development mode: Using default user ID {user_id}")
            else:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        return {
            "user_id": user_id,
            "email": payload.get("email", "dev@example.com"),
            "roles": payload.get("roles", []),
            "permissions": payload.get("permissions", []),
            "tenant_id": payload.get("tenant_id") or payload.get("app_metadata", {}).get("tenant_id") or user_id,
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        if _allow_dev_default_user():
            default_user_id = "00000000-0000-0000-0000-000000000001"
            print(f"🔧 Development mode: Auth error ({e}), using default admin user")
            return {
                "user_id": default_user_id,
                "email": "dev@example.com",
                "tenant_id": default_user_id,
                "role": "admin",
                "roles": ["admin"],
                "permissions": ["user_manage"],
            }
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