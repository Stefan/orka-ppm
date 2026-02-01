"""
Translation Service for Multi-Language Support
Integrates OpenAI translation services with caching and language preference persistence
"""

import os
import json
import asyncio
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from enum import Enum
import logging
from openai import OpenAI
from supabase import Client

logger = logging.getLogger(__name__)

class SupportedLanguage(Enum):
    """Supported languages for the PPM platform"""
    ENGLISH = "en"
    GERMAN = "de"
    FRENCH = "fr"

class TranslationQuality(Enum):
    """Translation quality levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TranslationRequest:
    """Represents a translation request"""
    def __init__(self, content: str, source_language: str, target_language: str, 
                 content_type: str = "general", context: Dict[str, Any] = None):
        self.content = content
        self.source_language = source_language
        self.target_language = target_language
        self.content_type = content_type
        self.context = context or {}
        self.request_id = self._generate_request_id()
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID for caching"""
        content_hash = hashlib.md5(
            f"{self.content}{self.source_language}{self.target_language}{self.content_type}".encode()
        ).hexdigest()
        return f"trans_{content_hash[:16]}"

class TranslationResponse:
    """Represents a translation response"""
    def __init__(self, original_content: str, translated_content: str, 
                 source_language: str, target_language: str, 
                 quality_score: float, translation_time_ms: int,
                 cached: bool = False, confidence: float = 1.0):
        self.original_content = original_content
        self.translated_content = translated_content
        self.source_language = source_language
        self.target_language = target_language
        self.quality_score = quality_score
        self.translation_time_ms = translation_time_ms
        self.cached = cached
        self.confidence = confidence
        self.timestamp = datetime.now()

class LanguageDetectionResult:
    """Represents language detection result"""
    def __init__(self, detected_language: str, confidence: float, 
                 alternative_languages: List[Tuple[str, float]] = None):
        self.detected_language = detected_language
        self.confidence = confidence
        self.alternative_languages = alternative_languages or []

