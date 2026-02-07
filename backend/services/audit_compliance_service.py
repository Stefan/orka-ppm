"""
Audit and Compliance Service

Provides comprehensive audit logging, compliance monitoring, and regulatory
reporting capabilities for the change management system.
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple, Union
from uuid import UUID, uuid4
from decimal import Decimal
import logging
import json
import hashlib
from enum import Enum

from config.database import supabase
from models.change_management import (
    AuditLogEntry, ChangeStatus, ChangeType, PriorityLevel
)
from services.audit_encryption_service import get_encryption_service

logger = logging.getLogger(__name__)

class AuditEventType(str, Enum):
    """Comprehensive audit event types for change management"""
    # Change request lifecycle events
    CHANGE_CREATED = "change_created"
    CHANGE_UPDATED = "change_updated"
    CHANGE_SUBMITTED = "change_submitted"
    CHANGE_CANCELLED = "change_cancelled"
    CHANGE_CLOSED = "change_closed"
    
    # Approval workflow events
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_REJECTED = "approval_rejected"
    APPROVAL_DELEGATED = "approval_delegated"
    APPROVAL_ESCALATED = "approval_escalated"
    
    # Impact analysis events
    IMPACT_ANALYZED = "impact_analyzed"
    IMPACT_UPDATED = "impact_updated"
    IMPACT_APPROVED = "impact_approved"
    
    # Implementation events
    IMPLEMENTATION_STARTED = "implementation_started"
    IMPLEMENTATION_PROGRESS = "implementation_progress"
    IMPLEMENTATION_COMPLETED = "implementation_completed"
    IMPLEMENTATION_DEVIATION = "implementation_deviation"
    
    # Emergency change events
    EMERGENCY_DECLARED = "emergency_declared"
    EMERGENCY_AUTHORIZED = "emergency_authorized"
    EMERGENCY_ESCALATED = "emergency_escalated"
    
    # Compliance events
    COMPLIANCE_CHECK = "compliance_check"
    REGULATORY_APPROVAL = "regulatory_approval"
    AUDIT_REVIEW = "audit_review"
    DATA_RETENTION = "data_retention"
    DATA_ARCHIVAL = "data_archival"
    
    # Security events
    ACCESS_GRANTED = "access_granted"
    ACCESS_DENIED = "access_denied"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_EXPORT = "data_export"

class ComplianceFramework(str, Enum):
    """Supported compliance frameworks"""
    SOX = "sox"  # Sarbanes-Oxley
    ISO_9001 = "iso_9001"  # Quality Management
    ISO_27001 = "iso_27001"  # Information Security
    GDPR = "gdpr"  # General Data Protection Regulation
    HIPAA = "hipaa"  # Health Insurance Portability and Accountability Act
    PCI_DSS = "pci_dss"  # Payment Card Industry Data Security Standard
    CONSTRUCTION_INDUSTRY = "construction_industry"  # Industry-specific standards

class DataRetentionPolicy(str, Enum):
    """Data retention policy types"""
    ACTIVE = "active"  # 7 years for active projects
    COMPLETED = "completed"  # 10 years for completed projects
    REGULATORY = "regulatory"  # 15 years for regulatory compliance
    LEGAL_HOLD = "legal_hold"  # Indefinite for legal proceedings
    ARCHIVED = "archived"  # Moved to long-term storage

class AuditComplianceService:
    """
    Comprehensive audit and compliance service for change management.
    
    Provides:
    - Detailed audit trail for all change activities
    - Compliance reporting with regulatory requirements
    - Data retention and archival policies
    - Regulatory compliance checking and alerts
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        # Initialize encryption service
        try:
            self.encryption_service = get_encryption_service()
        except Exception as e:
            logger.warning(f"Encryption service not available: {e}")
            self.encryption_service = None
    
    # Hash Chain Generation and Verification Methods
    
    def generate_event_hash(
        self,
        event_data: Dict[str, Any],
        previous_hash: Optional[str] = None
    ) -> str:
        """
        Generate SHA-256 hash for an audit event.
        
        Creates a cryptographic hash of the event data combined with the previous
        event's hash to form a tamper-evident chain.
        
        Args:
            event_data: Dictionary containing event data to hash
            previous_hash: Hash of the previous event in the chain (None for first event)
            
        Returns:
            str: SHA-256 hash in hexadecimal format
        """
        # Create a deterministic string representation of the event data
        # Sort keys to ensure consistent ordering
        hash_input = {
            "event_type": event_data.get("event_type", ""),
            "user_id": str(event_data.get("user_id", "")),
            "entity_type": event_data.get("entity_type", ""),
            "entity_id": str(event_data.get("entity_id", "")),
            "action_details": json.dumps(event_data.get("action_details", {}), sort_keys=True),
            "timestamp": event_data.get("timestamp", datetime.utcnow().isoformat()),
            "previous_hash": previous_hash or "0" * 64  # Genesis block uses zeros
        }
        
        # Create JSON string with sorted keys for consistent hashing
        hash_string = json.dumps(hash_input, sort_keys=True, default=str)
        
        # Generate SHA-256 hash
        return hashlib.sha256(hash_string.encode('utf-8')).hexdigest()
    
    async def get_latest_audit_hash(
        self,
        tenant_id: Optional[Union[UUID, str]] = None
    ) -> Optional[str]:
        """
        Get the hash of the most recent audit event.

        This is used to link new events to the existing chain.

        Args:
            tenant_id: Optional tenant ID for multi-tenant isolation (UUID or string e.g. "default")

        Returns:
            str: Hash of the latest event, or None if no events exist
        """
        try:
            query = self.db.table("audit_logs").select("hash").order(
                "timestamp", desc=True
            ).limit(1)

            if tenant_id is not None:
                query = query.eq("tenant_id", str(tenant_id))
            
            result = query.execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0].get("hash")
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving latest audit hash: {e}")
            return None
    
    async def create_audit_event_with_hash(
        self,
        event_type: str,
        user_id: Optional[UUID],
        entity_type: str,
        entity_id: Optional[UUID],
        action_details: Dict[str, Any],
        severity: str = "info",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        project_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        performance_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create an audit event with hash chain linking.
        
        This method generates a cryptographic hash for the event and links it
        to the previous event in the chain, ensuring tamper-evident logging.
        
        Args:
            event_type: Type of audit event
            user_id: ID of user performing the action
            entity_type: Type of entity being acted upon
            entity_id: ID of the entity
            action_details: Detailed information about the action
            severity: Severity level (info, warning, error, critical)
            ip_address: IP address of the client
            user_agent: User agent string
            project_id: Associated project ID
            tenant_id: Tenant ID for multi-tenant isolation
            performance_metrics: Performance data
            
        Returns:
            Dict containing the created audit event with hash
            
        Raises:
            RuntimeError: If event creation fails
        """
        try:
            # Get the hash of the previous event
            previous_hash = await self.get_latest_audit_hash(tenant_id)
            
            # Prepare event data
            timestamp = datetime.utcnow().isoformat()
            event_data = {
                "event_type": event_type,
                "user_id": str(user_id) if user_id else None,
                "entity_type": entity_type,
                "entity_id": str(entity_id) if entity_id else None,
                "action_details": action_details,
                "severity": severity,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "project_id": str(project_id) if project_id else None,
                "tenant_id": str(tenant_id) if tenant_id else None,
                "performance_metrics": performance_metrics,
                "timestamp": timestamp
            }
            
            # Generate hash for this event
            event_hash = self.generate_event_hash(event_data, previous_hash)
            
            # Add hash fields to event data
            event_data["hash"] = event_hash
            event_data["previous_hash"] = previous_hash
            
            # Encrypt sensitive fields before storage (Requirement 6.6)
            if self.encryption_service:
                event_data = self.encryption_service.encrypt_audit_event(event_data)
            
            # Convert action_details and performance_metrics to JSON strings for storage
            event_data["action_details"] = json.dumps(action_details)
            if performance_metrics:
                event_data["performance_metrics"] = json.dumps(performance_metrics)
            
            # Insert into database
            result = self.db.table("audit_logs").insert(event_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create audit event")
            
            logger.info(
                f"Audit event created with hash chain: {event_type} "
                f"(hash: {event_hash[:8]}..., previous: {previous_hash[:8] if previous_hash else 'genesis'}...)"
            )
            
            return result.data[0]
            
        except Exception as e:
            logger.error(f"Error creating audit event with hash: {e}")
            raise RuntimeError(f"Failed to create audit event: {str(e)}")
    
    async def verify_hash_chain(
        self,
        tenant_id: Optional[Union[UUID, str]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Verify the integrity of the audit log hash chain.
        
        This method checks that each event's previous_hash matches the hash
        of the chronologically previous event, ensuring the chain is unbroken.
        
        Args:
            tenant_id: Optional tenant ID for multi-tenant isolation
            start_date: Optional start date for verification range
            end_date: Optional end date for verification range
            limit: Maximum number of events to verify
            
        Returns:
            Dict containing verification results:
                - chain_valid: bool indicating if chain is intact
                - total_events: number of events verified
                - break_point: index of first broken link (if any)
                - broken_event_id: ID of event where chain breaks (if any)
                - verification_time: time taken to verify (seconds)
                
        Raises:
            RuntimeError: If verification fails due to database error
        """
        try:
            verification_start = datetime.utcnow()
            
            # Build query for audit events
            query = self.db.table("audit_logs").select(
                "id", "hash", "previous_hash", "timestamp"
            ).order("timestamp", desc=False).limit(limit)
            
            if tenant_id:
                query = query.eq("tenant_id", str(tenant_id))
            if start_date:
                query = query.gte("timestamp", start_date.isoformat())
            if end_date:
                query = query.lte("timestamp", end_date.isoformat())
            
            # Execute query
            result = query.execute()
            events = result.data
            
            if not events or len(events) == 0:
                return {
                    "chain_valid": True,
                    "total_events": 0,
                    "break_point": None,
                    "broken_event_id": None,
                    "verification_time": 0.0,
                    "message": "No events to verify"
                }
            
            # Verify chain integrity
            chain_valid = True
            break_point = None
            broken_event_id = None
            
            for i in range(1, len(events)):
                current_event = events[i]
                previous_event = events[i-1]
                
                # Check if current event's previous_hash matches previous event's hash
                if current_event.get("previous_hash") != previous_event.get("hash"):
                    chain_valid = False
                    break_point = i
                    broken_event_id = current_event.get("id")
                    
                    # Log critical alert for chain break
                    logger.critical(
                        f"HASH CHAIN INTEGRITY VIOLATION: Chain broken at event {broken_event_id} "
                        f"(position {i}). Expected previous_hash: {previous_event.get('hash')}, "
                        f"Got: {current_event.get('previous_hash')}"
                    )
                    
                    # Raise alert for chain break
                    await self._raise_chain_break_alert(
                        broken_event_id=broken_event_id,
                        break_point=i,
                        expected_hash=previous_event.get("hash"),
                        actual_hash=current_event.get("previous_hash")
                    )
                    
                    break
            
            verification_time = (datetime.utcnow() - verification_start).total_seconds()
            
            verification_result = {
                "chain_valid": chain_valid,
                "total_events": len(events),
                "break_point": break_point,
                "broken_event_id": broken_event_id,
                "verification_time": verification_time
            }
            
            if chain_valid:
                verification_result["message"] = f"Hash chain verified successfully for {len(events)} events"
                logger.info(f"Hash chain verification passed: {len(events)} events verified in {verification_time:.3f}s")
            else:
                verification_result["message"] = f"Hash chain broken at event {break_point}"
                logger.error(f"Hash chain verification failed at event {break_point}")
            
            return verification_result
            
        except Exception as e:
            logger.error(f"Error verifying hash chain: {e}")
            raise RuntimeError(f"Failed to verify hash chain: {str(e)}")
    
    async def _raise_chain_break_alert(
        self,
        broken_event_id: str,
        break_point: int,
        expected_hash: str,
        actual_hash: str
    ) -> None:
        """
        Raise a critical alert when hash chain integrity is violated.
        
        This method creates an alert record and logs the violation for
        immediate investigation.
        
        Args:
            broken_event_id: ID of the event where chain breaks
            break_point: Position in the chain where break occurs
            expected_hash: Expected previous_hash value
            actual_hash: Actual previous_hash value found
        """
        try:
            alert_data = {
                "id": str(uuid4()),
                "alert_type": "hash_chain_integrity_violation",
                "severity": "critical",
                "broken_event_id": broken_event_id,
                "break_point": break_point,
                "expected_hash": expected_hash,
                "actual_hash": actual_hash,
                "detected_at": datetime.utcnow().isoformat(),
                "status": "open",
                "requires_immediate_investigation": True,
                "alert_message": (
                    f"CRITICAL: Audit log hash chain integrity violated at event {broken_event_id}. "
                    f"This indicates potential tampering with audit records. "
                    f"Immediate investigation required."
                )
            }
            
            # Store alert in database
            self.db.table("audit_integrity_alerts").insert(alert_data).execute()
            
            # Log to application logger
            logger.critical(
                f"HASH CHAIN ALERT RAISED: {alert_data['alert_message']}"
            )
            
            # In production, this would also:
            # 1. Send immediate notifications to security team
            # 2. Create incident tickets
            # 3. Potentially trigger automated response procedures
            
        except Exception as e:
            logger.error(f"Error raising chain break alert: {e}")
            # Even if alert creation fails, the critical log above ensures visibility
    
    # Comprehensive Audit Logging Methods
    
    async def log_audit_event(
        self,
        change_request_id: UUID,
        event_type: AuditEventType,
        event_description: str,
        performed_by: UUID,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[UUID] = None,
        compliance_notes: Optional[str] = None,
        regulatory_reference: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        risk_level: str = "low"
    ) -> str:
        """
        Log comprehensive audit event with full context and compliance information.
        
        Args:
            change_request_id: ID of the change request
            event_type: Type of audit event
            event_description: Detailed description of the event
            performed_by: ID of the user who performed the action
            old_values: Previous values (for updates)
            new_values: New values
            related_entity_type: Type of related entity
            related_entity_id: ID of related entity
            compliance_notes: Compliance-specific notes
            regulatory_reference: Reference to regulatory requirement
            ip_address: IP address of the user
            user_agent: User agent string
            session_id: Session identifier
            risk_level: Risk level of the event (low, medium, high, critical)
            
        Returns:
            str: ID of the created audit log entry
            
        Raises:
            RuntimeError: If audit logging fails
        """
        try:
            # Generate audit entry ID
            audit_id = str(uuid4())
            
            # Prepare audit data with comprehensive information
            audit_data = {
                "id": audit_id,
                "change_request_id": str(change_request_id),
                "event_type": event_type.value,
                "event_description": event_description,
                "performed_by": str(performed_by),
                "performed_at": datetime.utcnow().isoformat(),
                "old_values": old_values,
                "new_values": new_values,
                "related_entity_type": related_entity_type,
                "related_entity_id": str(related_entity_id) if related_entity_id else None,
                "compliance_notes": compliance_notes,
                "regulatory_reference": regulatory_reference,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "session_id": session_id,
                "risk_level": risk_level,
                "audit_trail_complete": True,
                "data_integrity_hash": self._calculate_integrity_hash(old_values, new_values)
            }
            
            # Insert audit log entry
            result = self.db.table("change_audit_log").insert(audit_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create audit log entry")
            
            # Log to application logger for additional tracking
            logger.info(
                f"Audit event logged: {event_type.value} for change {change_request_id} "
                f"by user {performed_by} at {datetime.utcnow()}"
            )
            
            # Check for compliance violations
            await self._check_compliance_violations(audit_data)
            
            return audit_id
            
        except Exception as e:
            logger.error(f"Error logging audit event: {e}")
            # Critical: Audit logging failures must be escalated
            await self._escalate_audit_failure(change_request_id, event_type, str(e))
            raise RuntimeError(f"Failed to log audit event: {str(e)}")
    
    async def get_audit_trail(
        self,
        change_request_id: UUID,
        include_related: bool = True,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[AuditLogEntry]:
        """
        Retrieve complete audit trail for a change request.
        
        Automatically decrypts sensitive fields on retrieval.
        
        Args:
            change_request_id: ID of the change request
            include_related: Whether to include related entity events
            date_from: Start date filter
            date_to: End date filter
            
        Returns:
            List[AuditLogEntry]: Complete audit trail with decrypted fields
        """
        try:
            # Build query
            query = self.db.table("change_audit_log").select("*").eq(
                "change_request_id", str(change_request_id)
            )
            
            # Apply date filters
            if date_from:
                query = query.gte("performed_at", date_from.isoformat())
            if date_to:
                query = query.lte("performed_at", date_to.isoformat())
            
            # Order by timestamp
            query = query.order("performed_at", desc=False)
            
            # Execute query
            result = query.execute()
            
            # Decrypt sensitive fields if encryption service is available
            if self.encryption_service and result.data:
                result.data = self.encryption_service.decrypt_batch(result.data)
            
            # Convert to response models
            audit_entries = []
            for entry in result.data:
                audit_entries.append(self._convert_to_audit_entry(entry))
            
            return audit_entries
            
        except Exception as e:
            logger.error(f"Error retrieving audit trail for change {change_request_id}: {e}")
            raise RuntimeError(f"Failed to retrieve audit trail: {str(e)}")
    
    async def search_audit_logs(
        self,
        filters: Dict[str, Any],
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[AuditLogEntry], int]:
        """
        Search audit logs with comprehensive filtering.
        
        Args:
            filters: Search filters (event_type, performed_by, date_range, etc.)
            page: Page number
            page_size: Number of entries per page
            
        Returns:
            Tuple of (audit_entries, total_count)
        """
        try:
            # Build query
            query = self.db.table("change_audit_log").select("*", count="exact")
            
            # Apply filters
            if filters.get("event_type"):
                query = query.eq("event_type", filters["event_type"])
            
            if filters.get("performed_by"):
                query = query.eq("performed_by", str(filters["performed_by"]))
            
            if filters.get("change_request_id"):
                query = query.eq("change_request_id", str(filters["change_request_id"]))
            
            if filters.get("date_from"):
                query = query.gte("performed_at", filters["date_from"].isoformat())
            
            if filters.get("date_to"):
                query = query.lte("performed_at", filters["date_to"].isoformat())
            
            if filters.get("risk_level"):
                query = query.eq("risk_level", filters["risk_level"])
            
            if filters.get("compliance_framework"):
                query = query.ilike("regulatory_reference", f"%{filters['compliance_framework']}%")
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.range(offset, offset + page_size - 1)
            
            # Order by timestamp (newest first)
            query = query.order("performed_at", desc=True)
            
            # Execute query
            result = query.execute()
            
            # Convert to response models
            audit_entries = []
            for entry in result.data:
                audit_entries.append(self._convert_to_audit_entry(entry))
            
            total_count = result.count if result.count is not None else len(result.data)
            
            return audit_entries, total_count
            
        except Exception as e:
            logger.error(f"Error searching audit logs: {e}")
            raise RuntimeError(f"Failed to search audit logs: {str(e)}")
    
    # Data Retention and Archival Methods
    
    async def apply_data_retention_policy(
        self,
        policy_type: DataRetentionPolicy = DataRetentionPolicy.ACTIVE
    ) -> Dict[str, Any]:
        """
        Apply data retention policies to audit logs and change data.
        
        Args:
            policy_type: Type of retention policy to apply
            
        Returns:
            Dict containing retention results
        """
        try:
            retention_results = {
                "policy_applied": policy_type.value,
                "processed_at": datetime.utcnow().isoformat(),
                "records_processed": 0,
                "records_archived": 0,
                "records_deleted": 0,
                "errors": []
            }
            
            # Define retention periods
            retention_periods = {
                DataRetentionPolicy.ACTIVE: timedelta(days=7*365),  # 7 years
                DataRetentionPolicy.COMPLETED: timedelta(days=10*365),  # 10 years
                DataRetentionPolicy.REGULATORY: timedelta(days=15*365),  # 15 years
                DataRetentionPolicy.LEGAL_HOLD: None,  # Indefinite
                DataRetentionPolicy.ARCHIVED: timedelta(days=25*365)  # 25 years
            }
            
            retention_period = retention_periods.get(policy_type)
            if retention_period is None:
                # Legal hold - no action needed
                return retention_results
            
            # Calculate cutoff date
            cutoff_date = datetime.utcnow() - retention_period
            
            # Find records to process
            old_records_query = self.db.table("change_audit_log").select("*").lt(
                "performed_at", cutoff_date.isoformat()
            )
            
            old_records_result = old_records_query.execute()
            retention_results["records_processed"] = len(old_records_result.data)
            
            # Process records based on policy
            if policy_type in [DataRetentionPolicy.ACTIVE, DataRetentionPolicy.COMPLETED]:
                # Archive to long-term storage
                archived_count = await self._archive_audit_records(old_records_result.data)
                retention_results["records_archived"] = archived_count
            
            elif policy_type == DataRetentionPolicy.ARCHIVED:
                # Delete very old archived records
                deleted_count = await self._delete_audit_records(old_records_result.data)
                retention_results["records_deleted"] = deleted_count
            
            # Log retention policy application
            await self.log_audit_event(
                change_request_id=uuid4(),  # System-level event
                event_type=AuditEventType.DATA_RETENTION,
                event_description=f"Data retention policy applied: {policy_type.value}",
                performed_by=uuid4(),  # System user
                new_values=retention_results,
                compliance_notes=f"Automated data retention policy execution"
            )
            
            return retention_results
            
        except Exception as e:
            logger.error(f"Error applying data retention policy: {e}")
            raise RuntimeError(f"Failed to apply data retention policy: {str(e)}")
    
    async def create_audit_archive(
        self,
        change_request_ids: List[UUID],
        archive_reason: str,
        retention_period_years: int = 10
    ) -> str:
        """
        Create audit archive for specific change requests.
        
        Args:
            change_request_ids: List of change request IDs to archive
            archive_reason: Reason for archiving
            retention_period_years: How long to retain the archive
            
        Returns:
            str: Archive ID
        """
        try:
            archive_id = str(uuid4())
            
            # Collect all audit data for the change requests
            audit_data = []
            for change_id in change_request_ids:
                change_audit = await self.get_audit_trail(change_id)
                audit_data.extend([entry.dict() for entry in change_audit])
            
            # Create archive record
            archive_data = {
                "id": archive_id,
                "change_request_ids": [str(cid) for cid in change_request_ids],
                "archive_reason": archive_reason,
                "audit_data": audit_data,
                "created_at": datetime.utcnow().isoformat(),
                "retention_until": (datetime.utcnow() + timedelta(days=retention_period_years*365)).isoformat(),
                "archive_size_bytes": len(json.dumps(audit_data).encode('utf-8')),
                "record_count": len(audit_data)
            }
            
            # Store archive (in production, this would go to long-term storage)
            result = self.db.table("audit_archives").insert(archive_data).execute()
            
            if not result.data:
                raise RuntimeError("Failed to create audit archive")
            
            # Log archival event
            for change_id in change_request_ids:
                await self.log_audit_event(
                    change_request_id=change_id,
                    event_type=AuditEventType.DATA_ARCHIVAL,
                    event_description=f"Audit data archived: {archive_reason}",
                    performed_by=uuid4(),  # System user
                    new_values={"archive_id": archive_id, "retention_years": retention_period_years},
                    compliance_notes="Audit data archived for long-term retention"
                )
            
            return archive_id
            
        except Exception as e:
            logger.error(f"Error creating audit archive: {e}")
            raise RuntimeError(f"Failed to create audit archive: {str(e)}")
    
    # Private Helper Methods
    
    def _calculate_integrity_hash(
        self,
        old_values: Optional[Dict[str, Any]],
        new_values: Optional[Dict[str, Any]]
    ) -> str:
        """
        Calculate integrity hash for audit data to detect tampering.
        
        Args:
            old_values: Previous values
            new_values: New values
            
        Returns:
            str: Integrity hash
        """
        import hashlib
        
        # Combine old and new values for hashing
        combined_data = {
            "old": old_values or {},
            "new": new_values or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Create hash
        data_string = json.dumps(combined_data, sort_keys=True, default=str)
        return hashlib.sha256(data_string.encode()).hexdigest()
    
    async def _check_compliance_violations(self, audit_data: Dict[str, Any]) -> None:
        """
        Check for potential compliance violations in audit data.
        
        Args:
            audit_data: Audit data to check
        """
        try:
            violations = []
            
            # Check for high-risk events without proper authorization
            high_risk_events = [
                AuditEventType.EMERGENCY_AUTHORIZED,
                AuditEventType.APPROVAL_ESCALATED,
                AuditEventType.UNAUTHORIZED_ACCESS
            ]
            
            if audit_data.get("event_type") in [e.value for e in high_risk_events]:
                if not audit_data.get("regulatory_reference"):
                    violations.append("High-risk event without regulatory reference")
            
            # Check for data integrity issues
            if not audit_data.get("data_integrity_hash"):
                violations.append("Missing data integrity hash")
            
            # Log violations if found
            if violations:
                logger.warning(f"Compliance violations detected: {violations}")
                # In production, this would trigger alerts
            
        except Exception as e:
            logger.error(f"Error checking compliance violations: {e}")
    
    async def _escalate_audit_failure(
        self,
        change_request_id: UUID,
        event_type: AuditEventType,
        error_message: str
    ) -> None:
        """
        Escalate audit logging failures to system administrators.
        
        Args:
            change_request_id: ID of the change request
            event_type: Type of event that failed to log
            error_message: Error message
        """
        try:
            # Log to system error log
            logger.critical(
                f"AUDIT FAILURE: Failed to log {event_type.value} for change {change_request_id}: {error_message}"
            )
            
            # In production, this would:
            # 1. Send immediate alerts to system administrators
            # 2. Create incident tickets
            # 3. Potentially halt the system if audit integrity is compromised
            
        except Exception as e:
            logger.error(f"Error escalating audit failure: {e}")
    
    async def _archive_audit_records(self, records: List[Dict[str, Any]]) -> int:
        """
        Archive audit records to long-term storage.
        
        Args:
            records: Records to archive
            
        Returns:
            int: Number of records archived
        """
        try:
            # In production, this would move records to long-term storage
            # For now, we'll mark them as archived
            archived_count = 0
            
            for record in records:
                # Update record to mark as archived
                self.db.table("change_audit_log").update({
                    "archived": True,
                    "archived_at": datetime.utcnow().isoformat()
                }).eq("id", record["id"]).execute()
                
                archived_count += 1
            
            return archived_count
            
        except Exception as e:
            logger.error(f"Error archiving audit records: {e}")
            return 0
    
    async def _delete_audit_records(self, records: List[Dict[str, Any]]) -> int:
        """
        Delete audit records that have exceeded retention period.
        
        Args:
            records: Records to delete
            
        Returns:
            int: Number of records deleted
        """
        try:
            deleted_count = 0
            
            for record in records:
                # Only delete if marked as archived and past retention
                if record.get("archived"):
                    self.db.table("change_audit_log").delete().eq("id", record["id"]).execute()
                    deleted_count += 1
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting audit records: {e}")
            return 0
    
    def _convert_to_audit_entry(self, db_record: Dict[str, Any]) -> AuditLogEntry:
        """
        Convert database record to AuditLogEntry model.
        
        Args:
            db_record: Database record
            
        Returns:
            AuditLogEntry: Converted audit entry
        """
        # Handle missing change_request_id field gracefully
        change_request_id = db_record.get("change_request_id")
        if change_request_id is None:
            # For test data that might not have this field, use a default
            change_request_id = "00000000-0000-0000-0000-000000000000"
        
        # Handle datetime parsing with fallback
        performed_at_str = db_record.get("performed_at", datetime.utcnow().isoformat())
        if isinstance(performed_at_str, str):
            # Remove timezone suffix if present and parse
            performed_at_clean = performed_at_str.replace("Z", "+00:00")
            try:
                performed_at = datetime.fromisoformat(performed_at_clean)
            except ValueError:
                # Fallback for invalid datetime strings
                performed_at = datetime.utcnow()
        else:
            performed_at = datetime.utcnow()
        
        return AuditLogEntry(
            id=db_record.get("id", "00000000-0000-0000-0000-000000000000"),
            change_request_id=change_request_id,
            event_type=db_record.get("event_type", "unknown"),
            event_description=db_record.get("event_description"),
            performed_by=db_record.get("performed_by", "00000000-0000-0000-0000-000000000000"),
            performed_at=performed_at,
            ip_address=db_record.get("ip_address"),
            user_agent=db_record.get("user_agent"),
            old_values=db_record.get("old_values"),
            new_values=db_record.get("new_values"),
            related_entity_type=db_record.get("related_entity_type"),
            related_entity_id=db_record.get("related_entity_id"),
            compliance_notes=db_record.get("compliance_notes"),
            regulatory_reference=db_record.get("regulatory_reference")
        )
    # Compliance Monitoring and Reporting Methods
    
    async def check_compliance(
        self,
        change_request_id: UUID,
        framework_codes: Optional[List[str]] = None,
        force_recheck: bool = False
    ) -> Dict[str, Any]:
        """
        Check compliance status for a change request against specified frameworks.
        
        Args:
            change_request_id: ID of the change request
            framework_codes: List of framework codes to check (if None, check all active)
            force_recheck: Whether to force a new compliance check
            
        Returns:
            Dict containing compliance results
        """
        try:
            compliance_results = {
                "change_request_id": str(change_request_id),
                "checked_at": datetime.utcnow().isoformat(),
                "overall_compliance_score": 0.0,
                "framework_results": {},
                "violations": [],
                "recommendations": []
            }
            
            # Get applicable frameworks
            if framework_codes:
                frameworks_query = self.db.table("compliance_frameworks").select("*").in_(
                    "framework_code", framework_codes
                ).eq("is_active", True)
            else:
                frameworks_query = self.db.table("compliance_frameworks").select("*").eq("is_active", True)
            
            frameworks_result = frameworks_query.execute()
            frameworks = frameworks_result.data
            framework_codes = [f["framework_code"] for f in frameworks]
            
            total_score = 0.0
            framework_count = 0
            recent_by_code: Dict[str, Dict[str, Any]] = {}
            
            # Load all recent compliance checks in one query (when not force_recheck)
            if not force_recheck and framework_codes:
                recent_checks = self.db.table("compliance_monitoring").select("*").eq(
                    "change_request_id", str(change_request_id)
                ).in_("framework_code", framework_codes).gte(
                    "checked_at", (datetime.utcnow() - timedelta(hours=24)).isoformat()
                ).order("checked_at", desc=True).execute()
                # Keep latest per framework_code
                for row in (recent_checks.data or []):
                    code = row.get("framework_code")
                    if code and code not in recent_by_code:
                        recent_by_code[code] = row
            
            # Use cached results where available
            frameworks_to_check: List[Dict[str, Any]] = []
            for framework in frameworks:
                framework_code = framework["framework_code"]
                existing = recent_by_code.get(framework_code)
                if existing:
                    compliance_results["framework_results"][framework_code] = {
                        "compliance_status": existing["compliance_status"],
                        "compliance_score": float(existing["compliance_score"]),
                        "checked_at": existing["checked_at"],
                        "findings": existing.get("findings"),
                        "missing_controls": existing.get("missing_controls", [])
                    }
                    total_score += float(existing["compliance_score"])
                    framework_count += 1
                else:
                    frameworks_to_check.append(framework)
            
            # Perform new compliance checks in parallel
            if frameworks_to_check:
                new_results = await asyncio.gather(
                    *[self._check_framework_compliance(change_request_id, f) for f in frameworks_to_check],
                    return_exceptions=True
                )
                for i, fw in enumerate(frameworks_to_check):
                    code = fw["framework_code"]
                    res = new_results[i]
                    if isinstance(res, Exception):
                        logger.warning("Compliance check failed for %s: %s", code, res)
                        compliance_results["framework_results"][code] = {
                            "compliance_status": "error",
                            "compliance_score": 0.0,
                            "error": str(res)
                        }
                    else:
                        compliance_results["framework_results"][code] = res
                        total_score += res["compliance_score"]
                        await self._store_compliance_check(change_request_id, code, res)
                        if res.get("compliance_score", 0) < 80.0:
                            compliance_results["violations"].extend(res.get("violations", []))
                    framework_count += 1
            
            # Calculate overall compliance score
            if framework_count > 0:
                compliance_results["overall_compliance_score"] = total_score / framework_count
            
            # Generate recommendations
            compliance_results["recommendations"] = await self._generate_compliance_recommendations(
                change_request_id, compliance_results["framework_results"]
            )
            
            # Log compliance check
            await self.log_audit_event(
                change_request_id=change_request_id,
                event_type=AuditEventType.COMPLIANCE_CHECK,
                event_description=f"Compliance check completed for {len(frameworks)} frameworks",
                performed_by=uuid4(),  # System user
                new_values=compliance_results,
                compliance_notes=f"Overall compliance score: {compliance_results['overall_compliance_score']:.1f}%"
            )
            
            return compliance_results
            
        except Exception as e:
            logger.error(f"Error checking compliance for change {change_request_id}: {e}")
            raise RuntimeError(f"Failed to check compliance: {str(e)}")
    
    async def generate_compliance_report(
        self,
        report_type: str = "standard",
        framework_code: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        change_request_ids: Optional[List[UUID]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive compliance report.
        
        Args:
            report_type: Type of report (standard, detailed, audit, summary)
            framework_code: Specific framework to report on
            date_from: Start date for report
            date_to: End date for report
            change_request_ids: Specific change requests to include
            
        Returns:
            Dict containing compliance report data
        """
        try:
            report_data = {
                "report_type": report_type,
                "generated_at": datetime.utcnow().isoformat(),
                "report_period": {
                    "from": date_from.isoformat() if date_from else None,
                    "to": date_to.isoformat() if date_to else None
                },
                "framework_code": framework_code,
                "executive_summary": {},
                "compliance_metrics": {},
                "audit_trail_completeness": {},
                "violations_summary": {},
                "recommendations": []
            }
            
            # Build base query for change requests
            changes_query = self.db.table("change_requests").select("*")
            
            if change_request_ids:
                changes_query = changes_query.in_("id", [str(cid) for cid in change_request_ids])
            
            if date_from:
                changes_query = changes_query.gte("created_at", date_from.isoformat())
            
            if date_to:
                changes_query = changes_query.lte("created_at", date_to.isoformat())
            
            changes_result = changes_query.execute()
            changes = changes_result.data
            
            # Calculate compliance metrics
            compliance_metrics = await self._calculate_compliance_metrics(changes, framework_code)
            report_data["compliance_metrics"] = compliance_metrics
            
            # Assess audit trail completeness
            audit_completeness = await self._assess_audit_trail_completeness(changes)
            report_data["audit_trail_completeness"] = audit_completeness
            
            # Analyze violations
            violations_summary = await self._analyze_compliance_violations(changes, framework_code)
            report_data["violations_summary"] = violations_summary
            
            # Generate executive summary
            report_data["executive_summary"] = {
                "total_changes": len(changes),
                "compliance_rate": compliance_metrics.get("overall_compliance_rate", 0),
                "audit_completeness": audit_completeness.get("completeness_percentage", 0),
                "critical_violations": violations_summary.get("critical_count", 0),
                "recommendations_count": len(report_data["recommendations"])
            }
            
            # Add detailed sections for audit reports
            if report_type == "audit":
                report_data["detailed_audit_trails"] = await self._get_detailed_audit_trails(changes)
                report_data["control_effectiveness"] = await self._assess_control_effectiveness(changes)
            
            # Log report generation
            await self.log_audit_event(
                change_request_id=uuid4(),  # System-level event
                event_type=AuditEventType.AUDIT_REVIEW,
                event_description=f"Compliance report generated: {report_type}",
                performed_by=uuid4(),  # System user
                new_values={"report_summary": report_data["executive_summary"]},
                compliance_notes=f"Compliance report for {len(changes)} change requests"
            )
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating compliance report: {e}")
            raise RuntimeError(f"Failed to generate compliance report: {str(e)}")
    
    async def export_audit_data(
        self,
        change_request_ids: List[UUID],
        export_format: str = "json",
        include_attachments: bool = False
    ) -> Dict[str, Any]:
        """
        Export audit data for external auditing or compliance purposes.
        
        Args:
            change_request_ids: List of change request IDs to export
            export_format: Format for export (json, csv, xml)
            include_attachments: Whether to include file attachments
            
        Returns:
            Dict containing export data and metadata
        """
        try:
            export_data = {
                "export_id": str(uuid4()),
                "exported_at": datetime.utcnow().isoformat(),
                "export_format": export_format,
                "change_request_count": len(change_request_ids),
                "data": {}
            }
            
            # Collect data for each change request
            for change_id in change_request_ids:
                change_data = {
                    "change_request": {},
                    "audit_trail": [],
                    "compliance_checks": [],
                    "approvals": [],
                    "implementations": [],
                    "violations": []
                }
                
                # Get change request data
                change_result = self.db.table("change_requests").select("*").eq("id", str(change_id)).execute()
                if change_result.data:
                    change_data["change_request"] = change_result.data[0]
                
                # Get audit trail
                audit_trail = await self.get_audit_trail(change_id)
                change_data["audit_trail"] = [entry.dict() for entry in audit_trail]
                
                # Get compliance checks
                compliance_result = self.db.table("compliance_monitoring").select("*").eq(
                    "change_request_id", str(change_id)
                ).execute()
                change_data["compliance_checks"] = compliance_result.data
                
                # Get approvals
                approvals_result = self.db.table("change_approvals").select("*").eq(
                    "change_request_id", str(change_id)
                ).execute()
                change_data["approvals"] = approvals_result.data
                
                # Get implementations
                implementations_result = self.db.table("change_implementations").select("*").eq(
                    "change_request_id", str(change_id)
                ).execute()
                change_data["implementations"] = implementations_result.data
                
                # Get violations
                violations_result = self.db.table("compliance_violations").select("*").eq(
                    "change_request_id", str(change_id)
                ).execute()
                change_data["violations"] = violations_result.data
                
                export_data["data"][str(change_id)] = change_data
            
            # Log data export
            await self.log_audit_event(
                change_request_id=uuid4(),  # System-level event
                event_type=AuditEventType.DATA_EXPORT,
                event_description=f"Audit data exported for {len(change_request_ids)} change requests",
                performed_by=uuid4(),  # System user
                new_values={"export_id": export_data["export_id"], "format": export_format},
                compliance_notes="Audit data exported for external review",
                risk_level="medium"  # Data export is medium risk
            )
            
            return export_data
            
        except Exception as e:
            logger.error(f"Error exporting audit data: {e}")
            raise RuntimeError(f"Failed to export audit data: {str(e)}")
    
    # Private Helper Methods for Compliance
    
    async def _check_framework_compliance(
        self,
        change_request_id: UUID,
        framework: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check compliance against a specific framework.
        
        Args:
            change_request_id: ID of the change request
            framework: Framework configuration
            
        Returns:
            Dict containing compliance check results
        """
        try:
            framework_code = framework["framework_code"]
            requirements = framework.get("requirements", {})
            
            compliance_result = {
                "framework_code": framework_code,
                "compliance_status": "compliant",
                "compliance_score": 100.0,
                "checked_at": datetime.utcnow().isoformat(),
                "required_controls": [],
                "implemented_controls": [],
                "missing_controls": [],
                "violations": [],
                "findings": ""
            }
            
            # Check audit trail requirement
            if requirements.get("audit_trail"):
                audit_trail = await self.get_audit_trail(change_request_id)
                if not audit_trail:
                    compliance_result["missing_controls"].append("audit_trail")
                    compliance_result["violations"].append({
                        "control": "audit_trail",
                        "description": "No audit trail found for change request"
                    })
                else:
                    compliance_result["implemented_controls"].append("audit_trail")
            
            # Check access controls requirement
            if requirements.get("access_controls"):
                # Check if proper approvals exist
                approvals_result = self.db.table("change_approvals").select("*").eq(
                    "change_request_id", str(change_request_id)
                ).execute()
                
                if not approvals_result.data:
                    compliance_result["missing_controls"].append("access_controls")
                    compliance_result["violations"].append({
                        "control": "access_controls",
                        "description": "No approval workflow found"
                    })
                else:
                    compliance_result["implemented_controls"].append("access_controls")
            
            # Check data retention requirement
            if requirements.get("data_retention"):
                # Verify data retention policy is applied
                retention_check = self.db.table("data_retention_policies").select("*").eq("is_active", True).execute()
                if not retention_check.data:
                    compliance_result["missing_controls"].append("data_retention")
                    compliance_result["violations"].append({
                        "control": "data_retention",
                        "description": "No active data retention policy"
                    })
                else:
                    compliance_result["implemented_controls"].append("data_retention")
            
            # Calculate compliance score
            total_controls = len(compliance_result["required_controls"]) + len(compliance_result["implemented_controls"]) + len(compliance_result["missing_controls"])
            if total_controls > 0:
                compliance_result["compliance_score"] = (len(compliance_result["implemented_controls"]) / total_controls) * 100
            
            # Determine compliance status
            if compliance_result["compliance_score"] < 80:
                compliance_result["compliance_status"] = "non_compliant"
            elif compliance_result["compliance_score"] < 95:
                compliance_result["compliance_status"] = "partially_compliant"
            else:
                compliance_result["compliance_status"] = "compliant"
            
            return compliance_result
            
        except Exception as e:
            logger.error(f"Error checking framework compliance: {e}")
            return {
                "framework_code": framework.get("framework_code", "unknown"),
                "compliance_status": "error",
                "compliance_score": 0.0,
                "error": str(e)
            }
    
    async def _store_compliance_check(
        self,
        change_request_id: UUID,
        framework_code: str,
        compliance_result: Dict[str, Any]
    ) -> None:
        """
        Store compliance check results in the database.
        
        Args:
            change_request_id: ID of the change request
            framework_code: Framework code
            compliance_result: Compliance check results
        """
        try:
            compliance_data = {
                "change_request_id": str(change_request_id),
                "framework_code": framework_code,
                "compliance_status": compliance_result["compliance_status"],
                "compliance_score": compliance_result["compliance_score"],
                "checked_at": datetime.utcnow().isoformat(),
                "checked_by": str(uuid4()),  # System user
                "check_method": "automated",
                "required_controls": compliance_result.get("required_controls", []),
                "implemented_controls": compliance_result.get("implemented_controls", []),
                "missing_controls": compliance_result.get("missing_controls", []),
                "findings": compliance_result.get("findings", ""),
                "compliance_notes": f"Automated compliance check for {framework_code}"
            }
            
            # Insert or update compliance monitoring record
            existing_check = self.db.table("compliance_monitoring").select("id").eq(
                "change_request_id", str(change_request_id)
            ).eq("framework_code", framework_code).execute()
            
            if existing_check.data:
                # Update existing record
                self.db.table("compliance_monitoring").update(compliance_data).eq(
                    "id", existing_check.data[0]["id"]
                ).execute()
            else:
                # Insert new record
                self.db.table("compliance_monitoring").insert(compliance_data).execute()
            
        except Exception as e:
            logger.error(f"Error storing compliance check: {e}")
    
    async def _calculate_compliance_metrics(
        self,
        changes: List[Dict[str, Any]],
        framework_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive compliance metrics.
        
        Args:
            changes: List of change requests
            framework_code: Specific framework to analyze
            
        Returns:
            Dict containing compliance metrics
        """
        try:
            metrics = {
                "total_changes": len(changes),
                "compliant_changes": 0,
                "non_compliant_changes": 0,
                "overall_compliance_rate": 0.0,
                "framework_breakdown": {},
                "trend_analysis": {}
            }
            
            # Get compliance monitoring data
            compliance_query = self.db.table("compliance_monitoring").select("*")
            if framework_code:
                compliance_query = compliance_query.eq("framework_code", framework_code)
            
            compliance_result = compliance_query.execute()
            compliance_data = compliance_result.data
            
            # Calculate metrics
            compliant_count = len([c for c in compliance_data if c["compliance_status"] == "compliant"])
            non_compliant_count = len([c for c in compliance_data if c["compliance_status"] == "non_compliant"])
            
            metrics["compliant_changes"] = compliant_count
            metrics["non_compliant_changes"] = non_compliant_count
            
            if len(compliance_data) > 0:
                metrics["overall_compliance_rate"] = (compliant_count / len(compliance_data)) * 100
            
            # Framework breakdown
            framework_stats = {}
            for comp in compliance_data:
                fw_code = comp["framework_code"]
                if fw_code not in framework_stats:
                    framework_stats[fw_code] = {"compliant": 0, "non_compliant": 0, "total": 0}
                
                framework_stats[fw_code]["total"] += 1
                if comp["compliance_status"] == "compliant":
                    framework_stats[fw_code]["compliant"] += 1
                else:
                    framework_stats[fw_code]["non_compliant"] += 1
            
            metrics["framework_breakdown"] = framework_stats
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating compliance metrics: {e}")
            return {"error": str(e)}
    
    async def _assess_audit_trail_completeness(
        self,
        changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Assess completeness of audit trails for change requests.
        
        Args:
            changes: List of change requests
            
        Returns:
            Dict containing audit trail completeness assessment
        """
        try:
            assessment = {
                "total_changes": len(changes),
                "changes_with_complete_audit": 0,
                "changes_with_incomplete_audit": 0,
                "completeness_percentage": 0.0,
                "missing_events": [],
                "recommendations": []
            }
            
            required_events = [
                AuditEventType.CHANGE_CREATED.value,
                AuditEventType.CHANGE_SUBMITTED.value,
                AuditEventType.APPROVAL_GRANTED.value,
                AuditEventType.IMPLEMENTATION_COMPLETED.value
            ]
            
            for change in changes:
                change_id = change["id"]
                
                # Get audit trail for this change
                audit_trail = await self.get_audit_trail(UUID(change_id))
                audit_events = [entry.event_type for entry in audit_trail]
                
                # Check for required events
                missing_events = [event for event in required_events if event not in audit_events]
                
                if not missing_events:
                    assessment["changes_with_complete_audit"] += 1
                else:
                    assessment["changes_with_incomplete_audit"] += 1
                    assessment["missing_events"].extend(missing_events)
            
            # Calculate completeness percentage
            if len(changes) > 0:
                assessment["completeness_percentage"] = (
                    assessment["changes_with_complete_audit"] / len(changes)
                ) * 100
            
            return assessment
            
        except Exception as e:
            logger.error(f"Error assessing audit trail completeness: {e}")
            return {"error": str(e)}
    
    async def _analyze_compliance_violations(
        self,
        changes: List[Dict[str, Any]],
        framework_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze compliance violations for change requests.
        
        Args:
            changes: List of change requests
            framework_code: Specific framework to analyze
            
        Returns:
            Dict containing violations analysis
        """
        try:
            # Get violations data
            violations_query = self.db.table("compliance_violations").select("*")
            if framework_code:
                violations_query = violations_query.eq("framework_code", framework_code)
            
            violations_result = violations_query.execute()
            violations = violations_result.data
            
            analysis = {
                "total_violations": len(violations),
                "critical_count": len([v for v in violations if v["severity"] == "critical"]),
                "high_count": len([v for v in violations if v["severity"] == "high"]),
                "medium_count": len([v for v in violations if v["severity"] == "medium"]),
                "low_count": len([v for v in violations if v["severity"] == "low"]),
                "open_violations": len([v for v in violations if v["status"] == "open"]),
                "resolved_violations": len([v for v in violations if v["status"] == "resolved"]),
                "violation_types": {},
                "trends": {}
            }
            
            # Analyze violation types
            violation_types = {}
            for violation in violations:
                v_type = violation["violation_type"]
                if v_type not in violation_types:
                    violation_types[v_type] = 0
                violation_types[v_type] += 1
            
            analysis["violation_types"] = violation_types
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing compliance violations: {e}")
            return {"error": str(e)}
    
    async def _generate_compliance_recommendations(
        self,
        change_request_id: UUID,
        framework_results: Dict[str, Any]
    ) -> List[str]:
        """
        Generate compliance recommendations based on check results.
        
        Args:
            change_request_id: ID of the change request
            framework_results: Results from framework compliance checks
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        for framework_code, result in framework_results.items():
            if result["compliance_score"] < 80:
                recommendations.append(
                    f"Improve {framework_code} compliance (current score: {result['compliance_score']:.1f}%)"
                )
            
            for missing_control in result.get("missing_controls", []):
                recommendations.append(
                    f"Implement missing {missing_control} control for {framework_code} compliance"
                )
        
        return recommendations