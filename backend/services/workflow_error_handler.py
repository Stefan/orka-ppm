"""
Workflow Error Handler

Comprehensive error handling and recovery system for workflow engine.
Provides detailed error logging, system stability measures, and error recovery mechanisms.
"""

import logging
import traceback
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID
from enum import Enum

from supabase import Client

logger = logging.getLogger(__name__)


class ErrorSeverity(str, Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(str, Enum):
    """Error categories for classification"""
    VALIDATION = "validation"
    DATABASE = "database"
    PERMISSION = "permission"
    TIMEOUT = "timeout"
    ESCALATION = "escalation"
    DELEGATION = "delegation"
    STATE_TRANSITION = "state_transition"
    NOTIFICATION = "notification"
    INTEGRATION = "integration"
    SYSTEM = "system"


class RecoveryAction(str, Enum):
    """Recovery actions that can be taken"""
    RETRY = "retry"
    ROLLBACK = "rollback"
    ESCALATE = "escalate"
    NOTIFY_ADMIN = "notify_admin"
    MANUAL_INTERVENTION = "manual_intervention"
    IGNORE = "ignore"


class WorkflowError(Exception):
    """Base workflow error with context"""
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        severity: ErrorSeverity,
        context: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.severity = severity
        self.context = context or {}
        self.original_error = original_error
        self.timestamp = datetime.utcnow()
        self.traceback = traceback.format_exc() if original_error else None


class WorkflowErrorHandler:
    """
    Comprehensive error handler for workflow engine.
    
    Provides:
    - Detailed error logging with workflow context
    - System stability measures
    - Error recovery mechanisms
    - Audit trail of errors and recovery actions
    """
    
    def __init__(self, db: Client):
        """
        Initialize error handler with database client.
        
        Args:
            db: Supabase client instance
        """
        if not db:
            raise ValueError("Database client is required")
        
        self.db = db
        self._error_history: List[Dict[str, Any]] = []
        self._recovery_attempts: Dict[str, int] = {}
    
    async def handle_error(
        self,
        error: Exception,
        category: ErrorCategory,
        severity: ErrorSeverity,
        workflow_instance_id: Optional[UUID] = None,
        workflow_id: Optional[UUID] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Handle a workflow error with comprehensive logging and recovery.
        
        Args:
            error: The exception that occurred
            category: Error category
            severity: Error severity level
            workflow_instance_id: Optional workflow instance ID
            workflow_id: Optional workflow definition ID
            context: Optional additional context
            
        Returns:
            Dict containing error handling result and recovery actions
        """
        try:
            # Create workflow error object
            workflow_error = WorkflowError(
                message=str(error),
                category=category,
                severity=severity,
                context=context or {},
                original_error=error
            )
            
            # Add workflow context
            if workflow_instance_id:
                workflow_error.context["workflow_instance_id"] = str(workflow_instance_id)
            if workflow_id:
                workflow_error.context["workflow_id"] = str(workflow_id)
            
            # Log error with full context
            await self._log_error(workflow_error)
            
            # Add to error history
            self._error_history.append({
                "timestamp": workflow_error.timestamp.isoformat(),
                "category": category.value,
                "severity": severity.value,
                "message": workflow_error.message,
                "context": workflow_error.context
            })
            
            # Determine recovery action
            recovery_action = self._determine_recovery_action(
                workflow_error,
                workflow_instance_id
            )
            
            # Execute recovery action
            recovery_result = await self._execute_recovery_action(
                recovery_action,
                workflow_error,
                workflow_instance_id
            )
            
            # Log recovery action
            await self._log_recovery_action(
                workflow_error,
                recovery_action,
                recovery_result
            )
            
            return {
                "error_id": str(workflow_error.timestamp.timestamp()),
                "category": category.value,
                "severity": severity.value,
                "message": workflow_error.message,
                "recovery_action": recovery_action.value,
                "recovery_result": recovery_result,
                "timestamp": workflow_error.timestamp.isoformat()
            }
            
        except Exception as e:
            # Critical error in error handler - log to system logger
            logger.critical(
                f"Critical error in workflow error handler: {e}",
                exc_info=True
            )
            
            # Return minimal error response
            return {
                "error_id": str(datetime.utcnow().timestamp()),
                "category": ErrorCategory.SYSTEM.value,
                "severity": ErrorSeverity.CRITICAL.value,
                "message": "Error handler failure",
                "recovery_action": RecoveryAction.NOTIFY_ADMIN.value,
                "recovery_result": {"success": False, "error": str(e)}
            }
    
    async def _log_error(self, error: WorkflowError) -> None:
        """
        Log error with comprehensive context to database and system logger.
        
        Args:
            error: WorkflowError instance
        """
        try:
            # Log to system logger with appropriate level
            log_level = self._get_log_level(error.severity)
            logger.log(
                log_level,
                f"Workflow Error [{error.category.value}]: {error.message}",
                extra={
                    "category": error.category.value,
                    "severity": error.severity.value,
                    "context": error.context,
                    "traceback": error.traceback
                }
            )
            
            # Log to database audit trail
            audit_data = {
                "event_type": "workflow_error",
                "severity": error.severity.value,
                "category": error.category.value,
                "message": error.message,
                "context": {
                    **error.context,
                    "traceback": error.traceback,
                    "timestamp": error.timestamp.isoformat()
                },
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Add workflow instance ID if available
            if "workflow_instance_id" in error.context:
                audit_data["workflow_instance_id"] = error.context["workflow_instance_id"]
            
            # Insert into audit log
            try:
                self.db.table("workflow_error_logs").insert(audit_data).execute()
            except Exception as db_error:
                # If database logging fails, log to system logger only
                logger.error(
                    f"Failed to log error to database: {db_error}",
                    exc_info=True
                )
            
        except Exception as e:
            logger.critical(
                f"Failed to log workflow error: {e}",
                exc_info=True
            )
    
    async def _log_recovery_action(
        self,
        error: WorkflowError,
        recovery_action: RecoveryAction,
        recovery_result: Dict[str, Any]
    ) -> None:
        """
        Log recovery action to audit trail.
        
        Args:
            error: WorkflowError instance
            recovery_action: Recovery action taken
            recovery_result: Result of recovery action
        """
        try:
            audit_data = {
                "event_type": "workflow_error_recovery",
                "severity": error.severity.value,
                "category": error.category.value,
                "recovery_action": recovery_action.value,
                "recovery_result": recovery_result,
                "original_error": error.message,
                "context": error.context,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Add workflow instance ID if available
            if "workflow_instance_id" in error.context:
                audit_data["workflow_instance_id"] = error.context["workflow_instance_id"]
            
            # Insert into audit log
            try:
                self.db.table("workflow_error_logs").insert(audit_data).execute()
            except Exception as db_error:
                logger.error(
                    f"Failed to log recovery action to database: {db_error}",
                    exc_info=True
                )
            
            # Log to system logger
            logger.info(
                f"Recovery action [{recovery_action.value}] executed for error: {error.message}",
                extra={
                    "recovery_result": recovery_result,
                    "context": error.context
                }
            )
            
        except Exception as e:
            logger.error(
                f"Failed to log recovery action: {e}",
                exc_info=True
            )
    
    def _determine_recovery_action(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> RecoveryAction:
        """
        Determine appropriate recovery action based on error characteristics.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            RecoveryAction to take
        """
        # Check recovery attempt count
        error_key = f"{error.category.value}:{workflow_instance_id or 'global'}"
        attempt_count = self._recovery_attempts.get(error_key, 0)
        
        # Critical errors require immediate admin notification
        if error.severity == ErrorSeverity.CRITICAL:
            return RecoveryAction.NOTIFY_ADMIN
        
        # High severity errors with multiple attempts require manual intervention
        if error.severity == ErrorSeverity.HIGH and attempt_count >= 2:
            return RecoveryAction.MANUAL_INTERVENTION
        
        # Category-specific recovery actions
        if error.category == ErrorCategory.VALIDATION:
            return RecoveryAction.ROLLBACK
        
        elif error.category == ErrorCategory.DATABASE:
            if attempt_count < 3:
                return RecoveryAction.RETRY
            else:
                return RecoveryAction.NOTIFY_ADMIN
        
        elif error.category == ErrorCategory.TIMEOUT:
            return RecoveryAction.ESCALATE
        
        elif error.category == ErrorCategory.PERMISSION:
            return RecoveryAction.NOTIFY_ADMIN
        
        elif error.category in [ErrorCategory.ESCALATION, ErrorCategory.DELEGATION]:
            if attempt_count < 2:
                return RecoveryAction.RETRY
            else:
                return RecoveryAction.NOTIFY_ADMIN
        
        elif error.category == ErrorCategory.STATE_TRANSITION:
            return RecoveryAction.ROLLBACK
        
        elif error.category == ErrorCategory.NOTIFICATION:
            # Notification failures are non-critical
            return RecoveryAction.IGNORE
        
        elif error.category == ErrorCategory.INTEGRATION:
            if attempt_count < 3:
                return RecoveryAction.RETRY
            else:
                return RecoveryAction.MANUAL_INTERVENTION
        
        else:
            # Default to notification for unknown categories
            return RecoveryAction.NOTIFY_ADMIN
    
    async def _execute_recovery_action(
        self,
        recovery_action: RecoveryAction,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute the determined recovery action.
        
        Args:
            recovery_action: Recovery action to execute
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing recovery result
        """
        try:
            # Track recovery attempt
            error_key = f"{error.category.value}:{workflow_instance_id or 'global'}"
            self._recovery_attempts[error_key] = self._recovery_attempts.get(error_key, 0) + 1
            
            if recovery_action == RecoveryAction.RETRY:
                return await self._execute_retry(error, workflow_instance_id)
            
            elif recovery_action == RecoveryAction.ROLLBACK:
                return await self._execute_rollback(error, workflow_instance_id)
            
            elif recovery_action == RecoveryAction.ESCALATE:
                return await self._execute_escalate(error, workflow_instance_id)
            
            elif recovery_action == RecoveryAction.NOTIFY_ADMIN:
                return await self._execute_notify_admin(error, workflow_instance_id)
            
            elif recovery_action == RecoveryAction.MANUAL_INTERVENTION:
                return await self._execute_manual_intervention(error, workflow_instance_id)
            
            elif recovery_action == RecoveryAction.IGNORE:
                return {"success": True, "action": "ignored", "reason": "non-critical error"}
            
            else:
                return {"success": False, "error": f"Unknown recovery action: {recovery_action}"}
            
        except Exception as e:
            logger.error(
                f"Failed to execute recovery action {recovery_action}: {e}",
                exc_info=True
            )
            return {"success": False, "error": str(e)}
    
    async def _execute_retry(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute retry recovery action.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing retry result
        """
        # For now, just log the retry intent
        # Actual retry logic would be implemented by the calling code
        logger.info(
            f"Retry recovery action scheduled for error: {error.message}",
            extra={"workflow_instance_id": str(workflow_instance_id) if workflow_instance_id else None}
        )
        
        return {
            "success": True,
            "action": "retry_scheduled",
            "retry_count": self._recovery_attempts.get(
                f"{error.category.value}:{workflow_instance_id or 'global'}",
                0
            )
        }
    
    async def _execute_rollback(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute rollback recovery action.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing rollback result
        """
        if not workflow_instance_id:
            return {"success": False, "error": "No workflow instance ID for rollback"}
        
        try:
            # Mark workflow instance as requiring rollback
            update_data = {
                "status": "suspended",
                "data": {
                    "error_state": True,
                    "error_message": error.message,
                    "error_category": error.category.value,
                    "requires_rollback": True,
                    "rollback_timestamp": datetime.utcnow().isoformat()
                },
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_instances").update(update_data).eq(
                "id", str(workflow_instance_id)
            ).execute()
            
            if result.data:
                logger.info(f"Workflow instance {workflow_instance_id} marked for rollback")
                return {"success": True, "action": "rollback_initiated"}
            else:
                return {"success": False, "error": "Failed to update workflow instance"}
            
        except Exception as e:
            logger.error(f"Failed to execute rollback: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _execute_escalate(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute escalate recovery action.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing escalation result
        """
        if not workflow_instance_id:
            return {"success": False, "error": "No workflow instance ID for escalation"}
        
        try:
            # Mark workflow instance as requiring escalation
            update_data = {
                "data": {
                    "error_state": True,
                    "error_message": error.message,
                    "error_category": error.category.value,
                    "requires_escalation": True,
                    "escalation_timestamp": datetime.utcnow().isoformat()
                },
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_instances").update(update_data).eq(
                "id", str(workflow_instance_id)
            ).execute()
            
            if result.data:
                logger.info(f"Workflow instance {workflow_instance_id} marked for escalation")
                return {"success": True, "action": "escalation_initiated"}
            else:
                return {"success": False, "error": "Failed to update workflow instance"}
            
        except Exception as e:
            logger.error(f"Failed to execute escalation: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _execute_notify_admin(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute notify admin recovery action.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing notification result
        """
        try:
            # Create admin notification record
            notification_data = {
                "notification_type": "workflow_error_admin",
                "severity": error.severity.value,
                "title": f"Workflow Error: {error.category.value}",
                "message": error.message,
                "context": {
                    **error.context,
                    "workflow_instance_id": str(workflow_instance_id) if workflow_instance_id else None,
                    "error_category": error.category.value,
                    "traceback": error.traceback
                },
                "requires_action": True,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Insert notification
            result = self.db.table("workflow_notifications").insert(notification_data).execute()
            
            if result.data:
                logger.info(f"Admin notification created for error: {error.message}")
                return {"success": True, "action": "admin_notified", "notification_id": result.data[0]["id"]}
            else:
                return {"success": False, "error": "Failed to create admin notification"}
            
        except Exception as e:
            logger.error(f"Failed to notify admin: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _execute_manual_intervention(
        self,
        error: WorkflowError,
        workflow_instance_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Execute manual intervention recovery action.
        
        Args:
            error: WorkflowError instance
            workflow_instance_id: Optional workflow instance ID
            
        Returns:
            Dict containing intervention result
        """
        if not workflow_instance_id:
            return {"success": False, "error": "No workflow instance ID for manual intervention"}
        
        try:
            # Suspend workflow and mark for manual intervention
            update_data = {
                "status": "suspended",
                "data": {
                    "error_state": True,
                    "error_message": error.message,
                    "error_category": error.category.value,
                    "requires_manual_intervention": True,
                    "intervention_timestamp": datetime.utcnow().isoformat()
                },
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.db.table("workflow_instances").update(update_data).eq(
                "id", str(workflow_instance_id)
            ).execute()
            
            if result.data:
                # Also notify admin
                await self._execute_notify_admin(error, workflow_instance_id)
                
                logger.info(f"Workflow instance {workflow_instance_id} suspended for manual intervention")
                return {"success": True, "action": "manual_intervention_required"}
            else:
                return {"success": False, "error": "Failed to suspend workflow instance"}
            
        except Exception as e:
            logger.error(f"Failed to execute manual intervention: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    def _get_log_level(self, severity: ErrorSeverity) -> int:
        """
        Get logging level for error severity.
        
        Args:
            severity: Error severity
            
        Returns:
            Logging level constant
        """
        if severity == ErrorSeverity.CRITICAL:
            return logging.CRITICAL
        elif severity == ErrorSeverity.HIGH:
            return logging.ERROR
        elif severity == ErrorSeverity.MEDIUM:
            return logging.WARNING
        else:
            return logging.INFO
    
    def get_error_history(
        self,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recent error history.
        
        Args:
            limit: Maximum number of errors to return
            
        Returns:
            List of error records
        """
        return self._error_history[-limit:]
    
    def get_recovery_attempts(self) -> Dict[str, int]:
        """
        Get recovery attempt counts.
        
        Returns:
            Dict mapping error keys to attempt counts
        """
        return self._recovery_attempts.copy()
    
    def reset_recovery_attempts(self, error_key: Optional[str] = None) -> None:
        """
        Reset recovery attempt counters.
        
        Args:
            error_key: Optional specific error key to reset, or None to reset all
        """
        if error_key:
            self._recovery_attempts.pop(error_key, None)
            logger.info(f"Reset recovery attempts for: {error_key}")
        else:
            self._recovery_attempts.clear()
            logger.info("Reset all recovery attempts")
