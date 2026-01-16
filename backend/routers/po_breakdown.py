"""
PO Breakdown Management endpoints for Roche Construction PPM Features
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from uuid import UUID
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from models.roche_construction import (
    POBreakdownCreate,
    POBreakdownUpdate,
    POBreakdown,
    ImportConfig,
    ImportResult,
    POBreakdownSummary,
    POBreakdownType
)
from services.roche_construction_services import POBreakdownService

router = APIRouter(prefix="/pos/breakdown", tags=["po-breakdown"])

# Initialize service
po_breakdown_service = None
if supabase:
    po_breakdown_service = POBreakdownService(supabase)


@router.post("/import", response_model=ImportResult, status_code=201)
async def import_sap_csv(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    column_mappings: str = Form(...),
    default_breakdown_type: str = Form("sap_standard"),
    default_currency: str = Form("USD"),
    skip_validation_errors: bool = Form(False),
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Import SAP PO breakdown data from CSV file.
    
    This endpoint parses CSV files with hierarchical PO structures,
    validates data integrity, and creates breakdown records in the database.
    
    **Requirements**: 5.1, 5.2, 5.5
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", project_id
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Read CSV file
        csv_content = await file.read()
        csv_data = csv_content.decode('utf-8')
        
        # Parse column mappings from JSON string
        try:
            mappings = json.loads(column_mappings)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid column_mappings format - must be valid JSON"
            )
        
        # Build import configuration
        import_config = {
            'column_mappings': mappings,
            'default_breakdown_type': default_breakdown_type,
            'default_currency': default_currency,
            'skip_validation_errors': skip_validation_errors,
            'delimiter': ',',
            'encoding': 'utf-8',
            'has_header': True
        }
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Import CSV data
        result = await po_breakdown_service.import_sap_csv(
            csv_data=csv_data,
            project_id=UUID(project_id),
            import_config=import_config,
            user_id=user_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import CSV: {str(e)}"
        )


@router.post("", response_model=POBreakdown, status_code=201)
async def create_custom_breakdown(
    breakdown_data: POBreakdownCreate,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Create a custom PO breakdown structure.
    
    This endpoint allows manual creation of PO breakdown items with
    custom hierarchical relationships and cost allocations.
    
    **Requirements**: 5.1, 5.3
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", str(breakdown_data.project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify parent breakdown exists if specified
        if breakdown_data.parent_breakdown_id:
            parent_result = supabase.table("po_breakdowns").select("id, hierarchy_level").eq(
                "id", str(breakdown_data.parent_breakdown_id)
            ).execute()
            
            if not parent_result.data:
                raise HTTPException(status_code=404, detail="Parent breakdown not found")
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Create breakdown
        result = await po_breakdown_service.create_custom_breakdown(
            project_id=breakdown_data.project_id,
            breakdown_data=breakdown_data.model_dump(),
            user_id=user_id
        )
        
        # Calculate remaining amount
        result['remaining_amount'] = float(result['planned_amount']) - float(result['actual_amount'])
        
        return POBreakdown(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create breakdown: {str(e)}"
        )


@router.get("/{breakdown_id}", response_model=POBreakdown)
async def get_breakdown(
    breakdown_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get a specific PO breakdown by ID.
    
    This endpoint retrieves detailed information about a single
    PO breakdown item including its hierarchical position and cost data.
    
    **Requirements**: 5.3
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        result = await po_breakdown_service.get_breakdown_by_id(breakdown_id)
        
        # Calculate remaining amount
        result['remaining_amount'] = float(result['planned_amount']) - float(result['actual_amount'])
        
        return POBreakdown(**result)
        
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="PO breakdown not found")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve breakdown: {str(e)}"
        )


@router.put("/{breakdown_id}", response_model=POBreakdown)
async def update_breakdown(
    breakdown_id: UUID,
    updates: POBreakdownUpdate,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Update a PO breakdown structure.
    
    This endpoint allows modification of breakdown properties including
    cost amounts, categorization, and custom fields. Version control
    is maintained automatically.
    
    **Requirements**: 5.3, 5.6
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Verify breakdown exists
        try:
            existing = await po_breakdown_service.get_breakdown_by_id(breakdown_id)
        except Exception:
            raise HTTPException(status_code=404, detail="PO breakdown not found")
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Update breakdown
        result = await po_breakdown_service.update_breakdown_structure(
            breakdown_id=breakdown_id,
            updates=updates.model_dump(exclude_none=True),
            user_id=user_id
        )
        
        # Calculate remaining amount
        result['remaining_amount'] = float(result['planned_amount']) - float(result['actual_amount'])
        
        return POBreakdown(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update breakdown: {str(e)}"
        )


@router.delete("/{breakdown_id}", status_code=204)
async def delete_breakdown(
    breakdown_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Delete (soft delete) a PO breakdown.
    
    This endpoint marks a breakdown as inactive. Breakdowns with
    active children cannot be deleted.
    
    **Requirements**: 5.3
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Delete breakdown
        success = await po_breakdown_service.delete_breakdown(
            breakdown_id=breakdown_id,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete breakdown - may have active children"
            )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete breakdown: {str(e)}"
        )


@router.get("/projects/{project_id}/po-breakdowns", response_model=List[POBreakdown])
async def list_project_breakdowns(
    project_id: UUID,
    parent_id: Optional[UUID] = None,
    search: Optional[str] = None,
    breakdown_type: Optional[POBreakdownType] = None,
    cost_center: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    use_optimized_query: bool = True,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    List all PO breakdowns for a project with optional filtering and pagination.
    
    This endpoint returns the breakdown hierarchy for a project with optional
    search and filtering capabilities. Uses optimized database functions for
    better performance with large datasets.
    
    **Requirements**: 5.6, 8.2, 8.4
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Use optimized paginated query if no filters and flag is set
        if use_optimized_query and not search and not breakdown_type and not cost_center:
            # Call optimized database function
            result = supabase.rpc(
                'get_po_breakdown_hierarchy_paginated',
                {
                    'proj_id': str(project_id),
                    'parent_id': str(parent_id) if parent_id else None,
                    'page_size': limit,
                    'page_offset': offset
                }
            ).execute()
            
            breakdowns = []
            for row in result.data:
                breakdowns.append(POBreakdown(**row))
            
            return breakdowns
        
        # Fall back to service method for filtered queries
        if search or breakdown_type or cost_center:
            results = await po_breakdown_service.search_breakdowns(
                project_id=project_id,
                search_query=search,
                breakdown_type=breakdown_type.value if breakdown_type else None,
                cost_center=cost_center,
                limit=limit,
                offset=offset
            )
        else:
            results = await po_breakdown_service.get_breakdown_hierarchy(project_id)
            # Apply pagination manually
            results = results[offset:offset + limit]
        
        # Calculate remaining amounts
        breakdowns = []
        for result in results:
            result['remaining_amount'] = float(result['planned_amount']) - float(result['actual_amount'])
            breakdowns.append(POBreakdown(**result))
        
        return breakdowns
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve breakdowns: {str(e)}"
        )


@router.get("/projects/{project_id}/summary", response_model=POBreakdownSummary)
async def get_breakdown_summary(
    project_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get summary statistics for project PO breakdowns.
    
    This endpoint provides aggregated cost data and hierarchy information
    for all breakdowns in a project.
    
    **Requirements**: 5.6
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Verify project exists and user has access
        project_result = supabase.table("projects").select("id").eq(
            "id", str(project_id)
        ).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get summary
        summary = await po_breakdown_service.get_breakdown_summary(project_id)
        
        return POBreakdownSummary(**summary)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve summary: {str(e)}"
        )
