"""
AI agent endpoints - RAG, resource optimization, risk forecasting, help chat
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Dict, Any, List
from datetime import datetime
import os

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from utils.converters import convert_uuids

router = APIRouter(prefix="/ai", tags=["ai"])

# Initialize AI agents lazily
_rag_agent = None

def get_rag_agent():
    """Get or initialize RAG agent"""
    global _rag_agent
    if _rag_agent is None:
        try:
            from ai_agents import RAGReporterAgent
            openai_api_key = os.getenv("OPENAI_API_KEY")
            openai_base_url = os.getenv("OPENAI_BASE_URL")  # For Grok or other providers
            
            if not openai_api_key:
                return None
            
            _rag_agent = RAGReporterAgent(
                supabase_client=supabase,
                openai_api_key=openai_api_key,
                base_url=openai_base_url
            )
        except Exception as e:
            print(f"Failed to initialize RAG agent: {e}")
            return None
    return _rag_agent

class RAGQueryRequest(BaseModel):
    query: str
    context: Optional[str] = None
    project_id: Optional[UUID] = None
    conversation_id: Optional[str] = None

@router.post("/rag/query")
async def query_rag_agent(
    request: RAGQueryRequest,
    current_user = Depends(require_permission(Permission.ai_rag_query))
):
    """Query the RAG (Retrieval-Augmented Generation) agent"""
    try:
        rag_agent = get_rag_agent()
        
        # If RAG agent is not available (no API key), return mock response
        if rag_agent is None:
            return {
                "query": request.query,
                "response": "⚠️ AI-Features sind derzeit nicht verfügbar. Bitte konfigurieren Sie den OPENAI_API_KEY in den Umgebungsvariablen.\n\nMock-Antwort: Dies ist eine Beispielantwort. Die echte KI würde Ihre Projektdaten analysieren und intelligente Einblicke basierend auf Ihren spezifischen Anforderungen liefern.",
                "sources": [
                    {"type": "project", "id": "mock-proj-123", "similarity": 0.95},
                    {"type": "documentation", "id": "mock-doc-456", "similarity": 0.87}
                ],
                "confidence_score": 0.0,
                "conversation_id": request.conversation_id or f"conv-{int(datetime.now().timestamp())}",
                "response_time_ms": 50,
                "status": "ai_unavailable"
            }
        
        # Use real RAG agent
        user_id = current_user.get("user_id")
        result = await rag_agent.process_rag_query(
            query=request.query,
            user_id=user_id,
            conversation_id=request.conversation_id
        )
        
        return result
        
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

# Help Chat Endpoints - DISABLED: Using help_chat.py router instead
# These endpoints were causing conflicts with the proper implementation in routers/help_chat.py
# The help_chat.py router uses proper Pydantic models for request bodies
# while these endpoints incorrectly used query parameters

# @router.post("/help/query")
# async def process_help_query(
#     query: str,
#     context: Dict[str, Any],
#     session_id: Optional[str] = None,
#     language: str = "en",
#     include_proactive_tips: bool = True,
#     current_user = Depends(get_current_user)
# ):
#     """Process a help chat query with context awareness"""
#     ... (disabled - use help_chat.py router)

# @router.get("/help/context") - DISABLED: Using help_chat.py router instead
# @router.post("/help/feedback") - DISABLED: Using help_chat.py router instead  
# @router.get("/help/tips") - DISABLED: Using help_chat.py router instead
# @router.post("/help/tips/dismiss") - DISABLED: Using help_chat.py router instead

# Note: The /help/analytics endpoint below is kept as it's not duplicated in help_chat.py

@router.get("/help/analytics")
async def get_help_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user = Depends(require_permission(Permission.system_admin))
):
    """Get help system analytics for administrators"""
    try:
        if not supabase:
            return {
                "total_queries": 0,
                "average_rating": 0,
                "common_topics": [],
                "user_satisfaction": 0,
                "tip_effectiveness": {}
            }
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date.replace(day=end_date.day - days)
        
        # Get help analytics data
        analytics_response = supabase.table("help_analytics").select("*").gte("timestamp", start_date.isoformat()).execute()
        analytics_data = analytics_response.data or []
        
        # Get feedback data
        feedback_response = supabase.table("help_feedback").select("*").gte("created_at", start_date.isoformat()).execute()
        feedback_data = feedback_response.data or []
        
        # Calculate metrics
        total_queries = len([a for a in analytics_data if a.get("event_type") == "query"])
        total_feedback = len(feedback_data)
        
        average_rating = 0
        if feedback_data:
            total_rating = sum(f.get("rating", 0) for f in feedback_data)
            average_rating = total_rating / len(feedback_data)
        
        # Common topics (mock data)
        common_topics = [
            {"topic": "Dashboard Navigation", "count": 45},
            {"topic": "Project Management", "count": 38},
            {"topic": "Financial Reporting", "count": 32},
            {"topic": "User Management", "count": 28},
            {"topic": "Risk Assessment", "count": 22}
        ]
        
        # User satisfaction
        user_satisfaction = average_rating / 5.0 if average_rating > 0 else 0
        
        # Tip effectiveness
        tip_events = [a for a in analytics_data if a.get("event_type") in ["tip_shown", "tip_dismissed"]]
        tip_effectiveness = {
            "tips_shown": len([t for t in tip_events if t.get("event_type") == "tip_shown"]),
            "tips_dismissed": len([t for t in tip_events if t.get("event_type") == "tip_dismissed"]),
            "engagement_rate": 0.75  # Mock calculation
        }
        
        return {
            "period_days": days,
            "total_queries": total_queries,
            "total_feedback": total_feedback,
            "average_rating": round(average_rating, 2),
            "common_topics": common_topics,
            "user_satisfaction": round(user_satisfaction, 2),
            "tip_effectiveness": tip_effectiveness,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Get help analytics error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get help analytics: {str(e)}")