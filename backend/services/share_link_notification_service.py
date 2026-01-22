"""
Share Link Notification Service

Handles all notifications for shareable project URLs including:
- Share link expiry warnings (24 hours before)
- First access notifications
- Suspicious activity alerts
- Weekly summary emails

Requirements: 3.5, 4.5, 8.3, 8.4
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from collections import defaultdict

from config.database import get_db
from models.shareable_urls import (
    ShareLinkNotification,
    ShareLinkEmailTemplate,
    SuspiciousAccessAlert,
    SharePermissionLevel
)
from services.share_link_email_templates import ShareLinkEmailTemplates


logger = logging.getLogger(__name__)


class ShareLinkNotificationService:
    """
    Service for managing share link notifications.
    
    This service handles:
    - Expiry warning notifications (24 hours before expiration)
    - First access notifications for link creators
    - Suspicious activity alerts
    - Weekly summary emails for active projects
    
    Requirements: 3.5, 4.5, 8.3, 8.4
    """
    
    def __init__(self, db_session=None):
        """
        Initialize the share link notification service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
        self.email_templates = ShareLinkEmailTemplates()
    
    # ==================== Expiry Warning Notifications ====================
    
    async def send_share_link_email(
        self,
        share_id: str,
        recipient_email: str,
        custom_message: Optional[str] = None,
        sender_name: Optional[str] = None
    ) -> bool:
        """
        Send share link email to external stakeholder.
        
        Args:
            share_id: Share link ID
            recipient_email: Email address of the recipient
            custom_message: Optional custom message from sender
            sender_name: Name of the person sharing the link
            
        Returns:
            bool: True if email sent successfully
            
        Requirements: 8.1, 8.2
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            # Get share link details
            share_result = self.db.table("project_shares").select(
                "id, project_id, token, permission_level, expires_at, custom_message"
            ).eq("id", share_id).execute()
            
            if not share_result.data or len(share_result.data) == 0:
                self.logger.warning(f"Share link not found: {share_id}")
                return False
            
            share = share_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select(
                "name, description"
            ).eq("id", share["project_id"]).execute()
            
            if not project_result.data or len(project_result.data) == 0:
                self.logger.warning(f"Project not found: {share['project_id']}")
                return False
            
            project = project_result.data[0]
            
            # Build share URL
            share_url = f"{self.email_templates.base_url}/projects/{share['project_id']}/share/{share['token']}"
            
            # Parse expiration date
            expires_at = datetime.fromisoformat(share["expires_at"].replace('Z', '+00:00'))
            
            # Convert permission level string to enum
            permission_level = SharePermissionLevel(share["permission_level"])
            
            # Use custom message from share if not provided
            message = custom_message or share.get("custom_message")
            
            # Use the new email template system
            email_content = self.email_templates.generate_share_link_email(
                recipient_email=recipient_email,
                project_name=project["name"],
                share_url=share_url,
                permission_level=permission_level,
                expires_at=expires_at,
                custom_message=message,
                sender_name=sender_name
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": email_content["to"],
                "subject": email_content["subject"],
                "body": email_content["html"],
                "body_text": email_content["text"],
                "notification_type": "share_link_created",
                "share_id": share_id,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"Share link email queued for {recipient_email}")
                
                # Log notification
                await self._log_notification(
                    notification_type="share_link_sent",
                    share_id=share_id,
                    project_id=share["project_id"],
                    project_name=project["name"],
                    details={
                        "recipient_email": recipient_email,
                        "sender_name": sender_name,
                        "has_custom_message": message is not None
                    }
                )
                
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending share link email: {str(e)}", exc_info=True)
            return False
    
    # ==================== Expiry Warning Notifications ====================
    
    async def send_expiry_warnings(
        self,
        hours_before: int = 24
    ) -> int:
        """
        Send expiry warning notifications for share links expiring soon.
        
        Checks for active share links that will expire within the specified
        time window and sends notifications to the link creators.
        
        Args:
            hours_before: Hours before expiration to send warning (default: 24)
            
        Returns:
            int: Number of notifications sent
            
        Requirements: 3.5, 8.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return 0
            
            # Calculate time window
            now = datetime.now(timezone.utc)
            warning_threshold = now + timedelta(hours=hours_before)
            
            # Query share links expiring within the window
            result = self.db.table("project_shares").select(
                "id, project_id, token, created_by, expires_at, permission_level, custom_message"
            ).eq("is_active", True).gte(
                "expires_at", now.isoformat()
            ).lte(
                "expires_at", warning_threshold.isoformat()
            ).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.info("No share links expiring soon")
                return 0
            
            notifications_sent = 0
            
            for share in result.data:
                try:
                    # Get project details
                    project_result = self.db.table("projects").select(
                        "name, description"
                    ).eq("id", share["project_id"]).execute()
                    
                    if not project_result.data or len(project_result.data) == 0:
                        self.logger.warning(f"Project not found for share {share['id']}")
                        continue
                    
                    project = project_result.data[0]
                    
                    # Get creator details
                    creator_result = self.db.table("auth.users").select(
                        "email, raw_user_meta_data"
                    ).eq("id", share["created_by"]).execute()
                    
                    if not creator_result.data or len(creator_result.data) == 0:
                        self.logger.warning(f"Creator not found for share {share['id']}")
                        continue
                    
                    creator = creator_result.data[0]
                    creator_email = creator.get("email", "")
                    creator_name = creator.get("raw_user_meta_data", {}).get("full_name", "User")
                    
                    # Calculate hours until expiry
                    expires_at = datetime.fromisoformat(share["expires_at"].replace('Z', '+00:00'))
                    hours_remaining = (expires_at - now).total_seconds() / 3600
                    
                    # Send notification
                    success = await self._send_expiry_warning_email(
                        share_id=share["id"],
                        project_name=project["name"],
                        creator_email=creator_email,
                        creator_name=creator_name,
                        expires_at=expires_at,
                        hours_remaining=hours_remaining,
                        permission_level=share["permission_level"]
                    )
                    
                    if success:
                        notifications_sent += 1
                        
                        # Log notification
                        await self._log_notification(
                            notification_type="expiry_warning",
                            share_id=share["id"],
                            project_id=share["project_id"],
                            project_name=project["name"],
                            details={
                                "hours_remaining": round(hours_remaining, 1),
                                "expires_at": share["expires_at"],
                                "recipient_email": creator_email
                            }
                        )
                
                except Exception as e:
                    self.logger.error(f"Error sending expiry warning for share {share['id']}: {str(e)}")
            
            self.logger.info(f"Sent {notifications_sent} expiry warning notifications")
            return notifications_sent
            
        except Exception as e:
            self.logger.error(f"Error sending expiry warnings: {str(e)}", exc_info=True)
            return 0
    
    async def _send_expiry_warning_email(
        self,
        share_id: str,
        project_name: str,
        creator_email: str,
        creator_name: str,
        expires_at: datetime,
        hours_remaining: float,
        permission_level: str
    ) -> bool:
        """
        Send expiry warning email to share link creator.
        
        Args:
            share_id: Share link ID
            project_name: Name of the project
            creator_email: Email of the link creator
            creator_name: Name of the link creator
            expires_at: Expiration datetime
            hours_remaining: Hours until expiration
            permission_level: Permission level of the share link
            
        Returns:
            bool: True if email sent successfully
        """
        try:
            # Generate share URL (placeholder - should be constructed from actual base URL)
            share_url = f"{self.email_templates.base_url}/projects/share/{share_id}"
            
            # Use the new email template system
            email_content = self.email_templates.generate_expiry_warning_email(
                recipient_email=creator_email,
                project_name=project_name,
                share_url=share_url,
                expires_at=expires_at,
                hours_remaining=int(hours_remaining)
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": email_content["to"],
                "subject": email_content["subject"],
                "body": email_content["html"],
                "body_text": email_content["text"],
                "notification_type": "expiry_warning",
                "share_id": share_id,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"Expiry warning email queued for {creator_email}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending expiry warning email: {str(e)}")
            return False
    
    def _format_expiry_warning_email(
        self,
        project_name: str,
        creator_name: str,
        expires_at: datetime,
        hours_remaining: float,
        permission_level: str,
        share_id: str
    ) -> str:
        """
        Format expiry warning email body.
        
        Args:
            project_name: Name of the project
            creator_name: Name of the link creator
            expires_at: Expiration datetime
            hours_remaining: Hours until expiration
            permission_level: Permission level
            share_id: Share link ID
            
        Returns:
            str: Formatted email body (HTML)
        """
        expiry_date_str = expires_at.strftime("%B %d, %Y at %I:%M %p %Z")
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8b500; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; }}
        .warning {{ background-color: #fff3cd; border-left: 4px solid: #f8b500; padding: 15px; margin: 20px 0; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Share Link Expiring Soon</h1>
        </div>
        <div class="content">
            <p>Hello {creator_name},</p>
            
            <div class="warning">
                <strong>⚠️ Expiry Warning</strong><br>
                Your share link for project <strong>{project_name}</strong> will expire in approximately <strong>{round(hours_remaining, 1)} hours</strong>.
            </div>
            
            <p><strong>Expiration Details:</strong></p>
            <ul>
                <li><strong>Project:</strong> {project_name}</li>
                <li><strong>Permission Level:</strong> {permission_level.replace('_', ' ').title()}</li>
                <li><strong>Expires:</strong> {expiry_date_str}</li>
            </ul>
            
            <p>If you need to extend access for external stakeholders, you can extend the expiration date from the project's share management page.</p>
            
            <a href="{{{{base_url}}}}/projects/{{{{project_id}}}}/shares" class="button">Manage Share Links</a>
            
            <p>If you no longer need this share link, no action is required. The link will automatically expire and become inaccessible.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from your Project Management System.</p>
            <p>If you have questions, please contact your system administrator.</p>
        </div>
    </div>
</body>
</html>
"""
    
    # ==================== First Access Notifications ====================
    
    async def send_first_access_notification(
        self,
        share_id: str,
        ip_address: str,
        accessed_at: datetime,
        user_agent: Optional[str] = None,
        country_code: Optional[str] = None,
        city: Optional[str] = None
    ) -> bool:
        """
        Send notification when a share link is accessed for the first time.
        
        Args:
            share_id: Share link ID
            ip_address: IP address of the accessor
            accessed_at: Time of access
            user_agent: User agent string
            country_code: Country code from geolocation
            city: City from geolocation
            
        Returns:
            bool: True if notification sent successfully
            
        Requirements: 8.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            # Check if this is truly the first access
            access_count_result = self.db.table("share_access_logs").select(
                "id", count="exact"
            ).eq("share_id", share_id).execute()
            
            if access_count_result.count and access_count_result.count > 1:
                # Not the first access, skip notification
                return False
            
            # Get share link details
            share_result = self.db.table("project_shares").select(
                "project_id, created_by, permission_level, token"
            ).eq("id", share_id).execute()
            
            if not share_result.data or len(share_result.data) == 0:
                self.logger.warning(f"Share link not found: {share_id}")
                return False
            
            share = share_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select(
                "name"
            ).eq("id", share["project_id"]).execute()
            
            if not project_result.data or len(project_result.data) == 0:
                self.logger.warning(f"Project not found: {share['project_id']}")
                return False
            
            project_name = project_result.data[0]["name"]
            
            # Get creator details
            creator_result = self.db.table("auth.users").select(
                "email, raw_user_meta_data"
            ).eq("id", share["created_by"]).execute()
            
            if not creator_result.data or len(creator_result.data) == 0:
                self.logger.warning(f"Creator not found: {share['created_by']}")
                return False
            
            creator = creator_result.data[0]
            creator_email = creator.get("email", "")
            creator_name = creator.get("raw_user_meta_data", {}).get("full_name", "User")
            
            # Send notification
            success = await self._send_first_access_email(
                project_name=project_name,
                creator_email=creator_email,
                creator_name=creator_name,
                accessed_at=accessed_at,
                ip_address=ip_address,
                country_code=country_code,
                city=city,
                permission_level=share["permission_level"]
            )
            
            if success:
                # Log notification
                await self._log_notification(
                    notification_type="first_access",
                    share_id=share_id,
                    project_id=share["project_id"],
                    project_name=project_name,
                    details={
                        "accessed_at": accessed_at.isoformat(),
                        "ip_address": ip_address,
                        "country_code": country_code,
                        "city": city,
                        "recipient_email": creator_email
                    }
                )
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error sending first access notification: {str(e)}", exc_info=True)
            return False
    
    async def _send_first_access_email(
        self,
        project_name: str,
        creator_email: str,
        creator_name: str,
        accessed_at: datetime,
        ip_address: str,
        country_code: Optional[str],
        city: Optional[str],
        permission_level: str
    ) -> bool:
        """
        Send first access email to share link creator.
        
        Args:
            project_name: Name of the project
            creator_email: Email of the link creator
            creator_name: Name of the link creator
            accessed_at: Time of access
            ip_address: IP address of accessor
            country_code: Country code
            city: City name
            permission_level: Permission level
            
        Returns:
            bool: True if email sent successfully
        """
        try:
            # Build location string
            location = None
            if city and country_code:
                location = f"{city}, {country_code}"
            elif country_code:
                location = country_code
            
            # Use the new email template system
            email_content = self.email_templates.generate_first_access_notification(
                recipient_email=creator_email,
                project_name=project_name,
                accessed_at=accessed_at,
                ip_address=ip_address,
                location=location
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": email_content["to"],
                "subject": email_content["subject"],
                "body": email_content["html"],
                "body_text": email_content["text"],
                "notification_type": "first_access",
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"First access email queued for {creator_email}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending first access email: {str(e)}")
            return False
    
    def _format_first_access_email(
        self,
        project_name: str,
        creator_name: str,
        accessed_at: datetime,
        ip_address: str,
        country_code: Optional[str],
        city: Optional[str],
        permission_level: str
    ) -> str:
        """Format first access email body."""
        access_time_str = accessed_at.strftime("%B %d, %Y at %I:%M %p %Z")
        
        location_str = "Unknown location"
        if city and country_code:
            location_str = f"{city}, {country_code}"
        elif country_code:
            location_str = country_code
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #28a745; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; }}
        .info-box {{ background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Share Link Accessed</h1>
        </div>
        <div class="content">
            <p>Hello {creator_name},</p>
            
            <p>Your share link for project <strong>{project_name}</strong> has been accessed for the first time.</p>
            
            <div class="info-box">
                <strong>Access Details:</strong><br>
                <ul style="margin: 10px 0;">
                    <li><strong>Time:</strong> {access_time_str}</li>
                    <li><strong>Location:</strong> {location_str}</li>
                    <li><strong>IP Address:</strong> {ip_address}</li>
                    <li><strong>Permission Level:</strong> {permission_level.replace('_', ' ').title()}</li>
                </ul>
            </div>
            
            <p>This notification confirms that your shared project information is being accessed by external stakeholders.</p>
            
            <p>You can view detailed analytics and access logs from the project's share management page:</p>
            
            <a href="{{{{base_url}}}}/projects/{{{{project_id}}}}/shares" class="button">View Analytics</a>
            
            <p>If this access was unexpected or unauthorized, you can immediately revoke the share link from the management page.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from your Project Management System.</p>
            <p>To disable first access notifications, update your notification preferences.</p>
        </div>
    </div>
</body>
</html>
"""
    
    # ==================== Suspicious Activity Alerts ====================
    
    async def send_suspicious_activity_alert(
        self,
        share_id: str,
        ip_address: str,
        suspicious_reasons: List[Dict[str, str]],
        accessed_at: datetime,
        country_code: Optional[str] = None,
        city: Optional[str] = None
    ) -> bool:
        """
        Send alert for suspicious activity on a share link.
        
        Args:
            share_id: Share link ID
            ip_address: IP address of suspicious access
            suspicious_reasons: List of reasons for suspicion
            accessed_at: Time of suspicious access
            country_code: Country code from geolocation
            city: City from geolocation
            
        Returns:
            bool: True if alert sent successfully
            
        Requirements: 4.5
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            # Get share link details
            share_result = self.db.table("project_shares").select(
                "project_id, created_by, permission_level"
            ).eq("id", share_id).execute()
            
            if not share_result.data or len(share_result.data) == 0:
                self.logger.warning(f"Share link not found: {share_id}")
                return False
            
            share = share_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select(
                "name"
            ).eq("id", share["project_id"]).execute()
            
            if not project_result.data or len(project_result.data) == 0:
                self.logger.warning(f"Project not found: {share['project_id']}")
                return False
            
            project_name = project_result.data[0]["name"]
            
            # Get creator details
            creator_result = self.db.table("auth.users").select(
                "email, raw_user_meta_data"
            ).eq("id", share["created_by"]).execute()
            
            if not creator_result.data or len(creator_result.data) == 0:
                self.logger.warning(f"Creator not found: {share['created_by']}")
                return False
            
            creator = creator_result.data[0]
            creator_email = creator.get("email", "")
            creator_name = creator.get("raw_user_meta_data", {}).get("full_name", "User")
            
            # Determine severity
            severity = "medium"
            for reason in suspicious_reasons:
                if reason.get("severity") == "high":
                    severity = "high"
                    break
            
            # Send alert
            success = await self._send_suspicious_activity_email(
                project_name=project_name,
                creator_email=creator_email,
                creator_name=creator_name,
                accessed_at=accessed_at,
                ip_address=ip_address,
                country_code=country_code,
                city=city,
                suspicious_reasons=suspicious_reasons,
                severity=severity,
                share_id=share_id
            )
            
            if success:
                # Log notification
                await self._log_notification(
                    notification_type="suspicious_activity",
                    share_id=share_id,
                    project_id=share["project_id"],
                    project_name=project_name,
                    details={
                        "accessed_at": accessed_at.isoformat(),
                        "ip_address": ip_address,
                        "country_code": country_code,
                        "city": city,
                        "suspicious_reasons": suspicious_reasons,
                        "severity": severity,
                        "recipient_email": creator_email
                    }
                )
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error sending suspicious activity alert: {str(e)}", exc_info=True)
            return False
    
    async def _send_suspicious_activity_email(
        self,
        project_name: str,
        creator_email: str,
        creator_name: str,
        accessed_at: datetime,
        ip_address: str,
        country_code: Optional[str],
        city: Optional[str],
        suspicious_reasons: List[Dict[str, str]],
        severity: str,
        share_id: str
    ) -> bool:
        """Send suspicious activity alert email."""
        try:
            subject = f"🚨 Suspicious Activity Alert: {project_name}"
            
            email_body = self._format_suspicious_activity_email(
                project_name=project_name,
                creator_name=creator_name,
                accessed_at=accessed_at,
                ip_address=ip_address,
                country_code=country_code,
                city=city,
                suspicious_reasons=suspicious_reasons,
                severity=severity,
                share_id=share_id
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": creator_email,
                "subject": subject,
                "body": email_body,
                "notification_type": "suspicious_activity",
                "share_id": share_id,
                "status": "pending",
                "priority": "high" if severity == "high" else "normal",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"Suspicious activity alert queued for {creator_email}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending suspicious activity email: {str(e)}")
            return False
    
    def _format_suspicious_activity_email(
        self,
        project_name: str,
        creator_name: str,
        accessed_at: datetime,
        ip_address: str,
        country_code: Optional[str],
        city: Optional[str],
        suspicious_reasons: List[Dict[str, str]],
        severity: str,
        share_id: str
    ) -> str:
        """Format suspicious activity alert email body."""
        access_time_str = accessed_at.strftime("%B %d, %Y at %I:%M %p %Z")
        
        location_str = "Unknown location"
        if city and country_code:
            location_str = f"{city}, {country_code}"
        elif country_code:
            location_str = country_code
        
        # Format suspicious reasons
        reasons_html = "<ul>"
        for reason in suspicious_reasons:
            reason_type = reason.get("type", "unknown").replace('_', ' ').title()
            description = reason.get("description", "No description")
            reasons_html += f"<li><strong>{reason_type}:</strong> {description}</li>"
        reasons_html += "</ul>"
        
        severity_color = "#dc3545" if severity == "high" else "#ffc107"
        severity_text = "HIGH PRIORITY" if severity == "high" else "MEDIUM PRIORITY"
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: {severity_color}; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; }}
        .alert-box {{ background-color: #fff3cd; border-left: 4px solid {severity_color}; padding: 15px; margin: 20px 0; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }}
        .button-secondary {{ background-color: #6c757d; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Suspicious Activity Detected</h1>
            <p style="margin: 0; font-size: 14px;">{severity_text}</p>
        </div>
        <div class="content">
            <p>Hello {creator_name},</p>
            
            <div class="alert-box">
                <strong>⚠️ Security Alert</strong><br>
                Suspicious activity has been detected on your share link for project <strong>{project_name}</strong>.
            </div>
            
            <p><strong>Access Details:</strong></p>
            <ul>
                <li><strong>Time:</strong> {access_time_str}</li>
                <li><strong>Location:</strong> {location_str}</li>
                <li><strong>IP Address:</strong> {ip_address}</li>
            </ul>
            
            <p><strong>Suspicious Activity Indicators:</strong></p>
            {reasons_html}
            
            <p><strong>Recommended Actions:</strong></p>
            <ul>
                <li>Review the access logs for this share link</li>
                <li>Verify that the access pattern is expected</li>
                <li>Consider revoking the share link if unauthorized</li>
                <li>Contact your security team if needed</li>
            </ul>
            
            <a href="{{{{base_url}}}}/projects/{{{{project_id}}}}/shares" class="button">Review & Revoke Link</a>
            <a href="{{{{base_url}}}}/projects/{{{{project_id}}}}/shares/analytics" class="button button-secondary">View Analytics</a>
            
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                <strong>Note:</strong> This alert is generated automatically based on access patterns. 
                If you believe this is a false positive, you can safely ignore this notification.
            </p>
        </div>
        <div class="footer">
            <p>This is an automated security notification from your Project Management System.</p>
            <p>For security concerns, contact your system administrator immediately.</p>
        </div>
    </div>
</body>
</html>
"""
    
    # ==================== Weekly Summary Emails ====================
    
    async def send_weekly_summaries(self) -> int:
        """
        Send weekly summary emails for active share links.
        
        Generates and sends summary reports to project managers with active
        share links, including access statistics and key insights.
        
        Returns:
            int: Number of summary emails sent
            
        Requirements: 8.4
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return 0
            
            # Calculate date range (last 7 days)
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=7)
            
            # Get all active share links
            shares_result = self.db.table("project_shares").select(
                "id, project_id, created_by, permission_level, created_at"
            ).eq("is_active", True).execute()
            
            if not shares_result.data or len(shares_result.data) == 0:
                self.logger.info("No active share links found")
                return 0
            
            # Group share links by creator
            shares_by_creator = defaultdict(list)
            for share in shares_result.data:
                shares_by_creator[share["created_by"]].append(share)
            
            summaries_sent = 0
            
            for creator_id, shares in shares_by_creator.items():
                try:
                    # Get creator details
                    creator_result = self.db.table("auth.users").select(
                        "email, raw_user_meta_data"
                    ).eq("id", creator_id).execute()
                    
                    if not creator_result.data or len(creator_result.data) == 0:
                        continue
                    
                    creator = creator_result.data[0]
                    creator_email = creator.get("email", "")
                    creator_name = creator.get("raw_user_meta_data", {}).get("full_name", "User")
                    
                    # Collect summary data for all shares
                    summary_data = []
                    
                    for share in shares:
                        # Get access logs for this share in the last week
                        logs_result = self.db.table("share_access_logs").select(
                            "id, accessed_at, ip_address, is_suspicious"
                        ).eq("share_id", share["id"]).gte(
                            "accessed_at", start_date.isoformat()
                        ).execute()
                        
                        access_count = len(logs_result.data) if logs_result.data else 0
                        
                        if access_count == 0:
                            # Skip shares with no activity
                            continue
                        
                        # Get project name
                        project_result = self.db.table("projects").select(
                            "name"
                        ).eq("id", share["project_id"]).execute()
                        
                        project_name = "Unknown Project"
                        if project_result.data and len(project_result.data) > 0:
                            project_name = project_result.data[0]["name"]
                        
                        # Calculate unique visitors
                        unique_ips = set(log["ip_address"] for log in logs_result.data) if logs_result.data else set()
                        
                        # Count suspicious accesses
                        suspicious_count = sum(
                            1 for log in logs_result.data 
                            if log.get("is_suspicious", False)
                        ) if logs_result.data else 0
                        
                        summary_data.append({
                            "project_name": project_name,
                            "share_id": share["id"],
                            "permission_level": share["permission_level"],
                            "access_count": access_count,
                            "unique_visitors": len(unique_ips),
                            "suspicious_count": suspicious_count
                        })
                    
                    if not summary_data:
                        # No activity for any shares, skip this creator
                        continue
                    
                    # Send weekly summary email
                    success = await self._send_weekly_summary_email(
                        creator_email=creator_email,
                        creator_name=creator_name,
                        summary_data=summary_data,
                        start_date=start_date,
                        end_date=end_date
                    )
                    
                    if success:
                        summaries_sent += 1
                
                except Exception as e:
                    self.logger.error(f"Error sending weekly summary for creator {creator_id}: {str(e)}")
            
            self.logger.info(f"Sent {summaries_sent} weekly summary emails")
            return summaries_sent
            
        except Exception as e:
            self.logger.error(f"Error sending weekly summaries: {str(e)}", exc_info=True)
            return 0
    
    async def _send_weekly_summary_email(
        self,
        creator_email: str,
        creator_name: str,
        summary_data: List[Dict[str, Any]],
        start_date: datetime,
        end_date: datetime
    ) -> bool:
        """Send weekly summary email."""
        try:
            # Calculate totals
            total_accesses = sum(item["access_count"] for item in summary_data)
            total_unique_visitors = sum(item["unique_visitors"] for item in summary_data)
            
            # Format projects for template
            projects = [
                {
                    "name": item["project_name"],
                    "accesses": item["access_count"],
                    "unique_visitors": item["unique_visitors"]
                }
                for item in summary_data
            ]
            
            # Prepare summary data for template
            template_summary_data = {
                "projects": projects,
                "total_accesses": total_accesses,
                "unique_visitors": total_unique_visitors,
                "period_start": start_date,
                "period_end": end_date
            }
            
            # Use the new email template system
            email_content = self.email_templates.generate_weekly_summary_email(
                recipient_email=creator_email,
                summary_data=template_summary_data
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": email_content["to"],
                "subject": email_content["subject"],
                "body": email_content["html"],
                "body_text": email_content["text"],
                "notification_type": "weekly_summary",
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"Weekly summary email queued for {creator_email}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending weekly summary email: {str(e)}")
            return False
    
    def _format_weekly_summary_email(
        self,
        creator_name: str,
        summary_data: List[Dict[str, Any]],
        start_date: datetime,
        end_date: datetime
    ) -> str:
        """Format weekly summary email body."""
        date_range = f"{start_date.strftime('%B %d')} - {end_date.strftime('%B %d, %Y')}"
        
        # Calculate totals
        total_accesses = sum(item["access_count"] for item in summary_data)
        total_unique_visitors = sum(item["unique_visitors"] for item in summary_data)
        total_suspicious = sum(item["suspicious_count"] for item in summary_data)
        
        # Build project summaries HTML
        projects_html = ""
        for item in summary_data:
            suspicious_badge = ""
            if item["suspicious_count"] > 0:
                suspicious_badge = f'<span style="background-color: #dc3545; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 10px;">⚠️ {item["suspicious_count"]} suspicious</span>'
            
            projects_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <strong>{item["project_name"]}</strong>{suspicious_badge}<br>
                    <small style="color: #666;">{item["permission_level"].replace('_', ' ').title()}</small>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">{item["access_count"]}</td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">{item["unique_visitors"]}</td>
            </tr>
            """
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #007bff; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; }}
        .stats-box {{ background-color: white; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 20px 0; }}
        .stat-item {{ display: inline-block; width: 30%; text-align: center; padding: 10px; }}
        .stat-value {{ font-size: 32px; font-weight: bold; color: #007bff; }}
        .stat-label {{ font-size: 12px; color: #666; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; background-color: white; margin: 20px 0; }}
        th {{ background-color: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Share Link Summary</h1>
            <p style="margin: 0;">{date_range}</p>
        </div>
        <div class="content">
            <p>Hello {creator_name},</p>
            
            <p>Here's your weekly summary of share link activity across your projects:</p>
            
            <div class="stats-box">
                <div class="stat-item">
                    <div class="stat-value">{total_accesses}</div>
                    <div class="stat-label">Total Accesses</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{total_unique_visitors}</div>
                    <div class="stat-label">Unique Visitors</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{total_suspicious}</div>
                    <div class="stat-label">Suspicious Events</div>
                </div>
            </div>
            
            <h3>Project Activity</h3>
            <table>
                <thead>
                    <tr>
                        <th>Project</th>
                        <th style="text-align: center;">Accesses</th>
                        <th style="text-align: center;">Unique Visitors</th>
                    </tr>
                </thead>
                <tbody>
                    {projects_html}
                </tbody>
            </table>
            
            <p>You can view detailed analytics and manage your share links from the project management dashboard:</p>
            
            <a href="{{{{base_url}}}}/projects" class="button">View All Projects</a>
            
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                <strong>Tip:</strong> Regular monitoring of share link activity helps ensure secure and effective stakeholder communication.
            </p>
        </div>
        <div class="footer">
            <p>This is an automated weekly summary from your Project Management System.</p>
            <p>To adjust notification preferences, visit your account settings.</p>
        </div>
    </div>
</body>
</html>
"""
    
    # ==================== Helper Methods ====================
    
    async def send_link_revoked_notification(
        self,
        share_id: str,
        recipient_email: str,
        revoked_by_name: str,
        revocation_reason: Optional[str] = None
    ) -> bool:
        """
        Send notification when a share link is revoked.
        
        Args:
            share_id: Share link ID
            recipient_email: Email address to notify
            revoked_by_name: Name of person who revoked the link
            revocation_reason: Optional reason for revocation
            
        Returns:
            bool: True if notification sent successfully
            
        Requirements: 8.5
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            # Get share link details
            share_result = self.db.table("project_shares").select(
                "project_id"
            ).eq("id", share_id).execute()
            
            if not share_result.data or len(share_result.data) == 0:
                self.logger.warning(f"Share link not found: {share_id}")
                return False
            
            share = share_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select(
                "name"
            ).eq("id", share["project_id"]).execute()
            
            if not project_result.data or len(project_result.data) == 0:
                self.logger.warning(f"Project not found: {share['project_id']}")
                return False
            
            project_name = project_result.data[0]["name"]
            
            # Use the new email template system
            email_content = self.email_templates.generate_link_revoked_email(
                recipient_email=recipient_email,
                project_name=project_name,
                revoked_by=revoked_by_name,
                revocation_reason=revocation_reason
            )
            
            # Queue email for sending
            email_data = {
                "id": str(uuid4()),
                "recipient_email": email_content["to"],
                "subject": email_content["subject"],
                "body": email_content["html"],
                "body_text": email_content["text"],
                "notification_type": "link_revoked",
                "share_id": share_id,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.db.table("email_queue").insert(email_data).execute()
            
            if result.data and len(result.data) > 0:
                self.logger.info(f"Link revoked email queued for {recipient_email}")
                
                # Log notification
                await self._log_notification(
                    notification_type="link_revoked",
                    share_id=share_id,
                    project_id=share["project_id"],
                    project_name=project_name,
                    details={
                        "recipient_email": recipient_email,
                        "revoked_by": revoked_by_name,
                        "revocation_reason": revocation_reason
                    }
                )
                
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending link revoked notification: {str(e)}", exc_info=True)
            return False
    
    # ==================== Helper Methods ====================
    
    async def _log_notification(
        self,
        notification_type: str,
        share_id: str,
        project_id: str,
        project_name: str,
        details: Dict[str, Any]
    ) -> None:
        """
        Log a notification to the database.
        
        Args:
            notification_type: Type of notification
            share_id: Share link ID
            project_id: Project ID
            project_name: Project name
            details: Additional notification details
        """
        try:
            if not self.db:
                return
            
            notification_data = {
                "id": str(uuid4()),
                "notification_type": notification_type,
                "share_id": share_id,
                "project_id": project_id,
                "project_name": project_name,
                "details": details,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.db.table("share_link_notifications").insert(notification_data).execute()
            
        except Exception as e:
            self.logger.error(f"Error logging notification: {str(e)}")
