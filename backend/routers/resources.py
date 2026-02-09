"""
Resource management endpoints
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, Query
from uuid import UUID
from typing import List, Dict, Any, Optional

from auth.rbac import require_permission, Permission
from config.database import supabase, service_supabase

logger = logging.getLogger(__name__)
from models.resources import (
    ResourceCreate, ResourceResponse, ResourceUpdate,
    ResourceSearchRequest, ResourceAllocationSuggestion
)
from utils.converters import convert_uuids
from utils.resource_calculations import (
    calculate_enhanced_resource_availability,
    calculate_advanced_skill_match_score
)

router = APIRouter(prefix="/resources", tags=["resources"])

# Use service role when available so RLS does not block (backend already enforces resource_* permissions).
_db = service_supabase if service_supabase is not None else supabase


def _log_resource_audit(
    event_type: str,
    entity_id: str,
    current_user: Dict[str, Any],
    action_details: Dict[str, Any],
    severity: str = "info",
) -> None:
    """Write resource event to audit_logs for audit trail. Failures are logged but do not break the request."""
    if _db is None:
        return
    user_id = current_user.get("user_id") or current_user.get("id")
    tenant_id = (
        current_user.get("tenant_id")
        or current_user.get("organization_id")
        or user_id
    )
    # Map event_type to 040 action (CHECK: CREATE, UPDATE, DELETE, EXPORT, LOGIN, LOGIN_FAILED)
    action_map = {"resource_created": "CREATE", "resource_updated": "UPDATE", "resource_deleted": "DELETE"}
    action = action_map.get(event_type, "CREATE")
    occurred_at = datetime.utcnow().isoformat().replace("+00:00", "") + "Z"
    audit_event = {
        "table_name": "resources",  # 001 NOT NULL
        "record_id": entity_id,  # 001 NOT NULL
        "action": action,  # 001 + 040 NOT NULL
        "entity": "resource",  # 040 NOT NULL
        "occurred_at": occurred_at,  # 040 NOT NULL
        "event_type": event_type,
        "entity_type": "resource",
        "entity_id": entity_id,
        "action_details": action_details if isinstance(action_details, dict) else {"raw": str(action_details)},
        "severity": severity,
        "timestamp": occurred_at,
        "category": "Resource Allocation",
    }
    # 040 requires user_id NOT NULL; avoid placeholder UUID so it doesn't appear as "Top-Benutzer"
    _placeholder_ids = ("00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000001")
    _uid = user_id if (user_id and str(user_id) not in _placeholder_ids) else tenant_id
    if not _uid:
        logger.debug("Skipping audit insert: no user_id/tenant_id (resource event %s)", event_type)
        return
    audit_event["user_id"] = str(_uid)
    if tenant_id:
        audit_event["tenant_id"] = str(tenant_id)
    try:
        _db.table("audit_logs").insert(audit_event).execute()
    except Exception as e:
        logger.warning(
            "Audit log write failed (%s): %s (user_id=%s, tenant_id=%s)",
            event_type,
            e,
            user_id,
            tenant_id,
            exc_info=True,
        )


@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    resource: ResourceCreate,
    current_user = Depends(require_permission(Permission.resource_create))
):
    """Create a new resource"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        # Payload for insert: only columns that exist on resources table (no skills if column missing)
        resource_data = resource.dict()
        insert_payload = {
            "name": resource_data["name"],
            "email": resource_data["email"],
            "role": resource_data.get("role") or "",
            "capacity": resource_data.get("capacity", 40),
            "availability": resource_data.get("availability", 100),
            "hourly_rate": resource_data.get("hourly_rate"),
            "location": resource_data.get("location"),
        }
        response = _db.table("resources").insert(insert_payload).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create resource")

        created_resource = dict(response.data[0])

        # Calculate availability metrics
        availability_metrics = calculate_enhanced_resource_availability(created_resource)
        created_resource.update(availability_metrics)

        # Ensure response matches ResourceResponse: required types and defaults
        now_iso = datetime.utcnow().isoformat() + "Z"
        created_resource.setdefault("created_at", now_iso)
        created_resource.setdefault("updated_at", now_iso)
        created_resource["role"] = created_resource.get("role") or ""
        created_resource["skills"] = created_resource.get("skills") if isinstance(created_resource.get("skills"), list) else (resource_data.get("skills") or [])
        created_resource["current_projects"] = created_resource.get("current_projects") if isinstance(created_resource.get("current_projects"), list) else []

        # Audit trail: resource created
        _log_resource_audit(
            event_type="resource_created",
            entity_id=str(created_resource.get("id", "")),
            current_user=current_user,
            action_details={
                "name": created_resource.get("name"),
                "email": created_resource.get("email"),
                "role": created_resource.get("role"),
            },
        )

        try:
            return convert_uuids(created_resource)
        except Exception as serialize_error:
            print(f"Create resource response serialize error: {serialize_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Resource created but response invalid: {str(serialize_error)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Create resource error: {e}")
        err_str = str(e).lower()
        err_code = getattr(e, "code", None) or ""
        if "23505" in err_str or "23505" in str(err_code) or "duplicate key" in err_str or "unique constraint" in err_str:
            raise HTTPException(
                status_code=409,
                detail="A resource with this email address already exists.",
            )
        raise HTTPException(status_code=400, detail=f"Failed to create resource: {str(e)}")

