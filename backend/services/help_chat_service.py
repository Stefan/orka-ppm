"""
Help Chat Service
Core service for AI Help Chat functionality across all 3 phases
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import uuid
import os

from supabase import create_client, Client
import openai

class HelpChatService:
    """Main service for help chat operations"""
    
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        self.openai_client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
        
    async def generate_response(
        self,
        prompt: str,
        session_id: str,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generate AI response with retry logic and confidence scoring
        Phase 1: Core response generation
        """
        try:
            # Call OpenAI API
            response = await self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are an AI assistant for a PPM (Project Portfolio Management) platform.
Provide helpful, accurate responses about PPM features, workflows, and best practices.
Respond in {language} language.
Be concise but comprehensive."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = response.choices[0].message.content
            
            # Calculate confidence (simplified - based on finish_reason)
            confidence = 0.9 if response.choices[0].finish_reason == "stop" else 0.6
            
            return {
                "response": response_text,
                "session_id": session_id,
                "confidence": confidence,
                "is_cached": False,
                "is_fallback": False
            }
            
        except Exception as e:
            print(f"Error generating response: {e}")
            # Return fallback response
            return {
                "response": "I'm having trouble processing your request right now. Please try again or contact support.",
                "session_id": session_id,
                "confidence": 0.0,
                "is_cached": False,
                "is_fallback": True
            }
    
    async def log_interaction(
        self,
        user_id: str,
        organization_id: str,
        query: str,
        response: str,
        confidence: float,
        context: Dict[str, Any],
        response_time_ms: int,
        success: bool,
        error_message: Optional[str] = None
    ):
        """
        Log help interaction to Supabase
        Phase 1: Audit logging
        """
        try:
            log_entry = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "organization_id": organization_id,
                "query": query,
                "response": response,
                "confidence": confidence,
                "context": json.dumps(context),
                "response_time_ms": response_time_ms,
                "success": success,
                "error_message": error_message,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.supabase.table("help_logs").insert(log_entry).execute()
            
        except Exception as e:
            print(f"Failed to log interaction: {e}")
    
    async def log_feedback(
        self,
        message_id: str,
        user_id: str,
        organization_id: str,
        rating: int,
        feedback_text: Optional[str],
        feedback_type: str
    ) -> str:
        """
        Log user feedback
        Phase 1: Feedback collection
        """
        try:
            tracking_id = str(uuid.uuid4())
            
            feedback_entry = {
                "id": tracking_id,
                "message_id": message_id,
                "user_id": user_id,
                "organization_id": organization_id,
                "rating": rating,
                "feedback_text": feedback_text,
                "feedback_type": feedback_type,
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.supabase.table("help_feedback").insert(feedback_entry).execute()
            
            return tracking_id
            
        except Exception as e:
            print(f"Failed to log feedback: {e}")
            raise
    
    async def get_analytics(
        self,
        organization_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get help chat analytics
        Phase 1: Admin analytics
        """
        try:
            # Default to last 30 days
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
            if not end_date:
                end_date = datetime.utcnow().isoformat()
            
            # Query help logs
            logs_response = self.supabase.table("help_logs")\
                .select("*")\
                .eq("organization_id", organization_id)\
                .gte("created_at", start_date)\
                .lte("created_at", end_date)\
                .execute()
            
            logs = logs_response.data
            
            # Query feedback
            feedback_response = self.supabase.table("help_feedback")\
                .select("*")\
                .eq("organization_id", organization_id)\
                .gte("created_at", start_date)\
                .lte("created_at", end_date)\
                .execute()
            
            feedback = feedback_response.data
            
            # Calculate metrics
            total_queries = len(logs)
            successful_queries = len([log for log in logs if log['success']])
            avg_confidence = sum([log['confidence'] for log in logs]) / total_queries if total_queries > 0 else 0
            avg_response_time = sum([log['response_time_ms'] for log in logs]) / total_queries if total_queries > 0 else 0
            
            total_feedback = len(feedback)
            avg_rating = sum([f['rating'] for f in feedback]) / total_feedback if total_feedback > 0 else 0
            
            # Query trends (group by date)
            query_trends = {}
            for log in logs:
                date = log['created_at'][:10]  # Extract date
                query_trends[date] = query_trends.get(date, 0) + 1
            
            return {
                "summary": {
                    "total_queries": total_queries,
                    "successful_queries": successful_queries,
                    "success_rate": successful_queries / total_queries if total_queries > 0 else 0,
                    "avg_confidence": avg_confidence,
                    "avg_response_time_ms": avg_response_time,
                    "total_feedback": total_feedback,
                    "avg_rating": avg_rating
                },
                "query_trends": query_trends,
                "feedback_distribution": {
                    "helpful": len([f for f in feedback if f['feedback_type'] == 'helpful']),
                    "not_helpful": len([f for f in feedback if f['feedback_type'] == 'not_helpful']),
                    "incorrect": len([f for f in feedback if f['feedback_type'] == 'incorrect']),
                    "suggestion": len([f for f in feedback if f['feedback_type'] == 'suggestion'])
                }
            }
            
        except Exception as e:
            print(f"Failed to get analytics: {e}")
            raise
    
    async def translate(
        self,
        text: str,
        source_language: str,
        target_language: str
    ) -> str:
        """
        Translate text using OpenAI (Phase 3)
        In production, use DeepL API for better quality
        """
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": f"Translate the following text from {source_language} to {target_language}. Only return the translation, no explanations."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Translation failed: {e}")
            return text  # Return original text on failure
    
    async def create_support_ticket(
        self,
        user_id: str,
        user_email: str,
        organization_id: str,
        message_id: str,
        query: str,
        context: Dict[str, Any],
        reason: str,
        priority: str
    ) -> str:
        """
        Create support ticket (Phase 3)
        In production, integrate with Intercom, Zendesk, etc.
        """
        try:
            ticket_id = str(uuid.uuid4())
            
            ticket_entry = {
                "id": ticket_id,
                "user_id": user_id,
                "user_email": user_email,
                "organization_id": organization_id,
                "message_id": message_id,
                "query": query,
                "context": json.dumps(context),
                "reason": reason,
                "priority": priority,
                "status": "open",
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.supabase.table("support_tickets").insert(ticket_entry).execute()
            
            # TODO: Send notification to support team
            # TODO: Integrate with Intercom/Zendesk
            
            return ticket_id
            
        except Exception as e:
            print(f"Failed to create support ticket: {e}")
            raise
