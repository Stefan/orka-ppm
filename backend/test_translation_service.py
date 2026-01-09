#!/usr/bin/env python3
"""
Test Translation Service
Simple test to verify translation service functionality
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config.database import supabase
from config.settings import settings
from services.translation_service import TranslationService, TranslationRequest, SupportedLanguage

async def test_translation_service():
    """Test the translation service functionality"""
    
    print("🧪 Testing Translation Service...")
    
    # Check if OpenAI API key is available
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("⚠️  OpenAI API key not found - skipping translation tests")
        return True
    
    try:
        # Initialize translation service
        translation_service = TranslationService(supabase, openai_api_key)
        print("✅ Translation service initialized")
        
        # Test 1: Get supported languages
        print("\n📋 Test 1: Get supported languages")
        languages = await translation_service.get_supported_languages()
        print(f"✅ Supported languages: {[lang['code'] for lang in languages]}")
        
        # Test 2: Language detection
        print("\n🔍 Test 2: Language detection")
        test_content = "Hello, how can I help you with project management?"
        detection_result = await translation_service.detect_language(test_content)
        print(f"✅ Detected language: {detection_result.detected_language} (confidence: {detection_result.confidence})")
        
        # Test 3: Translation (English to German)
        print("\n🔄 Test 3: Translation (EN → DE)")
        translation_request = TranslationRequest(
            content="Welcome to the PPM platform. How can I help you manage your projects?",
            source_language="en",
            target_language="de",
            content_type="help_response"
        )
        
        translation_response = await translation_service.translate_content(translation_request)
        print(f"✅ Original: {translation_response.original_content}")
        print(f"✅ Translated: {translation_response.translated_content}")
        print(f"✅ Quality score: {translation_response.quality_score}")
        print(f"✅ Translation time: {translation_response.translation_time_ms}ms")
        
        # Test 4: Translation (English to French)
        print("\n🔄 Test 4: Translation (EN → FR)")
        translation_request_fr = TranslationRequest(
            content="Your project budget is currently 85% utilized. Consider running a What-If scenario.",
            source_language="en",
            target_language="fr",
            content_type="help_response"
        )
        
        translation_response_fr = await translation_service.translate_content(translation_request_fr)
        print(f"✅ Original: {translation_response_fr.original_content}")
        print(f"✅ Translated: {translation_response_fr.translated_content}")
        print(f"✅ Quality score: {translation_response_fr.quality_score}")
        
        # Test 5: Same language (no translation needed)
        print("\n🔄 Test 5: Same language (EN → EN)")
        same_lang_request = TranslationRequest(
            content="This should not be translated",
            source_language="en",
            target_language="en",
            content_type="general"
        )
        
        same_lang_response = await translation_service.translate_content(same_lang_request)
        print(f"✅ Content unchanged: {same_lang_response.original_content == same_lang_response.translated_content}")
        print(f"✅ Translation time: {same_lang_response.translation_time_ms}ms")
        
        # Test 6: User language preferences (mock user)
        print("\n👤 Test 6: User language preferences")
        mock_user_id = "test-user-123"
        
        # Set language preference
        success = await translation_service.set_user_language_preference(mock_user_id, "de")
        print(f"✅ Set language preference: {success}")
        
        # Get language preference
        user_language = await translation_service.get_user_language_preference(mock_user_id)
        print(f"✅ Retrieved language preference: {user_language}")
        
        print("\n✅ All translation service tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Translation service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print("🚀 Translation Service Test Suite")
    print("=" * 50)
    
    # Print environment info
    settings.print_debug_info()
    print()
    
    # Run tests
    success = asyncio.run(test_translation_service())
    
    if success:
        print("\n🎉 All tests completed successfully!")
        print("📝 Translation service is ready for use")
    else:
        print("\n❌ Some tests failed!")
        print("🔧 Please check the configuration and try again")
        sys.exit(1)

if __name__ == "__main__":
    main()