@router.get("/")
async def list_resources(
    portfolio_id: Optional[UUID] = Query(None, description="Filter to resources assigned to projects in this portfolio"),
    current_user=Depends(require_permission(Permission.resource_read)),
):
    """Get all resources with utilization data. Optional portfolio_id filters to resources in that portfolio's projects."""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        resources_response = _db.table("resources").select("*").execute()
        resources = convert_uuids(resources_response.data or [])
        if portfolio_id is not None and resources:
            proj_response = _db.table("projects").select("id").eq("portfolio_id", str(portfolio_id)).execute()
            portfolio_project_ids = {str(r["id"]) for r in (proj_response.data or [])}
            if not portfolio_project_ids:
                resources = []
            else:
                def in_portfolio(r):
                    cp = r.get("current_projects") or []
                    if isinstance(cp, list):
                        return any(pid in portfolio_project_ids for pid in [str(x) for x in cp])
                    return False
                resources = [r for r in resources if in_portfolio(r)]
        # If no resources exist, return mock data for development (unless filtering by portfolio)
        if not resources:
            if portfolio_id is not None:
                return []
            mock_resources = [
                {
                    "id": "1",
                    "name": "Alice Johnson",
                    "email": "alice.johnson@company.com",
                    "role": "Senior Developer",
                    "capacity": 40,
                    "availability": 80,
                    "hourly_rate": 85,
                    "skills": ["React", "TypeScript", "Node.js", "Python"],
                    "location": "New York",
                    "current_projects": ["proj-1", "proj-2"],
                    "utilization_percentage": 80.0,
                    "available_hours": 8.0,
                    "allocated_hours": 32.0,
                    "capacity_hours": 40.0,
                    "availability_status": "mostly_allocated",
                    "can_take_more_work": True,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "2",
                    "name": "Bob Smith",
                    "email": "bob.smith@company.com",
                    "role": "Project Manager",
                    "capacity": 40,
                    "availability": 100,
                    "hourly_rate": 95,
                    "skills": ["Project Management", "Agile", "Scrum", "Leadership"],
                    "location": "San Francisco",
                    "current_projects": ["proj-1"],
                    "utilization_percentage": 100.0,
                    "available_hours": 0.0,
                    "allocated_hours": 40.0,
                    "capacity_hours": 40.0,
                    "availability_status": "fully_allocated",
                    "can_take_more_work": False,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "3",
                    "name": "Carol Davis",
                    "email": "carol.davis@company.com",
                    "role": "UX Designer",
                    "capacity": 40,
                    "availability": 50,
                    "hourly_rate": 75,
                    "skills": ["UI/UX Design", "Figma", "Adobe Creative Suite", "User Research"],
                    "location": "Remote",
                    "current_projects": ["proj-2", "proj-3"],
                    "utilization_percentage": 50.0,
                    "available_hours": 20.0,
                    "allocated_hours": 20.0,
                    "capacity_hours": 40.0,
                    "availability_status": "partially_allocated",
                    "can_take_more_work": True,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "4",
                    "name": "David Wilson",
                    "email": "david.wilson@company.com",
                    "role": "DevOps Engineer",
                    "capacity": 40,
                    "availability": 100,
                    "hourly_rate": 90,
                    "skills": ["AWS", "Docker", "Kubernetes", "CI/CD", "Terraform"],
                    "location": "Austin",
                    "current_projects": ["proj-1", "proj-2", "proj-3"],
                    "utilization_percentage": 112.5,
                    "available_hours": -5.0,
                    "allocated_hours": 45.0,
                    "capacity_hours": 40.0,
                    "availability_status": "fully_allocated",
                    "can_take_more_work": False,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ]
            return mock_resources

        enhanced_resources = []
        for resource in resources:
            availability_metrics = calculate_enhanced_resource_availability(resource)
            resource.update(availability_metrics)
            enhanced_resources.append(resource)
        return enhanced_resources
        
    except Exception as e:
        print(f"Resources error: {e}")
        raise HTTPException(status_code=500, detail=f"Resources data retrieval failed: {str(e)}")

@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: UUID, 
    current_user = Depends(require_permission(Permission.resource_read))
):
    """Get a specific resource by ID"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        response = _db.table("resources").select("*").eq("id", str(resource_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        resource = convert_uuids(response.data[0])
        
        # Calculate availability metrics
        availability_metrics = calculate_enhanced_resource_availability(resource)
        resource.update(availability_metrics)
        
        return resource
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get resource error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get resource: {str(e)}")

@router.put("/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    resource_id: UUID, 
    resource_update: ResourceUpdate, 
    current_user = Depends(require_permission(Permission.resource_update))
):
    """Update a resource"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        update_data = {k: v for k, v in resource_update.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = _db.table("resources").update(update_data).eq("id", str(resource_id)).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Resource not found")

        updated_resource = dict(convert_uuids(response.data[0]))

        # Calculate availability metrics
        availability_metrics = calculate_enhanced_resource_availability(updated_resource)
        updated_resource.update(availability_metrics)

        # Ensure response matches ResourceResponse (types and required fields)
        now_iso = datetime.utcnow().isoformat() + "Z"
        updated_resource.setdefault("created_at", now_iso)
        updated_resource.setdefault("updated_at", now_iso)
        updated_resource["role"] = updated_resource.get("role") or ""
        updated_resource["skills"] = updated_resource.get("skills") if isinstance(updated_resource.get("skills"), list) else (resource_update.skills if resource_update.skills is not None else [])
        updated_resource["current_projects"] = updated_resource.get("current_projects") if isinstance(updated_resource.get("current_projects"), list) else []
        try:
            updated_resource["capacity"] = int(updated_resource.get("capacity", 40))
        except (TypeError, ValueError):
            updated_resource["capacity"] = 40
        try:
            updated_resource["availability"] = int(updated_resource.get("availability", 100))
        except (TypeError, ValueError):
            updated_resource["availability"] = 100

        # Audit trail: resource updated
        _log_resource_audit(
            event_type="resource_updated",
            entity_id=str(resource_id),
            current_user=current_user,
            action_details={"updated_fields": list(update_data.keys()), "name": updated_resource.get("name"), "email": updated_resource.get("email")},
        )
        return updated_resource

    except HTTPException:
        raise
    except Exception as e:
        print(f"Update resource error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to update resource: {str(e)}")

