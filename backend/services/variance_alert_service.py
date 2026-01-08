"""
Variance Alert Service for Budget Overrun Notifications
Handles configurable thresholds, alert generation, and stakeholder notifications
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional, Set
from uuid import uuid4
from pydantic import BaseModel, validator
from supabase import Client
from enum import Enum
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AlertStatus(str, Enum):
    """Alert status values"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    EMAIL = "email"
    SMS = "sms"
    SLACK = "slack"
    WEBHOOK = "webhook"
    IN_APP = "in_app"

class VarianceThresholdRule(BaseModel):
    """Model for variance threshold configuration"""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    threshold_percentage: Decimal
    severity: AlertSeverity
    enabled: bool = True
    project_filter: Optional[Dict[str, Any]] = None  # Filter criteria for projects
    notification_channels: List[NotificationChannel] = [NotificationChannel.EMAIL]
    recipients: List[str] = []  # Email addresses or user IDs
    cooldown_hours: int = 24  # Minimum hours between alerts for same project/WBS
    organization_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @validator('threshold_percentage')
    def validate_threshold(cls, v):
        if v < -100 or v > 1000:
            raise ValueError('Threshold percentage must be between -100 and 1000')
        return v

    @validator('cooldown_hours')
    def validate_cooldown(cls, v):
        if v < 0 or v > 8760:  # Max 1 year
            raise ValueError('Cooldown hours must be between 0 and 8760')
        return v

class VarianceAlert(BaseModel):
    """Model for variance alert records"""
    id: Optional[str] = None
    rule_id: str
    project_id: str
    wbs_element: str
    variance_amount: Decimal
    variance_percentage: Decimal
    commitment_amount: Decimal
    actual_amount: Decimal
    currency_code: str = "USD"
    severity: AlertSeverity
    status: AlertStatus = AlertStatus.ACTIVE
    message: str
    details: Optional[Dict[str, Any]] = None
    recipients: List[str] = []
    notification_channels: List[NotificationChannel] = []
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    organization_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class NotificationDelivery(BaseModel):
    """Model for tracking notification delivery"""
    id: Optional[str] = None
    alert_id: str
    channel: NotificationChannel
    recipient: str
    status: str  # sent, failed, delivered, read
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

