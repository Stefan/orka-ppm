"""
PMR Security Integration Example
Demonstrates how to use all security components together in a real endpoint
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from uuid import UUID

from auth.pmr_security import (
    require_pmr_read_access,
    require_pmr_export_access,
    require_pmr_approve_access,
    log_pmr_access,
    PMRSecurityContext
)
from services.pmr_audit_service import pmr_audit_service, AuditAction
from services.pmr_privacy_service import pmr_privacy_service
from services.pmr_export_security_service import pmr_export_security_service
from auth.rbac import rbac

router = APIRouter(prefix="/api/reports/pmr", tags=["PMR Security Example"])


@router.get("/{report_id}")
async def get_pmr_report_secure(
    report_id: UUID,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_read_access)
):
    """
    Get a PMR report with full security controls
    
    Security Features:
    - RBAC permission check (require_pmr_read_access)
    - Audit logging
    - Data sensitivity classification
    - Automatic data masking based on user permissions
    - Access permission validation
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Log access attempt
    await log_pmr_access(report_id, AuditAction.DATA_ACCESS, current_user, request)
    
    # Check resource-specific access
    access_permissions = await pmr_privacy_service.get_data_access_permissions(
        user_id, report_id
    )
    
    if not access_permissions.get("can_view", False):
        # Log permission denied
        await pmr_audit_service.log_audit_event(
            action=AuditAction.PERMISSION_DENIED,
            user_id=user_id,
            report_id=report_id,
            details={"reason": "No view access to report"},
            ip_address=request.client.host,
            severity="warning"
        )
        raise HTTPException(status_code=403, detail="Access denied to this report")
    
    # Get report data (mock - replace with actual database query)
    report_data = {
        "id": str(report_id),
        "title": "Monthly Project Report",
        "sections": [
            {
                "name": "Executive Summary",
                "content": "Project is on track with budget of $1,000,000"
            },
            {
                "name": "Team Information",
                "content": "Contact: john.doe@example.com, Phone: 555-123-4567"
            }
        ],
        "financial_data": {
            "budget": 1000000,
            "spent": 750000,
            "remaining": 250000
        }
    }
    
    # Classify report sensitivity
    sensitivity_level = await pmr_privacy_service.classify_report_sensitivity(report_data)
    
    # Get user permissions
    user_permissions = await rbac.get_user_permissions(str(user_id))
    permission_strings = [perm.value for perm in user_permissions]
    
    # Mask sensitive data based on user permissions
    masked_report = await pmr_privacy_service.mask_sensitive_data(
        data=report_data,
        user_permissions=permission_strings,
        mask_level="partial"
    )
    
    # Log if sensitive data was accessed
    if sensitivity_level in ["confidential", "restricted"]:
        await pmr_audit_service.log_audit_event(
            action=AuditAction.SENSITIVE_DATA_VIEWED,
            user_id=user_id,
            report_id=report_id,
            details={
                "sensitivity_level": sensitivity_level,
                "sections_accessed": [s["name"] for s in report_data["sections"]]
            },
            ip_address=request.client.host,
            severity="warning"
        )
    
    return {
        "report": masked_report,
        "sensitivity_level": sensitivity_level,
        "access_permissions": access_permissions
    }


