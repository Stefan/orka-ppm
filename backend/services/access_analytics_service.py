"""
Access Analytics Service for Shareable Project URLs

This service provides comprehensive access event logging, IP geolocation,
user agent parsing, and suspicious activity detection for share links.

Requirements: 4.1, 4.2, 4.4
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
import logging
import re
from collections import defaultdict
from user_agents import parse as parse_user_agent

from config.database import get_db
from models.shareable_urls import (
    ShareAccessLog,
    ShareAnalytics,
    SuspiciousAccessAlert
)
from services.share_link_notification_service import ShareLinkNotificationService
from services.security_monitoring_service import SecurityMonitoringService


class AccessAnalyticsService:
    """
    Service for tracking and analyzing share link access patterns.
    
    This service handles:
    - Comprehensive access event logging to share_access_logs table
    - IP geolocation integration
    - User agent parsing to extract browser/device information
    - Suspicious activity detection algorithms
    
    Requirements: 4.1, 4.2, 4.4
    """
    
    # Suspicious activity thresholds
    MAX_ACCESSES_PER_HOUR = 50  # Maximum accesses from single IP per hour
    MAX_UNIQUE_IPS_PER_HOUR = 10  # Maximum unique IPs for single share link per hour
    MAX_GEOGRAPHIC_DISTANCE_KM = 1000  # Maximum distance between consecutive accesses (km)
    
    def __init__(self, db_session=None):
        """
        Initialize the access analytics service.
        
        Args:
            db_session: Database client (defaults to global Supabase client)
        """
        self.db = db_session or get_db()
        self.logger = logging.getLogger(__name__)
        self.notification_service = ShareLinkNotificationService(db_session=self.db)
        self.security_service = SecurityMonitoringService(db_session=self.db)
    
    def _parse_user_agent(self, user_agent_string: Optional[str]) -> Dict[str, Any]:
        """
        Parse user agent string to extract browser and device information.
        
        Uses the user-agents library to parse the user agent string and extract:
        - Browser name and version
        - Operating system name and version
        - Device type (mobile, tablet, desktop)
        - Device brand and model (if available)
        
        Args:
            user_agent_string: User agent string from HTTP request
            
        Returns:
            Dict with parsed user agent information
            
        Requirements: 4.1
        """
        if not user_agent_string:
            return {
                "browser": "Unknown",
                "browser_version": None,
                "os": "Unknown",
                "os_version": None,
                "device_type": "Unknown",
                "device_brand": None,
                "device_model": None,
                "is_bot": False
            }
        
        try:
            # Parse user agent
            ua = parse_user_agent(user_agent_string)
            
            return {
                "browser": ua.browser.family,
                "browser_version": ua.browser.version_string,
                "os": ua.os.family,
                "os_version": ua.os.version_string,
                "device_type": self._get_device_type(ua),
                "device_brand": ua.device.brand,
                "device_model": ua.device.model,
                "is_bot": ua.is_bot
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing user agent: {str(e)}")
            return {
                "browser": "Unknown",
                "browser_version": None,
                "os": "Unknown",
                "os_version": None,
                "device_type": "Unknown",
                "device_brand": None,
                "device_model": None,
                "is_bot": False
            }
    
    def _get_device_type(self, ua) -> str:
        """
        Determine device type from parsed user agent.
        
        Args:
            ua: Parsed user agent object
            
        Returns:
            str: Device type (Mobile, Tablet, Desktop, Bot)
        """
        if ua.is_bot:
            return "Bot"
        elif ua.is_mobile:
            return "Mobile"
        elif ua.is_tablet:
            return "Tablet"
        elif ua.is_pc:
            return "Desktop"
        else:
            return "Unknown"
    
    def _get_ip_geolocation(self, ip_address: str) -> Dict[str, Any]:
        """
        Get geolocation information for an IP address.
        
        This is a placeholder implementation that would integrate with a
        geolocation service like MaxMind GeoIP2, IP2Location, or ipapi.
        
        For production, you would:
        1. Install a geolocation library (e.g., geoip2, ip2geotools)
        2. Download/configure geolocation database
        3. Query the database for IP information
        
        Args:
            ip_address: IP address to geolocate
            
        Returns:
            Dict with geolocation information
            
        Requirements: 4.1
        """
        # Placeholder implementation
        # In production, integrate with actual geolocation service
        
        # Check for localhost/private IPs
        if self._is_private_ip(ip_address):
            return {
                "country_code": None,
                "country_name": None,
                "city": None,
                "region": None,
                "latitude": None,
                "longitude": None,
                "timezone": None,
                "is_private": True
            }
        
        # TODO: Integrate with actual geolocation service
        # Example with geoip2:
        # try:
        #     import geoip2.database
        #     reader = geoip2.database.Reader('/path/to/GeoLite2-City.mmdb')
        #     response = reader.city(ip_address)
        #     return {
        #         "country_code": response.country.iso_code,
        #         "country_name": response.country.name,
        #         "city": response.city.name,
        #         "region": response.subdivisions.most_specific.name,
        #         "latitude": response.location.latitude,
        #         "longitude": response.location.longitude,
        #         "timezone": response.location.time_zone,
        #         "is_private": False
        #     }
        # except Exception as e:
        #     self.logger.error(f"Geolocation error: {str(e)}")
        
        # Return placeholder data for now
        self.logger.debug(f"Geolocation lookup for IP {ip_address} (placeholder)")
        return {
            "country_code": None,
            "country_name": None,
            "city": None,
            "region": None,
            "latitude": None,
            "longitude": None,
            "timezone": None,
            "is_private": False
        }
    
    def _is_private_ip(self, ip_address: str) -> bool:
        """
        Check if an IP address is private/local.
        
        Args:
            ip_address: IP address to check
            
        Returns:
            bool: True if private IP, False otherwise
        """
        # Check for localhost
        if ip_address in ['127.0.0.1', '::1', 'localhost']:
            return True
        
        # Check for private IPv4 ranges
        private_patterns = [
            r'^10\.',  # 10.0.0.0/8
            r'^172\.(1[6-9]|2[0-9]|3[0-1])\.',  # 172.16.0.0/12
            r'^192\.168\.',  # 192.168.0.0/16
        ]
        
        for pattern in private_patterns:
            if re.match(pattern, ip_address):
                return True
        
        return False
    
    async def log_access_event(
        self,
        share_id: str,
        ip_address: str,
        user_agent: Optional[str],
        accessed_sections: List[str] = None,
        session_duration: Optional[int] = None
    ) -> Optional[str]:
        """
        Log a comprehensive access event to the share_access_logs table.
        
        This method:
        1. Parses the user agent to extract browser/device information
        2. Performs IP geolocation lookup
        3. Detects suspicious activity patterns
        4. Stores all information in the database
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of the accessor
            user_agent: User agent string from HTTP request
            accessed_sections: List of project sections accessed
            session_duration: Duration of the session in seconds
            
        Returns:
            str: ID of the created access log entry, or None if failed
            
        Requirements: 4.1, 4.2
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot log access event")
                return None
            
            # Parse user agent
            ua_info = self._parse_user_agent(user_agent)
            
            # Get IP geolocation
            geo_info = self._get_ip_geolocation(ip_address)
            
            # Use enhanced security monitoring for suspicious activity detection
            is_suspicious, suspicious_reasons, threat_score = await self.security_service.analyze_access_security(
                share_id, ip_address, user_agent, geo_info
            )
            
            # Prepare log entry
            log_entry = {
                "share_id": share_id,
                "accessed_at": datetime.now(timezone.utc).isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "country_code": geo_info.get("country_code"),
                "city": geo_info.get("city"),
                "accessed_sections": accessed_sections or [],
                "session_duration": session_duration,
                "is_suspicious": is_suspicious,
                "suspicious_reasons": suspicious_reasons,
                # Store parsed user agent info in metadata
                "browser": ua_info.get("browser"),
                "browser_version": ua_info.get("browser_version"),
                "os": ua_info.get("os"),
                "os_version": ua_info.get("os_version"),
                "device_type": ua_info.get("device_type"),
                "device_brand": ua_info.get("device_brand"),
                "device_model": ua_info.get("device_model"),
                "is_bot": ua_info.get("is_bot"),
                # Store geolocation info
                "latitude": geo_info.get("latitude"),
                "longitude": geo_info.get("longitude"),
                "region": geo_info.get("region"),
                "timezone": geo_info.get("timezone")
            }
            
            # Insert log entry
            result = self.db.table("share_access_logs").insert(log_entry).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error("Failed to insert access log entry")
                return None
            
            log_id = result.data[0]["id"]
            
            self.logger.info(
                f"Access event logged: share_id={share_id}, ip={ip_address}, "
                f"suspicious={is_suspicious}, log_id={log_id}"
            )
            
            # If suspicious, handle with security monitoring service
            if is_suspicious:
                await self.security_service.handle_suspicious_activity(
                    share_id, ip_address, suspicious_reasons, threat_score, geo_info
                )
            
            # Check if this is the first access and send notification
            if log_id:
                await self.notification_service.send_first_access_notification(
                    share_id=share_id,
                    ip_address=ip_address,
                    accessed_at=datetime.now(timezone.utc),
                    user_agent=user_agent,
                    country_code=geo_info.get("country_code"),
                    city=geo_info.get("city")
                )
            
            return log_id
            
        except Exception as e:
            self.logger.error(
                f"Error logging access event: {str(e)}",
                exc_info=True
            )
            return None
    
    async def _detect_suspicious_activity(
        self,
        share_id: str,
        ip_address: str,
        geo_info: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """
        Detect suspicious access patterns for a share link.
        
        Checks for:
        1. Multiple IPs accessing the same share link in short time
        2. Unusual access frequency from single IP
        3. Geographic anomalies (rapid location changes)
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of current access
            geo_info: Geolocation information for current access
            
        Returns:
            List of suspicious activity reasons
            
        Requirements: 4.4
        """
        suspicious_reasons = []
        
        try:
            if not self.db:
                return suspicious_reasons
            
            # Get recent access logs for this share link (last hour)
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            
            result = self.db.table("share_access_logs").select(
                "ip_address, accessed_at, latitude, longitude"
            ).eq("share_id", share_id).gte("accessed_at", one_hour_ago).execute()
            
            if not result.data:
                return suspicious_reasons
            
            recent_accesses = result.data
            
            # Check 1: Unusual frequency from single IP
            ip_accesses = [a for a in recent_accesses if a["ip_address"] == ip_address]
            if len(ip_accesses) >= self.MAX_ACCESSES_PER_HOUR:
                suspicious_reasons.append({
                    "type": "high_frequency",
                    "description": f"Excessive accesses from IP {ip_address} ({len(ip_accesses)} in last hour)",
                    "severity": "high"
                })
            
            # Check 2: Multiple unique IPs
            unique_ips = set(a["ip_address"] for a in recent_accesses)
            if len(unique_ips) >= self.MAX_UNIQUE_IPS_PER_HOUR:
                suspicious_reasons.append({
                    "type": "multiple_ips",
                    "description": f"Multiple unique IPs accessing link ({len(unique_ips)} in last hour)",
                    "severity": "medium"
                })
            
            # Check 3: Geographic anomalies (if geolocation available)
            if geo_info.get("latitude") and geo_info.get("longitude"):
                # Get most recent access with geolocation
                recent_with_geo = [
                    a for a in recent_accesses 
                    if a.get("latitude") and a.get("longitude")
                ]
                
                if recent_with_geo:
                    # Sort by accessed_at descending
                    recent_with_geo.sort(
                        key=lambda x: x["accessed_at"],
                        reverse=True
                    )
                    
                    # Check distance from most recent access
                    last_access = recent_with_geo[0]
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
                    
                    # If distance is large and time is short, flag as suspicious
                    if distance > self.MAX_GEOGRAPHIC_DISTANCE_KM and time_diff_minutes < 60:
                        suspicious_reasons.append({
                            "type": "geographic_anomaly",
                            "description": f"Rapid geographic change: {distance:.0f}km in {time_diff_minutes:.0f} minutes",
                            "severity": "high"
                        })
            
        except Exception as e:
            self.logger.error(f"Error detecting suspicious activity: {str(e)}")
        
        return suspicious_reasons
    
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
    
    async def _create_suspicious_activity_alert(
        self,
        share_id: str,
        ip_address: str,
        geo_info: Dict[str, Any],
        suspicious_reasons: List[Dict[str, str]]
    ) -> None:
        """
        Create an alert for suspicious activity.
        
        This would typically:
        1. Store the alert in a database table
        2. Send notifications to the share link creator
        3. Optionally disable the share link
        
        Args:
            share_id: UUID of the share link
            ip_address: IP address of suspicious access
            geo_info: Geolocation information
            suspicious_reasons: List of reasons for suspicion
        """
        try:
            # Get share link details
            share_result = self.db.table("project_shares").select(
                "project_id, created_by"
            ).eq("id", share_id).execute()
            
            if not share_result.data or len(share_result.data) == 0:
                self.logger.error(f"Share link not found: {share_id}")
                return
            
            share = share_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select(
                "name"
            ).eq("id", share["project_id"]).execute()
            
            project_name = "Unknown Project"
            if project_result.data and len(project_result.data) > 0:
                project_name = project_result.data[0]["name"]
            
            # Get creator email
            creator_result = self.db.table("auth.users").select(
                "email"
            ).eq("id", share["created_by"]).execute()
            
            creator_email = "unknown@example.com"
            if creator_result.data and len(creator_result.data) > 0:
                creator_email = creator_result.data[0]["email"]
            
            # Log the alert
            self.logger.warning(
                f"Suspicious activity detected: share_id={share_id}, "
                f"ip={ip_address}, reasons={len(suspicious_reasons)}, "
                f"project={project_name}"
            )
            
            # TODO: Implement alert storage and notification
            # This would typically:
            # 1. Insert into suspicious_activity_alerts table
            # 2. Send email notification to creator
            # 3. Optionally disable the share link if severity is high
            
        except Exception as e:
            self.logger.error(f"Error creating suspicious activity alert: {str(e)}")
    
    async def get_share_analytics(
        self,
        share_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Optional[ShareAnalytics]:
        """
        Get analytics for a share link.
        
        Provides comprehensive analytics including:
        - Total accesses and unique visitors
        - Access patterns by day
        - Geographic distribution
        - Most viewed sections
        - Average session duration
        - Suspicious activity count
        
        Args:
            share_id: UUID of the share link
            start_date: Start date for analytics (optional)
            end_date: End date for analytics (optional)
            
        Returns:
            ShareAnalytics: Analytics data, or None if failed
            
        Requirements: 4.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available, cannot get analytics")
                return None
            
            # Set default date range if not provided
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Query access logs
            result = self.db.table("share_access_logs").select("*").eq(
                "share_id", share_id
            ).gte("accessed_at", start_date.isoformat()).lte(
                "accessed_at", end_date.isoformat()
            ).execute()
            
            if not result.data:
                # No access logs found
                return ShareAnalytics(
                    total_accesses=0,
                    unique_visitors=0,
                    unique_countries=0,
                    access_by_day=[],
                    geographic_distribution=[],
                    most_viewed_sections=[],
                    average_session_duration=None,
                    suspicious_activity_count=0
                )
            
            access_logs = result.data
            
            # Calculate metrics
            total_accesses = len(access_logs)
            unique_ips = set(log["ip_address"] for log in access_logs)
            unique_visitors = len(unique_ips)
            
            # Unique countries
            countries = set(
                log.get("country_code") 
                for log in access_logs 
                if log.get("country_code")
            )
            unique_countries = len(countries)
            
            # Access by day
            access_by_day_dict = defaultdict(int)
            for log in access_logs:
                accessed_at = datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00'))
                day_key = accessed_at.date().isoformat()
                access_by_day_dict[day_key] += 1
            
            access_by_day = [
                {"date": day, "count": count}
                for day, count in sorted(access_by_day_dict.items())
            ]
            
            # Geographic distribution
            geo_dist_dict = defaultdict(int)
            for log in access_logs:
                country = log.get("country_code") or "Unknown"
                geo_dist_dict[country] += 1
            
            geographic_distribution = [
                {"country": country, "count": count}
                for country, count in sorted(
                    geo_dist_dict.items(),
                    key=lambda x: x[1],
                    reverse=True
                )
            ]
            
            # Most viewed sections
            section_counts = defaultdict(int)
            for log in access_logs:
                sections = log.get("accessed_sections") or []
                for section in sections:
                    section_counts[section] += 1
            
            most_viewed_sections = [
                {"section": section, "count": count}
                for section, count in sorted(
                    section_counts.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:10]  # Top 10 sections
            ]
            
            # Average session duration
            durations = [
                log.get("session_duration")
                for log in access_logs
                if log.get("session_duration") is not None
            ]
            average_session_duration = (
                sum(durations) / len(durations) if durations else None
            )
            
            # Suspicious activity count
            suspicious_activity_count = sum(
                1 for log in access_logs if log.get("is_suspicious", False)
            )
            
            analytics = ShareAnalytics(
                total_accesses=total_accesses,
                unique_visitors=unique_visitors,
                unique_countries=unique_countries,
                access_by_day=access_by_day,
                geographic_distribution=geographic_distribution,
                most_viewed_sections=most_viewed_sections,
                average_session_duration=average_session_duration,
                suspicious_activity_count=suspicious_activity_count
            )
            
            self.logger.info(
                f"Analytics generated for share_id={share_id}: "
                f"total={total_accesses}, unique={unique_visitors}"
            )
            
            return analytics
            
        except Exception as e:
            self.logger.error(
                f"Error getting share analytics: {str(e)}",
                exc_info=True
            )
            return None
    
    async def update_access_sections(
        self,
        log_id: str,
        accessed_sections: List[str]
    ) -> bool:
        """
        Update the accessed sections for an access log entry.
        
        This allows tracking which sections of the project were viewed
        during a session.
        
        Args:
            log_id: ID of the access log entry
            accessed_sections: List of section names accessed
            
        Returns:
            bool: True if updated successfully, False otherwise
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            result = self.db.table("share_access_logs").update({
                "accessed_sections": accessed_sections
            }).eq("id", log_id).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error(f"Failed to update access log: {log_id}")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating access sections: {str(e)}")
            return False
    
    async def update_session_duration(
        self,
        log_id: str,
        session_duration: int
    ) -> bool:
        """
        Update the session duration for an access log entry.
        
        Args:
            log_id: ID of the access log entry
            session_duration: Duration in seconds
            
        Returns:
            bool: True if updated successfully, False otherwise
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return False
            
            result = self.db.table("share_access_logs").update({
                "session_duration": session_duration
            }).eq("id", log_id).execute()
            
            if not result.data or len(result.data) == 0:
                self.logger.error(f"Failed to update access log: {log_id}")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating session duration: {str(e)}")
            return False
    
    async def get_time_series_analytics(
        self,
        share_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        granularity: str = "day"
    ) -> Dict[str, Any]:
        """
        Get time-series analytics data for a share link.
        
        Provides detailed time-series data including:
        - Access counts over time with specified granularity
        - Unique visitor trends
        - Session duration trends
        - Geographic distribution over time
        - Device type trends
        
        Args:
            share_id: UUID of the share link
            start_date: Start date for analytics (optional)
            end_date: End date for analytics (optional)
            granularity: Time granularity ('hour', 'day', 'week', 'month')
            
        Returns:
            Dict with time-series analytics data
            
        Requirements: 4.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return {}
            
            # Set default date range if not provided
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Query access logs
            result = self.db.table("share_access_logs").select("*").eq(
                "share_id", share_id
            ).gte("accessed_at", start_date.isoformat()).lte(
                "accessed_at", end_date.isoformat()
            ).execute()
            
            if not result.data:
                return {
                    "access_over_time": [],
                    "unique_visitors_over_time": [],
                    "session_duration_trend": [],
                    "geographic_trend": [],
                    "device_type_trend": [],
                    "browser_trend": []
                }
            
            access_logs = result.data
            
            # Group data by time period
            time_buckets = defaultdict(lambda: {
                "accesses": 0,
                "unique_ips": set(),
                "session_durations": [],
                "countries": defaultdict(int),
                "device_types": defaultdict(int),
                "browsers": defaultdict(int)
            })
            
            for log in access_logs:
                accessed_at = datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00'))
                
                # Determine time bucket based on granularity
                if granularity == "hour":
                    bucket_key = accessed_at.strftime("%Y-%m-%d %H:00")
                elif granularity == "week":
                    # Get ISO week number
                    bucket_key = accessed_at.strftime("%Y-W%W")
                elif granularity == "month":
                    bucket_key = accessed_at.strftime("%Y-%m")
                else:  # day (default)
                    bucket_key = accessed_at.strftime("%Y-%m-%d")
                
                bucket = time_buckets[bucket_key]
                bucket["accesses"] += 1
                bucket["unique_ips"].add(log["ip_address"])
                
                if log.get("session_duration"):
                    bucket["session_durations"].append(log["session_duration"])
                
                if log.get("country_code"):
                    bucket["countries"][log["country_code"]] += 1
                
                if log.get("device_type"):
                    bucket["device_types"][log["device_type"]] += 1
                
                if log.get("browser"):
                    bucket["browsers"][log["browser"]] += 1
            
            # Format time-series data
            access_over_time = []
            unique_visitors_over_time = []
            session_duration_trend = []
            
            for time_key in sorted(time_buckets.keys()):
                bucket = time_buckets[time_key]
                
                access_over_time.append({
                    "time": time_key,
                    "count": bucket["accesses"]
                })
                
                unique_visitors_over_time.append({
                    "time": time_key,
                    "count": len(bucket["unique_ips"])
                })
                
                if bucket["session_durations"]:
                    avg_duration = sum(bucket["session_durations"]) / len(bucket["session_durations"])
                    session_duration_trend.append({
                        "time": time_key,
                        "average_duration": round(avg_duration, 2)
                    })
            
            # Get top countries, device types, and browsers over time
            all_countries = set()
            all_device_types = set()
            all_browsers = set()
            
            for bucket in time_buckets.values():
                all_countries.update(bucket["countries"].keys())
                all_device_types.update(bucket["device_types"].keys())
                all_browsers.update(bucket["browsers"].keys())
            
            # Build geographic trend (top 5 countries)
            top_countries = sorted(
                [(country, sum(time_buckets[t]["countries"].get(country, 0) for t in time_buckets))
                 for country in all_countries],
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            geographic_trend = []
            for country, _ in top_countries:
                country_data = {
                    "country": country,
                    "data": []
                }
                for time_key in sorted(time_buckets.keys()):
                    country_data["data"].append({
                        "time": time_key,
                        "count": time_buckets[time_key]["countries"].get(country, 0)
                    })
                geographic_trend.append(country_data)
            
            # Build device type trend
            device_type_trend = []
            for device_type in all_device_types:
                device_data = {
                    "device_type": device_type,
                    "data": []
                }
                for time_key in sorted(time_buckets.keys()):
                    device_data["data"].append({
                        "time": time_key,
                        "count": time_buckets[time_key]["device_types"].get(device_type, 0)
                    })
                device_type_trend.append(device_data)
            
            # Build browser trend (top 5 browsers)
            top_browsers = sorted(
                [(browser, sum(time_buckets[t]["browsers"].get(browser, 0) for t in time_buckets))
                 for browser in all_browsers],
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            browser_trend = []
            for browser, _ in top_browsers:
                browser_data = {
                    "browser": browser,
                    "data": []
                }
                for time_key in sorted(time_buckets.keys()):
                    browser_data["data"].append({
                        "time": time_key,
                        "count": time_buckets[time_key]["browsers"].get(browser, 0)
                    })
                browser_trend.append(browser_data)
            
            return {
                "access_over_time": access_over_time,
                "unique_visitors_over_time": unique_visitors_over_time,
                "session_duration_trend": session_duration_trend,
                "geographic_trend": geographic_trend,
                "device_type_trend": device_type_trend,
                "browser_trend": browser_trend
            }
            
        except Exception as e:
            self.logger.error(f"Error getting time-series analytics: {str(e)}", exc_info=True)
            return {}
    
    async def generate_summary_report(
        self,
        share_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive summary report for a share link.
        
        Provides key metrics and insights including:
        - Overall statistics (total accesses, unique visitors, etc.)
        - Engagement metrics (average session duration, return visitor rate)
        - Geographic insights (top countries, cities)
        - Technology insights (top browsers, devices, operating systems)
        - Security insights (suspicious activity summary)
        - Trend analysis (growth rate, peak usage times)
        
        Args:
            share_id: UUID of the share link
            start_date: Start date for report (optional)
            end_date: End date for report (optional)
            
        Returns:
            Dict with comprehensive summary report data
            
        Requirements: 4.3
        """
        try:
            if not self.db:
                self.logger.error("Database client not available")
                return {}
            
            # Set default date range if not provided
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Get basic analytics
            analytics = await self.get_share_analytics(share_id, start_date, end_date)
            
            if not analytics:
                return {}
            
            # Query access logs for detailed analysis
            result = self.db.table("share_access_logs").select("*").eq(
                "share_id", share_id
            ).gte("accessed_at", start_date.isoformat()).lte(
                "accessed_at", end_date.isoformat()
            ).execute()
            
            if not result.data:
                return {
                    "period": {
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "days": (end_date - start_date).days
                    },
                    "overall_statistics": analytics.dict(),
                    "engagement_metrics": {},
                    "geographic_insights": {},
                    "technology_insights": {},
                    "security_insights": {},
                    "trend_analysis": {}
                }
            
            access_logs = result.data
            
            # Calculate engagement metrics
            ip_access_counts = defaultdict(int)
            for log in access_logs:
                ip_access_counts[log["ip_address"]] += 1
            
            return_visitors = sum(1 for count in ip_access_counts.values() if count > 1)
            return_visitor_rate = (return_visitors / len(ip_access_counts) * 100) if ip_access_counts else 0
            
            # Calculate peak usage times
            hour_counts = defaultdict(int)
            day_counts = defaultdict(int)
            for log in access_logs:
                accessed_at = datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00'))
                hour_counts[accessed_at.hour] += 1
                day_counts[accessed_at.strftime("%A")] += 1
            
            peak_hour = max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else None
            peak_day = max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None
            
            # Geographic insights
            city_counts = defaultdict(int)
            for log in access_logs:
                if log.get("city"):
                    city_counts[log["city"]] += 1
            
            top_cities = sorted(city_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            
            # Technology insights
            os_counts = defaultdict(int)
            browser_version_counts = defaultdict(int)
            device_brand_counts = defaultdict(int)
            
            for log in access_logs:
                if log.get("os"):
                    os_counts[log["os"]] += 1
                if log.get("browser") and log.get("browser_version"):
                    browser_version_counts[f"{log['browser']} {log['browser_version']}"] += 1
                if log.get("device_brand"):
                    device_brand_counts[log["device_brand"]] += 1
            
            top_os = sorted(os_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            top_browser_versions = sorted(browser_version_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            top_device_brands = sorted(device_brand_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            
            # Security insights
            suspicious_logs = [log for log in access_logs if log.get("is_suspicious", False)]
            suspicious_by_type = defaultdict(int)
            for log in suspicious_logs:
                for reason in log.get("suspicious_reasons", []):
                    suspicious_by_type[reason.get("type", "unknown")] += 1
            
            # Trend analysis - compare first half vs second half
            midpoint = start_date + (end_date - start_date) / 2
            first_half_logs = [log for log in access_logs 
                             if datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00')) < midpoint]
            second_half_logs = [log for log in access_logs 
                              if datetime.fromisoformat(log["accessed_at"].replace('Z', '+00:00')) >= midpoint]
            
            first_half_count = len(first_half_logs)
            second_half_count = len(second_half_logs)
            
            growth_rate = 0
            if first_half_count > 0:
                growth_rate = ((second_half_count - first_half_count) / first_half_count) * 100
            
            # Build comprehensive report
            report = {
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": (end_date - start_date).days
                },
                "overall_statistics": {
                    "total_accesses": analytics.total_accesses,
                    "unique_visitors": analytics.unique_visitors,
                    "unique_countries": analytics.unique_countries,
                    "average_session_duration": analytics.average_session_duration,
                    "suspicious_activity_count": analytics.suspicious_activity_count
                },
                "engagement_metrics": {
                    "return_visitors": return_visitors,
                    "return_visitor_rate": round(return_visitor_rate, 2),
                    "average_accesses_per_visitor": round(analytics.total_accesses / analytics.unique_visitors, 2) if analytics.unique_visitors > 0 else 0,
                    "peak_hour": peak_hour,
                    "peak_day": peak_day
                },
                "geographic_insights": {
                    "top_countries": analytics.geographic_distribution[:5],
                    "top_cities": [{"city": city, "count": count} for city, count in top_cities]
                },
                "technology_insights": {
                    "top_operating_systems": [{"os": os, "count": count} for os, count in top_os],
                    "top_browsers": [{"browser": browser, "count": count} for browser, count in top_browser_versions],
                    "top_device_brands": [{"brand": brand, "count": count} for brand, count in top_device_brands],
                    "device_type_distribution": dict(defaultdict(int, 
                        [(log.get("device_type", "Unknown"), 1) for log in access_logs]))
                },
                "security_insights": {
                    "total_suspicious_accesses": len(suspicious_logs),
                    "suspicious_access_rate": round((len(suspicious_logs) / len(access_logs) * 100), 2) if access_logs else 0,
                    "suspicious_by_type": dict(suspicious_by_type),
                    "unique_suspicious_ips": len(set(log["ip_address"] for log in suspicious_logs))
                },
                "trend_analysis": {
                    "first_half_accesses": first_half_count,
                    "second_half_accesses": second_half_count,
                    "growth_rate": round(growth_rate, 2),
                    "trend": "increasing" if growth_rate > 10 else "decreasing" if growth_rate < -10 else "stable"
                }
            }
            
            self.logger.info(f"Generated summary report for share_id={share_id}")
            
            return report
            
        except Exception as e:
            self.logger.error(f"Error generating summary report: {str(e)}", exc_info=True)
            return {}
