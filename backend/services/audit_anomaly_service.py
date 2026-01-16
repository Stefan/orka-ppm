"""
Audit Anomaly Detection Service

This service detects anomalies in audit logs using Isolation Forest algorithm.
It provides methods for training models, detecting anomalies, computing anomaly scores,
and generating alerts for detected anomalies.

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID, uuid4
import json
import logging
import pickle
import os
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from config.database import supabase
from services.audit_feature_extractor import AuditFeatureExtractor


@dataclass
class AnomalyDetection:
    """Data class for anomaly detection results."""
    id: UUID
    audit_event_id: UUID
    audit_event: Dict[str, Any]
    anomaly_score: float
    detection_timestamp: datetime
    features_used: Dict[str, Any]
    model_version: str
    is_false_positive: bool
    feedback_notes: Optional[str]
    alert_sent: bool
    severity_level: str
    affected_entities: List[str]
    suggested_actions: List[str]


@dataclass
class ModelMetrics:
    """Data class for model training metrics."""
    model_version: str
    training_date: datetime
    training_data_size: int
    contamination: float
    n_estimators: int
    anomaly_threshold: float


class AuditAnomalyService:
    """
    Detects anomalies in audit logs using Isolation Forest.
    
    This service uses machine learning to identify unusual patterns in audit events
    that may indicate security threats, system issues, or compliance violations.
    """
    
    def __init__(self, supabase_client=None, redis_client=None):
        self.supabase = supabase_client or supabase
        self.redis = redis_client
        self.logger = logging.getLogger(__name__)
        
        # Initialize Isolation Forest model
        self.model = IsolationForest(
            contamination=0.1,  # Expect 10% of data to be anomalies
            random_state=42,
            n_estimators=100,
            max_samples='auto',
            max_features=1.0,
            bootstrap=False,
            n_jobs=-1,  # Use all CPU cores
            verbose=0
        )
        
        # Feature extractor
        self.feature_extractor = AuditFeatureExtractor(supabase_client=self.supabase)
        
        # Scaler for feature normalization
        self.scaler = StandardScaler()
        
        # Model metadata
        self.model_version = "1.0.0"
        self.is_trained = False
        self.anomaly_threshold = 0.7
        
        # Model persistence path
        self.model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        os.makedirs(self.model_dir, exist_ok=True)
    
    async def detect_anomalies(
        self,
        start_time: datetime,
        end_time: datetime,
        tenant_id: Optional[UUID] = None
    ) -> List[AnomalyDetection]:
        """
        Detect anomalies in audit events within time range.
        
        Args:
            start_time: Start of time range to analyze
            end_time: End of time range to analyze
            tenant_id: Optional tenant ID for multi-tenant filtering
            
        Returns:
            List of detected anomalies with scores and details
        """
        try:
            # Fetch audit events in time range
            query = self.supabase.table("roche_audit_logs").select("*")
            query = query.gte("timestamp", start_time.isoformat())
            query = query.lte("timestamp", end_time.isoformat())
            
            if tenant_id:
                query = query.eq("tenant_id", str(tenant_id))
            
            response = query.execute()
            events = response.data if response.data else []
            
            if not events:
                self.logger.info(f"No events found in time range {start_time} to {end_time}")
                return []
            
            self.logger.info(f"Analyzing {len(events)} events for anomalies")
            
            # Extract features for all events
            feature_matrix = await self.feature_extractor.extract_batch_features(events)
            
            # Ensure model is trained
            if not self.is_trained:
                self.logger.warning("Model not trained, training on current data")
                await self.train_model(events)
            
            # Predict anomaly scores
            anomaly_scores = self._compute_anomaly_scores_batch(feature_matrix)
            
            # Identify anomalies (score > threshold)
            anomalies = []
            for i, (event, score) in enumerate(zip(events, anomaly_scores)):
                if score > self.anomaly_threshold:
                    # Create anomaly detection record
                    anomaly = await self._create_anomaly_detection(
                        event=event,
                        anomaly_score=float(score),
                        features=feature_matrix[i]
                    )
                    anomalies.append(anomaly)
                    
                    # Update event with anomaly flag
                    await self._update_event_anomaly_status(
                        event_id=event['id'],
                        anomaly_score=float(score),
                        is_anomaly=True
                    )
            
            self.logger.info(f"Detected {len(anomalies)} anomalies out of {len(events)} events")
            
            return anomalies
            
        except Exception as e:
            self.logger.error(f"Anomaly detection failed: {str(e)}")
            return []
    
    async def compute_anomaly_score(self, event: Dict[str, Any]) -> float:
        """
        Compute anomaly score for a single event.
        
        Args:
            event: Audit event dictionary
            
        Returns:
            Anomaly score between 0 and 1 (higher = more anomalous)
        """
        try:
            # Extract features
            features = await self.feature_extractor.extract_features(event)
            
            # Ensure model is trained
            if not self.is_trained:
                self.logger.warning("Model not trained, returning default score")
                return 0.0
            
            # Compute anomaly score
            score = self._compute_anomaly_scores_batch(features.reshape(1, -1))[0]
            
            return float(score)
            
        except Exception as e:
            self.logger.error(f"Failed to compute anomaly score: {str(e)}")
            return 0.0
    
    def _compute_anomaly_scores_batch(self, feature_matrix: np.ndarray) -> np.ndarray:
        """
        Compute anomaly scores for a batch of feature vectors.
        
        Args:
            feature_matrix: 2D array of feature vectors
            
        Returns:
            Array of anomaly scores (0-1 range)
        """
        # Scale features
        if hasattr(self.scaler, 'mean_'):
            features_scaled = self.scaler.transform(feature_matrix)
        else:
            features_scaled = feature_matrix
        
        # Get anomaly scores from Isolation Forest
        # score_samples returns negative scores (more negative = more anomalous)
        raw_scores = self.model.score_samples(features_scaled)
        
        # Convert to 0-1 range (higher = more anomalous)
        # Normalize using min-max scaling
        min_score = raw_scores.min()
        max_score = raw_scores.max()
        
        if max_score - min_score > 0:
            normalized_scores = 1.0 - (raw_scores - min_score) / (max_score - min_score)
        else:
            normalized_scores = np.zeros_like(raw_scores)
        
        return normalized_scores
    
    async def train_model(
        self,
        training_data: Optional[List[Dict[str, Any]]] = None,
        days_of_history: int = 30
    ) -> ModelMetrics:
        """
        Train Isolation Forest model on historical audit data.
        
        Args:
            training_data: Optional list of audit events to train on
            days_of_history: Number of days of historical data to use if training_data not provided
            
        Returns:
            Training metrics
        """
        try:
            # Fetch training data if not provided
            if training_data is None:
                start_date = datetime.now() - timedelta(days=days_of_history)
                
                response = self.supabase.table("roche_audit_logs").select("*").gte(
                    "timestamp", start_date.isoformat()
                ).limit(10000).execute()
                
                training_data = response.data if response.data else []
            
            if not training_data:
                self.logger.error("No training data available")
                return None
            
            self.logger.info(f"Training model on {len(training_data)} events")
            
            # Extract features
            feature_matrix = await self.feature_extractor.extract_batch_features(training_data)
            
            # Fit scaler
            self.scaler.fit(feature_matrix)
            features_scaled = self.scaler.transform(feature_matrix)
            
            # Train Isolation Forest
            self.model.fit(features_scaled)
            self.is_trained = True
            
            # Save model
            await self._save_model()
            
            # Create metrics
            metrics = ModelMetrics(
                model_version=self.model_version,
                training_date=datetime.now(),
                training_data_size=len(training_data),
                contamination=0.1,
                n_estimators=100,
                anomaly_threshold=self.anomaly_threshold
            )
            
            # Store model metadata in database
            await self._store_model_metadata(metrics)
            
            self.logger.info(f"Model training completed: version {self.model_version}")
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Model training failed: {str(e)}")
            return None
    
    async def _create_anomaly_detection(
        self,
        event: Dict[str, Any],
        anomaly_score: float,
        features: np.ndarray
    ) -> AnomalyDetection:
        """
        Create anomaly detection record.
        
        Args:
            event: Audit event that triggered anomaly
            anomaly_score: Computed anomaly score
            features: Feature vector used for detection
            
        Returns:
            AnomalyDetection object
        """
        # Determine severity level based on score and event severity
        severity_level = self._determine_severity_level(anomaly_score, event)
        
        # Identify affected entities
        affected_entities = self._identify_affected_entities(event)
        
        # Generate suggested actions
        suggested_actions = self._generate_suggested_actions(event, anomaly_score)
        
        # Create anomaly record
        anomaly_id = uuid4()
        anomaly_record = {
            "id": str(anomaly_id),
            "audit_event_id": event['id'],
            "anomaly_score": anomaly_score,
            "detection_timestamp": datetime.now().isoformat(),
            "features_used": json.dumps({
                "feature_vector": features.tolist(),
                "feature_dimension": len(features)
            }),
            "model_version": self.model_version,
            "is_false_positive": False,
            "feedback_notes": None,
            "feedback_user_id": None,
            "feedback_timestamp": None,
            "alert_sent": False,
            "tenant_id": event.get('tenant_id')
        }
        
        # Store in database
        try:
            self.supabase.table("audit_anomalies").insert(anomaly_record).execute()
        except Exception as e:
            self.logger.error(f"Failed to store anomaly record: {str(e)}")
        
        # Create AnomalyDetection object
        anomaly = AnomalyDetection(
            id=anomaly_id,
            audit_event_id=UUID(event['id']),
            audit_event=event,
            anomaly_score=anomaly_score,
            detection_timestamp=datetime.now(),
            features_used={"feature_vector": features.tolist()},
            model_version=self.model_version,
            is_false_positive=False,
            feedback_notes=None,
            alert_sent=False,
            severity_level=severity_level,
            affected_entities=affected_entities,
            suggested_actions=suggested_actions
        )
        
        return anomaly
    
    async def generate_alert(
        self,
        anomaly: AnomalyDetection
    ) -> Dict[str, Any]:
        """
        Generate alert for detected anomaly.
        
        This method creates an alert record with severity level, event details,
        and anomaly score. The alert can then be sent via notification channels.
        
        Args:
            anomaly: AnomalyDetection object
            
        Returns:
            Alert dictionary with all relevant information
        """
        try:
            # Create alert record
            alert = {
                "id": str(uuid4()),
                "anomaly_id": str(anomaly.id),
                "audit_event_id": str(anomaly.audit_event_id),
                "severity_level": anomaly.severity_level,
                "anomaly_score": anomaly.anomaly_score,
                "detection_timestamp": anomaly.detection_timestamp.isoformat(),
                "event_type": anomaly.audit_event.get('event_type'),
                "event_details": {
                    "user_id": anomaly.audit_event.get('user_id'),
                    "entity_type": anomaly.audit_event.get('entity_type'),
                    "entity_id": anomaly.audit_event.get('entity_id'),
                    "action_details": anomaly.audit_event.get('action_details'),
                    "timestamp": anomaly.audit_event.get('timestamp'),
                    "severity": anomaly.audit_event.get('severity')
                },
                "affected_entities": anomaly.affected_entities,
                "suggested_actions": anomaly.suggested_actions,
                "model_version": anomaly.model_version,
                "tenant_id": anomaly.audit_event.get('tenant_id')
            }
            
            # Mark alert as sent in anomaly record
            try:
                self.supabase.table("audit_anomalies").update({
                    "alert_sent": True
                }).eq("id", str(anomaly.id)).execute()
            except Exception as e:
                self.logger.error(f"Failed to update alert_sent status: {str(e)}")
            
            self.logger.info(
                f"Generated alert for anomaly {anomaly.id} with severity {anomaly.severity_level}"
            )
            
            return alert
            
        except Exception as e:
            self.logger.error(f"Failed to generate alert: {str(e)}")
            return None
    
    def _determine_severity_level(
        self,
        anomaly_score: float,
        event: Dict[str, Any]
    ) -> str:
        """
        Determine severity level for anomaly.
        
        Args:
            anomaly_score: Computed anomaly score
            event: Audit event
            
        Returns:
            Severity level: 'Low', 'Medium', 'High', or 'Critical'
        """
        event_severity = event.get('severity', 'info').lower()
        
        # Critical if high anomaly score and critical event
        if anomaly_score > 0.9 and event_severity == 'critical':
            return 'Critical'
        
        # High if high anomaly score or critical/error event
        if anomaly_score > 0.85 or event_severity in ['critical', 'error']:
            return 'High'
        
        # Medium if moderate anomaly score or warning event
        if anomaly_score > 0.75 or event_severity == 'warning':
            return 'Medium'
        
        # Low otherwise
        return 'Low'
    
    def _identify_affected_entities(self, event: Dict[str, Any]) -> List[str]:
        """
        Identify entities affected by anomalous event.
        
        Args:
            event: Audit event
            
        Returns:
            List of affected entity descriptions
        """
        affected = []
        
        entity_type = event.get('entity_type')
        entity_id = event.get('entity_id')
        
        if entity_type and entity_id:
            affected.append(f"{entity_type}:{entity_id}")
        
        # Check for project involvement
        project_id = event.get('project_id')
        if project_id:
            affected.append(f"project:{project_id}")
        
        # Check for user involvement
        user_id = event.get('user_id')
        if user_id:
            affected.append(f"user:{user_id}")
        
        return affected
    
    def _generate_suggested_actions(
        self,
        event: Dict[str, Any],
        anomaly_score: float
    ) -> List[str]:
        """
        Generate suggested actions for responding to anomaly.
        
        Args:
            event: Audit event
            anomaly_score: Computed anomaly score
            
        Returns:
            List of suggested action descriptions
        """
        actions = []
        
        event_type = event.get('event_type', '')
        severity = event.get('severity', 'info').lower()
        
        # High score suggestions
        if anomaly_score > 0.9:
            actions.append("Immediately review this event for potential security threat")
            actions.append("Contact user to verify legitimacy of action")
        
        # Security-related suggestions
        if 'permission' in event_type or 'access' in event_type or severity == 'critical':
            actions.append("Review user permissions and access logs")
            actions.append("Check for unauthorized access attempts")
        
        # Financial-related suggestions
        if 'budget' in event_type or 'cost' in event_type:
            actions.append("Verify budget change authorization")
            actions.append("Review financial approval workflow")
        
        # General suggestions
        actions.append("Mark as false positive if this is expected behavior")
        actions.append("Add to training data to improve future detection")
        
        return actions
    
    async def _update_event_anomaly_status(
        self,
        event_id: str,
        anomaly_score: float,
        is_anomaly: bool
    ):
        """
        Update audit event with anomaly detection results.
        
        Args:
            event_id: ID of audit event
            anomaly_score: Computed anomaly score
            is_anomaly: Whether event is classified as anomaly
        """
        try:
            self.supabase.table("roche_audit_logs").update({
                "anomaly_score": anomaly_score,
                "is_anomaly": is_anomaly
            }).eq("id", event_id).execute()
        except Exception as e:
            self.logger.error(f"Failed to update event anomaly status: {str(e)}")
    
    async def _save_model(self):
        """Save trained model and scaler to disk."""
        try:
            model_path = os.path.join(self.model_dir, f"anomaly_model_{self.model_version}.pkl")
            scaler_path = os.path.join(self.model_dir, f"anomaly_scaler_{self.model_version}.pkl")
            
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            self.logger.info(f"Model saved to {model_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save model: {str(e)}")
    
    async def load_model(self, model_version: Optional[str] = None):
        """
        Load trained model from disk.
        
        Args:
            model_version: Version of model to load (defaults to current version)
        """
        try:
            version = model_version or self.model_version
            model_path = os.path.join(self.model_dir, f"anomaly_model_{version}.pkl")
            scaler_path = os.path.join(self.model_dir, f"anomaly_scaler_{version}.pkl")
            
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                
                self.is_trained = True
                self.logger.info(f"Model loaded from {model_path}")
            else:
                self.logger.warning(f"Model files not found for version {version}")
                
        except Exception as e:
            self.logger.error(f"Failed to load model: {str(e)}")
    
    async def _store_model_metadata(self, metrics: ModelMetrics):
        """
        Store model metadata in database.
        
        Args:
            metrics: Model training metrics
        """
        try:
            metadata = {
                "model_type": "anomaly_detector",
                "model_version": metrics.model_version,
                "training_date": metrics.training_date.isoformat(),
                "training_data_size": metrics.training_data_size,
                "metrics": json.dumps({
                    "contamination": metrics.contamination,
                    "n_estimators": metrics.n_estimators,
                    "anomaly_threshold": metrics.anomaly_threshold
                }),
                "model_path": os.path.join(self.model_dir, f"anomaly_model_{metrics.model_version}.pkl"),
                "is_active": True,
                "tenant_id": None  # Shared model
            }
            
            self.supabase.table("audit_ml_models").insert(metadata).execute()
            
        except Exception as e:
            self.logger.error(f"Failed to store model metadata: {str(e)}")


# Global anomaly service instance
anomaly_service = AuditAnomalyService()
