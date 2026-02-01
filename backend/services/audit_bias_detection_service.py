"""
Audit Bias Detection Service

This service tracks anomaly detection rates across different demographic dimensions
(user role, department, entity type) and detects potential bias in AI model predictions.
It also provides functionality for balanced dataset preparation and AI prediction logging.

Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID, uuid4
import json
import logging
from dataclasses import dataclass
from collections import defaultdict

import numpy as np
from sklearn.utils import resample

from config.database import supabase


@dataclass
class BiasMetric:
    """Data class for bias metrics."""
    id: UUID
    tenant_id: UUID
    metric_type: str
    dimension: str
    dimension_value: str
    metric_value: float
    sample_size: int
    calculation_date: datetime
    time_period_start: datetime
    time_period_end: datetime
    is_biased: bool
    bias_threshold_exceeded: Optional[float]


@dataclass
class BiasAlert:
    """Data class for bias alerts."""
    id: UUID
    tenant_id: UUID
    dimension: str
    max_rate: float
    min_rate: float
    variance: float
    threshold: float
    affected_groups: List[Dict[str, Any]]
    detection_timestamp: datetime


@dataclass
class AIPredictionLog:
    """Data class for AI prediction logging."""
    id: UUID
    audit_event_id: UUID
    prediction_type: str
    predicted_value: str
    confidence_score: float
    model_version: str
    features_used: Dict[str, Any]
    prediction_timestamp: datetime
    review_required: bool
    tenant_id: UUID


class AuditBiasDetectionService:
    """
    Service for detecting and tracking bias in AI audit analysis.
    
    This service monitors anomaly detection rates across different demographic
    dimensions and flags potential bias when variance exceeds thresholds.
    """
    
    # Bias detection threshold (20% variance)
    BIAS_THRESHOLD = 0.20
    
    # Low confidence threshold for review flagging
    LOW_CONFIDENCE_THRESHOLD = 0.6
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or supabase
        self.logger = logging.getLogger(__name__)
    
    async def track_anomaly_detection_rates(
        self,
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID] = None
    ) -> List[BiasMetric]:
        """
        Track anomaly detection rates by user role, department, and entity type.
        
        This method calculates the rate of anomaly detection for different
        demographic groups and stores the metrics for bias analysis.
        
        Args:
            start_time: Start of analysis period
            end_time: End of analysis period
            tenant_id: Optional tenant ID for multi-tenant filtering
            
        Returns:
            List of BiasMetric objects with calculated rates
            
        Requirements: 8.1
        """
        try:
            self.logger.info(
                f"Tracking anomaly detection rates from {start_time} to {end_time}"
            )
            
            # Fetch all audit events in time range
            query = self.supabase.table("audit_logs").select("*")
            query = query.gte("timestamp", start_time.isoformat())
            query = query.lte("timestamp", end_time.isoformat())
            
            if tenant_id:
                query = query.eq("tenant_id", str(tenant_id))
            
            response = query.execute()
            events = response.data if response.data else []
            
            if not events:
                self.logger.warning("No events found in time range")
                return []
            
            self.logger.info(f"Analyzing {len(events)} events for bias metrics")
            
            # Calculate rates by different dimensions
            metrics = []
            
            # 1. Track by entity type
            entity_metrics = await self._calculate_rates_by_dimension(
                events, 'entity_type', 'entity_type',
                start_time, end_time, tenant_id
            )
            metrics.extend(entity_metrics)
            
            # 2. Track by user role (if available in action_details)
            user_role_metrics = await self._calculate_rates_by_user_role(
                events, start_time, end_time, tenant_id
            )
            metrics.extend(user_role_metrics)
            
            # 3. Track by department (if available in action_details)
            department_metrics = await self._calculate_rates_by_department(
                events, start_time, end_time, tenant_id
            )
            metrics.extend(department_metrics)
            
            # Store metrics in database
            await self._store_bias_metrics(metrics)
            
            self.logger.info(f"Tracked {len(metrics)} bias metrics")
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Failed to track anomaly detection rates: {str(e)}")
            return []
    
    async def _calculate_rates_by_dimension(
        self,
        events: List[Dict[str, Any]],
        dimension_name: str,
        field_name: str,
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID]
    ) -> List[BiasMetric]:
        """
        Calculate anomaly detection rates for a specific dimension.
        
        Args:
            events: List of audit events
            dimension_name: Name of dimension (e.g., 'entity_type')
            field_name: Field name in event dict
            start_time: Start of analysis period
            end_time: End of analysis period
            tenant_id: Optional tenant ID
            
        Returns:
            List of BiasMetric objects
        """
        # Group events by dimension value
        dimension_groups = defaultdict(lambda: {'total': 0, 'anomalies': 0})
        
        for event in events:
            dimension_value = event.get(field_name, 'unknown')
            if not dimension_value:
                dimension_value = 'unknown'
            
            dimension_groups[dimension_value]['total'] += 1
            
            if event.get('is_anomaly', False):
                dimension_groups[dimension_value]['anomalies'] += 1
        
        # Calculate rates and create metrics
        metrics = []
        
        for dimension_value, counts in dimension_groups.items():
            if counts['total'] > 0:
                rate = counts['anomalies'] / counts['total']
                
                metric = BiasMetric(
                    id=uuid4(),
                    tenant_id=tenant_id or UUID('00000000-0000-0000-0000-000000000000'),
                    metric_type='anomaly_detection_rate',
                    dimension=dimension_name,
                    dimension_value=str(dimension_value),
                    metric_value=rate,
                    sample_size=counts['total'],
                    calculation_date=datetime.now(),
                    time_period_start=start_time,
                    time_period_end=end_time,
                    is_biased=False,  # Will be set by bias detection
                    bias_threshold_exceeded=None
                )
                
                metrics.append(metric)
        
        return metrics
    
    async def _calculate_rates_by_user_role(
        self,
        events: List[Dict[str, Any]],
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID]
    ) -> List[BiasMetric]:
        """
        Calculate anomaly detection rates by user role.
        
        Extracts user role from action_details if available.
        """
        # Group events by user role
        role_groups = defaultdict(lambda: {'total': 0, 'anomalies': 0})
        
        for event in events:
            # Try to extract role from action_details
            action_details = event.get('action_details', {})
            if isinstance(action_details, str):
                try:
                    action_details = json.loads(action_details)
                except:
                    action_details = {}
            
            user_role = action_details.get('user_role', 'unknown')
            if not user_role or user_role == '':
                user_role = 'unknown'
            
            role_groups[user_role]['total'] += 1
            
            if event.get('is_anomaly', False):
                role_groups[user_role]['anomalies'] += 1
        
        # Calculate rates and create metrics
        metrics = []
        
        for role, counts in role_groups.items():
            if counts['total'] > 0:
                rate = counts['anomalies'] / counts['total']
                
                metric = BiasMetric(
                    id=uuid4(),
                    tenant_id=tenant_id or UUID('00000000-0000-0000-0000-000000000000'),
                    metric_type='anomaly_detection_rate',
                    dimension='user_role',
                    dimension_value=str(role),
                    metric_value=rate,
                    sample_size=counts['total'],
                    calculation_date=datetime.now(),
                    time_period_start=start_time,
                    time_period_end=end_time,
                    is_biased=False,
                    bias_threshold_exceeded=None
                )
                
                metrics.append(metric)
        
        return metrics
    
    async def _calculate_rates_by_department(
        self,
        events: List[Dict[str, Any]],
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID]
    ) -> List[BiasMetric]:
        """
        Calculate anomaly detection rates by department.
        
        Extracts department from action_details if available.
        """
        # Group events by department
        dept_groups = defaultdict(lambda: {'total': 0, 'anomalies': 0})
        
        for event in events:
            # Try to extract department from action_details
            action_details = event.get('action_details', {})
            if isinstance(action_details, str):
                try:
                    action_details = json.loads(action_details)
                except:
                    action_details = {}
            
            department = action_details.get('department', 'unknown')
            if not department or department == '':
                department = 'unknown'
            
            dept_groups[department]['total'] += 1
            
            if event.get('is_anomaly', False):
                dept_groups[department]['anomalies'] += 1
        
        # Calculate rates and create metrics
        metrics = []
        
        for dept, counts in dept_groups.items():
            if counts['total'] > 0:
                rate = counts['anomalies'] / counts['total']
                
                metric = BiasMetric(
                    id=uuid4(),
                    tenant_id=tenant_id or UUID('00000000-0000-0000-0000-000000000000'),
                    metric_type='anomaly_detection_rate',
                    dimension='department',
                    dimension_value=str(dept),
                    metric_value=rate,
                    sample_size=counts['total'],
                    calculation_date=datetime.now(),
                    time_period_start=start_time,
                    time_period_end=end_time,
                    is_biased=False,
                    bias_threshold_exceeded=None
                )
                
                metrics.append(metric)
        
        return metrics
    
    async def _store_bias_metrics(self, metrics: List[BiasMetric]):
        """
        Store bias metrics in database.
        
        Args:
            metrics: List of BiasMetric objects to store
        """
        try:
            for metric in metrics:
                metric_record = {
                    "id": str(metric.id),
                    "tenant_id": str(metric.tenant_id),
                    "metric_type": metric.metric_type,
                    "dimension": metric.dimension,
                    "dimension_value": metric.dimension_value,
                    "metric_value": metric.metric_value,
                    "sample_size": metric.sample_size,
                    "calculation_date": metric.calculation_date.isoformat(),
                    "time_period_start": metric.time_period_start.isoformat(),
                    "time_period_end": metric.time_period_end.isoformat(),
                    "is_biased": metric.is_biased,
                    "bias_threshold_exceeded": metric.bias_threshold_exceeded
                }
                
                self.supabase.table("audit_bias_metrics").insert(metric_record).execute()
            
            self.logger.info(f"Stored {len(metrics)} bias metrics in database")
            
        except Exception as e:
            self.logger.error(f"Failed to store bias metrics: {str(e)}")
    
    async def detect_bias(
        self,
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID] = None
    ) -> List[BiasAlert]:
        """
        Detect bias in anomaly detection rates across demographic groups.
        
        Calculates variance in detection rates and flags bias when variance
        exceeds 20% threshold.
        
        Args:
            start_time: Start of analysis period
            end_time: End of analysis period
            tenant_id: Optional tenant ID for multi-tenant filtering
            
        Returns:
            List of BiasAlert objects for detected bias
            
        Requirements: 8.2
        """
        try:
            self.logger.info(f"Detecting bias from {start_time} to {end_time}")
            
            # Fetch bias metrics for the time period
            query = self.supabase.table("audit_bias_metrics").select("*")
            query = query.gte("time_period_start", start_time.isoformat())
            query = query.lte("time_period_end", end_time.isoformat())
            query = query.eq("metric_type", "anomaly_detection_rate")
            
            if tenant_id:
                query = query.eq("tenant_id", str(tenant_id))
            
            response = query.execute()
            metrics = response.data if response.data else []
            
            if not metrics:
                self.logger.warning("No bias metrics found for analysis")
                return []
            
            # Group metrics by dimension
            dimension_groups = defaultdict(list)
            for metric in metrics:
                dimension = metric['dimension']
                dimension_groups[dimension].append(metric)
            
            # Detect bias in each dimension
            bias_alerts = []
            
            for dimension, dimension_metrics in dimension_groups.items():
                # Calculate variance in detection rates
                rates = [m['metric_value'] for m in dimension_metrics]
                
                if len(rates) < 2:
                    continue  # Need at least 2 groups to detect bias
                
                max_rate = max(rates)
                min_rate = min(rates)
                variance = max_rate - min_rate
                
                # Check if variance exceeds threshold
                if variance > self.BIAS_THRESHOLD:
                    # Create bias alert
                    alert = BiasAlert(
                        id=uuid4(),
                        tenant_id=tenant_id or UUID('00000000-0000-0000-0000-000000000000'),
                        dimension=dimension,
                        max_rate=max_rate,
                        min_rate=min_rate,
                        variance=variance,
                        threshold=self.BIAS_THRESHOLD,
                        affected_groups=[
                            {
                                'dimension_value': m['dimension_value'],
                                'rate': m['metric_value'],
                                'sample_size': m['sample_size']
                            }
                            for m in dimension_metrics
                        ],
                        detection_timestamp=datetime.now()
                    )
                    
                    bias_alerts.append(alert)
                    
                    # Update metrics to mark as biased
                    await self._mark_metrics_as_biased(
                        dimension_metrics, variance - self.BIAS_THRESHOLD
                    )
                    
                    self.logger.warning(
                        f"Bias detected in dimension '{dimension}': "
                        f"variance={variance:.2%} (threshold={self.BIAS_THRESHOLD:.2%})"
                    )
            
            self.logger.info(f"Detected {len(bias_alerts)} bias alerts")
            
            return bias_alerts
            
        except Exception as e:
            self.logger.error(f"Bias detection failed: {str(e)}")
            return []
    
    async def _mark_metrics_as_biased(
        self,
        metrics: List[Dict[str, Any]],
        threshold_exceeded: float
    ):
        """
        Mark bias metrics as biased in database.
        
        Args:
            metrics: List of metric records
            threshold_exceeded: Amount by which threshold was exceeded
        """
        try:
            for metric in metrics:
                self.supabase.table("audit_bias_metrics").update({
                    "is_biased": True,
                    "bias_threshold_exceeded": threshold_exceeded
                }).eq("id", metric['id']).execute()
            
        except Exception as e:
            self.logger.error(f"Failed to mark metrics as biased: {str(e)}")
    
    async def prepare_balanced_dataset(
        self,
        events: List[Dict[str, Any]],
        category_field: str = 'category'
    ) -> List[Dict[str, Any]]:
        """
        Prepare balanced dataset for model training.
        
        Ensures equal representation across all categories by resampling.
        Uses sklearn's resample with replacement for minority classes.
        
        Args:
            events: List of audit events
            category_field: Field name containing category labels
            
        Returns:
            Balanced dataset with equal representation across categories
            
        Requirements: 8.4
        """
        try:
            if not events:
                return []
            
            # Group events by category
            category_groups = defaultdict(list)
            for event in events:
                category = event.get(category_field, 'unknown')
                if category:
                    category_groups[category].append(event)
            
            if not category_groups:
                return events
            
            # Find target size (max category size)
            target_size = max(len(group) for group in category_groups.values())
            
            self.logger.info(
                f"Balancing dataset: {len(category_groups)} categories, "
                f"target size={target_size} per category"
            )
            
            # Resample each category to target size
            balanced_events = []
            
            for category, group_events in category_groups.items():
                if len(group_events) < target_size:
                    # Upsample minority class
                    resampled = resample(
                        group_events,
                        n_samples=target_size,
                        replace=True,
                        random_state=42
                    )
                    balanced_events.extend(resampled)
                    
                    self.logger.debug(
                        f"Upsampled category '{category}': "
                        f"{len(group_events)} -> {target_size}"
                    )
                else:
                    # Keep majority class as is (or downsample if needed)
                    balanced_events.extend(group_events[:target_size])
            
            # Shuffle the balanced dataset
            np.random.seed(42)
            np.random.shuffle(balanced_events)
            
            self.logger.info(
                f"Created balanced dataset: {len(balanced_events)} events "
                f"({target_size} per category)"
            )
            
            return balanced_events
            
        except Exception as e:
            self.logger.error(f"Dataset balancing failed: {str(e)}")
            return events  # Return original dataset on error
    
    async def log_ai_prediction(
        self,
        audit_event_id: UUID,
        prediction_type: str,
        predicted_value: str,
        confidence_score: float,
        model_version: str,
        features_used: Dict[str, Any],
        tenant_id: UUID
    ) -> AIPredictionLog:
        """
        Log AI model prediction with confidence score.
        
        Automatically sets review_required flag if confidence < 0.6.
        
        Args:
            audit_event_id: ID of audit event being predicted
            prediction_type: Type of prediction ('anomaly', 'category', 'risk_level')
            predicted_value: Predicted value
            confidence_score: Model confidence (0-1)
            model_version: Version of model used
            features_used: Features used for prediction
            tenant_id: Tenant ID
            
        Returns:
            AIPredictionLog object
            
        Requirements: 8.5, 8.6
        """
        try:
            # Determine if review is required (confidence < 0.6)
            review_required = confidence_score < self.LOW_CONFIDENCE_THRESHOLD
            
            # Create prediction log
            prediction_log = AIPredictionLog(
                id=uuid4(),
                audit_event_id=audit_event_id,
                prediction_type=prediction_type,
                predicted_value=predicted_value,
                confidence_score=confidence_score,
                model_version=model_version,
                features_used=features_used,
                prediction_timestamp=datetime.now(),
                review_required=review_required,
                tenant_id=tenant_id
            )
            
            # Store in database
            prediction_record = {
                "id": str(prediction_log.id),
                "audit_event_id": str(prediction_log.audit_event_id),
                "prediction_type": prediction_log.prediction_type,
                "predicted_value": prediction_log.predicted_value,
                "confidence_score": prediction_log.confidence_score,
                "model_version": prediction_log.model_version,
                "features_used": json.dumps(prediction_log.features_used),
                "prediction_timestamp": prediction_log.prediction_timestamp.isoformat(),
                "review_required": prediction_log.review_required,
                "tenant_id": str(prediction_log.tenant_id)
            }
            
            self.supabase.table("audit_ai_predictions").insert(prediction_record).execute()
            
            if review_required:
                self.logger.warning(
                    f"Low confidence prediction flagged for review: "
                    f"type={prediction_type}, confidence={confidence_score:.2f}"
                )
            
            return prediction_log
            
        except Exception as e:
            self.logger.error(f"Failed to log AI prediction: {str(e)}")
            return None
    
    async def generate_anomaly_explanation(
        self,
        anomaly_id: UUID,
        feature_importance: Dict[str, float],
        top_n: int = 5
    ) -> Dict[str, Any]:
        """
        Generate human-readable explanation for anomaly detection.
        
        Uses feature importance scores to identify top contributing features
        and generates natural language explanation.
        
        Args:
            anomaly_id: ID of anomaly detection
            feature_importance: Dictionary of feature names to importance scores
            top_n: Number of top features to include in explanation
            
        Returns:
            Dictionary with explanation and top features
            
        Requirements: 8.7
        """
        try:
            # Sort features by importance
            sorted_features = sorted(
                feature_importance.items(),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:top_n]
            
            # Generate explanation
            explanation_parts = [
                "This event was flagged as anomalous based on the following factors:"
            ]
            
            for i, (feature_name, importance) in enumerate(sorted_features, 1):
                # Convert feature name to human-readable format
                readable_name = self._make_feature_readable(feature_name)
                
                # Determine if feature contributed positively or negatively
                direction = "unusual" if importance > 0 else "typical"
                
                explanation_parts.append(
                    f"{i}. {readable_name} was {direction} "
                    f"(importance: {abs(importance):.2f})"
                )
            
            explanation_text = "\n".join(explanation_parts)
            
            # Create explanation record
            explanation = {
                "anomaly_id": str(anomaly_id),
                "explanation_text": explanation_text,
                "top_features": [
                    {
                        "feature": feature,
                        "importance": importance,
                        "readable_name": self._make_feature_readable(feature)
                    }
                    for feature, importance in sorted_features
                ],
                "generated_at": datetime.now().isoformat()
            }
            
            self.logger.info(f"Generated explanation for anomaly {anomaly_id}")
            
            return explanation
            
        except Exception as e:
            self.logger.error(f"Failed to generate anomaly explanation: {str(e)}")
            return {
                "anomaly_id": str(anomaly_id),
                "explanation_text": "Unable to generate explanation",
                "top_features": [],
                "error": str(e)
            }
    
    def _make_feature_readable(self, feature_name: str) -> str:
        """
        Convert technical feature name to human-readable format.
        
        Args:
            feature_name: Technical feature name
            
        Returns:
            Human-readable feature description
        """
        # Map common feature names to readable descriptions
        feature_map = {
            'event_frequency': 'Event frequency',
            'time_of_day': 'Time of day',
            'day_of_week': 'Day of week',
            'user_activity_level': 'User activity level',
            'entity_access_pattern': 'Entity access pattern',
            'action_complexity': 'Action complexity',
            'execution_time': 'Execution time',
            'severity_score': 'Severity level'
        }
        
        return feature_map.get(feature_name, feature_name.replace('_', ' ').title())


# Global bias detection service instance
bias_detection_service = AuditBiasDetectionService()
