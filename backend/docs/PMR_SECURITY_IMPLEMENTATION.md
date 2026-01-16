# PMR Security and Access Control Implementation

## Overview

This document describes the security and access control implementation for the Enhanced Project Monthly Report (PMR) feature. The implementation provides comprehensive security controls including role-based permissions, audit trails, data privacy controls, and export security with watermarking.

## Components

### 1. Role-Based Access Control (RBAC)

#### PMR-Specific Permissions

The following permissions have been added to the RBAC system:

- `pmr_create`: Create new PMR reports
- `pmr_read`: View PMR reports
- `pmr_update`: Edit PMR reports
- `pmr_delete`: Delete PMR reports
- `pmr_approve`: Approve PMR reports for distribution
- `pmr_export`: Export PMR reports to various formats
- `pmr_collaborate`: Participate in collaborative editing
- `pmr_ai_insights`: Access AI-generated insights
- `pmr_template_manage`: Manage PMR templates
- `pmr_audit_read`: View audit trails

#### Role Assignments

Default permissions by role:

- **Admin**: All PMR permissions
- **Portfolio Manager**: Create, read, update, approve, export, collaborate, AI insights, audit read
- **Project Manager**: Create, read, update, export, collaborate, AI insights
- **Resource Manager**: Read only
- **Team Member**: Read only
- **Viewer**: Read only

### 2. Audit Trail Service

**File**: `backend/services/pmr_audit_service.py`

The audit service tracks all operations on PMR reports for compliance and security monitoring.

#### Key Features

- **Comprehensive Event Logging**: Tracks all report operations including creation, updates, exports, and AI operations
- **User Activity Tracking**: Records user actions with IP addresses and user agents
- **Sensitive Data Access Logging**: Special tracking for sensitive data access
- **Permission Denied Events**: Logs unauthorized access attempts
- **Compliance Reporting**: Generate compliance reports for date ranges

#### Audit Actions

```python
REPORT_CREATED
REPORT_UPDATED
REPORT_DELETED
REPORT_APPROVED
REPORT_EXPORTED
SECTION_UPDATED
AI_INSIGHT_GENERATED
AI_INSIGHT_VALIDATED
COLLABORATION_STARTED
COLLABORATION_ENDED
PARTICIPANT_ADDED
PARTICIPANT_REMOVED
COMMENT_ADDED
COMMENT_RESOLVED
TEMPLATE_APPLIED
MONTE_CARLO_RUN
EXPORT_REQUESTED
EXPORT_COMPLETED
EXPORT_FAILED
PERMISSION_DENIED
DATA_ACCESS
SENSITIVE_DATA_VIEWED
```

#### Usage Example

```python
from services.pmr_audit_service import pmr_audit_service, AuditAction

# Log a report creation
await pmr_audit_service.log_audit_event(
    action=AuditAction.REPORT_CREATED,
    user_id=user_id,
    report_id=report_id,
    details={"title": "Monthly Report", "status": "draft"},
    ip_address="192.168.1.1",
    severity="info"
)

# Get audit trail for a report
trail = await pmr_audit_service.get_report_audit_trail(
    report_id=report_id,
    limit=100
)

# Generate compliance report
compliance_report = await pmr_audit_service.generate_compliance_report(
    start_date=start_date,
    end_date=end_date,
    report_id=report_id
)
```

### 3. Data Privacy Service

**File**: `backend/services/pmr_privacy_service.py`

The privacy service manages data sensitivity classification, masking, and anonymization.

#### Key Features

- **Automatic Sensitivity Classification**: Classifies reports as public, internal, confidential, or restricted
- **PII Detection**: Detects and masks personally identifiable information
- **Field-Level Masking**: Masks sensitive fields based on user permissions
- **Data Anonymization**: Anonymizes reports for sharing or testing
- **Access Permission Management**: Manages fine-grained access permissions

#### Sensitivity Levels

- **PUBLIC**: No sensitive data, can be shared externally
- **INTERNAL**: Internal use only, no PII or financial data
- **CONFIDENTIAL**: Contains financial or business-sensitive data
- **RESTRICTED**: Contains PII or highly sensitive information

#### Usage Example

