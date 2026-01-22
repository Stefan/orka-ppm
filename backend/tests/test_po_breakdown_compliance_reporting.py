"""
Tests for PO Breakdown Compliance Reporting (Task 8.3)

This module tests audit data export and compliance report generation
with digital signature support.

**Validates: Requirements 6.5, 6.6**
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timedelta
from uuid import uuid4
from decimal import Decimal

from services.po_breakdown_service import POBreakdownDatabaseService
from models.po_breakdown import (
    AuditExportConfig,
    AuditExportFormat,
    ComplianceReportConfig,
    ComplianceReportFormat,
    DigitalSignatureAlgorithm,
    POBreakdownResponse
)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    return MagicMock()