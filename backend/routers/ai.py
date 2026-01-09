"""
AI agent endpoints - RAG, resource optimization, risk forecasting, help chat
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from uuid import UUID
from typing import Optional, Dict, Any, List
from datetime import datetime

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

# Help Chat Endpoints
@router.post("/help/query")
async def process_help_query(
    query: str,
    context: Dict[str, Any],
    session_id: Optional[str] = None,
    language: str = "en",
    include_proactive_tips: bool = True,
    current_user = Depends(get_current_user)
):
    """Process a help chat query with context awareness"""
    try:
        if not query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        if not context:
            raise HTTPException(status_code=400, detail="Context is required for help queries")
        
        user_id = current_user.get("user_id")
        
        # Generate session ID if not provided
        if not session_id:
            session_id = f"help-session-{int(datetime.now().timestamp())}-{user_id}"
        
        # Store help session if new
        if supabase:
            try:
                # Check if session exists
                session_response = supabase.table("help_sessions").select("id").eq("session_id", session_id).execute()
                
                if not session_response.data:
                    # Create new session
                    session_data = {
                        "user_id": user_id,
                        "session_id": session_id,
                        "page_context": context,
                        "language": language
                    }
                    supabase.table("help_sessions").insert(session_data).execute()
            except Exception as e:
                print(f"Error managing help session: {e}")
        
        # Mock AI response (in real implementation, this would use the RAG agent)
        response_content = f"I understand you're asking about: {query}\n\n"
        
        # Context-aware response based on current page
        page_route = context.get("route", "/")
        page_title = context.get("pageTitle", "Dashboard")
        
        if "dashboard" in page_route.lower() or "dashboard" in page_title.lower():
            response_content += "Since you're on the Dashboard, I can help you with:\n"
            response_content += "- Understanding key metrics and KPIs\n"
            response_content += "- Navigating to different project areas\n"
            response_content += "- Setting up custom dashboard views\n"
        elif "project" in page_route.lower():
            response_content += "For project management, I can assist with:\n"
            response_content += "- Creating and managing project tasks\n"
            response_content += "- Resource allocation and scheduling\n"
            response_content += "- Risk assessment and mitigation\n"
        elif "financial" in page_route.lower():
            response_content += "For financial management, I can help with:\n"
            response_content += "- Budget tracking and forecasting\n"
            response_content += "- Cost analysis and optimization\n"
            response_content += "- Financial reporting and compliance\n"
        else:
            response_content += "I can help you navigate and use the PPM platform effectively. "
            response_content += "Feel free to ask about any features or functionality you'd like to learn about."
        
        # Mock sources
        sources = [
            {
                "id": "doc-1",
                "title": f"{page_title} Documentation",
                "url": f"/docs{page_route}",
                "type": "documentation",
                "relevance": 0.95
            },
            {
                "id": "guide-1", 
                "title": "PPM Best Practices Guide",
                "url": "/guides/best-practices",
                "type": "guide",
                "relevance": 0.87
            }
        ]
        
        # Mock proactive tips
        proactive_tips = []
        if include_proactive_tips:
            if "dashboard" in page_route.lower():
                proactive_tips.append({
                    "id": "tip-dashboard-1",
                    "type": "feature_discovery",
                    "title": "Customize Your Dashboard",
                    "content": "Did you know you can customize your dashboard widgets? Click the settings icon to add or remove widgets based on your needs.",
                    "priority": "medium",
                    "trigger_context": ["dashboard"],
                    "actions": [
                        {
                            "id": "action-customize",
                            "label": "Show me how",
                            "action": "guide:dashboard-customization"
                        }
                    ],
                    "dismissible": True,
                    "show_once": True
                })
        
        # Store help message
        if supabase:
            try:
                message_data = {
                    "session_id": session_id,
                    "message_type": "user",
                    "content": query,
                    "sources": None,
                    "confidence_score": None,
                    "response_time_ms": None
                }
                supabase.table("help_messages").insert(message_data).execute()
                
                # Store assistant response
                response_data = {
                    "session_id": session_id,
                    "message_type": "assistant", 
                    "content": response_content,
                    "sources": sources,
                    "confidence_score": 0.85,
                    "response_time_ms": 1200
                }
                supabase.table("help_messages").insert(response_data).execute()
            except Exception as e:
                print(f"Error storing help messages: {e}")
        
        return {
            "response": response_content,
            "session_id": session_id,
            "sources": sources,
            "confidence": 0.85,
            "response_time_ms": 1200,
            "proactive_tips": proactive_tips,
            "suggested_actions": [
                {
                    "id": "action-docs",
                    "label": "View Documentation",
                    "action": f"navigate:/docs{page_route}"
                },
                {
                    "id": "action-support",
                    "label": "Contact Support",
                    "action": "navigate:/feedback"
                }
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Help query processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process help query: {str(e)}")

@router.get("/help/context")
async def get_help_context(
    page_route: str = Query(..., description="Current page route"),
    current_user = Depends(get_current_user)
):
    """Get contextual help information for the current page"""
    try:
        # Mock context-aware help data
        context_data = {
            "context": {
                "route": page_route,
                "pageTitle": "Current Page",
                "userRole": current_user.get("role", "user")
            },
            "available_actions": [
                {
                    "id": "action-help",
                    "label": "Get Help",
                    "action": "help:general"
                },
                {
                    "id": "action-guide",
                    "label": "View Guide", 
                    "action": f"guide:{page_route.replace('/', '')}"
                }
            ],
            "relevant_tips": []
        }
        
        # Add page-specific tips
        if "dashboard" in page_route.lower():
            context_data["relevant_tips"].append({
                "id": "tip-dashboard-overview",
                "type": "welcome",
                "title": "Dashboard Overview",
                "content": "Your dashboard shows key project metrics and recent activity. Use the filters to customize your view.",
                "priority": "low",
                "trigger_context": ["dashboard"],
                "dismissible": True,
                "show_once": False
            })
        
        return context_data
        
    except Exception as e:
        print(f"Get help context error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get help context: {str(e)}")

@router.post("/help/feedback")
async def submit_help_feedback(
    message_id: str,
    rating: int,
    feedback_text: Optional[str] = None,
    feedback_type: str = "helpful",
    current_user = Depends(get_current_user)
):
    """Submit feedback for a help chat response"""
    try:
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        if not message_id:
            raise HTTPException(status_code=400, detail="Message ID is required")
        
        user_id = current_user.get("user_id")
        
        # Store feedback
        if supabase:
            try:
                feedback_data = {
                    "message_id": message_id,
                    "user_id": user_id,
                    "rating": rating,
                    "feedback_text": feedback_text,
                    "feedback_type": feedback_type
                }
                
                response = supabase.table("help_feedback").insert(feedback_data).execute()
                
                if not response.data:
                    raise HTTPException(status_code=400, detail="Failed to store feedback")
                
                # Track analytics event
                analytics_data = {
                    "user_id": user_id,
                    "event_type": "feedback_submitted",
                    "event_data": {
                        "message_id": message_id,
                        "rating": rating,
                        "feedback_type": feedback_type
                    },
                    "page_context": {}
                }
                supabase.table("help_analytics").insert(analytics_data).execute()
                
            except Exception as e:
                print(f"Error storing help feedback: {e}")
                raise HTTPException(status_code=500, detail="Failed to store feedback")
        
        return {
            "success": True,
            "message": "Thank you for your feedback! It helps us improve the help system.",
            "tracking_id": f"feedback-{int(datetime.now().timestamp())}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submit help feedback error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

@router.get("/help/tips")
async def get_proactive_tips(
    page_route: str = Query(..., description="Current page route"),
    page_title: str = Query("", description="Current page title"),
    user_role: str = Query("user", description="User role"),
    user_level: str = Query("intermediate", description="User experience level"),
    session_count: int = Query(1, description="Number of sessions"),
    time_on_page: int = Query(0, description="Time spent on current page in seconds"),
    current_user = Depends(get_current_user)
):
    """Get proactive tips based on user context and behavior"""
    try:
        user_id = current_user.get("user_id")
        tips = []
        
        # Generate contextual tips based on page and user behavior
        if "dashboard" in page_route.lower():
            if session_count <= 3:  # New user
                tips.append({
                    "tip_id": "welcome-dashboard",
                    "tip_type": "welcome",
                    "title": "Welcome to Your Dashboard",
                    "content": "Your dashboard provides an overview of all your projects and key metrics. You can customize widgets by clicking the settings icon.",
                    "priority": "high",
                    "trigger_context": ["dashboard", "new_user"],
                    "actions": [
                        {
                            "id": "tour-dashboard",
                            "label": "Take Dashboard Tour",
                            "action": "tour:dashboard"
                        }
                    ],
                    "dismissible": True,
                    "show_once": True
                })
            
            if time_on_page > 60:  # User spending time on dashboard
                tips.append({
                    "tip_id": "dashboard-efficiency",
                    "tip_type": "optimization",
                    "title": "Dashboard Efficiency Tip",
                    "content": "You can save time by setting up custom filters and bookmarking frequently used views.",
                    "priority": "medium",
                    "trigger_context": ["dashboard", "extended_time"],
                    "actions": [
                        {
                            "id": "setup-filters",
                            "label": "Setup Filters",
                            "action": "guide:dashboard-filters"
                        }
                    ],
                    "dismissible": True,
                    "show_once": False
                })
        
        elif "project" in page_route.lower():
            tips.append({
                "tip_id": "project-best-practices",
                "tip_type": "best_practice",
                "title": "Project Management Best Practice",
                "content": "Regular status updates and milestone tracking help keep projects on schedule. Consider setting up automated reminders.",
                "priority": "medium",
                "trigger_context": ["projects"],
                "actions": [
                    {
                        "id": "setup-reminders",
                        "label": "Setup Reminders",
                        "action": "guide:project-reminders"
                    }
                ],
                "dismissible": True,
                "show_once": False
            })
        
        # Track analytics
        if supabase and tips:
            try:
                analytics_data = {
                    "user_id": user_id,
                    "event_type": "tips_shown",
                    "event_data": {
                        "tip_count": len(tips),
                        "tip_ids": [tip["tip_id"] for tip in tips]
                    },
                    "page_context": {
                        "route": page_route,
                        "title": page_title,
                        "time_on_page": time_on_page
                    }
                }
                supabase.table("help_analytics").insert(analytics_data).execute()
            except Exception as e:
                print(f"Error tracking tip analytics: {e}")
        
        return {
            "tips": tips,
            "context": {
                "route": page_route,
                "title": page_title,
                "user_level": user_level
            },
            "next_check_time": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Get proactive tips error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get proactive tips: {str(e)}")

@router.post("/help/tips/dismiss")
async def dismiss_proactive_tip(
    tip_id: str,
    current_user = Depends(get_current_user)
):
    """Dismiss a proactive tip"""
    try:
        user_id = current_user.get("user_id")
        
        # Track tip dismissal
        if supabase:
            try:
                analytics_data = {
                    "user_id": user_id,
                    "event_type": "tip_dismissed",
                    "event_data": {
                        "tip_id": tip_id
                    },
                    "page_context": {}
                }
                supabase.table("help_analytics").insert(analytics_data).execute()
            except Exception as e:
                print(f"Error tracking tip dismissal: {e}")
        
        return {
            "success": True,
            "message": "Tip dismissed successfully"
        }
        
    except Exception as e:
        print(f"Dismiss tip error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to dismiss tip: {str(e)}")

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