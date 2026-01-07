"""
Feedback Capture and Training Data Preparation Service
Handles user feedback collection, analysis, and preparation for model training
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

class FeedbackType(str, Enum):
    """Types of feedback"""
    HELPFUL = "helpful"
    ACCURATE = "accurate"
    RELEVANT = "relevant"
    FAST = "fast"
    GENERAL = "general"
    BUG_REPORT = "bug_report"
    FEATURE_REQUEST = "feature_request"

class TrainingDataQuality(str, Enum):
    """Quality levels for training data"""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

@dataclass
class FeedbackAnalysis:
    """Analysis results for feedback"""
    feedback_id: str
    sentiment_score: float  # -1 to 1
    quality_indicators: Dict[str, float]
    improvement_suggestions: List[str]
    training_value: float  # 0 to 1
    confidence: float

@dataclass
class TrainingDataPoint:
    """Prepared training data point"""
    data_id: str
    operation_id: str
    model_id: str
    operation_type: str
    input_data: Dict[str, Any]
    expected_output: Dict[str, Any]
    actual_output: Dict[str, Any]
    feedback_score: float
    quality_score: float
    training_weight: float
    metadata: Dict[str, Any]

class FeedbackCaptureService:
    """Service for capturing and analyzing user feedback"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
        # Feedback analysis thresholds
        self.quality_thresholds = {
            "excellent": 4.5,
            "good": 3.5,
            "fair": 2.5,
            "poor": 0.0
        }
        
        # Training data weights based on feedback quality
        self.training_weights = {
            "excellent": 2.0,
            "good": 1.5,
            "fair": 1.0,
            "poor": 0.3
        }
    
    async def capture_feedback(self, operation_id: str, user_id: str, rating: int,
                             feedback_type: FeedbackType = FeedbackType.GENERAL,
                             comments: str = None, metadata: Dict[str, Any] = None) -> str:
        """Capture user feedback for an AI operation"""
        try:
            feedback_id = str(uuid.uuid4())
            
            # Validate rating
            if rating < 1 or rating > 5:
                raise ValueError("Rating must be between 1 and 5")
            
            # Store feedback
            feedback_data = {
                "feedback_id": feedback_id,
                "operation_id": operation_id,
                "user_id": user_id,
                "rating": rating,
                "feedback_type": feedback_type.value,
                "comments": comments,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {}
            }
            
            response = self.supabase.table("user_feedback").insert(feedback_data).execute()
            
            if response.data:
                logger.info(f"Captured feedback {feedback_id} for operation {operation_id}")
                
                # Analyze feedback asynchronously
                asyncio.create_task(self._analyze_feedback(feedback_id, feedback_data))
                
                # Update training data asynchronously
                asyncio.create_task(self._update_training_data(operation_id, rating, comments))
                
                return feedback_id
            else:
                raise Exception("Failed to store feedback")
                
        except Exception as e:
            logger.error(f"Error capturing feedback: {e}")
            raise
    
    async def get_feedback_summary(self, model_id: str = None, operation_type: str = None,
                                 days: int = 30) -> Dict[str, Any]:
        """Get feedback summary and analysis"""
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Build query to get feedback with operation details
            query = """
                SELECT 
                    fb.*,
                    op.model_id,
                    op.operation_type,
                    op.success,
                    op.confidence_score
                FROM user_feedback fb
                JOIN ai_model_operations op ON fb.operation_id = op.operation_id
                WHERE fb.timestamp >= %s AND fb.timestamp <= %s
            """
            
            params = [start_date.isoformat(), end_date.isoformat()]
            
            if model_id:
                query += " AND op.model_id = %s"
                params.append(model_id)
            
            if operation_type:
                query += " AND op.operation_type = %s"
                params.append(operation_type)
            
            # Execute query using RPC
            result = self.supabase.rpc('execute_sql', {
                'query': query,
                'params': params
            }).execute()
            
            feedback_data = result.data or []
            
            if not feedback_data:
                return {
                    "total_feedback": 0,
                    "average_rating": 0.0,
                    "rating_distribution": {},
                    "feedback_by_type": {},
                    "sentiment_analysis": {},
                    "improvement_areas": [],
                    "period_start": start_date.isoformat(),
                    "period_end": end_date.isoformat()
                }
            
            # Calculate summary statistics
            total_feedback = len(feedback_data)
            ratings = [fb["rating"] for fb in feedback_data]
            average_rating = sum(ratings) / len(ratings)
            
            # Rating distribution
            rating_distribution = {}
            for rating in range(1, 6):
                count = len([r for r in ratings if r == rating])
                rating_distribution[str(rating)] = {
                    "count": count,
                    "percentage": (count / total_feedback) * 100
                }
            
            # Feedback by type
            feedback_by_type = {}
            for fb in feedback_data:
                fb_type = fb["feedback_type"]
                if fb_type not in feedback_by_type:
                    feedback_by_type[fb_type] = {"count": 0, "avg_rating": 0.0}
                feedback_by_type[fb_type]["count"] += 1
            
            # Calculate average ratings by type
            for fb_type in feedback_by_type:
                type_ratings = [fb["rating"] for fb in feedback_data if fb["feedback_type"] == fb_type]
                feedback_by_type[fb_type]["avg_rating"] = sum(type_ratings) / len(type_ratings)
            
            # Sentiment analysis (simplified)
            positive_feedback = len([r for r in ratings if r >= 4])
            negative_feedback = len([r for r in ratings if r <= 2])
            neutral_feedback = total_feedback - positive_feedback - negative_feedback
            
            sentiment_analysis = {
                "positive": {
                    "count": positive_feedback,
                    "percentage": (positive_feedback / total_feedback) * 100
                },
                "neutral": {
                    "count": neutral_feedback,
                    "percentage": (neutral_feedback / total_feedback) * 100
                },
                "negative": {
                    "count": negative_feedback,
                    "percentage": (negative_feedback / total_feedback) * 100
                }
            }
            
            # Identify improvement areas
            improvement_areas = await self._identify_improvement_areas(feedback_data)
            
            return {
                "total_feedback": total_feedback,
                "average_rating": round(average_rating, 2),
                "rating_distribution": rating_distribution,
                "feedback_by_type": feedback_by_type,
                "sentiment_analysis": sentiment_analysis,
                "improvement_areas": improvement_areas,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting feedback summary: {e}")
            return {}
    
    async def prepare_training_data(self, model_id: str = None, operation_type: str = None,
                                  min_quality_score: float = 0.5, limit: int = 1000) -> List[TrainingDataPoint]:
        """Prepare training data from feedback"""
        try:
            # Build query to get training data
            query = self.supabase.table("model_training_data").select("*")
            
            if model_id:
                query = query.eq("model_id", model_id)
            
            if operation_type:
                query = query.eq("operation_type", operation_type)
            
            if min_quality_score > 0:
                query = query.gte("quality_score", min_quality_score)
            
            response = query.order("quality_score", desc=True).limit(limit).execute()
            training_records = response.data or []
            
            # Convert to TrainingDataPoint objects
            training_data = []
            for record in training_records:
                data_point = TrainingDataPoint(
                    data_id=record["id"],
                    operation_id=record["operation_id"],
                    model_id=record["model_id"],
                    operation_type=record["operation_type"],
                    input_data=record["input_data"],
                    expected_output=record.get("expected_output", {}),
                    actual_output=record["actual_output"],
                    feedback_score=record["feedback_score"],
                    quality_score=record["quality_score"],
                    training_weight=record["training_weight"],
                    metadata={
                        "created_at": record["created_at"],
                        "updated_at": record["updated_at"]
                    }
                )
                training_data.append(data_point)
            
            logger.info(f"Prepared {len(training_data)} training data points")
            return training_data
            
        except Exception as e:
            logger.error(f"Error preparing training data: {e}")
            return []
    
    async def export_training_data(self, format: str = "jsonl", **kwargs) -> str:
        """Export training data in specified format"""
        try:
            training_data = await self.prepare_training_data(**kwargs)
            
            if format.lower() == "jsonl":
                return self._export_jsonl(training_data)
            elif format.lower() == "csv":
                return self._export_csv(training_data)
            elif format.lower() == "json":
                return self._export_json(training_data)
            else:
                raise ValueError(f"Unsupported format: {format}")
                
        except Exception as e:
            logger.error(f"Error exporting training data: {e}")
            raise
    
    async def analyze_feedback_trends(self, days: int = 90) -> Dict[str, Any]:
        """Analyze feedback trends over time"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Get feedback data with time series
            response = self.supabase.table("user_feedback").select(
                "rating, feedback_type, timestamp, operation_id"
            ).gte("timestamp", start_date.isoformat()).order("timestamp").execute()
            
            feedback_data = response.data or []
            
            if not feedback_data:
                return {"trends": [], "insights": []}
            
            # Group by week
            weekly_trends = {}
            for fb in feedback_data:
                timestamp = datetime.fromisoformat(fb["timestamp"].replace('Z', '+00:00'))
                week_key = timestamp.strftime("%Y-W%U")
                
                if week_key not in weekly_trends:
                    weekly_trends[week_key] = {
                        "week": week_key,
                        "ratings": [],
                        "count": 0,
                        "avg_rating": 0.0
                    }
                
                weekly_trends[week_key]["ratings"].append(fb["rating"])
                weekly_trends[week_key]["count"] += 1
            
            # Calculate averages
            trends = []
            for week_data in weekly_trends.values():
                week_data["avg_rating"] = sum(week_data["ratings"]) / len(week_data["ratings"])
                del week_data["ratings"]  # Remove raw ratings
                trends.append(week_data)
            
            # Sort by week
            trends.sort(key=lambda x: x["week"])
            
            # Generate insights
            insights = self._generate_trend_insights(trends)
            
            return {
                "trends": trends,
                "insights": insights,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing feedback trends: {e}")
            return {"trends": [], "insights": []}
    
    # Private helper methods
    async def _analyze_feedback(self, feedback_id: str, feedback_data: Dict[str, Any]):
        """Analyze feedback for quality and sentiment"""
        try:
            rating = feedback_data["rating"]
            comments = feedback_data.get("comments", "")
            
            # Simple sentiment analysis based on rating and comments
            sentiment_score = (rating - 3) / 2  # Convert 1-5 to -1 to 1
            
            # Adjust sentiment based on comments (simplified)
            if comments:
                positive_words = ["good", "great", "excellent", "helpful", "accurate", "fast"]
                negative_words = ["bad", "poor", "slow", "wrong", "unhelpful", "inaccurate"]
                
                comment_lower = comments.lower()
                positive_count = sum(1 for word in positive_words if word in comment_lower)
                negative_count = sum(1 for word in negative_words if word in comment_lower)
                
                if positive_count > negative_count:
                    sentiment_score = min(sentiment_score + 0.2, 1.0)
                elif negative_count > positive_count:
                    sentiment_score = max(sentiment_score - 0.2, -1.0)
            
            # Quality indicators
            quality_indicators = {
                "rating_quality": rating / 5.0,
                "has_comments": 1.0 if comments else 0.0,
                "comment_length": min(len(comments) / 100, 1.0) if comments else 0.0
            }
            
            # Training value calculation
            training_value = (rating / 5.0) * 0.7 + quality_indicators["has_comments"] * 0.3
            
            # Store analysis
            analysis_data = {
                "feedback_id": feedback_id,
                "sentiment_score": sentiment_score,
                "quality_indicators": quality_indicators,
                "training_value": training_value,
                "analyzed_at": datetime.now().isoformat()
            }
            
            self.supabase.table("feedback_analysis").upsert(analysis_data).execute()
            
        except Exception as e:
            logger.error(f"Error analyzing feedback: {e}")
    
    async def _update_training_data(self, operation_id: str, rating: int, comments: str = None):
        """Update training data based on feedback"""
        try:
            # Get operation details
            op_response = self.supabase.table("ai_model_operations").select("*").eq(
                "operation_id", operation_id
            ).execute()
            
            if not op_response.data:
                return
            
            operation = op_response.data[0]
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(rating, comments)
            
            # Calculate training weight
            training_weight = self._calculate_training_weight(rating, quality_score)
            
            # Prepare expected output (simplified - in production, use more sophisticated methods)
            expected_output = operation["outputs"].copy() if operation.get("outputs") else {}
            
            # If rating is low, mark as needing improvement
            if rating <= 2:
                expected_output["needs_improvement"] = True
                expected_output["improvement_reason"] = comments or "Low user rating"
            
            # Update or insert training data
            training_data = {
                "operation_id": operation_id,
                "model_id": operation["model_id"],
                "operation_type": operation["operation_type"],
                "input_data": operation["inputs"],
                "expected_output": expected_output,
                "actual_output": operation["outputs"],
                "feedback_score": rating / 5.0,
                "quality_score": quality_score,
                "training_weight": training_weight
            }
            
            self.supabase.table("model_training_data").upsert(training_data).execute()
            
        except Exception as e:
            logger.error(f"Error updating training data: {e}")
    
    def _calculate_quality_score(self, rating: int, comments: str = None) -> float:
        """Calculate quality score for training data"""
        base_score = rating / 5.0
        
        # Bonus for detailed comments
        if comments and len(comments) > 20:
            base_score += 0.1
        
        # Penalty for very short or no comments on low ratings
        if rating <= 2 and (not comments or len(comments) < 10):
            base_score -= 0.1
        
        return max(0.0, min(1.0, base_score))
    
    def _calculate_training_weight(self, rating: int, quality_score: float) -> float:
        """Calculate training weight based on rating and quality"""
        if rating >= 4:
            return self.training_weights["excellent"] * quality_score
        elif rating >= 3:
            return self.training_weights["good"] * quality_score
        elif rating >= 2:
            return self.training_weights["fair"] * quality_score
        else:
            return self.training_weights["poor"] * quality_score
    
    async def _identify_improvement_areas(self, feedback_data: List[Dict]) -> List[str]:
        """Identify areas for improvement based on feedback"""
        improvement_areas = []
        
        try:
            # Analyze low-rated feedback
            low_rated = [fb for fb in feedback_data if fb["rating"] <= 2]
            
            if len(low_rated) > len(feedback_data) * 0.2:  # More than 20% low ratings
                improvement_areas.append("Overall user satisfaction needs improvement")
            
            # Analyze by feedback type
            type_ratings = {}
            for fb in feedback_data:
                fb_type = fb["feedback_type"]
                if fb_type not in type_ratings:
                    type_ratings[fb_type] = []
                type_ratings[fb_type].append(fb["rating"])
            
            for fb_type, ratings in type_ratings.items():
                avg_rating = sum(ratings) / len(ratings)
                if avg_rating < 3.0:
                    improvement_areas.append(f"Improve {fb_type} aspects of the system")
            
            # Analyze response times (if available)
            slow_responses = [fb for fb in feedback_data if fb.get("response_time_ms", 0) > 5000]
            if len(slow_responses) > len(feedback_data) * 0.3:
                improvement_areas.append("Reduce response times for better user experience")
            
            # Analyze confidence scores
            low_confidence = [fb for fb in feedback_data if fb.get("confidence_score", 1.0) < 0.7]
            if len(low_confidence) > len(feedback_data) * 0.4:
                improvement_areas.append("Improve model confidence and accuracy")
            
        except Exception as e:
            logger.error(f"Error identifying improvement areas: {e}")
        
        return improvement_areas
    
    def _generate_trend_insights(self, trends: List[Dict]) -> List[str]:
        """Generate insights from trend data"""
        insights = []
        
        try:
            if len(trends) < 2:
                return insights
            
            # Calculate trend direction
            recent_avg = sum(t["avg_rating"] for t in trends[-4:]) / min(4, len(trends))
            older_avg = sum(t["avg_rating"] for t in trends[:4]) / min(4, len(trends))
            
            if recent_avg > older_avg + 0.2:
                insights.append("User satisfaction is improving over time")
            elif recent_avg < older_avg - 0.2:
                insights.append("User satisfaction is declining - attention needed")
            else:
                insights.append("User satisfaction remains stable")
            
            # Volume trends
            recent_volume = sum(t["count"] for t in trends[-4:])
            older_volume = sum(t["count"] for t in trends[:4])
            
            if recent_volume > older_volume * 1.5:
                insights.append("Feedback volume is increasing significantly")
            elif recent_volume < older_volume * 0.5:
                insights.append("Feedback volume is decreasing - consider encouraging more feedback")
            
            # Quality trends
            high_rating_weeks = len([t for t in trends if t["avg_rating"] >= 4.0])
            if high_rating_weeks > len(trends) * 0.7:
                insights.append("Consistently high user satisfaction across most weeks")
            
        except Exception as e:
            logger.error(f"Error generating trend insights: {e}")
        
        return insights
    
    def _export_jsonl(self, training_data: List[TrainingDataPoint]) -> str:
        """Export training data as JSONL format"""
        lines = []
        for data_point in training_data:
            line = {
                "input": data_point.input_data,
                "output": data_point.expected_output,
                "metadata": {
                    "operation_id": data_point.operation_id,
                    "model_id": data_point.model_id,
                    "operation_type": data_point.operation_type,
                    "feedback_score": data_point.feedback_score,
                    "quality_score": data_point.quality_score,
                    "training_weight": data_point.training_weight
                }
            }
            lines.append(json.dumps(line))
        
        return "\n".join(lines)
    
    def _export_csv(self, training_data: List[TrainingDataPoint]) -> str:
        """Export training data as CSV format"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "operation_id", "model_id", "operation_type", "input_data", 
            "expected_output", "actual_output", "feedback_score", 
            "quality_score", "training_weight"
        ])
        
        # Write data
        for data_point in training_data:
            writer.writerow([
                data_point.operation_id,
                data_point.model_id,
                data_point.operation_type,
                json.dumps(data_point.input_data),
                json.dumps(data_point.expected_output),
                json.dumps(data_point.actual_output),
                data_point.feedback_score,
                data_point.quality_score,
                data_point.training_weight
            ])
        
        return output.getvalue()
    
    def _export_json(self, training_data: List[TrainingDataPoint]) -> str:
        """Export training data as JSON format"""
        data = [asdict(data_point) for data_point in training_data]
        return json.dumps(data, indent=2, default=str)