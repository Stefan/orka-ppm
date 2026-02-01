"""
AI Insights Engine for Enhanced PMR
Generates AI-powered insights for budget, schedule, resource, and risk categories
Leverages existing RAG patterns and OpenAI integration
"""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from openai import OpenAI
from supabase import Client

# Import models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.pmr import (
    AIInsightType, AIInsightCategory, AIInsightPriority,
    EnhancedAIInsight, ValidationStatus
)

logger = logging.getLogger(__name__)


class AIInsightsEngine:
    """
    AI Insights Engine for Enhanced PMR
    Generates predictive analytics, recommendations, and alerts
    """
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: str = None):
        """Initialize AI Insights Engine with Supabase and OpenAI clients"""
        self.supabase = supabase_client
        # Initialize OpenAI client with optional custom base URL (for Grok, etc.)
        if base_url:
            self.openai_client = OpenAI(api_key=openai_api_key, base_url=base_url)
        else:
            self.openai_client = OpenAI(api_key=openai_api_key)
        # Use configurable model from environment or default
        import os
        self.model = os.getenv("OPENAI_MODEL", "grok-beta")
        self.temperature = 0.7
        self.max_tokens = 2000
        self.confidence_threshold = 0.7
        
    async def generate_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        categories: Optional[List[AIInsightCategory]] = None,
        context_data: Optional[Dict[str, Any]] = None
    ) -> List[EnhancedAIInsight]:
        """
        Generate AI insights for all specified categories
        
        Args:
            report_id: UUID of the PMR report
            project_id: UUID of the project
            categories: List of insight categories to generate (default: all)
            context_data: Additional context data for insight generation
            
        Returns:
            List of EnhancedAIInsight objects
        """
        try:
            # Default to all categories if none specified
            if categories is None:
                categories = [
                    AIInsightCategory.budget,
                    AIInsightCategory.schedule,
                    AIInsightCategory.resource,
                    AIInsightCategory.risk
                ]
            
            # Get project data for context
            project_data = await self._get_project_data(project_id)
            
            # Merge with additional context
            full_context = {**project_data, **(context_data or {})}
            
            # Generate insights for each category
            all_insights = []
            
            for category in categories:
                insights = await self._generate_category_insights(
                    report_id=report_id,
                    project_id=project_id,
                    category=category,
                    context=full_context
                )
                all_insights.extend(insights)
            
            # Filter by confidence threshold
            filtered_insights = [
                insight for insight in all_insights
                if insight.confidence_score >= Decimal(str(self.confidence_threshold))
            ]
            
            logger.info(
                f"Generated {len(filtered_insights)} insights for report {report_id} "
                f"(filtered from {len(all_insights)} total)"
            )
            
            return filtered_insights
            
        except Exception as e:
            logger.error(f"Failed to generate insights: {e}")
            raise
    
    async def _generate_category_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        category: AIInsightCategory,
        context: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Generate insights for a specific category"""
        try:
            # Get category-specific data
            category_data = await self._get_category_data(project_id, category)
            
            # Build prompt for AI insight generation
            system_prompt = self._build_system_prompt(category)
            user_prompt = self._build_user_prompt(category, category_data, context)
            
            # Call OpenAI for insight generation
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            ai_response = response.choices[0].message.content
            
            # Parse AI response into structured insights
            insights = self._parse_insights_from_response(
                report_id=report_id,
                category=category,
                ai_response=ai_response,
                category_data=category_data
            )
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate {category} insights: {e}")
            return []
    
    async def generate_budget_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        context: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Generate budget-specific insights"""
        return await self._generate_category_insights(
            report_id=report_id,
            project_id=project_id,
            category=AIInsightCategory.budget,
            context=context
        )
    
    async def generate_schedule_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        context: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Generate schedule-specific insights"""
        return await self._generate_category_insights(
            report_id=report_id,
            project_id=project_id,
            category=AIInsightCategory.schedule,
            context=context
        )
    
    async def generate_resource_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        context: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Generate resource-specific insights"""
        return await self._generate_category_insights(
            report_id=report_id,
            project_id=project_id,
            category=AIInsightCategory.resource,
            context=context
        )
    
    async def generate_risk_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        context: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Generate risk-specific insights"""
        return await self._generate_category_insights(
            report_id=report_id,
            project_id=project_id,
            category=AIInsightCategory.risk,
            context=context
        )
    
    def calculate_confidence_score(
        self,
        data_quality: float,
        data_completeness: float,
        historical_accuracy: float = 0.8
    ) -> Decimal:
        """
        Calculate confidence score for an insight
        
        Args:
            data_quality: Quality of input data (0.0-1.0)
            data_completeness: Completeness of input data (0.0-1.0)
            historical_accuracy: Historical accuracy of similar predictions (0.0-1.0)
            
        Returns:
            Confidence score as Decimal (0.0-1.0)
        """
        # Weighted average of factors
        confidence = (
            data_quality * 0.4 +
            data_completeness * 0.3 +
            historical_accuracy * 0.3
        )
        
        # Ensure within bounds
        confidence = max(0.0, min(1.0, confidence))
        
        return Decimal(str(round(confidence, 2)))
    
    def extract_supporting_data(
        self,
        category_data: Dict[str, Any],
        insight_type: AIInsightType
    ) -> Dict[str, Any]:
        """
        Extract relevant supporting data for an insight
        
        Args:
            category_data: Raw category data
            insight_type: Type of insight being generated
            
        Returns:
            Dictionary of supporting data
        """
        supporting_data = {}
        
        if insight_type == AIInsightType.prediction:
            # Extract historical trends
            supporting_data["historical_data"] = category_data.get("historical_values", [])
            supporting_data["trend_direction"] = category_data.get("trend", "stable")
            supporting_data["variance"] = category_data.get("variance", 0.0)
            
        elif insight_type == AIInsightType.recommendation:
            # Extract current state and benchmarks
            supporting_data["current_value"] = category_data.get("current_value")
            supporting_data["target_value"] = category_data.get("target_value")
            supporting_data["industry_benchmark"] = category_data.get("benchmark")
            
        elif insight_type == AIInsightType.alert:
            # Extract threshold violations
            supporting_data["threshold"] = category_data.get("threshold")
            supporting_data["current_value"] = category_data.get("current_value")
            supporting_data["severity"] = category_data.get("severity", "medium")
            
        return supporting_data
    
    async def _get_project_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get project data for context"""
        try:
            # Get project details
            project_response = self.supabase.table("projects").select(
                "id, name, status, start_date, end_date, budget, priority"
            ).eq("id", str(project_id)).execute()
            
            if not project_response.data:
                return {}
            
            project = project_response.data[0]
            
            # Get project metrics
            metrics_response = self.supabase.table("project_metrics").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "created_at", desc=True
            ).limit(10).execute()
            
            return {
                "project": project,
                "recent_metrics": metrics_response.data or []
            }
            
        except Exception as e:
            logger.error(f"Failed to get project data: {e}")
            return {}
    
    async def _get_category_data(
        self,
        project_id: UUID,
        category: AIInsightCategory
    ) -> Dict[str, Any]:
        """Get category-specific data"""
        try:
            category_data = {}
            
            if category == AIInsightCategory.budget:
                category_data = await self._get_budget_data(project_id)
            elif category == AIInsightCategory.schedule:
                category_data = await self._get_schedule_data(project_id)
            elif category == AIInsightCategory.resource:
                category_data = await self._get_resource_data(project_id)
            elif category == AIInsightCategory.risk:
                category_data = await self._get_risk_data(project_id)
            
            return category_data
            
        except Exception as e:
            logger.error(f"Failed to get {category} data: {e}")
            return {}
    
    async def _get_budget_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get budget-related data"""
        try:
            # Get financial data
            financial_response = self.supabase.table("financial_data").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "period_start", desc=True
            ).limit(12).execute()
            
            financial_data = financial_response.data or []
            
            # Calculate budget metrics
            if financial_data:
                latest = financial_data[0]
                budget_utilization = (
                    latest.get("actual_cost", 0) / latest.get("planned_cost", 1)
                    if latest.get("planned_cost", 0) > 0 else 0
                )
                
                # Calculate variance trend
                variances = [
                    (item.get("actual_cost", 0) - item.get("planned_cost", 0))
                    for item in financial_data
                ]
                
                return {
                    "current_budget_utilization": budget_utilization,
                    "historical_values": variances,
                    "trend": "increasing" if len(variances) > 1 and variances[0] > variances[-1] else "decreasing",
                    "variance": sum(variances) / len(variances) if variances else 0,
                    "data_quality": 0.9,
                    "data_completeness": 1.0 if len(financial_data) >= 3 else 0.6
                }
            
            return {
                "data_quality": 0.3,
                "data_completeness": 0.0
            }
            
        except Exception as e:
            logger.error(f"Failed to get budget data: {e}")
            return {}
    
    async def _get_schedule_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get schedule-related data"""
        try:
            # Get schedule data
            schedule_response = self.supabase.table("schedule_data").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "created_at", desc=True
            ).limit(12).execute()
            
            schedule_data = schedule_response.data or []
            
            if schedule_data:
                latest = schedule_data[0]
                schedule_performance = latest.get("schedule_performance_index", 1.0)
                
                # Calculate schedule variance trend
                spi_values = [item.get("schedule_performance_index", 1.0) for item in schedule_data]
                
                return {
                    "current_spi": schedule_performance,
                    "historical_values": spi_values,
                    "trend": "improving" if len(spi_values) > 1 and spi_values[0] > spi_values[-1] else "declining",
                    "variance": sum(spi_values) / len(spi_values) - 1.0 if spi_values else 0,
                    "data_quality": 0.9,
                    "data_completeness": 1.0 if len(schedule_data) >= 3 else 0.6
                }
            
            return {
                "data_quality": 0.3,
                "data_completeness": 0.0
            }
            
        except Exception as e:
            logger.error(f"Failed to get schedule data: {e}")
            return {}
    
    async def _get_resource_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get resource-related data"""
        try:
            # Get resource allocation data
            resource_response = self.supabase.table("resource_allocations").select(
                "*"
            ).eq("project_id", str(project_id)).execute()
            
            resource_data = resource_response.data or []
            
            if resource_data:
                # Calculate utilization
                total_allocated = sum(item.get("allocated_hours", 0) for item in resource_data)
                total_capacity = sum(item.get("capacity_hours", 1) for item in resource_data)
                utilization = total_allocated / total_capacity if total_capacity > 0 else 0
                
                return {
                    "current_utilization": utilization,
                    "total_resources": len(resource_data),
                    "over_allocated": sum(1 for item in resource_data if item.get("allocated_hours", 0) > item.get("capacity_hours", 0)),
                    "data_quality": 0.85,
                    "data_completeness": 1.0 if len(resource_data) > 0 else 0.0
                }
            
            return {
                "data_quality": 0.3,
                "data_completeness": 0.0
            }
            
        except Exception as e:
            logger.error(f"Failed to get resource data: {e}")
            return {}
    
    async def _get_risk_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get risk-related data"""
        try:
            # Get risk data
            risk_response = self.supabase.table("risks").select(
                "*"
            ).eq("project_id", str(project_id)).execute()
            
            risk_data = risk_response.data or []
            
            if risk_data:
                # Calculate risk metrics
                high_risks = sum(1 for item in risk_data if item.get("severity") == "high")
                open_risks = sum(1 for item in risk_data if item.get("status") == "open")
                
                # Calculate average risk score
                risk_scores = [item.get("risk_score", 0) for item in risk_data if item.get("risk_score")]
                avg_risk_score = sum(risk_scores) / len(risk_scores) if risk_scores else 0
                
                return {
                    "total_risks": len(risk_data),
                    "high_severity_risks": high_risks,
                    "open_risks": open_risks,
                    "average_risk_score": avg_risk_score,
                    "data_quality": 0.9,
                    "data_completeness": 1.0 if len(risk_data) > 0 else 0.0
                }
            
            return {
                "data_quality": 0.3,
                "data_completeness": 0.0
            }
            
        except Exception as e:
            logger.error(f"Failed to get risk data: {e}")
            return {}
    
    def _build_system_prompt(self, category: AIInsightCategory) -> str:
        """Build system prompt for AI insight generation"""
        base_prompt = """You are an AI assistant specialized in project management analytics.
        Your role is to analyze project data and generate actionable insights.
        
        Guidelines:
        - Provide specific, data-driven insights
        - Include confidence levels based on data quality
        - Suggest concrete actions when appropriate
        - Identify trends and patterns
        - Flag potential issues early
        - Be concise but comprehensive
        """
        
        category_prompts = {
            AIInsightCategory.budget: """
            Focus on budget and financial performance:
            - Budget utilization and variance trends
            - Cost performance predictions
            - Spending patterns and anomalies
            - Budget risk identification
            - Cost optimization opportunities
            """,
            AIInsightCategory.schedule: """
            Focus on schedule and timeline performance:
            - Schedule performance trends
            - Milestone achievement predictions
            - Critical path analysis
            - Schedule risk identification
            - Timeline optimization opportunities
            """,
            AIInsightCategory.resource: """
            Focus on resource allocation and utilization:
            - Resource utilization patterns
            - Allocation efficiency
            - Capacity constraints
            - Resource risk identification
            - Optimization opportunities
            """,
            AIInsightCategory.risk: """
            Focus on risk assessment and mitigation:
            - Risk exposure analysis
            - Risk trend identification
            - Impact predictions
            - Mitigation effectiveness
            - Emerging risk detection
            """
        }
        
        return base_prompt + category_prompts.get(category, "")
    
    def _build_user_prompt(
        self,
        category: AIInsightCategory,
        category_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Build user prompt with category-specific data"""
        prompt = f"Category: {category.value}\n\n"
        
        # Add project context
        if "project" in context:
            project = context["project"]
            prompt += f"Project: {project.get('name')}\n"
            prompt += f"Status: {project.get('status')}\n"
            prompt += f"Priority: {project.get('priority')}\n\n"
        
        # Add category-specific data
        prompt += "Current Data:\n"
        for key, value in category_data.items():
            if key not in ["data_quality", "data_completeness"]:
                prompt += f"- {key}: {value}\n"
        
        prompt += "\n"
        
        # Add instructions
        prompt += """
        Based on the data provided, generate 2-3 insights in the following JSON format:
        
        [
            {
                "type": "prediction|recommendation|alert",
                "title": "Brief insight title",
                "content": "Detailed insight description",
                "priority": "low|medium|high|critical",
                "recommended_actions": ["action1", "action2"],
                "predicted_impact": "Description of potential impact"
            }
        ]
        
        Ensure insights are:
        - Specific and actionable
        - Based on the provided data
        - Prioritized appropriately
        - Include concrete recommendations
        """
        
        return prompt
    
    def _parse_insights_from_response(
        self,
        report_id: UUID,
        category: AIInsightCategory,
        ai_response: str,
        category_data: Dict[str, Any]
    ) -> List[EnhancedAIInsight]:
        """Parse AI response into structured insights"""
        import json
        import re
        
        insights = []
        
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\[.*\]', ai_response, re.DOTALL)
            if json_match:
                insights_data = json.loads(json_match.group())
            else:
                # Fallback: try parsing entire response as JSON
                insights_data = json.loads(ai_response)
            
            # Convert to EnhancedAIInsight objects
            for insight_data in insights_data:
                # Map insight type
                insight_type_str = insight_data.get("type", "recommendation")
                insight_type = AIInsightType[insight_type_str] if insight_type_str in AIInsightType.__members__ else AIInsightType.recommendation
                
                # Map priority
                priority_str = insight_data.get("priority", "medium")
                priority = AIInsightPriority[priority_str] if priority_str in AIInsightPriority.__members__ else AIInsightPriority.medium
                
                # Calculate confidence score
                data_quality = category_data.get("data_quality", 0.5)
                data_completeness = category_data.get("data_completeness", 0.5)
                confidence_score = self.calculate_confidence_score(
                    data_quality=data_quality,
                    data_completeness=data_completeness
                )
                
                # Extract supporting data
                supporting_data = self.extract_supporting_data(
                    category_data=category_data,
                    insight_type=insight_type
                )
                
                # Create insight
                insight = EnhancedAIInsight(
                    report_id=report_id,
                    insight_type=insight_type,
                    category=category,
                    title=insight_data.get("title", "Untitled Insight"),
                    content=insight_data.get("content", ""),
                    confidence_score=confidence_score,
                    supporting_data=supporting_data,
                    predicted_impact=insight_data.get("predicted_impact"),
                    recommended_actions=insight_data.get("recommended_actions", []),
                    priority=priority,
                    validated=False,
                    validation_notes=None
                )
                
                insights.append(insight)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            # Create a single insight from the raw response
            confidence_score = self.calculate_confidence_score(
                data_quality=category_data.get("data_quality", 0.5),
                data_completeness=category_data.get("data_completeness", 0.5)
            )
            
            insight = EnhancedAIInsight(
                report_id=report_id,
                insight_type=AIInsightType.summary,
                category=category,
                title=f"{category.value.title()} Analysis",
                content=ai_response[:500],  # Truncate if too long
                confidence_score=confidence_score,
                supporting_data=self.extract_supporting_data(
                    category_data=category_data,
                    insight_type=AIInsightType.summary
                ),
                priority=AIInsightPriority.medium,
                validated=False
            )
            insights.append(insight)
        
        except Exception as e:
            logger.error(f"Failed to parse insights: {e}")
        
        return insights
