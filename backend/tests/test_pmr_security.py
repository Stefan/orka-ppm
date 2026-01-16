"""
Tests for PMR Security and Access Control
"""

import pytest
import sys
import os
from uuid import uuid4, UUID
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock the database config before importing services
sys.modules['config.database'] = MagicMock()

from services.pmr_audit_service import PMRAuditService, AuditAction
from services.pmr_privacy_service import PMRPrivacyService, SensitivityLevel
from services.pmr_export_security_service import PMRExportSecurityService, ExportSecurityLevel


class TestPMRAuditService:
    """Tests for PMR Audit Service"""
    
    @pytest.fixture
    def audit_service(self):
        """Create audit service with mocked Supabase"""
        mock_supabase = Mock()
        return PMRAuditService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_log_audit_event(self, audit_service):
        """Test logging an audit event"""
        # Mock Supabase response
        audit_service.supabase.table.return_value.insert.return_value.execute.return_value = Mock(
            data=[{"id": str(uuid4()), "action": "report_created"}]
        )
        
        user_id = uuid4()
        report_id = uuid4()
        
        result = await audit_service.log_audit_event(
            action=AuditAction.REPORT_CREATED,
            user_id=user_id,
            report_id=report_id,
            details={"title": "Test Report"}
        )
        
        assert result is not None
        assert "action" in result or "id" in result
    
    @pytest.mark.asyncio
    async def test_get_report_audit_trail(self, audit_service):
        """Test retrieving audit trail for a report"""
        # Mock Supabase response
        mock_data = [
            {
                "id": str(uuid4()),
                "action": "report_created",
                "timestamp": datetime.utcnow().isoformat()
            },
            {
                "id": str(uuid4()),
                "action": "report_updated",
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
        
        audit_service.supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.offset.return_value.execute.return_value = Mock(
            data=mock_data
        )
        
        report_id = uuid4()
        trail = await audit_service.get_report_audit_trail(report_id)
        
        assert len(trail) == 2
        assert trail[0]["action"] == "report_created"
    
    @pytest.mark.asyncio
    async def test_get_sensitive_data_access_log(self, audit_service):
        """Test retrieving sensitive data access log"""
        # Mock Supabase response
        mock_data = [
            {
                "id": str(uuid4()),
                "action": AuditAction.SENSITIVE_DATA_VIEWED,
                "user_id": str(uuid4()),
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
        
        audit_service.supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = Mock(
            data=mock_data
        )
        
        log = await audit_service.get_sensitive_data_access_log()
        
        assert len(log) == 1
        assert log[0]["action"] == AuditAction.SENSITIVE_DATA_VIEWED


class TestPMRPrivacyService:
    """Tests for PMR Privacy Service"""
    
    @pytest.fixture
    def privacy_service(self):
        """Create privacy service with mocked Supabase"""
        mock_supabase = Mock()
        return PMRPrivacyService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_classify_report_sensitivity_restricted(self, privacy_service):
        """Test classifying report with restricted data"""
        report_data = {
            "sections": [
                {
                    "content": "Employee SSN: 123-45-6789"
                }
            ]
        }
        
        level = await privacy_service.classify_report_sensitivity(report_data)
        
        assert level == SensitivityLevel.RESTRICTED
    
    @pytest.mark.asyncio
    async def test_classify_report_sensitivity_confidential(self, privacy_service):
        """Test classifying report with confidential data"""
        report_data = {
            "sections": [
                {
                    "content": "Project budget is $1,000,000"
                }
            ]
        }
        
        level = await privacy_service.classify_report_sensitivity(report_data)
        
        assert level == SensitivityLevel.CONFIDENTIAL
    
    @pytest.mark.asyncio
    async def test_mask_sensitive_data(self, privacy_service):
        """Test masking sensitive data"""
        data = {
            "email": "user@example.com",
            "phone": "555-123-4567",
            "content": "Contact me at user@example.com"
        }
        
        masked = await privacy_service.mask_sensitive_data(
            data,
            user_permissions=["pmr_read"],
            mask_level="partial"
        )
        
        assert masked["email"] != data["email"]
        assert "*" in masked["email"]
    
    @pytest.mark.asyncio
    async def test_mask_sensitive_data_with_admin_permission(self, privacy_service):
        """Test that admin users see unmasked data"""
        data = {
            "email": "user@example.com",
            "salary": "100000"
        }
        
        masked = await privacy_service.mask_sensitive_data(
            data,
            user_permissions=["system_admin"],
            mask_level="full"
        )
        
        # Admin should see unmasked data
        assert masked["email"] == data["email"]
    
    @pytest.mark.asyncio
    async def test_anonymize_report_data(self, privacy_service):
        """Test anonymizing report data"""
        report_data = {
            "id": str(uuid4()),
            "generated_by": str(uuid4()),
            "project_id": str(uuid4()),
            "sections": [
                {"content": "Sensitive content"}
            ]
        }
        
        anonymized = await privacy_service.anonymize_report_data(report_data)
        
        assert anonymized["generated_by"] != report_data["generated_by"]
        assert anonymized["project_id"] != report_data["project_id"]
        assert anonymized["sections"][0]["content"] == "[ANONYMIZED CONTENT]"


class TestPMRExportSecurityService:
    """Tests for PMR Export Security Service"""
    
    @pytest.fixture
    def export_security_service(self):
        """Create export security service with mocked Supabase"""
        mock_supabase = Mock()
        return PMRExportSecurityService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_create_secure_export(self, export_security_service):
        """Test creating a secure export"""
        # Mock Supabase response
        export_security_service.supabase.table.return_value.insert.return_value.execute.return_value = Mock(
            data=[{
                "id": str(uuid4()),
                "export_token": "test_token",
                "security_level": ExportSecurityLevel.INTERNAL
            }]
        )
        
        report_id = uuid4()
        user_id = uuid4()
        
        result = await export_security_service.create_secure_export(
            report_id=report_id,
            user_id=user_id,
            export_format="pdf",
            security_level=ExportSecurityLevel.INTERNAL,
            watermark_enabled=True,
            expiration_days=30
        )
        
        assert result is not None
        assert "export_token" in result or "id" in result
    
    @pytest.mark.asyncio
    async def test_validate_export_access_valid(self, export_security_service):
        """Test validating export access with valid token"""
        # Mock Supabase response
        export_security_service.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "export_token": "valid_token",
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "download_limit": 10,
                "download_count": 5,
                "allowed_users": None
            }]
        )
        
        result = await export_security_service.validate_export_access(
            export_token="valid_token",
            user_id=uuid4()
        )
        
        assert result["access_granted"] is True
    
    @pytest.mark.asyncio
    async def test_validate_export_access_expired(self, export_security_service):
        """Test validating export access with expired token"""
        # Mock Supabase response
        export_security_service.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "export_token": "expired_token",
                "expires_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "download_limit": None,
                "download_count": 0
            }]
        )
        
        result = await export_security_service.validate_export_access(
            export_token="expired_token",
            user_id=uuid4()
        )
        
        assert result["access_granted"] is False
        assert "expired" in result["reason"].lower()
    
    @pytest.mark.asyncio
    async def test_validate_export_access_download_limit_exceeded(self, export_security_service):
        """Test validating export access with exceeded download limit"""
        # Mock Supabase response
        export_security_service.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "export_token": "limited_token",
                "expires_at": None,
                "download_limit": 5,
                "download_count": 5
            }]
        )
        
        result = await export_security_service.validate_export_access(
            export_token="limited_token",
            user_id=uuid4()
        )
        
        assert result["access_granted"] is False
        assert "limit" in result["reason"].lower()
    
    def test_generate_watermark_text(self, export_security_service):
        """Test generating watermark text"""
        user_id = uuid4()
        report_id = uuid4()
        
        watermark = export_security_service.generate_watermark_text(
            user_id=user_id,
            report_id=report_id,
            export_format="pdf",
            security_level=ExportSecurityLevel.CONFIDENTIAL
        )
        
        assert "Generated:" in watermark
        assert "Security: CONFIDENTIAL" in watermark
        assert "Tracking:" in watermark
    
    def test_generate_watermark_config_restricted(self, export_security_service):
        """Test generating watermark config for restricted export"""
        user_id = uuid4()
        report_id = uuid4()
        
        config = export_security_service.generate_watermark_config(
            user_id=user_id,
            report_id=report_id,
            export_format="pdf",
            security_level=ExportSecurityLevel.RESTRICTED
        )
        
        assert config["opacity"] == 0.7
        assert config["add_diagonal_watermark"] is True
        assert config["diagonal_text"] == "RESTRICTED"
    
    @pytest.mark.asyncio
    async def test_record_export_download(self, export_security_service):
        """Test recording an export download"""
        # Mock Supabase responses
        export_security_service.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
            data=[{
                "export_token": "test_token",
                "download_count": 0
            }]
        )
        
        export_security_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
            data=[{"download_count": 1}]
        )
        
        export_security_service.supabase.table.return_value.insert.return_value.execute.return_value = Mock(
            data=[{"id": str(uuid4())}]
        )
        
        result = await export_security_service.record_export_download(
            export_token="test_token",
            user_id=uuid4(),
            ip_address="192.168.1.1"
        )
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_revoke_export_access(self, export_security_service):
        """Test revoking export access"""
        # Mock Supabase response
        export_security_service.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
            data=[{"is_active": False}]
        )
        
        result = await export_security_service.revoke_export_access(
            export_token="test_token",
            user_id=uuid4(),
            reason="Security concern"
        )
        
        assert result is True