```python
from services.pmr_privacy_service import pmr_privacy_service

# Classify report sensitivity
sensitivity = await pmr_privacy_service.classify_report_sensitivity(report_data)

# Mask sensitive data based on user permissions
masked_data = await pmr_privacy_service.mask_sensitive_data(
    data=report_data,
    user_permissions=user_permissions,
    mask_level="partial"
)

# Check user access permissions
permissions = await pmr_privacy_service.get_data_access_permissions(
    user_id=user_id,
    report_id=report_id
)

# Anonymize report for sharing
anonymized = await pmr_privacy_service.anonymize_report_data(
    report_data=report_data,
    preserve_structure=True
)
```

### 4. Export Security Service

**File**: `backend/services/pmr_export_security_service.py`

The export security service manages secure exports with watermarking and access controls.

#### Key Features

- **Secure Export Tokens**: Generate unique tokens for each export
- **Expiration Controls**: Set expiration dates for exports
- **Download Limits**: Limit the number of times an export can be downloaded
- **User Access Lists**: Restrict exports to specific users
- **Watermarking**: Add security watermarks to exports
- **Download Tracking**: Track all export downloads

#### Export Security Levels

- **PUBLIC**: No restrictions, no watermark
- **INTERNAL**: Internal use, basic watermark
- **CONFIDENTIAL**: Restricted access, prominent watermark
- **RESTRICTED**: Highly restricted, diagonal watermark overlay

#### Usage Example

```python
from services.pmr_export_security_service import pmr_export_security_service

# Create secure export
export_security = await pmr_export_security_service.create_secure_export(
    report_id=report_id,
    user_id=user_id,
    export_format="pdf",
    security_level="confidential",
    watermark_enabled=True,
    expiration_days=30,
    download_limit=10,
    allowed_users=[user1_id, user2_id]
)

# Validate export access
validation = await pmr_export_security_service.validate_export_access(
    export_token=token,
    user_id=user_id
)

if validation["access_granted"]:
    # Record download
    await pmr_export_security_service.record_export_download(
        export_token=token,
        user_id=user_id,
        ip_address=ip_address
    )

# Generate watermark configuration
watermark_config = pmr_export_security_service.generate_watermark_config(
    user_id=user_id,
    report_id=report_id,
    export_format="pdf",
    security_level="confidential"
)
```

### 5. Security Middleware

**File**: `backend/auth/pmr_security.py`

Provides FastAPI dependencies for endpoint security.

#### Available Dependencies

```python
from auth.pmr_security import (
    require_pmr_read_access,
    require_pmr_write_access,
    require_pmr_approve_access,
    require_pmr_export_access,
    require_pmr_collaborate_access,
    require_pmr_audit_access,
    check_report_access,
    log_pmr_access,
    PMRSecurityContext
)
```

#### Usage in Endpoints

```python
from fastapi import APIRouter, Depends
from auth.pmr_security import require_pmr_read_access, log_pmr_access

router = APIRouter()

@router.get("/reports/pmr/{report_id}")
async def get_pmr_report(
    report_id: UUID,
    current_user = Depends(require_pmr_read_access)
):
    # Log access
    await log_pmr_access(report_id, "report_viewed", current_user)
    
    # Get report...
    return report

@router.post("/reports/pmr/{report_id}/approve")
async def approve_report(
    report_id: UUID,
    current_user = Depends(require_pmr_approve_access)
):
    # Approve report...
    return {"status": "approved"}
```

#### Security Context Manager

```python
from auth.pmr_security import PMRSecurityContext

async def process_report(report_id: UUID, user_id: UUID):
    async with PMRSecurityContext(
        user_id=user_id,
        report_id=report_id,
        action="report_processing"
    ):
        # Process report
        # Automatically logs start and completion/failure
        pass
```

## Database Schema

### Audit Log Table

```sql
CREATE TABLE pmr_audit_log (
    id UUID PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL,
    report_id UUID REFERENCES pmr_reports(id),
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    severity VARCHAR(20),
    timestamp TIMESTAMP,
    created_at TIMESTAMP
);
```

### Export Security Table

