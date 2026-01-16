# PMR Security Services - Quick Reference

## Overview

Three core security services for Enhanced PMR:

1. **Audit Service** - Track all operations
2. **Privacy Service** - Protect sensitive data
3. **Export Security Service** - Secure exports with watermarking

## Quick Start

### 1. Audit Trail

```python
from services.pmr_audit_service import pmr_audit_service, AuditAction

# Log an event
await pmr_audit_service.log_audit_event(
    action=AuditAction.REPORT_CREATED,
    user_id=user_id,
    report_id=report_id,
    details={"title": "Report Title"}
)

# Get audit trail
trail = await pmr_audit_service.get_report_audit_trail(report_id)
```

### 2. Data Privacy

```python
from services.pmr_privacy_service import pmr_privacy_service

# Classify sensitivity
level = await pmr_privacy_service.classify_report_sensitivity(report_data)

# Mask sensitive data
masked = await pmr_privacy_service.mask_sensitive_data(
    data=report_data,
    user_permissions=["pmr_read"],
    mask_level="partial"
)
```

### 3. Export Security

```python
from services.pmr_export_security_service import pmr_export_security_service

# Create secure export
export = await pmr_export_security_service.create_secure_export(
    report_id=report_id,
    user_id=user_id,
    export_format="pdf",
    watermark_enabled=True,
    expiration_days=30
)

# Validate access
validation = await pmr_export_security_service.validate_export_access(
    export_token=token,
    user_id=user_id
)
```

## Endpoint Security

```python
from auth.pmr_security import require_pmr_read_access

@router.get("/reports/pmr/{report_id}")
async def get_report(
    report_id: UUID,
    current_user = Depends(require_pmr_read_access)
):
    return report
```

## Available Permissions

- `pmr_create` - Create reports
- `pmr_read` - View reports
- `pmr_update` - Edit reports
- `pmr_delete` - Delete reports
- `pmr_approve` - Approve reports
- `pmr_export` - Export reports
- `pmr_collaborate` - Collaborate on reports
- `pmr_ai_insights` - Access AI insights
- `pmr_template_manage` - Manage templates
- `pmr_audit_read` - View audit trails

## Database Migration

```bash
psql -d your_database -f backend/migrations/022_pmr_security_audit.sql
```

## Testing

```bash
python -m pytest tests/test_pmr_security.py -v
```

## Documentation

See `backend/docs/PMR_SECURITY_IMPLEMENTATION.md` for complete documentation.
