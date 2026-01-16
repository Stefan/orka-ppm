"""
PMR Export Security Service
Manages export security, watermarking, and access controls for PMR report exports
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
import hashlib
import secrets

from config.database import supabase


class ExportSecurityLevel:
    """Export security levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class PMRExportSecurityService:
    """Service for managing export security and watermarking"""
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or supabase
    
    async def create_secure_export(
        self,
        report_id: UUID,
        user_id: UUID,
        export_format: str,
        security_level: str = ExportSecurityLevel.INTERNAL,
        watermark_enabled: bool = True,
        expiration_days: Optional[int] = None,
        download_limit: Optional[int] = None,
        allowed_users: Optional[List[UUID]] = None
    ) -> Dict[str, Any]:
        """
        Create a secure export with access controls
        
        Args:
            report_id: ID of the PMR report
            user_id: ID of the user requesting export
            export_format: Format of the export (pdf, excel, etc.)
            security_level: Security level for the export
            watermark_enabled: Whether to add watermark
            expiration_days: Number of days until export expires
            download_limit: Maximum number of downloads allowed
            allowed_users: List of user IDs allowed to access the export
        
        Returns:
            Secure export metadata
        """
        try:
            # Generate secure token for the export
            export_token = secrets.token_urlsafe(32)
            
            # Calculate expiration date
            expires_at = None
            if expiration_days:
                expires_at = datetime.utcnow() + timedelta(days=expiration_days)
            
            # Create export security record
            export_security = {
                "id": str(uuid4()),
                "report_id": str(report_id),
                "export_token": export_token,
                "export_format": export_format,
                "security_level": security_level,
                "watermark_enabled": watermark_enabled,
                "created_by": str(user_id),
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expires_at.isoformat() if expires_at else None,
                "download_limit": download_limit,
                "download_count": 0,
                "allowed_users": [str(uid) for uid in allowed_users] if allowed_users else None,
                "is_active": True
            }
            
            response = self.supabase.table("pmr_export_security").insert(
                export_security
            ).execute()
            
            if response.data:
                return response.data[0]
            
            return export_security
            
        except Exception as e:
            print(f"Error creating secure export: {e}")
            return {}
    
    async def validate_export_access(
        self,
        export_token: str,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Validate if a user can access an export
        
        Args:
            export_token: The export token
            user_id: ID of the user requesting access
        
        Returns:
            Validation result with access status and details
        """
        try:
            # Get export security record
            response = self.supabase.table("pmr_export_security").select("*").eq(
                "export_token", export_token
            ).eq("is_active", True).execute()
            
            if not response.data:
                return {
                    "access_granted": False,
                    "reason": "Invalid or inactive export token"
                }
            
            export_security = response.data[0]
            
            # Check expiration
            if export_security.get("expires_at"):
                expires_at = datetime.fromisoformat(export_security["expires_at"])
                if datetime.utcnow() > expires_at:
                    return {
                        "access_granted": False,
                        "reason": "Export has expired"
                    }
            
            # Check download limit
            download_limit = export_security.get("download_limit")
            download_count = export_security.get("download_count", 0)
            
            if download_limit and download_count >= download_limit:
                return {
                    "access_granted": False,
                    "reason": "Download limit exceeded"
                }
            
            # Check allowed users
            allowed_users = export_security.get("allowed_users")
            if allowed_users and str(user_id) not in allowed_users:
                return {
                    "access_granted": False,
                    "reason": "User not authorized to access this export"
                }
            
            return {
                "access_granted": True,
                "export_security": export_security
            }
            
        except Exception as e:
            print(f"Error validating export access: {e}")
            return {
                "access_granted": False,
                "reason": f"Validation error: {str(e)}"
            }
    
    async def record_export_download(
        self,
        export_token: str,
        user_id: UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        Record an export download event
        
        Args:
            export_token: The export token
            user_id: ID of the user downloading
            ip_address: IP address of the user
            user_agent: User agent string
        
        Returns:
            Success status
        """
        try:
            # Increment download count
            response = self.supabase.table("pmr_export_security").select("*").eq(
                "export_token", export_token
            ).execute()
            
            if not response.data:
                return False
            
            export_security = response.data[0]
            new_count = export_security.get("download_count", 0) + 1
            
            # Update download count
            self.supabase.table("pmr_export_security").update({
                "download_count": new_count,
                "last_downloaded_at": datetime.utcnow().isoformat(),
                "last_downloaded_by": str(user_id)
            }).eq("export_token", export_token).execute()
            
            # Log download event
            download_log = {
                "export_token": export_token,
                "user_id": str(user_id),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "downloaded_at": datetime.utcnow().isoformat()
            }
            
            self.supabase.table("pmr_export_downloads").insert(download_log).execute()
            
            return True
            
        except Exception as e:
            print(f"Error recording export download: {e}")
            return False
    
    async def revoke_export_access(
        self,
        export_token: str,
        user_id: UUID,
        reason: Optional[str] = None
    ) -> bool:
        """
        Revoke access to an export
        
        Args:
            export_token: The export token to revoke
            user_id: ID of the user revoking access
            reason: Optional reason for revocation
        
        Returns:
            Success status
        """
        try:
            # Deactivate the export
            self.supabase.table("pmr_export_security").update({
                "is_active": False,
                "revoked_at": datetime.utcnow().isoformat(),
                "revoked_by": str(user_id),
                "revocation_reason": reason
            }).eq("export_token", export_token).execute()
            
            return True
            
        except Exception as e:
            print(f"Error revoking export access: {e}")
            return False
    
    def generate_watermark_text(
        self,
        user_id: UUID,
        report_id: UUID,
        export_format: str,
        security_level: str
    ) -> str:
        """
        Generate watermark text for an export
        
        Args:
            user_id: ID of the user
            report_id: ID of the report
            export_format: Format of the export
            security_level: Security level
        
        Returns:
            Watermark text
        """
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        
        # Create a short hash for tracking
        tracking_data = f"{user_id}{report_id}{timestamp}"
        tracking_hash = hashlib.sha256(tracking_data.encode()).hexdigest()[:8]
        
        watermark_parts = [
            f"Generated: {timestamp}",
            f"Security: {security_level.upper()}",
            f"Tracking: {tracking_hash}"
        ]
        
        if security_level in [ExportSecurityLevel.CONFIDENTIAL, ExportSecurityLevel.RESTRICTED]:
            watermark_parts.append("CONFIDENTIAL - DO NOT DISTRIBUTE")
        
        return " | ".join(watermark_parts)
    
    def generate_watermark_config(
        self,
        user_id: UUID,
        report_id: UUID,
        export_format: str,
        security_level: str
    ) -> Dict[str, Any]:
        """
        Generate watermark configuration for different export formats
        
        Args:
            user_id: ID of the user
            report_id: ID of the report
            export_format: Format of the export
            security_level: Security level
        
        Returns:
            Watermark configuration dictionary
        """
        watermark_text = self.generate_watermark_text(
            user_id, report_id, export_format, security_level
        )
        
        config = {
            "text": watermark_text,
            "position": "footer",
            "font_size": 8,
            "opacity": 0.5,
            "color": "#666666"
        }
        
        # Format-specific configurations
        if export_format == "pdf":
            config.update({
                "position": "footer",
                "font_family": "Helvetica",
                "alignment": "center"
            })
        elif export_format == "excel":
            config.update({
                "position": "footer",
                "sheet_name": "All Sheets"
            })
        elif export_format in ["slides", "powerpoint"]:
            config.update({
                "position": "footer",
                "apply_to_all_slides": True
            })
        elif export_format == "word":
            config.update({
                "position": "footer",
                "section": "all"
            })
        
        # Security level specific configurations
        if security_level == ExportSecurityLevel.RESTRICTED:
            config.update({
                "opacity": 0.7,
                "color": "#FF0000",
                "font_size": 10,
                "add_diagonal_watermark": True,
                "diagonal_text": "RESTRICTED"
            })
        elif security_level == ExportSecurityLevel.CONFIDENTIAL:
            config.update({
                "opacity": 0.6,
                "color": "#FF6600",
                "add_header_watermark": True,
                "header_text": "CONFIDENTIAL"
            })
        
        return config
    
    async def get_export_security_settings(
        self,
        report_id: UUID
    ) -> Dict[str, Any]:
        """
        Get export security settings for a report
        
        Args:
            report_id: ID of the PMR report
        
        Returns:
            Export security settings
        """
        try:
            # Get report sensitivity level
            response = self.supabase.table("pmr_reports").select(
                "id, status, project_id"
            ).eq("id", str(report_id)).execute()
            
            if not response.data:
                return {
                    "security_level": ExportSecurityLevel.INTERNAL,
                    "watermark_required": True,
                    "expiration_days": 30,
                    "download_limit": None
                }
            
            report = response.data[0]
            status = report.get("status", "draft")
            
            # Determine security settings based on report status
            if status == "approved":
                return {
                    "security_level": ExportSecurityLevel.INTERNAL,
                    "watermark_required": True,
                    "expiration_days": 90,
                    "download_limit": None
                }
            elif status == "distributed":
                return {
                    "security_level": ExportSecurityLevel.PUBLIC,
                    "watermark_required": False,
                    "expiration_days": None,
                    "download_limit": None
                }
            else:  # draft or review
                return {
                    "security_level": ExportSecurityLevel.CONFIDENTIAL,
                    "watermark_required": True,
                    "expiration_days": 7,
                    "download_limit": 10
                }
            
        except Exception as e:
            print(f"Error getting export security settings: {e}")
            return {
                "security_level": ExportSecurityLevel.INTERNAL,
                "watermark_required": True,
                "expiration_days": 30,
                "download_limit": None
            }
    
    async def get_active_exports(
        self,
        report_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of active exports
        
        Args:
            report_id: Optional report ID filter
            user_id: Optional user ID filter
        
        Returns:
            List of active exports
        """
        try:
            query = self.supabase.table("pmr_export_security").select("*").eq(
                "is_active", True
            )
            
            if report_id:
                query = query.eq("report_id", str(report_id))
            
            if user_id:
                query = query.eq("created_by", str(user_id))
            
            response = query.execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error getting active exports: {e}")
            return []


# Initialize export security service
pmr_export_security_service = PMRExportSecurityService()
