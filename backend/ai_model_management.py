"""
AI Model Management and Monitoring System
Implements comprehensive logging, performance monitoring, and A/B testing for AI agents
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import uuid
import logging
from dataclasses import dataclass, asdict
from supabase import Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelOperationType(str, Enum):
    """Types of AI model operations"""
    RAG_QUERY = "rag_query"
    RESOURCE_OPTIMIZATION = "resource_optimization"
    RISK_FORECASTING = "risk_forecasting"
    HALLUCINATION_VALIDATION = "hallucination_validation"
    CONTENT_GENERATION = "content_generation"
    SKILL_MATCHING = "skill_matching"
    CONFLICT_DETECTION = "conflict_detection"

class PerformanceStatus(str, Enum):
    """Performance status levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    DEGRADED = "degraded"
    CRITICAL = "critical"

class ABTestStatus(str, Enum):
    """A/B test status"""
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"

@dataclass
class ModelOperation:
    """Data class for AI model operations"""
    operation_id: str
    model_id: str
    operation_type: ModelOperationType
    user_id: str
    inputs: Dict[str, Any]
    outputs: Dict[str, Any]
    confidence_score: Optional[float]
    response_time_ms: int
    input_tokens: int
    output_tokens: int
    success: bool
    error_message: Optional[str]
    timestamp: datetime
    metadata: Dict[str, Any]

@dataclass
class PerformanceMetrics:
    """Data class for performance metrics"""
    model_id: str
    operation_type: ModelOperationType
    accuracy: float
    avg_response_time_ms: float
    avg_confidence_score: float
    success_rate: float
    total_operations: int
    error_rate: float
    tokens_per_second: float
    cost_per_operation: float
    user_satisfaction_score: Optional[float]
    period_start: datetime
    period_end: datetime

@dataclass
class UserFeedback:
    """Data class for user feedback"""
    feedback_id: str
    operation_id: str
    user_id: str
    rating: int  # 1-5 scale
    feedback_type: str  # 'helpful', 'accurate', 'relevant', 'fast'
    comments: Optional[str]
    timestamp: datetime
    metadata: Dict[str, Any]

@dataclass
class ABTestConfig:
    """Data class for A/B test configuration"""
    test_id: str
    test_name: str
    model_a_id: str
    model_b_id: str
    operation_type: ModelOperationType
    traffic_split: float  # 0.0 to 1.0 (percentage for model A)
    success_metrics: List[str]
    duration_days: int
    min_sample_size: int
    status: ABTestStatus
    start_date: datetime
    end_date: Optional[datetime]
    metadata: Dict[str, Any]

@dataclass
class ABTestResult:
    """Data class for A/B test results"""
    test_id: str
    model_a_metrics: PerformanceMetrics
    model_b_metrics: PerformanceMetrics
    statistical_significance: float
    winner: Optional[str]  # 'model_a', 'model_b', or None
    confidence_interval: float
    sample_size_a: int
    sample_size_b: int
    conclusion: str
    recommendations: List[str]

