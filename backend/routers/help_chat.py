"""
Help Chat API Router
Provides endpoints for AI-powered in-app help chat system
"""

import time
from fastapi import APIRouter, HTTPException, Depends, status, Request, Body
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
import logging

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from services.help_rag_agent import HelpRAGAgent, PageContext, UserBehavior
from services.proactive_tips_engine import ProactiveTipsEngine, UserBehaviorPattern
from services.translation_service import TranslationService, TranslationRequest, SupportedLanguage
from services.visual_guide_service import visual_guide_service
from services.analytics_tracker import get_analytics_tracker, EventType
from services.help_chat_performance import get_help_chat_performance
from services.help_chat_cache import get_cached_response, set_cached_response  # Neues Caching

# Import rate limiting
try:
    from performance_optimization import limiter
except ImportError:
    # Fallback if performance optimization not available
    def limiter_fallback(rate: str):
        def decorator(func):
            return func
        return decorator
    limiter = type('MockLimiter', (), {'limit': limiter_fallback})()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/help", tags=["help-chat"])

# Pydantic models for request/response
class HelpQueryRequest(BaseModel):
    query: str = Field(..., description="User's help query")
    session_id: Optional[str] = Field(None, description="Optional session ID for continuity")
    context: Dict[str, Any] = Field(..., description="Current page context")
    language: str = Field("en", description="Response language (en, de, fr)")
    include_proactive_tips: bool = Field(False, description="Include proactive tips in response")

class HelpContextRequest(BaseModel):
    page_route: str = Field(..., description="Current page route")
    page_title: str = Field(..., description="Current page title")
    user_role: str = Field(..., description="User's role")
    current_project: Optional[str] = Field(None, description="Current project ID")
    current_portfolio: Optional[str] = Field(None, description="Current portfolio ID")
    relevant_data: Optional[Dict[str, Any]] = Field(None, description="Additional relevant data")

class HelpFeedbackRequest(BaseModel):
    message_id: Optional[str] = Field(None, description="ID of the message being rated")
    session_id: Optional[str] = Field(None, description="Session ID")
    rating: Optional[int] = Field(None, description="Rating from 1-5")
    feedback_text: Optional[str] = Field(None, description="Optional feedback text")
    feedback_type: str = Field(..., description="Type of feedback (helpful, not_helpful, incorrect, suggestion)")

class ProactiveTipsRequest(BaseModel):
    context: HelpContextRequest = Field(..., description="Current page context")
    user_behavior: Dict[str, Any] = Field(..., description="User behavior data")

class SourceReference(BaseModel):
    type: str
    id: str
    title: str
    similarity: float
    url: str

class QuickAction(BaseModel):
    id: str
    label: str
    action: str
    target: Optional[str] = None

class GuideReference(BaseModel):
    id: str
    title: str
    type: str
    description: str
    url: str
    estimated_time: str

class ProactiveTipResponse(BaseModel):
    tip_id: str
    tip_type: str
    title: str
    content: str
    priority: str
    trigger_context: List[str]
    actions: List[QuickAction]
    dismissible: bool
    show_once: bool

class HelpQueryResponse(BaseModel):
    response: str
    session_id: str
    sources: List[SourceReference]
    confidence: float
    response_time_ms: int
    proactive_tips: Optional[List[ProactiveTipResponse]] = None
    suggested_actions: Optional[List[QuickAction]] = None
    related_guides: Optional[List[GuideReference]] = None
    is_cached: Optional[bool] = False
    is_fallback: Optional[bool] = False

class HelpContextResponse(BaseModel):
    context_data: Dict[str, Any]
    suggested_queries: List[str]
    relevant_features: List[str]

class FeedbackResponse(BaseModel):
    message: str
    feedback_id: Optional[str] = None

class ProactiveTipsResponse(BaseModel):
    tips: List[ProactiveTipResponse]
    context_analyzed: Dict[str, Any]

# Initialize help RAG agent, proactive tips engine, and translation service (will be done in startup)
help_rag_agent: Optional[HelpRAGAgent] = None
proactive_tips_engine: Optional[ProactiveTipsEngine] = None
translation_service: Optional[TranslationService] = None

def get_help_rag_agent() -> HelpRAGAgent:
    """Get the help RAG agent instance"""
    global help_rag_agent
    if help_rag_agent is None:
        # Initialize with environment variables
        import os
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=503, 
                detail="Help chat service unavailable - OpenAI API key not configured"
            )
        help_rag_agent = HelpRAGAgent(supabase, openai_api_key)
    return help_rag_agent

