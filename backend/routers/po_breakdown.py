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
from services.po_breakdown_export_service import POBreakdownExportService
from services.po_breakdown_scheduled_export_service import (
    POBreakdownScheduledExportService,
    ExportCustomizationService
)

router = APIRouter(prefix="/pos/breakdown", tags=["po-breakdown"])

# Initialize services
po_breakdown_service = None
export_service = None
scheduled_export_service = None
customization_service = None

if supabase:
    po_breakdown_service = POBreakdownService(supabase)
    export_service = POBreakdownExportService(supabase)
    scheduled_export_service = POBreakdownScheduledExportService(supabase)
    customization_service = ExportCustomizationService(supabase)


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


# ============================================================================
# Hierarchy Visualization and Manipulation Endpoints (Task 12.1)
# ============================================================================

@router.get("/projects/{project_id}/hierarchy")
async def get_hierarchy_tree(
    project_id: UUID,
    root_id: Optional[UUID] = None,
    max_depth: Optional[int] = None,
    include_inactive: bool = False,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get hierarchical tree structure of PO breakdowns.
    
    This endpoint returns the complete hierarchy tree with parent-child
    relationships, supporting expandable tree views in the frontend.
    
    **Requirements**: 2.1, 2.2, 2.3, 2.4
    **Validates**: Hierarchical structure visualization with proper relationships
    
    Args:
        project_id: Project UUID
        root_id: Optional root breakdown ID to start from (None = all roots)
        max_depth: Maximum depth to traverse (None = unlimited)
        include_inactive: Whether to include soft-deleted items
    
    Returns:
        Hierarchical tree structure with nested children
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
        
        # Get hierarchy tree
        hierarchy = await po_breakdown_service.get_hierarchy_tree(
            project_id=project_id,
            root_id=root_id,
            max_depth=max_depth,
            include_inactive=include_inactive
        )
        
        return {
            "project_id": str(project_id),
            "root_id": str(root_id) if root_id else None,
            "max_depth": max_depth,
            "hierarchy": hierarchy,
            "total_items": len(hierarchy) if isinstance(hierarchy, list) else 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve hierarchy: {str(e)}"
        )


@router.post("/{breakdown_id}/move")
async def move_breakdown_item(
    breakdown_id: UUID,
    new_parent_id: Optional[UUID] = None,
    new_position: Optional[int] = None,
    validate_only: bool = False,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Move a PO breakdown item to a new parent or position in hierarchy.
    
    This endpoint supports drag-and-drop reordering by allowing items to be
    moved to different parents or reordered within the same parent.
    
    **Requirements**: 2.2, 2.3, 2.4
    **Validates**: Hierarchy integrity during moves, circular reference prevention,
                   automatic parent total recalculation
    
    Args:
        breakdown_id: UUID of the item to move
        new_parent_id: UUID of the new parent (None = move to root level)
        new_position: Position within siblings (None = append to end)
        validate_only: If True, only validate the move without executing
    
    Returns:
        Move result with validation status and updated hierarchy
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Validate and execute move
        result = await po_breakdown_service.move_breakdown_item(
            breakdown_id=breakdown_id,
            new_parent_id=new_parent_id,
            new_position=new_position,
            user_id=user_id,
            validate_only=validate_only
        )
        
        return {
            "breakdown_id": str(breakdown_id),
            "new_parent_id": str(new_parent_id) if new_parent_id else None,
            "new_position": new_position,
            "validation_passed": result.get('validation_passed', True),
            "validation_errors": result.get('validation_errors', []),
            "updated_breakdown": result.get('updated_breakdown'),
            "affected_parents": result.get('affected_parents', []),
            "message": "Move validated successfully" if validate_only else "Item moved successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to move breakdown item: {str(e)}"
        )


@router.post("/{breakdown_id}/reorder")
async def reorder_children(
    breakdown_id: UUID,
    child_order: List[UUID],
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Reorder children of a PO breakdown item.
    
    This endpoint allows explicit ordering of child items, useful for
    custom structure organization beyond alphabetical or hierarchical ordering.
    
    **Requirements**: 2.4, 4.2
    **Validates**: Custom hierarchy operations with drag-and-drop support
    
    Args:
        breakdown_id: UUID of the parent item
        child_order: Ordered list of child UUIDs in desired sequence
    
    Returns:
        Reorder result with updated children
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Reorder children
        result = await po_breakdown_service.reorder_children(
            parent_id=breakdown_id,
            child_order=child_order,
            user_id=user_id
        )
        
        return {
            "parent_id": str(breakdown_id),
            "child_count": len(child_order),
            "reordered_children": result.get('children', []),
            "message": "Children reordered successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reorder children: {str(e)}"
        )


@router.get("/{breakdown_id}/path")
async def get_hierarchy_path(
    breakdown_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get the full hierarchy path from root to a specific breakdown item.
    
    This endpoint returns the breadcrumb trail showing all ancestors
    of a breakdown item, useful for navigation and context display.
    
    **Requirements**: 2.1, 2.2
    **Validates**: Hierarchy path traversal and relationship integrity
    
    Args:
        breakdown_id: UUID of the breakdown item
    
    Returns:
        Ordered list of ancestors from root to the specified item
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get hierarchy path
        path = await po_breakdown_service.get_hierarchy_path(breakdown_id)
        
        return {
            "breakdown_id": str(breakdown_id),
            "path": path,
            "depth": len(path),
            "root_id": path[0]['id'] if path else None
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve hierarchy path: {str(e)}"
        )


@router.post("/{breakdown_id}/validate-move")
async def validate_hierarchy_move(
    breakdown_id: UUID,
    new_parent_id: Optional[UUID] = None,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Validate a potential hierarchy move without executing it.
    
    This endpoint checks for circular references, depth limits, and other
    hierarchy constraints before allowing a move operation.
    
    **Requirements**: 2.2, 2.3
    **Validates**: Circular reference prevention and hierarchy integrity validation
    
    Args:
        breakdown_id: UUID of the item to move
        new_parent_id: UUID of the potential new parent
    
    Returns:
        Validation result with any errors or warnings
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Validate move
        validation = await po_breakdown_service.validate_hierarchy_move(
            breakdown_id=breakdown_id,
            new_parent_id=new_parent_id
        )
        
        return {
            "breakdown_id": str(breakdown_id),
            "new_parent_id": str(new_parent_id) if new_parent_id else None,
            "is_valid": validation.get('is_valid', False),
            "errors": validation.get('errors', []),
            "warnings": validation.get('warnings', []),
            "would_create_circular_reference": validation.get('circular_reference', False),
            "would_exceed_max_depth": validation.get('exceeds_max_depth', False),
            "new_hierarchy_level": validation.get('new_hierarchy_level')
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate move: {str(e)}"
        )



# ============================================================================
# Variance Analysis and Financial Summary Endpoints (Task 12.3)
# ============================================================================

@router.get("/projects/{project_id}/variance-analysis")
async def get_project_variance_analysis(
    project_id: UUID,
    include_trends: bool = True,
    include_outliers: bool = True,
    outlier_threshold: float = 15.0,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get comprehensive variance analysis for a project.
    
    This endpoint provides detailed variance calculations including
    overall project variance, category breakdowns, and trend analysis.
    
    **Requirements**: 5.1, 5.2
    **Validates**: Comprehensive variance calculation with all cost sources
    
    Args:
        project_id: Project UUID
        include_trends: Whether to include variance trend analysis
        include_outliers: Whether to identify variance outliers
        outlier_threshold: Percentage threshold for outlier identification
    
    Returns:
        Comprehensive variance analysis with trends and outliers
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
        
        # Get variance analysis
        analysis = await po_breakdown_service.get_project_variance_analysis(
            project_id=project_id,
            include_trends=include_trends,
            include_outliers=include_outliers,
            outlier_threshold=outlier_threshold
        )
        
        return {
            "project_id": str(project_id),
            "analysis": analysis,
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve variance analysis: {str(e)}"
        )


@router.get("/{breakdown_id}/variance")
async def get_breakdown_variance(
    breakdown_id: UUID,
    include_children: bool = False,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get detailed variance information for a specific breakdown item.
    
    This endpoint provides variance calculations, status, and trend
    information for a single PO breakdown item.
    
    **Requirements**: 5.1, 5.2
    **Validates**: Item-level variance calculation accuracy
    
    Args:
        breakdown_id: Breakdown UUID
        include_children: Whether to include aggregated child variances
    
    Returns:
        Detailed variance data for the breakdown item
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get variance data
        variance = await po_breakdown_service.get_breakdown_variance(
            breakdown_id=breakdown_id,
            include_children=include_children
        )
        
        return {
            "breakdown_id": str(breakdown_id),
            "variance": variance,
            "calculated_at": datetime.now().isoformat()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve variance: {str(e)}"
        )


@router.get("/projects/{project_id}/variance-alerts")
async def get_variance_alerts(
    project_id: UUID,
    severity: Optional[str] = None,
    alert_type: Optional[str] = None,
    active_only: bool = True,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get variance alerts for a project.
    
    This endpoint returns all variance alerts including budget overruns,
    commitment exceedances, and trend deteriorations.
    
    **Requirements**: 5.2
    **Validates**: Budget alert monitoring and threshold detection
    
    Args:
        project_id: Project UUID
        severity: Filter by severity (low, medium, high, critical)
        alert_type: Filter by alert type
        active_only: Whether to include only active alerts
    
    Returns:
        List of variance alerts with details
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get alerts
        alerts = await po_breakdown_service.get_variance_alerts(
            project_id=project_id,
            severity=severity,
            alert_type=alert_type,
            active_only=active_only
        )
        
        return {
            "project_id": str(project_id),
            "alerts": alerts,
            "total_alerts": len(alerts),
            "critical_count": sum(1 for a in alerts if a.get('severity') == 'critical'),
            "high_count": sum(1 for a in alerts if a.get('severity') == 'high')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve variance alerts: {str(e)}"
        )


@router.post("/projects/{project_id}/recalculate-variance")
async def recalculate_project_variance(
    project_id: UUID,
    force_full_recalculation: bool = False,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Trigger manual variance recalculation for a project.
    
    This endpoint manually triggers the variance recalculation process,
    useful for ensuring data consistency after bulk updates.
    
    **Requirements**: 5.3
    **Validates**: Project-level variance recalculation triggers
    
    Args:
        project_id: Project UUID
        force_full_recalculation: Force recalculation of all items
    
    Returns:
        Recalculation result with updated variance data
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Trigger recalculation
        result = await po_breakdown_service.recalculate_project_variance(
            project_id=project_id,
            force_full=force_full_recalculation,
            user_id=user_id
        )
        
        return {
            "project_id": str(project_id),
            "recalculation_result": result,
            "items_updated": result.get('items_updated', 0),
            "alerts_generated": result.get('alerts_generated', 0),
            "completed_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to recalculate variance: {str(e)}"
        )


# ============================================================================
# Change Request Integration Endpoints (Task 7.3)
# ============================================================================

@router.post("/{breakdown_id}/link-change-request", status_code=201)
async def link_to_change_request(
    breakdown_id: UUID,
    change_request_id: UUID,
    impact_type: str,
    impact_amount: Optional[float] = None,
    impact_percentage: Optional[float] = None,
    description: Optional[str] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Link a PO breakdown item to a change request.
    
    This endpoint creates a link between a PO breakdown and a change request,
    and automatically updates the change request's financial impact assessment.
    
    **Requirements**: 5.5
    **Validates**: Requirement 5.5 - Change request integration with automatic financial impact updates
    
    Args:
        breakdown_id: UUID of the PO breakdown item
        change_request_id: UUID of the change request
        impact_type: Type of impact (cost_increase, cost_decrease, scope_change, reallocation, new_po, po_cancellation)
        impact_amount: Financial impact amount (optional)
        impact_percentage: Impact as percentage (optional)
        description: Description of the impact (optional)
    
    Returns:
        Link details including IDs, impact information, and timestamps
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        from decimal import Decimal
        
        # Convert float amounts to Decimal
        impact_amount_decimal = Decimal(str(impact_amount)) if impact_amount is not None else None
        impact_percentage_decimal = Decimal(str(impact_percentage)) if impact_percentage is not None else None
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Create the link
        link = await po_breakdown_service.link_to_change_request(
            breakdown_id=breakdown_id,
            change_request_id=change_request_id,
            impact_type=impact_type,
            impact_amount=impact_amount_decimal,
            impact_percentage=impact_percentage_decimal,
            description=description,
            user_id=user_id
        )
        
        return {
            "link_id": link['link_id'],
            "breakdown_id": link['breakdown_id'],
            "breakdown_name": link['breakdown_name'],
            "change_request_id": link['change_request_id'],
            "impact_type": link['impact_type'],
            "impact_amount": float(link['impact_amount']),
            "impact_percentage": float(link['impact_percentage']) if link.get('impact_percentage') else None,
            "description": link.get('description'),
            "created_at": link['created_at'],
            "message": "PO breakdown linked to change request and financial impact assessment updated"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to link PO breakdown to change request: {str(e)}"
        )


@router.delete("/{breakdown_id}/link-change-request/{change_request_id}", status_code=204)
async def unlink_from_change_request(
    breakdown_id: UUID,
    change_request_id: UUID,
    impact_type: Optional[str] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Remove link between PO breakdown and change request.
    
    This endpoint removes the link and automatically updates the change request's
    financial impact assessment to reflect the removal.
    
    **Requirements**: 5.5
    **Validates**: Requirement 5.5 - Change request integration with automatic financial impact updates
    
    Args:
        breakdown_id: UUID of the PO breakdown item
        change_request_id: UUID of the change request
        impact_type: Optional specific impact type to unlink
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get user ID
        user_id = UUID(current_user.get("user_id"))
        
        # Remove the link
        success = await po_breakdown_service.unlink_from_change_request(
            breakdown_id=breakdown_id,
            change_request_id=change_request_id,
            impact_type=impact_type,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Link not found between PO breakdown and change request"
            )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to unlink PO breakdown from change request: {str(e)}"
        )


@router.get("/{breakdown_id}/change-requests")
async def get_change_request_links(
    breakdown_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get all change request links for a PO breakdown.
    
    This endpoint retrieves all change requests linked to a specific PO breakdown item,
    including impact details and change request status.
    
    **Requirements**: 5.5
    **Validates**: Requirement 5.5 - Change request integration
    
    Args:
        breakdown_id: UUID of the PO breakdown item
    
    Returns:
        List of change request links with details
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get links
        links = await po_breakdown_service.get_change_request_links(breakdown_id)
        
        # Convert Decimal to float for JSON serialization
        for link in links:
            link['impact_amount'] = float(link['impact_amount'])
            if link.get('impact_percentage'):
                link['impact_percentage'] = float(link['impact_percentage'])
        
        return {
            "breakdown_id": str(breakdown_id),
            "links": links,
            "total_links": len(links)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve change request links: {str(e)}"
        )


@router.get("/change-requests/{change_request_id}/po-breakdowns")
async def get_breakdown_links_for_change_request(
    change_request_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get all PO breakdown links for a change request.
    
    This endpoint retrieves all PO breakdown items linked to a specific change request,
    including financial impact details and current amounts.
    
    **Requirements**: 5.5
    **Validates**: Requirement 5.5 - Change request integration
    
    Args:
        change_request_id: UUID of the change request
    
    Returns:
        List of PO breakdown links with financial details
    """
    try:
        if not po_breakdown_service:
            raise HTTPException(
                status_code=503,
                detail="PO breakdown service unavailable - database not configured"
            )
        
        # Get links
        links = await po_breakdown_service.get_breakdown_links_for_change_request(change_request_id)
        
        # Convert Decimal to float for JSON serialization
        total_impact = 0.0
        for link in links:
            link['planned_amount'] = float(link['planned_amount'])
            link['actual_amount'] = float(link['actual_amount'])
            link['impact_amount'] = float(link['impact_amount'])
            total_impact += link['impact_amount']
            if link.get('impact_percentage'):
                link['impact_percentage'] = float(link['impact_percentage'])
        
        return {
            "change_request_id": str(change_request_id),
            "links": links,
            "total_links": len(links),
            "total_financial_impact": total_impact
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve PO breakdown links: {str(e)}"
        )


# ============================================================================
# Export and Reporting Endpoints
# ============================================================================

@router.get("/projects/{project_id}/export/csv")
async def export_to_csv(
    project_id: UUID,
    breakdown_type: Optional[str] = None,
    cost_center: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_hierarchy: bool = True,
    custom_fields: Optional[str] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """
    Export PO breakdown data to CSV format
    
    **Requirements**: 9.1, 9.2
    """
    try:
        if not export_service:
            raise HTTPException(
                status_code=503,
                detail="Export service unavailable"
            )
        
        # Build filters
        filters = {}
        if breakdown_type:
            filters['breakdown_type'] = breakdown_type
        if cost_center:
            filters['cost_center'] = cost_center
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        # Parse custom fields
        custom_field_list = None
        if custom_fields:
            custom_field_list = [f.strip() for f in custom_fields.split(',')]
        
        # Generate CSV
        csv_data = await export_service.export_to_csv(
            project_id=project_id,
            filters=filters if filters else None,
            include_hierarchy=include_hierarchy,
            custom_fields=custom_field_list
        )
        
        from fastapi.responses import Response
        
        filename = f"po_breakdown_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/export/excel")
async def export_to_excel(
    project_id: UUID,
    breakdown_type: Optional[str] = None,
    cost_center: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_hierarchy: bool = True,
    include_summary: bool = True,
    custom_fields: Optional[str] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """
    Export PO breakdown data to Excel format with formatting
    
    **Requirements**: 9.1, 9.2, 9.3
    """
    try:
        if not export_service:
            raise HTTPException(
                status_code=503,
                detail="Export service unavailable"
            )
        
        # Build filters
        filters = {}
        if breakdown_type:
            filters['breakdown_type'] = breakdown_type
        if cost_center:
            filters['cost_center'] = cost_center
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        # Parse custom fields
        custom_field_list = None
        if custom_fields:
            custom_field_list = [f.strip() for f in custom_fields.split(',')]
        
        # Generate Excel
        excel_data = await export_service.export_to_excel(
            project_id=project_id,
            filters=filters if filters else None,
            include_hierarchy=include_hierarchy,
            include_summary=include_summary,
            custom_fields=custom_field_list
        )
        
        from fastapi.responses import StreamingResponse
        
        filename = f"po_breakdown_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return StreamingResponse(
            excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/export/json")
async def export_to_json(
    project_id: UUID,
    breakdown_type: Optional[str] = None,
    cost_center: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    hierarchical_structure: bool = False,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """
    Export PO breakdown data to JSON format
    
    **Requirements**: 9.1, 9.2
    """
    try:
        if not export_service:
            raise HTTPException(
                status_code=503,
                detail="Export service unavailable"
            )
        
        # Build filters
        filters = {}
        if breakdown_type:
            filters['breakdown_type'] = breakdown_type
        if cost_center:
            filters['cost_center'] = cost_center
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        # Generate JSON
        json_data = await export_service.export_to_json(
            project_id=project_id,
            filters=filters if filters else None,
            hierarchical_structure=hierarchical_structure
        )
        
        from fastapi.responses import Response
        
        filename = f"po_breakdown_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return Response(
            content=json_data,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/financial-summary")
async def get_financial_summary(
    project_id: UUID,
    group_by: Optional[str] = None,
    breakdown_type: Optional[str] = None,
    cost_center: Optional[str] = None,
    category: Optional[str] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """
    Generate financial summary report with aggregations
    
    **Requirements**: 9.3, 9.4
    """
    try:
        if not export_service:
            raise HTTPException(
                status_code=503,
                detail="Export service unavailable"
            )
        
        # Build filters
        filters = {}
        if breakdown_type:
            filters['breakdown_type'] = breakdown_type
        if cost_center:
            filters['cost_center'] = cost_center
        if category:
            filters['category'] = category
        
        # Generate summary
        summary = await export_service.generate_financial_summary(
            project_id=project_id,
            group_by=group_by,
            filters=filters if filters else None
        )
        
        return summary
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Scheduled Export Endpoints
# ============================================================================

@router.post("/scheduled-exports", status_code=201)
async def create_scheduled_export(
    project_id: UUID,
    export_format: str,
    frequency: str,
    email_recipients: List[str],
    filters: Optional[Dict[str, Any]] = None,
    custom_fields: Optional[List[str]] = None,
    include_summary: bool = True,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Create a new scheduled export configuration
    
    **Requirements**: 9.5
    """
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        # Validate format
        if export_format not in ['csv', 'excel', 'json']:
            raise HTTPException(
                status_code=400,
                detail="Invalid export format. Must be csv, excel, or json"
            )
        
        # Validate frequency
        if frequency not in ['hourly', 'daily', 'weekly', 'monthly']:
            raise HTTPException(
                status_code=400,
                detail="Invalid frequency. Must be hourly, daily, weekly, or monthly"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        schedule = await scheduled_export_service.create_scheduled_export(
            project_id=project_id,
            export_format=export_format,
            frequency=frequency,
            email_recipients=email_recipients,
            filters=filters,
            custom_fields=custom_fields,
            include_summary=include_summary,
            user_id=user_id
        )
        
        return schedule
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled-exports/{schedule_id}")
async def get_scheduled_export(
    schedule_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """Get a specific scheduled export configuration"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        schedule = await scheduled_export_service.get_scheduled_export(schedule_id)
        return schedule
    
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/projects/{project_id}/scheduled-exports")
async def list_scheduled_exports(
    project_id: UUID,
    enabled_only: bool = False,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """List scheduled export configurations for a project"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        schedules = await scheduled_export_service.list_scheduled_exports(
            project_id=project_id,
            enabled_only=enabled_only
        )
        
        return schedules
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scheduled-exports/{schedule_id}")
async def update_scheduled_export(
    schedule_id: UUID,
    updates: Dict[str, Any],
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """Update a scheduled export configuration"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        schedule = await scheduled_export_service.update_scheduled_export(
            schedule_id=schedule_id,
            updates=updates
        )
        
        return schedule
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scheduled-exports/{schedule_id}", status_code=204)
async def delete_scheduled_export(
    schedule_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """Delete a scheduled export configuration"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        success = await scheduled_export_service.delete_scheduled_export(schedule_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduled-exports/{schedule_id}/execute")
async def execute_scheduled_export(
    schedule_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """Execute a scheduled export immediately"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        result = await scheduled_export_service.execute_scheduled_export(schedule_id)
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled-exports/{schedule_id}/history")
async def get_export_history(
    schedule_id: UUID,
    limit: int = 50,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """Get export execution history for a schedule"""
    try:
        if not scheduled_export_service:
            raise HTTPException(
                status_code=503,
                detail="Scheduled export service unavailable"
            )
        
        history = await scheduled_export_service.get_export_history(
            schedule_id=schedule_id,
            limit=limit
        )
        
        return history
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Export Customization Endpoints
# ============================================================================

@router.post("/export-templates", status_code=201)
async def save_export_template(
    name: str,
    project_id: UUID,
    export_format: str,
    filters: Dict[str, Any],
    custom_fields: Optional[List[str]] = None,
    column_order: Optional[List[str]] = None,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """
    Save an export template for reuse
    
    **Requirements**: 9.6
    """
    try:
        if not customization_service:
            raise HTTPException(
                status_code=503,
                detail="Customization service unavailable"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        template = await customization_service.save_export_template(
            name=name,
            project_id=project_id,
            export_format=export_format,
            filters=filters,
            custom_fields=custom_fields,
            column_order=column_order,
            user_id=user_id
        )
        
        return template
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export-templates/{template_id}")
async def get_export_template(
    template_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """Get a specific export template"""
    try:
        if not customization_service:
            raise HTTPException(
                status_code=503,
                detail="Customization service unavailable"
            )
        
        template = await customization_service.get_export_template(template_id)
        return template
    
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/projects/{project_id}/export-templates")
async def list_export_templates(
    project_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_read))
):
    """List available export templates for a project"""
    try:
        if not customization_service:
            raise HTTPException(
                status_code=503,
                detail="Customization service unavailable"
            )
        
        user_id = UUID(current_user.get("user_id"))
        
        templates = await customization_service.list_export_templates(
            project_id=project_id,
            user_id=user_id
        )
        
        return templates
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/export-templates/{template_id}", status_code=204)
async def delete_export_template(
    template_id: UUID,
    current_user = Depends(require_permission(Permission.po_breakdown_update))
):
    """Delete an export template"""
    try:
        if not customization_service:
            raise HTTPException(
                status_code=503,
                detail="Customization service unavailable"
            )
        
        success = await customization_service.delete_export_template(template_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Export template not found")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
