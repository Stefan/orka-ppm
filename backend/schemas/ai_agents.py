"""
Pydantic schemas for AI agent API endpoints
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# RAG Reporter Schemas
class RAGReportRequest(BaseModel):
    """Request model for RAG report generation"""
    query: str = Field(..., min_length=1, max_length=1000, description="Natural language query")


class RAGReportResponse(BaseModel):
    """Response model for RAG report generation"""
    response: str = Field(..., description="Generated response text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Source documents used")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


# Resource Optimizer Schemas
class OptimizeResourcesRequest(BaseModel):
    """Request model for resource optimization"""
    constraints: Optional[Dict[str, Any]] = Field(None, description="Optional optimization constraints")


class ResourceRecommendation(BaseModel):
    """Individual resource allocation recommendation"""
    resource_id: UUID = Field(..., description="Resource identifier")
    resource_name: str = Field(..., description="Resource name")
    project_id: UUID = Field(..., description="Project identifier")
    project_name: str = Field(..., description="Project name")
    allocated_hours: float = Field(..., ge=0, description="Recommended hours to allocate")
    cost_savings: float = Field(..., description="Estimated cost savings")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in recommendation")


class OptimizeResourcesResponse(BaseModel):
    """Response model for resource optimization"""
    recommendations: List[ResourceRecommendation] = Field(..., description="List of recommendations")
    total_cost_savings: float = Field(..., description="Total estimated cost savings")
    model_confidence: float = Field(..., ge=0.0, le=1.0, description="Overall model confidence")
    constraints_satisfied: bool = Field(..., description="Whether all constraints were satisfied")


# Risk Forecaster Schemas
class ForecastRisksRequest(BaseModel):
    """Request model for risk forecasting"""
    project_id: Optional[UUID] = Field(None, description="Optional project ID to scope forecast")
    forecast_periods: int = Field(default=12, ge=1, le=24, description="Number of periods to forecast")


class RiskForecast(BaseModel):
    """Individual risk forecast for a period"""
    period: str = Field(..., description="Time period (e.g., '2024-02')")
    risk_probability: float = Field(..., ge=0.0, le=1.0, description="Probability of risk occurrence")
    risk_impact: float = Field(..., ge=0.0, description="Estimated impact score")
    confidence_lower: float = Field(..., ge=0.0, le=1.0, description="Lower confidence bound")
    confidence_upper: float = Field(..., ge=0.0, le=1.0, description="Upper confidence bound")


class ForecastRisksResponse(BaseModel):
    """Response model for risk forecasting"""
    forecasts: List[RiskForecast] = Field(..., description="List of risk forecasts")
    model_confidence: float = Field(..., ge=0.0, le=1.0, description="Overall model confidence")
    model_metrics: Dict[str, float] = Field(..., description="Model performance metrics (AIC, RMSE)")


# Data Validator Schemas
class ValidateDataRequest(BaseModel):
    """Request model for data validation"""
    validation_scope: str = Field(
        default="all",
        pattern="^(all|financials|timelines|integrity)$",
        description="Scope of validation: all, financials, timelines, or integrity"
    )


class ValidationIssue(BaseModel):
    """Individual validation issue"""
    severity: str = Field(..., description="Issue severity: CRITICAL, HIGH, MEDIUM, LOW")
    category: str = Field(..., description="Issue category: financial, timeline, integrity")
    entity_type: str = Field(..., description="Type of entity with issue")
    entity_id: UUID = Field(..., description="ID of entity with issue")
    description: str = Field(..., description="Description of the issue")
    recommendation: Optional[str] = Field(None, description="Recommended action to fix issue")


class ValidateDataResponse(BaseModel):
    """Response model for data validation"""
    issues: List[ValidationIssue] = Field(..., description="List of validation issues found")
    total_issues: int = Field(..., ge=0, description="Total number of issues")
    critical_count: int = Field(..., ge=0, description="Number of critical issues")
    high_count: int = Field(..., ge=0, description="Number of high severity issues")
    medium_count: int = Field(..., ge=0, description="Number of medium severity issues")
    low_count: int = Field(..., ge=0, description="Number of low severity issues")
