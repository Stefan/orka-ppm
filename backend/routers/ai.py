"""
AI agent endpoints - RAG, resource optimization, risk forecasting
"""

from fastapi import APIRouter, HTTPException, Depends, status
from uuid import UUID
from typing import Optional, Dict, Any, List

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from utils.converters import convert_uuids

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/rag/query")
async def query_rag_agent(
    query: str,
    context: Optional[str] = None,
    project_id: Optional[UUID] = None,
    current_user = Depends(require_permission(Permission.ai_rag_query))
):
    """Query the RAG (Retrieval-Augmented Generation) agent"""
    try:
        # This would integrate with the actual AI agents
        # For now, return a mock response
        return {
            "query": query,
            "response": "This is a mock RAG response. The actual implementation would use the AI agents to provide intelligent answers based on project data and documentation.",
            "sources": [
                {"title": "Project Documentation", "relevance": 0.95},
                {"title": "Best Practices Guide", "relevance": 0.87}
            ],
            "confidence": 0.91,
            "project_id": str(project_id) if project_id else None
        }
        
    except Exception as e:
        print(f"RAG query error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process RAG query: {str(e)}")

@router.post("/resource-optimizer/analyze")
async def analyze_resource_optimization(
    project_id: Optional[UUID] = None,
    portfolio_id: Optional[UUID] = None,
    current_user = Depends(require_permission(Permission.ai_resource_optimize))
):
    """Analyze resource allocation and provide optimization recommendations"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get project or portfolio data for analysis
        if project_id:
            project_response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
            if not project_response.data:
                raise HTTPException(status_code=404, detail="Project not found")
            
            context = {"type": "project", "data": project_response.data[0]}
        elif portfolio_id:
            portfolio_response = supabase.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
            if not portfolio_response.data:
                raise HTTPException(status_code=404, detail="Portfolio not found")
            
            context = {"type": "portfolio", "data": portfolio_response.data[0]}
        else:
            context = {"type": "global", "data": {}}
        
        # Mock resource optimization analysis
        return {
            "analysis_type": context["type"],
            "recommendations": [
                {
                    "type": "reallocation",
                    "priority": "high",
                    "description": "Consider reallocating 2 developers from Project A to Project B to balance workload",
                    "impact": "Could improve delivery timeline by 15%",
                    "confidence": 0.85
                },
                {
                    "type": "skill_gap",
                    "priority": "medium", 
                    "description": "Identified need for additional UX design capacity",
                    "impact": "Hiring 1 UX designer could improve user satisfaction scores",
                    "confidence": 0.78
                }
            ],
            "utilization_metrics": {
                "average_utilization": 82.5,
                "over_allocated_resources": 3,
                "under_allocated_resources": 7,
                "optimal_allocation_score": 0.73
            },
            "generated_at": "2024-01-07T12:00:00Z"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Resource optimization error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze resource optimization: {str(e)}")

@router.post("/risk-forecaster/predict")
async def predict_project_risks(
    project_id: Optional[UUID] = None,
    portfolio_id: Optional[UUID] = None,
    forecast_horizon_days: int = 90,
    current_user = Depends(require_permission(Permission.ai_risk_forecast))
):
    """Predict potential risks using AI forecasting"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get historical data for risk prediction
        if project_id:
            # Get project risks and issues
            risks_response = supabase.table("risks").select("*").eq("project_id", str(project_id)).execute()
            issues_response = supabase.table("issues").select("*").eq("project_id", str(project_id)).execute()
            
            context = {
                "type": "project",
                "project_id": str(project_id),
                "historical_risks": len(risks_response.data or []),
                "historical_issues": len(issues_response.data or [])
            }
        elif portfolio_id:
            context = {"type": "portfolio", "portfolio_id": str(portfolio_id)}
        else:
            context = {"type": "global"}
        
        # Mock risk forecasting
        return {
            "forecast_horizon_days": forecast_horizon_days,
            "context": context,
            "predicted_risks": [
                {
                    "risk_type": "budget_overrun",
                    "probability": 0.65,
                    "impact": 0.8,
                    "risk_score": 0.52,
                    "description": "Budget may exceed allocated amount by 15-20% based on current spending trends",
                    "recommended_actions": [
                        "Review and optimize resource allocation",
                        "Implement stricter budget monitoring",
                        "Consider scope reduction if necessary"
                    ],
                    "confidence": 0.78
                },
                {
                    "risk_type": "timeline_delay",
                    "probability": 0.45,
                    "impact": 0.7,
                    "risk_score": 0.315,
                    "description": "Project delivery may be delayed by 2-3 weeks due to resource constraints",
                    "recommended_actions": [
                        "Add additional resources to critical path",
                        "Negotiate timeline extension with stakeholders",
                        "Prioritize high-impact features"
                    ],
                    "confidence": 0.82
                }
            ],
            "overall_risk_score": 0.42,
            "risk_trend": "increasing",
            "generated_at": "2024-01-07T12:00:00Z"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Risk forecasting error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to predict risks: {str(e)}")

@router.get("/metrics")
async def get_ai_metrics(current_user = Depends(require_permission(Permission.ai_metrics_read))):
    """Get AI system performance metrics"""
    try:
        # Mock AI metrics
        return {
            "rag_agent": {
                "total_queries": 1247,
                "average_response_time_ms": 850,
                "accuracy_score": 0.89,
                "user_satisfaction": 0.92
            },
            "resource_optimizer": {
                "total_analyses": 156,
                "recommendations_implemented": 89,
                "average_improvement": 0.15,
                "success_rate": 0.87
            },
            "risk_forecaster": {
                "total_predictions": 234,
                "prediction_accuracy": 0.76,
                "early_warning_success": 0.83,
                "false_positive_rate": 0.12
            },
            "system_health": {
                "uptime_percentage": 99.7,
                "average_load": 0.45,
                "memory_usage": 0.62,
                "last_updated": "2024-01-07T12:00:00Z"
            }
        }
        
    except Exception as e:
        print(f"Get AI metrics error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI metrics: {str(e)}")

@router.post("/feedback")
async def submit_ai_feedback(
    agent_type: str,  # "rag", "resource_optimizer", "risk_forecaster"
    query_id: Optional[str] = None,
    rating: int = None,  # 1-5 scale
    feedback_text: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Submit feedback on AI agent performance"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        if rating and (rating < 1 or rating > 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        feedback_data = {
            "agent_type": agent_type,
            "query_id": query_id,
            "rating": rating,
            "feedback_text": feedback_text,
            "user_id": current_user.get("user_id")
        }
        
        response = supabase.table("ai_feedback").insert(feedback_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to submit feedback")
        
        return {
            "message": "Feedback submitted successfully",
            "feedback_id": response.data[0]["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submit AI feedback error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

@router.get("/models/status")
async def get_ai_models_status(current_user = Depends(require_permission(Permission.system_admin))):
    """Get status of AI models and services"""
    try:
        # Mock model status
        return {
            "models": [
                {
                    "name": "rag-embeddings-v1",
                    "type": "embedding",
                    "status": "active",
                    "version": "1.2.3",
                    "last_updated": "2024-01-05T10:00:00Z",
                    "performance_score": 0.91
                },
                {
                    "name": "resource-optimizer-v2",
                    "type": "optimization",
                    "status": "active", 
                    "version": "2.1.0",
                    "last_updated": "2024-01-03T14:30:00Z",
                    "performance_score": 0.87
                },
                {
                    "name": "risk-predictor-v1",
                    "type": "forecasting",
                    "status": "training",
                    "version": "1.0.5",
                    "last_updated": "2024-01-07T08:15:00Z",
                    "performance_score": 0.76
                }
            ],
            "services": [
                {
                    "name": "openai-gpt-4",
                    "type": "llm",
                    "status": "active",
                    "response_time_ms": 1200,
                    "rate_limit_remaining": 8500
                },
                {
                    "name": "vector-database",
                    "type": "storage",
                    "status": "active",
                    "storage_used_gb": 12.5,
                    "query_performance_ms": 45
                }
            ],
            "last_health_check": "2024-01-07T12:00:00Z"
        }
        
    except Exception as e:
        print(f"Get AI models status error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI models status: {str(e)}")

@router.post("/models/{model_name}/retrain")
async def retrain_ai_model(
    model_name: str,
    training_data_source: Optional[str] = None,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """Trigger retraining of an AI model"""
    try:
        # Mock model retraining
        return {
            "message": f"Retraining initiated for model: {model_name}",
            "job_id": f"retrain-{model_name}-{int(datetime.now().timestamp())}",
            "estimated_completion": "2024-01-07T18:00:00Z",
            "status": "queued"
        }
        
    except Exception as e:
        print(f"Retrain AI model error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate model retraining: {str(e)}")