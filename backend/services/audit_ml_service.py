"""
Audit ML Classification Service

This service provides machine learning-based classification for audit events,
including category classification and risk level assessment. It uses scikit-learn
classifiers trained on historical audit data.

Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.11
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID
import json
import logging
import pickle
import os
import hashlib
from dataclasses import dataclass, asdict

import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import redis.asyncio as aioredis

from config.database import supabase


@dataclass
class EventClassification:
    """Data class for event classification results."""
    category: str
    category_confidence: float
    risk_level: str
    risk_confidence: float
    tags: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for caching."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventClassification':
        """Create from dictionary (for cache retrieval)."""
        return cls(**data)


@dataclass
class TrainingMetrics:
    """Data class for model training metrics."""
    model_version: str
    training_date: datetime
    training_data_size: int
    category_accuracy: float
    category_precision: float
    category_recall: float
    category_f1: float
    risk_accuracy: float
    risk_precision: float
    risk_recall: float
    risk_f1: float


class AuditMLService:
    """
    ML service for auto-tagging and risk classification of audit events.
    
    This service uses Random Forest for category classification and
    Gradient Boosting for risk level classification. Features are extracted
    using TF-IDF vectorization and custom feature engineering.
    """
    
    # Valid categories and risk levels
    CATEGORIES = [
        'Security Change',
        'Financial Impact',
        'Resource Allocation',
        'Risk Event',
        'Compliance Action'
    ]
    
    RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical']
    
    def __init__(self, supabase_client=None, redis_url: Optional[str] = None):
        self.supabase = supabase_client or supabase
        self.logger = logging.getLogger(__name__)
        
        # Redis configuration for caching
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.redis_client: Optional[aioredis.Redis] = None
        self.redis_enabled = False
        self.cache_ttl = 3600  # 1 hour TTL for classification results
        
        # Initialize Random Forest for category classification
        self.category_classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=20,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
            class_weight='balanced'
        )
        
        # Initialize Gradient Boosting for risk level classification
        self.risk_classifier = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )
        
        # Initialize TF-IDF vectorizer for text features
        self.feature_vectorizer = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 2),
            stop_words='english',
            lowercase=True
        )
        
        # Label encoders for categories and risk levels
        self.category_encoder = LabelEncoder()
        self.category_encoder.fit(self.CATEGORIES)
        
        self.risk_encoder = LabelEncoder()
        self.risk_encoder.fit(self.RISK_LEVELS)
        
        # Model metadata
        self.model_version = "1.0.0"
        self.is_trained = False
        
        # Model persistence path
        self.model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        os.makedirs(self.model_dir, exist_ok=True)
    
    async def initialize_redis(self):
        """
        Initialize Redis connection for caching.
        
        Requirements: 7.10
        """
        try:
            self.redis_client = await aioredis.from_url(
                self.redis_url,
                encoding='utf-8',
                decode_responses=True,
                socket_connect_timeout=5
            )
            await self.redis_client.ping()
            self.redis_enabled = True
            self.logger.info("Redis caching initialized for ML classification")
        except Exception as e:
            self.logger.warning(f"Redis initialization failed: {e}. Running without cache.")
            self.redis_enabled = False
    
    def _generate_cache_key(self, event: Dict[str, Any]) -> str:
        """
        Generate cache key for an event.
        
        Uses a hash of event type, entity type, action details, and severity
        to create a unique but deterministic cache key.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Cache key string
        """
        # Create a deterministic representation of the event
        cache_data = {
            'event_type': event.get('event_type', ''),
            'entity_type': event.get('entity_type', ''),
            'severity': event.get('severity', ''),
            'action_details': json.dumps(event.get('action_details', {}), sort_keys=True)
        }
        
        # Generate hash
        cache_str = json.dumps(cache_data, sort_keys=True)
        cache_hash = hashlib.sha256(cache_str.encode()).hexdigest()[:16]
        
        return f"audit:ml:classification:{cache_hash}"
    
    async def _get_cached_classification(
        self,
        event: Dict[str, Any]
    ) -> Optional[EventClassification]:
        """
        Retrieve cached classification result.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Cached EventClassification or None if not found
            
        Requirements: 7.10
        """
        if not self.redis_enabled or not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(event)
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                classification_dict = json.loads(cached_data)
                self.logger.debug(f"Cache hit for event classification: {cache_key}")
                return EventClassification.from_dict(classification_dict)
            
            self.logger.debug(f"Cache miss for event classification: {cache_key}")
            return None
            
        except Exception as e:
            self.logger.warning(f"Cache retrieval failed: {e}")
            return None
    
    async def _cache_classification(
        self,
        event: Dict[str, Any],
        classification: EventClassification
    ):
        """
        Cache classification result with TTL.
        
        Args:
            event: Audit event dictionary
            classification: Classification result to cache
            
        Requirements: 7.10
        """
        if not self.redis_enabled or not self.redis_client:
            return
        
        try:
            cache_key = self._generate_cache_key(event)
            classification_json = json.dumps(classification.to_dict())
            
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                classification_json
            )
            
            self.logger.debug(f"Cached classification result: {cache_key} (TTL: {self.cache_ttl}s)")
            
        except Exception as e:
            self.logger.warning(f"Cache storage failed: {e}")
    
    async def invalidate_cache(self, event: Optional[Dict[str, Any]] = None):
        """
        Invalidate cached classification results.
        
        If event is provided, invalidates only that event's cache.
        If event is None, clears all classification caches.
        
        Args:
            event: Optional specific event to invalidate
            
        Requirements: 7.10
        """
        if not self.redis_enabled or not self.redis_client:
            return
        
        try:
            if event:
                # Invalidate specific event
                cache_key = self._generate_cache_key(event)
                await self.redis_client.delete(cache_key)
                self.logger.debug(f"Invalidated cache for event: {cache_key}")
            else:
                # Clear all classification caches
                pattern = "audit:ml:classification:*"
                cursor = 0
                deleted_count = 0
                
                while True:
                    cursor, keys = await self.redis_client.scan(
                        cursor=cursor,
                        match=pattern,
                        count=100
                    )
                    
                    if keys:
                        await self.redis_client.delete(*keys)
                        deleted_count += len(keys)
                    
                    if cursor == 0:
                        break
                
                self.logger.info(f"Invalidated {deleted_count} classification cache entries")
                
        except Exception as e:
            self.logger.error(f"Cache invalidation failed: {e}")
    
    async def classify_event(
        self,
        event: Dict[str, Any]
    ) -> EventClassification:
        """
        Classify audit event into category and risk level with confidence scores.
        
        Applies both ML classification and business rules for specific event types.
        Uses Redis caching with 1-hour TTL to improve performance.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            EventClassification with category, risk level, confidence scores, and tags
            
        Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 7.10
        """
        try:
            # Check cache first
            cached_result = await self._get_cached_classification(event)
            if cached_result:
                return cached_result
            
            # Extract features
            features = await self.extract_features(event)
            
            # Ensure model is trained
            if not self.is_trained:
                self.logger.warning("Model not trained, using rule-based classification")
                classification = await self._rule_based_classification(event)
                # Cache rule-based results too
                await self._cache_classification(event, classification)
                return classification
            
            # Predict category with confidence
            category_probs = self.category_classifier.predict_proba(features.reshape(1, -1))[0]
            category_idx = np.argmax(category_probs)
            category = self.category_encoder.inverse_transform([category_idx])[0]
            category_confidence = float(category_probs[category_idx])
            
            # Predict risk level with confidence
            risk_probs = self.risk_classifier.predict_proba(features.reshape(1, -1))[0]
            risk_idx = np.argmax(risk_probs)
            risk_level = self.risk_encoder.inverse_transform([risk_idx])[0]
            risk_confidence = float(risk_probs[risk_idx])
            
            # Apply business rules to override or enhance ML predictions
            category, risk_level, tags = await self._apply_business_rules(
                event, category, risk_level
            )
            
            # Create classification result
            classification = EventClassification(
                category=category,
                category_confidence=category_confidence,
                risk_level=risk_level,
                risk_confidence=risk_confidence,
                tags=tags
            )
            
            # Cache the result
            await self._cache_classification(event, classification)
            
            self.logger.debug(
                f"Classified event {event.get('id')}: "
                f"category={category} ({category_confidence:.2f}), "
                f"risk={risk_level} ({risk_confidence:.2f})"
            )
            
            return classification
            
        except Exception as e:
            self.logger.error(f"Event classification failed: {str(e)}")
            # Fallback to rule-based classification
            return await self._rule_based_classification(event)
    
    async def extract_features(
        self,
        event: Dict[str, Any]
    ) -> np.ndarray:
        """
        Extract feature vector from audit event.
        
        Features include:
        - Event type (one-hot encoded)
        - Action details keywords (TF-IDF)
        - Entity type
        - User role (if available)
        - Time features (hour, day of week)
        - Performance metrics (if available)
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Numpy array of features
            
        Requirements: 4.1
        """
        try:
            features = []
            
            # 1. Event type features (one-hot encoded)
            event_type = event.get('event_type', 'unknown')
            event_type_features = self._encode_event_type(event_type)
            features.extend(event_type_features)
            
            # 2. Action details text features (TF-IDF)
            action_text = self._extract_action_text(event)
            if hasattr(self.feature_vectorizer, 'vocabulary_'):
                text_features = self.feature_vectorizer.transform([action_text]).toarray()[0]
            else:
                # If vectorizer not fitted, use zero vector
                text_features = np.zeros(500)
            features.extend(text_features)
            
            # 3. Entity type features
            entity_type = event.get('entity_type', 'unknown')
            entity_features = self._encode_entity_type(entity_type)
            features.extend(entity_features)
            
            # 4. User role features (if available)
            user_role_features = self._extract_user_role_features(event)
            features.extend(user_role_features)
            
            # 5. Time features
            time_features = self._extract_time_features(event)
            features.extend(time_features)
            
            # 6. Performance metrics features
            performance_features = self._extract_performance_features(event)
            features.extend(performance_features)
            
            # 7. Severity features
            severity_features = self._extract_severity_features(event)
            features.extend(severity_features)
            
            # Convert to numpy array
            feature_vector = np.array(features, dtype=np.float64)
            
            # Handle any NaN or inf values
            feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=1.0, neginf=0.0)
            
            return feature_vector
            
        except Exception as e:
            self.logger.error(f"Feature extraction failed: {str(e)}")
            # Return zero vector on error
            return np.zeros(self._get_feature_dimension())
    
    def _encode_event_type(self, event_type: str) -> List[float]:
        """
        Encode event type using simple categorical encoding.
        
        Returns:
            List of binary features for common event types
        """
        common_types = [
            'user_login', 'user_logout', 'permission_change', 'access_control',
            'budget_change', 'cost_update', 'financial_approval',
            'resource_assignment', 'capacity_change', 'availability_update',
            'risk_created', 'risk_updated', 'mitigation_action',
            'report_generated', 'audit_access', 'compliance_check'
        ]
        
        return [1.0 if event_type == t else 0.0 for t in common_types]
    
    def _extract_action_text(self, event: Dict[str, Any]) -> str:
        """
        Extract text from action details for TF-IDF vectorization.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Concatenated text from action details
        """
        action_details = event.get('action_details', {})
        
        # Parse if string
        if isinstance(action_details, str):
            try:
                action_details = json.loads(action_details)
            except:
                return action_details
        
        # Extract text from all fields
        text_parts = []
        
        def extract_text_recursive(obj):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    text_parts.append(str(key))
                    extract_text_recursive(value)
            elif isinstance(obj, list):
                for item in obj:
                    extract_text_recursive(item)
            elif obj is not None:
                text_parts.append(str(obj))
        
        extract_text_recursive(action_details)
        
        return ' '.join(text_parts)
    
    def _encode_entity_type(self, entity_type: str) -> List[float]:
        """
        Encode entity type using simple categorical encoding.
        
        Returns:
            List of binary features for common entity types
        """
        common_entities = [
            'project', 'resource', 'risk', 'change_request',
            'budget', 'schedule', 'user', 'role', 'permission'
        ]
        
        return [1.0 if entity_type == t else 0.0 for t in common_entities]
    
    def _extract_user_role_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract user role features if available.
        
        Returns:
            List of role-based features
        """
        # For now, return placeholder features
        # In production, would fetch user role from database
        return [0.0, 0.0, 0.0]  # [is_admin, is_manager, is_user]
    
    def _extract_time_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract time-based features.
        
        Returns:
            [hour_normalized, day_of_week_normalized, is_weekend, is_business_hours]
        """
        timestamp_str = event.get('timestamp')
        if not timestamp_str:
            return [0.0, 0.0, 0.0, 0.0]
        
        try:
            if isinstance(timestamp_str, str):
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                timestamp = timestamp_str
            
            hour_normalized = timestamp.hour / 23.0
            day_of_week_normalized = timestamp.weekday() / 6.0
            is_weekend = 1.0 if timestamp.weekday() >= 5 else 0.0
            is_business_hours = 1.0 if (
                timestamp.weekday() < 5 and 9 <= timestamp.hour < 17
            ) else 0.0
            
            return [hour_normalized, day_of_week_normalized, is_weekend, is_business_hours]
            
        except Exception as e:
            self.logger.warning(f"Failed to parse timestamp: {str(e)}")
            return [0.0, 0.0, 0.0, 0.0]
    
    def _extract_performance_features(self, event: Dict[str, Any]) -> List[float]:
        """
        Extract performance metric features.
        
        Returns:
            [execution_time_normalized, has_performance_metrics]
        """
        performance_metrics = event.get('performance_metrics')
        
        if not performance_metrics:
            return [0.0, 0.0]
        
        if isinstance(performance_metrics, str):
            try:
                performance_metrics = json.loads(performance_metrics)
            except:
                return [0.0, 0.0]
        
        execution_time = performance_metrics.get('execution_time', 0)
        execution_time_normalized = min(execution_time / 60.0, 1.0)
        
        return [execution_time_normalized, 1.0]
    
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
    
    def _get_feature_dimension(self) -> int:
        """Get total dimension of feature vector."""
        # 16 (event type) + 500 (TF-IDF) + 9 (entity type) + 3 (user role) + 4 (time) + 2 (performance) + 1 (severity)
        return 535
    
    async def _apply_business_rules(
        self,
        event: Dict[str, Any],
        ml_category: str,
        ml_risk_level: str
    ) -> Tuple[str, str, List[str]]:
        """
        Apply business rules to override or enhance ML predictions.
        
        Business rules (applied in priority order):
        1. Budget changes > 10% of project budget → Financial Impact: High
        2. Permission/access control changes → Security Change
        3. Resource assignments/capacity changes → Resource Allocation
        4. Risk-related events → Risk Event
        5. Compliance-related events → Compliance Action
        6. Critical severity → elevate risk level to Critical (unless overridden by specific high-priority rules)
        
        Args:
            event: Audit event dictionary
            ml_category: ML-predicted category
            ml_risk_level: ML-predicted risk level
            
        Returns:
            Tuple of (final_category, final_risk_level, tags)
            
        Requirements: 4.5, 4.6, 4.7
        """
        category = ml_category
        risk_level = ml_risk_level
        tags = []
        
        event_type = event.get('event_type', '').lower()
        action_details = event.get('action_details', {})
        severity = event.get('severity', '').lower()
        
        # Parse action_details if string
        if isinstance(action_details, str):
            try:
                action_details = json.loads(action_details)
            except:
                action_details = {}
        
        # First, apply critical severity elevation as baseline
        # This can be overridden by specific high-priority rules (like budget)
        if severity == 'critical':
            risk_level = 'Critical'
        
        # Rule 1: Budget changes exceeding 10% → Financial Impact: High (HIGHEST PRIORITY)
        # This rule can override critical severity for budget-specific reasons
        if any(keyword in event_type for keyword in ['budget', 'cost', 'financial']):
            category = 'Financial Impact'
            
            # Check if budget change exceeds 10%
            budget_change_pct = action_details.get('budget_change_percentage', 0)
            if isinstance(budget_change_pct, (int, float)) and abs(budget_change_pct) > 10:
                risk_level = 'High'  # Override even critical severity for budget rules
                tags.append('Financial Impact: High')
            else:
                tags.append('Financial Impact: Medium')
            
            # Early return to prevent other rules from overriding
            return category, risk_level, tags
        
        # Rule 2: Permission or access control changes → Security Change
        # Use more specific matching to avoid overlap with resource keywords
        if any(keyword in event_type for keyword in ['permission', 'access', 'auth', 'role']) and \
           not any(keyword in event_type for keyword in ['resource', 'capacity', 'allocation']):
            category = 'Security Change'
            tags.append('Security Change')
            
            # Elevate risk if admin permissions or already critical
            if 'admin' in event_type or severity == 'critical':
                risk_level = 'Critical'  # Respect critical severity for security changes
            
            # Early return to prevent other rules from overriding
            return category, risk_level, tags
        
        # Rule 3: Resource assignments or capacity changes → Resource Allocation
        # Use more specific matching to avoid overlap with permission keywords
        # Include explicit event types that are resource-related
        is_resource_event = (
            any(keyword in event_type for keyword in ['resource', 'capacity', 'assignment', 'allocation', 'availability']) and
            not any(keyword in event_type for keyword in ['permission', 'access', 'auth', 'role'])
        )
        
        if is_resource_event:
            category = 'Resource Allocation'
            tags.append('Resource Allocation')
            
            # Respect critical severity for resource events
            if severity == 'critical':
                risk_level = 'Critical'
            
            # Early return to prevent other rules from overriding
            return category, risk_level, tags
        
        # Rule 4: Risk-related events → Risk Event
        if 'risk' in event_type:
            category = 'Risk Event'
            tags.append('Risk Event')
            
            # Respect critical severity
            if severity == 'critical':
                risk_level = 'Critical'
            
            return category, risk_level, tags
        
        # Rule 5: Compliance-related events → Compliance Action
        if any(keyword in event_type for keyword in ['audit', 'compliance', 'report', 'export']):
            category = 'Compliance Action'
            tags.append('Compliance Action')
            
            # Respect critical severity
            if severity == 'critical':
                risk_level = 'Critical'
            
            return category, risk_level, tags
        
        # If no specific rule matched, return ML predictions with critical severity respected
        return category, risk_level, tags
    
    async def _rule_based_classification(
        self,
        event: Dict[str, Any]
    ) -> EventClassification:
        """
        Fallback rule-based classification when ML model is not trained.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            EventClassification based on rules
        """
        # Use business rules with default ML predictions
        category, risk_level, tags = await self._apply_business_rules(
            event,
            ml_category='Compliance Action',  # Default category
            ml_risk_level='Low'  # Default risk level
        )
        
        return EventClassification(
            category=category,
            category_confidence=0.5,  # Low confidence for rule-based
            risk_level=risk_level,
            risk_confidence=0.5,
            tags=tags
        )

    
    async def train_classifiers(
        self,
        labeled_data: Optional[List[Dict[str, Any]]] = None,
        days_of_history: int = 90
    ) -> TrainingMetrics:
        """
        Train category and risk classifiers on labeled data.
        
        Args:
            labeled_data: Optional list of labeled audit events
            days_of_history: Number of days of historical data to use if labeled_data not provided
            
        Returns:
            Training metrics (accuracy, precision, recall, F1)
            
        Requirements: 4.11
        """
        try:
            # Fetch labeled training data if not provided
            if labeled_data is None:
                labeled_data = await self._fetch_labeled_training_data(days_of_history)
            
            if not labeled_data or len(labeled_data) < 100:
                self.logger.error(f"Insufficient training data: {len(labeled_data) if labeled_data else 0} samples")
                return None
            
            self.logger.info(f"Training classifiers on {len(labeled_data)} labeled events")
            
            # Extract features and labels
            X_features = []
            y_categories = []
            y_risks = []
            action_texts = []
            
            for event in labeled_data:
                # Extract action text for TF-IDF
                action_text = self._extract_action_text(event)
                action_texts.append(action_text)
                
                # Get labels
                category = event.get('category')
                risk_level = event.get('risk_level')
                
                if category and risk_level:
                    y_categories.append(category)
                    y_risks.append(risk_level)
            
            # Fit TF-IDF vectorizer on action texts
            self.feature_vectorizer.fit(action_texts)
            
            # Extract full feature vectors
            for event in labeled_data:
                features = await self.extract_features(event)
                X_features.append(features)
            
            X = np.array(X_features)
            y_cat = np.array(y_categories)
            y_risk = np.array(y_risks)
            
            # Encode labels
            y_cat_encoded = self.category_encoder.transform(y_cat)
            y_risk_encoded = self.risk_encoder.transform(y_risk)
            
            # Split data for validation
            X_train, X_test, y_cat_train, y_cat_test, y_risk_train, y_risk_test = train_test_split(
                X, y_cat_encoded, y_risk_encoded,
                test_size=0.2,
                random_state=42,
                stratify=y_cat_encoded
            )
            
            # Train category classifier
            self.logger.info("Training category classifier...")
            self.category_classifier.fit(X_train, y_cat_train)
            
            # Train risk classifier
            self.logger.info("Training risk classifier...")
            self.risk_classifier.fit(X_train, y_risk_train)
            
            self.is_trained = True
            
            # Calculate metrics
            cat_pred = self.category_classifier.predict(X_test)
            risk_pred = self.risk_classifier.predict(X_test)
            
            metrics = TrainingMetrics(
                model_version=self.model_version,
                training_date=datetime.now(),
                training_data_size=len(labeled_data),
                category_accuracy=accuracy_score(y_cat_test, cat_pred),
                category_precision=precision_score(y_cat_test, cat_pred, average='weighted', zero_division=0),
                category_recall=recall_score(y_cat_test, cat_pred, average='weighted', zero_division=0),
                category_f1=f1_score(y_cat_test, cat_pred, average='weighted', zero_division=0),
                risk_accuracy=accuracy_score(y_risk_test, risk_pred),
                risk_precision=precision_score(y_risk_test, risk_pred, average='weighted', zero_division=0),
                risk_recall=recall_score(y_risk_test, risk_pred, average='weighted', zero_division=0),
                risk_f1=f1_score(y_risk_test, risk_pred, average='weighted', zero_division=0)
            )
            
            # Save models
            await self._save_models()
            
            # Store model metadata in database
            await self._store_model_metadata(metrics)
            
            self.logger.info(
                f"Training completed: "
                f"Category accuracy={metrics.category_accuracy:.3f}, "
                f"Risk accuracy={metrics.risk_accuracy:.3f}"
            )
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Classifier training failed: {str(e)}")
            return None
    
    async def _fetch_labeled_training_data(
        self,
        days_of_history: int
    ) -> List[Dict[str, Any]]:
        """
        Fetch labeled audit events from database for training.
        
        Args:
            days_of_history: Number of days of historical data to fetch
            
        Returns:
            List of audit events with category and risk_level labels
        """
        try:
            start_date = datetime.now() - timedelta(days=days_of_history)
            
            # Fetch events that have been labeled (have category and risk_level)
            response = self.supabase.table("roche_audit_logs").select("*").gte(
                "timestamp", start_date.isoformat()
            ).not_.is_("category", "null").not_.is_("risk_level", "null").limit(10000).execute()
            
            labeled_data = response.data if response.data else []
            
            self.logger.info(f"Fetched {len(labeled_data)} labeled events from last {days_of_history} days")
            
            return labeled_data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch labeled training data: {str(e)}")
            return []
    
    async def _save_models(self):
        """Save trained models and vectorizer to disk."""
        try:
            category_model_path = os.path.join(
                self.model_dir, f"category_classifier_{self.model_version}.pkl"
            )
            risk_model_path = os.path.join(
                self.model_dir, f"risk_classifier_{self.model_version}.pkl"
            )
            vectorizer_path = os.path.join(
                self.model_dir, f"feature_vectorizer_{self.model_version}.pkl"
            )
            
            with open(category_model_path, 'wb') as f:
                pickle.dump(self.category_classifier, f)
            
            with open(risk_model_path, 'wb') as f:
                pickle.dump(self.risk_classifier, f)
            
            with open(vectorizer_path, 'wb') as f:
                pickle.dump(self.feature_vectorizer, f)
            
            self.logger.info(f"Models saved to {self.model_dir}")
            
        except Exception as e:
            self.logger.error(f"Failed to save models: {str(e)}")
    
    async def load_models(self, model_version: Optional[str] = None):
        """
        Load trained models from disk.
        
        Args:
            model_version: Version of models to load (defaults to current version)
        """
        try:
            version = model_version or self.model_version
            
            category_model_path = os.path.join(
                self.model_dir, f"category_classifier_{version}.pkl"
            )
            risk_model_path = os.path.join(
                self.model_dir, f"risk_classifier_{version}.pkl"
            )
            vectorizer_path = os.path.join(
                self.model_dir, f"feature_vectorizer_{version}.pkl"
            )
            
            if (os.path.exists(category_model_path) and 
                os.path.exists(risk_model_path) and 
                os.path.exists(vectorizer_path)):
                
                with open(category_model_path, 'rb') as f:
                    self.category_classifier = pickle.load(f)
                
                with open(risk_model_path, 'rb') as f:
                    self.risk_classifier = pickle.load(f)
                
                with open(vectorizer_path, 'rb') as f:
                    self.feature_vectorizer = pickle.load(f)
                
                self.is_trained = True
                self.logger.info(f"Models loaded from {self.model_dir}")
            else:
                self.logger.warning(f"Model files not found for version {version}")
                
        except Exception as e:
            self.logger.error(f"Failed to load models: {str(e)}")
    
    async def _store_model_metadata(self, metrics: TrainingMetrics):
        """
        Store model metadata in database.
        
        Args:
            metrics: Training metrics
        """
        try:
            # Store category classifier metadata
            category_metadata = {
                "model_type": "category_classifier",
                "model_version": metrics.model_version,
                "training_date": metrics.training_date.isoformat(),
                "training_data_size": metrics.training_data_size,
                "metrics": json.dumps({
                    "accuracy": metrics.category_accuracy,
                    "precision": metrics.category_precision,
                    "recall": metrics.category_recall,
                    "f1_score": metrics.category_f1
                }),
                "model_path": os.path.join(
                    self.model_dir, f"category_classifier_{metrics.model_version}.pkl"
                ),
                "is_active": True,
                "tenant_id": None  # Shared model
            }
            
            self.supabase.table("audit_ml_models").insert(category_metadata).execute()
            
            # Store risk classifier metadata
            risk_metadata = {
                "model_type": "risk_classifier",
                "model_version": metrics.model_version,
                "training_date": metrics.training_date.isoformat(),
                "training_data_size": metrics.training_data_size,
                "metrics": json.dumps({
                    "accuracy": metrics.risk_accuracy,
                    "precision": metrics.risk_precision,
                    "recall": metrics.risk_recall,
                    "f1_score": metrics.risk_f1
                }),
                "model_path": os.path.join(
                    self.model_dir, f"risk_classifier_{metrics.model_version}.pkl"
                ),
                "is_active": True,
                "tenant_id": None  # Shared model
            }
            
            self.supabase.table("audit_ml_models").insert(risk_metadata).execute()
            
            self.logger.info("Model metadata stored in database")
            
        except Exception as e:
            self.logger.error(f"Failed to store model metadata: {str(e)}")


# Global ML service instance
ml_service = AuditMLService()