@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: UUID, 
    current_user = Depends(require_permission(Permission.resource_delete))
):
    """Delete a resource"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        response = _db.table("resources").delete().eq("id", str(resource_id)).execute()
        deleted = response.data
        if not response.data:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        # Audit trail: resource deleted
        rec = deleted[0] if deleted else {}
        _log_resource_audit(
            event_type="resource_deleted",
            entity_id=str(resource_id),
            current_user=current_user,
            action_details={"name": rec.get("name"), "email": rec.get("email")},
        )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete resource error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete resource: {str(e)}")

@router.post("/search")
async def search_resources(
    search_request: ResourceSearchRequest, 
    current_user = Depends(require_permission(Permission.resource_read))
):
    """Search resources based on skills, capacity, availability, and other criteria"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        query = _db.table("resources").select("*")
        
        # Apply filters
        if search_request.role:
            query = query.ilike("role", f"%{search_request.role}%")
        
        if search_request.location:
            query = query.ilike("location", f"%{search_request.location}%")
        
        if search_request.min_capacity:
            query = query.gte("capacity", search_request.min_capacity)
        
        if search_request.max_capacity:
            query = query.lte("capacity", search_request.max_capacity)
        
        if search_request.min_availability:
            query = query.gte("availability", search_request.min_availability)
        
        response = query.execute()
        resources = convert_uuids(response.data)
        
        # Filter by skills if specified
        if search_request.skills:
            filtered_resources = []
            for resource in resources:
                resource_skills = resource.get('skills', [])
                skill_match = calculate_advanced_skill_match_score(search_request.skills, resource_skills)
                
                if skill_match['match_score'] > 0:  # At least one skill matches
                    # Calculate availability metrics
                    availability_metrics = calculate_enhanced_resource_availability(resource)
                    resource.update(availability_metrics)
                    resource['skill_match_score'] = skill_match['match_score']
                    resource['matching_skills'] = skill_match['matching_skills']
                    filtered_resources.append(resource)
            
            # Sort by skill match score (descending)
            filtered_resources.sort(key=lambda x: x['skill_match_score'], reverse=True)
            return filtered_resources
        else:
            # Calculate availability metrics for all resources
            enhanced_resources = []
            for resource in resources:
                availability_metrics = calculate_enhanced_resource_availability(resource)
                resource.update(availability_metrics)
                enhanced_resources.append(resource)
            
            return enhanced_resources
        
    except Exception as e:
        print(f"Search resources error: {e}")
        raise HTTPException(status_code=500, detail=f"Resource search failed: {str(e)}")