def get_proactive_tips_engine() -> ProactiveTipsEngine:
    """Get the proactive tips engine instance"""
    global proactive_tips_engine
    if proactive_tips_engine is None:
        proactive_tips_engine = ProactiveTipsEngine(supabase)
    return proactive_tips_engine

def get_translation_service() -> TranslationService:
    """Get the translation service instance"""
    global translation_service
    if translation_service is None:
        # Initialize with environment variables
        import os
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=503, 
                detail="Translation service unavailable - OpenAI API key not configured"
            )
        translation_service = TranslationService(supabase, openai_api_key)
    return translation_service

@router.post("/query", response_model=HelpQueryResponse)
# Rate limiting temporarily disabled for debugging
async def process_help_query(
    help_request: HelpQueryRequest,
    request: Request = None,
    current_user = Depends(get_current_user)
):
    """Process user help query and return AI-generated response with Supabase caching"""
    start_time = time.time()
    performance_service = get_help_chat_performance()
    
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # 1. Check Supabase cache first (NEW)
        cached_response = await get_cached_response(
            query=help_request.query,
            user_id=current_user["user_id"],
            context=help_request.context
        )
        
        if cached_response:
            # Record cache hit
            await performance_service.record_operation_performance(
                'help_query_cached', start_time, True
            )
            
            # Add cache indicator to response
            cached_response['is_cached'] = True
            cached_response['response_time_ms'] = int((time.time() - start_time) * 1000)
            logger.info(f"Returning cached response (took {cached_response['response_time_ms']}ms)")
            return HelpQueryResponse(**cached_response)
        
        # 2. Check if we should use fallback due to performance issues
        if performance_service.should_use_fallback():
            fallback_response = await performance_service.get_fallback_response(
                help_request.query, help_request.context
            )
            
            await performance_service.record_operation_performance(
                'help_query_fallback', start_time, True
            )
            
            return HelpQueryResponse(
                response=fallback_response['response'],
                session_id=f"fallback_{int(time.time())}",
                sources=fallback_response['sources'],
                confidence=fallback_response['confidence'],
                response_time_ms=int((time.time() - start_time) * 1000),
                suggested_actions=fallback_response['suggested_actions'],
                is_fallback=True
            )
        
        # 3. Get help RAG agent and process query
        agent = get_help_rag_agent()
        
        # Create page context from request
        context = PageContext(
            route=help_request.context.get("route", ""),
            page_title=help_request.context.get("pageTitle", ""),
            user_role=help_request.context.get("userRole", "user"),
            current_project=help_request.context.get("currentProject"),
            current_portfolio=help_request.context.get("currentPortfolio"),
            relevant_data=help_request.context.get("relevantData", {})
        )
        
        # Process the help query
        help_response = await agent.process_help_query(
            query=help_request.query,
            context=context,
            user_id=current_user["user_id"],
            language=help_request.language
        )
        
        # 4. Prepare response data for caching
        response_data = {
            'response': help_response.response,
            'session_id': help_response.session_id,
            'sources': [
                {
                    'type': source["type"],
                    'id': source["id"],
                    'title': source["title"],
                    'similarity': source["similarity"],
                    'url': source["url"]
                } for source in help_response.sources
            ],
            'confidence': help_response.confidence,
            'response_time_ms': help_response.response_time_ms,
            'suggested_actions': [
                {'id': action['id'], 'label': action['label'], 'action': action['action'], 'target': action.get('target')}
                for action in help_response.suggested_actions
            ] if help_response.suggested_actions else None,
            'related_guides': [
                {
                    'id': guide["id"],
                    'title': guide["title"],
                    'type': guide["type"],
                    'description': guide["description"],
                    'url': guide["url"],
                    'estimated_time': guide["estimated_time"]
                } for guide in help_response.related_guides
            ] if help_response.related_guides else None
        }
        
        # 5. Cache response in Supabase with TTL based on confidence (NEW)
        cache_ttl = 600 if help_response.confidence > 0.8 else 300  # 10 min for high confidence, 5 min for lower
        await set_cached_response(
            query=help_request.query,
            user_id=current_user["user_id"],
            response=response_data,
            context=help_request.context,
            ttl=cache_ttl
        )
        
        # 6. Record performance metrics
        await performance_service.record_operation_performance(
            'help_query_ai', start_time, True
        )
        
        # 7. Track analytics for the query
        analytics_tracker = get_analytics_tracker()
        await analytics_tracker.track_query(
            user_id=current_user["user_id"],
            query=help_request.query,
            response=help_response.response,
            response_time_ms=help_response.response_time_ms,
            confidence=help_response.confidence,
            sources=help_response.sources,
            page_context=help_request.context,
            session_id=help_response.session_id
        )
        
        # Generate proactive tips if requested
        proactive_tips = []
        if help_request.include_proactive_tips:
            user_behavior = UserBehavior(
                recent_pages=help_request.context.get("recentPages", []),
                time_on_page=help_request.context.get("timeOnPage", 0),
                frequent_queries=help_request.context.get("frequentQueries", []),
                user_level=help_request.context.get("userLevel", "intermediate")
            )
            
            tips = await agent.generate_proactive_tips(context, user_behavior)
            proactive_tips = [
                ProactiveTipResponse(
                    tip_id=tip.tip_id,
                    tip_type=tip.tip_type,
                    title=tip.title,
                    content=tip.content,
                    priority=tip.priority,
                    trigger_context=tip.trigger_context,
                    actions=[QuickAction(**action) for action in tip.actions],
                    dismissible=tip.dismissible,
                    show_once=tip.show_once
                ) for tip in tips
            ]
        
        # Convert response to API format
        return HelpQueryResponse(
            response=help_response.response,
            session_id=help_response.session_id,
            sources=[
                SourceReference(
                    type=source["type"],
                    id=source["id"],
                    title=source["title"],
                    similarity=source["similarity"],
                    url=source["url"]
                ) for source in help_response.sources
            ],
            confidence=help_response.confidence,
            response_time_ms=help_response.response_time_ms,
            proactive_tips=proactive_tips if proactive_tips else None,
            suggested_actions=[
                QuickAction(**action) for action in help_response.suggested_actions
            ] if help_response.suggested_actions else None,
            related_guides=[
                GuideReference(
                    id=guide["id"],
                    title=guide["title"],
                    type=guide["type"],
                    description=guide["description"],
                    url=guide["url"],
                    estimated_time=guide["estimated_time"]
                ) for guide in help_response.related_guides
            ] if help_response.related_guides else None,
            is_cached=False
        )
        
    except HTTPException:
        # Record error performance
        await performance_service.record_operation_performance(
            'help_query_error', start_time, False, 'http_exception'
        )
        raise
    except Exception as e:
        # Record error performance
        await performance_service.record_operation_performance(
            'help_query_error', start_time, False, 'general_exception'
        )
        
        logger.error(f"Help query processing failed: {e}")
        
        # Return fallback response on error
        try:
            fallback_response = await performance_service.get_fallback_response(
                help_request.query, help_request.context
            )
            
            return HelpQueryResponse(
                response=fallback_response['response'],
                session_id=f"error_fallback_{int(time.time())}",
                sources=fallback_response['sources'],
                confidence=fallback_response['confidence'],
                response_time_ms=int((time.time() - start_time) * 1000),
                suggested_actions=fallback_response['suggested_actions'],
                is_fallback=True
            )
        except:
            # Last resort fallback
            raise HTTPException(
                status_code=500, 
                detail=f"Help service temporarily unavailable. Please try again later."
            )

