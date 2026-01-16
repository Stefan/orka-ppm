"""
Audit Integration Hub Service

This service manages external integrations for audit alerts and notifications.
Supports webhooks for Slack, Microsoft Teams, and Zapier with retry logic
and exponential backoff.

Requirements: 5.6, 5.7, 5.8, 5.11
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass

# Optional dependency - gracefully handle if not installed
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    logging.warning("aiohttp not available - webhook integrations will be disabled")

from config.database import supabase


@dataclass
class WebhookDeliveryResult:
    """Result of webhook delivery attempt."""
    success: bool
    status_code: Optional[int]
    error_message: Optional[str]
    attempts: int


class AuditIntegrationHub:
    """
    Manages external integrations for audit alerts.
    
    Provides webhook delivery with retry logic and exponential backoff
    for Slack, Microsoft Teams, and Zapier integrations.
    """
    
    def __init__(self, supabase_client=None):
        """
        Initialize Audit Integration Hub
        
        Args:
            supabase_client: Supabase client for database operations
        """
        self.supabase = supabase_client or supabase
        self.logger = logging.getLogger(__name__)
        
        # Retry configuration
        self.max_retries = 3
        self.base_delay = 1  # seconds
        self.max_delay = 30  # seconds
        self.timeout = 10  # seconds
        
        self.logger.info("AuditIntegrationHub initialized")
    
    async def send_slack_notification(
        self,
        anomaly: Dict[str, Any],
        webhook_url: str
    ) -> WebhookDeliveryResult:
        """
        Send formatted notification to Slack channel.
        
        Formats anomaly data as Slack message blocks for rich display.
        
        Args:
            anomaly: Anomaly detection data
            webhook_url: Slack webhook URL
            
        Returns:
            WebhookDeliveryResult with delivery status
            
        Requirements: 5.7
        """
        try:
            # Format Slack message blocks
            message = self._format_slack_message(anomaly)
            
            # Send webhook with retry
            result = await self._send_webhook_with_retry(
                webhook_url,
                message,
                "Slack"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Slack notification failed: {str(e)}")
            return WebhookDeliveryResult(
                success=False,
                status_code=None,
                error_message=str(e),
                attempts=0
            )
    
    async def send_teams_notification(
        self,
        anomaly: Dict[str, Any],
        webhook_url: str
    ) -> WebhookDeliveryResult:
        """
        Send formatted notification to Microsoft Teams.
        
        Formats anomaly data as Teams adaptive card for rich display.
        
        Args:
            anomaly: Anomaly detection data
            webhook_url: Teams webhook URL
            
        Returns:
            WebhookDeliveryResult with delivery status
            
        Requirements: 5.8
        """
        try:
            # Format Teams adaptive card
            message = self._format_teams_message(anomaly)
            
            # Send webhook with retry
            result = await self._send_webhook_with_retry(
                webhook_url,
                message,
                "Teams"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Teams notification failed: {str(e)}")
            return WebhookDeliveryResult(
                success=False,
                status_code=None,
                error_message=str(e),
                attempts=0
            )
    
    async def trigger_zapier_webhook(
        self,
        anomaly: Dict[str, Any],
        webhook_url: str
    ) -> WebhookDeliveryResult:
        """
        Trigger Zapier webhook with structured anomaly data.
        
        Sends structured JSON data for Zapier workflow automation.
        
        Args:
            anomaly: Anomaly detection data
            webhook_url: Zapier webhook URL
            
        Returns:
            WebhookDeliveryResult with delivery status
            
        Requirements: 5.6
        """
        try:
            # Format structured data for Zapier
            message = self._format_zapier_payload(anomaly)
            
            # Send webhook with retry
            result = await self._send_webhook_with_retry(
                webhook_url,
                message,
                "Zapier"
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Zapier webhook failed: {str(e)}")
            return WebhookDeliveryResult(
                success=False,
                status_code=None,
                error_message=str(e),
                attempts=0
            )
    
    async def _send_webhook_with_retry(
        self,
        webhook_url: str,
        payload: Dict[str, Any],
        integration_type: str
    ) -> WebhookDeliveryResult:
        """
        Send webhook with exponential backoff retry logic.
        
        Args:
            webhook_url: Webhook URL to send to
            payload: JSON payload to send
            integration_type: Type of integration (for logging)
            
        Returns:
            WebhookDeliveryResult with delivery status
        """
        if not AIOHTTP_AVAILABLE:
            self.logger.error(f"{integration_type} webhook failed: aiohttp not available")
            return WebhookDeliveryResult(
                success=False,
                status_code=None,
                error_message="aiohttp library not installed",
                attempts=0
            )
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        webhook_url,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=self.timeout),
                        headers={'Content-Type': 'application/json'}
                    ) as response:
                        if response.status in [200, 201, 202, 204]:
                            self.logger.info(
                                f"{integration_type} webhook delivered successfully "
                                f"(attempt {attempt + 1}/{self.max_retries})"
                            )
                            return WebhookDeliveryResult(
                                success=True,
                                status_code=response.status,
                                error_message=None,
                                attempts=attempt + 1
                            )
                        else:
                            error_text = await response.text()
                            last_error = f"HTTP {response.status}: {error_text}"
                            self.logger.warning(
                                f"{integration_type} webhook failed with status {response.status} "
                                f"(attempt {attempt + 1}/{self.max_retries})"
                            )
                
            except asyncio.TimeoutError:
                last_error = "Request timeout"
                self.logger.warning(
                    f"{integration_type} webhook timeout "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
            
            except Exception as e:
                # Catch aiohttp.ClientError and other exceptions
                last_error = f"Error: {str(e)}"
                self.logger.warning(
                    f"{integration_type} webhook error: {str(e)} "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
            
            # Wait before retry with exponential backoff
            if attempt < self.max_retries - 1:
                self.logger.error(
                    f"{integration_type} webhook unexpected error: {str(e)} "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
            
            # Calculate exponential backoff delay
            if attempt < self.max_retries - 1:
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                self.logger.debug(f"Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
        
        # All retries failed
        self.logger.error(
            f"{integration_type} webhook failed after {self.max_retries} attempts: {last_error}"
        )
        return WebhookDeliveryResult(
            success=False,
            status_code=None,
            error_message=last_error,
            attempts=self.max_retries
        )
    
    def _format_slack_message(self, anomaly: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format anomaly data as Slack message blocks.
        
        Args:
            anomaly: Anomaly detection data
            
        Returns:
            Slack message payload
        """
        event = anomaly.get('audit_event', {})
        severity = anomaly.get('severity_level', 'Unknown')
        score = anomaly.get('anomaly_score', 0.0)
        
        # Choose emoji based on severity
        severity_emoji = {
            'Critical': ':rotating_light:',
            'High': ':warning:',
            'Medium': ':large_orange_diamond:',
            'Low': ':information_source:'
        }.get(severity, ':question:')
        
        return {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{severity_emoji} Audit Anomaly Detected"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Severity:*\n{severity}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Anomaly Score:*\n{score:.2f}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Event Type:*\n{event.get('event_type', 'Unknown')}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*User:*\n{event.get('user_id', 'Unknown')}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Affected Entities:*\n{', '.join(anomaly.get('affected_entities', []))}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Suggested Actions:*\n" + "\n".join(
                            f"• {action}" for action in anomaly.get('suggested_actions', [])
                        )
                    }
                }
            ]
        }
    
    def _format_teams_message(self, anomaly: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format anomaly data as Teams adaptive card.
        
        Args:
            anomaly: Anomaly detection data
            
        Returns:
            Teams adaptive card payload
        """
        event = anomaly.get('audit_event', {})
        severity = anomaly.get('severity_level', 'Unknown')
        score = anomaly.get('anomaly_score', 0.0)
        
        # Choose color based on severity
        severity_color = {
            'Critical': 'attention',
            'High': 'warning',
            'Medium': 'accent',
            'Low': 'good'
        }.get(severity, 'default')
        
        return {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.2",
                        "body": [
                            {
                                "type": "TextBlock",
                                "text": "Audit Anomaly Detected",
                                "weight": "bolder",
                                "size": "large"
                            },
                            {
                                "type": "FactSet",
                                "facts": [
                                    {
                                        "title": "Severity:",
                                        "value": severity
                                    },
                                    {
                                        "title": "Anomaly Score:",
                                        "value": f"{score:.2f}"
                                    },
                                    {
                                        "title": "Event Type:",
                                        "value": event.get('event_type', 'Unknown')
                                    },
                                    {
                                        "title": "User:",
                                        "value": str(event.get('user_id', 'Unknown'))
                                    }
                                ]
                            },
                            {
                                "type": "TextBlock",
                                "text": "Affected Entities:",
                                "weight": "bolder"
                            },
                            {
                                "type": "TextBlock",
                                "text": ", ".join(anomaly.get('affected_entities', [])),
                                "wrap": True
                            },
                            {
                                "type": "TextBlock",
                                "text": "Suggested Actions:",
                                "weight": "bolder"
                            },
                            {
                                "type": "TextBlock",
                                "text": "\n".join(f"• {action}" for action in anomaly.get('suggested_actions', [])),
                                "wrap": True
                            }
                        ]
                    }
                }
            ]
        }
    
    def _format_zapier_payload(self, anomaly: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format anomaly data as structured JSON for Zapier.
        
        Args:
            anomaly: Anomaly detection data
            
        Returns:
            Structured JSON payload
        """
        event = anomaly.get('audit_event', {})
        
        return {
            "anomaly_id": str(anomaly.get('id', '')),
            "severity": anomaly.get('severity_level', 'Unknown'),
            "anomaly_score": anomaly.get('anomaly_score', 0.0),
            "detection_timestamp": anomaly.get('detection_timestamp', datetime.now()).isoformat() if isinstance(anomaly.get('detection_timestamp'), datetime) else str(anomaly.get('detection_timestamp', '')),
            "event": {
                "id": str(event.get('id', '')),
                "type": event.get('event_type', 'Unknown'),
                "user_id": str(event.get('user_id', '')),
                "entity_type": event.get('entity_type', ''),
                "entity_id": str(event.get('entity_id', '')),
                "timestamp": event.get('timestamp', ''),
                "severity": event.get('severity', '')
            },
            "affected_entities": anomaly.get('affected_entities', []),
            "suggested_actions": anomaly.get('suggested_actions', []),
            "model_version": anomaly.get('model_version', '')
        }
    
    async def validate_webhook_url(
        self,
        webhook_url: str,
        integration_type: str
    ) -> bool:
        """
        Validate webhook URL format and reachability.
        
        Args:
            webhook_url: Webhook URL to validate
            integration_type: Type of integration
            
        Returns:
            True if valid and reachable, False otherwise
            
        Requirements: 5.11
        """
        try:
            # Validate URL format
            if not webhook_url.startswith(('http://', 'https://')):
                self.logger.warning(f"Invalid webhook URL format: {webhook_url}")
                return False
            
            if not AIOHTTP_AVAILABLE:
                self.logger.warning("aiohttp not available - skipping reachability test")
                return True  # Return True for format validation only
            
            # Test reachability with HEAD request
            async with aiohttp.ClientSession() as session:
                async with session.head(
                    webhook_url,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    # Accept any response (even 404) as long as server is reachable
                    self.logger.info(
                        f"{integration_type} webhook URL is reachable "
                        f"(status: {response.status})"
                    )
                    return True
                    
        except Exception as e:
            self.logger.error(f"Webhook URL validation failed: {str(e)}")
            return False


# Global integration hub instance
integration_hub = AuditIntegrationHub()