@router.post("/{report_id}/export")
async def export_pmr_report_secure(
    report_id: UUID,
    export_format: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_export_access)
):
    """
    Export a PMR report with security controls
    
    Security Features:
    - RBAC permission check (require_pmr_export_access)
    - Secure export token generation
    - Watermarking based on sensitivity
    - Download limits and expiration
    - Complete audit trail
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Use security context for automatic audit logging
    async with PMRSecurityContext(
        user_id=user_id,
        report_id=report_id,
        action=AuditAction.EXPORT_REQUESTED,
        request=request
    ):
        # Get export security settings based on report
        security_settings = await pmr_export_security_service.get_export_security_settings(
            report_id
        )
        
        # Create secure export
        export_security = await pmr_export_security_service.create_secure_export(
            report_id=report_id,
            user_id=user_id,
            export_format=export_format,
            security_level=security_settings["security_level"],
            watermark_enabled=security_settings["watermark_required"],
            expiration_days=security_settings["expiration_days"],
            download_limit=security_settings["download_limit"]
        )
        
        # Generate watermark configuration
        watermark_config = pmr_export_security_service.generate_watermark_config(
            user_id=user_id,
            report_id=report_id,
            export_format=export_format,
            security_level=security_settings["security_level"]
        )
        
        # Log export creation
        await pmr_audit_service.log_audit_event(
            action=AuditAction.EXPORT_REQUESTED,
            user_id=user_id,
            report_id=report_id,
            details={
                "export_format": export_format,
                "security_level": security_settings["security_level"],
                "watermark_enabled": security_settings["watermark_required"],
                "export_token": export_security.get("export_token")
            },
            ip_address=request.client.host
        )
        
        return {
            "export_token": export_security.get("export_token"),
            "export_format": export_format,
            "security_level": security_settings["security_level"],
            "watermark_config": watermark_config,
            "expires_at": export_security.get("expires_at"),
            "download_limit": export_security.get("download_limit"),
            "message": "Export created successfully. Use the token to download."
        }


@router.get("/export/{export_token}/download")
async def download_export_secure(
    export_token: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_export_access)
):
    """
    Download an exported report with security validation
    
    Security Features:
    - Export token validation
    - Expiration check
    - Download limit enforcement
    - User authorization check
    - Download tracking
    - Audit logging
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Validate export access
    validation = await pmr_export_security_service.validate_export_access(
        export_token=export_token,
        user_id=user_id
    )
    
    if not validation["access_granted"]:
        # Log failed download attempt
        await pmr_audit_service.log_audit_event(
            action=AuditAction.PERMISSION_DENIED,
            user_id=user_id,
            details={
                "reason": validation["reason"],
                "export_token": export_token
            },
            ip_address=request.client.host,
            severity="warning"
        )
        raise HTTPException(status_code=403, detail=validation["reason"])
    
    export_security = validation["export_security"]
    report_id = UUID(export_security["report_id"])
    
    # Record download
    await pmr_export_security_service.record_export_download(
        export_token=export_token,
        user_id=user_id,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    
    # Log successful download
    await pmr_audit_service.log_audit_event(
        action=AuditAction.EXPORT_COMPLETED,
        user_id=user_id,
        report_id=report_id,
        details={
            "export_format": export_security["export_format"],
            "download_count": export_security.get("download_count", 0) + 1
        },
        ip_address=request.client.host
    )
    
    # Return file (mock - replace with actual file serving)
    return {
        "message": "Download successful",
        "export_format": export_security["export_format"],
        "downloads_remaining": (
            export_security.get("download_limit") - export_security.get("download_count", 0) - 1
            if export_security.get("download_limit") else None
        )
    }


@router.post("/{report_id}/approve")
async def approve_pmr_report_secure(
    report_id: UUID,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_approve_access)
):
    """
    Approve a PMR report with security controls
    
    Security Features:
    - RBAC permission check (require_pmr_approve_access)
    - Audit logging with approval details
    - Security context for operation tracking
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Use security context
    async with PMRSecurityContext(
        user_id=user_id,
        report_id=report_id,
        action=AuditAction.REPORT_APPROVED,
        request=request
    ):
        # Approve report (mock - replace with actual database update)
        # ... approval logic ...
        
        # Log approval with details
        await pmr_audit_service.log_audit_event(
            action=AuditAction.REPORT_APPROVED,
            user_id=user_id,
            report_id=report_id,
            details={
                "approved_by": str(user_id),
                "approved_at": "2024-01-15T10:30:00Z",
                "approval_notes": "Report meets all requirements"
            },
            ip_address=request.client.host,
            severity="info"
        )
        
        return {
            "status": "approved",
            "approved_by": str(user_id),
            "message": "Report approved successfully"
        }


@router.get("/{report_id}/audit-trail")
async def get_audit_trail_secure(
    report_id: UUID,
    limit: int = 100,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_read_access)
):
    """
    Get audit trail for a report
    
    Security Features:
    - RBAC permission check
    - Audit access logging
    - Filtered audit trail based on user permissions
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Check if user has audit read permission
    user_permissions = await rbac.get_user_permissions(str(user_id))
    has_audit_access = any(
        perm.value == "pmr_audit_read" or perm.value == "system_admin"
        for perm in user_permissions
    )
    
    # Log audit trail access
    await pmr_audit_service.log_audit_event(
        action=AuditAction.DATA_ACCESS,
        user_id=user_id,
        report_id=report_id,
        details={
            "resource": "audit_trail",
            "has_full_access": has_audit_access
        },
        ip_address=request.client.host
    )
    
    # Get audit trail
    audit_trail = await pmr_audit_service.get_report_audit_trail(
        report_id=report_id,
        limit=limit
    )
    
    # Filter sensitive audit entries if user doesn't have full access
    if not has_audit_access:
        # Remove sensitive details from audit entries
        filtered_trail = []
        for entry in audit_trail:
            filtered_entry = {
                "action": entry.get("action"),
                "timestamp": entry.get("timestamp"),
                "severity": entry.get("severity")
            }
            # Don't include user_id or detailed information
            filtered_trail.append(filtered_entry)
        audit_trail = filtered_trail
    
    return {
        "report_id": str(report_id),
        "audit_trail": audit_trail,
        "total_entries": len(audit_trail),
        "has_full_access": has_audit_access
    }


@router.post("/{report_id}/anonymize")
async def anonymize_report_secure(
    report_id: UUID,
    preserve_structure: bool = True,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_pmr_read_access)
):
    """
    Anonymize a report for sharing or testing
    
    Security Features:
    - RBAC permission check
    - Audit logging of anonymization
    - Complete data anonymization
    """
    user_id = UUID(current_user.get("user_id"))
    
    # Get report data (mock)
    report_data = {
        "id": str(report_id),
        "generated_by": str(user_id),
        "project_id": str(UUID("12345678-1234-1234-1234-123456789012")),
        "sections": [{"content": "Sensitive content"}]
    }
    
    # Anonymize report
    anonymized_report = await pmr_privacy_service.anonymize_report_data(
        report_data=report_data,
        preserve_structure=preserve_structure
    )
    
    # Log anonymization
    await pmr_audit_service.log_audit_event(
        action="report_anonymized",
        user_id=user_id,
        report_id=report_id,
        details={
            "preserve_structure": preserve_structure,
            "anonymized_fields": ["generated_by", "project_id", "sections"]
        },
        ip_address=request.client.host
    )
    
    return {
        "anonymized_report": anonymized_report,
        "preserve_structure": preserve_structure,
        "message": "Report anonymized successfully"
    }


# Example of how to use in main.py
"""
from examples.pmr_security_integration_example import router as pmr_security_example_router

app.include_router(pmr_security_example_router)
"""
