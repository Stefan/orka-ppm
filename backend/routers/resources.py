"""
Resource management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from uuid import UUID
from typing import List

from auth.rbac import require_permission, Permission
from config.database import supabase
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

@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    resource: ResourceCreate, 
    current_user = Depends(require_permission(Permission.resource_create))
):
    """Create a new resource"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        resource_data = resource.dict()
        response = supabase.table("resources").insert(resource_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create resource")
        
        created_resource = response.data[0]
        
        # Calculate availability metrics
        availability_metrics = calculate_enhanced_resource_availability(created_resource)
        created_resource.update(availability_metrics)
        
        return convert_uuids(created_resource)
        
    except Exception as e:
        print(f"Create resource error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create resource: {str(e)}")

@router.get("/")
async def list_resources(current_user = Depends(require_permission(Permission.resource_read))):
    """Get all resources with utilization data"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get resources from database
        resources_response = supabase.table("resources").select("*").execute()
        resources = convert_uuids(resources_response.data)
        
        # If no resources exist, return mock data for development
        if not resources:
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
        
        # Calculate availability metrics for each resource
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("resources").select("*").eq("id", str(resource_id)).execute()
        
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Only include non-None fields in the update
        update_data = {k: v for k, v in resource_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        response = supabase.table("resources").update(update_data).eq("id", str(resource_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        updated_resource = convert_uuids(response.data[0])
        
        # Calculate availability metrics
        availability_metrics = calculate_enhanced_resource_availability(updated_resource)
        updated_resource.update(availability_metrics)
        
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("resources").delete().eq("id", str(resource_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Resource not found")
        
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Start with base query
        query = supabase.table("resources").select("*")
        
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
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get all resources
        resources_response = supabase.table("resources").select("*").execute()
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