class VarianceAlertService:
    """Service for managing variance alerts and notifications"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
        # Default threshold rules
        self.default_rules = [
            VarianceThresholdRule(
                name="Budget Warning",
                description="Alert when project exceeds 80% of committed budget",
                threshold_percentage=Decimal('80.0'),
                severity=AlertSeverity.MEDIUM,
                cooldown_hours=24
            ),
            VarianceThresholdRule(
                name="Budget Critical",
                description="Alert when project exceeds 95% of committed budget",
                threshold_percentage=Decimal('95.0'),
                severity=AlertSeverity.HIGH,
                cooldown_hours=12
            ),
            VarianceThresholdRule(
                name="Budget Overrun",
                description="Alert when project exceeds committed budget",
                threshold_percentage=Decimal('100.0'),
                severity=AlertSeverity.CRITICAL,
                cooldown_hours=6
            )
        ]

    async def create_threshold_rule(self, rule: VarianceThresholdRule, user_id: str) -> str:
        """Create a new variance threshold rule"""
        
        try:
            rule_data = rule.dict()
            rule_data['id'] = str(uuid4())
            rule_data['created_by'] = user_id
            rule_data['created_at'] = datetime.now().isoformat()
            rule_data['updated_at'] = datetime.now().isoformat()
            
            # Convert Decimal to float for JSON serialization
            rule_data['threshold_percentage'] = float(rule_data['threshold_percentage'])
            
            result = self.supabase.table('variance_threshold_rules').insert(rule_data).execute()
            
            logger.info(f"Created variance threshold rule: {rule_data['id']}")
            return rule_data['id']
            
        except Exception as e:
            logger.error(f"Failed to create threshold rule: {e}")
            raise

    async def update_threshold_rule(self, rule_id: str, updates: Dict[str, Any], user_id: str) -> bool:
        """Update an existing threshold rule"""
        
        try:
            updates['updated_at'] = datetime.now().isoformat()
            
            # Convert Decimal to float if present
            if 'threshold_percentage' in updates and isinstance(updates['threshold_percentage'], Decimal):
                updates['threshold_percentage'] = float(updates['threshold_percentage'])
            
            result = self.supabase.table('variance_threshold_rules')\
                .update(updates)\
                .eq('id', rule_id)\
                .execute()
            
            logger.info(f"Updated variance threshold rule: {rule_id}")
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Failed to update threshold rule: {e}")
            return False

    async def get_threshold_rules(self, organization_id: Optional[str] = None, 
                                enabled_only: bool = True) -> List[VarianceThresholdRule]:
        """Get variance threshold rules"""
        
        try:
            query = self.supabase.table('variance_threshold_rules').select('*')
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            if enabled_only:
                query = query.eq('enabled', True)
            
            result = query.order('threshold_percentage').execute()
            
            rules = []
            for rule_data in result.data:
                # Convert float back to Decimal
                rule_data['threshold_percentage'] = Decimal(str(rule_data['threshold_percentage']))
                rules.append(VarianceThresholdRule(**rule_data))
            
            return rules
            
        except Exception as e:
            logger.error(f"Failed to get threshold rules: {e}")
            return []

    async def check_variance_thresholds(self, organization_id: Optional[str] = None, 
                                      project_ids: Optional[List[str]] = None) -> List[VarianceAlert]:
        """Check variance data against threshold rules and generate alerts"""
        
        try:
            logger.info("Checking variance thresholds for alerts")
            
            # Get active threshold rules
            rules = await self.get_threshold_rules(organization_id, enabled_only=True)
            if not rules:
                logger.info("No active threshold rules found")
                return []
            
            # Get current variance data
            variance_data = await self._get_variance_data(organization_id, project_ids)
            if not variance_data:
                logger.info("No variance data found")
                return []
            
            alerts_generated = []
            
            for variance in variance_data:
                project_id = variance['project_id']
                wbs_element = variance['wbs_element']
                variance_percentage = Decimal(str(variance['variance_percentage']))
                
                # Check against each rule
                for rule in rules:
                    if self._should_trigger_alert(variance, rule, variance_percentage):
                        # Check cooldown period
                        if await self._is_in_cooldown(rule.id, project_id, wbs_element, rule.cooldown_hours):
                            continue
                        
                        # Generate alert
                        alert = await self._generate_alert(variance, rule)
                        if alert:
                            alerts_generated.append(alert)
            
            logger.info(f"Generated {len(alerts_generated)} variance alerts")
            return alerts_generated
            
        except Exception as e:
            logger.error(f"Failed to check variance thresholds: {e}")
            return []

    def _should_trigger_alert(self, variance: Dict[str, Any], rule: VarianceThresholdRule, 
                            variance_percentage: Decimal) -> bool:
        """Determine if variance should trigger an alert based on rule criteria"""
        
        # Check threshold
        if variance_percentage < rule.threshold_percentage:
            return False
        
        # Check project filter if specified
        if rule.project_filter:
            # Implement project filtering logic here
            # For now, assume all projects match
            pass
        
        # Only alert on 'over' status variances for overrun alerts
        if rule.threshold_percentage > 0 and variance['status'] != 'over':
            return False
        
        return True

    async def _is_in_cooldown(self, rule_id: str, project_id: str, wbs_element: str, 
                            cooldown_hours: int) -> bool:
        """Check if alert is in cooldown period"""
        
        try:
            cutoff_time = datetime.now() - timedelta(hours=cooldown_hours)
            
            result = self.supabase.table('variance_alerts')\
                .select('id')\
                .eq('rule_id', rule_id)\
                .eq('project_id', project_id)\
                .eq('wbs_element', wbs_element)\
                .gte('created_at', cutoff_time.isoformat())\
                .limit(1)\
                .execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Failed to check cooldown: {e}")
            return False

    async def _generate_alert(self, variance: Dict[str, Any], rule: VarianceThresholdRule) -> Optional[VarianceAlert]:
        """Generate a variance alert"""
        
        try:
            # Create alert message
            message = self._create_alert_message(variance, rule)
            
            # Create alert record
            alert = VarianceAlert(
                id=str(uuid4()),
                rule_id=rule.id,
                project_id=variance['project_id'],
                wbs_element=variance['wbs_element'],
                variance_amount=Decimal(str(variance['variance'])),
                variance_percentage=Decimal(str(variance['variance_percentage'])),
                commitment_amount=Decimal(str(variance['total_commitment'])),
                actual_amount=Decimal(str(variance['total_actual'])),
                currency_code=variance['currency_code'],
                severity=rule.severity,
                message=message,
                recipients=rule.recipients,
                notification_channels=rule.notification_channels,
                organization_id=rule.organization_id,
                created_at=datetime.now()
            )
            
            # Save alert to database
            alert_data = alert.dict()
            # Convert Decimal fields to float for JSON serialization
            for field in ['variance_amount', 'variance_percentage', 'commitment_amount', 'actual_amount']:
                alert_data[field] = float(alert_data[field])
            alert_data['created_at'] = alert_data['created_at'].isoformat()
            
            result = self.supabase.table('variance_alerts').insert(alert_data).execute()
            
            # Send notifications
            await self._send_alert_notifications(alert)
            
            logger.info(f"Generated variance alert: {alert.id}")
            return alert
            
        except Exception as e:
            logger.error(f"Failed to generate alert: {e}")
            return None

    def _create_alert_message(self, variance: Dict[str, Any], rule: VarianceThresholdRule) -> str:
        """Create a human-readable alert message"""
        
        project_id = variance['project_id']
        wbs_element = variance['wbs_element']
        variance_percentage = variance['variance_percentage']
        variance_amount = variance['variance']
        currency = variance['currency_code']
        
        if variance_percentage > 0:
            direction = "over"
            amount_text = f"${abs(variance_amount):,.2f} {currency} over"
        else:
            direction = "under"
            amount_text = f"${abs(variance_amount):,.2f} {currency} under"
        
        message = (f"Budget variance alert for Project {project_id}, WBS {wbs_element}: "
                  f"{variance_percentage:.1f}% {direction} committed budget "
                  f"({amount_text} commitment). "
                  f"Threshold: {rule.threshold_percentage}% ({rule.name})")
        
        return message

    async def _send_alert_notifications(self, alert: VarianceAlert) -> None:
        """Send notifications for an alert"""
        
        try:
            for channel in alert.notification_channels:
                for recipient in alert.recipients:
                    await self._send_notification(alert, channel, recipient)
            
        except Exception as e:
            logger.error(f"Failed to send alert notifications: {e}")

    async def _send_notification(self, alert: VarianceAlert, channel: NotificationChannel, 
                               recipient: str) -> None:
        """Send a single notification"""
        
        delivery = NotificationDelivery(
            id=str(uuid4()),
            alert_id=alert.id,
            channel=channel,
            recipient=recipient,
            status="pending",
            sent_at=datetime.now()
        )
        
        try:
            if channel == NotificationChannel.EMAIL:
                success = await self._send_email_notification(alert, recipient)
            elif channel == NotificationChannel.IN_APP:
                success = await self._send_in_app_notification(alert, recipient)
            elif channel == NotificationChannel.WEBHOOK:
                success = await self._send_webhook_notification(alert, recipient)
            else:
                logger.warning(f"Notification channel {channel} not implemented")
                success = False
            
            delivery.status = "sent" if success else "failed"
            if not success:
                delivery.error_message = "Delivery failed"
            
        except Exception as e:
            delivery.status = "failed"
            delivery.error_message = str(e)
            logger.error(f"Failed to send {channel} notification to {recipient}: {e}")
        
        # Save delivery record
        try:
            delivery_data = delivery.dict()
            delivery_data['sent_at'] = delivery_data['sent_at'].isoformat()
            self.supabase.table('notification_deliveries').insert(delivery_data).execute()
        except Exception as e:
            logger.error(f"Failed to save notification delivery record: {e}")

    async def _send_email_notification(self, alert: VarianceAlert, recipient: str) -> bool:
        """Send email notification (placeholder implementation)"""
        
        # This would integrate with an email service like SendGrid, AWS SES, etc.
        logger.info(f"EMAIL: Sending variance alert to {recipient}")
        logger.info(f"Subject: Budget Variance Alert - Project {alert.project_id}")
        logger.info(f"Message: {alert.message}")
        
        # For now, just log the notification
        return True

    async def _send_in_app_notification(self, alert: VarianceAlert, recipient: str) -> bool:
        """Send in-app notification"""
        
        try:
            notification_data = {
                'id': str(uuid4()),
                'user_id': recipient,
                'type': 'variance_alert',
                'title': f"Budget Variance Alert - {alert.severity.upper()}",
                'message': alert.message,
                'data': {
                    'alert_id': alert.id,
                    'project_id': alert.project_id,
                    'wbs_element': alert.wbs_element,
                    'variance_percentage': float(alert.variance_percentage),
                    'severity': alert.severity
                },
                'read': False,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('notifications').insert(notification_data).execute()
            logger.info(f"IN-APP: Sent variance alert notification to user {recipient}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send in-app notification: {e}")
            return False

    async def _send_webhook_notification(self, alert: VarianceAlert, webhook_url: str) -> bool:
        """Send webhook notification (placeholder implementation)"""
        
        # This would make HTTP POST request to webhook URL
        logger.info(f"WEBHOOK: Sending variance alert to {webhook_url}")
        logger.info(f"Payload: {alert.dict()}")
        
        # For now, just log the notification
        return True

    async def _get_variance_data(self, organization_id: Optional[str], 
                               project_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Get current variance data for threshold checking"""
        
        try:
            query = self.supabase.table('financial_variances').select('*')
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            if project_ids:
                query = query.in_('project_id', project_ids)
            
            result = query.execute()
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get variance data: {e}")
            return []

    async def acknowledge_alert(self, alert_id: str, user_id: str, notes: Optional[str] = None) -> bool:
        """Acknowledge a variance alert"""
        
        try:
            update_data = {
                'status': AlertStatus.ACKNOWLEDGED,
                'acknowledged_by': user_id,
                'acknowledged_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            if notes:
                update_data['details'] = {'acknowledgment_notes': notes}
            
            result = self.supabase.table('variance_alerts')\
                .update(update_data)\
                .eq('id', alert_id)\
                .execute()
            
            logger.info(f"Acknowledged variance alert: {alert_id}")
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Failed to acknowledge alert: {e}")
            return False

    async def resolve_alert(self, alert_id: str, user_id: str, resolution_notes: str) -> bool:
        """Resolve a variance alert"""
        
        try:
            update_data = {
                'status': AlertStatus.RESOLVED,
                'resolved_by': user_id,
                'resolved_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'details': {'resolution_notes': resolution_notes}
            }
            
            result = self.supabase.table('variance_alerts')\
                .update(update_data)\
                .eq('id', alert_id)\
                .execute()
            
            logger.info(f"Resolved variance alert: {alert_id}")
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
            return False

    async def get_alert_history(self, organization_id: Optional[str] = None, 
                              project_id: Optional[str] = None, 
                              status: Optional[AlertStatus] = None,
                              limit: int = 100) -> List[Dict[str, Any]]:
        """Get alert history with optional filters"""
        
        try:
            query = self.supabase.table('variance_alerts').select('*')
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            if project_id:
                query = query.eq('project_id', project_id)
            
            if status:
                query = query.eq('status', status)
            
            result = query.order('created_at', desc=True).limit(limit).execute()
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get alert history: {e}")
            return []

    async def start_alert_monitoring(self, check_interval_minutes: int = 60) -> None:
        """Start continuous alert monitoring"""
        
        logger.info(f"Starting variance alert monitoring (every {check_interval_minutes} minutes)")
        
        while True:
            try:
                logger.info("Running scheduled variance alert check...")
                alerts = await self.check_variance_thresholds()
                
                if alerts:
                    logger.info(f"Generated {len(alerts)} new variance alerts")
                else:
                    logger.info("No new variance alerts generated")
                
                # Wait for next check
                await asyncio.sleep(check_interval_minutes * 60)
                
            except Exception as e:
                logger.error(f"Alert monitoring error: {e}")
                # Wait 5 minutes before retrying on error
                await asyncio.sleep(300)

    async def initialize_default_rules(self, organization_id: str, user_id: str) -> List[str]:
        """Initialize default threshold rules for an organization"""
        
        try:
            rule_ids = []
            
            for rule in self.default_rules:
                rule.organization_id = organization_id
                rule_id = await self.create_threshold_rule(rule, user_id)
                rule_ids.append(rule_id)
            
            logger.info(f"Initialized {len(rule_ids)} default threshold rules for organization {organization_id}")
            return rule_ids
            
        except Exception as e:
            logger.error(f"Failed to initialize default rules: {e}")
            return []