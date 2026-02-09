"""
Workflow Repository

Database abstraction layer for workflow operations.
Handles all database interactions for workflows, instances, and approvals.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from supabase import Client
from postgrest.exceptions import APIError

from models.workflow import (
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowApproval,
    WorkflowStatus,
    ApprovalStatus,
    PendingApproval
)
from services.workflow_cache import get_workflow_cache

logger = logging.getLogger(__name__)


class WorkflowRepository:
    """
    Repository for workflow database operations.
    
    Provides methods for CRUD operations on workflows, workflow instances,
    and workflow approvals using Supabase.
    """
    
    def __init__(self, db: Client):
        """
        Initialize repository with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        self.db = db
        self.cache = get_workflow_cache()
    
    # ==================== Workflow Definition Operations ====================
    
    async def create_workflow(self, workflow: WorkflowDefinition) -> Dict[str, Any]:
        """
        Create a new workflow definition.
        
        Args:
            workflow: Workflow definition to create
            
        Returns:
            Dict containing created workflow data
            
        Raises:
            RuntimeError: If creation fails
        """
        try:
            workflow_data = {
                "name": workflow.name,
                "description": workflow.description,
                "template_data": {
                    "steps": [step.dict() for step in workflow.steps],
                    "triggers": [trigger.dict() for trigger in workflow.triggers],
                    "metadata": workflow.metadata,
                    "version": workflow.version
                },
                "status": workflow.status.value,
                "created_by": str(workflow.created_by) if workflow.created_by else None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflows").insert(workflow_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create workflow - no data returned")
            
            logger.info(f"Created workflow: {result.data[0]['id']}")
            return result.data[0]
            
        except APIError as e:
            logger.error(f"Database error creating workflow: {e}")
            raise RuntimeError(f"Failed to create workflow: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating workflow: {e}")
            raise RuntimeError(f"Failed to create workflow: {str(e)}")
    
    async def get_workflow(self, workflow_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get workflow definition by ID.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            Dict containing workflow data or None if not found
        """
        # Check cache first
        cached_workflow = self.cache.get_workflow(workflow_id)
        if cached_workflow is not None:
            return cached_workflow
        
        try:
            result = self.db.table("workflows").select("*").eq(
                "id", str(workflow_id)
            ).execute()
            
            workflow_data = result.data[0] if result.data else None
            
            # Cache the result
            if workflow_data:
                self.cache.set_workflow(workflow_id, workflow_data)
            
            return workflow_data
            
        except Exception as e:
            logger.error(f"Error getting workflow {workflow_id}: {e}")
            return None
    
    async def list_workflows(
        self,
        status: Optional[WorkflowStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List workflow definitions with optional filtering.
        
        Args:
            status: Optional status filter
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of workflow definitions
        """
        try:
            query = self.db.table("workflows").select("*")
            
            if status:
                query = query.eq("status", status.value)
            
            result = query.order("created_at", desc=True).range(
                offset, offset + limit - 1
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error listing workflows: {e}")
            return []
    
    async def update_workflow(
        self,
        workflow_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update workflow definition.
        
        Args:
            workflow_id: Workflow ID
            updates: Dictionary of fields to update
            
        Returns:
            Updated workflow data or None if not found
        """
        try:
            updates["updated_at"] = datetime.utcnow().isoformat()
            
            result = self.db.table("workflows").update(updates).eq(
                "id", str(workflow_id)
            ).execute()
            
            if result.data:
                logger.info(f"Updated workflow: {workflow_id}")
                # Invalidate cache
                self.cache.invalidate_workflow(workflow_id)
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating workflow {workflow_id}: {e}")
            raise RuntimeError(f"Failed to update workflow: {str(e)}")
    
    async def get_workflow_version(
        self,
        workflow_id: UUID,
        version: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific version of a workflow definition.
        
        Args:
            workflow_id: Workflow ID
            version: Version number
            
        Returns:
            Dict containing workflow data for the specified version or None if not found
        """
        # Check cache first (versions are immutable so can be cached longer)
        cached_version = self.cache.get_workflow_version(workflow_id, version)
        if cached_version is not None:
            return cached_version
        
        try:
            # First get the workflow
            workflow = await self.get_workflow(workflow_id)
            if not workflow:
                return None
            
            # Check if the current version matches
            template_data = workflow.get("template_data", {})
            current_version = template_data.get("version", 1)
            
            if current_version == version:
                # Cache the version
                self.cache.set_workflow_version(workflow_id, version, workflow)
                return workflow
            
            # For historical versions, check version_history if it exists
            version_history = workflow.get("version_history", [])
            for historical_version in version_history:
                if historical_version.get("version") == version:
                    # Reconstruct workflow data with historical version
                    historical_workflow = workflow.copy()
                    historical_workflow["template_data"] = historical_version
                    # Cache the historical version
                    self.cache.set_workflow_version(workflow_id, version, historical_workflow)
                    return historical_workflow
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting workflow version {workflow_id} v{version}: {e}")
            return None
    
    async def list_workflow_versions(
        self,
        workflow_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        List all versions of a workflow definition.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            List of version information dictionaries
        """
        try:
            workflow = await self.get_workflow(workflow_id)
            if not workflow:
                return []
            
            versions = []
            template_data = workflow.get("template_data", {})
            current_version = template_data.get("version", 1)
            
            # Add current version
            versions.append({
                "version": current_version,
                "created_at": workflow.get("updated_at"),
                "is_current": True,
                "step_count": len(template_data.get("steps", [])),
                "trigger_count": len(template_data.get("triggers", []))
            })
            
            # Add historical versions
            version_history = workflow.get("version_history", [])
            for historical_version in version_history:
                versions.append({
                    "version": historical_version.get("version", 1),
                    "created_at": historical_version.get("created_at"),
                    "is_current": False,
                    "step_count": len(historical_version.get("steps", [])),
                    "trigger_count": len(historical_version.get("triggers", []))
                })
            
            # Sort by version descending
            versions.sort(key=lambda v: v["version"], reverse=True)
            
            return versions
            
        except Exception as e:
            logger.error(f"Error listing workflow versions for {workflow_id}: {e}")
            return []
    
    async def delete_workflow(self, workflow_id: UUID) -> bool:
        """
        Delete workflow definition.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            result = self.db.table("workflows").delete().eq(
                "id", str(workflow_id)
            ).execute()
            
            success = bool(result.data)
            if success:
                logger.info(f"Deleted workflow: {workflow_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting workflow {workflow_id}: {e}")
            return False
    
    async def create_workflow_version(
        self,
        workflow_id: UUID,
        updated_workflow: WorkflowDefinition
    ) -> Dict[str, Any]:
        """
        Create a new version of a workflow definition.
        
        This method preserves the existing workflow version in history and
        creates a new version with incremented version number. Existing
        workflow instances will continue to use their original version.
        
        Args:
            workflow_id: Workflow ID to update
            updated_workflow: Updated workflow definition
            
        Returns:
            Dict containing updated workflow data with new version
            
        Raises:
            ValueError: If workflow not found
            RuntimeError: If version creation fails
        """
        try:
            # Get current workflow
            current_workflow = await self.get_workflow(workflow_id)
            if not current_workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Extract current template data
            current_template = current_workflow.get("template_data", {})
            current_version = current_template.get("version", 1)
            
            # Prepare version history entry for current version
            version_history = current_workflow.get("version_history", [])
            
            # Add current version to history
            historical_entry = {
                "version": current_version,
                "steps": current_template.get("steps", []),
                "triggers": current_template.get("triggers", []),
                "metadata": current_template.get("metadata", {}),
                "created_at": current_workflow.get("updated_at", datetime.utcnow().isoformat()),
                "archived_at": datetime.utcnow().isoformat()
            }
            version_history.append(historical_entry)
            
            # Increment version number
            new_version = current_version + 1
            
            # Prepare new template data
            new_template_data = {
                "steps": [step.dict() for step in updated_workflow.steps],
                "triggers": [trigger.dict() for trigger in updated_workflow.triggers],
                "metadata": updated_workflow.metadata,
                "version": new_version
            }
            
            # Update workflow with new version
            updates = {
                "name": updated_workflow.name,
                "description": updated_workflow.description,
                "template_data": new_template_data,
                "status": updated_workflow.status.value,
                "version_history": version_history,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflows").update(updates).eq(
                "id", str(workflow_id)
            ).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create workflow version - no data returned")
            
            logger.info(
                f"Created workflow version {new_version} for workflow {workflow_id} "
                f"(previous version {current_version} archived)"
            )
            
            return result.data[0]
            
        except ValueError as e:
            logger.error(f"Validation error creating workflow version: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating workflow version for {workflow_id}: {e}")
            raise RuntimeError(f"Failed to create workflow version: {str(e)}")
    
    # ==================== Workflow Instance Operations ====================
    
    async def create_workflow_instance(
        self,
        instance: WorkflowInstance
    ) -> Dict[str, Any]:
        """
        Create a new workflow instance.
        
        Args:
            instance: Workflow instance to create
            
        Returns:
            Dict containing created instance data
            
        Raises:
            RuntimeError: If creation fails
        """
        try:
            instance_data = {
                "workflow_id": str(instance.workflow_id),
                "entity_type": instance.entity_type,
                "entity_id": str(instance.entity_id),
                "project_id": str(instance.project_id) if instance.project_id else None,
                "current_step": instance.current_step,
                "status": instance.status.value,
                "data": instance.context,
                "started_by": str(instance.initiated_by),
                "started_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_instances").insert(instance_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create workflow instance - no data returned")
            
            logger.info(f"Created workflow instance: {result.data[0]['id']}")
            return result.data[0]
            
        except APIError as e:
            logger.error(f"Database error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
    
    async def create_workflow_instance_with_version(
        self,
        instance: WorkflowInstance,
        workflow_version: int
    ) -> Dict[str, Any]:
        """
        Create a new workflow instance with explicit version tracking.
        
        This method stores the workflow version with the instance to ensure
        the instance always uses the workflow definition it was created with,
        even if the workflow is updated later.
        
        Args:
            instance: Workflow instance to create
            workflow_version: Version of the workflow definition
            
        Returns:
            Dict containing created instance data
            
        Raises:
            RuntimeError: If creation fails
        """
        try:
            # Add workflow version to instance context
            context = instance.context.copy() if instance.context else {}
            context["workflow_version"] = workflow_version
            
            instance_data = {
                "workflow_id": str(instance.workflow_id),
                "entity_type": instance.entity_type,
                "entity_id": str(instance.entity_id),
                "project_id": str(instance.project_id) if instance.project_id else None,
                "current_step": instance.current_step,
                "status": instance.status.value,
                "data": context,
                "started_by": str(instance.initiated_by),
                "started_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_instances").insert(instance_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create workflow instance - no data returned")
            
            logger.info(
                f"Created workflow instance: {result.data[0]['id']} "
                f"with workflow version {workflow_version}"
            )
            return result.data[0]
            
        except APIError as e:
            logger.error(f"Database error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating workflow instance: {e}")
            raise RuntimeError(f"Failed to create workflow instance: {str(e)}")
    
    async def get_workflow_instance(
        self,
        instance_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get workflow instance by ID.
        
        Args:
            instance_id: Instance ID
            
        Returns:
            Dict containing instance data or None if not found
        """
        # Check cache first (short TTL for instances)
        cached_instance = self.cache.get_workflow_instance(instance_id)
        if cached_instance is not None:
            return cached_instance
        
        try:
            result = self.db.table("workflow_instances").select("*").eq(
                "id", str(instance_id)
            ).execute()
            
            instance_data = result.data[0] if result.data else None
            
            # Cache the result
            if instance_data:
                self.cache.set_workflow_instance(instance_id, instance_data)
            
            return instance_data
            
        except Exception as e:
            logger.error(f"Error getting workflow instance {instance_id}: {e}")
            return None
    
    async def update_workflow_instance(
        self,
        instance_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update workflow instance.
        
        Args:
            instance_id: Instance ID
            updates: Dictionary of fields to update
            
        Returns:
            Updated instance data or None if not found
        """
        try:
            updates["updated_at"] = datetime.utcnow().isoformat()
            
            result = self.db.table("workflow_instances").update(updates).eq(
                "id", str(instance_id)
            ).execute()
            
            if result.data:
                logger.info(f"Updated workflow instance: {instance_id}")
                # Invalidate cache
                self.cache.invalidate_workflow_instance(instance_id)
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating workflow instance {instance_id}: {e}")
            raise RuntimeError(f"Failed to update workflow instance: {str(e)}")
    
    async def list_workflow_instances(
        self,
        workflow_id: Optional[UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        status: Optional[WorkflowStatus] = None,
        started_by: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List workflow instances with optional filtering.
        
        Args:
            workflow_id: Optional workflow ID filter
            entity_type: Optional entity type filter
            entity_id: Optional entity ID filter
            status: Optional status filter
            started_by: Optional filter by initiator user ID (for "my workflows")
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of workflow instances
        """
        try:
            query = self.db.table("workflow_instances").select("*")
            
            if workflow_id:
                query = query.eq("workflow_id", str(workflow_id))
            if entity_type:
                query = query.eq("entity_type", entity_type)
            if entity_id:
                query = query.eq("entity_id", str(entity_id))
            if status:
                query = query.eq("status", status.value)
            if started_by:
                query = query.eq("started_by", str(started_by))
            
            result = query.order("created_at", desc=True).range(
                offset, offset + limit - 1
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error listing workflow instances: {e}")
            return []
    
    # ==================== Workflow Approval Operations ====================
    
    async def create_approval(self, approval: WorkflowApproval) -> Dict[str, Any]:
        """
        Create a new workflow approval.
        
        Args:
            approval: Workflow approval to create
            
        Returns:
            Dict containing created approval data
            
        Raises:
            RuntimeError: If creation fails
        """
        try:
            approval_data = {
                "workflow_instance_id": str(approval.workflow_instance_id),
                "step_number": approval.step_number,
                "approver_id": str(approval.approver_id),
                "status": approval.status.value,
                "comments": approval.comments,
                "expires_at": approval.expires_at.isoformat() if approval.expires_at else None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_approvals").insert(approval_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create approval - no data returned")
            
            logger.info(f"Created workflow approval: {result.data[0]['id']}")
            return result.data[0]
            
        except APIError as e:
            logger.error(f"Database error creating approval: {e}")
            raise RuntimeError(f"Failed to create approval: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating approval: {e}")
            raise RuntimeError(f"Failed to create approval: {str(e)}")
    
    async def update_approval(
        self,
        approval_id: UUID,
        decision: str,
        comments: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update approval with decision.
        
        Args:
            approval_id: Approval ID
            decision: Approval decision (approved/rejected)
            comments: Optional comments
            
        Returns:
            Updated approval data or None if not found
        """
        try:
            updates = {
                "status": decision,
                "comments": comments,
                "approved_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_approvals").update(updates).eq(
                "id", str(approval_id)
            ).execute()
            
            if result.data:
                logger.info(f"Updated approval: {approval_id} with decision: {decision}")
                # Invalidate all pending approvals cache since this affects multiple users
                self.cache.invalidate_all_pending_approvals()
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating approval {approval_id}: {e}")
            raise RuntimeError(f"Failed to update approval: {str(e)}")
    
    async def get_approvals_for_instance(
        self,
        instance_id: UUID,
        step_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get approvals for a workflow instance.
        
        Args:
            instance_id: Instance ID
            step_number: Optional step number filter
            
        Returns:
            List of approvals
        """
        try:
            query = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", str(instance_id)
            )
            
            if step_number is not None:
                query = query.eq("step_number", step_number)
            
            result = query.order("step_number").execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting approvals for instance {instance_id}: {e}")
            return []
    
    async def get_pending_approvals_for_user(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get pending approvals for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of pending approvals with workflow context
        """
        # Check cache first (very short TTL for pending approvals)
        if offset == 0:  # Only cache first page
            cached_approvals = self.cache.get_pending_approvals(user_id)
            if cached_approvals is not None:
                return cached_approvals[:limit]
        
        try:
            # Get pending approvals for user
            approvals_result = self.db.table("workflow_approvals").select(
                "*, workflow_instances!inner(*), workflows!inner(*)"
            ).eq(
                "approver_id", str(user_id)
            ).eq(
                "status", ApprovalStatus.PENDING.value
            ).order("created_at", desc=True).range(
                offset, offset + limit - 1
            ).execute()
            
            approvals_data = approvals_result.data or []
            
            # Cache first page
            if offset == 0 and approvals_data:
                self.cache.set_pending_approvals(user_id, approvals_data)
            
            return approvals_data
            
        except Exception as e:
            logger.error(f"Error getting pending approvals for user {user_id}: {e}")
            return []
    
    async def get_approval_by_id(self, approval_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get approval by ID.
        
        Args:
            approval_id: Approval ID
            
        Returns:
            Dict containing approval data or None if not found
        """
        try:
            result = self.db.table("workflow_approvals").select("*").eq(
                "id", str(approval_id)
            ).execute()
            
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error(f"Error getting approval {approval_id}: {e}")
            return None
    
    # ==================== Helper Methods ====================
    
    async def get_workflow_with_instance(
        self,
        instance_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get workflow definition along with instance data.
        
        Args:
            instance_id: Instance ID
            
        Returns:
            Dict containing workflow and instance data or None if not found
        """
        try:
            result = self.db.table("workflow_instances").select(
                "*, workflows(*)"
            ).eq("id", str(instance_id)).execute()
            
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error(f"Error getting workflow with instance {instance_id}: {e}")
            return None
    
    async def get_workflow_for_instance(
        self,
        instance_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get the workflow definition for a specific instance.
        
        This method retrieves the correct version of the workflow definition
        that the instance was created with, even if the workflow has been
        updated since then.
        
        Args:
            instance_id: Instance ID
            
        Returns:
            Dict containing workflow definition or None if not found
        """
        try:
            # Get instance data
            instance = await self.get_workflow_instance(instance_id)
            if not instance:
                return None
            
            workflow_id = UUID(instance["workflow_id"])
            
            # Check if instance has version information
            instance_data = instance.get("data", {})
            workflow_version = instance_data.get("workflow_version")
            
            if workflow_version:
                # Get specific version
                return await self.get_workflow_version(workflow_id, workflow_version)
            else:
                # Fall back to current version (for legacy instances)
                return await self.get_workflow(workflow_id)
            
        except Exception as e:
            logger.error(f"Error getting workflow for instance {instance_id}: {e}")
            return None
