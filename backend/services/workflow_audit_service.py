"""
Workflow Audit Trail and Recovery Logging Service

Comprehensive audit logging for all workflow events, error conditions,
and recovery actions. Provides complete traceability and compliance support.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from enum import Enum

from supabase import Client

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    """Types of audit events"""
    # Workflow lifecycle events
    WORKFLOW_CREATED = "workflow_created"
    WORKFLOW_UPDATED = "workflow_updated"
    WORKFLOW_DELETED = "workflow_deleted"
    WORKFLOW_ACTIVATED = "workflow_activated"
    WORKFLOW_DEACTIVATED = "workflow_deactivated"
    
    # Instance lifecycle events
    INSTANCE_CREATED = "instance_created"
    INSTANCE_STARTED = "instance_started"
    INSTANCE_COMPLETED = "instance_completed"
    INSTANCE_REJECTED = "instance_rejected"
    INSTANCE_CANCELLED = "instance_cancelled"
    INSTANCE_SUSPENDED = "instance_suspended"
    INSTANCE_RESUMED = "instance_resumed"
    
    # Approval events
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    APPROVAL_DELEGATED = "approval_delegated"
    APPROVAL_EXPIRED = "approval_expired"
    
    # Step transition events
    STEP_STARTED = "step_started"
    STEP_COMPLETED = "step_completed"
    STEP_FAILED = "step_failed"
    
    # Error and recovery events
    ERROR_OCCURRED = "error_occurred"
    RECOVERY_INITIATED = "recovery_initiated"
    RECOVERY_COMPLETED = "recovery_completed"
    RECOVERY_FAILED = "recovery_failed"
    
    # Escalation and delegation events
    ESCALATION_INITIATED = "escalation_initiated"
    ESCALATION_COMPLETED = "escalation_completed"
    DELEGATION_INITIATED = "delegation_initiated"
    DELEGATION_COMPLETED = "delegation_completed"
    
    # Data consistency events
    INCONSISTENCY_DETECTED = "inconsistency_detected"
    RECONCILIATION_INITIATED = "reconciliation_initiated"
    RECONCILIATION_COMPLETED = "reconciliation_completed"
    
    # Notification events
    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_FAILED = "notification_failed"
    
    # System events
    SYSTEM_ERROR = "system_error"
    SYSTEM_RECOVERY = "system_recovery"


class WorkflowAuditService:
    """
    Comprehensive audit trail and recovery logging service.
    
    Provides:
    - Complete audit logging for all workflow events
    - Error condition and recovery action audit trails
    - Query and reporting capabilities
    - Compliance and traceability support
    """
    
    def __init__(self, db: Client):
        """
        Initialize audit service with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self._audit_buffer: List[Dict[str, Any]] = []
        self._buffer_size = 100
    
    # ==================== Core Audit Logging ====================
    
    async def log_event(
        self,
        event_type: AuditEventType,
        workflow_id: Optional[UUID] = None,
        workflow_instance_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        approval_id: Optional[UUID] = None,
        event_data: Optional[Dict[str, Any]] = None,
        severity: str = "info",
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log a workflow audit event.
        
        Args:
            event_type: Type of audit event
            workflow_id: Optional workflow definition ID
            workflow_instance_id: Optional workflow instance ID
            user_id: Optional user ID who triggered the event
            approval_id: Optional approval ID
            event_data: Optional additional event data
            severity: Event severity (info, warning, error, critical)
            message: Optional human-readable message
            
        Returns:
            Dict containing audit log entry
        """
        try:
            audit_entry = {
                "event_type": event_type.value,
                "workflow_id": str(workflow_id) if workflow_id else None,
                "workflow_instance_id": str(workflow_instance_id) if workflow_instance_id else None,
                "user_id": str(user_id) if user_id else None,
                "approval_id": str(approval_id) if approval_id else None,
                "event_data": event_data or {},
                "severity": severity,
                "message": message or f"Workflow event: {event_type.value}",
                "timestamp": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Add to buffer
            self._audit_buffer.append(audit_entry)
            
            # Flush buffer if full
            if len(self._audit_buffer) >= self._buffer_size:
                await self._flush_audit_buffer()
            
            # Also log immediately for critical events
            if severity in ["error", "critical"]:
                await self._write_audit_entry(audit_entry)
            
            # Log to system logger
            log_level = self._get_log_level(severity)
            logger.log(
                log_level,
                f"Audit: {event_type.value} - {message or 'No message'}",
                extra={
                    "event_type": event_type.value,
                    "workflow_id": str(workflow_id) if workflow_id else None,
                    "workflow_instance_id": str(workflow_instance_id) if workflow_instance_id else None,
                    "event_data": event_data
                }
            )
            
            return audit_entry
            
        except Exception as e:
            logger.error(f"Error logging audit event: {e}", exc_info=True)
            return {
                "error": str(e),
                "event_type": event_type.value,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _write_audit_entry(self, audit_entry: Dict[str, Any]) -> bool:
        """
        Write a single audit entry to database.
        
        Args:
            audit_entry: Audit entry to write
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.db.table("workflow_audit_logs").insert(audit_entry).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error writing audit entry to database: {e}", exc_info=True)
            return False
    
    async def _flush_audit_buffer(self) -> None:
        """
        Flush audit buffer to database.
        """
        if not self._audit_buffer:
            return
        
        try:
            # Batch insert audit entries
            result = self.db.table("workflow_audit_logs").insert(
                self._audit_buffer
            ).execute()
            
            if result.data:
                logger.debug(f"Flushed {len(self._audit_buffer)} audit entries to database")
                self._audit_buffer.clear()
            else:
                logger.warning("Failed to flush audit buffer - no data returned")
                
        except Exception as e:
            logger.error(f"Error flushing audit buffer: {e}", exc_info=True)
            # Keep buffer for retry
    
    # ==================== Workflow Lifecycle Audit ====================
    
    async def log_workflow_created(
        self,
        workflow_id: UUID,
        workflow_name: str,
        created_by: UUID,
        workflow_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Log workflow definition creation.
        
        Args:
            workflow_id: Workflow ID
            workflow_name: Workflow name
            created_by: User ID who created the workflow
            workflow_data: Workflow definition data
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.WORKFLOW_CREATED,
            workflow_id=workflow_id,
            user_id=created_by,
            event_data={
                "workflow_name": workflow_name,
                "step_count": len(workflow_data.get("steps", [])),
                "trigger_count": len(workflow_data.get("triggers", []))
            },
            message=f"Workflow '{workflow_name}' created by user {created_by}"
        )
    
    async def log_instance_created(
        self,
        workflow_instance_id: UUID,
        workflow_id: UUID,
        workflow_name: str,
        initiated_by: UUID,
        entity_type: str,
        entity_id: UUID,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Log workflow instance creation.
        
        Args:
            workflow_instance_id: Workflow instance ID
            workflow_id: Workflow definition ID
            workflow_name: Workflow name
            initiated_by: User ID who initiated the workflow
            entity_type: Entity type
            entity_id: Entity ID
            context: Workflow context
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.INSTANCE_CREATED,
            workflow_id=workflow_id,
            workflow_instance_id=workflow_instance_id,
            user_id=initiated_by,
            event_data={
                "workflow_name": workflow_name,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "context": context
            },
            message=f"Workflow instance created for '{workflow_name}' by user {initiated_by}"
        )
    
    async def log_instance_completed(
        self,
        workflow_instance_id: UUID,
        workflow_id: UUID,
        workflow_name: str,
        duration_seconds: float,
        step_count: int
    ) -> Dict[str, Any]:
        """
        Log workflow instance completion.
        
        Args:
            workflow_instance_id: Workflow instance ID
            workflow_id: Workflow definition ID
            workflow_name: Workflow name
            duration_seconds: Duration in seconds
            step_count: Number of steps completed
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.INSTANCE_COMPLETED,
            workflow_id=workflow_id,
            workflow_instance_id=workflow_instance_id,
            event_data={
                "workflow_name": workflow_name,
                "duration_seconds": duration_seconds,
                "step_count": step_count
            },
            message=f"Workflow instance completed for '{workflow_name}' in {duration_seconds:.2f}s"
        )
    
    async def log_instance_rejected(
        self,
        workflow_instance_id: UUID,
        workflow_id: UUID,
        workflow_name: str,
        rejected_by: UUID,
        step_number: int,
        reason: Optional[str]
    ) -> Dict[str, Any]:
        """
        Log workflow instance rejection.
        
        Args:
            workflow_instance_id: Workflow instance ID
            workflow_id: Workflow definition ID
            workflow_name: Workflow name
            rejected_by: User ID who rejected
            step_number: Step number where rejection occurred
            reason: Rejection reason
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.INSTANCE_REJECTED,
            workflow_id=workflow_id,
            workflow_instance_id=workflow_instance_id,
            user_id=rejected_by,
            event_data={
                "workflow_name": workflow_name,
                "step_number": step_number,
                "reason": reason
            },
            severity="warning",
            message=f"Workflow instance rejected at step {step_number} by user {rejected_by}"
        )
    
    # ==================== Approval Audit ====================
    
    async def log_approval_requested(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        approver_id: UUID,
        step_number: int,
        step_name: str,
        expires_at: Optional[datetime]
    ) -> Dict[str, Any]:
        """
        Log approval request.
        
        Args:
            approval_id: Approval ID
            workflow_instance_id: Workflow instance ID
            approver_id: Approver user ID
            step_number: Step number
            step_name: Step name
            expires_at: Expiration timestamp
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.APPROVAL_REQUESTED,
            workflow_instance_id=workflow_instance_id,
            user_id=approver_id,
            approval_id=approval_id,
            event_data={
                "step_number": step_number,
                "step_name": step_name,
                "expires_at": expires_at.isoformat() if expires_at else None
            },
            message=f"Approval requested from user {approver_id} for step '{step_name}'"
        )
    
    async def log_approval_decision(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        approver_id: UUID,
        decision: str,
        comments: Optional[str],
        step_number: int
    ) -> Dict[str, Any]:
        """
        Log approval decision.
        
        Args:
            approval_id: Approval ID
            workflow_instance_id: Workflow instance ID
            approver_id: Approver user ID
            decision: Approval decision
            comments: Optional comments
            step_number: Step number
            
        Returns:
            Audit log entry
        """
        event_type = (
            AuditEventType.APPROVAL_APPROVED if decision == "approved"
            else AuditEventType.APPROVAL_REJECTED
        )
        
        return await self.log_event(
            event_type=event_type,
            workflow_instance_id=workflow_instance_id,
            user_id=approver_id,
            approval_id=approval_id,
            event_data={
                "decision": decision,
                "comments": comments,
                "step_number": step_number
            },
            severity="warning" if decision == "rejected" else "info",
            message=f"Approval {decision} by user {approver_id} at step {step_number}"
        )
    
    # ==================== Error and Recovery Audit ====================
    
    async def log_error(
        self,
        error_category: str,
        error_severity: str,
        error_message: str,
        workflow_instance_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        context: Optional[Dict[str, Any]] = None,
        traceback: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log workflow error.
        
        Args:
            error_category: Error category
            error_severity: Error severity
            error_message: Error message
            workflow_instance_id: Optional workflow instance ID
            workflow_id: Optional workflow ID
            context: Optional error context
            traceback: Optional error traceback
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.ERROR_OCCURRED,
            workflow_id=workflow_id,
            workflow_instance_id=workflow_instance_id,
            event_data={
                "error_category": error_category,
                "error_message": error_message,
                "context": context or {},
                "traceback": traceback
            },
            severity=error_severity,
            message=f"Workflow error [{error_category}]: {error_message}"
        )
    
    async def log_recovery_action(
        self,
        recovery_action: str,
        recovery_result: Dict[str, Any],
        workflow_instance_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        original_error: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log recovery action.
        
        Args:
            recovery_action: Recovery action taken
            recovery_result: Result of recovery action
            workflow_instance_id: Optional workflow instance ID
            workflow_id: Optional workflow ID
            original_error: Optional original error message
            
        Returns:
            Audit log entry
        """
        event_type = (
            AuditEventType.RECOVERY_COMPLETED if recovery_result.get("success")
            else AuditEventType.RECOVERY_FAILED
        )
        
        return await self.log_event(
            event_type=event_type,
            workflow_id=workflow_id,
            workflow_instance_id=workflow_instance_id,
            event_data={
                "recovery_action": recovery_action,
                "recovery_result": recovery_result,
                "original_error": original_error
            },
            severity="info" if recovery_result.get("success") else "error",
            message=f"Recovery action '{recovery_action}' {'completed' if recovery_result.get('success') else 'failed'}"
        )
    
    async def log_escalation(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        reason: str,
        escalation_approvers: List[UUID],
        original_approver_id: UUID
    ) -> Dict[str, Any]:
        """
        Log escalation action.
        
        Args:
            approval_id: Original approval ID
            workflow_instance_id: Workflow instance ID
            reason: Escalation reason
            escalation_approvers: List of escalation approver IDs
            original_approver_id: Original approver ID
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.ESCALATION_INITIATED,
            workflow_instance_id=workflow_instance_id,
            approval_id=approval_id,
            event_data={
                "reason": reason,
                "escalation_approvers": [str(a) for a in escalation_approvers],
                "original_approver_id": str(original_approver_id),
                "escalation_count": len(escalation_approvers)
            },
            severity="warning",
            message=f"Approval escalated from {original_approver_id} to {len(escalation_approvers)} approvers: {reason}"
        )
    
    async def log_delegation(
        self,
        approval_id: UUID,
        workflow_instance_id: UUID,
        delegator_id: UUID,
        delegate_to_id: UUID,
        reason: str
    ) -> Dict[str, Any]:
        """
        Log delegation action.
        
        Args:
            approval_id: Approval ID
            workflow_instance_id: Workflow instance ID
            delegator_id: Delegator user ID
            delegate_to_id: Delegate user ID
            reason: Delegation reason
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.DELEGATION_INITIATED,
            workflow_instance_id=workflow_instance_id,
            user_id=delegator_id,
            approval_id=approval_id,
            event_data={
                "delegate_to_id": str(delegate_to_id),
                "reason": reason
            },
            message=f"Approval delegated from {delegator_id} to {delegate_to_id}: {reason}"
        )
    
    async def log_data_inconsistency(
        self,
        workflow_instance_id: UUID,
        inconsistency_type: str,
        inconsistency_details: Dict[str, Any],
        severity: str = "warning"
    ) -> Dict[str, Any]:
        """
        Log data inconsistency detection.
        
        Args:
            workflow_instance_id: Workflow instance ID
            inconsistency_type: Type of inconsistency
            inconsistency_details: Details of the inconsistency
            severity: Severity level
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.INCONSISTENCY_DETECTED,
            workflow_instance_id=workflow_instance_id,
            event_data={
                "inconsistency_type": inconsistency_type,
                "details": inconsistency_details
            },
            severity=severity,
            message=f"Data inconsistency detected: {inconsistency_type}"
        )
    
    async def log_reconciliation(
        self,
        workflow_instance_id: UUID,
        reconciliation_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Log data reconciliation action.
        
        Args:
            workflow_instance_id: Workflow instance ID
            reconciliation_result: Result of reconciliation
            
        Returns:
            Audit log entry
        """
        return await self.log_event(
            event_type=AuditEventType.RECONCILIATION_COMPLETED,
            workflow_instance_id=workflow_instance_id,
            event_data=reconciliation_result,
            message=f"Data reconciliation completed: {len(reconciliation_result.get('repairs', []))} repairs made"
        )
    
    # ==================== Query and Reporting ====================
    
    async def get_audit_trail(
        self,
        workflow_instance_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        event_types: Optional[List[AuditEventType]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        severity: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Query audit trail with filters.
        
        Args:
            workflow_instance_id: Optional workflow instance ID filter
            workflow_id: Optional workflow ID filter
            event_types: Optional list of event types to filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            severity: Optional severity filter
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of audit log entries
        """
        try:
            # Flush buffer first to ensure latest entries are included
            await self._flush_audit_buffer()
            
            query = self.db.table("workflow_audit_logs").select("*")
            
            if workflow_instance_id:
                query = query.eq("workflow_instance_id", str(workflow_instance_id))
            
            if workflow_id:
                query = query.eq("workflow_id", str(workflow_id))
            
            if event_types:
                event_type_values = [et.value for et in event_types]
                query = query.in_("event_type", event_type_values)
            
            if start_date:
                query = query.gte("timestamp", start_date.isoformat())
            
            if end_date:
                query = query.lte("timestamp", end_date.isoformat())
            
            if severity:
                query = query.eq("severity", severity)
            
            result = query.order("timestamp", desc=True).range(
                offset, offset + limit - 1
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error querying audit trail: {e}", exc_info=True)
            return []
    
    async def get_error_history(
        self,
        workflow_instance_id: Optional[UUID] = None,
        error_category: Optional[str] = None,
        start_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get error history with filters.
        
        Args:
            workflow_instance_id: Optional workflow instance ID filter
            error_category: Optional error category filter
            start_date: Optional start date filter
            limit: Maximum number of results
            
        Returns:
            List of error audit entries
        """
        return await self.get_audit_trail(
            workflow_instance_id=workflow_instance_id,
            event_types=[AuditEventType.ERROR_OCCURRED],
            start_date=start_date,
            limit=limit
        )
    
    async def get_recovery_history(
        self,
        workflow_instance_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recovery action history with filters.
        
        Args:
            workflow_instance_id: Optional workflow instance ID filter
            start_date: Optional start date filter
            limit: Maximum number of results
            
        Returns:
            List of recovery audit entries
        """
        return await self.get_audit_trail(
            workflow_instance_id=workflow_instance_id,
            event_types=[
                AuditEventType.RECOVERY_INITIATED,
                AuditEventType.RECOVERY_COMPLETED,
                AuditEventType.RECOVERY_FAILED
            ],
            start_date=start_date,
            limit=limit
        )
    
    async def generate_audit_report(
        self,
        workflow_instance_id: UUID
    ) -> Dict[str, Any]:
        """
        Generate comprehensive audit report for a workflow instance.
        
        Args:
            workflow_instance_id: Workflow instance ID
            
        Returns:
            Dict containing audit report
        """
        try:
            # Get all audit entries for instance
            audit_entries = await self.get_audit_trail(
                workflow_instance_id=workflow_instance_id,
                limit=1000
            )
            
            # Categorize entries
            lifecycle_events = []
            approval_events = []
            error_events = []
            recovery_events = []
            escalation_events = []
            delegation_events = []
            
            for entry in audit_entries:
                event_type = entry["event_type"]
                
                if event_type in [
                    AuditEventType.INSTANCE_CREATED.value,
                    AuditEventType.INSTANCE_STARTED.value,
                    AuditEventType.INSTANCE_COMPLETED.value,
                    AuditEventType.INSTANCE_REJECTED.value,
                    AuditEventType.INSTANCE_CANCELLED.value
                ]:
                    lifecycle_events.append(entry)
                
                elif event_type in [
                    AuditEventType.APPROVAL_REQUESTED.value,
                    AuditEventType.APPROVAL_APPROVED.value,
                    AuditEventType.APPROVAL_REJECTED.value
                ]:
                    approval_events.append(entry)
                
                elif event_type == AuditEventType.ERROR_OCCURRED.value:
                    error_events.append(entry)
                
                elif event_type in [
                    AuditEventType.RECOVERY_INITIATED.value,
                    AuditEventType.RECOVERY_COMPLETED.value,
                    AuditEventType.RECOVERY_FAILED.value
                ]:
                    recovery_events.append(entry)
                
                elif event_type in [
                    AuditEventType.ESCALATION_INITIATED.value,
                    AuditEventType.ESCALATION_COMPLETED.value
                ]:
                    escalation_events.append(entry)
                
                elif event_type in [
                    AuditEventType.DELEGATION_INITIATED.value,
                    AuditEventType.DELEGATION_COMPLETED.value
                ]:
                    delegation_events.append(entry)
            
            # Calculate statistics
            total_approvals = len([e for e in approval_events if e["event_type"] == AuditEventType.APPROVAL_REQUESTED.value])
            approved_count = len([e for e in approval_events if e["event_type"] == AuditEventType.APPROVAL_APPROVED.value])
            rejected_count = len([e for e in approval_events if e["event_type"] == AuditEventType.APPROVAL_REJECTED.value])
            
            return {
                "workflow_instance_id": str(workflow_instance_id),
                "generated_at": datetime.utcnow().isoformat(),
                "summary": {
                    "total_events": len(audit_entries),
                    "lifecycle_events": len(lifecycle_events),
                    "approval_events": len(approval_events),
                    "error_events": len(error_events),
                    "recovery_events": len(recovery_events),
                    "escalation_events": len(escalation_events),
                    "delegation_events": len(delegation_events)
                },
                "approval_statistics": {
                    "total_approvals": total_approvals,
                    "approved": approved_count,
                    "rejected": rejected_count,
                    "approval_rate": (approved_count / total_approvals * 100) if total_approvals > 0 else 0
                },
                "events": {
                    "lifecycle": lifecycle_events,
                    "approvals": approval_events,
                    "errors": error_events,
                    "recovery": recovery_events,
                    "escalations": escalation_events,
                    "delegations": delegation_events
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating audit report: {e}", exc_info=True)
            return {
                "error": str(e),
                "workflow_instance_id": str(workflow_instance_id)
            }
    
    # ==================== Utility Methods ====================
    
    def _get_log_level(self, severity: str) -> int:
        """
        Get logging level for severity.
        
        Args:
            severity: Severity string
            
        Returns:
            Logging level constant
        """
        severity_map = {
            "critical": logging.CRITICAL,
            "error": logging.ERROR,
            "warning": logging.WARNING,
            "info": logging.INFO,
            "debug": logging.DEBUG
        }
        return severity_map.get(severity.lower(), logging.INFO)
    
    async def flush(self) -> None:
        """
        Flush audit buffer to database.
        """
        await self._flush_audit_buffer()
