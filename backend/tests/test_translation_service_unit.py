#!/usr/bin/env python3
"""
Unit Tests for Translation Service
Tests translation accuracy, caching, language detection, and fallback mechanisms
Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
from typing import Dict, Any, List

import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.translation_service import (
    TranslationService, 
    TranslationRequest, 
    TranslationResponse,
    LanguageDetectionResult,
    SupportedLanguage,
    TranslationQuality
)


class TestTranslationServiceUnit:
    """Unit tests for Translation Service"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase client"""
        mock_client = Mock()
        mock_table = Mock()
        mock_client.table.return_value = mock_table
        
        # Mock table operations
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.or_.return_value = mock_table
        mock_table.delete.return_value = mock_table
        mock_table.upsert.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute.return_value = Mock(data=[])
        
        return mock_client
    
    @pytest.fixture
    def mock_openai(self):
        """Mock OpenAI client"""
        mock_client = Mock()
        mock_chat = Mock()
        mock_completions = Mock()
        mock_client.chat = mock_chat
        mock_chat.completions = mock_completions
        return mock_client
    
    @pytest.fixture
    def translation_service(self, mock_supabase, mock_openai):
        """Create translation service with mocked dependencies"""
        with patch('services.translation_service.OpenAI', return_value=mock_openai):
            service = TranslationService(mock_supabase, "test-api-key")
            service.openai_client = mock_openai
            return service
    
    # Test 1: Translation Accuracy Tests
    
    @pytest.mark.asyncio
    async def test_translate_content_english_to_german_accuracy(self, translation_service, mock_openai):
        """Test translation accuracy from English to German"""
        # Requirements: 5.1, 5.2
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Willkommen zur PPM-Plattform. Wie kann ich Ihnen bei der Verwaltung Ihrer Projekte helfen?"
        mock_openai.chat.completions.create.return_value = mock_response
        
        # Create translation request
        request = TranslationRequest(
            content="Welcome to the PPM platform. How can I help you manage your projects?",
            source_language="en",
            target_language="de",
            content_type="help_response"
        )
        
        # Perform translation
        response = await translation_service.translate_content(request)
        
        # Verify translation accuracy
        assert response.original_content == request.content
        assert response.translated_content == "Willkommen zur PPM-Plattform. Wie kann ich Ihnen bei der Verwaltung Ihrer Projekte helfen?"
        assert response.source_language == "en"
        assert response.target_language == "de"
        assert response.quality_score > 0.0
        assert response.confidence > 0.0
        assert not response.cached
        
        # Verify OpenAI was called with correct parameters
        mock_openai.chat.completions.create.assert_called_once()
        call_args = mock_openai.chat.completions.create.call_args
        assert call_args[1]['model'] == "gpt-4"
        assert call_args[1]['temperature'] == 0.1
        
        # Verify system prompt contains PPM-specific instructions
        system_message = call_args[1]['messages'][0]['content']
        assert "Project Portfolio Management" in system_message
        assert "PPM" in system_message
        assert "formal tone" in system_message.lower()
    
    @pytest.mark.asyncio
    async def test_translate_content_english_to_french_accuracy(self, translation_service, mock_openai):
        """Test translation accuracy from English to French"""
        # Requirements: 5.1, 5.2
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Votre budget de projet est actuellement utilisé à 85%. Envisagez d'exécuter un scénario hypothétique."
        mock_openai.chat.completions.create.return_value = mock_response
        
        request = TranslationRequest(
            content="Your project budget is currently 85% utilized. Consider running a What-If scenario.",
            source_language="en",
            target_language="fr",
            content_type="help_response"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify French translation
        assert response.translated_content == "Votre budget de projet est actuellement utilisé à 85%. Envisagez d'exécuter un scénario hypothétique."
        assert response.target_language == "fr"
        assert response.quality_score > 0.0
        
        # Verify user prompt contains PPM terminology
        call_args = mock_openai.chat.completions.create.call_args
        user_message = call_args[1]['messages'][1]['content']
        assert "what-if → scénario hypothétique" in user_message
    
    @pytest.mark.asyncio
    async def test_translate_content_preserves_ppm_terminology(self, translation_service, mock_openai):
        """Test that PPM terminology is correctly preserved in translations"""
        # Requirements: 5.2
        
        # Mock OpenAI response with PPM terms
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Das Portfolio enthält 5 Projekte mit einem Gesamtbudget von €1M. Die Monte-Carlo-Simulation zeigt Risiken."
        mock_openai.chat.completions.create.return_value = mock_response
        
        request = TranslationRequest(
            content="The portfolio contains 5 projects with a total budget of €1M. The Monte Carlo simulation shows risks.",
            source_language="en",
            target_language="de",
            content_type="help_response"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify PPM terminology is preserved
        translated = response.translated_content
        assert "Portfolio" in translated
        assert "Projekte" in translated
        assert "Gesamtbudget" in translated  # "Budget" appears as "Gesamtbudget" in the translation
        assert "Monte-Carlo-Simulation" in translated
        assert "Risiken" in translated
        
        # Verify terminology dictionary was included in prompt
        call_args = mock_openai.chat.completions.create.call_args
        user_message = call_args[1]['messages'][1]['content']
        assert "portfolio → Portfolio" in user_message
        assert "monte carlo → Monte-Carlo-Simulation" in user_message
    
    @pytest.mark.asyncio
    async def test_translate_content_same_language_no_translation(self, translation_service):
        """Test that same language requests return original content without translation"""
        # Requirements: 5.1
        
        request = TranslationRequest(
            content="This should not be translated",
            source_language="en",
            target_language="en",
            content_type="general"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify no translation occurred
        assert response.original_content == response.translated_content
        assert response.translation_time_ms == 0
        assert response.quality_score == 1.0
        assert response.confidence == 1.0
        assert not response.cached
    
    # Test 2: Caching Tests
    
    @pytest.mark.asyncio
    async def test_translation_caching_stores_results(self, translation_service, mock_supabase, mock_openai):
        """Test that translation results are properly cached"""
        # Requirements: 5.3
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hallo Welt"
        mock_openai.chat.completions.create.return_value = mock_response
        
        # Mock cache miss (no existing cache)
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        request = TranslationRequest(
            content="Hello World",
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify translation was performed
        assert not response.cached
        assert response.translated_content == "Hallo Welt"
        
        # Verify cache was written
        mock_supabase.table.assert_any_call("translation_cache")
        upsert_calls = [call for call in mock_supabase.table.return_value.upsert.call_args_list]
        assert len(upsert_calls) > 0
        
        # Verify cached data structure
        cached_data = upsert_calls[0][0][0]
        assert cached_data["request_id"] == request.request_id
        assert cached_data["original_content"] == "Hello World"
        assert cached_data["translated_content"] == "Hallo Welt"
        assert cached_data["source_language"] == "en"
        assert cached_data["target_language"] == "de"
    
    @pytest.mark.asyncio
    async def test_translation_caching_retrieves_cached_results(self, translation_service, mock_supabase):
        """Test that cached translations are retrieved and returned"""
        # Requirements: 5.3
        
        # Mock cache hit
        cached_data = {
            "request_id": "trans_test123",
            "original_content": "Hello World",
            "translated_content": "Hallo Welt",
            "source_language": "en",
            "target_language": "de",
            "quality_score": 0.9,
            "translation_time_ms": 150,
            "confidence": 0.95,
            "cached_at": datetime.now().isoformat()
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [cached_data]
        
        request = TranslationRequest(
            content="Hello World",
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify cached result was returned
        assert response.cached
        assert response.translated_content == "Hallo Welt"
        assert response.quality_score == 0.9
        assert response.translation_time_ms == 150
        assert response.confidence == 0.95
    
    @pytest.mark.asyncio
    async def test_translation_cache_expiration(self, translation_service, mock_supabase):
        """Test that expired cache entries are removed and not used"""
        # Requirements: 5.3
        
        # Mock expired cache entry
        expired_time = datetime.now() - timedelta(days=8)  # Older than 7-day TTL
        cached_data = {
            "request_id": "trans_expired",
            "original_content": "Hello World",
            "translated_content": "Hallo Welt",
            "source_language": "en",
            "target_language": "de",
            "quality_score": 0.9,
            "translation_time_ms": 150,
            "confidence": 0.95,
            "cached_at": expired_time.isoformat()
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [cached_data]
        
        # Mock OpenAI response for new translation
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hallo Welt Neu"
        translation_service.openai_client.chat.completions.create.return_value = mock_response
        
        request = TranslationRequest(
            content="Hello World",
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify expired cache was not used
        assert not response.cached
        assert response.translated_content == "Hallo Welt Neu"
        
        # Verify expired cache was deleted
        mock_supabase.table.return_value.delete.assert_called()
    
    @pytest.mark.asyncio
    async def test_clear_translation_cache(self, translation_service, mock_supabase):
        """Test cache clearing functionality"""
        # Requirements: 5.3
        
        # Test clearing all cache
        result = await translation_service.clear_translation_cache()
        assert result is True
        mock_supabase.table.return_value.delete.assert_called()
        
        # Test clearing cache for specific user
        await translation_service.clear_translation_cache(user_id="test-user")
        mock_supabase.table.return_value.delete.return_value.eq.assert_called_with("user_id", "test-user")
        
        # Test clearing cache for specific language
        await translation_service.clear_translation_cache(language="de")
        mock_supabase.table.return_value.delete.return_value.or_.assert_called()
    
    # Test 3: Language Detection Tests
    
    @pytest.mark.asyncio
    async def test_detect_language_english(self, translation_service, mock_openai):
        """Test language detection for English content"""
        # Requirements: 5.4
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "detected_language": "en",
            "confidence": 0.95,
            "alternatives": [
                {"language": "de", "confidence": 0.03},
                {"language": "fr", "confidence": 0.02}
            ]
        })
        mock_openai.chat.completions.create.return_value = mock_response
        
        result = await translation_service.detect_language("Hello, how can I help you with project management?")
        
        # Verify detection result
        assert result.detected_language == "en"
        assert result.confidence == 0.95
        assert len(result.alternative_languages) == 2
        assert ("de", 0.03) in result.alternative_languages
        assert ("fr", 0.02) in result.alternative_languages
        
        # Verify OpenAI was called with detection prompt
        mock_openai.chat.completions.create.assert_called_once()
        call_args = mock_openai.chat.completions.create.call_args
        assert call_args[1]['model'] == "gpt-3.5-turbo"
        user_message = call_args[1]['messages'][1]['content']
        assert "Hello, how can I help you with project management?" in user_message
    
    @pytest.mark.asyncio
    async def test_detect_language_german(self, translation_service, mock_openai):
        """Test language detection for German content"""
        # Requirements: 5.4
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "detected_language": "de",
            "confidence": 0.92,
            "alternatives": [
                {"language": "en", "confidence": 0.05},
                {"language": "fr", "confidence": 0.03}
            ]
        })
        mock_openai.chat.completions.create.return_value = mock_response
        
        result = await translation_service.detect_language("Hallo, wie kann ich Ihnen bei der Projektverwaltung helfen?")
        
        # Verify German detection
        assert result.detected_language == "de"
        assert result.confidence == 0.92
        assert len(result.alternative_languages) == 2
    
    @pytest.mark.asyncio
    async def test_detect_language_french(self, translation_service, mock_openai):
        """Test language detection for French content"""
        # Requirements: 5.4
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "detected_language": "fr",
            "confidence": 0.89,
            "alternatives": [
                {"language": "en", "confidence": 0.07},
                {"language": "de", "confidence": 0.04}
            ]
        })
        mock_openai.chat.completions.create.return_value = mock_response
        
        result = await translation_service.detect_language("Bonjour, comment puis-je vous aider avec la gestion de projet?")
        
        # Verify French detection
        assert result.detected_language == "fr"
        assert result.confidence == 0.89
    
    @pytest.mark.asyncio
    async def test_detect_language_fallback_on_error(self, translation_service, mock_openai):
        """Test language detection fallback when OpenAI fails"""
        # Requirements: 5.5
        
        # Mock OpenAI error
        mock_openai.chat.completions.create.side_effect = Exception("API Error")
        
        result = await translation_service.detect_language("Some text")
        
        # Verify fallback to English
        assert result.detected_language == "en"
        assert result.confidence == 0.5
        assert len(result.alternative_languages) == 0
    
    # Test 4: Fallback Mechanism Tests
    
    @pytest.mark.asyncio
    async def test_translation_fallback_on_openai_error(self, translation_service, mock_openai):
        """Test translation fallback when OpenAI API fails"""
        # Requirements: 5.5
        
        # Mock OpenAI error
        mock_openai.chat.completions.create.side_effect = Exception("API Error")
        
        request = TranslationRequest(
            content="Hello World",
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Verify fallback behavior
        assert response.original_content == "Hello World"
        assert response.translated_content == "Hello World"  # Fallback to original
        assert response.quality_score == 0.0
        assert response.confidence == 0.0
        assert not response.cached
    
    @pytest.mark.asyncio
    async def test_user_language_preference_fallback(self, translation_service, mock_supabase):
        """Test user language preference fallback to English"""
        # Requirements: 5.5
        
        # Mock database error
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB Error")
        
        language = await translation_service.get_user_language_preference("test-user")
        
        # Verify fallback to English
        assert language == "en"
    
    @pytest.mark.asyncio
    async def test_set_user_language_preference_validation(self, translation_service, mock_supabase):
        """Test user language preference validation and error handling"""
        # Requirements: 5.1, 5.5
        
        # Test invalid language
        result = await translation_service.set_user_language_preference("test-user", "invalid")
        assert result is False
        
        # Test valid language with database error
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB Error")
        result = await translation_service.set_user_language_preference("test-user", "de")
        assert result is False
    
    # Test 5: User Language Preferences
    
    @pytest.mark.asyncio
    async def test_get_user_language_preference_success(self, translation_service, mock_supabase):
        """Test successful retrieval of user language preference"""
        # Requirements: 5.1
        
        # Mock user profile with language preference
        profile_data = {
            "preferences": {
                "language": "de",
                "language_updated_at": datetime.now().isoformat()
            }
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [profile_data]
        
        language = await translation_service.get_user_language_preference("test-user")
        
        assert language == "de"
        mock_supabase.table.assert_called_with("user_profiles")
    
    @pytest.mark.asyncio
    async def test_set_user_language_preference_success(self, translation_service, mock_supabase):
        """Test successful setting of user language preference"""
        # Requirements: 5.1
        
        # Mock existing profile
        existing_profile = {
            "preferences": {
                "other_setting": "value"
            }
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [existing_profile]
        mock_supabase.table.return_value.upsert.return_value.execute.return_value.data = [{"success": True}]
        
        result = await translation_service.set_user_language_preference("test-user", "fr")
        
        assert result is True
        
        # Verify upsert was called with correct data
        upsert_call = mock_supabase.table.return_value.upsert.call_args[0][0]
        assert upsert_call["user_id"] == "test-user"
        assert upsert_call["preferences"]["language"] == "fr"
        assert "language_updated_at" in upsert_call["preferences"]
    
    # Test 6: Supported Languages
    
    @pytest.mark.asyncio
    async def test_get_supported_languages(self, translation_service):
        """Test retrieval of supported languages list"""
        # Requirements: 5.1
        
        languages = await translation_service.get_supported_languages()
        
        # Verify all supported languages are returned
        assert len(languages) == 3
        
        # Check English
        en_lang = next(lang for lang in languages if lang["code"] == "en")
        assert en_lang["name"] == "English"
        assert en_lang["native_name"] == "English"
        assert en_lang["formal_tone"] is False
        
        # Check German
        de_lang = next(lang for lang in languages if lang["code"] == "de")
        assert de_lang["name"] == "German"
        assert de_lang["native_name"] == "Deutsch"
        assert de_lang["formal_tone"] is True
        
        # Check French
        fr_lang = next(lang for lang in languages if lang["code"] == "fr")
        assert fr_lang["name"] == "French"
        assert fr_lang["native_name"] == "Français"
        assert fr_lang["formal_tone"] is True
    
    # Test 7: Specialized Translation Methods
    
    @pytest.mark.asyncio
    async def test_translate_help_response(self, translation_service, mock_openai):
        """Test specialized help response translation"""
        # Requirements: 5.2
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hier ist Ihre Hilfe für PPM-Features"
        mock_openai.chat.completions.create.return_value = mock_response
        
        response = await translation_service.translate_help_response(
            content="Here is your help for PPM features",
            target_language="de",
            context={"page": "dashboard", "feature": "budget"}
        )
        
        # Verify help response translation
        assert response.translated_content == "Hier ist Ihre Hilfe für PPM-Features"
        assert response.source_language == "en"
        assert response.target_language == "de"
        
        # Verify context was included
        call_args = mock_openai.chat.completions.create.call_args
        user_message = call_args[1]['messages'][1]['content']
        assert "help_response" in user_message
        assert '"page": "dashboard"' in user_message
        assert '"feature": "budget"' in user_message
    
    @pytest.mark.asyncio
    async def test_translate_ui_text_with_variables(self, translation_service):
        """Test UI text translation with variable substitution"""
        # Requirements: 5.2
        
        # Mock the _get_ui_text method
        translation_service._get_ui_text = AsyncMock(return_value="Willkommen {user_name} zur PPM-Plattform")
        
        result = await translation_service.translate_ui_text(
            text_key="welcome_message",
            target_language="de",
            variables={"user_name": "John"}
        )
        
        # Verify variable substitution
        assert result == "Willkommen John zur PPM-Plattform"
        translation_service._get_ui_text.assert_called_once_with("welcome_message", "de")
    
    @pytest.mark.asyncio
    async def test_translate_ui_text_fallback(self, translation_service):
        """Test UI text translation fallback to key"""
        # Requirements: 5.5
        
        # Mock error in _get_ui_text
        translation_service._get_ui_text = AsyncMock(side_effect=Exception("Translation error"))
        
        result = await translation_service.translate_ui_text(
            text_key="unknown_key",
            target_language="de"
        )
        
        # Verify fallback to key
        assert result == "unknown_key"
    
    # Test 8: Quality Score Calculation
    
    @pytest.mark.asyncio
    async def test_quality_score_calculation(self, translation_service):
        """Test translation quality score calculation"""
        # Requirements: 5.3
        
        # Test good quality translation
        quality_score = await translation_service._calculate_quality_score(
            original="Hello world\nHow are you?",
            translated="Hallo Welt\nWie geht es dir?",
            source_lang="en",
            target_lang="de"
        )
        
        # Quality should be high for good translation
        assert 0.7 <= quality_score <= 1.0
        
        # Test poor quality translation (very different length)
        poor_quality_score = await translation_service._calculate_quality_score(
            original="Hello",
            translated="This is a very long translation that doesn't match the original length at all",
            source_lang="en",
            target_lang="de"
        )
        
        # Quality should be lower for poor translation
        assert poor_quality_score < quality_score
    
    # Test 9: Error Handling and Edge Cases
    
    @pytest.mark.asyncio
    async def test_translation_request_id_generation(self):
        """Test translation request ID generation for caching"""
        # Requirements: 5.3
        
        request1 = TranslationRequest(
            content="Hello",
            source_language="en",
            target_language="de",
            content_type="general"
        )
        
        request2 = TranslationRequest(
            content="Hello",
            source_language="en",
            target_language="de",
            content_type="general"
        )
        
        request3 = TranslationRequest(
            content="Hello",
            source_language="en",
            target_language="fr",  # Different target language
            content_type="general"
        )
        
        # Same requests should have same ID
        assert request1.request_id == request2.request_id
        
        # Different requests should have different IDs
        assert request1.request_id != request3.request_id
        
        # IDs should start with 'trans_'
        assert request1.request_id.startswith("trans_")
    
    @pytest.mark.asyncio
    async def test_empty_content_handling(self, translation_service, mock_openai):
        """Test handling of empty or whitespace-only content"""
        # Requirements: 5.5
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = ""
        mock_openai.chat.completions.create.return_value = mock_response
        
        request = TranslationRequest(
            content="   ",  # Whitespace only
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Should handle gracefully
        assert response.original_content == "   "
        assert isinstance(response.translated_content, str)
        assert response.quality_score >= 0.0
    
    @pytest.mark.asyncio
    async def test_very_long_content_handling(self, translation_service, mock_openai):
        """Test handling of very long content"""
        # Requirements: 5.3
        
        # Create very long content
        long_content = "This is a test sentence. " * 1000  # ~25,000 characters
        
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Das ist ein Testsatz. " * 1000
        mock_openai.chat.completions.create.return_value = mock_response
        
        request = TranslationRequest(
            content=long_content,
            source_language="en",
            target_language="de"
        )
        
        response = await translation_service.translate_content(request)
        
        # Should handle long content
        assert len(response.original_content) > 20000
        assert len(response.translated_content) > 20000
        assert response.quality_score > 0.0


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])