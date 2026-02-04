"""
Phase 1-3: Enhanced Help Chat Router
Implements all 3 phases of AI Help Chat enhancement
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

from backend.auth.dependencies import get_current_user
from backend.services.help_chat_service import HelpChatService
from backend.services.rag_service import RAGService
from backend.services.proactive_tips_service import ProactiveTipsService
from backend.services.natural_language_actions_service import NaturalLanguageActionsService
from backend.models.help_logs import HelpLog

router = APIRouter(prefix="/help-chat", tags=["help-chat"])

# ============================================================================
# Phase 1: Request/Response Models with Context
# ============================================================================

class PageContext(BaseModel):
    """Page context for contextual help"""
    route: str
    page_title: str
    user_role: str
    organization_id: Optional[str] = None
    current_project: Optional[str] = None
    current_portfolio: Optional[str] = None
    relevant_data: Optional[Dict[str, Any]] = None


class HelpQueryRequest(BaseModel):
    """Enhanced help query with context"""
    query: str = Field(..., min_length=1, max_length=1000)
    session_id: Optional[str] = None
    context: PageContext
    language: str = Field(default="en", pattern="^(en|de|fr|es|it|pt|nl|pl|ru|zh|ja)$")
    include_proactive_tips: bool = True


class SourceReference(BaseModel):
    """Source reference for RAG"""
    id: str
    title: str
    url: Optional[str] = None
    type: str  # 'documentation', 'guide', 'faq', 'feature'
    relevance: float


class QuickAction(BaseModel):
    """Quick action button"""
    id: str
    label: str
    action: str  # Action string (e.g., "navigate:/projects", "guide:costbook")
    icon: Optional[str] = None
    variant: str = Field(default="secondary")


class HelpQueryResponse(BaseModel):
    """Enhanced help response"""
    response: str
    session_id: str
    sources: List[SourceReference]
    confidence: float
    response_time_ms: int
    proactive_tips: Optional[List[Dict[str, Any]]] = None
    suggested_actions: Optional[List[QuickAction]] = None
    is_cached: bool = False
    is_fallback: bool = False


class FeedbackRequest(BaseModel):
    """Feedback submission"""
    message_id: str
    rating: int = Field(..., ge=1, le=5)
    feedback_text: Optional[str] = None
    feedback_type: str = Field(..., pattern="^(helpful|not_helpful|incorrect|suggestion)$")


class FeedbackResponse(BaseModel):
    """Feedback response"""
    success: bool
    message: str
    tracking_id: Optional[str] = None


# ============================================================================
# Phase 2: Natural Language Actions Models
# ============================================================================

class NLActionRequest(BaseModel):
    """Natural language action request"""
    query: str
    context: PageContext


class NLActionResponse(BaseModel):
    """Natural language action response"""
    action_type: str  # 'fetch_data', 'navigate', 'open_modal', 'execute_command'
    action_data: Dict[str, Any]
    confidence: float
    explanation: str


# ============================================================================
# Phase 3: Multi-Language & Escalation Models
# ============================================================================

class TranslationRequest(BaseModel):
    """Translation request"""
    text: str
    source_language: str
    target_language: str


class EscalationRequest(BaseModel):
    """Human escalation request"""
    message_id: str
    query: str
    context: PageContext
    reason: str
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")


# ============================================================================
# Phase 1: Core Endpoints
# ============================================================================

@router.post("/query", response_model=HelpQueryResponse)
async def query_help(
    request: HelpQueryRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 1: Enhanced help query with page context and RAG
    
    Features:
    - Page context integration (route, role, relevant data)
    - RAG-based document retrieval
    - Contextual prompt enhancement
    - Feedback logging
    """
    start_time = datetime.now()
    
    try:
        # Initialize services
        help_service = HelpChatService()
        rag_service = RAGService()
        
        # Enhance prompt with context
        enhanced_prompt = f"""
User is {request.context.user_role} on page '{request.context.page_title}' (route: {request.context.route}).
Organization: {current_user.get('organization_id')}

Query: {request.query}
"""
        
        # Add relevant data context if available
        if request.context.relevant_data:
            enhanced_prompt += f"\nRelevant Data: {json.dumps(request.context.relevant_data, indent=2)}"
        
        # Retrieve RAG context (top-3 snippets)
        rag_results = await rag_service.search_documents(
            query=request.query,
            organization_id=current_user['organization_id'],
            limit=3
        )
        
        # Add RAG context to prompt
        if rag_results:
            rag_context = "\n\n".join([
                f"[{doc['title']}]: {doc['content']}"
                for doc in rag_results
            ])
            enhanced_prompt += f"\n\nRelevant Documentation:\n{rag_context}"
        
        # Generate response
        response_data = await help_service.generate_response(
            prompt=enhanced_prompt,
            session_id=request.session_id or f"session-{current_user['id']}-{int(datetime.now().timestamp())}",
            language=request.language
        )
        
        # Calculate response time
        response_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Convert RAG results to source references
        sources = [
            SourceReference(
                id=doc['id'],
                title=doc['title'],
                url=doc.get('url'),
                type=doc.get('type', 'documentation'),
                relevance=doc.get('relevance', 0.0)
            )
            for doc in rag_results
        ]
        
        # Generate suggested actions based on context
        suggested_actions = _generate_contextual_actions(request.context)
        
        # Log interaction (background task)
        background_tasks.add_task(
            _log_help_interaction,
            user_id=current_user['id'],
            organization_id=current_user['organization_id'],
            query=request.query,
            response=response_data['response'],
            confidence=response_data['confidence'],
            context=request.context.dict(),
            response_time_ms=response_time_ms
        )
        
        return HelpQueryResponse(
            response=response_data['response'],
            session_id=response_data['session_id'],
            sources=sources,
            confidence=response_data['confidence'],
            response_time_ms=response_time_ms,
            suggested_actions=suggested_actions,
            is_cached=response_data.get('is_cached', False),
            is_fallback=response_data.get('is_fallback', False)
        )
        
    except Exception as e:
        # Log error
        background_tasks.add_task(
            _log_help_error,
            user_id=current_user['id'],
            organization_id=current_user['organization_id'],
            query=request.query,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=f"Failed to process help query: {str(e)}")


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    request: FeedbackRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 1: Submit feedback for help response
    Logs feedback to Supabase help_logs table
    """
    try:
        help_service = HelpChatService()
        
        # Log feedback
        tracking_id = await help_service.log_feedback(
            message_id=request.message_id,
            user_id=current_user['id'],
            organization_id=current_user['organization_id'],
            rating=request.rating,
            feedback_text=request.feedback_text,
            feedback_type=request.feedback_type
        )
        
        return FeedbackResponse(
            success=True,
            message="Feedback submitted successfully",
            tracking_id=tracking_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


# ============================================================================
# Phase 2: Proactive Tips & Natural Language Actions
# ============================================================================

@router.get("/proactive-tips")
async def get_proactive_tips(
    context_route: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 2: Get proactive tips based on page context
    Triggered by Supabase Realtime data changes
    """
    try:
        tips_service = ProactiveTipsService()
        
        tips = await tips_service.get_tips_for_context(
            route=context_route,
            user_role=current_user.get('role', 'viewer'),
            organization_id=current_user['organization_id']
        )
        
        return {"tips": tips}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch proactive tips: {str(e)}")


