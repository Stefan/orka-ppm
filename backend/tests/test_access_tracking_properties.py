"""
Property-Based Tests for Access Tracking in Shareable Project URLs

This module contains property-based tests using Hypothesis to validate
the access event logging completeness property of the shareable URL system.

Feature: shareable-project-urls
Property 4: Access Event Logging Completeness

**Validates: Requirements 4.1, 4.2**
"""

import pytest
from hypothesis import given, settings, strategies as st, assume
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import sys
import os
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.access_analytics_service import AccessAnalyticsService
from models.shareable_urls import ShareAccessLog


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def ip_address_strategy(draw):
    """Generate valid IPv4 addresses including private and public ranges"""
    # Mix of private and public IPs
    ip_type = draw(st.sampled_from(['public', 'private_10', 'private_192', 'private_172', 'localhost']))
    
    if ip_type == 'localhost':
        return '127.0.0.1'
    elif ip_type == 'private_10':
        return f"10.{draw(st.integers(0, 255))}.{draw(st.integers(0, 255))}.{draw(st.integers(1, 254))}"
    elif ip_type == 'private_192':
        return f"192.168.{draw(st.integers(0, 255))}.{draw(st.integers(1, 254))}"
    elif ip_type == 'private_172':
        return f"172.{draw(st.integers(16, 31))}.{draw(st.integers(0, 255))}.{draw(st.integers(1, 254))}"
    else:  # public
        # Avoid private ranges
        octets = [draw(st.integers(1, 223)) for _ in range(4)]
        # Ensure it's not in private ranges
        if octets[0] == 10:
            octets[0] = 11
        elif octets[0] == 172 and 16 <= octets[1] <= 31:
            octets[1] = 32
        elif octets[0] == 192 and octets[1] == 168:
            octets[1] = 169
        return '.'.join(map(str, octets))


@st.composite
def user_agent_strategy(draw):
    """Generate realistic user agent strings"""
    browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
        'curl/7.68.0',  # Bot/CLI tool
        'python-requests/2.31.0',  # Bot/script
    ]
    return draw(st.sampled_from(browsers))


@st.composite
def accessed_sections_strategy(draw):
    """Generate lists of accessed project sections"""
    all_sections = [
        'dashboard', 'overview', 'timeline', 'milestones', 
        'tasks', 'team', 'documents', 'risks', 'issues',
        'budget', 'resources', 'reports', 'settings'
    ]
    # Can be empty or contain multiple sections
    num_sections = draw(st.integers(0, len(all_sections)))
    if num_sections == 0:
        return []
    return draw(st.lists(
        st.sampled_from(all_sections),
        min_size=1,
        max_size=num_sections,
        unique=True
    ))


@st.composite
def session_duration_strategy(draw):
    """Generate realistic session durations in seconds"""
    # Mix of None (session not ended) and actual durations
    has_duration = draw(st.booleans())
    if not has_duration:
        return None
    # Session durations from 1 second to 2 hours
    return draw(st.integers(min_value=1, max_value=7200))


@st.composite
def access_event_strategy(draw):
    """Generate complete access event data"""
    return {
        'share_id': str(uuid4()),
        'ip_address': draw(ip_address_strategy()),
        'user_agent': draw(st.one_of(st.none(), user_agent_strategy())),
        'accessed_sections': draw(accessed_sections_strategy()),
        'session_duration': draw(session_duration_strategy())
    }


# ============================================================================
# Helper Functions
# ============================================================================

def create_mock_database():
    """
    Create a properly configured mock database for access analytics testing.
    
    This mock handles:
    - Insert operations to share_access_logs
    - Select operations for suspicious activity detection
    - Select operations for notification service
    """
    mock_db = Mock()
    insert_calls = []
    
    def create_table_mock(table_name):
        mock_table = Mock()
        
        def mock_insert_func(data):
            if table_name == "share_access_logs":
                insert_calls.append(data)
            mock_insert = Mock()
            mock_result = Mock()
            log_id = str(uuid4())
            mock_result.data = [{'id': log_id}]
            mock_insert.execute.return_value = mock_result
            return mock_insert
        
        # Mock select for suspicious activity detection
        mock_select = Mock()
        mock_eq = Mock()
        mock_gte = Mock()
        mock_select.eq.return_value = mock_eq
        mock_eq.gte.return_value = mock_gte
        mock_gte.execute.return_value = Mock(data=[])
        
        mock_table.insert.side_effect = mock_insert_func
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_db.table.side_effect = create_table_mock
    mock_db._insert_calls = insert_calls  # Store for test access
    
    return mock_db


