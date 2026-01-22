"""
Workflow Batch Processor

Provides batch processing capabilities for workflow operations to improve
performance when handling multiple workflows or approvals simultaneously.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
import asyncio

from supabase import Client

from models.workflow import (
    WorkflowInstance,
    WorkflowApproval,
    ApprovalStatus,
    WorkflowStatus
)

logger = logging.getLogger(__name__)


class WorkflowBatchProcessor:
    """
    Batch processor for workflow operations.
    
    Provides efficient batch processing for:
    - Creating multiple workflow instances
    - Processing multiple approvals
    - Updating multiple workflow states
    - Bulk notification sending
    """
    
    def __init__(self, db: Client, batch_size: int = 100):
        """
        Initialize batch processor.
        
        Args:
            db: Supabase client instance
            batch_size: Maximum batch size for operations
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self.batch_size = batch_size
        
        logger.info(f"Initialized workflow batch processor with batch_size={batch_size}")
    
    # ==================== Batch Instance Operations ====================
    
    async def create_workflow_instances_batch(
        self,
        instances: List[WorkflowInstance]
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Create multiple workflow instances in batch.
        
        Args:
            instances: List of workflow instances to create
            
        Returns:
            Tuple of (created_instances, error_messages)
        """
        if not instances:
            return [], []
        
        created_instances = []
        errors = []
        
        # Process in batches
        for i in range(0, len(instances), self.batch_size):
            batch = instances[i:i + self.batch_size]
            
            try:
                # Prepare batch data
                batch_data = []
                for instance in batch:
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
                    batch_data.append(instance_data)
                
                # Execute batch insert
                result = self.db.table("workflow_instances").insert(batch_data).execute()
                
                if result.data:
                    created_instances.extend(result.data)
                    logger.info(f"Created batch of {len(result.data)} workflow instances")
                else:
                    errors.append(f"Batch {i // self.batch_size + 1}: No data returned")
                
            except Exception as e:
                error_msg = f"Batch {i // self.batch_size + 1}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Error creating workflow instances batch: {e}")
        
        return created_instances, errors
    
    async def update_workflow_instances_batch(
        self,
        updates: List[Tuple[UUID, Dict[str, Any]]]
    ) -> Tuple[int, List[str]]:
        """
        Update multiple workflow instances in batch.
        
        Args:
            updates: List of (instance_id, update_dict) tuples
            
        Returns:
            Tuple of (success_count, error_messages)
        """
        if not updates:
            return 0, []
        
        success_count = 0
        errors = []
        
        # Process updates concurrently with semaphore to limit concurrency
        semaphore = asyncio.Semaphore(10)  # Limit to 10 concurrent updates
        
        async def update_single(instance_id: UUID, update_data: Dict[str, Any]) -> bool:
            async with semaphore:
                try:
                    update_data["updated_at"] = datetime.utcnow().isoformat()
                    
                    result = self.db.table("workflow_instances").update(update_data).eq(
                        "id", str(instance_id)
                    ).execute()
                    
                    return bool(result.data)
                    
                except Exception as e:
                    errors.append(f"Instance {instance_id}: {str(e)}")
                    logger.error(f"Error updating workflow instance {instance_id}: {e}")
                    return False
        
        # Execute updates concurrently
        tasks = [update_single(instance_id, update_data) for instance_id, update_data in updates]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is True)
        
        logger.info(f"Updated {success_count}/{len(updates)} workflow instances in batch")
        
        return success_count, errors
    
    # ==================== Batch Approval Operations ====================
    
    async def create_approvals_batch(
        self,
        approvals: List[WorkflowApproval]
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Create multiple workflow approvals in batch.
        
        Args:
            approvals: List of workflow approvals to create
            
        Returns:
            Tuple of (created_approvals, error_messages)
        """
        if not approvals:
            return [], []
        
        created_approvals = []
        errors = []
        
        # Process in batches
        for i in range(0, len(approvals), self.batch_size):
            batch = approvals[i:i + self.batch_size]
            
            try:
                # Prepare batch data
                batch_data = []
                for approval in batch:
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
                    batch_data.append(approval_data)
                
                # Execute batch insert
                result = self.db.table("workflow_approvals").insert(batch_data).execute()
                
                if result.data:
                    created_approvals.extend(result.data)
                    logger.info(f"Created batch of {len(result.data)} workflow approvals")
                else:
                    errors.append(f"Batch {i // self.batch_size + 1}: No data returned")
                
            except Exception as e:
                error_msg = f"Batch {i // self.batch_size + 1}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Error creating workflow approvals batch: {e}")
        
        return created_approvals, errors
    
    async def update_approvals_batch(
        self,
        updates: List[Tuple[UUID, str, Optional[str]]]
    ) -> Tuple[int, List[str]]:
        """
        Update multiple workflow approvals in batch.
        
        Args:
            updates: List of (approval_id, decision, comments) tuples
            
        Returns:
            Tuple of (success_count, error_messages)
        """
        if not updates:
            return 0, []
        
        success_count = 0
        errors = []
        
        # Process updates concurrently with semaphore
        semaphore = asyncio.Semaphore(10)
        
        async def update_single(
            approval_id: UUID,
            decision: str,
            comments: Optional[str]
        ) -> bool:
            async with semaphore:
                try:
                    update_data = {
                        "status": decision,
                        "comments": comments,
                        "approved_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    result = self.db.table("workflow_approvals").update(update_data).eq(
                        "id", str(approval_id)
                    ).execute()
                    
                    return bool(result.data)
                    
                except Exception as e:
                    errors.append(f"Approval {approval_id}: {str(e)}")
                    logger.error(f"Error updating approval {approval_id}: {e}")
                    return False
        
        # Execute updates concurrently
        tasks = [
            update_single(approval_id, decision, comments)
            for approval_id, decision, comments in updates
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is True)
        
        logger.info(f"Updated {success_count}/{len(updates)} approvals in batch")
        
        return success_count, errors
    
    # ==================== Batch Query Operations ====================
    
    async def get_workflow_instances_batch(
        self,
        instance_ids: List[UUID]
    ) -> Dict[UUID, Optional[Dict[str, Any]]]:
        """
        Get multiple workflow instances in batch.
        
        Args:
            instance_ids: List of instance IDs to retrieve
            
        Returns:
            Dict mapping instance_id to instance data (or None if not found)
        """
        if not instance_ids:
            return {}
        
        result_map = {}
        
        # Process in batches
        for i in range(0, len(instance_ids), self.batch_size):
            batch = instance_ids[i:i + self.batch_size]
            
            try:
                # Convert UUIDs to strings for query
                id_strings = [str(id) for id in batch]
                
                # Execute batch query
                result = self.db.table("workflow_instances").select("*").in_(
                    "id", id_strings
                ).execute()
                
                if result.data:
                    # Map results by ID
                    for instance_data in result.data:
                        instance_id = UUID(instance_data["id"])
                        result_map[instance_id] = instance_data
                
                # Mark missing instances as None
                for instance_id in batch:
                    if instance_id not in result_map:
                        result_map[instance_id] = None
                
            except Exception as e:
                logger.error(f"Error getting workflow instances batch: {e}")
                # Mark all in batch as None on error
                for instance_id in batch:
                    if instance_id not in result_map:
                        result_map[instance_id] = None
        
        return result_map
    
    async def get_approvals_for_instances_batch(
        self,
        instance_ids: List[UUID]
    ) -> Dict[UUID, List[Dict[str, Any]]]:
        """
        Get approvals for multiple workflow instances in batch.
        
        Args:
            instance_ids: List of instance IDs
            
        Returns:
            Dict mapping instance_id to list of approvals
        """
        if not instance_ids:
            return {}
        
        result_map = {instance_id: [] for instance_id in instance_ids}
        
        # Process in batches
        for i in range(0, len(instance_ids), self.batch_size):
            batch = instance_ids[i:i + self.batch_size]
            
            try:
                # Convert UUIDs to strings for query
                id_strings = [str(id) for id in batch]
                
                # Execute batch query
                result = self.db.table("workflow_approvals").select("*").in_(
                    "workflow_instance_id", id_strings
                ).order("step_number").execute()
                
                if result.data:
                    # Group approvals by instance ID
                    for approval_data in result.data:
                        instance_id = UUID(approval_data["workflow_instance_id"])
                        if instance_id in result_map:
                            result_map[instance_id].append(approval_data)
                
            except Exception as e:
                logger.error(f"Error getting approvals for instances batch: {e}")
        
        return result_map
    
    # ==================== Batch Status Operations ====================
    
    async def get_workflow_statuses_batch(
        self,
        instance_ids: List[UUID]
    ) -> Dict[UUID, Dict[str, Any]]:
        """
        Get status information for multiple workflow instances in batch.
        
        This is an optimized operation that retrieves instances and their
        approvals in a single batch operation.
        
        Args:
            instance_ids: List of instance IDs
            
        Returns:
            Dict mapping instance_id to status information
        """
        if not instance_ids:
            return {}
        
        # Get instances and approvals in parallel
        instances_task = self.get_workflow_instances_batch(instance_ids)
        approvals_task = self.get_approvals_for_instances_batch(instance_ids)
        
        instances_map, approvals_map = await asyncio.gather(
            instances_task,
            approvals_task
        )
        
        # Combine into status information
        status_map = {}
        
        for instance_id in instance_ids:
            instance_data = instances_map.get(instance_id)
            approvals = approvals_map.get(instance_id, [])
            
            if instance_data:
                # Group approvals by step
                approvals_by_step = {}
                for approval in approvals:
                    step_num = approval["step_number"]
                    if step_num not in approvals_by_step:
                        approvals_by_step[step_num] = []
                    
                    approvals_by_step[step_num].append({
                        "id": approval["id"],
                        "approver_id": approval["approver_id"],
                        "status": approval["status"],
                        "comments": approval["comments"],
                        "approved_at": approval.get("approved_at")
                    })
                
                status_map[instance_id] = {
                    "id": instance_data["id"],
                    "workflow_id": instance_data["workflow_id"],
                    "entity_type": instance_data["entity_type"],
                    "entity_id": instance_data["entity_id"],
                    "current_step": instance_data["current_step"],
                    "status": instance_data["status"],
                    "approvals": approvals_by_step,
                    "started_at": instance_data["started_at"],
                    "completed_at": instance_data.get("completed_at"),
                    "updated_at": instance_data["updated_at"]
                }
            else:
                status_map[instance_id] = None
        
        logger.info(f"Retrieved status for {len(status_map)} workflow instances in batch")
        
        return status_map
    
    # ==================== Batch Cleanup Operations ====================
    
    async def expire_approvals_batch(
        self,
        approval_ids: List[UUID]
    ) -> Tuple[int, List[str]]:
        """
        Expire multiple approvals in batch.
        
        Args:
            approval_ids: List of approval IDs to expire
            
        Returns:
            Tuple of (success_count, error_messages)
        """
        if not approval_ids:
            return 0, []
        
        updates = [
            (approval_id, ApprovalStatus.EXPIRED.value, "Approval expired")
            for approval_id in approval_ids
        ]
        
        return await self.update_approvals_batch(updates)
    
    async def cancel_workflow_instances_batch(
        self,
        instance_ids: List[UUID],
        reason: str
    ) -> Tuple[int, List[str]]:
        """
        Cancel multiple workflow instances in batch.
        
        Args:
            instance_ids: List of instance IDs to cancel
            reason: Cancellation reason
            
        Returns:
            Tuple of (success_count, error_messages)
        """
        if not instance_ids:
            return 0, []
        
        updates = [
            (instance_id, {
                "status": WorkflowStatus.CANCELLED.value,
                "cancelled_at": datetime.utcnow().isoformat(),
                "cancellation_reason": reason
            })
            for instance_id in instance_ids
        ]
        
        return await self.update_workflow_instances_batch(updates)
    
    # ==================== Statistics ====================
    
    def get_batch_size(self) -> int:
        """
        Get current batch size.
        
        Returns:
            Batch size
        """
        return self.batch_size
    
    def set_batch_size(self, batch_size: int) -> None:
        """
        Set batch size for operations.
        
        Args:
            batch_size: New batch size
        """
        if batch_size < 1:
            raise ValueError("Batch size must be at least 1")
        
        self.batch_size = batch_size
        logger.info(f"Updated batch size to {batch_size}")
