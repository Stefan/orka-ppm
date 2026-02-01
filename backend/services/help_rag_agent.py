"""
Enhanced RAG Agent for Help Chat System
Extends RAGReporterAgent with PPM domain-specific query processing and context-aware response generation
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging
from openai import OpenAI
from supabase import Client

# Import the base RAG agent
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai_agents import RAGReporterAgent

logger = logging.getLogger(__name__)

class PageContext:
    """Represents the current page context for help queries"""
    def __init__(self, route: str, page_title: str, user_role: str, 
                 current_project: str = None, current_portfolio: str = None, 
                 relevant_data: Dict[str, Any] = None):
        self.route = route
        self.page_title = page_title
        self.user_role = user_role
        self.current_project = current_project
        self.current_portfolio = current_portfolio
        self.relevant_data = relevant_data or {}

class HelpResponse:
    """Represents a help response with sources and confidence"""
    def __init__(self, response: str, sources: List[Dict], confidence: float, 
                 session_id: str, response_time_ms: int, proactive_tips: List[Dict] = None,
                 suggested_actions: List[Dict] = None, related_guides: List[Dict] = None):
        self.response = response
        self.sources = sources
        self.confidence = confidence
        self.session_id = session_id
        self.response_time_ms = response_time_ms
        self.proactive_tips = proactive_tips or []
        self.suggested_actions = suggested_actions or []
        self.related_guides = related_guides or []

class UserBehavior:
    """Represents user behavior patterns for proactive tips"""
    def __init__(self, recent_pages: List[str], time_on_page: int, 
                 frequent_queries: List[str], user_level: str = "intermediate"):
        self.recent_pages = recent_pages
        self.time_on_page = time_on_page
        self.frequent_queries = frequent_queries
        self.user_level = user_level

class ProactiveTip:
    """Represents a proactive tip for users"""
    def __init__(self, tip_id: str, tip_type: str, title: str, content: str, 
                 priority: str, trigger_context: List[str], actions: List[Dict] = None,
                 dismissible: bool = True, show_once: bool = False):
        self.tip_id = tip_id
        self.tip_type = tip_type
        self.title = title
        self.content = content
        self.priority = priority
        self.trigger_context = trigger_context
        self.actions = actions or []
        self.dismissible = dismissible
        self.show_once = show_once

class TranslatedContent:
    """Represents translated content with metadata"""
    def __init__(self, content: str, target_language: str, confidence: float, 
                 translation_time_ms: int):
        self.content = content
        self.target_language = target_language
        self.confidence = confidence
        self.translation_time_ms = translation_time_ms

class HelpRAGAgent(RAGReporterAgent):
    """Enhanced RAG Agent specialized for PPM help chat system"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: str = None):
        super().__init__(supabase_client, openai_api_key, base_url)
        # Use configurable models from environment or defaults
        import os
        self.help_model = os.getenv("OPENAI_MODEL", "grok-beta")
        self.translation_model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.max_help_context_length = 6000
        self.ppm_domain_keywords = [
            "project", "portfolio", "resource", "budget", "schedule", "risk", "issue",
            "milestone", "task", "allocation", "utilization", "variance", "baseline",
            "what-if", "simulation", "monte carlo", "dashboard", "report", "analytics"
        ]
        
    async def process_help_query(self, query: str, context: PageContext, 
                               user_id: str, language: str = 'en') -> HelpResponse:
        """Process a help query with PPM domain-specific context awareness"""
        start_time = datetime.now()
        
        try:
            # Validate query is within PPM domain
            if not self._is_ppm_domain_query(query):
                return await self._generate_scope_redirect_response(query, language)
            
            # Generate session ID
            session_id = f"help_{int(datetime.now().timestamp())}_{user_id[:8]}"
            
            # SKIP help content search for speed - AI model has enough knowledge
            similar_content = []
            
            # Get contextual PPM data based on current page (simplified for speed)
            contextual_data = await self._get_contextual_ppm_data_fast(context, user_id)
            
            # Build help-specific prompt - DIRECTLY IN TARGET LANGUAGE
            system_prompt = self._build_help_system_prompt(language)
            user_prompt = self._build_help_user_prompt(query, context, similar_content, contextual_data, language)
            
            # Call OpenAI for help response - directly in target language
            # Ultra-optimized for speed: deterministic, minimal tokens
            response = self.openai_client.chat.completions.create(
                model=self.help_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0,  # Deterministic for speed
                max_tokens=300  # Reduced from 400 for sub-3s responses
            )
            
            ai_response = response.choices[0].message.content
            
            # NO SEPARATE TRANSLATION - response is already in target language
            
            # Calculate metrics
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            
            # Extract sources and calculate confidence
            sources = self._extract_help_sources(similar_content)
            confidence_score = self._calculate_help_confidence(similar_content, ai_response, context)
            
            # Generate suggested actions (simplified for speed)
            suggested_actions = [
                {
                    "id": "provide_feedback",
                    "label": "Was this helpful?",
                    "action": "feedback",
                    "target": "/feedback"
                }
            ]
            
            # Skip related guides for speed
            related_guides = []
            
            # Log operation
            operation_id = await self.log_operation(
                operation_type="help_query",
                user_id=user_id,
                inputs={
                    "query": query, 
                    "context": {
                        "route": context.route,
                        "page_title": context.page_title,
                        "user_role": context.user_role
                    },
                    "language": language
                },
                outputs={
                    "response": ai_response, 
                    "sources": sources,
                    "suggested_actions": len(suggested_actions)
                },
                response_time_ms=response_time,
                success=True,
                confidence_score=confidence_score,
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
            
            # Store help session
            await self._store_help_session(
                user_id, session_id, query, ai_response, context, 
                sources, confidence_score, operation_id
            )
            
            return HelpResponse(
                response=ai_response,
                sources=sources,
                confidence=confidence_score,
                session_id=session_id,
                response_time_ms=response_time,
                suggested_actions=suggested_actions,
                related_guides=related_guides
            )
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log error
            await self.log_operation(
                operation_type="help_query",
                user_id=user_id,
                inputs={"query": query, "language": language},
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            logger.error(f"Help query processing failed: {e}")
            raise
    
    async def generate_proactive_tips(self, context: PageContext, 
                                    user_behavior: UserBehavior) -> List[ProactiveTip]:
        """Generate contextual proactive tips based on user behavior and current context"""
        try:
            tips = []
            
            # Welcome tips for new users
            if user_behavior.user_level == "beginner":
                tips.extend(await self._generate_welcome_tips(context))
            
            # Context-specific tips based on current page
            tips.extend(await self._generate_context_tips(context, user_behavior))
            
            # Performance optimization tips
            tips.extend(await self._generate_optimization_tips(context, user_behavior))
            
            # Feature discovery tips
            tips.extend(await self._generate_feature_discovery_tips(context, user_behavior))
            
            # Sort by priority and limit to avoid overwhelming user
            tips.sort(key=lambda x: {"high": 3, "medium": 2, "low": 1}[x.priority], reverse=True)
            
            # Limit to 3 tips maximum per session
            return tips[:3]
            
        except Exception as e:
            logger.error(f"Proactive tip generation failed: {e}")
            return []
    
    async def translate_response(self, content: str, target_language: str) -> TranslatedContent:
        """Translate help content to target language using OpenAI"""
        start_time = datetime.now()
        
        try:
            # Language mapping
            language_names = {
                'en': 'English',
                'de': 'German', 
                'fr': 'French'
            }
            
            target_lang_name = language_names.get(target_language, target_language)
            
            # Translation prompt
            translation_prompt = f"""
            Translate the following PPM (Project Portfolio Management) help content to {target_lang_name}.
            Maintain technical terminology accuracy and keep the helpful, professional tone.
            Preserve any formatting, bullet points, and structure.
            
            Content to translate:
            {content}
            """
            
            response = self.openai_client.chat.completions.create(
                model=self.translation_model,
                messages=[
                    {"role": "system", "content": f"You are a professional translator specializing in PPM and business terminology. Translate accurately to {target_lang_name}."},
                    {"role": "user", "content": translation_prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            translated_content = response.choices[0].message.content
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Calculate translation confidence (simplified)
            confidence = 0.9 if len(translated_content) > len(content) * 0.8 else 0.7
            
            return TranslatedContent(
                content=translated_content,
                target_language=target_language,
                confidence=confidence,
                translation_time_ms=response_time
            )
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            # Return original content as fallback
            return TranslatedContent(
                content=content,
                target_language=target_language,
                confidence=0.0,
                translation_time_ms=0
            )
    
    def _is_ppm_domain_query(self, query: str) -> bool:
        """Check if query is within PPM domain boundaries"""
        query_lower = query.lower()
        
        # Extended PPM domain keywords including translations
        ppm_keywords_multilang = self.ppm_domain_keywords + [
            # German keywords
            "projekt", "projekte", "portfolio", "ressource", "ressourcen", "budget", 
            "zeitplan", "risiko", "risiken", "problem", "meilenstein", "aufgabe", 
            "zuteilung", "auslastung", "varianz", "baseline", "simulation", 
            "dashboard", "bericht", "analytik", "was-wäre-wenn", "varianz-tracking",
            # French keywords
            "projet", "projets", "portefeuille", "ressource", "ressources", 
            "calendrier", "risque", "risques", "problème", "jalon", "tâche",
            "allocation", "utilisation", "écart", "écarts", "référence", 
            "tableau de bord", "rapport", "analyse", "suivi",
            # Spanish keywords
            "proyecto", "proyectos", "cartera", "recurso", "recursos", "presupuesto",
            "cronograma", "riesgo", "riesgos", "problema", "hito", "tarea",
            "asignación", "utilización", "varianza", "variación", "línea base",
            "panel", "informe", "análisis", "seguimiento", "simulación",
            # Polish keywords (including declensions)
            "projekt", "projekty", "projektu", "projektów", "portfel", "portfela",
            "zasób", "zasoby", "zasobów", "budżet", "budżetu", "budżetów",
            "harmonogram", "harmonogramu", "ryzyko", "ryzyka", "ryzykiem",
            "problem", "problemu", "kamień milowy", "zadanie", "zadania",
            "alokacja", "alokacji", "wykorzystanie", "wykorzystania",
            "wariancja", "wariancji", "wariancję", "baseline", "symulacja", "symulacji",
            "pulpit", "raport", "raportu", "analiza", "analizy", "śledzenie", "śledzenia",
            # Swiss German keywords
            "projäkt", "portfolio", "ressurse", "budget", "risiko", "ufgab"
        ]
        
        # Check for PPM domain keywords
        has_ppm_keywords = any(keyword in query_lower for keyword in ppm_keywords_multilang)
        
        # Check for off-topic indicators (multilingual)
        off_topic_keywords = [
            # English
            "competitor", "alternative", "other tools", "different software",
            "personal life", "weather", "news", "sports", "entertainment",
            "cooking", "travel", "health", "medical", "legal advice",
            # German
            "konkurrent", "alternative", "andere tools", "andere software",
            "privatleben", "wetter", "nachrichten", "sport", "unterhaltung",
            # French
            "concurrent", "alternatif", "autres outils", "autre logiciel",
            "vie privée", "météo", "nouvelles", "sport", "divertissement",
            # Spanish
            "competidor", "alternativa", "otras herramientas", "otro software",
            "vida personal", "clima", "noticias", "deportes", "entretenimiento",
            # Polish
            "konkurent", "alternatywa", "inne narzędzia", "inne oprogramowanie",
            "życie prywatne", "pogoda", "wiadomości", "sport", "rozrywka"
        ]
        
        has_off_topic = any(keyword in query_lower for keyword in off_topic_keywords)
        
        # Allow general help queries about the platform (multilingual)
        platform_queries = [
            # English
            "how to", "where is", "what is", "help", "guide", "tutorial",
            "navigation", "menu", "button", "feature", "function", "app",
            "platform", "system", "tool", "software", "can", "does",
            # German
            "wie", "wo ist", "was ist", "hilfe", "anleitung", "tutorial",
            "navigation", "menü", "schaltfläche", "funktion", "app",
            "plattform", "system", "werkzeug", "kann", "macht",
            # French
            "comment", "où est", "qu'est-ce", "aide", "guide", "tutoriel",
            "navigation", "menu", "bouton", "fonctionnalité", "fonction",
            "plateforme", "système", "outil", "peut", "fait",
            # Spanish
            "cómo", "dónde está", "qué es", "ayuda", "guía",
            "navegación", "menú", "botón", "característica", "función",
            "plataforma", "sistema", "herramienta", "puede", "hace",
            # Polish
            "jak", "gdzie jest", "co to jest", "czym jest", "pomoc", "przewodnik",
            "nawigacja", "menu", "przycisk", "funkcja", "aplikacja",
            "platforma", "system", "narzędzie", "może", "robi",
            # Swiss German
            "wie", "wo isch", "was isch", "hilf", "aaleitig"
        ]
        
        has_platform_query = any(keyword in query_lower for keyword in platform_queries)
        
        return (has_ppm_keywords or has_platform_query) and not has_off_topic
    
    async def _generate_scope_redirect_response(self, query: str, language: str) -> HelpResponse:
        """Generate a polite redirect response for out-of-scope queries"""
        redirect_messages = {
            'en': "I'm here to help you with PPM platform features and functionality. For questions about projects, portfolios, resources, budgets, or how to use specific features, I'm happy to assist! Could you rephrase your question to focus on the PPM platform?",
            'de': "Ich bin hier, um Ihnen bei PPM-Plattform-Features und -Funktionen zu helfen. Bei Fragen zu Projekten, Portfolios, Ressourcen, Budgets oder zur Nutzung bestimmter Features helfe ich gerne! Könnten Sie Ihre Frage umformulieren, um sich auf die PPM-Plattform zu konzentrieren?",
            'fr': "Je suis là pour vous aider avec les fonctionnalités de la plateforme PPM. Pour les questions sur les projets, portfolios, ressources, budgets, ou comment utiliser des fonctionnalités spécifiques, je suis ravi de vous aider ! Pourriez-vous reformuler votre question pour vous concentrer sur la plateforme PPM ?",
            'es': "Estoy aquí para ayudarte con las funciones de la plataforma PPM. Para preguntas sobre proyectos, carteras, recursos, presupuestos o cómo usar funciones específicas, ¡estaré encantado de ayudarte! ¿Podrías reformular tu pregunta para centrarte en la plataforma PPM?",
            'pl': "Jestem tutaj, aby pomóc Ci z funkcjami platformy PPM. W przypadku pytań dotyczących projektów, portfeli, zasobów, budżetów lub sposobu korzystania z określonych funkcji, chętnie pomogę! Czy mógłbyś przeformułować swoje pytanie, aby skupić się na platformie PPM?",
            'gsw': "Ich bi do zum dir mit de PPM-Plattform-Funktione z hälfe. Bi Froge zu Projäkt, Portfolio, Ressurse, Budget oder wie mer bestimmti Funktione bruucht, hilf ich gärn! Chasch du dini Frog umformuliere, dass sie uf d PPM-Plattform fokussiert isch?"
        }
        
        action_labels = {
            'en': "Explore Platform Features",
            'de': "Funktionen erkunden",
            'fr': "Explorer les fonctionnalités",
            'es': "Explorar funciones de la plataforma",
            'pl': "Przeglądaj funkcje platformy",
            'gsw': "Funktione erkunde"
        }
        
        response_text = redirect_messages.get(language, redirect_messages['en'])
        action_label = action_labels.get(language, action_labels['en'])
        
        return HelpResponse(
            response=response_text,
            sources=[],
            confidence=1.0,
            session_id=f"redirect_{int(datetime.now().timestamp())}",
            response_time_ms=50,
            suggested_actions=[
                {
                    "id": "explore_features",
                    "label": action_label,
                    "action": "navigate:/dashboards"
                }
            ]
        )
    
    async def _get_contextual_ppm_data(self, context: PageContext, user_id: str) -> Dict[str, Any]:
        """Get contextual PPM data based on current page and user context"""
        try:
            contextual_data = {}
            
            # Get data based on current route
            if "dashboard" in context.route:
                # Get dashboard-relevant data
                contextual_data.update(await self._get_dashboard_context(user_id))
            elif "project" in context.route:
                # Get project-specific data
                if context.current_project:
                    contextual_data.update(await self._get_project_context(context.current_project))
            elif "portfolio" in context.route:
                # Get portfolio-specific data
                if context.current_portfolio:
                    contextual_data.update(await self._get_portfolio_context(context.current_portfolio))
            elif "resource" in context.route:
                # Get resource management data
                contextual_data.update(await self._get_resource_context(user_id))
            elif "financial" in context.route:
                # Get financial data
                contextual_data.update(await self._get_financial_context(user_id))
            elif "risk" in context.route:
                # Get risk management data
                contextual_data.update(await self._get_risk_context(user_id))
            
            # Add user role context
            contextual_data["user_role"] = context.user_role
            contextual_data["page_context"] = {
                "route": context.route,
                "page_title": context.page_title
            }
            
            return contextual_data
            
        except Exception as e:
            logger.error(f"Failed to get contextual PPM data: {e}")
            return {}

    async def _get_contextual_ppm_data_fast(self, context: PageContext, user_id: str) -> Dict[str, Any]:
        """Fast version - skip database queries for speed"""
        return {
            "user_role": context.user_role,
            "page_context": {
                "route": context.route,
                "page_title": context.page_title
            }
        }
    
    def _build_help_system_prompt(self, language: str) -> str:
        """Build system prompt for help queries - ultra-optimized for speed"""
        
        # Language-specific instructions
        language_instructions = {
            'en': "Respond in English. Be brief (max 2-3 short paragraphs).",
            'de': "Antworte auf Deutsch. Sei kurz (max 2-3 kurze Absätze).",
            'fr': "Réponds en français. Sois bref (max 2-3 courts paragraphes).",
            'es': "Responde en español. Sé breve (máx 2-3 párrafos cortos).",
            'pl': "Odpowiedz po polsku. Bądź zwięzły (maks 2-3 krótkie akapity).",
            'gsw': "Antworte uf Baseldytsch. Sig churz (max 2-3 churzi Absätz)."
        }
        
        lang_instruction = language_instructions.get(language, language_instructions['en'])
        
        return f"""You are a PPM help assistant. {lang_instruction}

Focus on: projects, portfolios, resources, budgets, risks, schedules, dashboards.
Give clear steps. Use bullet points."""
    
    def _build_help_user_prompt(self, query: str, context: PageContext, 
                              similar_content: List[Dict], contextual_data: Dict,
                              language: str = 'en') -> str:
        """Build user prompt with help-specific context - optimized for speed"""
        prompt = f"Question: {query}\n"
        prompt += f"Page: {context.page_title} ({context.route})\n"
        prompt += f"Role: {context.user_role}\n"
        
        # Add only most relevant help content (limit to 2 for speed)
        if similar_content:
            prompt += "\nRelevant info:\n"
            for content in similar_content[:2]:
                content_text = content['content_text'][:200]  # Reduced from 300
                prompt += f"- {content_text}...\n"
        
        return prompt
        
        prompt += "Please provide helpful guidance based on the user's current context and available information."
        
        return prompt
    
    def _extract_help_sources(self, similar_content: List[Dict]) -> List[Dict]:
        """Extract and format sources for help responses"""
        sources = []
        
        for content in similar_content:
            sources.append({
                "type": content["content_type"],
                "id": content["content_id"],
                "title": content.get("metadata", {}).get("title", "Help Content"),
                "similarity": content["similarity_score"],
                "url": self._generate_help_content_url(content)
            })
        
        return sources
    
    def _calculate_help_confidence(self, similar_content: List[Dict], 
                                 response: str, context: PageContext) -> float:
        """Calculate confidence score for help responses"""
        confidence_factors = []
        
        # Base confidence on content similarity
        if similar_content:
            avg_similarity = sum(item['similarity_score'] for item in similar_content) / len(similar_content)
            confidence_factors.append(avg_similarity)
        else:
            confidence_factors.append(0.3)  # Low confidence without relevant content
        
        # Boost confidence for context-specific responses
        if context.route and any(context.route.split('/')[-1] in response.lower() for context.route in [context.route]):
            confidence_factors.append(0.8)
        
        # Adjust based on response completeness
        response_length_factor = min(len(response) / 400, 1.0)
        confidence_factors.append(response_length_factor * 0.7)
        
        # Calculate final confidence
        final_confidence = sum(confidence_factors) / len(confidence_factors)
        return min(max(final_confidence, 0.0), 1.0)
    
    async def _generate_suggested_actions(self, query: str, context: PageContext, 
                                        response: str) -> List[Dict]:
        """Generate suggested quick actions based on query and response"""
        actions = []
        
        query_lower = query.lower()
        
        # Navigation suggestions
        if "dashboard" in query_lower and "dashboard" not in context.route:
            actions.append({
                "id": "go_to_dashboard",
                "label": "Go to Dashboard",
                "action": "navigate",
                "target": "/dashboard"
            })
        
        if "project" in query_lower and "project" not in context.route:
            actions.append({
                "id": "view_projects",
                "label": "View Projects",
                "action": "navigate", 
                "target": "/projects"
            })
        
        if "resource" in query_lower and "resource" not in context.route:
            actions.append({
                "id": "manage_resources",
                "label": "Manage Resources",
                "action": "navigate",
                "target": "/resources"
            })
        
        # Feature-specific actions
        if "budget" in query_lower or "financial" in query_lower:
            actions.append({
                "id": "view_financials",
                "label": "View Financial Reports",
                "action": "navigate",
                "target": "/financials"
            })
        
        if "risk" in query_lower:
            actions.append({
                "id": "assess_risks",
                "label": "Assess Risks",
                "action": "navigate",
                "target": "/risks"
            })
        
        if "simulation" in query_lower or "what-if" in query_lower:
            actions.append({
                "id": "run_simulation",
                "label": "Run What-If Simulation",
                "action": "navigate",
                "target": "/scenarios"
            })
        
        # Always include feedback action
        actions.append({
            "id": "provide_feedback",
            "label": "Was this helpful?",
            "action": "feedback",
            "target": "/feedback"
        })
        
        return actions[:4]  # Limit to 4 actions
    
    async def _find_related_guides(self, query: str, context: PageContext) -> List[Dict]:
        """Find related guides and tutorials"""
        try:
            # Search for guide content (including indexed documentation)
            guide_content = await self.search_similar_content(
                query,
                content_types=['document', 'guide', 'tutorial', 'walkthrough'],
                limit=3
            )
            
            guides = []
            for content in guide_content:
                guides.append({
                    "id": content["content_id"],
                    "title": content.get("metadata", {}).get("title", "Related Guide"),
                    "type": content["content_type"],
                    "description": content["content_text"][:150] + "...",
                    "url": self._generate_help_content_url(content),
                    "estimated_time": content.get("metadata", {}).get("estimated_time", "5 min")
                })
            
            return guides
            
        except Exception as e:
            logger.error(f"Failed to find related guides: {e}")
            return []
    
    def _generate_help_content_url(self, content: Dict) -> str:
        """Generate URL for help content"""
        content_type = content["content_type"]
        content_id = content["content_id"]
        
        # Generate appropriate URLs based on content type
        url_mapping = {
            "document": f"/help/docs/{content_id}",
            "guide": f"/help/guides/{content_id}",
            "faq": f"/help/faq#{content_id}",
            "tutorial": f"/help/tutorials/{content_id}",
            "feature_doc": f"/help/features/{content_id}",
            "help_content": f"/help/content/{content_id}"
        }
        
        return url_mapping.get(content_type, f"/help/{content_id}")
    
    async def _store_help_session(self, user_id: str, session_id: str, query: str, 
                                response: str, context: PageContext, sources: List[Dict], 
                                confidence_score: float, operation_id: str = None):
        """Store help session in database"""
        try:
            # Store help session
            self.supabase.table("help_sessions").insert({
                "user_id": user_id,
                "session_id": session_id,
                "page_context": {
                    "route": context.route,
                    "page_title": context.page_title,
                    "user_role": context.user_role,
                    "current_project": context.current_project,
                    "current_portfolio": context.current_portfolio
                },
                "language": "en"  # Default for now, can be parameterized
            }).execute()
            
            # Store help message
            self.supabase.table("help_messages").insert({
                "session_id": session_id,
                "message_type": "user",
                "content": query
            }).execute()
            
            self.supabase.table("help_messages").insert({
                "session_id": session_id,
                "message_type": "assistant", 
                "content": response,
                "sources": sources,
                "confidence_score": confidence_score,
                "response_time_ms": 0  # Will be updated with actual time
            }).execute()
            
        except Exception as e:
            logger.error(f"Failed to store help session: {e}")
    
    # Context-specific data retrieval methods
    async def _get_dashboard_context(self, user_id: str) -> Dict[str, Any]:
        """Get dashboard-specific context data"""
        try:
            context = {}
            
            # Get recent projects
            projects_response = self.supabase.table("projects").select("name, status, priority").limit(5).execute()
            context["recent_projects"] = projects_response.data or []
            
            # Get portfolio summary
            portfolios_response = self.supabase.table("portfolios").select("name").execute()
            context["portfolio_count"] = len(portfolios_response.data or [])
            
            return context
        except Exception as e:
            logger.error(f"Failed to get dashboard context: {e}")
            return {}
    
    async def _get_project_context(self, project_id: str) -> Dict[str, Any]:
        """Get project-specific context data"""
        try:
            context = {}
            
            # Get project details
            project_response = self.supabase.table("projects").select("*").eq("id", project_id).execute()
            if project_response.data:
                project = project_response.data[0]
                context["project_name"] = project["name"]
                context["project_status"] = project.get("status")
                context["project_priority"] = project.get("priority")
                context["project_budget"] = project.get("budget")
            
            return context
        except Exception as e:
            logger.error(f"Failed to get project context: {e}")
            return {}
    
    async def _get_portfolio_context(self, portfolio_id: str) -> Dict[str, Any]:
        """Get portfolio-specific context data"""
        try:
            context = {}
            
            # Get portfolio details
            portfolio_response = self.supabase.table("portfolios").select("*").eq("id", portfolio_id).execute()
            if portfolio_response.data:
                portfolio = portfolio_response.data[0]
                context["portfolio_name"] = portfolio["name"]
            
            return context
        except Exception as e:
            logger.error(f"Failed to get portfolio context: {e}")
            return {}
    
    async def _get_resource_context(self, user_id: str) -> Dict[str, Any]:
        """Get resource management context data"""
        try:
            context = {}
            
            # Get resource summary
            resources_response = self.supabase.table("resources").select("name, role, skills").execute()
            context["total_resources"] = len(resources_response.data or [])
            
            return context
        except Exception as e:
            logger.error(f"Failed to get resource context: {e}")
            return {}
    
    async def _get_financial_context(self, user_id: str) -> Dict[str, Any]:
        """Get financial context data"""
        try:
            context = {}
            
            # Get budget summary (simplified)
            projects_response = self.supabase.table("projects").select("budget, spent").execute()
            projects = projects_response.data or []
            
            total_budget = sum(p.get("budget", 0) for p in projects)
            total_spent = sum(p.get("spent", 0) for p in projects)
            
            context["total_budget"] = total_budget
            context["total_spent"] = total_spent
            context["budget_utilization"] = (total_spent / total_budget * 100) if total_budget > 0 else 0
            
            return context
        except Exception as e:
            logger.error(f"Failed to get financial context: {e}")
            return {}
    
    async def _get_risk_context(self, user_id: str) -> Dict[str, Any]:
        """Get risk management context data"""
        try:
            context = {}
            
            # Get risk summary
            risks_response = self.supabase.table("risks").select("title, category, status").execute()
            risks = risks_response.data or []
            
            context["total_risks"] = len(risks)
            context["open_risks"] = len([r for r in risks if r.get("status") != "closed"])
            
            return context
        except Exception as e:
            logger.error(f"Failed to get risk context: {e}")
            return {}
    
    # Proactive tip generation methods
    async def _generate_welcome_tips(self, context: PageContext) -> List[ProactiveTip]:
        """Generate welcome tips for new users"""
        tips = []
        
        if "dashboard" in context.route:
            tips.append(ProactiveTip(
                tip_id="welcome_dashboard",
                tip_type="welcome",
                title="Welcome to Your PPM Dashboard",
                content="Your dashboard provides an overview of all your projects, portfolios, and key metrics. Use the navigation menu to explore different sections.",
                priority="high",
                trigger_context=["dashboard", "first_visit"],
                actions=[
                    {"id": "take_tour", "label": "Take a Quick Tour", "action": "start_tour"},
                    {"id": "explore_projects", "label": "View Projects", "action": "navigate", "target": "/projects"}
                ],
                show_once=True
            ))
        
        return tips
    
    async def _generate_context_tips(self, context: PageContext, 
                                   user_behavior: UserBehavior) -> List[ProactiveTip]:
        """Generate context-specific tips based on current page"""
        tips = []
        
        # Time-based tips for users spending too long on a page
        if user_behavior.time_on_page > 300:  # 5 minutes
            if "project" in context.route:
                tips.append(ProactiveTip(
                    tip_id="project_efficiency",
                    tip_type="efficiency",
                    title="Project Management Tip",
                    content="Looking for something specific? Try using the search function or check the project's resource allocation tab for detailed information.",
                    priority="medium",
                    trigger_context=["project_page", "long_time"],
                    actions=[
                        {"id": "show_search", "label": "Show Search", "action": "highlight_search"},
                        {"id": "view_resources", "label": "View Resources", "action": "navigate", "target": "/resources"}
                    ]
                ))
        
        return tips
    
    async def _generate_optimization_tips(self, context: PageContext, 
                                        user_behavior: UserBehavior) -> List[ProactiveTip]:
        """Generate performance optimization tips"""
        tips = []
        
        # Budget optimization tips
        if "financial" in context.route:
            tips.append(ProactiveTip(
                tip_id="budget_optimization",
                tip_type="optimization",
                title="Budget Optimization",
                content="Consider running a What-If scenario to explore different budget allocations and their impact on project outcomes.",
                priority="medium",
                trigger_context=["financials", "budget_review"],
                actions=[
                    {"id": "run_scenario", "label": "Run What-If Scenario", "action": "navigate", "target": "/scenarios"}
                ]
            ))
        
        return tips
    
    async def _search_help_content(self, query: str, limit: int = 3) -> List[Dict]:
        """Search help content - with timeout for speed"""
        try:
            import asyncio
            
            # Set a timeout of 2 seconds for the search
            async def search_with_timeout():
                from services.help_content_service import HelpContentService
                from models.help_content import HelpContentSearch, ContentType
                
                import os
                openai_api_key = os.getenv("OPENAI_API_KEY")
                if not openai_api_key:
                    return []
                
                help_content_service = HelpContentService(self.supabase, openai_api_key)
                
                search_params = HelpContentSearch(
                    query=query,
                    content_types=[ContentType.guide, ContentType.faq],  # Reduced types
                    is_active=True,
                    limit=limit
                )
                
                search_response = await help_content_service.search_content(search_params)
                
                similar_content = []
                for result in search_response.results[:limit]:
                    content = result.content
                    similar_content.append({
                        'content_type': content.content_type,
                        'content_id': str(content.id),
                        'content_text': content.content[:300],  # Limit content length
                        'similarity_score': result.similarity_score or 0.8,
                        'metadata': {'title': content.title}
                    })
                
                return similar_content
            
            # Try to get results within 2 seconds, otherwise return empty
            try:
                return await asyncio.wait_for(search_with_timeout(), timeout=2.0)
            except asyncio.TimeoutError:
                logger.warning("Help content search timed out")
                return []
            
            return similar_content
            
        except Exception as e:
            logger.error(f"Failed to search help content: {e}")
            # Fallback to original search method - search for documents (our indexed documentation)
            return await self.search_similar_content(
                query,
                content_types=['document', 'help_content', 'feature_doc', 'guide', 'faq'],
                limit=limit
            )

    async def _generate_feature_discovery_tips(self, context: PageContext, 
                                             user_behavior: UserBehavior) -> List[ProactiveTip]:
        """Generate feature discovery tips"""
        tips = []
        
        # Monte Carlo simulation discovery
        if "risk" in context.route and "monte carlo" not in [q.lower() for q in user_behavior.frequent_queries]:
            tips.append(ProactiveTip(
                tip_id="discover_monte_carlo",
                tip_type="feature_discovery",
                title="Advanced Risk Analysis",
                content="Did you know you can run Monte Carlo simulations to get probabilistic risk assessments? This can provide more accurate project outcome predictions.",
                priority="low",
                trigger_context=["risk_management", "advanced_features"],
                actions=[
                    {"id": "learn_monte_carlo", "label": "Learn More", "action": "navigate", "target": "/monte-carlo"},
                    {"id": "dismiss", "label": "Not Now", "action": "dismiss"}
                ]
            ))
        
        return tips