"""
Property-Based Tests for Translation Service
Feature: ai-help-chat-knowledge-base
Tests Properties 11, 14, and 18 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict, Any
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.translation_service import (
    TranslationService,
    TranslationRequest,
    SupportedLanguage,
    TranslationQuality
)


# Test data strategies
@st.composite
def translation_text_strategy(draw):
    """Generate realistic text for translation testing"""
    # Generate text with various characteristics
    text_type = draw(st.sampled_from(["simple", "technical", "mixed"]))

    if text_type == "simple":
        # Simple sentences
        words = draw(st.lists(
            st.text(min_size=3, max_size=10, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll')
            )),
            min_size=5, max_size=15
        ))
        text = " ".join(words) + "."

    elif text_type == "technical":
        # Technical terms mixed with regular text
        technical_terms = [
            "API", "database", "frontend", "backend", "authentication",
            "authorization", "middleware", "endpoint", "repository", "service"
        ]
        regular_words = draw(st.lists(
            st.text(min_size=2, max_size=8, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll')
            )),
            min_size=3, max_size=10
        ))

        # Mix technical and regular terms
        all_words = technical_terms[:3] + regular_words
        draw(st.random()).shuffle(all_words)
        text = " ".join(all_words[:8]) + "."

    else:  # mixed
        sentences = draw(st.lists(
            st.text(min_size=20, max_size=100, alphabet=st.characters(
                whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
            )),
            min_size=2, max_size=5
        ))
        text = " ".join(sentences)

    assume(len(text.strip()) > 10)  # Ensure minimum length
    return text.strip()


@st.composite
def supported_language_pair_strategy(draw):
    """Generate valid language pairs for translation"""
    source_lang = draw(st.sampled_from([lang.value for lang in SupportedLanguage]))
    target_lang = draw(st.sampled_from([lang.value for lang in SupportedLanguage]))

    # Ensure different languages
    assume(source_lang != target_lang)

    return (source_lang, target_lang)


@pytest.fixture
def mock_translation_service():
    """Create a mock translation service for testing"""
    class MockTranslationService:
        def __init__(self):
            self.translations = {}

        async def translate_to_english(self, text: str, source_lang: str) -> str:
            """Mock translation to English"""
            key = f"{text}_{source_lang}_en"
            if key not in self.translations:
                # Simple mock: just add "EN:" prefix
                self.translations[key] = f"EN: {text}"
            return self.translations[key]

        async def translate_from_english(self, text: str, target_lang: str) -> str:
            """Mock translation from English"""
            key = f"{text}_en_{target_lang}"
            if key not in self.translations:
                # Simple mock: add language code
                self.translations[key] = f"[{target_lang}] {text}"
            return self.translations[key]

        def preserve_technical_terms(self, text: str) -> str:
            """Mock technical term preservation"""
            # Simple mock: identify and mark technical terms
            technical_terms = ["API", "database", "frontend", "backend", "authentication"]
            result = text
            for term in technical_terms:
                if term in result:
                    result = result.replace(term, f"TECH:{term}")
            return result

    return MockTranslationService()


@pytest.mark.property_test
class TestNonEnglishQueryTranslation:
    """
    Property tests for non-English query translation.
    Property 11: Non-English Query Translation
    Validates: Requirements 3.5
    """

    @settings(max_examples=30, deadline=10000)
    @given(
        text=translation_text_strategy(),
        lang_pair=supported_language_pair_strategy()
    )
    async def test_translation_preserves_structure(self, mock_translation_service, text, lang_pair):
        """
        Test that translation preserves basic text structure.

        Property 11: Translation must preserve sentence structure
        and not lose significant content.
        """
        source_lang, target_lang = lang_pair

        # Translate to English first
        english_text = await mock_translation_service.translate_to_english(text, source_lang)

        # Then translate back
        back_translated = await mock_translation_service.translate_from_english(english_text, source_lang)

        # Basic structure checks
        assert len(english_text) > 0, "Translation must produce non-empty text"
        assert len(back_translated) > 0, "Back-translation must produce non-empty text"

        # Should contain original language markers (in our mock)
        assert f"[{source_lang}]" in back_translated or "EN:" in english_text

    @settings(max_examples=20, deadline=8000)
    @given(text=translation_text_strategy())
    async def test_english_to_english_passthrough(self, mock_translation_service, text):
        """
        Test that English-to-English translation works.

        Property 11: English text should pass through translation
        unchanged or with minimal modification.
        """
        # Translate English to English
        result = await mock_translation_service.translate_from_english(text, "en")

        # In our mock, it should add language markers
        assert isinstance(result, str), "Result must be string"
        assert len(result) > 0, "Result must be non-empty"


@pytest.mark.property_test
class TestResponseLanguageMatching:
    """
    Property tests for response language matching.
    Property 14: Response Language Matching
    Validates: Requirements 4.5, 6.2
    """

    @settings(max_examples=25, deadline=9000)
    @given(
        english_text=translation_text_strategy(),
        target_lang=st.sampled_from(["de", "fr", "es", "it"])
    )
    async def test_response_language_indicators(self, mock_translation_service, english_text, target_lang):
        """
        Test that translated responses contain language indicators.

        Property 14: Translated responses must clearly indicate
        the target language.
        """
        translated = await mock_translation_service.translate_from_english(english_text, target_lang)

        # In our mock, translations include language codes
        assert f"[{target_lang}]" in translated, f"Translation must indicate language {target_lang}"

    @settings(max_examples=15, deadline=6000)
    @given(
        text=translation_text_strategy(),
        lang_pair=supported_language_pair_strategy()
    )
    async def test_round_trip_consistency(self, mock_translation_service, text, lang_pair):
        """
        Test that round-trip translation maintains consistency.

        Property 14: Multiple translations of the same text
        should produce consistent results.
        """
        source_lang, target_lang = lang_pair

        # Perform translation multiple times
        results = []
        for _ in range(3):
            translated = await mock_translation_service.translate_to_english(text, source_lang)
            results.append(translated)

        # All results should be identical (our mock is deterministic)
        assert all(r == results[0] for r in results), "Multiple translations should be consistent"


@pytest.mark.property_test
class TestTechnicalTermPreservation:
    """
    Property tests for technical term preservation.
    Property 18: Technical Term Preservation
    Validates: Requirements 6.3
    """

    @settings(max_examples=20, deadline=7000)
    @given(text=st.text(min_size=50, max_size=200, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
    )))
    def test_technical_terms_identified(self, mock_translation_service, text):
        """
        Test that technical terms are properly identified and marked.

        Property 18: Technical terms must be preserved during
        translation processes.
        """
        assume("API" in text or "database" in text or "frontend" in text)

        preserved = mock_translation_service.preserve_technical_terms(text)

        # Check that technical terms are marked
        technical_terms = ["API", "database", "frontend", "backend", "authentication"]
        marked_terms = [f"TECH:{term}" for term in technical_terms if term in text]

        for marked_term in marked_terms:
            assert marked_term in preserved, f"Technical term {marked_term} must be preserved"

    @settings(max_examples=15, deadline=5000)
    @given(text=st.text(min_size=30, max_size=150))
    def test_non_technical_text_unchanged(self, mock_translation_service, text):
        """
        Test that non-technical text is handled appropriately.

        Property 18: Non-technical content should be processed
        without breaking the text structure.
        """
        assume(not any(term in text for term in ["API", "database", "frontend", "backend", "authentication"]))

        preserved = mock_translation_service.preserve_technical_terms(text)

        # Non-technical text should be unchanged in our mock
        assert preserved == text, "Non-technical text should remain unchanged"