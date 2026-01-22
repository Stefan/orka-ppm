"""
Security Monitoring Service for Shareable Project URLs

This service provides advanced suspicious activity detection, automated threat response,
and security monitoring capabilities for share links.

Requirements: 4.4, 4.5
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import logging
from collections import defaultdict
import re

from config.database import get_db
from models.shareable_urls import SuspiciousAccessAlert
from services.share_link_notification_service import ShareLinkNotificationService


class SecurityMonitoringService:
    """
    Advanced security monitoring service for share links.
    
    This service provides:
    - Sophisticated suspicious activity detection algorithms
    - Geographic anomaly detection with velocity analysis
    - Automated link suspension for high-severity threats
    - Security alert management and escalation
    - Threat pattern recognition and learning
    
    Requirements: 4.4, 4.5
    """
    
    # Security thresholds
    MAX_ACCESSES_PER_HOUR = 50  # Maximum accesses from single IP per hour
    MAX_ACCESSES_PER_DAY = 200  # Maximum accesses from single IP per day
    MAX_UNIQUE_IPS_PER_HOUR = 10  # Maximum unique IPs per hour
    MAX_UNIQUE_IPS_PER_DAY = 50  # Maximum unique IPs per day
    MAX_GEOGRAPHIC_DISTANCE_KM = 1000  # Maximum distance between consecutive accesses
    MIN_TIME_BETWEEN_DISTANT_ACCESSES_MINUTES = 60  # Minimum time for distant accesses
    MAX_FAILED_VALIDATIONS_PER_IP = 5  # Maximum failed token validations per IP
    BOT_USER_AGENT_PATTERNS = [
        r'bot', r'crawler', r'spider', r'scraper', r'curl', r'wget',
        r'python-requests', r'java', r'go-http-client'
    ]
    
    # Severity levels
    SEVERITY_LOW = "low"
    SEVERITY_MEDIUM = "medium"
    SEVERITY_HIGH = "high"
    SEVERITY_CRITICAL = "critical"
    
    # Auto-suspension thresholds
    AUTO_SUSPEND_SCORE_THRESHOLD = 75  # Suspend if threat score >= 75
    
    def __init__(self, db_session=None):
        """
        Initialize the security monitoring service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
        self.notification_service = ShareLinkNotificationService(db_session=self.db)
    
    async def analyze_access_security(
        self,
        share_id: str,
        ip_address: str,
        user_agent: Optional[str],
        geo_info: Dict[str, Any]
    ) -> Tuple[bool, List[Dict[str, str]], int]:
        """
        Comprehensive security analysis for a share link access.
        
        Performs multiple security checks and calculates a threat score.
        Returns whether the access is suspicious, reasons, and threat score.
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of the accessor
            user_agent: User agent string
            geo_info: Geolocation information
            
        Returns:
            Tuple of (is_suspicious, suspicious_reasons, threat_score)
            
        Requirements: 4.4
        """
        suspicious_reasons = []
        threat_score = 0
        
        try:
            # Run all security checks
            checks = [
                self._check_access_frequency(share_id, ip_address),
                self._check_unique_ip_count(share_id),
                self._check_geographic_anomaly(share_id, ip_address, geo_info),
                self._check_bot_activity(user_agent),
                self._check_access_pattern_anomaly(share_id, ip_address),
                self._check_time_pattern_anomaly(share_id),
            ]
            
            # Execute all checks
            for check in checks:
                result = await check
                if result:
                    reason, score = result
                    suspicious_reasons.append(reason)
                    threat_score += score
            
            is_suspicious = len(suspicious_reasons) > 0
            
            # Log security analysis
            if is_suspicious:
                self.logger.warning(
                    f"Suspicious access detected: share_id={share_id}, "
                    f"ip={ip_address}, threat_score={threat_score}, "
                    f"reasons={len(suspicious_reasons)}"
                )
            
            return is_suspicious, suspicious_reasons, threat_score
            
        except Exception as e:
            self.logger.error(f"Error in security analysis: {str(e)}", exc_info=True)
            return False, [], 0
    
    async def _check_access_frequency(
        self,
        share_id: str,
        ip_address: str
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for excessive access frequency from a single IP.
        
        Requirements: 4.4
        """
        try:
            # Check hourly frequency
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = self.db.table("share_access_logs").select("id").eq(
                "share_id", share_id
            ).eq("ip_address", ip_address).gte("accessed_at", one_hour_ago).execute()
            
            hourly_count = len(result.data) if result.data else 0
            
            if hourly_count >= self.MAX_ACCESSES_PER_HOUR:
                return ({
                    "type": "high_frequency_hourly",
                    "description": f"Excessive accesses from IP {ip_address}: {hourly_count} in last hour",
                    "severity": self.SEVERITY_HIGH
                }, 30)
            
            # Check daily frequency
            one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            
            result = self.db.table("share_access_logs").select("id").eq(
                "share_id", share_id
            ).eq("ip_address", ip_address).gte("accessed_at", one_day_ago).execute()
            
            daily_count = len(result.data) if result.data else 0
            
            if daily_count >= self.MAX_ACCESSES_PER_DAY:
                return ({
                    "type": "high_frequency_daily",
                    "description": f"Excessive accesses from IP {ip_address}: {daily_count} in last 24 hours",
                    "severity": self.SEVERITY_MEDIUM
                }, 20)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking access frequency: {str(e)}")
            return None
    
    async def _check_unique_ip_count(
        self,
        share_id: str
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for excessive number of unique IPs accessing the link.
        
        Requirements: 4.4
        """
        try:
            # Check hourly unique IPs
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = self.db.table("share_access_logs").select("ip_address").eq(
                "share_id", share_id
            ).gte("accessed_at", one_hour_ago).execute()
            
            if result.data:
                unique_ips_hourly = len(set(log["ip_address"] for log in result.data))
                
                if unique_ips_hourly >= self.MAX_UNIQUE_IPS_PER_HOUR:
                    return ({
                        "type": "multiple_ips_hourly",
                        "description": f"Multiple unique IPs accessing link: {unique_ips_hourly} in last hour",
                        "severity": self.SEVERITY_MEDIUM
                    }, 25)
            
            # Check daily unique IPs
            one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            
            result = self.db.table("share_access_logs").select("ip_address").eq(
                "share_id", share_id
            ).gte("accessed_at", one_day_ago).execute()
            
            if result.data:
                unique_ips_daily = len(set(log["ip_address"] for log in result.data))
                
                if unique_ips_daily >= self.MAX_UNIQUE_IPS_PER_DAY:
                    return ({
                        "type": "multiple_ips_daily",
                        "description": f"Multiple unique IPs accessing link: {unique_ips_daily} in last 24 hours",
                        "severity": self.SEVERITY_LOW
                    }, 15)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking unique IP count: {str(e)}")
            return None
    
    async def _check_geographic_anomaly(
        self,
        share_id: str,
        ip_address: str,
        geo_info: Dict[str, Any]
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for geographic anomalies (impossible travel).
        
        Requirements: 4.4
        """
        try:
            if not geo_info.get("latitude") or not geo_info.get("longitude"):
                return None
            
            # Get recent accesses with geolocation
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = self.db.table("share_access_logs").select(
                "ip_address, accessed_at, latitude, longitude"
            ).eq("share_id", share_id).gte("accessed_at", one_hour_ago).execute()
            
            if not result.data:
                return None
            
            recent_accesses = [
                log for log in result.data
                if log.get("latitude") and log.get("longitude")
                and log["ip_address"] != ip_address
            ]
            
            if not recent_accesses:
                return None
            
            # Sort by time descending
            recent_accesses.sort(key=lambda x: x["accessed_at"], reverse=True)
            
            # Check distance from most recent access
            last_access = recent_accesses[0]
            distance = self._calculate_distance(
                geo_info["latitude"],
                geo_info["longitude"],
                last_access["latitude"],
                last_access["longitude"]
            )
            
            # Calculate time difference
            last_time = datetime.fromisoformat(last_access["accessed_at"].replace('Z', '+00:00'))
            current_time = datetime.now(timezone.utc)
            time_diff_minutes = (current_time - last_time).total_seconds() / 60
            
            # Check for impossible travel
            if distance > self.MAX_GEOGRAPHIC_DISTANCE_KM and time_diff_minutes < self.MIN_TIME_BETWEEN_DISTANT_ACCESSES_MINUTES:
                # Calculate required speed (km/h)
                required_speed = (distance / time_diff_minutes) * 60
                
                return ({
                    "type": "geographic_anomaly",
                    "description": f"Impossible travel: {distance:.0f}km in {time_diff_minutes:.0f} minutes (requires {required_speed:.0f}km/h)",
                    "severity": self.SEVERITY_CRITICAL
                }, 40)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking geographic anomaly: {str(e)}")
            return None
    
    async def _check_bot_activity(
        self,
        user_agent: Optional[str]
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for bot or automated access patterns.
        
        Requirements: 4.4
        """
        try:
            if not user_agent:
                return ({
                    "type": "missing_user_agent",
                    "description": "No user agent provided",
                    "severity": self.SEVERITY_LOW
                }, 10)
            
            # Check for bot patterns in user agent
            user_agent_lower = user_agent.lower()
            for pattern in self.BOT_USER_AGENT_PATTERNS:
                if re.search(pattern, user_agent_lower):
                    return ({
                        "type": "bot_user_agent",
                        "description": f"Bot-like user agent detected: {user_agent[:100]}",
                        "severity": self.SEVERITY_MEDIUM
                    }, 20)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking bot activity: {str(e)}")
            return None
    
    async def _check_access_pattern_anomaly(
        self,
        share_id: str,
        ip_address: str
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for unusual access patterns (e.g., very short sessions, no section views).
        
        Requirements: 4.4
        """
        try:
            # Get recent accesses from this IP
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = self.db.table("share_access_logs").select(
                "session_duration, accessed_sections"
            ).eq("share_id", share_id).eq("ip_address", ip_address).gte(
                "accessed_at", one_hour_ago
            ).execute()
            
            if not result.data or len(result.data) < 3:
                return None
            
            # Check for pattern of very short sessions
            short_sessions = sum(
                1 for log in result.data
                if log.get("session_duration") and log["session_duration"] < 5
            )
            
            if short_sessions >= 3:
                return ({
                    "type": "short_session_pattern",
                    "description": f"Pattern of very short sessions detected: {short_sessions} sessions < 5 seconds",
                    "severity": self.SEVERITY_LOW
                }, 10)
            
            # Check for pattern of no section views
            no_sections = sum(
                1 for log in result.data
                if not log.get("accessed_sections") or len(log["accessed_sections"]) == 0
            )
            
            if no_sections >= 3:
                return ({
                    "type": "no_content_access_pattern",
                    "description": f"Pattern of accessing without viewing content: {no_sections} accesses",
                    "severity": self.SEVERITY_LOW
                }, 10)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking access pattern anomaly: {str(e)}")
            return None
    
    async def _check_time_pattern_anomaly(
        self,
        share_id: str
    ) -> Optional[Tuple[Dict[str, str], int]]:
        """
        Check for unusual time-based access patterns (e.g., all accesses at odd hours).
        
        Requirements: 4.4
        """
        try:
            # Get recent accesses
            one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            
            result = self.db.table("share_access_logs").select("accessed_at").eq(
                "share_id", share_id
            ).gte("accessed_at", one_day_ago).execute()
            
            if not result.data or len(result.data) < 10:
                return None
            
            # Analyze access times
            hours = []
            for log in result.data:
                accessed_at = datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00'))
                hours.append(accessed_at.hour)
            
            # Check if most accesses are during odd hours (midnight to 5am)
            odd_hour_accesses = sum(1 for hour in hours if 0 <= hour < 5)
            odd_hour_percentage = (odd_hour_accesses / len(hours)) * 100
            
            if odd_hour_percentage > 70:
                return ({
                    "type": "odd_hours_pattern",
                    "description": f"Unusual time pattern: {odd_hour_percentage:.0f}% of accesses during midnight-5am",
                    "severity": self.SEVERITY_LOW
                }, 10)
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking time pattern anomaly: {str(e)}")
            return None
    
    def _calculate_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calculate distance between two geographic coordinates using Haversine formula.
        
        Args:
            lat1: Latitude of first point
            lon1: Longitude of first point
            lat2: Latitude of second point
            lon2: Longitude of second point
            
        Returns:
            float: Distance in kilometers
        """
        from math import radians, sin, cos, sqrt, atan2
        
        # Earth radius in kilometers
        R = 6371.0
        
        # Convert to radians
        lat1_rad = radians(lat1)
        lon1_rad = radians(lon1)
        lat2_rad = radians(lat2)
        lon2_rad = radians(lon2)
        
        # Differences
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Haversine formula
        a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        distance = R * c
        return distance
    
    async def handle_suspicious_activity(
        self,
        share_id: str,
        ip_address: str,
        suspicious_reasons: List[Dict[str, str]],
        threat_score: int,
        geo_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle suspicious activity with appropriate response actions.
        
        Actions may include:
        - Logging the security event
        - Sending notifications to link creator
        - Automatically suspending the link for high-severity threats
        - Creating security alerts for admin review
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of suspicious access
            suspicious_reasons: List of reasons for suspicion
            threat_score: Calculated threat score (0-100)
            geo_info: Geolocation information
            
        Returns:
            Dict with action results
            
        Requirements: 4.4, 4.5
        """
        try:
            actions_taken = []
            
            # 1. Log security event
            await self._log_security_event(
                share_id, ip_address, suspicious_reasons, threat_score, geo_info
            )
            actions_taken.append("security_event_logged")
            
            # 2. Send notification to creator
            notification_sent = await self.notification_service.send_suspicious_activity_alert(
                share_id=share_id,
                ip_address=ip_address,
                suspicious_reasons=suspicious_reasons,
                accessed_at=datetime.now(timezone.utc),
                country_code=geo_info.get("country_code"),
                city=geo_info.get("city")
            )
            
            if notification_sent:
                actions_taken.append("creator_notified")
            
            # 3. Auto-suspend link if threat score is high
            if threat_score >= self.AUTO_SUSPEND_SCORE_THRESHOLD:
                suspended = await self._auto_suspend_link(
                    share_id, threat_score, suspicious_reasons
                )
                
                if suspended:
                    actions_taken.append("link_auto_suspended")
                    self.logger.critical(
                        f"Share link auto-suspended: share_id={share_id}, "
                        f"threat_score={threat_score}"
                    )
            
            # 4. Create admin alert for review
            alert_created = await self._create_admin_alert(
                share_id, ip_address, suspicious_reasons, threat_score, geo_info
            )
            
            if alert_created:
                actions_taken.append("admin_alert_created")
            
            return {
                "success": True,
                "threat_score": threat_score,
                "actions_taken": actions_taken,
                "auto_suspended": "link_auto_suspended" in actions_taken
            }
            
        except Exception as e:
            self.logger.error(f"Error handling suspicious activity: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _log_security_event(
        self,
        share_id: str,
        ip_address: str,
        suspicious_reasons: List[Dict[str, str]],
        threat_score: int,
        geo_info: Dict[str, Any]
    ) -> bool:
        """
        Log a security event to the database.
        
        Requirements: 4.4
        """
        try:
            event_entry = {
                "share_id": share_id,
                "event_type": "suspicious_activity",
                "ip_address": ip_address,
                "threat_score": threat_score,
                "suspicious_reasons": suspicious_reasons,
                "country_code": geo_info.get("country_code"),
                "city": geo_info.get("city"),
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "severity": self._calculate_severity(threat_score)
            }
            
            result = self.db.table("share_security_events").insert(event_entry).execute()
            
            return result.data and len(result.data) > 0
            
        except Exception as e:
            self.logger.error(f"Error logging security event: {str(e)}")
            return False
    
    async def _auto_suspend_link(
        self,
        share_id: str,
        threat_score: int,
        suspicious_reasons: List[Dict[str, str]]
    ) -> bool:
        """
        Automatically suspend a share link due to security threats.
        
        Requirements: 4.5
        """
        try:
            # Update share link to inactive
            result = self.db.table("project_shares").update({
                "is_active": False,
                "revoked_at": datetime.now(timezone.utc).isoformat(),
                "revocation_reason": f"Auto-suspended due to security threat (score: {threat_score})"
            }).eq("id", share_id).execute()
            
            if not result.data or len(result.data) == 0:
                return False
            
            # Log suspension
            self.logger.warning(
                f"Share link auto-suspended: share_id={share_id}, "
                f"threat_score={threat_score}, reasons={len(suspicious_reasons)}"
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error auto-suspending link: {str(e)}")
            return False
    
    async def _create_admin_alert(
        self,
        share_id: str,
        ip_address: str,
        suspicious_reasons: List[Dict[str, str]],
        threat_score: int,
        geo_info: Dict[str, Any]
    ) -> bool:
        """
        Create an admin alert for security review.
        
        Requirements: 4.4
        """
        try:
            alert_entry = {
                "share_id": share_id,
                "alert_type": "suspicious_activity",
                "ip_address": ip_address,
                "threat_score": threat_score,
                "suspicious_reasons": suspicious_reasons,
                "country_code": geo_info.get("country_code"),
                "city": geo_info.get("city"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "severity": self._calculate_severity(threat_score),
                "status": "pending_review",
                "reviewed_at": None,
                "reviewed_by": None,
                "resolution": None
            }
            
            result = self.db.table("share_security_alerts").insert(alert_entry).execute()
            
            return result.data and len(result.data) > 0
            
        except Exception as e:
            self.logger.error(f"Error creating admin alert: {str(e)}")
            return False
    
    def _calculate_severity(self, threat_score: int) -> str:
        """
        Calculate severity level based on threat score.
        
        Args:
            threat_score: Threat score (0-100)
            
        Returns:
            str: Severity level
        """
        if threat_score >= 75:
            return self.SEVERITY_CRITICAL
        elif threat_score >= 50:
            return self.SEVERITY_HIGH
        elif threat_score >= 25:
            return self.SEVERITY_MEDIUM
        else:
            return self.SEVERITY_LOW
    
    async def get_security_alerts(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get security alerts for admin review.
        
        Args:
            status: Filter by status ('pending_review', 'reviewed', 'resolved')
            severity: Filter by severity level
            start_date: Start date for filtering
            end_date: End date for filtering
            limit: Maximum number of alerts to return
            
        Returns:
            List of security alerts
            
        Requirements: 4.4
        """
        try:
            query = self.db.table("share_security_alerts").select("*")
            
            if status:
                query = query.eq("status", status)
            
            if severity:
                query = query.eq("severity", severity)
            
            if start_date:
                query = query.gte("created_at", start_date.isoformat())
            
            if end_date:
                query = query.lte("created_at", end_date.isoformat())
            
            query = query.order("created_at", desc=True).limit(limit)
            
            result = query.execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            self.logger.error(f"Error getting security alerts: {str(e)}")
            return []
    
    async def resolve_security_alert(
        self,
        alert_id: str,
        reviewed_by: str,
        resolution: str,
        action_taken: Optional[str] = None
    ) -> bool:
        """
        Resolve a security alert after admin review.
        
        Args:
            alert_id: UUID of the alert
            reviewed_by: UUID of the admin user
            resolution: Resolution description
            action_taken: Action taken (optional)
            
        Returns:
            bool: True if resolved successfully
            
        Requirements: 4.4
        """
        try:
            update_data = {
                "status": "resolved",
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_by": reviewed_by,
                "resolution": resolution
            }
            
            if action_taken:
                update_data["action_taken"] = action_taken
            
            result = self.db.table("share_security_alerts").update(
                update_data
            ).eq("id", alert_id).execute()
            
            return result.data and len(result.data) > 0
            
        except Exception as e:
            self.logger.error(f"Error resolving security alert: {str(e)}")
            return False