@router.get("/utilization/summary")
async def get_resource_utilization_summary(
    current_user = Depends(require_permission(Permission.resource_read))
):
    """Get resource utilization summary for analytics"""
    try:
        if _db is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")

        resources_response = _db.table("resources").select("*").execute()
        resources = convert_uuids(resources_response.data)
        
        if not resources:
            # Return mock summary for development
            return {
                "total_resources": 4,
                "total_capacity_hours": 160,
                "total_allocated_hours": 137,
                "total_available_hours": 23,
                "average_utilization": 85.6,
                "fully_allocated": 2,
                "mostly_allocated": 1,
                "partially_allocated": 1,
                "available": 0,
                "over_allocated": 1
            }
        
        # Calculate summary metrics
        total_resources = len(resources)
        total_capacity_hours = 0
        total_allocated_hours = 0
        total_available_hours = 0
        status_counts = {
            "fully_allocated": 0,
            "mostly_allocated": 0,
            "partially_allocated": 0,
            "available": 0
        }
        over_allocated = 0
        
        for resource in resources:
            availability_metrics = calculate_enhanced_resource_availability(resource)
            
            total_capacity_hours += availability_metrics['capacity_hours']
            total_allocated_hours += availability_metrics['allocated_hours']
            total_available_hours += availability_metrics['available_hours']
            
            status = availability_metrics['availability_status']
            if status in status_counts:
                status_counts[status] += 1
            
            if availability_metrics['utilization_percentage'] > 100:
                over_allocated += 1
        
        average_utilization = (total_allocated_hours / total_capacity_hours * 100) if total_capacity_hours > 0 else 0
        
        return {
            "total_resources": total_resources,
            "total_capacity_hours": round(total_capacity_hours, 1),
            "total_allocated_hours": round(total_allocated_hours, 1),
            "total_available_hours": round(total_available_hours, 1),
            "average_utilization": round(average_utilization, 1),
            "fully_allocated": status_counts["fully_allocated"],
            "mostly_allocated": status_counts["mostly_allocated"],
            "partially_allocated": status_counts["partially_allocated"],
            "available": status_counts["available"],
            "over_allocated": over_allocated
        }
        
    except Exception as e:
        print(f"Resource utilization summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get resource utilization summary: {str(e)}")