@router.post("/natural-language-action", response_model=NLActionResponse)
async def execute_natural_language_action(
    request: NLActionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 2: Parse and execute natural language actions
    Uses OpenAI Function Calling to determine action
    
    Examples:
    - "Show me the current EAC for Project Alpha"
    - "Open the costbook for Q4"
    - "Create a new risk for budget overrun"
    """
    try:
        nl_service = NaturalLanguageActionsService()
        
        # Parse query to determine action
        action_result = await nl_service.parse_and_execute(
            query=request.query,
            context=request.context.dict(),
            user_id=current_user['id'],
            organization_id=current_user['organization_id']
        )
        
        return NLActionResponse(
            action_type=action_result['action_type'],
            action_data=action_result['action_data'],
            confidence=action_result['confidence'],
            explanation=action_result['explanation']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute action: {str(e)}")


# ============================================================================
# Phase 3: Multi-Language & Human Escalation
# ============================================================================

@router.post("/translate")
async def translate_text(
    request: TranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 3: Translate query/response using DeepL API
    """
    try:
        help_service = HelpChatService()
        
        translated_text = await help_service.translate(
            text=request.text,
            source_language=request.source_language,
            target_language=request.target_language
        )
        
        return {"translated_text": translated_text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@router.post("/escalate")
async def escalate_to_support(
    request: EscalationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 3: Escalate to human support
    Creates support ticket (e.g., Intercom integration)
    """
    try:
        help_service = HelpChatService()
        
        # Create support ticket
        ticket_id = await help_service.create_support_ticket(
            user_id=current_user['id'],
            user_email=current_user.get('email'),
            organization_id=current_user['organization_id'],
            message_id=request.message_id,
            query=request.query,
            context=request.context.dict(),
            reason=request.reason,
            priority=request.priority
        )
        
        return {
            "success": True,
            "ticket_id": ticket_id,
            "message": "Your request has been escalated to our support team"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Escalation failed: {str(e)}")


# ============================================================================
# Admin Endpoints: Analytics & Fine-Tuning
# ============================================================================

@router.get("/admin/analytics")
async def get_help_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Phase 1: Admin analytics for help chat
    Shows query trends, ratings, response times
    """
    # Require admin role
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        help_service = HelpChatService()
        
        analytics = await help_service.get_analytics(
            organization_id=current_user['organization_id'],
            start_date=start_date,
            end_date=end_date
        )
        
        return analytics
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")


# ============================================================================
# Helper Functions
# ============================================================================

def _generate_contextual_actions(context: PageContext) -> List[QuickAction]:
    """Generate contextual quick actions based on page"""
    actions = []
    
    # Route-specific actions
    if context.route == '/financials/costbook':
        actions.extend([
            QuickAction(
                id="view-variance",
                label="Show Variance Analysis",
                action="fetch:costbook/variance",
                icon="TrendingUp"
            ),
            QuickAction(
                id="export-costbook",
                label="Export Costbook",
                action="execute:export/costbook",
                icon="Download"
            )
        ])
    elif context.route == '/projects':
        actions.extend([
            QuickAction(
                id="create-project",
                label="Create New Project",
                action="navigate:/projects/new",
                icon="Plus"
            ),
            QuickAction(
                id="view-gantt",
                label="View Gantt Chart",
                action="navigate:/projects/gantt",
                icon="Calendar"
            )
        ])
    
    # Role-specific actions
    if context.user_role == 'admin':
        actions.append(
            QuickAction(
                id="admin-panel",
                label="Go to Admin Panel",
                action="navigate:/admin",
                icon="Settings",
                variant="primary"
            )
        )
    
    return actions


async def _log_help_interaction(
    user_id: str,
    organization_id: str,
    query: str,
    response: str,
    confidence: float,
    context: Dict[str, Any],
    response_time_ms: int
):
    """Background task to log help interaction"""
    try:
        help_service = HelpChatService()
        await help_service.log_interaction(
            user_id=user_id,
            organization_id=organization_id,
            query=query,
            response=response,
            confidence=confidence,
            context=context,
            response_time_ms=response_time_ms,
            success=True
        )
    except Exception as e:
        print(f"Failed to log help interaction: {e}")


async def _log_help_error(
    user_id: str,
    organization_id: str,
    query: str,
    error: str
):
    """Background task to log help error"""
    try:
        help_service = HelpChatService()
        await help_service.log_interaction(
            user_id=user_id,
            organization_id=organization_id,
            query=query,
            response="",
            confidence=0.0,
            context={},
            response_time_ms=0,
            success=False,
            error_message=error
        )
    except Exception as e:
        print(f"Failed to log help error: {e}")