@router.get("/context", response_model=HelpContextResponse)
@limiter.limit("60/minute")  # Rate limit: 60 context requests per minute per user
async def get_help_context(
    request: Request,  # Required for rate limiting
    page_route: str,
    page_title: str = "",
    user_role: str = "user",
    current_project: Optional[str] = None,
    current_portfolio: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get contextual help information for the current page"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get help RAG agent
        agent = get_help_rag_agent()
        
        # Create page context
        context = PageContext(
            route=page_route,
            page_title=page_title,
            user_role=user_role,
            current_project=current_project,
            current_portfolio=current_portfolio
        )
        
        # Get contextual data
        contextual_data = await agent._get_contextual_ppm_data(context, current_user["user_id"])
        
        # Generate suggested queries based on context
        suggested_queries = _generate_suggested_queries(page_route, contextual_data)
        
        # Get relevant features for current page
        relevant_features = _get_relevant_features(page_route)
        
        return HelpContextResponse(
            context_data=contextual_data,
            suggested_queries=suggested_queries,
            relevant_features=relevant_features
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Help context retrieval failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve help context: {str(e)}"
        )

@router.post("/feedback", response_model=FeedbackResponse)
@limiter.limit("30/minute")  # Rate limit: 30 feedback submissions per minute per user
async def submit_help_feedback(
    request: Request,  # Required for rate limiting
    feedback_request: HelpFeedbackRequest,
    current_user = Depends(get_current_user)
):
    """Submit feedback on help chat responses"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate rating if provided
        if feedback_request.rating and (feedback_request.rating < 1 or feedback_request.rating > 5):
            raise HTTPException(
                status_code=400, 
                detail="Rating must be between 1 and 5"
            )
        
        # Store feedback in database
        feedback_data = {
            "message_id": feedback_request.message_id,
            "user_id": current_user["user_id"],
            "rating": feedback_request.rating,
            "feedback_text": feedback_request.feedback_text,
            "feedback_type": feedback_request.feedback_type,
            "created_at": datetime.now().isoformat()
        }
        
        response = supabase.table("help_feedback").insert(feedback_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=400, 
                detail="Failed to submit feedback"
            )
        
        # Track analytics for feedback
        analytics_tracker = get_analytics_tracker()
        await analytics_tracker.track_feedback(
            user_id=current_user["user_id"],
            message_id=feedback_request.message_id,
            rating=feedback_request.rating,
            feedback_text=feedback_request.feedback_text,
            feedback_type=feedback_request.feedback_type,
            page_context={},  # Could be enhanced to include current page context
            session_id=None
        )
        
        return FeedbackResponse(
            message="Feedback submitted successfully",
            feedback_id=response.data[0]["id"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Help feedback submission failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to submit feedback: {str(e)}"
        )

@router.get("/tips", response_model=ProactiveTipsResponse)
@limiter.limit("40/minute")  # Rate limit: 40 tip requests per minute per user
async def get_proactive_tips(
    request: Request,  # Required for rate limiting
    page_route: str,
    page_title: str = "",
    user_role: str = "user",
    current_project: Optional[str] = None,
    current_portfolio: Optional[str] = None,
    recent_pages: str = "",  # Comma-separated list
    time_on_page: int = 0,
    frequent_queries: str = "",  # Comma-separated list
    user_level: str = "intermediate",
    session_count: int = 1,
    current_user = Depends(get_current_user)
):
    """Get proactive tips based on user context and behavior"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get proactive tips engine
        tips_engine = get_proactive_tips_engine()
        
        # Create page context
        from services.proactive_tips_engine import PageContext as TipsPageContext
        context = TipsPageContext(
            route=page_route,
            page_title=page_title,
            user_role=user_role,
            current_project=current_project,
            current_portfolio=current_portfolio
        )
        
        # Create user behavior pattern
        user_behavior = UserBehaviorPattern(
            user_id=current_user["user_id"],
            recent_pages=recent_pages.split(",") if recent_pages else [],
            time_on_page=time_on_page,
            frequent_queries=frequent_queries.split(",") if frequent_queries else [],
            user_level=user_level,
            session_count=session_count,
            last_login=datetime.now(),
            feature_usage={},  # Will be populated from user data
            error_patterns=[],
            dismissed_tips=[]
        )
        
        # Get user's feature usage and dismissed tips
        try:
            user_profile_response = supabase.table("user_profiles").select("preferences, feature_usage").eq("user_id", current_user["user_id"]).execute()
            if user_profile_response.data:
                profile = user_profile_response.data[0]
                user_behavior.feature_usage = profile.get("feature_usage", {})
                user_behavior.dismissed_tips = profile.get("preferences", {}).get("dismissed_tips", [])
        except Exception as e:
            logger.warning(f"Could not load user profile data: {e}")
        
        # Generate proactive tips
        tips = await tips_engine.generate_proactive_tips(context, user_behavior)
        
        # Convert to response format
        tip_responses = []
        for tip in tips:
            tip_responses.append(ProactiveTipResponse(
                tip_id=tip.tip_id,
                tip_type=tip.tip_type.value,
                title=tip.title,
                content=tip.content,
                priority=tip.priority.value,
                trigger_context=tip.trigger_context,
                actions=[QuickAction(
                    id=action.id,
                    label=action.label,
                    action=action.action,
                    target=action.target
                ) for action in tip.actions],
                dismissible=tip.dismissible,
                show_once=tip.show_once
            ))
        
        # Track analytics for tips generation
        analytics_tracker = get_analytics_tracker()
        page_context = {
            "route": page_route,
            "page_title": page_title,
            "user_role": user_role,
            "current_project": current_project,
            "current_portfolio": current_portfolio
        }
        
        # Track each tip shown
        for tip in tips:
            await analytics_tracker.track_proactive_tip(
                user_id=current_user["user_id"],
                tip_id=tip.tip_id,
                tip_type=tip.tip_type.value,
                action="shown",
                page_context=page_context,
                session_id=None
            )
        
        return ProactiveTipsResponse(
            tips=tip_responses,
            context_analyzed={
                "page_route": page_route,
                "user_level": user_level,
                "time_on_page": time_on_page,
                "session_count": session_count
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proactive tips generation failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate proactive tips: {str(e)}"
        )

@router.post("/tips/dismiss", response_model=FeedbackResponse)
@limiter.limit("60/minute")  # Rate limit: 60 dismissals per minute per user
async def dismiss_proactive_tip(
    request: Request,  # Required for rate limiting
    tip_id: str,
    current_user = Depends(get_current_user)
):
    """Dismiss a proactive tip"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get proactive tips engine
        tips_engine = get_proactive_tips_engine()
        
        # Dismiss the tip
        success = await tips_engine.dismiss_tip(current_user["user_id"], tip_id)
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to dismiss tip"
            )
        
        # Track analytics for tip dismissal
        analytics_tracker = get_analytics_tracker()
        await analytics_tracker.track_proactive_tip(
            user_id=current_user["user_id"],
            tip_id=tip_id,
            tip_type="unknown",  # We don't have tip type in dismiss request
            action="dismissed",
            page_context={},  # Could be enhanced to include current page context
            session_id=None
        )
        
        return FeedbackResponse(
            message="Tip dismissed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tip dismissal failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to dismiss tip: {str(e)}"
        )

@router.get("/languages", response_model=List[Dict[str, Any]])
async def get_supported_languages(
    current_user = Depends(get_current_user)
):
    """Get list of supported languages"""
    try:
        translation_service = get_translation_service()
        languages = await translation_service.get_supported_languages()
        return languages
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get supported languages: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get supported languages: {str(e)}"
        )

@router.get("/language/preference", response_model=Dict[str, str])
async def get_user_language_preference(
    current_user = Depends(get_current_user)
):
    """Get user's language preference"""
    try:
        translation_service = get_translation_service()
        language = await translation_service.get_user_language_preference(current_user["user_id"])
        return {"language": language}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get language preference: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get language preference: {str(e)}"
        )

@router.post("/language/preference", response_model=FeedbackResponse)
async def set_user_language_preference(
    language: str,
    current_user = Depends(get_current_user)
):
    """Set user's language preference"""
    try:
        # Validate language
        supported_languages = [lang.value for lang in SupportedLanguage]
        if language not in supported_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language. Supported languages: {', '.join(supported_languages)}"
            )
        
        translation_service = get_translation_service()
        success = await translation_service.set_user_language_preference(current_user["user_id"], language)
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to set language preference"
            )
        
        return FeedbackResponse(
            message=f"Language preference set to {language}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set language preference: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set language preference: {str(e)}"
        )