```sql
CREATE TABLE pmr_export_security (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL,
    export_token VARCHAR(255) UNIQUE,
    export_format VARCHAR(20),
    security_level VARCHAR(20),
    watermark_enabled BOOLEAN,
    created_by UUID,
    expires_at TIMESTAMP,
    download_limit INTEGER,
    download_count INTEGER,
    allowed_users JSONB,
    is_active BOOLEAN
);
```

### Access Control Table

```sql
CREATE TABLE pmr_access_control (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL,
    user_id UUID NOT NULL,
    access_level VARCHAR(20),
    can_view BOOLEAN,
    can_edit BOOLEAN,
    can_export BOOLEAN,
    can_approve BOOLEAN,
    granted_by UUID,
    expires_at TIMESTAMP,
    is_active BOOLEAN
);
```

## Security Best Practices

### 1. Always Log Sensitive Operations

```python
# Log before performing sensitive operations
await pmr_audit_service.log_audit_event(
    action=AuditAction.SENSITIVE_DATA_VIEWED,
    user_id=user_id,
    report_id=report_id,
    severity="warning"
)
```

### 2. Validate Permissions at Multiple Levels

```python
# Check both RBAC permissions and resource-specific access
has_permission = await rbac.has_permission(user_id, Permission.pmr_read)
has_access = await check_report_access(report_id, "view", current_user)
```

### 3. Mask Data Based on User Permissions

```python
# Always mask sensitive data before returning to client
masked_report = await pmr_privacy_service.mask_sensitive_data(
    data=report,
    user_permissions=user_permissions,
    mask_level="partial"
)
```

### 4. Use Secure Export Tokens

```python
# Always use secure tokens for exports
export_security = await pmr_export_security_service.create_secure_export(
    report_id=report_id,
    user_id=user_id,
    export_format="pdf",
    watermark_enabled=True,
    expiration_days=7  # Short expiration for sensitive data
)
```

### 5. Monitor Failed Access Attempts

```python
# Regularly check for permission denied events
denied_events = await pmr_audit_service.get_permission_denied_events(
    days=7,
    limit=100
)

# Alert on suspicious patterns
if len(denied_events) > threshold:
    # Send security alert
    pass
```

## Compliance Features

### GDPR Compliance

- **Right to Access**: Audit trails provide complete access history
- **Right to Erasure**: Anonymization functions support data deletion
- **Data Minimization**: Automatic PII detection and masking
- **Consent Management**: Access control tracks user permissions

### SOC 2 Compliance

- **Access Controls**: Role-based permissions and audit trails
- **Change Management**: Complete audit trail of all changes
- **Monitoring**: Real-time tracking of security events
- **Data Protection**: Encryption and watermarking for exports

### HIPAA Compliance (if applicable)

- **Access Logging**: All PHI access is logged
- **Minimum Necessary**: Data masking ensures minimum necessary access
- **Audit Controls**: Comprehensive audit trails
- **Transmission Security**: Secure export tokens and watermarking

## Testing

Run security tests:

```bash
cd backend
python -m pytest tests/test_pmr_security.py -v
```

## Migration

Apply the security schema migration:

```bash
# Using your migration tool
psql -d your_database -f backend/migrations/022_pmr_security_audit.sql
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Failed Access Attempts**: Track permission denied events
2. **Sensitive Data Access**: Monitor SENSITIVE_DATA_VIEWED events
3. **Export Activity**: Track export requests and downloads
4. **Unusual Patterns**: Detect anomalous access patterns

### Example Monitoring Query

```sql
-- Get failed access attempts in last 24 hours
SELECT user_id, COUNT(*) as attempts
FROM pmr_audit_log
WHERE action = 'permission_denied'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 10
ORDER BY attempts DESC;
```

## Future Enhancements

1. **Multi-Factor Authentication**: Add MFA for sensitive operations
2. **IP Whitelisting**: Restrict access by IP address
3. **Time-Based Access**: Implement time-based access restrictions
4. **Advanced Anomaly Detection**: ML-based security monitoring
5. **Blockchain Audit Trail**: Immutable audit trail using blockchain
6. **Zero-Knowledge Encryption**: End-to-end encryption for sensitive data

## Support

For questions or issues related to PMR security:

1. Check the audit logs for detailed operation history
2. Review permission configurations in RBAC
3. Verify database schema is up to date
4. Contact the security team for access control issues