class TestPMRSecurityIntegration:
    """Integration tests for PMR security features"""
    
    @pytest.mark.asyncio
    async def test_audit_trail_workflow(self):
        """Test complete audit trail workflow"""
        mock_supabase = Mock()
        audit_service = PMRAuditService(mock_supabase)
        
        # Mock responses
        mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock(
            data=[{"id": str(uuid4())}]
        )
        
        user_id = uuid4()
        report_id = uuid4()
        
        # Log report creation
        await audit_service.log_audit_event(
            action=AuditAction.REPORT_CREATED,
            user_id=user_id,
            report_id=report_id
        )
        
        # Log report update
        await audit_service.log_audit_event(
            action=AuditAction.REPORT_UPDATED,
            user_id=user_id,
            report_id=report_id
        )
        
        # Log export
        await audit_service.log_audit_event(
            action=AuditAction.EXPORT_REQUESTED,
            user_id=user_id,
            report_id=report_id
        )
        
        # Verify calls were made
        assert mock_supabase.table.call_count >= 3
    
    @pytest.mark.asyncio
    async def test_privacy_and_export_security_workflow(self):
        """Test privacy controls with export security"""
        mock_supabase = Mock()
        privacy_service = PMRPrivacyService(mock_supabase)
        export_service = PMRExportSecurityService(mock_supabase)
        
        # Classify report sensitivity
        report_data = {
            "sections": [{"content": "Budget: $1M"}]
        }
        
        sensitivity = await privacy_service.classify_report_sensitivity(report_data)
        
        # Create secure export based on sensitivity
        mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock(
            data=[{"export_token": "secure_token"}]
        )
        
        export_result = await export_service.create_secure_export(
            report_id=uuid4(),
            user_id=uuid4(),
            export_format="pdf",
            security_level=sensitivity,
            watermark_enabled=True
        )
        
        assert export_result is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