class TranslationService:
    """Comprehensive translation service with caching and preference management"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: str = None):
        self.supabase = supabase_client
        # Initialize OpenAI client with optional custom base URL (for Grok, etc.)
        if base_url:
            self.openai_client = OpenAI(api_key=openai_api_key, base_url=base_url)
        else:
            self.openai_client = OpenAI(api_key=openai_api_key)
        # Use configurable model from environment or default
        import os
        self.translation_model = os.getenv("OPENAI_MODEL", "grok-beta")
        self.detection_model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.cache_ttl_hours = 24 * 7  # 1 week cache
        
        # Language-specific configurations
        self.language_configs = {
            SupportedLanguage.ENGLISH.value: {
                "name": "English",
                "native_name": "English",
                "formal_tone": False,
                "technical_terms": "standard"
            },
            SupportedLanguage.GERMAN.value: {
                "name": "German",
                "native_name": "Deutsch",
                "formal_tone": True,
                "technical_terms": "preserve_english"
            },
            SupportedLanguage.FRENCH.value: {
                "name": "French", 
                "native_name": "Français",
                "formal_tone": True,
                "technical_terms": "translate_with_context"
            }
        }
        
        # PPM-specific terminology dictionary
        self.ppm_terminology = {
            "en": {
                "project": "project",
                "portfolio": "portfolio", 
                "resource": "resource",
                "budget": "budget",
                "milestone": "milestone",
                "risk": "risk",
                "variance": "variance",
                "baseline": "baseline",
                "what-if": "what-if scenario",
                "monte carlo": "Monte Carlo simulation"
            },
            "de": {
                "project": "Projekt",
                "portfolio": "Portfolio",
                "resource": "Ressource", 
                "budget": "Budget",
                "milestone": "Meilenstein",
                "risk": "Risiko",
                "variance": "Abweichung",
                "baseline": "Baseline",
                "what-if": "Was-wäre-wenn-Szenario",
                "monte carlo": "Monte-Carlo-Simulation"
            },
            "fr": {
                "project": "projet",
                "portfolio": "portefeuille",
                "resource": "ressource",
                "budget": "budget", 
                "milestone": "jalon",
                "risk": "risque",
                "variance": "écart",
                "baseline": "référence",
                "what-if": "scénario hypothétique",
                "monte carlo": "simulation Monte Carlo"
            }
        }
    
    async def translate_content(self, request: TranslationRequest) -> TranslationResponse:
        """Translate content with caching and quality assurance"""
        start_time = datetime.now()
        
        try:
            # Check if translation is needed
            if request.source_language == request.target_language:
                return TranslationResponse(
                    original_content=request.content,
                    translated_content=request.content,
                    source_language=request.source_language,
                    target_language=request.target_language,
                    quality_score=1.0,
                    translation_time_ms=0,
                    cached=False,
                    confidence=1.0
                )
            
            # Check cache first
            cached_translation = await self._get_cached_translation(request.request_id)
            if cached_translation:
                return cached_translation
            
            # Perform translation
            translated_content = await self._perform_translation(request)
            
            # Calculate quality score
            quality_score = await self._calculate_quality_score(
                request.content, translated_content, request.source_language, request.target_language
            )
            
            # Calculate response time
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Create response
            response = TranslationResponse(
                original_content=request.content,
                translated_content=translated_content,
                source_language=request.source_language,
                target_language=request.target_language,
                quality_score=quality_score,
                translation_time_ms=response_time,
                cached=False,
                confidence=0.9  # High confidence for OpenAI translations
            )
            
            # Cache the translation
            await self._cache_translation(request.request_id, response)
            
            # Log translation event
            await self._log_translation_event(request, response)
            
            return response
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            # Return fallback response
            return TranslationResponse(
                original_content=request.content,
                translated_content=request.content,  # Fallback to original
                source_language=request.source_language,
                target_language=request.target_language,
                quality_score=0.0,
                translation_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                cached=False,
                confidence=0.0
            )
    
    async def detect_language(self, content: str) -> LanguageDetectionResult:
        """Detect the language of given content"""
        try:
            # Use OpenAI for language detection
            detection_prompt = f"""
            Detect the language of the following text and provide confidence score.
            Only consider these languages: English (en), German (de), French (fr).
            
            Text: {content[:500]}  # Limit to first 500 characters
            
            Respond in JSON format:
            {{
                "detected_language": "language_code",
                "confidence": 0.95,
                "alternatives": [
                    {{"language": "alternative_code", "confidence": 0.05}}
                ]
            }}
            """
            
            response = self.openai_client.chat.completions.create(
                model=self.detection_model,
                messages=[
                    {"role": "system", "content": "You are a language detection expert. Respond only with valid JSON."},
                    {"role": "user", "content": detection_prompt}
                ],
                temperature=0.1,
                max_tokens=200
            )
            
            result = json.loads(response.choices[0].message.content)
            
            return LanguageDetectionResult(
                detected_language=result["detected_language"],
                confidence=result["confidence"],
                alternative_languages=[(alt["language"], alt["confidence"]) for alt in result.get("alternatives", [])]
            )
            
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            # Fallback to English with low confidence
            return LanguageDetectionResult(
                detected_language="en",
                confidence=0.5,
                alternative_languages=[]
            )
    
    async def get_user_language_preference(self, user_id: str) -> str:
        """Get user's language preference from database"""
        try:
            response = self.supabase.table("user_profiles").select("preferences").eq("user_id", user_id).execute()
            
            if response.data:
                preferences = response.data[0].get("preferences", {})
                return preferences.get("language", "en")
            
            return "en"  # Default to English
            
        except Exception as e:
            logger.error(f"Failed to get user language preference: {e}")
            return "en"
    
    async def set_user_language_preference(self, user_id: str, language: str) -> bool:
        """Set user's language preference in database"""
        try:
            # Validate language
            if language not in [lang.value for lang in SupportedLanguage]:
                raise ValueError(f"Unsupported language: {language}")
            
            # Get current preferences
            response = self.supabase.table("user_profiles").select("preferences").eq("user_id", user_id).execute()
            
            current_preferences = {}
            if response.data:
                current_preferences = response.data[0].get("preferences", {})
            
            # Update language preference
            current_preferences["language"] = language
            current_preferences["language_updated_at"] = datetime.now().isoformat()
            
            # Upsert preferences
            upsert_response = self.supabase.table("user_profiles").upsert({
                "user_id": user_id,
                "preferences": current_preferences
            }).execute()
            
            # Log preference change
            await self._log_preference_change(user_id, language)
            
            return bool(upsert_response.data)
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to set user language preference for user {user_id}: {error_msg}")
            
            # Check for RLS policy errors
            if "policy" in error_msg.lower() or "permission" in error_msg.lower():
                logger.error("⚠️  RLS Policy Error: User may not have permission to update their own profile. "
                           "Run migrations/fix_user_profiles_update_policy.sql to fix this.")
            
            return False
    
    async def translate_help_response(self, content: str, target_language: str, 
                                    context: Dict[str, Any] = None) -> TranslationResponse:
        """Specialized translation for help chat responses"""
        request = TranslationRequest(
            content=content,
            source_language="en",  # Help responses are generated in English
            target_language=target_language,
            content_type="help_response",
            context=context or {}
        )
        
        return await self.translate_content(request)
    
    async def translate_ui_text(self, text_key: str, target_language: str, 
                              variables: Dict[str, Any] = None) -> str:
        """Translate UI text with variable substitution"""
        try:
            # Get base text (this would typically come from a translation file)
            base_text = await self._get_ui_text(text_key, target_language)
            
            # Substitute variables if provided
            if variables:
                for key, value in variables.items():
                    base_text = base_text.replace(f"{{{key}}}", str(value))
            
            return base_text
            
        except Exception as e:
            logger.error(f"UI text translation failed: {e}")
            return text_key  # Fallback to key
    
    async def get_supported_languages(self) -> List[Dict[str, Any]]:
        """Get list of supported languages with metadata"""
        return [
            {
                "code": lang,
                "name": config["name"],
                "native_name": config["native_name"],
                "formal_tone": config["formal_tone"]
            }
            for lang, config in self.language_configs.items()
        ]
    
    async def clear_translation_cache(self, user_id: str = None, language: str = None) -> bool:
        """Clear translation cache (optionally filtered by user or language)"""
        try:
            query = self.supabase.table("translation_cache").delete()
            
            if user_id:
                query = query.eq("user_id", user_id)
            if language:
                query = query.or_(f"source_language.eq.{language},target_language.eq.{language}")
            
            response = query.execute()
            return True
            
        except Exception as e:
            logger.error(f"Failed to clear translation cache: {e}")
            return False
    
    # Private methods
    
    async def _perform_translation(self, request: TranslationRequest) -> str:
        """Perform the actual translation using OpenAI"""
        source_config = self.language_configs.get(request.source_language, {})
        target_config = self.language_configs.get(request.target_language, {})
        
        # Build context-aware translation prompt
        system_prompt = self._build_translation_system_prompt(
            request.source_language, request.target_language, request.content_type
        )
        
        user_prompt = self._build_translation_user_prompt(request, source_config, target_config)
        
        response = self.openai_client.chat.completions.create(
            model=self.translation_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        
        return response.choices[0].message.content.strip()
    
    def _build_translation_system_prompt(self, source_lang: str, target_lang: str, content_type: str) -> str:
        """Build system prompt for translation"""
        target_config = self.language_configs.get(target_lang, {})
        target_name = target_config.get("native_name", target_lang)
        
        base_prompt = f"""You are a professional translator specializing in Project Portfolio Management (PPM) and business terminology. 
        Translate accurately from {source_lang} to {target_name}.
        
        Guidelines:
        - Maintain technical PPM terminology accuracy
        - Preserve formatting, bullet points, and structure
        - Keep the professional, helpful tone
        - Use appropriate formality level for the target language
        - Preserve any numbers, dates, and proper nouns
        - Maintain consistency with established PPM terminology
        """
        
        if target_config.get("formal_tone"):
            base_prompt += "\n- Use formal tone and polite language forms"
        
        if content_type == "help_response":
            base_prompt += "\n- This is help content for software users - be clear and actionable"
        elif content_type == "ui_text":
            base_prompt += "\n- This is user interface text - be concise and clear"
        
        return base_prompt
    
    def _build_translation_user_prompt(self, request: TranslationRequest, 
                                     source_config: Dict, target_config: Dict) -> str:
        """Build user prompt with context and terminology"""
        prompt = f"Translate the following {request.content_type} content:\n\n{request.content}"
        
        # Add PPM terminology context
        if request.target_language in self.ppm_terminology:
            terminology = self.ppm_terminology[request.target_language]
            prompt += f"\n\nUse these PPM term translations:\n"
            for en_term, translated_term in terminology.items():
                prompt += f"- {en_term} → {translated_term}\n"
        
        # Add context if provided
        if request.context:
            prompt += f"\n\nContext: {json.dumps(request.context, indent=2)}"
        
        return prompt
    
    async def _get_cached_translation(self, request_id: str) -> Optional[TranslationResponse]:
        """Get cached translation if available and not expired"""
        try:
            response = self.supabase.table("translation_cache").select("*").eq("request_id", request_id).execute()
            
            if not response.data:
                return None
            
            cache_entry = response.data[0]
            
            # Check if cache is expired
            cached_at = datetime.fromisoformat(cache_entry["cached_at"])
            if datetime.now() - cached_at > timedelta(hours=self.cache_ttl_hours):
                # Remove expired cache entry
                await self._remove_cached_translation(request_id)
                return None
            
            # Return cached translation
            return TranslationResponse(
                original_content=cache_entry["original_content"],
                translated_content=cache_entry["translated_content"],
                source_language=cache_entry["source_language"],
                target_language=cache_entry["target_language"],
                quality_score=cache_entry["quality_score"],
                translation_time_ms=cache_entry["translation_time_ms"],
                cached=True,
                confidence=cache_entry.get("confidence", 0.9)
            )
            
        except Exception as e:
            logger.error(f"Failed to get cached translation: {e}")
            return None
    
    async def _cache_translation(self, request_id: str, response: TranslationResponse):
        """Cache translation response"""
        try:
            cache_data = {
                "request_id": request_id,
                "original_content": response.original_content,
                "translated_content": response.translated_content,
                "source_language": response.source_language,
                "target_language": response.target_language,
                "quality_score": response.quality_score,
                "translation_time_ms": response.translation_time_ms,
                "confidence": response.confidence,
                "cached_at": datetime.now().isoformat()
            }
            
            self.supabase.table("translation_cache").upsert(cache_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to cache translation: {e}")
    
    async def _remove_cached_translation(self, request_id: str):
        """Remove expired cache entry"""
        try:
            self.supabase.table("translation_cache").delete().eq("request_id", request_id).execute()
        except Exception as e:
            logger.error(f"Failed to remove cached translation: {e}")
    
    async def _calculate_quality_score(self, original: str, translated: str, 
                                     source_lang: str, target_lang: str) -> float:
        """Calculate translation quality score"""
        try:
            # Simple heuristic-based quality scoring
            quality_factors = []
            
            # Length ratio (translated text should be reasonable length)
            length_ratio = len(translated) / len(original) if len(original) > 0 else 1.0
            if 0.7 <= length_ratio <= 1.5:
                quality_factors.append(0.8)
            else:
                quality_factors.append(0.5)
            
            # Check for preserved formatting
            if original.count('\n') == translated.count('\n'):
                quality_factors.append(0.9)
            else:
                quality_factors.append(0.7)
            
            # Check for preserved numbers and special characters
            import re
            original_numbers = re.findall(r'\d+', original)
            translated_numbers = re.findall(r'\d+', translated)
            if original_numbers == translated_numbers:
                quality_factors.append(0.9)
            else:
                quality_factors.append(0.6)
            
            # Base quality for OpenAI translations
            quality_factors.append(0.85)
            
            return sum(quality_factors) / len(quality_factors)
            
        except Exception as e:
            logger.error(f"Quality score calculation failed: {e}")
            return 0.7  # Default moderate quality
    
    async def _log_translation_event(self, request: TranslationRequest, response: TranslationResponse):
        """Log translation event for analytics"""
        try:
            event_data = {
                "request_id": request.request_id,
                "source_language": request.source_language,
                "target_language": request.target_language,
                "content_type": request.content_type,
                "content_length": len(request.content),
                "quality_score": response.quality_score,
                "translation_time_ms": response.translation_time_ms,
                "cached": response.cached,
                "confidence": response.confidence,
                "timestamp": datetime.now().isoformat()
            }
            
            self.supabase.table("translation_analytics").insert(event_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to log translation event: {e}")
    
    async def _log_preference_change(self, user_id: str, new_language: str):
        """Log language preference change"""
        try:
            event_data = {
                "user_id": user_id,
                "event_type": "language_preference_change",
                "event_data": {"new_language": new_language},
                "timestamp": datetime.now().isoformat()
            }
            
            self.supabase.table("help_analytics").insert(event_data).execute()
            
        except Exception as e:
            logger.error(f"Failed to log preference change: {e}")
    
    async def _get_ui_text(self, text_key: str, language: str) -> str:
        """Get UI text for given key and language (placeholder implementation)"""
        # This would typically load from a translation file or database
        # For now, return the key as fallback
        ui_translations = {
            "en": {
                "welcome_message": "Welcome to PPM Platform",
                "help_chat_title": "Help Chat",
                "loading": "Loading...",
                "error_occurred": "An error occurred"
            },
            "de": {
                "welcome_message": "Willkommen zur PPM-Plattform",
                "help_chat_title": "Hilfe-Chat",
                "loading": "Wird geladen...",
                "error_occurred": "Ein Fehler ist aufgetreten"
            },
            "fr": {
                "welcome_message": "Bienvenue sur la plateforme PPM",
                "help_chat_title": "Chat d'aide",
                "loading": "Chargement...",
                "error_occurred": "Une erreur s'est produite"
            }
        }
        
        return ui_translations.get(language, {}).get(text_key, text_key)