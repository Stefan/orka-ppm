"""
Change Request Manager Service

Handles CRUD operations for change requests with unique numbering,
validation, status transitions, and version control.
"""

import asyncio
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
import logging

from config.database import supabase
from models.change_management import (
    ChangeRequestCreate, ChangeRequestUpdate, ChangeRequestResponse,
    ChangeStatus, ChangeType, PriorityLevel, ChangeRequestFilters
)
from .project_integration_service import ProjectIntegrationService
from .change_template_service import ChangeTemplateService
from .cache_service import cache_service

logger = logging.getLogger(__name__)

class ChangeRequestManager:
    """
    Core service for managing change request lifecycle and data operations.
    
    Handles:
    - Change request creation with unique numbering (CR-YYYY-NNNN)
    - Validation for required fields and business rules
    - Status transition validation and version control
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        self.project_integration = ProjectIntegrationService()
        self.template_service = ChangeTemplateService()
    
    async def create_change_request(
        self,
        request_data: ChangeRequestCreate,
        creator_id: UUID,
        template_id: Optional[UUID] = None
    ) -> ChangeRequestResponse:
        """
        Create a new change request with unique numbering and validation.
        
        Args:
            request_data: Change request creation data
            creator_id: ID of the user creating the request
            template_id: Optional template ID for pre-populated data
            
        Returns:
            ChangeRequestResponse: Created change request data
            
        Raises:
            ValueError: If validation fails
            RuntimeError: If database operation fails
        """
        try:
            # Apply template if provided
            if template_id:
                request_data = await self.template_service.apply_template_to_change_request(
                    template_id, request_data
                )
                
                # Validate against template
                is_valid, errors = await self.template_service.validate_change_request_against_template(
                    request_data, template_id
                )
                if not is_valid:
                    raise ValueError(f"Template validation failed: {', '.join(errors)}")
            
            # Validate business rules
            await self._validate_create_request(request_data, creator_id)
            
            # Generate unique change number
            change_number = await self._generate_change_number()
            
            # Prepare data for insertion
            change_data = {
                "change_number": change_number,
                "title": request_data.title,
                "description": request_data.description,
                "justification": request_data.justification,
                "change_type": request_data.change_type.value,
                "priority": request_data.priority.value,
                "status": ChangeStatus.DRAFT.value,
                "requested_by": str(creator_id),
                "requested_date": datetime.utcnow().isoformat(),
                "required_by_date": request_data.required_by_date.isoformat() if request_data.required_by_date else None,
                "project_id": str(request_data.project_id),
                "affected_milestones": [str(m) for m in request_data.affected_milestones],
                "affected_pos": [str(p) for p in request_data.affected_pos],
                "estimated_cost_impact": float(request_data.estimated_cost_impact) if request_data.estimated_cost_impact else 0,
                "estimated_schedule_impact_days": request_data.estimated_schedule_impact_days or 0,
                "estimated_effort_hours": float(request_data.estimated_effort_hours) if request_data.estimated_effort_hours else 0,
                "template_id": str(template_id) if template_id else None,
                "version": 1
            }
            
            # Add template data if applied
            if hasattr(request_data, 'template_data') and request_data.template_data:
                change_data["template_data"] = request_data.template_data
            
            # Insert into database
            result = self.db.table("change_requests").insert(change_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create change request")
            
            created_request = result.data[0]
            
            # Log audit event
            await self._log_audit_event(
                change_request_id=UUID(created_request["id"]),
                event_type="created",
                event_description=f"Change request created: {change_number}",
                performed_by=creator_id,
                new_values=change_data
            )
            
            # Convert to response model
            response = await self._convert_to_response(created_request)
            
            # Cache the new change request
            await cache_service.cache_change_request(
                response.id, 
                response.dict(), 
                ttl=3600  # 1 hour
            )
            
            # Invalidate related caches
            await cache_service.invalidate_project_changes(request_data.project_id)
            await cache_service.invalidate_analytics_data()
            
            return response
            
        except Exception as e:
            logger.error(f"Error creating change request: {e}")
            raise RuntimeError(f"Failed to create change request: {str(e)}")
    
    async def update_change_request(
        self,
        change_id: UUID,
        updates: ChangeRequestUpdate,
        updated_by: UUID
    ) -> ChangeRequestResponse:
        """
        Update an existing change request with validation and version control.
        
        Args:
            change_id: ID of the change request to update
            updates: Update data
            updated_by: ID of the user making the update
            
        Returns:
            ChangeRequestResponse: Updated change request data
            
        Raises:
            ValueError: If validation fails
            RuntimeError: If database operation fails
        """
        try:
            # Get current change request
            current = await self.get_change_request(change_id)
            if not current:
                raise ValueError(f"Change request {change_id} not found")
            
            # Validate status transition if status is being updated
            if updates.status:
                current_status = ChangeStatus(current.status)
                if not self.validate_status_transition(current_status, updates.status):
                    raise ValueError(f"Invalid status transition from {current_status} to {updates.status}")
            
            # Prepare update data
            update_data = {}
            old_values = {}
            
            # Build update data from non-None fields
            for field, value in updates.dict(exclude_unset=True).items():
                if value is not None:
                    if field in ["estimated_cost_impact", "actual_cost_impact", "estimated_effort_hours", "actual_effort_hours"]:
                        update_data[field] = float(value) if value else None
                    elif field == "status":
                        update_data[field] = value.value if hasattr(value, 'value') else value
                    elif field == "priority":
                        update_data[field] = value.value if hasattr(value, 'value') else value
                    elif isinstance(value, date):
                        update_data[field] = value.isoformat()
                    else:
                        update_data[field] = value
                    
                    # Store old value for audit
                    old_values[field] = getattr(current, field, None)
            
            # Add metadata
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Increment version if significant changes
            if any(field in update_data for field in ["title", "description", "change_type", "estimated_cost_impact"]):
                update_data["version"] = current.version + 1
            
            # Update in database
            result = self.db.table("change_requests").update(update_data).eq("id", str(change_id)).execute()
            
            if not result.data:
                raise RuntimeError("Failed to update change request")
            
            updated_request = result.data[0]
            
            # Log audit event
            await self._log_audit_event(
                change_request_id=change_id,
                event_type="updated",
                event_description=f"Change request updated",
                performed_by=updated_by,
                old_values=old_values,
                new_values=update_data
            )
            
            # Convert to response model
            response = await self._convert_to_response(updated_request)
            
            # Update cache
            await cache_service.cache_change_request(
                response.id, 
                response.dict(), 
                ttl=3600  # 1 hour
            )
            
            # Invalidate related caches
            await cache_service.invalidate_project_changes(current.project_id)
            await cache_service.invalidate_analytics_data()
            
            return response
            
        except Exception as e:
            logger.error(f"Error updating change request {change_id}: {e}")
            raise RuntimeError(f"Failed to update change request: {str(e)}")
    
    async def get_change_request(self, change_id: UUID) -> Optional[ChangeRequestResponse]:
        """
        Retrieve a single change request by ID.
        
        Args:
            change_id: ID of the change request
            
        Returns:
            ChangeRequestResponse or None if not found
        """
        try:
            # Try to get from cache first
            cached_data = await cache_service.get_cached_change_request(change_id)
            if cached_data:
                return ChangeRequestResponse(**cached_data)
            
            # If not in cache, get from database
            result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
            
            if not result.data:
                return None
            
            response = await self._convert_to_response(result.data[0])
            
            # Cache the result
            await cache_service.cache_change_request(
                change_id, 
                response.dict(), 
                ttl=3600  # 1 hour
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error retrieving change request {change_id}: {e}")
            raise RuntimeError(f"Failed to retrieve change request: {str(e)}")
    
    async def list_change_requests(
        self,
        filters: ChangeRequestFilters
    ) -> Tuple[List[ChangeRequestResponse], int]:
        """
        List change requests with filtering and pagination.
        
        Args:
            filters: Filter criteria and pagination parameters
            
        Returns:
            Tuple of (change_requests_list, total_count)
        """
        try:
            # Try to get from cache for project-specific requests
            cache_key = None
            if filters.project_id and not filters.search_term and filters.page == 1:
                cached_data = await cache_service.get_cached_project_changes(filters.project_id)
                if cached_data:
                    # Apply additional filters to cached data if needed
                    filtered_data = self._apply_filters_to_cached_data(cached_data, filters)
                    return filtered_data, len(filtered_data)
            
            # Build query
            query = self.db.table("change_requests").select("*", count="exact")
            
            # Apply filters
            if filters.project_id:
                query = query.eq("project_id", str(filters.project_id))
            
            if filters.status:
                query = query.eq("status", filters.status.value)
            
            if filters.change_type:
                query = query.eq("change_type", filters.change_type.value)
            
            if filters.priority:
                query = query.eq("priority", filters.priority.value)
            
            if filters.requested_by:
                query = query.eq("requested_by", str(filters.requested_by))
            
            if filters.date_from:
                query = query.gte("requested_date", filters.date_from.isoformat())
            
            if filters.date_to:
                query = query.lte("requested_date", filters.date_to.isoformat())
            
            if filters.search_term:
                # Search in title and description
                query = query.or_(f"title.ilike.%{filters.search_term}%,description.ilike.%{filters.search_term}%")
            
            # Apply pagination
            offset = (filters.page - 1) * filters.page_size
            query = query.range(offset, offset + filters.page_size - 1)
            
            # Order by created date (newest first)
            query = query.order("created_at", desc=True)
            
            # Execute query
            result = query.execute()
            
            # Convert to response models
            change_requests = []
            for item in result.data:
                change_requests.append(await self._convert_to_response(item))
            
            total_count = result.count if result.count is not None else len(result.data)
            
            # Cache project-specific results if applicable
            if filters.project_id and not filters.search_term and filters.page == 1:
                change_requests_data = [cr.dict() for cr in change_requests]
                await cache_service.cache_project_changes(
                    filters.project_id, 
                    change_requests_data, 
                    ttl=1800  # 30 minutes
                )
            
            return change_requests, total_count
            
        except Exception as e:
            logger.error(f"Error listing change requests: {e}")
            raise RuntimeError(f"Failed to list change requests: {str(e)}")
    
    def _apply_filters_to_cached_data(
        self, 
        cached_data: List[Dict[str, Any]], 
        filters: ChangeRequestFilters
    ) -> List[ChangeRequestResponse]:
        """Apply filters to cached data"""
        filtered_data = cached_data
        
        # Apply status filter
        if filters.status:
            filtered_data = [item for item in filtered_data if item.get("status") == filters.status.value]
        
        # Apply change type filter
        if filters.change_type:
            filtered_data = [item for item in filtered_data if item.get("change_type") == filters.change_type.value]
        
        # Apply priority filter
        if filters.priority:
            filtered_data = [item for item in filtered_data if item.get("priority") == filters.priority.value]
        
        # Apply requested_by filter
        if filters.requested_by:
            filtered_data = [item for item in filtered_data if item.get("requested_by") == str(filters.requested_by)]
        
        # Convert to response models
        return [ChangeRequestResponse(**item) for item in filtered_data[:filters.page_size]]
    
    async def link_to_project(self, change_id: UUID, project_id: UUID, linked_by: UUID) -> bool:
        """
        Link a change request to a project using the integration service.
        
        Args:
            change_id: ID of the change request
            project_id: ID of the project to link
            linked_by: ID of the user creating the link
            
        Returns:
            bool: True if successful
        """
        return await self.project_integration.link_change_to_project(change_id, project_id, linked_by)
    
    async def link_to_purchase_order(self, change_id: UUID, po_id: UUID, linked_by: UUID) -> bool:
        """
        Link a change request to a purchase order using the integration service.
        
        Args:
            change_id: ID of the change request
            po_id: ID of the purchase order to link
            linked_by: ID of the user creating the link
            
        Returns:
            bool: True if successful
        """
        return await self.project_integration.link_change_to_purchase_orders(change_id, [po_id], linked_by)
    
    async def link_to_milestones(self, change_id: UUID, milestone_ids: List[UUID], linked_by: UUID) -> bool:
        """
        Link a change request to project milestones using the integration service.
        
        Args:
            change_id: ID of the change request
            milestone_ids: List of milestone IDs to link
            linked_by: ID of the user creating the links
            
        Returns:
            bool: True if successful
        """
        return await self.project_integration.link_change_to_milestones(change_id, milestone_ids, linked_by)
    
    async def get_templates(
        self,
        change_type: Optional[ChangeType] = None,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get available change request templates.
        
        Args:
            change_type: Optional filter by change type
            active_only: Whether to include only active templates
            
        Returns:
            List of template data
        """
        return await self.template_service.list_templates(change_type, active_only)
    
    async def get_template_form_schema(self, template_id: UUID) -> Dict[str, Any]:
        """
        Get form schema for a template.
        
        Args:
            template_id: ID of the template
            
        Returns:
            Dict containing form schema
        """
        return await self.template_service.generate_form_schema(template_id)
    
    def validate_status_transition(
        self,
        current_status: ChangeStatus,
        new_status: ChangeStatus
    ) -> bool:
        """
        Validate if a status transition is allowed.
        
        Args:
            current_status: Current status
            new_status: Desired new status
            
        Returns:
            bool: True if transition is valid
        """
        # Define valid transitions
        valid_transitions = {
            ChangeStatus.DRAFT: [ChangeStatus.SUBMITTED, ChangeStatus.CANCELLED],
            ChangeStatus.SUBMITTED: [ChangeStatus.UNDER_REVIEW, ChangeStatus.CANCELLED, ChangeStatus.DRAFT],
            ChangeStatus.UNDER_REVIEW: [ChangeStatus.PENDING_APPROVAL, ChangeStatus.REJECTED, ChangeStatus.ON_HOLD],
            ChangeStatus.PENDING_APPROVAL: [ChangeStatus.APPROVED, ChangeStatus.REJECTED, ChangeStatus.ON_HOLD],
            ChangeStatus.APPROVED: [ChangeStatus.IMPLEMENTING, ChangeStatus.ON_HOLD],
            ChangeStatus.REJECTED: [ChangeStatus.DRAFT, ChangeStatus.CANCELLED],
            ChangeStatus.ON_HOLD: [ChangeStatus.UNDER_REVIEW, ChangeStatus.PENDING_APPROVAL, ChangeStatus.CANCELLED],
            ChangeStatus.IMPLEMENTING: [ChangeStatus.IMPLEMENTED, ChangeStatus.ON_HOLD],
            ChangeStatus.IMPLEMENTED: [ChangeStatus.CLOSED],
            ChangeStatus.CLOSED: [],  # Terminal state
            ChangeStatus.CANCELLED: []  # Terminal state
        }
        
        return new_status in valid_transitions.get(current_status, [])
    
    async def _generate_change_number(self) -> str:
        """
        Generate unique change request number in format CR-YYYY-NNNN.
        
        Returns:
            str: Unique change number
        """
        current_year = datetime.now().year
        
        # Get the highest number for current year
        result = self.db.table("change_requests").select("change_number").like(
            "change_number", f"CR-{current_year}-%"
        ).order("change_number", desc=True).limit(1).execute()
        
        if result.data:
            # Extract number from last change request
            last_number = result.data[0]["change_number"]
            try:
                last_seq = int(last_number.split("-")[-1])
                next_seq = last_seq + 1
            except (ValueError, IndexError):
                next_seq = 1
        else:
            next_seq = 1
        
        return f"CR-{current_year}-{next_seq:04d}"
    
    async def _validate_create_request(
        self,
        request_data: ChangeRequestCreate,
        creator_id: UUID
    ) -> None:
        """
        Validate business rules for change request creation.
        
        Args:
            request_data: Request data to validate
            creator_id: ID of the creator
            
        Raises:
            ValueError: If validation fails
        """
        # Verify project exists and user has access
        project_result = self.db.table("projects").select("id, name").eq("id", str(request_data.project_id)).execute()
        if not project_result.data:
            raise ValueError(f"Project {request_data.project_id} not found")
        
        # Validate required by date is not in the past
        if request_data.required_by_date and request_data.required_by_date < date.today():
            raise ValueError("Required by date cannot be in the past")
        
        # Validate impact estimates are reasonable
        if request_data.estimated_cost_impact and request_data.estimated_cost_impact < 0:
            raise ValueError("Estimated cost impact cannot be negative")
        
        if request_data.estimated_schedule_impact_days and request_data.estimated_schedule_impact_days < 0:
            raise ValueError("Estimated schedule impact cannot be negative")
        
        # Emergency changes require justification
        if request_data.priority == PriorityLevel.EMERGENCY and not request_data.justification:
            raise ValueError("Emergency changes require justification")
    
    async def _convert_to_response(self, db_record: Dict[str, Any]) -> ChangeRequestResponse:
        """
        Convert database record to response model.
        
        Args:
            db_record: Database record
            
        Returns:
            ChangeRequestResponse: Converted response model
        """
        # Get project name
        project_name = None
        if db_record.get("project_id"):
            project_result = self.db.table("projects").select("name").eq("id", db_record["project_id"]).execute()
            if project_result.data:
                project_name = project_result.data[0]["name"]
        
        # Get pending approvals (placeholder - will be implemented in approval workflow)
        pending_approvals = []
        approval_history = []
        
        return ChangeRequestResponse(
            id=db_record["id"],
            change_number=db_record["change_number"],
            title=db_record["title"],
            description=db_record["description"],
            justification=db_record.get("justification"),
            change_type=db_record["change_type"],
            priority=db_record["priority"],
            status=db_record["status"],
            requested_by=db_record["requested_by"],
            requested_date=datetime.fromisoformat(db_record["requested_date"].replace("Z", "+00:00")),
            required_by_date=date.fromisoformat(db_record["required_by_date"]) if db_record.get("required_by_date") else None,
            project_id=db_record["project_id"],
            project_name=project_name,
            affected_milestones=db_record.get("affected_milestones", []),
            affected_pos=db_record.get("affected_pos", []),
            estimated_cost_impact=Decimal(str(db_record.get("estimated_cost_impact", 0))),
            estimated_schedule_impact_days=db_record.get("estimated_schedule_impact_days"),
            estimated_effort_hours=Decimal(str(db_record.get("estimated_effort_hours", 0))) if db_record.get("estimated_effort_hours") else None,
            actual_cost_impact=Decimal(str(db_record.get("actual_cost_impact"))) if db_record.get("actual_cost_impact") else None,
            actual_schedule_impact_days=db_record.get("actual_schedule_impact_days"),
            actual_effort_hours=Decimal(str(db_record.get("actual_effort_hours"))) if db_record.get("actual_effort_hours") else None,
            implementation_progress=db_record.get("implementation_progress"),
            implementation_start_date=date.fromisoformat(db_record["implementation_start_date"]) if db_record.get("implementation_start_date") else None,
            implementation_end_date=date.fromisoformat(db_record["implementation_end_date"]) if db_record.get("implementation_end_date") else None,
            implementation_notes=db_record.get("implementation_notes"),
            pending_approvals=pending_approvals,
            approval_history=approval_history,
            version=db_record.get("version", 1),
            parent_change_id=db_record.get("parent_change_id"),
            template_id=db_record.get("template_id"),
            created_at=datetime.fromisoformat(db_record["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(db_record["updated_at"].replace("Z", "+00:00")),
            closed_at=datetime.fromisoformat(db_record["closed_at"].replace("Z", "+00:00")) if db_record.get("closed_at") else None,
            closed_by=db_record.get("closed_by")
        )
    
    async def _log_audit_event(
        self,
        change_request_id: UUID,
        event_type: str,
        event_description: str,
        performed_by: UUID,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[UUID] = None
    ) -> None:
        """
        Log audit event for change request operations.
        
        Args:
            change_request_id: ID of the change request
            event_type: Type of event (created, updated, etc.)
            event_description: Description of the event
            performed_by: ID of the user who performed the action
            old_values: Previous values (for updates)
            new_values: New values
            related_entity_type: Type of related entity
            related_entity_id: ID of related entity
        """
        try:
            audit_data = {
                "change_request_id": str(change_request_id),
                "event_type": event_type,
                "event_description": event_description,
                "performed_by": str(performed_by),
                "performed_at": datetime.utcnow().isoformat(),
                "old_values": old_values,
                "new_values": new_values,
                "related_entity_type": related_entity_type,
                "related_entity_id": str(related_entity_id) if related_entity_id else None
            }
            
            self.db.table("change_audit_log").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging audit event: {e}")
            # Don't raise exception for audit logging failures