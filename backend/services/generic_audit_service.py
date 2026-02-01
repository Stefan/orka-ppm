"""
Audit Logging and Monitoring Service for Generic Construction PPM Features

This service provides comprehensive audit trail logging for all new feature operations
including shareable URLs, simulations, scenarios, change management, PO breakdowns,
and report generation.

Requirements: 7.2, 7.6, 8.5, 9.5
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID
from enum import Enum
import json
import logging

from config.database import supabase


class AuditEventType(str, Enum):
    """Types of audit events for Generic Construction PPM features"""
    
    # Shareable URL events
    SHAREABLE_URL_CREATED = "shareable_url_created"
    SHAREABLE_URL_ACCESSED = "shareable_url_accessed"
    SHAREABLE_URL_REVOKED = "shareable_url_revoked"
    SHAREABLE_URL_EXPIRED = "shareable_url_expired"
    
    # Simulation events
    SIMULATION_STARTED = "simulation_started"
    SIMULATION_COMPLETED = "simulation_completed"
    SIMULATION_FAILED = "simulation_failed"
    SIMULATION_DELETED = "simulation_deleted"
    SIMULATION_CACHED = "simulation_cached"
    
    # Scenario events
    SCENARIO_CREATED = "scenario_created"
    SCENARIO_UPDATED = "scenario_updated"
    SCENARIO_DELETED = "scenario_deleted"
    SCENARIO_COMPARED = "scenario_compared"
    
    # Change management events
    CHANGE_REQUEST_CREATED = "change_request_created"
    CHANGE_REQUEST_UPDATED = "change_request_updated"
    CHANGE_REQUEST_SUBMITTED = "change_request_submitted"
    CHANGE_REQUEST_APPROVED = "change_request_approved"
    CHANGE_REQUEST_REJECTED = "change_request_rejected"
    CHANGE_REQUEST_IMPLEMENTED = "change_request_implemented"
    CHANGE_REQUEST_CLOSED = "change_request_closed"
    CHANGE_PO_LINKED = "change_po_linked"
    
    # PO breakdown events
    PO_BREAKDOWN_IMPORTED = "po_breakdown_imported"
    PO_BREAKDOWN_CREATED = "po_breakdown_created"
    PO_BREAKDOWN_UPDATED = "po_breakdown_updated"
    PO_BREAKDOWN_DELETED = "po_breakdown_deleted"
    
    # Report generation events
    REPORT_GENERATION_STARTED = "report_generation_started"
    REPORT_GENERATION_COMPLETED = "report_generation_completed"
    REPORT_GENERATION_FAILED = "report_generation_failed"
    REPORT_TEMPLATE_CREATED = "report_template_created"
    REPORT_TEMPLATE_UPDATED = "report_template_updated"
    
    # Security events
    PERMISSION_DENIED = "permission_denied"
    INVALID_TOKEN = "invalid_token"
    UNAUTHORIZED_ACCESS = "unauthorized_access"


class AuditSeverity(str, Enum):
    """Severity levels for audit events"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class GenericAuditService:
    """
    Comprehensive audit logging service for Generic Construction PPM features.
    
    This service logs all operations across new features with detailed context,
    user information, and performance metrics for compliance and monitoring.
    """
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or supabase
        self.logger = logging.getLogger(__name__)
        
    async def log_audit_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[UUID],
        entity_type: str,
        entity_id: Optional[UUID],
        action_details: Dict[str, Any],
        severity: AuditSeverity = AuditSeverity.INFO,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        project_id: Optional[UUID] = None,
        performance_metrics: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Log an audit event with comprehensive context.
        
        Args:
            event_type: Type of audit event
            user_id: ID of user performing the action (None for system events)
            entity_type: Type of entity being acted upon (e.g., 'shareable_url', 'simulation')
            entity_id: ID of the entity
            action_details: Detailed information about the action
            severity: Severity level of the event
            ip_address: IP address of the client
            user_agent: User agent string
            project_id: Associated project ID if applicable
            performance_metrics: Performance data (execution time, resource usage, etc.)
            
        Returns:
            bool: True if logging succeeded, False otherwise
        """
        try:
            audit_entry = {
                "event_type": event_type.value,
                "user_id": str(user_id) if user_id else None,
                "entity_type": entity_type,
                "entity_id": str(entity_id) if entity_id else None,
                "action_details": json.dumps(action_details),
                "severity": severity.value,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "project_id": str(project_id) if project_id else None,
                "performance_metrics": json.dumps(performance_metrics) if performance_metrics else None,
                "timestamp": datetime.now().isoformat()
            }
            
            # Log to database
            if self.supabase:
                self.supabase.table("audit_logs").insert(audit_entry).execute()
            
            # Also log to application logger for immediate visibility
            log_message = f"[{event_type.value}] User: {user_id}, Entity: {entity_type}/{entity_id}"
            if severity == AuditSeverity.ERROR or severity == AuditSeverity.CRITICAL:
                self.logger.error(log_message, extra=audit_entry)
            elif severity == AuditSeverity.WARNING:
                self.logger.warning(log_message, extra=audit_entry)
            else:
                self.logger.info(log_message, extra=audit_entry)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to log audit event: {str(e)}")
            return False
    
    async def log_shareable_url_event(
        self,
        event_type: AuditEventType,
        url_id: UUID,
        user_id: Optional[UUID],
        project_id: UUID,
        permissions: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log shareable URL related events."""
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="shareable_url",
            entity_id=url_id,
            action_details={
                "permissions": permissions,
                "project_id": str(project_id)
            },
            ip_address=ip_address,
            user_agent=user_agent,
            project_id=project_id
        )
    
    async def log_simulation_event(
        self,
        event_type: AuditEventType,
        simulation_id: UUID,
        user_id: UUID,
        project_id: Optional[UUID],
        simulation_config: Dict[str, Any],
        performance_metrics: Optional[Dict[str, Any]] = None,
        error_details: Optional[str] = None
    ) -> bool:
        """Log Monte Carlo simulation events with performance metrics."""
        severity = AuditSeverity.ERROR if error_details else AuditSeverity.INFO
        
        action_details = {
            "simulation_config": simulation_config,
            "project_id": str(project_id) if project_id else None
        }
        
        if error_details:
            action_details["error"] = error_details
        
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="monte_carlo_simulation",
            entity_id=simulation_id,
            action_details=action_details,
            severity=severity,
            project_id=project_id,
            performance_metrics=performance_metrics
        )
    
    async def log_scenario_event(
        self,
        event_type: AuditEventType,
        scenario_id: UUID,
        user_id: UUID,
        scenario_name: str,
        modifications: Dict[str, Any],
        project_id: Optional[UUID] = None
    ) -> bool:
        """Log what-if scenario analysis events."""
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="scenario_analysis",
            entity_id=scenario_id,
            action_details={
                "scenario_name": scenario_name,
                "modifications": modifications,
                "project_id": str(project_id) if project_id else None
            },
            project_id=project_id
        )
    
    async def log_change_request_event(
        self,
        event_type: AuditEventType,
        change_request_id: UUID,
        user_id: UUID,
        project_id: UUID,
        change_details: Dict[str, Any],
        approval_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log change management events."""
        action_details = {
            "change_details": change_details,
            "project_id": str(project_id)
        }
        
        if approval_info:
            action_details["approval_info"] = approval_info
        
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="change_request",
            entity_id=change_request_id,
            action_details=action_details,
            project_id=project_id
        )
    
    async def log_po_breakdown_event(
        self,
        event_type: AuditEventType,
        po_breakdown_id: UUID,
        user_id: UUID,
        project_id: UUID,
        breakdown_details: Dict[str, Any],
        import_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log PO breakdown management events."""
        action_details = {
            "breakdown_details": breakdown_details,
            "project_id": str(project_id)
        }
        
        if import_info:
            action_details["import_info"] = import_info
        
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="po_breakdown",
            entity_id=po_breakdown_id,
            action_details=action_details,
            project_id=project_id
        )
    
    async def log_report_generation_event(
        self,
        event_type: AuditEventType,
        report_id: UUID,
        user_id: UUID,
        project_id: UUID,
        template_id: UUID,
        performance_metrics: Optional[Dict[str, Any]] = None,
        error_details: Optional[str] = None
    ) -> bool:
        """Log Google Suite report generation events."""
        severity = AuditSeverity.ERROR if error_details else AuditSeverity.INFO
        
        action_details = {
            "template_id": str(template_id),
            "project_id": str(project_id)
        }
        
        if error_details:
            action_details["error"] = error_details
        
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type="report_generation",
            entity_id=report_id,
            action_details=action_details,
            severity=severity,
            project_id=project_id,
            performance_metrics=performance_metrics
        )
    
    async def log_security_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[UUID],
        entity_type: str,
        entity_id: Optional[UUID],
        security_details: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """Log security-related events (permission denied, invalid tokens, etc.)."""
        return await self.log_audit_event(
            event_type=event_type,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action_details=security_details,
            severity=AuditSeverity.WARNING,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def get_audit_trail(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        event_types: Optional[List[AuditEventType]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Retrieve audit trail with filtering options.
        
        Args:
            entity_type: Filter by entity type
            entity_id: Filter by specific entity ID
            user_id: Filter by user ID
            project_id: Filter by project ID
            event_types: Filter by event types
            start_date: Filter events after this date
            end_date: Filter events before this date
            limit: Maximum number of records to return
            offset: Number of records to skip
            
        Returns:
            List of audit log entries
        """
        try:
            if not self.supabase:
                return []
            
            query = self.supabase.table("audit_logs").select("*")
            
            if entity_type:
                query = query.eq("entity_type", entity_type)
            if entity_id:
                query = query.eq("entity_id", str(entity_id))
            if user_id:
                query = query.eq("user_id", str(user_id))
            if project_id:
                query = query.eq("project_id", str(project_id))
            if event_types:
                event_type_values = [et.value for et in event_types]
                query = query.in_("event_type", event_type_values)
            if start_date:
                query = query.gte("timestamp", start_date.isoformat())
            if end_date:
                query = query.lte("timestamp", end_date.isoformat())
            
            query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)
            
            response = query.execute()
            return response.data if response.data else []
            
        except Exception as e:
            self.logger.error(f"Failed to retrieve audit trail: {str(e)}")
            return []
    
    async def get_performance_metrics(
        self,
        entity_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get aggregated performance metrics for a specific entity type.
        
        This is useful for monitoring simulation execution times, report generation
        performance, and identifying performance bottlenecks.
        
        Args:
            entity_type: Type of entity to analyze
            start_date: Start of analysis period
            end_date: End of analysis period
            
        Returns:
            Dictionary with performance statistics
        """
        try:
            audit_logs = await self.get_audit_trail(
                entity_type=entity_type,
                start_date=start_date,
                end_date=end_date,
                limit=1000
            )
            
            if not audit_logs:
                return {
                    "entity_type": entity_type,
                    "total_operations": 0,
                    "average_execution_time": 0,
                    "max_execution_time": 0,
                    "min_execution_time": 0
                }
            
            execution_times = []
            for log in audit_logs:
                if log.get("performance_metrics"):
                    metrics = json.loads(log["performance_metrics"])
                    if "execution_time" in metrics:
                        execution_times.append(metrics["execution_time"])
            
            if not execution_times:
                return {
                    "entity_type": entity_type,
                    "total_operations": len(audit_logs),
                    "operations_with_metrics": 0
                }
            
            return {
                "entity_type": entity_type,
                "total_operations": len(audit_logs),
                "operations_with_metrics": len(execution_times),
                "average_execution_time": sum(execution_times) / len(execution_times),
                "max_execution_time": max(execution_times),
                "min_execution_time": min(execution_times),
                "p50_execution_time": sorted(execution_times)[len(execution_times) // 2],
                "p90_execution_time": sorted(execution_times)[int(len(execution_times) * 0.9)],
                "p99_execution_time": sorted(execution_times)[int(len(execution_times) * 0.99)]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to calculate performance metrics: {str(e)}")
            return {"error": str(e)}


# Global audit service instance
audit_service = GenericAuditService()
