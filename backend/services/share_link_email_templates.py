"""
Share Link Email Template System

Provides professional email templates for share link communications including:
- Share link creation and sharing
- Dynamic content based on permission levels
- Branding and contact information
"""

from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum
from models.shareable_urls import SharePermissionLevel


class EmailTemplateType(str, Enum):
    """Types of share link email templates"""
    SHARE_LINK_CREATED = "share_link_created"
    SHARE_LINK_SHARED = "share_link_shared"
    SHARE_LINK_EXPIRING = "share_link_expiring"
    SHARE_LINK_EXPIRED = "share_link_expired"
    SHARE_LINK_REVOKED = "share_link_revoked"
    FIRST_ACCESS_NOTIFICATION = "first_access_notification"
    WEEKLY_SUMMARY = "weekly_summary"


class ShareLinkEmailTemplates:
    """
    Email template system for share link communications.
    
    Provides professional, branded email templates with dynamic content
    based on permission levels and share link context.
    """
    
    def __init__(self, company_name: str = "Orka PPM", support_email: str = "support@orkappm.com"):
        self.company_name = company_name
        self.support_email = support_email
        self.base_url = "https://app.orkappm.com"  # Should be configurable
    
    def get_permission_description(self, permission_level: SharePermissionLevel) -> str:
        """Get human-readable description of permission level."""
        descriptions = {
            SharePermissionLevel.VIEW_ONLY: "View basic project information (name, description, status, progress)",
            SharePermissionLevel.LIMITED_DATA: "View project information including milestones, timeline, and public documents (excludes financial data)",
            SharePermissionLevel.FULL_PROJECT: "View comprehensive project information (excludes sensitive financial details and internal notes)"
        }
        return descriptions.get(permission_level, "View project information")
    
    def generate_share_link_email(
        self,
        recipient_email: str,
        project_name: str,
        share_url: str,
        permission_level: SharePermissionLevel,
        expires_at: datetime,
        custom_message: Optional[str] = None,
        sender_name: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate email for sharing a project link.
        
        Args:
            recipient_email: Email address of the recipient
            project_name: Name of the project being shared
            share_url: The shareable URL
            permission_level: Permission level granted
            expires_at: Expiration date/time
            custom_message: Optional custom message from sender
            sender_name: Name of the person sharing the link
            
        Returns:
            Dict with 'subject', 'html', and 'text' keys
        """
        sender_text = f"{sender_name} has" if sender_name else "You have been"
        permission_desc = self.get_permission_description(permission_level)
        
        subject = f"Project Access: {project_name}"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }}
        .content {{
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }}
        .project-info {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }}
        .access-button {{
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .permission-badge {{
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
        }}
        .expiry-info {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
        }}
        .custom-message {{
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin: 20px 0;
            font-style: italic;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }}
        .security-note {{
            font-size: 12px;
            color: #666;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 28px;">{self.company_name}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Project Access Invitation</p>
    </div>
    
    <div class="content">
        <p style="font-size: 16px; margin-top: 0;">
            {sender_text} granted access to view project information.
        </p>
        
        <div class="project-info">
            <h2 style="margin-top: 0; color: #667eea;">📊 {project_name}</h2>
            <p style="margin: 10px 0;">
                <strong>Access Level:</strong> 
                <span class="permission-badge">{permission_level.value.replace('_', ' ').title()}</span>
            </p>
            <p style="margin: 10px 0; font-size: 14px; color: #666;">
                {permission_desc}
            </p>
        </div>
        
        {f'<div class="custom-message"><strong>Message from {sender_name}:</strong><br>{custom_message}</div>' if custom_message else ''}
        
        <div style="text-align: center;">
            <a href="{share_url}" class="access-button">
                🔗 Access Project
            </a>
        </div>
        
        <div class="expiry-info">
            <strong>⏰ Access Expires:</strong> {expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}<br>
            <small>You can access this project multiple times before the expiration date.</small>
        </div>
        
        <div class="security-note">
            <strong>🔒 Security Note:</strong><br>
            This link is unique to you. Please do not share it with others. 
            If you believe this link was sent to you in error, please contact {self.support_email}.
        </div>
    </div>
    
    <div class="footer">
        <p style="margin: 0;">
            © {datetime.now().year} {self.company_name}. All rights reserved.
        </p>
        <p style="margin: 10px 0 0 0;">
            Questions? Contact us at <a href="mailto:{self.support_email}">{self.support_email}</a>
        </p>
    </div>
</body>
</html>
"""
        
        text_body = f"""
{self.company_name} - Project Access Invitation

{sender_text} granted access to view project information.

Project: {project_name}
Access Level: {permission_level.value.replace('_', ' ').title()}
{permission_desc}

{f'Message from {sender_name}:\\n{custom_message}\\n' if custom_message else ''}

Access the project here:
{share_url}

Access Expires: {expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}
You can access this project multiple times before the expiration date.

Security Note:
This link is unique to you. Please do not share it with others.
If you believe this link was sent to you in error, please contact {self.support_email}.

© {datetime.now().year} {self.company_name}. All rights reserved.
Questions? Contact us at {self.support_email}
"""
        
        return {
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "to": recipient_email
        }

    def generate_expiry_warning_email(
        self,
        recipient_email: str,
        project_name: str,
        share_url: str,
        expires_at: datetime,
        hours_remaining: int
    ) -> Dict[str, str]:
        """
        Generate email warning about upcoming expiration.
        
        Args:
            recipient_email: Email address of the link creator
            project_name: Name of the project
            share_url: The shareable URL
            expires_at: Expiration date/time
            hours_remaining: Hours until expiration
            
        Returns:
            Dict with 'subject', 'html', and 'text' keys
        """
        subject = f"⏰ Share Link Expiring Soon: {project_name}"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }}
        .content {{
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }}
        .warning-box {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .action-button {{
            display: inline-block;
            background: #ff9800;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 28px;">⏰ Expiration Warning</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Share Link Expiring Soon</p>
    </div>
    
    <div class="content">
        <p style="font-size: 16px; margin-top: 0;">
            Your share link for <strong>{project_name}</strong> will expire soon.
        </p>
        
        <div class="warning-box">
            <h3 style="margin-top: 0; color: #f57c00;">⚠️ Expiration Notice</h3>
            <p style="margin: 10px 0;">
                <strong>Time Remaining:</strong> Approximately {hours_remaining} hours
            </p>
            <p style="margin: 10px 0;">
                <strong>Expires At:</strong> {expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}
            </p>
        </div>
        
        <p>
            If you need to extend access, you can do so from the project management interface.
            After expiration, external users will no longer be able to access the project via this link.
        </p>
        
        <div style="text-align: center;">
            <a href="{self.base_url}/projects" class="action-button">
                Manage Share Links
            </a>
        </div>
    </div>
    
    <div class="footer">
        <p style="margin: 0;">
            © {datetime.now().year} {self.company_name}. All rights reserved.
        </p>
        <p style="margin: 10px 0 0 0;">
            Questions? Contact us at <a href="mailto:{self.support_email}">{self.support_email}</a>
        </p>
    </div>
</body>
</html>
"""
        
        text_body = f"""
{self.company_name} - Share Link Expiring Soon

Your share link for {project_name} will expire soon.

Time Remaining: Approximately {hours_remaining} hours
Expires At: {expires_at.strftime('%B %d, %Y at %I:%M %p UTC')}

If you need to extend access, you can do so from the project management interface.
After expiration, external users will no longer be able to access the project via this link.

Manage your share links: {self.base_url}/projects

© {datetime.now().year} {self.company_name}. All rights reserved.
Questions? Contact us at {self.support_email}
"""
        
        return {
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "to": recipient_email
        }

    def generate_first_access_notification(
        self,
        recipient_email: str,
        project_name: str,
        accessed_at: datetime,
        ip_address: str,
        location: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate email notification for first access to a share link.
        
        Args:
            recipient_email: Email address of the link creator
            project_name: Name of the project
            accessed_at: When the link was first accessed
            ip_address: IP address of the accessor
            location: Optional geographic location
            
        Returns:
            Dict with 'subject', 'html', and 'text' keys
        """
        subject = f"✓ Share Link Accessed: {project_name}"
        location_text = f" from {location}" if location else ""
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }}
        .content {{
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }}
        .info-box {{
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 28px;">✓ First Access</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Share Link Activity</p>
    </div>
    
    <div class="content">
        <p style="font-size: 16px; margin-top: 0;">
            Your share link for <strong>{project_name}</strong> has been accessed for the first time.
        </p>
        
        <div class="info-box">
            <h3 style="margin-top: 0; color: #388e3c;">📊 Access Details</h3>
            <p style="margin: 10px 0;">
                <strong>Accessed At:</strong> {accessed_at.strftime('%B %d, %Y at %I:%M %p UTC')}
            </p>
            <p style="margin: 10px 0;">
                <strong>IP Address:</strong> {ip_address}
            </p>
            {f'<p style="margin: 10px 0;"><strong>Location:</strong> {location}</p>' if location else ''}
        </div>
        
        <p>
            This is a notification that someone has accessed your shared project link. 
            You can view detailed analytics and access logs in the project management interface.
        </p>
        
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
            If this access was unexpected, you can revoke the share link immediately from your project settings.
        </p>
    </div>
    
    <div class="footer">
        <p style="margin: 0;">
            © {datetime.now().year} {self.company_name}. All rights reserved.
        </p>
        <p style="margin: 10px 0 0 0;">
            Questions? Contact us at <a href="mailto:{self.support_email}">{self.support_email}</a>
        </p>
    </div>
</body>
</html>
"""
        
        text_body = f"""
{self.company_name} - Share Link Accessed

Your share link for {project_name} has been accessed for the first time.

Access Details:
- Accessed At: {accessed_at.strftime('%B %d, %Y at %I:%M %p UTC')}
- IP Address: {ip_address}
{f'- Location: {location}' if location else ''}

This is a notification that someone has accessed your shared project link.
You can view detailed analytics and access logs in the project management interface.

If this access was unexpected, you can revoke the share link immediately from your project settings.

© {datetime.now().year} {self.company_name}. All rights reserved.
Questions? Contact us at {self.support_email}
"""
        
        return {
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "to": recipient_email
        }

    def generate_weekly_summary_email(
        self,
        recipient_email: str,
        summary_data: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate weekly summary email for share link activity.
        
        Args:
            recipient_email: Email address of the project manager
            summary_data: Dict containing summary statistics
                - projects: List of project summaries
                - total_accesses: Total access count
                - unique_visitors: Unique visitor count
                - period_start: Start of summary period
                - period_end: End of summary period
            
        Returns:
            Dict with 'subject', 'html', and 'text' keys
        """
        period_start = summary_data.get('period_start', datetime.now())
        period_end = summary_data.get('period_end', datetime.now())
        total_accesses = summary_data.get('total_accesses', 0)
        unique_visitors = summary_data.get('unique_visitors', 0)
        projects = summary_data.get('projects', [])
        
        subject = f"📊 Weekly Share Link Summary - {period_start.strftime('%b %d')} to {period_end.strftime('%b %d')}"
        
        # Generate project rows for HTML
        project_rows_html = ""
        for project in projects:
            project_rows_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">{project.get('name', 'Unknown')}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">{project.get('accesses', 0)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">{project.get('unique_visitors', 0)}</td>
            </tr>
            """
        
        # Generate project list for text
        project_list_text = ""
        for project in projects:
            project_list_text += f"\n- {project.get('name', 'Unknown')}: {project.get('accesses', 0)} accesses, {project.get('unique_visitors', 0)} unique visitors"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }}
        .content {{
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }}
        .stat-card {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
            color: #2196f3;
            margin: 10px 0;
        }}
        .stat-label {{
            font-size: 14px;
            color: #666;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th {{
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e0e0e0;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 28px;">📊 Weekly Summary</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">
            {period_start.strftime('%B %d')} - {period_end.strftime('%B %d, %Y')}
        </p>
    </div>
    
    <div class="content">
        <p style="font-size: 16px; margin-top: 0;">
            Here's your weekly summary of share link activity across your projects.
        </p>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Accesses</div>
                <div class="stat-value">{total_accesses}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique Visitors</div>
                <div class="stat-value">{unique_visitors}</div>
            </div>
        </div>
        
        {f'''
        <h3 style="color: #2196f3; margin-top: 30px;">Project Activity</h3>
        <table>
            <thead>
                <tr>
                    <th>Project</th>
                    <th style="text-align: center;">Accesses</th>
                    <th style="text-align: center;">Unique Visitors</th>
                </tr>
            </thead>
            <tbody>
                {project_rows_html}
            </tbody>
        </table>
        ''' if projects else '<p style="color: #666; text-align: center; margin: 30px 0;">No share link activity this week.</p>'}
        
        <p style="margin-top: 30px;">
            View detailed analytics and manage your share links in the project management interface.
        </p>
    </div>
    
    <div class="footer">
        <p style="margin: 0;">
            © {datetime.now().year} {self.company_name}. All rights reserved.
        </p>
        <p style="margin: 10px 0 0 0;">
            Questions? Contact us at <a href="mailto:{self.support_email}">{self.support_email}</a>
        </p>
    </div>
</body>
</html>
"""
        
        text_body = f"""
{self.company_name} - Weekly Share Link Summary
{period_start.strftime('%B %d')} - {period_end.strftime('%B %d, %Y')}

Here's your weekly summary of share link activity across your projects.

Overall Statistics:
- Total Accesses: {total_accesses}
- Unique Visitors: {unique_visitors}

{f'Project Activity:{project_list_text}' if projects else 'No share link activity this week.'}

View detailed analytics and manage your share links in the project management interface.

© {datetime.now().year} {self.company_name}. All rights reserved.
Questions? Contact us at {self.support_email}
"""
        
        return {
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "to": recipient_email
        }
    
    def generate_link_revoked_email(
        self,
        recipient_email: str,
        project_name: str,
        revoked_by: str,
        revocation_reason: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate email notification when a share link is revoked.
        
        Args:
            recipient_email: Email address to notify
            project_name: Name of the project
            revoked_by: Name of person who revoked the link
            revocation_reason: Optional reason for revocation
            
        Returns:
            Dict with 'subject', 'html', and 'text' keys
        """
        subject = f"Access Revoked: {project_name}"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }}
        .content {{
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
        }}
        .notice-box {{
            background: #ffebee;
            border-left: 4px solid #f44336;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0; font-size: 28px;">🚫 Access Revoked</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Share Link Deactivated</p>
    </div>
    
    <div class="content">
        <p style="font-size: 16px; margin-top: 0;">
            Access to <strong>{project_name}</strong> has been revoked.
        </p>
        
        <div class="notice-box">
            <h3 style="margin-top: 0; color: #d32f2f;">⚠️ Access Terminated</h3>
            <p style="margin: 10px 0;">
                The share link for this project is no longer active and cannot be used to access project information.
            </p>
            {f'<p style="margin: 10px 0;"><strong>Reason:</strong> {revocation_reason}</p>' if revocation_reason else ''}
            <p style="margin: 10px 0;">
                <strong>Revoked By:</strong> {revoked_by}
            </p>
        </div>
        
        <p>
            If you need continued access to this project, please contact the project manager 
            to request a new share link.
        </p>
    </div>
    
    <div class="footer">
        <p style="margin: 0;">
            © {datetime.now().year} {self.company_name}. All rights reserved.
        </p>
        <p style="margin: 10px 0 0 0;">
            Questions? Contact us at <a href="mailto:{self.support_email}">{self.support_email}</a>
        </p>
    </div>
</body>
</html>
"""
        
        text_body = f"""
{self.company_name} - Access Revoked

Access to {project_name} has been revoked.

The share link for this project is no longer active and cannot be used to access project information.

{f'Reason: {revocation_reason}' if revocation_reason else ''}
Revoked By: {revoked_by}

If you need continued access to this project, please contact the project manager to request a new share link.

© {datetime.now().year} {self.company_name}. All rights reserved.
Questions? Contact us at {self.support_email}
"""
        
        return {
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "to": recipient_email
        }