@router.post("/language/detect", response_model=Dict[str, Any])
async def detect_content_language(
    content: str,
    current_user = Depends(get_current_user)
):
    """Detect the language of given content"""
    try:
        if not content or len(content.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Content must be at least 10 characters long for language detection"
            )
        
        translation_service = get_translation_service()
        detection_result = await translation_service.detect_language(content)
        
        return {
            "detected_language": detection_result.detected_language,
            "confidence": detection_result.confidence,
            "alternatives": [
                {"language": lang, "confidence": conf} 
                for lang, conf in detection_result.alternative_languages
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Language detection failed: {str(e)}"
        )

@router.post("/translate", response_model=Dict[str, Any])
@limiter.limit("10/minute")  # Rate limit: 10 translations per minute per user
async def translate_content(
    request: Request,  # Required for rate limiting
    content: str,
    target_language: str,
    source_language: str = "en",
    content_type: str = "general",
    current_user = Depends(get_current_user)
):
    """Translate content to target language"""
    try:
        # Validate languages
        supported_languages = [lang.value for lang in SupportedLanguage]
        if source_language not in supported_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported source language. Supported: {', '.join(supported_languages)}"
            )
        if target_language not in supported_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported target language. Supported: {', '.join(supported_languages)}"
            )
        
        if not content or len(content.strip()) < 1:
            raise HTTPException(
                status_code=400,
                detail="Content cannot be empty"
            )
        
        translation_service = get_translation_service()
        translation_request = TranslationRequest(
            content=content,
            source_language=source_language,
            target_language=target_language,
            content_type=content_type,
            context={"user_id": current_user["user_id"]}
        )
        
        translation_response = await translation_service.translate_content(translation_request)
        
        return {
            "original_content": translation_response.original_content,
            "translated_content": translation_response.translated_content,
            "source_language": translation_response.source_language,
            "target_language": translation_response.target_language,
            "quality_score": translation_response.quality_score,
            "translation_time_ms": translation_response.translation_time_ms,
            "cached": translation_response.cached,
            "confidence": translation_response.confidence
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Translation failed: {str(e)}"
        )