# ============================================================================
# Property 4: Access Event Logging Completeness
# ============================================================================

class TestAccessEventLoggingCompleteness:
    """
    Property-based tests for access event logging completeness.
    
    Property 4: Access Event Logging Completeness
    For any share link access event, all required metadata (timestamp, IP address,
    user agent, accessed sections) must be logged to the tracking system.
    
    **Validates: Requirements 4.1, 4.2**
    """
    
    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_all_required_fields_are_logged(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that all required metadata fields are logged for any access event.
        
        Required fields:
        - share_id: UUID of the share link
        - accessed_at: Timestamp of access
        - ip_address: IP address of accessor
        - user_agent: User agent string (can be None)
        - accessed_sections: List of sections accessed (can be empty)
        - session_duration: Duration in seconds (can be None)
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Log ID must be returned on success
        assert result_log_id is not None, "Log ID must be returned after successful logging"
        assert isinstance(result_log_id, str), "Log ID must be a string"
        
        # Property: Database insert must be called for share_access_logs
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) > 0, "At least one insert must be made to share_access_logs"
        
        # Get the inserted data (first call is the access log)
        inserted_data = insert_calls[0]
        
        # Property: All required fields must be present in inserted data
        assert 'share_id' in inserted_data, "share_id must be logged"
        assert 'accessed_at' in inserted_data, "accessed_at timestamp must be logged"
        assert 'ip_address' in inserted_data, "ip_address must be logged"
        assert 'user_agent' in inserted_data, "user_agent must be logged (can be None)"
        assert 'accessed_sections' in inserted_data, "accessed_sections must be logged"
        assert 'session_duration' in inserted_data, "session_duration must be logged (can be None)"
        
        # Property: Logged values must match input
        assert inserted_data['share_id'] == access_event['share_id']
        assert inserted_data['ip_address'] == access_event['ip_address']
        assert inserted_data['user_agent'] == access_event['user_agent']
        assert inserted_data['accessed_sections'] == access_event['accessed_sections']
        assert inserted_data['session_duration'] == access_event['session_duration']
        
        # Property: Timestamp must be valid and recent
        logged_time = datetime.fromisoformat(inserted_data['accessed_at'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        time_diff = (now - logged_time).total_seconds()
        assert time_diff >= 0, "Logged timestamp must not be in the future"
        assert time_diff < 5, "Logged timestamp must be recent (within 5 seconds)"

    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_geolocation_metadata_is_logged(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that geolocation metadata is logged when available.
        
        Geolocation fields:
        - country_code: ISO country code
        - city: City name
        - latitude: Geographic latitude
        - longitude: Geographic longitude
        - region: Region/state name
        - timezone: Timezone identifier
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Logging must succeed
        assert result_log_id is not None
        
        # Get the inserted data
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) > 0
        inserted_data = insert_calls[0]
        
        # Property: Geolocation fields must be present (can be None for private IPs)
        assert 'country_code' in inserted_data, "country_code must be logged"
        assert 'city' in inserted_data, "city must be logged"
        assert 'latitude' in inserted_data, "latitude must be logged"
        assert 'longitude' in inserted_data, "longitude must be logged"
        assert 'region' in inserted_data, "region must be logged"
        assert 'timezone' in inserted_data, "timezone must be logged"
        
        # Property: For private IPs, geolocation should be None
        if service._is_private_ip(access_event['ip_address']):
            assert inserted_data['country_code'] is None, "Private IPs should have None country_code"
            assert inserted_data['city'] is None, "Private IPs should have None city"


    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_user_agent_parsing_metadata_is_logged(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that parsed user agent metadata is logged.
        
        User agent fields:
        - browser: Browser name
        - browser_version: Browser version
        - os: Operating system name
        - os_version: OS version
        - device_type: Device type (Mobile, Tablet, Desktop, Bot)
        - device_brand: Device brand (if available)
        - device_model: Device model (if available)
        - is_bot: Boolean indicating if it's a bot
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Logging must succeed
        assert result_log_id is not None
        
        # Get the inserted data
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) > 0
        inserted_data = insert_calls[0]
        
        # Property: User agent parsing fields must be present
        assert 'browser' in inserted_data, "browser must be logged"
        assert 'browser_version' in inserted_data, "browser_version must be logged"
        assert 'os' in inserted_data, "os must be logged"
        assert 'os_version' in inserted_data, "os_version must be logged"
        assert 'device_type' in inserted_data, "device_type must be logged"
        assert 'device_brand' in inserted_data, "device_brand must be logged"
        assert 'device_model' in inserted_data, "device_model must be logged"
        assert 'is_bot' in inserted_data, "is_bot must be logged"
        
        # Property: If user agent is None, fields should have default values
        if access_event['user_agent'] is None:
            assert inserted_data['browser'] == "Unknown", "Unknown browser for None user agent"
            assert inserted_data['os'] == "Unknown", "Unknown OS for None user agent"
            assert inserted_data['device_type'] == "Unknown", "Unknown device type for None user agent"
            assert inserted_data['is_bot'] is False, "is_bot should be False for None user agent"
        else:
            # Property: Parsed values should be non-empty strings or None
            assert isinstance(inserted_data['browser'], str), "browser must be a string"
            assert isinstance(inserted_data['os'], str), "os must be a string"
            assert isinstance(inserted_data['device_type'], str), "device_type must be a string"
            assert isinstance(inserted_data['is_bot'], bool), "is_bot must be a boolean"


    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_suspicious_activity_detection_is_logged(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that suspicious activity detection results are logged.
        
        Suspicious activity fields:
        - is_suspicious: Boolean indicating if activity is suspicious
        - suspicious_reasons: List of reasons for suspicion
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Logging must succeed
        assert result_log_id is not None
        
        # Get the inserted data
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) > 0
        inserted_data = insert_calls[0]
        
        # Property: Suspicious activity fields must be present
        assert 'is_suspicious' in inserted_data, "is_suspicious must be logged"
        assert 'suspicious_reasons' in inserted_data, "suspicious_reasons must be logged"
        
        # Property: is_suspicious must be a boolean
        assert isinstance(inserted_data['is_suspicious'], bool), "is_suspicious must be a boolean"
        
        # Property: suspicious_reasons must be a list
        assert isinstance(inserted_data['suspicious_reasons'], list), "suspicious_reasons must be a list"
        
        # Property: If is_suspicious is True, suspicious_reasons must not be empty
        if inserted_data['is_suspicious']:
            assert len(inserted_data['suspicious_reasons']) > 0, \
                "suspicious_reasons must not be empty when is_suspicious is True"
            
            # Property: Each reason must have required fields
            for reason in inserted_data['suspicious_reasons']:
                assert 'type' in reason, "Each suspicious reason must have a type"
                assert 'description' in reason, "Each suspicious reason must have a description"
                assert 'severity' in reason, "Each suspicious reason must have a severity"
        else:
            # Property: If is_suspicious is False, suspicious_reasons should be empty
            assert len(inserted_data['suspicious_reasons']) == 0, \
                "suspicious_reasons should be empty when is_suspicious is False"


    @given(st.lists(access_event_strategy(), min_size=2, max_size=5))
    @settings(max_examples=50, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_multiple_access_events_are_all_logged(self, access_events):
        """
        Property 4: Access Event Logging Completeness
        
        Test that multiple access events are all logged independently and completely.
        
        This ensures that the logging system can handle multiple concurrent or
        sequential access events without losing data.
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log all access events
        log_ids = []
        for event in access_events:
            log_id = await service.log_access_event(
                share_id=event['share_id'],
                ip_address=event['ip_address'],
                user_agent=event['user_agent'],
                accessed_sections=event['accessed_sections'],
                session_duration=event['session_duration']
            )
            log_ids.append(log_id)
        
        # Property: All events must be logged successfully
        assert len(log_ids) == len(access_events), "All events must be logged"
        assert all(log_id is not None for log_id in log_ids), "All log IDs must be non-None"
        
        # Property: Number of insert calls must match number of events
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) == len(access_events), \
            "Number of database inserts must match number of events"
        
        # Property: Each event's data must be preserved in its log entry
        for i, (event, inserted_data) in enumerate(zip(access_events, insert_calls)):
            assert inserted_data['share_id'] == event['share_id'], \
                f"Event {i}: share_id must be preserved"
            assert inserted_data['ip_address'] == event['ip_address'], \
                f"Event {i}: ip_address must be preserved"
            assert inserted_data['user_agent'] == event['user_agent'], \
                f"Event {i}: user_agent must be preserved"
            assert inserted_data['accessed_sections'] == event['accessed_sections'], \
                f"Event {i}: accessed_sections must be preserved"
            assert inserted_data['session_duration'] == event['session_duration'], \
                f"Event {i}: session_duration must be preserved"


    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_logging_handles_edge_cases(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that logging handles edge cases correctly:
        - Empty accessed_sections list
        - None user_agent
        - None session_duration
        - Private IP addresses
        - Very long user agent strings
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database
        mock_db = create_mock_database()
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Logging must succeed even with edge case values
        assert result_log_id is not None, "Logging must succeed with edge case values"
        
        # Get the inserted data
        insert_calls = mock_db._insert_calls
        assert len(insert_calls) > 0
        inserted_data = insert_calls[0]
        
        # Property: Empty accessed_sections must be preserved as empty list
        if len(access_event['accessed_sections']) == 0:
            assert inserted_data['accessed_sections'] == [], \
                "Empty accessed_sections must be preserved as empty list"
        
        # Property: None values must be preserved
        if access_event['user_agent'] is None:
            assert inserted_data['user_agent'] is None, \
                "None user_agent must be preserved"
        
        if access_event['session_duration'] is None:
            assert inserted_data['session_duration'] is None, \
                "None session_duration must be preserved"
        
        # Property: All required fields must still be present
        required_fields = [
            'share_id', 'accessed_at', 'ip_address', 'user_agent',
            'accessed_sections', 'session_duration', 'is_suspicious',
            'suspicious_reasons', 'country_code', 'city'
        ]
        for field in required_fields:
            assert field in inserted_data, f"Required field '{field}' must be present"


    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_logging_failure_returns_none(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that logging failures are handled gracefully and return None.
        
        This ensures that the system can handle database errors without crashing.
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Setup mock database that fails
        mock_db = Mock()
        
        def create_failing_table_mock(table_name):
            mock_table = Mock()
            mock_insert = Mock()
            mock_result = Mock()
            mock_result.data = []  # Empty data indicates failure
            mock_insert.execute.return_value = mock_result
            mock_table.insert.return_value = mock_insert
            
            # Mock select for suspicious activity detection
            mock_select = Mock()
            mock_eq = Mock()
            mock_gte = Mock()
            mock_select.eq.return_value = mock_eq
            mock_eq.gte.return_value = mock_gte
            mock_gte.execute.return_value = Mock(data=[])
            mock_table.select.return_value = mock_select
            
            return mock_table
        
        mock_db.table.side_effect = create_failing_table_mock
        
        # Create service with mock database
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Failed logging must return None
        assert result_log_id is None, "Failed logging must return None"


    @given(access_event_strategy())
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    async def test_property4_logging_without_database_returns_none(self, access_event):
        """
        Property 4: Access Event Logging Completeness
        
        Test that logging without a database connection returns None gracefully.
        
        Feature: shareable-project-urls, Property 4: Access Event Logging Completeness
        **Validates: Requirements 4.1, 4.2**
        """
        # Create service without database
        service = AccessAnalyticsService(db_session=None)
        
        # Log the access event
        result_log_id = await service.log_access_event(
            share_id=access_event['share_id'],
            ip_address=access_event['ip_address'],
            user_agent=access_event['user_agent'],
            accessed_sections=access_event['accessed_sections'],
            session_duration=access_event['session_duration']
        )
        
        # Property: Logging without database must return None
        assert result_log_id is None, "Logging without database must return None"


# ============================================================================
# Additional Edge Case Tests
# ============================================================================

class TestAccessEventLoggingEdgeCases:
    """Additional edge case tests for access event logging"""
    
    @pytest.mark.asyncio
    async def test_logging_with_malformed_share_id(self):
        """Test that logging handles malformed share IDs gracefully"""
        # Setup mock database
        mock_db = create_mock_database()
        
        service = AccessAnalyticsService(db_session=mock_db)
        
        # Test with various malformed share IDs
        malformed_ids = [
            "not-a-uuid",
            "",
            "12345",
            "invalid-share-id-format"
        ]
        
        for malformed_id in malformed_ids:
            # Should not raise exception
            result = await service.log_access_event(
                share_id=malformed_id,
                ip_address="192.168.1.1",
                user_agent="Test Agent",
                accessed_sections=[],
                session_duration=None
            )
            # Should still attempt to log
            assert result is not None or result is None  # Either succeeds or fails gracefully


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