class AIModelManager:
    """Comprehensive AI Model Management System"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.active_ab_tests: Dict[str, ABTestConfig] = {}
        self.performance_cache: Dict[str, PerformanceMetrics] = {}
        self.cache_ttl = 300  # 5 minutes
        self.cache_timestamps: Dict[str, datetime] = {}
        
        # Performance thresholds
        self.performance_thresholds = {
            "response_time_ms": {"good": 2000, "degraded": 5000, "critical": 10000},
            "success_rate": {"excellent": 0.98, "good": 0.95, "degraded": 0.90, "critical": 0.80},
            "confidence_score": {"excellent": 0.90, "good": 0.80, "degraded": 0.70, "critical": 0.60},
            "error_rate": {"excellent": 0.02, "good": 0.05, "degraded": 0.10, "critical": 0.20}
        }
    
    async def log_model_operation(self, operation: ModelOperation) -> bool:
        """Log a model operation to the database"""
        try:
            operation_data = {
                "operation_id": operation.operation_id,
                "model_id": operation.model_id,
                "operation_type": operation.operation_type.value,
                "user_id": operation.user_id,
                "inputs": operation.inputs,
                "outputs": operation.outputs,
                "confidence_score": operation.confidence_score,
                "response_time_ms": operation.response_time_ms,
                "input_tokens": operation.input_tokens,
                "output_tokens": operation.output_tokens,
                "success": operation.success,
                "error_message": operation.error_message,
                "timestamp": operation.timestamp.isoformat(),
                "metadata": operation.metadata
            }
            
            response = self.supabase.table("ai_model_operations").insert(operation_data).execute()
            
            if response.data:
                logger.info(f"Logged operation {operation.operation_id} for model {operation.model_id}")
                
                # Update performance metrics asynchronously
                asyncio.create_task(self._update_performance_metrics(operation))
                
                # Check for performance degradation
                asyncio.create_task(self._check_performance_degradation(operation.model_id, operation.operation_type))
                
                return True
            else:
                logger.error(f"Failed to log operation {operation.operation_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error logging model operation: {e}")
            return False
    
    async def get_performance_metrics(self, model_id: str, operation_type: Optional[ModelOperationType] = None, 
                                    days: int = 7) -> PerformanceMetrics:
        """Get performance metrics for a model"""
        try:
            # Check cache first
            cache_key = f"{model_id}_{operation_type}_{days}"
            if self._is_cache_valid(cache_key):
                return self.performance_cache[cache_key]
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Build query
            query = self.supabase.table("ai_model_operations").select("*").eq("model_id", model_id).gte(
                "timestamp", start_date.isoformat()
            ).lte("timestamp", end_date.isoformat())
            
            if operation_type:
                query = query.eq("operation_type", operation_type.value)
            
            response = query.execute()
            operations = response.data or []
            
            if not operations:
                # Return default metrics if no operations found
                metrics = PerformanceMetrics(
                    model_id=model_id,
                    operation_type=operation_type or ModelOperationType.RAG_QUERY,
                    accuracy=0.0,
                    avg_response_time_ms=0.0,
                    avg_confidence_score=0.0,
                    success_rate=0.0,
                    total_operations=0,
                    error_rate=0.0,
                    tokens_per_second=0.0,
                    cost_per_operation=0.0,
                    user_satisfaction_score=None,
                    period_start=start_date,
                    period_end=end_date
                )
            else:
                # Calculate metrics
                total_ops = len(operations)
                successful_ops = [op for op in operations if op.get("success", False)]
                failed_ops = [op for op in operations if not op.get("success", False)]
                
                # Response time metrics
                response_times = [op.get("response_time_ms", 0) for op in operations if op.get("response_time_ms")]
                avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
                
                # Confidence score metrics
                confidence_scores = [op.get("confidence_score", 0) for op in operations if op.get("confidence_score")]
                avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
                
                # Token metrics
                input_tokens = sum(op.get("input_tokens", 0) for op in operations)
                output_tokens = sum(op.get("output_tokens", 0) for op in operations)
                total_tokens = input_tokens + output_tokens
                total_time_seconds = sum(response_times) / 1000 if response_times else 1
                tokens_per_second = total_tokens / total_time_seconds if total_time_seconds > 0 else 0.0
                
                # Success and error rates
                success_rate = len(successful_ops) / total_ops if total_ops > 0 else 0.0
                error_rate = len(failed_ops) / total_ops if total_ops > 0 else 0.0
                
                # Cost estimation (simplified - $0.002 per 1K tokens for GPT-4)
                cost_per_operation = (total_tokens / 1000) * 0.002 / total_ops if total_ops > 0 else 0.0
                
                # Get user satisfaction score
                user_satisfaction = await self._get_user_satisfaction_score(model_id, start_date, end_date)
                
                metrics = PerformanceMetrics(
                    model_id=model_id,
                    operation_type=operation_type or ModelOperationType.RAG_QUERY,
                    accuracy=success_rate,  # Using success rate as accuracy proxy
                    avg_response_time_ms=avg_response_time,
                    avg_confidence_score=avg_confidence,
                    success_rate=success_rate,
                    total_operations=total_ops,
                    error_rate=error_rate,
                    tokens_per_second=tokens_per_second,
                    cost_per_operation=cost_per_operation,
                    user_satisfaction_score=user_satisfaction,
                    period_start=start_date,
                    period_end=end_date
                )
            
            # Cache the metrics
            self._update_cache(cache_key, metrics)
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting performance metrics: {e}")
            # Return default metrics on error
            return PerformanceMetrics(
                model_id=model_id,
                operation_type=operation_type or ModelOperationType.RAG_QUERY,
                accuracy=0.0,
                avg_response_time_ms=0.0,
                avg_confidence_score=0.0,
                success_rate=0.0,
                total_operations=0,
                error_rate=0.0,
                tokens_per_second=0.0,
                cost_per_operation=0.0,
                user_satisfaction_score=None,
                period_start=datetime.now() - timedelta(days=days),
                period_end=datetime.now()
            )
    
    async def create_ab_test(self, config: ABTestConfig) -> bool:
        """Create a new A/B test"""
        try:
            # Validate configuration
            if config.traffic_split < 0.0 or config.traffic_split > 1.0:
                raise ValueError("Traffic split must be between 0.0 and 1.0")
            
            if config.duration_days <= 0:
                raise ValueError("Duration must be positive")
            
            # Store A/B test configuration
            test_data = {
                "test_id": config.test_id,
                "test_name": config.test_name,
                "model_a_id": config.model_a_id,
                "model_b_id": config.model_b_id,
                "operation_type": config.operation_type.value,
                "traffic_split": config.traffic_split,
                "success_metrics": config.success_metrics,
                "duration_days": config.duration_days,
                "min_sample_size": config.min_sample_size,
                "status": config.status.value,
                "start_date": config.start_date.isoformat(),
                "end_date": config.end_date.isoformat() if config.end_date else None,
                "metadata": config.metadata
            }
            
            response = self.supabase.table("ab_tests").insert(test_data).execute()
            
            if response.data:
                # Add to active tests cache
                self.active_ab_tests[config.test_id] = config
                logger.info(f"Created A/B test {config.test_id}: {config.test_name}")
                return True
            else:
                logger.error(f"Failed to create A/B test {config.test_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error creating A/B test: {e}")
            return False
    
    async def get_ab_test_assignment(self, test_id: str, user_id: str) -> Optional[str]:
        """Get A/B test assignment for a user"""
        try:
            # Check if test exists and is active
            if test_id not in self.active_ab_tests:
                await self._load_active_ab_tests()
            
            if test_id not in self.active_ab_tests:
                return None
            
            config = self.active_ab_tests[test_id]
            
            # Check if test is still active
            if config.status != ABTestStatus.ACTIVE:
                return None
            
            if config.end_date and datetime.now() > config.end_date:
                return None
            
            # Determine assignment based on user ID hash
            user_hash = hash(f"{test_id}_{user_id}") % 100
            threshold = int(config.traffic_split * 100)
            
            return config.model_a_id if user_hash < threshold else config.model_b_id
            
        except Exception as e:
            logger.error(f"Error getting A/B test assignment: {e}")
            return None
    
    async def analyze_ab_test(self, test_id: str) -> Optional[ABTestResult]:
        """Analyze A/B test results"""
        try:
            # Get test configuration
            test_response = self.supabase.table("ab_tests").select("*").eq("test_id", test_id).execute()
            if not test_response.data:
                return None
            
            test_config = test_response.data[0]
            
            # Get performance metrics for both models
            operation_type = ModelOperationType(test_config["operation_type"])
            
            model_a_metrics = await self.get_performance_metrics(
                test_config["model_a_id"], 
                operation_type,
                test_config["duration_days"]
            )
            
            model_b_metrics = await self.get_performance_metrics(
                test_config["model_b_id"], 
                operation_type,
                test_config["duration_days"]
            )
            
            # Calculate statistical significance (simplified)
            significance = self._calculate_statistical_significance(model_a_metrics, model_b_metrics)
            
            # Determine winner
            winner = self._determine_ab_test_winner(model_a_metrics, model_b_metrics, test_config["success_metrics"])
            
            # Generate recommendations
            recommendations = self._generate_ab_test_recommendations(model_a_metrics, model_b_metrics, winner)
            
            result = ABTestResult(
                test_id=test_id,
                model_a_metrics=model_a_metrics,
                model_b_metrics=model_b_metrics,
                statistical_significance=significance,
                winner=winner,
                confidence_interval=0.95,  # Standard confidence interval
                sample_size_a=model_a_metrics.total_operations,
                sample_size_b=model_b_metrics.total_operations,
                conclusion=self._generate_ab_test_conclusion(model_a_metrics, model_b_metrics, winner, significance),
                recommendations=recommendations
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing A/B test: {e}")
            return None
    
    async def capture_user_feedback(self, feedback: UserFeedback) -> bool:
        """Capture user feedback for model operations"""
        try:
            feedback_data = {
                "feedback_id": feedback.feedback_id,
                "operation_id": feedback.operation_id,
                "user_id": feedback.user_id,
                "rating": feedback.rating,
                "feedback_type": feedback.feedback_type,
                "comments": feedback.comments,
                "timestamp": feedback.timestamp.isoformat(),
                "metadata": feedback.metadata
            }
            
            response = self.supabase.table("user_feedback").insert(feedback_data).execute()
            
            if response.data:
                logger.info(f"Captured feedback {feedback.feedback_id} for operation {feedback.operation_id}")
                
                # Update user satisfaction metrics asynchronously
                asyncio.create_task(self._update_satisfaction_metrics(feedback))
                
                return True
            else:
                logger.error(f"Failed to capture feedback {feedback.feedback_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error capturing user feedback: {e}")
            return False
    
    async def alert_performance_degradation(self, model_id: str, metrics: PerformanceMetrics) -> bool:
        """Alert administrators about performance degradation"""
        try:
            # Determine performance status
            status = self._assess_performance_status(metrics)
            
            if status in [PerformanceStatus.DEGRADED, PerformanceStatus.CRITICAL]:
                # Create alert
                alert_data = {
                    "alert_id": str(uuid.uuid4()),
                    "model_id": model_id,
                    "operation_type": metrics.operation_type.value,
                    "performance_status": status.value,
                    "metrics": asdict(metrics),
                    "alert_message": self._generate_alert_message(model_id, metrics, status),
                    "severity": "high" if status == PerformanceStatus.CRITICAL else "medium",
                    "timestamp": datetime.now().isoformat(),
                    "resolved": False
                }
                
                response = self.supabase.table("performance_alerts").insert(alert_data).execute()
                
                if response.data:
                    logger.warning(f"Performance alert created for model {model_id}: {status.value}")
                    
                    # Send notification (in production, integrate with email/Slack)
                    await self._send_performance_notification(alert_data)
                    
                    return True
                else:
                    logger.error(f"Failed to create performance alert for model {model_id}")
                    return False
            
            return True  # No alert needed
            
        except Exception as e:
            logger.error(f"Error creating performance alert: {e}")
            return False
    
    async def get_model_statistics(self, days: int = 30) -> Dict[str, Any]:
        """Get comprehensive model statistics"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get all operations in the period
            response = self.supabase.table("ai_model_operations").select("*").gte(
                "timestamp", start_date.isoformat()
            ).lte("timestamp", end_date.isoformat()).execute()
            
            operations = response.data or []
            
            if not operations:
                return {
                    "total_operations": 0,
                    "unique_models": 0,
                    "operation_types": {},
                    "overall_success_rate": 0.0,
                    "avg_response_time_ms": 0.0,
                    "total_tokens": 0,
                    "estimated_cost": 0.0,
                    "period_start": start_date.isoformat(),
                    "period_end": end_date.isoformat()
                }
            
            # Calculate statistics
            total_operations = len(operations)
            unique_models = len(set(op.get("model_id") for op in operations))
            successful_operations = len([op for op in operations if op.get("success", False)])
            
            # Group by operation type
            operation_types = {}
            for op in operations:
                op_type = op.get("operation_type", "unknown")
                if op_type not in operation_types:
                    operation_types[op_type] = {"count": 0, "success_rate": 0.0}
                operation_types[op_type]["count"] += 1
            
            # Calculate success rates for each operation type
            for op_type in operation_types:
                type_ops = [op for op in operations if op.get("operation_type") == op_type]
                successful_type_ops = [op for op in type_ops if op.get("success", False)]
                operation_types[op_type]["success_rate"] = len(successful_type_ops) / len(type_ops) if type_ops else 0.0
            
            # Response time statistics
            response_times = [op.get("response_time_ms", 0) for op in operations if op.get("response_time_ms")]
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
            
            # Token statistics
            total_input_tokens = sum(op.get("input_tokens", 0) for op in operations)
            total_output_tokens = sum(op.get("output_tokens", 0) for op in operations)
            total_tokens = total_input_tokens + total_output_tokens
            
            # Cost estimation
            estimated_cost = (total_tokens / 1000) * 0.002  # $0.002 per 1K tokens
            
            return {
                "total_operations": total_operations,
                "unique_models": unique_models,
                "operation_types": operation_types,
                "overall_success_rate": successful_operations / total_operations if total_operations > 0 else 0.0,
                "avg_response_time_ms": avg_response_time,
                "total_tokens": total_tokens,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "estimated_cost": estimated_cost,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting model statistics: {e}")
            return {}
    
    # Private helper methods
    async def _update_performance_metrics(self, operation: ModelOperation):
        """Update performance metrics after an operation"""
        try:
            # Clear cache for this model
            cache_keys_to_clear = [key for key in self.performance_cache.keys() if operation.model_id in key]
            for key in cache_keys_to_clear:
                if key in self.performance_cache:
                    del self.performance_cache[key]
                if key in self.cache_timestamps:
                    del self.cache_timestamps[key]
        except Exception as e:
            logger.error(f"Error updating performance metrics: {e}")
    
    async def _check_performance_degradation(self, model_id: str, operation_type: ModelOperationType):
        """Check for performance degradation and alert if necessary"""
        try:
            metrics = await self.get_performance_metrics(model_id, operation_type, days=1)  # Check last 24 hours
            await self.alert_performance_degradation(model_id, metrics)
        except Exception as e:
            logger.error(f"Error checking performance degradation: {e}")
    
    async def _get_user_satisfaction_score(self, model_id: str, start_date: datetime, end_date: datetime) -> Optional[float]:
        """Get user satisfaction score for a model in a time period"""
        try:
            # Get feedback for operations of this model in the time period
            operations_response = self.supabase.table("ai_model_operations").select("operation_id").eq(
                "model_id", model_id
            ).gte("timestamp", start_date.isoformat()).lte("timestamp", end_date.isoformat()).execute()
            
            operation_ids = [op["operation_id"] for op in operations_response.data or []]
            
            if not operation_ids:
                return None
            
            # Get feedback for these operations
            feedback_response = self.supabase.table("user_feedback").select("rating").in_(
                "operation_id", operation_ids
            ).execute()
            
            ratings = [fb["rating"] for fb in feedback_response.data or [] if fb.get("rating")]
            
            if not ratings:
                return None
            
            return sum(ratings) / len(ratings)
            
        except Exception as e:
            logger.error(f"Error getting user satisfaction score: {e}")
            return None
    
    async def _load_active_ab_tests(self):
        """Load active A/B tests from database"""
        try:
            response = self.supabase.table("ab_tests").select("*").eq("status", ABTestStatus.ACTIVE.value).execute()
            
            for test_data in response.data or []:
                config = ABTestConfig(
                    test_id=test_data["test_id"],
                    test_name=test_data["test_name"],
                    model_a_id=test_data["model_a_id"],
                    model_b_id=test_data["model_b_id"],
                    operation_type=ModelOperationType(test_data["operation_type"]),
                    traffic_split=test_data["traffic_split"],
                    success_metrics=test_data["success_metrics"],
                    duration_days=test_data["duration_days"],
                    min_sample_size=test_data["min_sample_size"],
                    status=ABTestStatus(test_data["status"]),
                    start_date=datetime.fromisoformat(test_data["start_date"]),
                    end_date=datetime.fromisoformat(test_data["end_date"]) if test_data["end_date"] else None,
                    metadata=test_data["metadata"]
                )
                self.active_ab_tests[config.test_id] = config
                
        except Exception as e:
            logger.error(f"Error loading active A/B tests: {e}")
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is still valid"""
        if cache_key not in self.performance_cache:
            return False
        
        timestamp = self.cache_timestamps.get(cache_key)
        if not timestamp:
            return False
        
        return (datetime.now() - timestamp).total_seconds() < self.cache_ttl
    
    def _update_cache(self, cache_key: str, metrics: PerformanceMetrics):
        """Update performance metrics cache"""
        self.performance_cache[cache_key] = metrics
        self.cache_timestamps[cache_key] = datetime.now()
    
    def _assess_performance_status(self, metrics: PerformanceMetrics) -> PerformanceStatus:
        """Assess performance status based on metrics"""
        try:
            # Check multiple metrics and determine overall status
            response_time_status = self._get_metric_status("response_time_ms", metrics.avg_response_time_ms)
            success_rate_status = self._get_metric_status("success_rate", metrics.success_rate)
            confidence_status = self._get_metric_status("confidence_score", metrics.avg_confidence_score)
            error_rate_status = self._get_metric_status("error_rate", metrics.error_rate)
            
            # Determine overall status (worst case)
            statuses = [response_time_status, success_rate_status, confidence_status, error_rate_status]
            
            if PerformanceStatus.CRITICAL in statuses:
                return PerformanceStatus.CRITICAL
            elif PerformanceStatus.DEGRADED in statuses:
                return PerformanceStatus.DEGRADED
            elif PerformanceStatus.GOOD in statuses:
                return PerformanceStatus.GOOD
            else:
                return PerformanceStatus.EXCELLENT
                
        except Exception as e:
            logger.error(f"Error assessing performance status: {e}")
            return PerformanceStatus.DEGRADED
    
    def _get_metric_status(self, metric_name: str, value: float) -> PerformanceStatus:
        """Get status for a specific metric"""
        thresholds = self.performance_thresholds.get(metric_name, {})
        
        if metric_name in ["response_time_ms", "error_rate"]:
            # Lower is better
            if value <= thresholds.get("excellent", 0):
                return PerformanceStatus.EXCELLENT
            elif value <= thresholds.get("good", 0):
                return PerformanceStatus.GOOD
            elif value <= thresholds.get("degraded", 0):
                return PerformanceStatus.DEGRADED
            else:
                return PerformanceStatus.CRITICAL
        else:
            # Higher is better
            if value >= thresholds.get("excellent", 1):
                return PerformanceStatus.EXCELLENT
            elif value >= thresholds.get("good", 1):
                return PerformanceStatus.GOOD
            elif value >= thresholds.get("degraded", 1):
                return PerformanceStatus.DEGRADED
            else:
                return PerformanceStatus.CRITICAL
    
    def _generate_alert_message(self, model_id: str, metrics: PerformanceMetrics, status: PerformanceStatus) -> str:
        """Generate alert message for performance degradation"""
        message = f"Performance {status.value} detected for model {model_id} ({metrics.operation_type.value}):\n"
        message += f"- Success rate: {metrics.success_rate:.2%}\n"
        message += f"- Avg response time: {metrics.avg_response_time_ms:.0f}ms\n"
        message += f"- Avg confidence: {metrics.avg_confidence_score:.2f}\n"
        message += f"- Error rate: {metrics.error_rate:.2%}\n"
        message += f"- Total operations: {metrics.total_operations}"
        
        return message
    
    async def _send_performance_notification(self, alert_data: Dict[str, Any]):
        """Send performance notification (placeholder for email/Slack integration)"""
        try:
            # In production, integrate with email service or Slack
            logger.warning(f"PERFORMANCE ALERT: {alert_data['alert_message']}")
            
            # Store notification log
            notification_data = {
                "notification_id": str(uuid.uuid4()),
                "alert_id": alert_data["alert_id"],
                "type": "performance_degradation",
                "message": alert_data["alert_message"],
                "severity": alert_data["severity"],
                "sent_at": datetime.now().isoformat(),
                "recipients": ["admin@company.com"],  # Configure recipients
                "delivery_status": "sent"
            }
            
            self.supabase.table("notifications").insert(notification_data).execute()
            
        except Exception as e:
            logger.error(f"Error sending performance notification: {e}")
    
    async def _update_satisfaction_metrics(self, feedback: UserFeedback):
        """Update satisfaction metrics after receiving feedback"""
        try:
            # Clear relevant caches
            cache_keys_to_clear = [key for key in self.performance_cache.keys()]
            for key in cache_keys_to_clear:
                if key in self.performance_cache:
                    del self.performance_cache[key]
                if key in self.cache_timestamps:
                    del self.cache_timestamps[key]
        except Exception as e:
            logger.error(f"Error updating satisfaction metrics: {e}")
    
    def _calculate_statistical_significance(self, metrics_a: PerformanceMetrics, metrics_b: PerformanceMetrics) -> float:
        """Calculate statistical significance between two models (simplified)"""
        try:
            # Simplified statistical significance calculation
            # In production, use proper statistical tests (t-test, chi-square, etc.)
            
            sample_size_a = metrics_a.total_operations
            sample_size_b = metrics_b.total_operations
            
            if sample_size_a < 30 or sample_size_b < 30:
                return 0.0  # Insufficient sample size
            
            # Use success rate difference as a proxy for significance
            success_rate_diff = abs(metrics_a.success_rate - metrics_b.success_rate)
            
            # Simple heuristic: larger differences with larger sample sizes = higher significance
            significance = min(success_rate_diff * min(sample_size_a, sample_size_b) / 100, 1.0)
            
            return significance
            
        except Exception as e:
            logger.error(f"Error calculating statistical significance: {e}")
            return 0.0
    
    def _determine_ab_test_winner(self, metrics_a: PerformanceMetrics, metrics_b: PerformanceMetrics, 
                                success_metrics: List[str]) -> Optional[str]:
        """Determine winner of A/B test based on success metrics"""
        try:
            score_a = 0
            score_b = 0
            
            for metric in success_metrics:
                if metric == "success_rate":
                    if metrics_a.success_rate > metrics_b.success_rate:
                        score_a += 1
                    elif metrics_b.success_rate > metrics_a.success_rate:
                        score_b += 1
                elif metric == "response_time":
                    if metrics_a.avg_response_time_ms < metrics_b.avg_response_time_ms:
                        score_a += 1
                    elif metrics_b.avg_response_time_ms < metrics_a.avg_response_time_ms:
                        score_b += 1
                elif metric == "confidence_score":
                    if metrics_a.avg_confidence_score > metrics_b.avg_confidence_score:
                        score_a += 1
                    elif metrics_b.avg_confidence_score > metrics_a.avg_confidence_score:
                        score_b += 1
                elif metric == "user_satisfaction":
                    if (metrics_a.user_satisfaction_score or 0) > (metrics_b.user_satisfaction_score or 0):
                        score_a += 1
                    elif (metrics_b.user_satisfaction_score or 0) > (metrics_a.user_satisfaction_score or 0):
                        score_b += 1
            
            if score_a > score_b:
                return "model_a"
            elif score_b > score_a:
                return "model_b"
            else:
                return None  # Tie
                
        except Exception as e:
            logger.error(f"Error determining A/B test winner: {e}")
            return None
    
    def _generate_ab_test_recommendations(self, metrics_a: PerformanceMetrics, metrics_b: PerformanceMetrics, 
                                        winner: Optional[str]) -> List[str]:
        """Generate recommendations based on A/B test results"""
        recommendations = []
        
        try:
            if winner == "model_a":
                recommendations.append(f"Deploy Model A ({metrics_a.model_id}) as it shows superior performance")
                recommendations.append(f"Model A achieved {metrics_a.success_rate:.2%} success rate vs {metrics_b.success_rate:.2%}")
            elif winner == "model_b":
                recommendations.append(f"Deploy Model B ({metrics_b.model_id}) as it shows superior performance")
                recommendations.append(f"Model B achieved {metrics_b.success_rate:.2%} success rate vs {metrics_a.success_rate:.2%}")
            else:
                recommendations.append("No clear winner detected - consider extending test duration")
                recommendations.append("Monitor both models for additional metrics")
            
            # Add specific recommendations based on metrics
            if abs(metrics_a.avg_response_time_ms - metrics_b.avg_response_time_ms) > 500:
                faster_model = "A" if metrics_a.avg_response_time_ms < metrics_b.avg_response_time_ms else "B"
                recommendations.append(f"Model {faster_model} shows significantly better response times")
            
            if abs(metrics_a.avg_confidence_score - metrics_b.avg_confidence_score) > 0.1:
                higher_confidence = "A" if metrics_a.avg_confidence_score > metrics_b.avg_confidence_score else "B"
                recommendations.append(f"Model {higher_confidence} shows higher confidence in predictions")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating A/B test recommendations: {e}")
            return ["Error generating recommendations - manual review required"]
    
    def _generate_ab_test_conclusion(self, metrics_a: PerformanceMetrics, metrics_b: PerformanceMetrics, 
                                   winner: Optional[str], significance: float) -> str:
        """Generate conclusion for A/B test"""
        try:
            if significance < 0.1:
                return "Results are not statistically significant. Consider extending the test duration or increasing sample size."
            
            if winner == "model_a":
                return f"Model A ({metrics_a.model_id}) is the clear winner with {significance:.2%} statistical significance."
            elif winner == "model_b":
                return f"Model B ({metrics_b.model_id}) is the clear winner with {significance:.2%} statistical significance."
            else:
                return f"Both models perform similarly with {significance:.2%} statistical significance. Consider business factors for decision."
                
        except Exception as e:
            logger.error(f"Error generating A/B test conclusion: {e}")
            return "Error generating conclusion - manual review required"