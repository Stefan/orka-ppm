"""
PMR Audit Trail Service
Tracks all changes and operations on Enhanced PMR reports for compliance and security
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID
import json

from config.database import supabase


class AuditAction:
    """Audit action types for PMR operations"""
    REPORT_CREATED = "report_created"
    REPORT_UPDATED = "report_updated"
    REPORT_DELETED = "report_deleted"
    REPORT_APPROVED = "report_approved"
    REPORT_EXPORTED = "report_exported"
    SECTION_UPDATED = "section_updated"
    AI_INSIGHT_GENERATED = "ai_insight_generated"
    AI_INSIGHT_VALIDATED = "ai_insight_validated"
    COLLABORATION_STARTED = "collaboration_started"
    COLLABORATION_ENDED = "collaboration_ended"
    PARTICIPANT_ADDED = "participant_added"
    PARTICIPANT_REMOVED = "participant_removed"
    COMMENT_ADDED = "comment_added"
    COMMENT_RESOLVED = "comment_resolved"
    TEMPLATE_APPLIED = "template_applied"
    MONTE_CARLO_RUN = "monte_carlo_run"
    EXPORT_REQUESTED = "export_requested"
    EXPORT_COMPLETED = "export_completed"
    EXPORT_FAILED = "export_failed"
    PERMISSION_DENIED = "permission_denied"
    DATA_ACCESS = "data_access"
    SENSITIVE_DATA_VIEWED = "sensitive_data_viewed"


class PMRAuditService:
    """Service for managing PMR audit trails"""
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or supabase
    
    async def log_audit_event(
        self,
        action: str,
        user_id: UUID,
        report_id: Optional[UUID] = None,
        resource_type: str = "pmr_report",
        resource_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        severity: str = "info"
    ) -> Dict[str, Any]:
        """
        Log an audit event for PMR operations
        
        Args:
            action: The action being performed (use AuditAction constants)
            user_id: ID of the user performing the action
            report_id: ID of the PMR report (if applicable)
            resource_type: Type of resource being accessed
            resource_id: ID of the specific resource
            details: Additional details about the action
            ip_address: IP address of the user
            user_agent: User agent string
            severity: Severity level (info, warning, error, critical)
        
        Returns:
            The created audit log entry
        """
        try:
            audit_entry = {
                "action": action,
                "user_id": str(user_id),
                "report_id": str(report_id) if report_id else None,
                "resource_type": resource_type,
                "resource_id": str(resource_id) if resource_id else None,
                "details": json.dumps(details) if details else None,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "severity": severity,
                "timestamp": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            response = self.supabase.table("pmr_audit_log").insert(audit_entry).execute()
            
            if response.data:
                return response.data[0]
            
            return audit_entry
            
        except Exception as e:
            print(f"Error logging audit event: {e}")
            # Don't fail the operation if audit logging fails
            return {}
    
    async def get_report_audit_trail(
        self,
        report_id: UUID,
        limit: int = 100,
        offset: int = 0,
        action_filter: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get audit trail for a specific PMR report
        
        Args:
            report_id: ID of the PMR report
            limit: Maximum number of entries to return
            offset: Offset for pagination
            action_filter: Optional list of actions to filter by
        
        Returns:
            List of audit log entries
        """
        try:
            query = self.supabase.table("pmr_audit_log").select("*").eq(
                "report_id", str(report_id)
            ).order("timestamp", desc=True).limit(limit).offset(offset)
            
            if action_filter:
                query = query.in_("action", action_filter)
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving audit trail: {e}")
            return []
    
    async def get_user_audit_trail(
        self,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get audit trail for a specific user
        
        Args:
            user_id: ID of the user
            limit: Maximum number of entries to return
            offset: Offset for pagination
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of audit log entries
        """
        try:
            query = self.supabase.table("pmr_audit_log").select("*").eq(
                "user_id", str(user_id)
            ).order("timestamp", desc=True).limit(limit).offset(offset)
            
            if start_date:
                query = query.gte("timestamp", start_date.isoformat())
            
            if end_date:
                query = query.lte("timestamp", end_date.isoformat())
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving user audit trail: {e}")
            return []
    
    async def get_sensitive_data_access_log(
        self,
        report_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get log of sensitive data access events
        
        Args:
            report_id: Optional report ID filter
            user_id: Optional user ID filter
            limit: Maximum number of entries to return
        
        Returns:
            List of sensitive data access events
        """
        try:
            query = self.supabase.table("pmr_audit_log").select("*").eq(
                "action", AuditAction.SENSITIVE_DATA_VIEWED
            ).order("timestamp", desc=True).limit(limit)
            
            if report_id:
                query = query.eq("report_id", str(report_id))
            
            if user_id:
                query = query.eq("user_id", str(user_id))
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving sensitive data access log: {e}")
            return []
    
    async def get_permission_denied_events(
        self,
        user_id: Optional[UUID] = None,
        limit: int = 100,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get log of permission denied events for security monitoring
        
        Args:
            user_id: Optional user ID filter
            limit: Maximum number of entries to return
            days: Number of days to look back
        
        Returns:
            List of permission denied events
        """
        try:
            start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = start_date.replace(day=start_date.day - days)
            
            query = self.supabase.table("pmr_audit_log").select("*").eq(
                "action", AuditAction.PERMISSION_DENIED
            ).gte("timestamp", start_date.isoformat()).order(
                "timestamp", desc=True
            ).limit(limit)
            
            if user_id:
                query = query.eq("user_id", str(user_id))
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving permission denied events: {e}")
            return []
    
    async def get_export_audit_trail(
        self,
        report_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get audit trail for export operations
        
        Args:
            report_id: Optional report ID filter
            user_id: Optional user ID filter
            limit: Maximum number of entries to return
        
        Returns:
            List of export audit events
        """
        try:
            export_actions = [
                AuditAction.EXPORT_REQUESTED,
                AuditAction.EXPORT_COMPLETED,
                AuditAction.EXPORT_FAILED
            ]
            
            query = self.supabase.table("pmr_audit_log").select("*").in_(
                "action", export_actions
            ).order("timestamp", desc=True).limit(limit)
            
            if report_id:
                query = query.eq("report_id", str(report_id))
            
            if user_id:
                query = query.eq("user_id", str(user_id))
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving export audit trail: {e}")
            return []
    
    async def get_ai_operations_audit(
        self,
        report_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get audit trail for AI operations
        
        Args:
            report_id: Optional report ID filter
            limit: Maximum number of entries to return
        
        Returns:
            List of AI operation audit events
        """
        try:
            ai_actions = [
                AuditAction.AI_INSIGHT_GENERATED,
                AuditAction.AI_INSIGHT_VALIDATED,
                AuditAction.MONTE_CARLO_RUN
            ]
            
            query = self.supabase.table("pmr_audit_log").select("*").in_(
                "action", ai_actions
            ).order("timestamp", desc=True).limit(limit)
            
            if report_id:
                query = query.eq("report_id", str(report_id))
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error retrieving AI operations audit: {e}")
            return []
    
    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
        report_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Generate a compliance report for a date range
        
        Args:
            start_date: Start date for the report
            end_date: End date for the report
            report_id: Optional report ID filter
        
        Returns:
            Compliance report with statistics and events
        """
        try:
            query = self.supabase.table("pmr_audit_log").select("*").gte(
                "timestamp", start_date.isoformat()
            ).lte("timestamp", end_date.isoformat())
            
            if report_id:
                query = query.eq("report_id", str(report_id))
            
            response = query.execute()
            events = response.data if response.data else []
            
            # Calculate statistics
            total_events = len(events)
            actions_count = {}
            users_count = {}
            severity_count = {}
            
            for event in events:
                action = event.get("action", "unknown")
                user_id = event.get("user_id", "unknown")
                severity = event.get("severity", "info")
                
                actions_count[action] = actions_count.get(action, 0) + 1
                users_count[user_id] = users_count.get(user_id, 0) + 1
                severity_count[severity] = severity_count.get(severity, 0) + 1
            
            return {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "report_id": str(report_id) if report_id else None,
                "total_events": total_events,
                "actions_breakdown": actions_count,
                "users_breakdown": users_count,
                "severity_breakdown": severity_count,
                "events": events
            }
            
        except Exception as e:
            print(f"Error generating compliance report: {e}")
            return {
                "error": str(e),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }


# Initialize audit service
pmr_audit_service = PMRAuditService()