@router.delete("/translation/cache", response_model=FeedbackResponse)
async def clear_translation_cache(
    language: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Clear translation cache for user"""
    try:
        translation_service = get_translation_service()
        success = await translation_service.clear_translation_cache(
            user_id=current_user["user_id"],
            language=language
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to clear translation cache"
            )
        
        cache_scope = f" for language {language}" if language else ""
        return FeedbackResponse(
            message=f"Translation cache cleared{cache_scope}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear translation cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear translation cache: {str(e)}"
        )

@router.get("/visual-guides/recommendations", response_model=List[Dict[str, Any]])
@limiter.limit("30/minute")  # Rate limit: 30 guide requests per minute per user
async def get_visual_guide_recommendations(
    request: Request,  # Required for rate limiting
    page_route: str,
    page_title: str = "",
    user_role: str = "user",
    limit: int = 5,
    current_user = Depends(get_current_user)
):
    """Get visual guide recommendations based on current context"""
    try:
        context = {
            "route": page_route,
            "page_title": page_title,
            "user_role": user_role
        }
        
        recommendations = await visual_guide_service.get_guide_recommendations(
            context, limit
        )
        
        # Convert to response format
        response_recommendations = []
        for rec in recommendations:
            guide = rec["guide"]
            response_recommendations.append({
                "guide": {
                    "id": guide.id,
                    "title": guide.title,
                    "description": guide.description,
                    "category": guide.category,
                    "difficulty": guide.difficulty,
                    "estimated_time": guide.estimated_time,
                    "step_count": len(guide.steps),
                    "tags": guide.tags,
                    "thumbnail": guide.steps[0].screenshot if guide.steps and guide.steps[0].screenshot else None
                },
                "relevance_score": rec["relevance_score"],
                "reason": rec["reason"]
            })
        
        return response_recommendations
        
    except Exception as e:
        logger.error(f"Visual guide recommendations failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get visual guide recommendations: {str(e)}"
        )

@router.get("/visual-guides/{guide_id}", response_model=Dict[str, Any])
async def get_visual_guide_for_help(
    guide_id: str,
    current_user = Depends(get_current_user)
):
    """Get a visual guide for help chat integration"""
    try:
        guide = await visual_guide_service.get_visual_guide(guide_id)
        if not guide:
            raise HTTPException(status_code=404, detail="Visual guide not found")
        
        # Convert to help chat format
        return {
            "id": guide.id,
            "title": guide.title,
            "description": guide.description,
            "category": guide.category,
            "difficulty": guide.difficulty,
            "estimated_time": guide.estimated_time,
            "steps": [
                {
                    "id": step.id,
                    "title": step.title,
                    "description": step.description,
                    "screenshot": step.screenshot,
                    "annotations": [
                        {
                            "id": ann.id,
                            "type": ann.type,
                            "position": ann.position,
                            "size": ann.size,
                            "content": ann.content,
                            "direction": ann.direction,
                            "color": ann.color,
                            "style": ann.style
                        }
                        for ann in step.annotations
                    ],
                    "target_element": step.target_element,
                    "action": step.action,
                    "action_data": step.action_data,
                    "duration": step.duration,
                    "is_optional": step.is_optional
                }
                for step in guide.steps
            ],
            "tags": guide.tags,
            "prerequisites": guide.prerequisites,
            "version": guide.version,
            "last_updated": guide.last_updated.isoformat(),
            "is_outdated": guide.is_outdated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get visual guide: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get visual guide: {str(e)}"
        )

@router.post("/visual-guides/{guide_id}/track-completion", response_model=FeedbackResponse)
async def track_visual_guide_completion(
    guide_id: str,
    completed_steps: List[str],
    completion_time: float,
    current_user = Depends(get_current_user)
):
    """Track visual guide completion for analytics"""
    try:
        success = await visual_guide_service.track_guide_completion(
            guide_id=guide_id,
            user_id=current_user["user_id"],
            completed_steps=completed_steps,
            completion_time=completion_time
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail="Failed to track guide completion"
            )
        
        # Log analytics event
        await _log_help_analytics(
            user_id=current_user["user_id"],
            event_type="visual_guide_completed",
            event_data={
                "guide_id": guide_id,
                "completed_steps": len(completed_steps),
                "completion_time": completion_time,
                "completion_rate": len(completed_steps) / len(completed_steps) if completed_steps else 0
            }
        )
        
        return FeedbackResponse(
            message="Guide completion tracked successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to track guide completion: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to track guide completion: {str(e)}"
        )

# Analytics endpoints
@router.get("/analytics/metrics", response_model=Dict[str, Any])
async def get_help_analytics_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(require_permission(Permission.admin_read))
):
    """Get help chat usage metrics for specified date range (Admin only)"""
    try:
        analytics_tracker = get_analytics_tracker()
        
        # Parse dates or use defaults
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        else:
            start_dt = datetime.now() - timedelta(days=7)  # Last 7 days
            
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        else:
            end_dt = datetime.now()
        
        metrics = await analytics_tracker.get_usage_metrics(start_dt, end_dt)
        
        return {
            "period": {
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat()
            },
            "metrics": {
                "total_queries": metrics.total_queries,
                "unique_users": metrics.unique_users,
                "avg_response_time": metrics.avg_response_time,
                "satisfaction_rate": metrics.satisfaction_rate,
                "category_distribution": metrics.category_distribution,
                "effectiveness_distribution": metrics.effectiveness_distribution,
                "top_queries": metrics.top_queries,
                "common_issues": metrics.common_issues
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get analytics metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get analytics metrics: {str(e)}"
        )

@router.get("/analytics/weekly-report", response_model=Dict[str, Any])
async def get_weekly_analytics_report(
    week_start: Optional[str] = None,
    current_user = Depends(require_permission(Permission.admin_read))
):
    """Get comprehensive weekly analytics report (Admin only)"""
    try:
        analytics_tracker = get_analytics_tracker()
        
        # Parse week start date or use default
        if week_start:
            week_start_dt = datetime.fromisoformat(week_start.replace('Z', '+00:00'))
        else:
            week_start_dt = None  # Will use last Monday
        
        report = await analytics_tracker.generate_weekly_report(week_start_dt)
        
        return {
            "report_period": {
                "week_start": report.week_start.isoformat(),
                "week_end": report.week_end.isoformat()
            },
            "metrics": {
                "total_queries": report.metrics.total_queries,
                "unique_users": report.metrics.unique_users,
                "avg_response_time": report.metrics.avg_response_time,
                "satisfaction_rate": report.metrics.satisfaction_rate,
                "category_distribution": report.metrics.category_distribution,
                "effectiveness_distribution": report.metrics.effectiveness_distribution,
                "top_queries": report.metrics.top_queries,
                "common_issues": report.metrics.common_issues
            },
            "trends": report.trends,
            "recommendations": report.recommendations
        }
        
    except Exception as e:
        logger.error(f"Failed to generate weekly report: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate weekly report: {str(e)}"
        )

@router.post("/analytics/cleanup", response_model=Dict[str, Any])
async def cleanup_analytics_data(
    days_to_keep: int = 90,
    current_user = Depends(require_permission(Permission.admin_update))
):
    """Clean up old analytics data for privacy compliance (Admin only)"""
    try:
        if days_to_keep < 30:
            raise HTTPException(
                status_code=400,
                detail="Must keep at least 30 days of data"
            )
        
        analytics_tracker = get_analytics_tracker()
        anonymized_count = await analytics_tracker.cleanup_old_data(days_to_keep)
        
        return {
            "message": f"Analytics cleanup completed",
            "anonymized_records": anonymized_count,
            "days_kept": days_to_keep
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cleanup analytics data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup analytics data: {str(e)}"
        )

# Helper functions
def _generate_suggested_queries(page_route: str, contextual_data: Dict[str, Any]) -> List[str]:
    """Generate suggested queries based on current page context"""
    suggestions = []
    
    route_lower = page_route.lower()
    
    if "dashboard" in route_lower:
        suggestions.extend([
            "How do I customize my dashboard?",
            "What do the dashboard metrics mean?",
            "How can I add new widgets to my dashboard?"
        ])
    elif "project" in route_lower:
        suggestions.extend([
            "How do I create a new project?",
            "How can I track project progress?",
            "What are the different project statuses?"
        ])
    elif "portfolio" in route_lower:
        suggestions.extend([
            "How do I manage multiple projects in a portfolio?",
            "How can I compare project performance?",
            "What is portfolio optimization?"
        ])
    elif "resource" in route_lower:
        suggestions.extend([
            "How do I allocate resources to projects?",
            "How can I track resource utilization?",
            "What is resource optimization?"
        ])
    elif "financial" in route_lower:
        suggestions.extend([
            "How do I set up project budgets?",
            "How can I track spending vs budget?",
            "What are variance reports?"
        ])
    elif "risk" in route_lower:
        suggestions.extend([
            "How do I identify and assess risks?",
            "What is Monte Carlo simulation?",
            "How can I create risk mitigation plans?"
        ])
    else:
        suggestions.extend([
            "How do I navigate the platform?",
            "What features are available?",
            "How can I get started?"
        ])
    
    return suggestions[:5]  # Limit to 5 suggestions

def _get_relevant_features(page_route: str) -> List[str]:
    """Get relevant features for the current page"""
    features = []
    
    route_lower = page_route.lower()
    
    if "dashboard" in route_lower:
        features.extend([
            "Project Overview",
            "Portfolio Metrics",
            "Resource Utilization",
            "Budget Summary",
            "Risk Indicators"
        ])
    elif "project" in route_lower:
        features.extend([
            "Project Planning",
            "Task Management",
            "Resource Allocation",
            "Progress Tracking",
            "Issue Management"
        ])
    elif "portfolio" in route_lower:
        features.extend([
            "Portfolio Analysis",
            "Project Comparison",
            "Resource Optimization",
            "Performance Metrics",
            "Strategic Alignment"
        ])
    elif "resource" in route_lower:
        features.extend([
            "Resource Planning",
            "Capacity Management",
            "Skill Tracking",
            "Utilization Reports",
            "Allocation Optimization"
        ])
    elif "financial" in route_lower:
        features.extend([
            "Budget Planning",
            "Cost Tracking",
            "Variance Analysis",
            "Financial Reports",
            "Forecasting"
        ])
    elif "risk" in route_lower:
        features.extend([
            "Risk Assessment",
            "Monte Carlo Simulation",
            "Mitigation Planning",
            "Risk Monitoring",
            "Impact Analysis"
        ])
    
    return features

async def _log_help_analytics(user_id: str, event_type: str, event_data: Dict[str, Any]):
    """Log help analytics event"""
    try:
        analytics_data = {
            "user_id": user_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": datetime.now().isoformat()
        }
        
        supabase.table("help_analytics").insert(analytics_data).execute()
        
    except Exception as e:
        logger.error(f"Failed to log help analytics: {e}")
        # Don't raise exception for analytics failures

# Performance monitoring endpoints
@router.get("/performance/metrics", response_model=Dict[str, Any])
async def get_help_chat_performance_metrics(
    current_user = Depends(require_permission(Permission.admin_read))
):
    """Get help chat performance metrics (Admin only)"""
    try:
        performance_service = get_help_chat_performance()
        performance_report = await performance_service.get_performance_report()
        
        return {
            "status": "success",
            "data": performance_report
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance metrics: {str(e)}"
        )

@router.post("/performance/cache/clear", response_model=Dict[str, Any])
async def clear_help_chat_cache(
    pattern: Optional[str] = "*",
    current_user = Depends(require_permission(Permission.admin_update))
):
    """Clear help chat cache (Admin only)"""
    try:
        performance_service = get_help_chat_performance()
        cleared_count = await performance_service.clear_cache_by_pattern(pattern)
        
        return {
            "status": "success",
            "message": f"Cleared {cleared_count} cache entries",
            "pattern": pattern
        }
        
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )

@router.get("/performance/health", response_model=Dict[str, Any])
async def get_help_chat_health_status(
    current_user = Depends(get_current_user)
):
    """Get help chat service health status"""
    try:
        performance_service = get_help_chat_performance()
        performance_report = await performance_service.get_performance_report()
        
        health_score = performance_report.get('health_score', 0)
        
        # Determine status based on health score
        if health_score >= 80:
            status = "healthy"
        elif health_score >= 60:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return {
            "status": status,
            "health_score": health_score,
            "cache_hit_rate": performance_report.get('cache_performance', {}).get('hit_rate_percent', 0),
            "avg_response_time_ms": performance_report.get('response_performance', {}).get('summary', {}).get('avg_response_time_ms', 0),
            "error_count": performance_report.get('response_performance', {}).get('summary', {}).get('error_count', 0),
            "recommendations": performance_report.get('recommendations', []),
            "timestamp": performance_report.get('timestamp')
        }
        
    except Exception as e:
        logger.error(f"Failed to get health status: {e}")
        return {
            "status": "unhealthy",
            "health_score": 0,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }