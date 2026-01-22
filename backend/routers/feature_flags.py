"""
Feature flag management endpoints for admin interface
"""

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from typing import List, Optional
import asyncio

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from models.feature_flags import (
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagResponse,
    FeatureFlagCheck,
    FeatureFlagCheckResponse,
    FeatureFlagStatus
)
from services.feature_flag_service import FeatureFlagService

router = APIRouter(prefix="/api/admin/feature-flags", tags=["feature-flags"])

# Initialize service
feature_flag_service = None
if supabase:
    feature_flag_service = FeatureFlagService(supabase)


@router.post("", response_model=FeatureFlagResponse, status_code=201)
async def create_feature_flag(
    flag_data: FeatureFlagCreate,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """
    Create a new feature flag.
    
    This endpoint allows administrators to create feature flags for gradual
    rollout and user-based access control.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        flag = await asyncio.to_thread(
            feature_flag_service.create_feature_flag,
            flag_data,
            user_id
        )
        
        return flag
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create feature flag: {str(e)}"
        )


@router.get("", response_model=List[FeatureFlagResponse])
async def list_feature_flags(
    status: Optional[FeatureFlagStatus] = None,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """
    List all feature flags, optionally filtered by status.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        flags = await asyncio.to_thread(
            feature_flag_service.list_feature_flags,
            status
        )
        
        return flags
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list feature flags: {str(e)}"
        )


@router.get("/{flag_id}", response_model=FeatureFlagResponse)
async def get_feature_flag(
    flag_id: UUID,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """
    Get a specific feature flag by ID.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        flag = await asyncio.to_thread(
            feature_flag_service.get_feature_flag,
            flag_id
        )
        
        if not flag:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        
        return flag
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get feature flag: {str(e)}"
        )


@router.put("/{flag_id}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    flag_id: UUID,
    flag_data: FeatureFlagUpdate,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """
    Update an existing feature flag.
    
    This endpoint allows administrators to modify feature flag configuration,
    including status, rollout strategy, and access controls.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        flag = await asyncio.to_thread(
            feature_flag_service.update_feature_flag,
            flag_id,
            flag_data
        )
        
        return flag
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update feature flag: {str(e)}"
        )


@router.delete("/{flag_id}", status_code=204)
async def delete_feature_flag(
    flag_id: UUID,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """
    Delete a feature flag.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        success = await asyncio.to_thread(
            feature_flag_service.delete_feature_flag,
            flag_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete feature flag: {str(e)}"
        )


@router.post("/check", response_model=FeatureFlagCheckResponse)
async def check_feature_enabled(
    check_data: FeatureFlagCheck,
    current_user = Depends(get_current_user)
):
    """
    Check if a feature is enabled for the current user.
    
    This endpoint allows any authenticated user to check if they have access
    to a specific feature based on the feature flag configuration.
    
    **Requirements**: 10.6
    """
    try:
        if not feature_flag_service:
            raise HTTPException(
                status_code=503,
                detail="Feature flag service unavailable"
            )
        
        # Use current user's ID if not provided
        user_id = check_data.user_id or UUID(current_user.get("user_id"))
        
        # Get user roles from current_user
        user_roles = check_data.user_roles or current_user.get("roles", [])
        
        result = await asyncio.to_thread(
            feature_flag_service.check_feature_enabled,
            check_data.feature_name,
            user_id,
            user_roles
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check feature flag: {str(e)}"
        )
