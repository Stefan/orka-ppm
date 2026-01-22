"""
Workflow Version Management Service

Provides version management capabilities for workflow definitions,
including version creation, migration, and instance version tracking.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID

from supabase import Client

from models.workflow import WorkflowDefinition, WorkflowStatus
from services.workflow_repository import WorkflowRepository

logger = logging.getLogger(__name__)


class WorkflowVersionService:
    """
    Service for managing workflow versions.
    
    Handles workflow version creation, migration logic, and ensures
    existing workflow instances continue to use their original workflow
    definitions even when workflows are updated.
    """
    
    def __init__(self, db: Client):
        """
        Initialize version service with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self.repository = WorkflowRepository(db)
    
    async def create_new_version(
        self,
        workflow_id: UUID,
        updated_workflow: WorkflowDefinition,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Create a new version of a workflow definition.
        
        This method:
        1. Archives the current workflow version in version history
        2. Creates a new version with incremented version number
        3. Preserves existing workflow instances with their original version
        4. Activates the new version for future instances
        
        Args:
            workflow_id: Workflow ID to update
            updated_workflow: Updated workflow definition
            user_id: User ID creating the new version
            
        Returns:
            Dict containing the new workflow version data
            
        Raises:
            ValueError: If workflow not found or validation fails
            RuntimeError: If version creation fails
        """
        try:
            # Validate workflow exists
            current_workflow = await self.repository.get_workflow(workflow_id)
            if not current_workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Check if there are active instances
            active_instances = await self._count_active_instances(workflow_id)
            
            logger.info(
                f"Creating new version for workflow {workflow_id}. "
                f"Active instances: {active_instances}"
            )
            
            # Create new version
            new_version_data = await self.repository.create_workflow_version(
                workflow_id,
                updated_workflow
            )
            
            # Log version creation
            template_data = new_version_data.get("template_data", {})
            new_version = template_data.get("version", 1)
            
            logger.info(
                f"Created workflow version {new_version} for workflow {workflow_id}. "
                f"{active_instances} existing instances will continue using previous version."
            )
            
            return {
                "workflow_id": new_version_data["id"],
                "name": new_version_data["name"],
                "version": new_version,
                "previous_version": new_version - 1,
                "active_instances_preserved": active_instances,
                "created_at": new_version_data["updated_at"],
                "status": new_version_data["status"]
            }
            
        except ValueError as e:
            logger.error(f"Validation error creating workflow version: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating workflow version: {e}")
            raise RuntimeError(f"Failed to create workflow version: {str(e)}")
    
    async def get_version_history(
        self,
        workflow_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get version history for a workflow.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            List of version information dictionaries
        """
        try:
            versions = await self.repository.list_workflow_versions(workflow_id)
            
            # Enhance with instance counts
            enhanced_versions = []
            for version_info in versions:
                version_num = version_info["version"]
                instance_count = await self._count_instances_by_version(
                    workflow_id,
                    version_num
                )
                
                enhanced_versions.append({
                    **version_info,
                    "instance_count": instance_count
                })
            
            return enhanced_versions
            
        except Exception as e:
            logger.error(f"Error getting version history for {workflow_id}: {e}")
            return []
    
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
            Dict containing workflow definition for the specified version
        """
        try:
            return await self.repository.get_workflow_version(workflow_id, version)
        except Exception as e:
            logger.error(f"Error getting workflow version {workflow_id} v{version}: {e}")
            return None
    
    async def migrate_instance_to_version(
        self,
        instance_id: UUID,
        target_version: int,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Migrate a workflow instance to a different workflow version.
        
        This is an advanced operation that should be used carefully.
        It updates the instance to use a different version of the workflow
        definition. This may affect the instance's behavior and approval flow.
        
        Args:
            instance_id: Workflow instance ID
            target_version: Target workflow version
            user_id: User ID performing the migration
            
        Returns:
            Dict containing migration result
            
        Raises:
            ValueError: If instance or version not found
            RuntimeError: If migration fails
        """
        try:
            # Get instance
            instance = await self.repository.get_workflow_instance(instance_id)
            if not instance:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            # Check instance is not completed
            if instance["status"] in [WorkflowStatus.COMPLETED.value, WorkflowStatus.REJECTED.value]:
                raise ValueError("Cannot migrate completed or rejected workflow instances")
            
            workflow_id = UUID(instance["workflow_id"])
            
            # Validate target version exists
            target_workflow = await self.repository.get_workflow_version(
                workflow_id,
                target_version
            )
            if not target_workflow:
                raise ValueError(f"Workflow version {target_version} not found")
            
            # Get current version
            instance_data = instance.get("data", {})
            current_version = instance_data.get("workflow_version", 1)
            
            if current_version == target_version:
                raise ValueError(f"Instance is already using version {target_version}")
            
            # Update instance context with new version
            instance_data["workflow_version"] = target_version
            instance_data["version_migration"] = {
                "from_version": current_version,
                "to_version": target_version,
                "migrated_at": datetime.utcnow().isoformat(),
                "migrated_by": str(user_id)
            }
            
            await self.repository.update_workflow_instance(
                instance_id,
                {"data": instance_data}
            )
            
            logger.info(
                f"Migrated workflow instance {instance_id} from version "
                f"{current_version} to version {target_version}"
            )
            
            return {
                "instance_id": str(instance_id),
                "workflow_id": str(workflow_id),
                "from_version": current_version,
                "to_version": target_version,
                "migrated_at": datetime.utcnow().isoformat(),
                "status": "success"
            }
            
        except ValueError as e:
            logger.error(f"Validation error migrating instance: {e}")
            raise
        except Exception as e:
            logger.error(f"Error migrating instance {instance_id}: {e}")
            raise RuntimeError(f"Failed to migrate instance: {str(e)}")
    
    async def compare_versions(
        self,
        workflow_id: UUID,
        version1: int,
        version2: int
    ) -> Dict[str, Any]:
        """
        Compare two versions of a workflow definition.
        
        Args:
            workflow_id: Workflow ID
            version1: First version number
            version2: Second version number
            
        Returns:
            Dict containing comparison results
        """
        try:
            # Get both versions
            workflow_v1 = await self.repository.get_workflow_version(workflow_id, version1)
            workflow_v2 = await self.repository.get_workflow_version(workflow_id, version2)
            
            if not workflow_v1 or not workflow_v2:
                raise ValueError("One or both versions not found")
            
            template_v1 = workflow_v1.get("template_data", {})
            template_v2 = workflow_v2.get("template_data", {})
            
            # Compare steps
            steps_v1 = template_v1.get("steps", [])
            steps_v2 = template_v2.get("steps", [])
            
            steps_changed = len(steps_v1) != len(steps_v2)
            if not steps_changed:
                # Check if step definitions changed
                for i, (s1, s2) in enumerate(zip(steps_v1, steps_v2)):
                    if s1 != s2:
                        steps_changed = True
                        break
            
            # Compare triggers
            triggers_v1 = template_v1.get("triggers", [])
            triggers_v2 = template_v2.get("triggers", [])
            triggers_changed = triggers_v1 != triggers_v2
            
            # Compare metadata
            metadata_v1 = template_v1.get("metadata", {})
            metadata_v2 = template_v2.get("metadata", {})
            metadata_changed = metadata_v1 != metadata_v2
            
            return {
                "workflow_id": str(workflow_id),
                "version1": version1,
                "version2": version2,
                "changes": {
                    "steps_changed": steps_changed,
                    "step_count_v1": len(steps_v1),
                    "step_count_v2": len(steps_v2),
                    "triggers_changed": triggers_changed,
                    "trigger_count_v1": len(triggers_v1),
                    "trigger_count_v2": len(triggers_v2),
                    "metadata_changed": metadata_changed
                },
                "name_changed": workflow_v1.get("name") != workflow_v2.get("name"),
                "description_changed": workflow_v1.get("description") != workflow_v2.get("description")
            }
            
        except ValueError as e:
            logger.error(f"Validation error comparing versions: {e}")
            raise
        except Exception as e:
            logger.error(f"Error comparing versions: {e}")
            raise RuntimeError(f"Failed to compare versions: {str(e)}")
    
    # ==================== Helper Methods ====================
    
    async def _count_active_instances(self, workflow_id: UUID) -> int:
        """
        Count active workflow instances for a workflow.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            Number of active instances
        """
        try:
            instances = await self.repository.list_workflow_instances(
                workflow_id=workflow_id,
                status=WorkflowStatus.IN_PROGRESS
            )
            return len(instances)
        except Exception as e:
            logger.error(f"Error counting active instances: {e}")
            return 0
    
    async def _count_instances_by_version(
        self,
        workflow_id: UUID,
        version: int
    ) -> int:
        """
        Count workflow instances using a specific version.
        
        Args:
            workflow_id: Workflow ID
            version: Version number
            
        Returns:
            Number of instances using the version
        """
        try:
            # Get all instances for the workflow
            instances = await self.repository.list_workflow_instances(
                workflow_id=workflow_id,
                limit=1000  # Reasonable limit
            )
            
            # Count instances with matching version
            count = 0
            for instance in instances:
                instance_data = instance.get("data", {})
                instance_version = instance_data.get("workflow_version", 1)
                if instance_version == version:
                    count += 1
            
            return count
            
        except Exception as e:
            logger.error(f"Error counting instances by version: {e}")
            return 0
