"""
Audit Feature Extractor for Anomaly Detection

This module extracts features from audit events for ML-based anomaly detection.
Features include time-based patterns, event frequency, user behavior patterns,
and entity access patterns.

Requirements: 1.2
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
import json
import logging
import numpy as np
from collections import defaultdict, Counter


class AuditFeatureExtractor:
    """
    Extracts normalized features from audit events for anomaly detection.
    
    Features extracted:
    - Event type frequency (how common is this event type)
    - User activity patterns (events per hour, events per day)
    - Entity access patterns (which entities are accessed together)
    - Time-based features (hour of day, day of week)
    - Action details complexity (JSON depth, field count)
    - Performance metrics (execution time, resource usage)
    """
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client
        self.logger = logging.getLogger(__name__)
        
        # Cache for historical statistics
        self._event_type_frequencies = {}
        self._user_activity_stats = {}
        self._entity_access_patterns = {}
        self._last_cache_update = None
        self._cache_ttl = timedelta(hours=1)
    
    async def extract_features(
        self,
        event: Dict[str, Any],
        historical_context: Optional[Dict[str, Any]] = None
    ) -> np.ndarray:
        """
        Extract feature vector from audit event.
        
        Args:
            event: Audit event dictionary
            historical_context: Optional pre-computed historical statistics
            
        Returns:
            Normalized feature vector as numpy array
        """
        try:
            # Update cache if needed
            if historical_context is None:
                await self._update_cache_if_needed()
                historical_context = {
                    'event_type_frequencies': self._event_type_frequencies,
                    'user_activity_stats': self._user_activity_stats,
                    'entity_access_patterns': self._entity_access_patterns
                }
            
            features = []
            
            # 1. Event type frequency features
            event_type_features = self._extract_event_type_features(
                event, historical_context
            )
            features.extend(event_type_features)
            
            # 2. Time-based features
            time_features = self._extract_time_features(event)
            features.extend(time_features)
            
            # 3. User activity features
            user_features = self._extract_user_activity_features(
                event, historical_context
            )
            features.extend(user_features)
            
            # 4. Entity access features
            entity_features = self._extract_entity_access_features(
                event, historical_context
            )
            features.extend(entity_features)
            
            # 5. Action complexity features
            complexity_features = self._extract_action_complexity_features(event)
            features.extend(complexity_features)
            
            # 6. Performance features
            performance_features = self._extract_performance_features(event)
            features.extend(performance_features)
            
            # 7. Severity features
            severity_features = self._extract_severity_features(event)
            features.extend(severity_features)
            
            # Convert to numpy array and normalize
            feature_vector = np.array(features, dtype=np.float64)
            
            # Handle any NaN or inf values
            feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=1.0, neginf=0.0)
            
            return feature_vector
            
        except Exception as e:
            self.logger.error(f"Feature extraction failed: {str(e)}")
            # Return zero vector on error
            return np.zeros(self._get_feature_dimension())
    
    def _extract_event_type_features(
        self,
        event: Dict[str, Any],
        historical_context: Dict[str, Any]
    ) -> List[float]:
        """
        Extract features related to event type frequency.
        
        Returns:
            [event_type_frequency, event_type_rarity_score]
        """
        event_type = event.get('event_type', 'unknown')
        frequencies = historical_context.get('event_type_frequencies', {})
        
        # Get frequency of this event type (0-1 normalized)
        total_events = sum(frequencies.values()) if frequencies else 1
        event_frequency = frequencies.get(event_type, 0) / total_events if total_events > 0 else 0
        
        # Rarity score (inverse of frequency)
        rarity_score = 1.0 - event_frequency if event_frequency > 0 else 1.0
        
        return [event_frequency, rarity_score]
    
    def _extract_time_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract time-based features.
        
        Returns:
            [hour_of_day_normalized, day_of_week_normalized, is_weekend, is_business_hours]
        """
        timestamp_str = event.get('timestamp')
        if not timestamp_str:
            return [0.0, 0.0, 0.0, 0.0]
        
        try:
            if isinstance(timestamp_str, str):
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                timestamp = timestamp_str
            
            # Hour of day (0-23) normalized to 0-1
            hour_normalized = timestamp.hour / 23.0
            
            # Day of week (0-6) normalized to 0-1
            day_of_week_normalized = timestamp.weekday() / 6.0
            
            # Is weekend (Saturday=5, Sunday=6)
            is_weekend = 1.0 if timestamp.weekday() >= 5 else 0.0
            
            # Is business hours (9 AM - 5 PM on weekdays)
            is_business_hours = 1.0 if (
                timestamp.weekday() < 5 and 9 <= timestamp.hour < 17
            ) else 0.0
            
            return [hour_normalized, day_of_week_normalized, is_weekend, is_business_hours]
            
        except Exception as e:
            self.logger.warning(f"Failed to parse timestamp: {str(e)}")
            return [0.0, 0.0, 0.0, 0.0]
    
    def _extract_user_activity_features(
        self,
        event: Dict[str, Any],
        historical_context: Dict[str, Any]
    ) -> List[float]:
        """
        Extract user activity pattern features.
        
        Returns:
            [user_events_per_hour, user_events_per_day, user_activity_deviation]
        """
        user_id = event.get('user_id')
        if not user_id:
            return [0.0, 0.0, 0.0]
        
        user_stats = historical_context.get('user_activity_stats', {}).get(str(user_id), {})
        
        # Events per hour for this user
        events_per_hour = user_stats.get('events_per_hour', 0.0)
        # Normalize to 0-1 (assuming max 100 events per hour is very high)
        events_per_hour_normalized = min(events_per_hour / 100.0, 1.0)
        
        # Events per day for this user
        events_per_day = user_stats.get('events_per_day', 0.0)
        # Normalize to 0-1 (assuming max 1000 events per day is very high)
        events_per_day_normalized = min(events_per_day / 1000.0, 1.0)
        
        # Activity deviation (how much this user's activity deviates from average)
        avg_events_per_day = user_stats.get('avg_events_per_day', 0.0)
        std_events_per_day = user_stats.get('std_events_per_day', 1.0)
        if std_events_per_day > 0:
            activity_deviation = abs(events_per_day - avg_events_per_day) / std_events_per_day
            activity_deviation_normalized = min(activity_deviation / 3.0, 1.0)  # 3 std devs = 1.0
        else:
            activity_deviation_normalized = 0.0
        
        return [
            events_per_hour_normalized,
            events_per_day_normalized,
            activity_deviation_normalized
        ]
    
    def _extract_entity_access_features(
        self,
        event: Dict[str, Any],
        historical_context: Dict[str, Any]
    ) -> List[float]:
        """
        Extract entity access pattern features.
        
        Returns:
            [entity_access_frequency, entity_type_frequency, cross_entity_access_score]
        """
        entity_type = event.get('entity_type', 'unknown')
        entity_id = event.get('entity_id')
        
        access_patterns = historical_context.get('entity_access_patterns', {})
        
        # Entity access frequency
        entity_key = f"{entity_type}:{entity_id}" if entity_id else entity_type
        entity_access_count = access_patterns.get(entity_key, 0)
        total_accesses = sum(access_patterns.values()) if access_patterns else 1
        entity_access_frequency = entity_access_count / total_accesses if total_accesses > 0 else 0
        
        # Entity type frequency
        entity_type_counts = defaultdict(int)
        for key in access_patterns.keys():
            etype = key.split(':')[0]
            entity_type_counts[etype] += access_patterns[key]
        
        entity_type_count = entity_type_counts.get(entity_type, 0)
        entity_type_frequency = entity_type_count / total_accesses if total_accesses > 0 else 0
        
        # Cross-entity access score (how often this entity is accessed with others)
        # For now, use a simple heuristic based on entity type diversity
        unique_entity_types = len(entity_type_counts)
        cross_entity_score = min(unique_entity_types / 10.0, 1.0)  # Normalize to 0-1
        
        return [entity_access_frequency, entity_type_frequency, cross_entity_score]
    
    def _extract_action_complexity_features(
        self,
        event: Dict[str, Any]
    ) -> List[float]:
        """
        Extract action details complexity features.
        
        Returns:
            [json_depth, field_count, text_length]
        """
        action_details = event.get('action_details', {})
        
        # Parse if string
        if isinstance(action_details, str):
            try:
                action_details = json.loads(action_details)
            except:
                action_details = {}
        
        # JSON depth
        json_depth = self._calculate_json_depth(action_details)
        json_depth_normalized = min(json_depth / 10.0, 1.0)  # Max depth 10 = 1.0
        
        # Field count
        field_count = self._count_json_fields(action_details)
        field_count_normalized = min(field_count / 50.0, 1.0)  # Max 50 fields = 1.0
        
        # Text length
        text_length = len(json.dumps(action_details))
        text_length_normalized = min(text_length / 10000.0, 1.0)  # Max 10KB = 1.0
        
        return [json_depth_normalized, field_count_normalized, text_length_normalized]
    
    def _extract_performance_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract performance metric features.
        
        Returns:
            [execution_time_normalized, has_performance_metrics]
        """
        performance_metrics = event.get('performance_metrics')
        
        if not performance_metrics:
            return [0.0, 0.0]
        
        # Parse if string
        if isinstance(performance_metrics, str):
            try:
                performance_metrics = json.loads(performance_metrics)
            except:
                return [0.0, 0.0]
        
        # Execution time
        execution_time = performance_metrics.get('execution_time', 0)
        # Normalize to 0-1 (assuming max 60 seconds is very high)
        execution_time_normalized = min(execution_time / 60.0, 1.0)
        
        # Has performance metrics flag
        has_metrics = 1.0
        
        return [execution_time_normalized, has_metrics]
    
    def _extract_severity_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract severity-related features.
        
        Returns:
            [severity_score]
        """
        severity = event.get('severity', 'info')
        
        severity_map = {
            'info': 0.0,
            'warning': 0.33,
            'error': 0.66,
            'critical': 1.0
        }
        
        severity_score = severity_map.get(severity.lower(), 0.0)
        
        return [severity_score]
    
    def _calculate_json_depth(self, obj: Any, current_depth: int = 0) -> int:
        """Calculate maximum depth of nested JSON object."""
        if not isinstance(obj, (dict, list)):
            return current_depth
        
        if isinstance(obj, dict):
            if not obj:
                return current_depth
            return max(
                self._calculate_json_depth(v, current_depth + 1)
                for v in obj.values()
            )
        else:  # list
            if not obj:
                return current_depth
            return max(
                self._calculate_json_depth(item, current_depth + 1)
                for item in obj
            )
    
    def _count_json_fields(self, obj: Any) -> int:
        """Count total number of fields in nested JSON object."""
        if not isinstance(obj, (dict, list)):
            return 0
        
        if isinstance(obj, dict):
            count = len(obj)
            for v in obj.values():
                count += self._count_json_fields(v)
            return count
        else:  # list
            count = 0
            for item in obj:
                count += self._count_json_fields(item)
            return count
    
    def _get_feature_dimension(self) -> int:
        """Get total dimension of feature vector."""
        # 2 (event type) + 4 (time) + 3 (user) + 3 (entity) + 3 (complexity) + 2 (performance) + 1 (severity)
        return 18
    
    async def _update_cache_if_needed(self):
        """Update cached historical statistics if TTL expired."""
        if (
            self._last_cache_update is None or
            datetime.now() - self._last_cache_update > self._cache_ttl
        ):
            await self._compute_historical_statistics()
            self._last_cache_update = datetime.now()
    
    async def _compute_historical_statistics(self):
        """Compute historical statistics for feature extraction."""
        try:
            if not self.supabase:
                return
            
            # Get last 30 days of audit events for statistics
            start_date = datetime.now() - timedelta(days=30)
            
            response = self.supabase.table("audit_logs").select(
                "event_type, user_id, entity_type, entity_id, timestamp"
            ).gte("timestamp", start_date.isoformat()).execute()
            
            events = response.data if response.data else []
            
            # Compute event type frequencies
            event_type_counter = Counter(e['event_type'] for e in events)
            self._event_type_frequencies = dict(event_type_counter)
            
            # Compute user activity statistics
            user_events = defaultdict(list)
            for event in events:
                user_id = event.get('user_id')
                if user_id:
                    user_events[user_id].append(event)
            
            for user_id, user_event_list in user_events.items():
                # Calculate events per hour and per day
                if user_event_list:
                    time_span_hours = 30 * 24  # 30 days in hours
                    events_per_hour = len(user_event_list) / time_span_hours
                    events_per_day = len(user_event_list) / 30
                    
                    self._user_activity_stats[user_id] = {
                        'events_per_hour': events_per_hour,
                        'events_per_day': events_per_day,
                        'avg_events_per_day': events_per_day,
                        'std_events_per_day': events_per_day * 0.2  # Rough estimate
                    }
            
            # Compute entity access patterns
            entity_access_counter = Counter()
            for event in events:
                entity_type = event.get('entity_type', 'unknown')
                entity_id = event.get('entity_id')
                entity_key = f"{entity_type}:{entity_id}" if entity_id else entity_type
                entity_access_counter[entity_key] += 1
            
            self._entity_access_patterns = dict(entity_access_counter)
            
            self.logger.info(
                f"Updated historical statistics: "
                f"{len(self._event_type_frequencies)} event types, "
                f"{len(self._user_activity_stats)} users, "
                f"{len(self._entity_access_patterns)} entities"
            )
            
        except Exception as e:
            self.logger.error(f"Failed to compute historical statistics: {str(e)}")
    
    async def extract_batch_features(
        self,
        events: List[Dict[str, Any]]
    ) -> np.ndarray:
        """
        Extract features for a batch of events efficiently.
        
        Args:
            events: List of audit event dictionaries
            
        Returns:
            2D numpy array where each row is a feature vector
        """
        # Update cache once for the batch
        await self._update_cache_if_needed()
        
        historical_context = {
            'event_type_frequencies': self._event_type_frequencies,
            'user_activity_stats': self._user_activity_stats,
            'entity_access_patterns': self._entity_access_patterns
        }
        
        # Extract features for each event
        feature_vectors = []
        for event in events:
            features = await self.extract_features(event, historical_context)
            feature_vectors.append(features)
        
        return np.array(feature_vectors)
