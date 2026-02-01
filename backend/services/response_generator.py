"""
Response Generator Service for RAG Knowledge Base
Generates human-like responses using retrieved context and Grok AI
"""

import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import re

from openai import OpenAI, AsyncOpenAI
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from services.translation_service import TranslationService
from services.context_retriever import ContextualResult

logger = logging.getLogger(__name__)


class ResponseGeneratorError(Exception):
    """Base exception for response generator errors"""
    pass


class SensitiveInformationFilter:
    """Filters sensitive information from responses using regex patterns"""

    def __init__(self):
        # Common PII patterns
        self.pii_patterns = {
            'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
            'phone': re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
            'ssn': re.compile(r'\b\d{3}[-]?\d{2}[-]?\d{4}\b'),
            'credit_card': re.compile(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b'),
            'ip_address': re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
            'api_key': re.compile(r'\b[A-Za-z0-9_-]{20,}\b'),  # Generic long alphanumeric strings
        }

        # System-specific sensitive terms
        self.sensitive_terms = {
            'password', 'secret', 'token', 'key', 'credential', 'auth',
            'database_url', 'connection_string', 'private_key', 'certificate'
        }

    def filter_response(self, response: str) -> str:
        """
        Filter sensitive information from response text.

        Args:
            response: Raw response text

        Returns:
            Filtered response text
        """
        filtered_response = response

        # Filter PII patterns
        for pii_type, pattern in self.pii_patterns.items():
            filtered_response = pattern.sub(f'[REDACTED_{pii_type.upper()}]', filtered_response)

        # Filter sensitive terms (case-insensitive)
        for term in self.sensitive_terms:
            # Use word boundaries to avoid partial matches
            term_pattern = re.compile(rf'\b{re.escape(term)}\b', re.IGNORECASE)
            filtered_response = term_pattern.sub('[REDACTED]', filtered_response)

        return filtered_response

    def contains_sensitive_info(self, text: str) -> bool:
        """
        Check if text contains sensitive information.

        Args:
            text: Text to check

        Returns:
            True if sensitive information is detected
        """
        # Check PII patterns
        for pattern in self.pii_patterns.values():
            if pattern.search(text):
                return True

        # Check sensitive terms
        text_lower = text.lower()
        for term in self.sensitive_terms:
            if term in text_lower:
                return True

        return False


class CitationExtractor:
    """Extracts citations from generated responses"""

    @staticmethod
    def extract_citations(response: str) -> List[Dict[str, Any]]:
        """Extract citation references from response text"""
        citations = []

        # Pattern for citation markers like [1], [2], etc.
        citation_pattern = r'\[(\d+)\]'

        matches = re.findall(citation_pattern, response)
        for match in matches:
            try:
                citation_num = int(match)
                citations.append({
                    "number": citation_num,
                    "type": "reference"
                })
            except ValueError:
                continue

        return citations

    @staticmethod
    def validate_citations(response: str, context_chunks: List[ContextualResult]) -> bool:
        """Validate that citations correspond to available context"""
        citations = CitationExtractor.extract_citations(response)
        max_citation = max((c["number"] for c in citations), default=0)

        return max_citation <= len(context_chunks)


class ResponseGenerator:
    """
    Service for generating human-like responses using retrieved context.

    Features:
    - Grok AI powered response generation
    - Citation extraction and validation
    - Confidence scoring
    - Multi-language response support
    - Fallback responses for low confidence
    """

    def __init__(
        self,
        openai_client: AsyncOpenAI,
        translation_service: TranslationService,
        model: str = None,
        max_tokens: int = 1000,
        temperature: float = 0.3,
        confidence_threshold: float = 0.6,
        enable_sensitive_filtering: bool = True
    ):
        self.openai_client = openai_client
        self.translation_service = translation_service
        self.model = model or os.getenv("OPENAI_MODEL", "grok-beta")
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.confidence_threshold = confidence_threshold
        self.enable_sensitive_filtering = enable_sensitive_filtering
        self.sensitive_filter = SensitiveInformationFilter() if enable_sensitive_filtering else None

    async def generate_response(
        self,
        query: str,
        context_results: List[ContextualResult],
        user_context: Dict[str, Any],
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generate a response using retrieved context.

        Args:
            query: Original user query
            context_results: Retrieved and ranked context
            user_context: User context information
            language: Response language

        Returns:
            Response dictionary with content, citations, confidence, etc.
        """
        try:
            logger.debug(f"Generating response for query: {query[:100]}...")

            # Calculate overall confidence
            confidence = self._calculate_confidence(context_results)

            # Check if we have enough confidence
            if confidence < self.confidence_threshold:
                return self._generate_fallback_response(query, language)

            # Construct prompt
            prompt = self._construct_prompt(query, context_results, user_context)

            # Generate response
            response_text = await self._generate_with_openai(prompt)

            # Extract citations
            citations = CitationExtractor.extract_citations(response_text)

            # Validate citations
            citations_valid = CitationExtractor.validate_citations(response_text, context_results)

            # Filter sensitive information
            if self.enable_sensitive_filtering and self.sensitive_filter:
                original_text = response_text
                response_text = self.sensitive_filter.filter_response(response_text)

                if original_text != response_text:
                    logger.warning("Sensitive information filtered from response")

            # Translate if needed
            if language != "en":
                try:
                    response_text = await self.translation_service.translate_from_english(
                        response_text, language
                    )
                except Exception as e:
                    logger.warning(f"Translation failed: {e}, using English response")

            # Create source information
            sources = self._create_sources(context_results)

            return {
                "response": response_text,
                "citations": citations,
                "sources": sources,
                "confidence": confidence,
                "citations_valid": citations_valid,
                "language": language,
                "generated_at": datetime.now().isoformat(),
                "model": self.model
            }

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return self._generate_error_response(query, language)

    def _calculate_confidence(self, context_results: List[ContextualResult]) -> float:
        """Calculate confidence score based on retrieval quality"""
        if not context_results:
            return 0.0

        # Weighted average of top results
        weights = [0.5, 0.3, 0.2]  # Weight top 3 results
        total_weight = 0.0
        weighted_sum = 0.0

        for i, result in enumerate(context_results[:3]):
            weight = weights[i] if i < len(weights) else 0.1
            weighted_sum += result.total_score * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    def _construct_prompt(
        self,
        query: str,
        context_results: List[ContextualResult],
        user_context: Dict[str, Any]
    ) -> str:
        """Construct the prompt for the language model"""
        system_prompt = """You are an expert assistant for a Project Management and Resource Optimization platform.

Your role is to provide helpful, accurate, and concise answers based on the provided context.
Always cite your sources using numbered references like [1], [2], etc.
Be professional, clear, and focus on actionable information.

Guidelines:
- Use the provided context to answer questions
- Cite specific sources for claims and information
- If information conflicts, note the discrepancy
- Be concise but comprehensive
- Use markdown formatting for clarity when appropriate
- If you're unsure about something, say so clearly
"""

        # Add user context
        user_info = f"User Role: {user_context.get('role', 'user')}\n"
        if user_context.get('current_page'):
            user_info += f"Current Page: {user_context['current_page']}\n"

        # Format context
        context_text = ""
        for i, result in enumerate(context_results, 1):
            chunk = result.search_result
            context_text += f"\n[{i}] {chunk.content}\n"
            if chunk.metadata.get('title'):
                context_text += f"Title: {chunk.metadata['title']}\n"
            if chunk.metadata.get('category'):
                context_text += f"Category: {chunk.metadata['category']}\n"

        prompt = f"""{system_prompt}

{user_info}

Context:
{context_text}

Question: {query}

Answer:"""

        return prompt

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate response using OpenAI API with retry logic"""
        try:
            response = await self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise ResponseGeneratorError(f"Failed to generate response: {str(e)}") from e

    def _create_sources(self, context_results: List[ContextualResult]) -> List[Dict[str, Any]]:
        """Create source information from context results"""
        sources = []
        for i, result in enumerate(context_results, 1):
            chunk = result.search_result
            source = {
                "id": i,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "similarity_score": chunk.similarity_score,
                "title": chunk.metadata.get("title", "Untitled"),
                "category": chunk.metadata.get("category", "general"),
                "url": chunk.metadata.get("url"),
                "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
            }
            sources.append(source)

        return sources

    def _generate_fallback_response(self, query: str, language: str) -> Dict[str, Any]:
        """Generate a fallback response when confidence is low"""
        fallback_responses = {
            "en": "I'm sorry, I don't have enough information to provide a comprehensive answer to your question. Please try rephrasing your question or contact support for assistance.",
            "es": "Lo siento, no tengo suficiente información para proporcionar una respuesta completa a su pregunta. Por favor, intente reformular su pregunta o contacte al soporte para asistencia.",
            "fr": "Désolé, je n'ai pas assez d'informations pour fournir une réponse complète à votre question. Veuillez reformuler votre question ou contacter le support pour obtenir de l'aide.",
            "de": "Es tut mir leid, ich habe nicht genügend Informationen, um eine umfassende Antwort auf Ihre Frage zu geben. Bitte versuchen Sie, Ihre Frage umzuformulieren, oder wenden Sie sich an den Support.",
        }

        response_text = fallback_responses.get(language, fallback_responses["en"])

        return {
            "response": response_text,
            "citations": [],
            "sources": [],
            "confidence": 0.0,
            "citations_valid": True,
            "language": language,
            "generated_at": datetime.now().isoformat(),
            "model": self.model,
            "is_fallback": True
        }

    def _generate_error_response(self, query: str, language: str) -> Dict[str, Any]:
        """Generate an error response when generation fails"""
        error_responses = {
            "en": "I'm experiencing technical difficulties and cannot provide an answer right now. Please try again later or contact support.",
            "es": "Estoy experimentando dificultades técnicas y no puedo proporcionar una respuesta en este momento. Por favor, inténtelo de nuevo más tarde o contacte al soporte.",
            "fr": "J'éprouve des difficultés techniques et ne peux pas fournir de réponse pour le moment. Veuillez réessayer plus tard ou contacter le support.",
            "de": "Ich habe technische Schwierigkeiten und kann derzeit keine Antwort geben. Bitte versuchen Sie es später noch einmal oder wenden Sie sich an den Support.",
        }

        response_text = error_responses.get(language, error_responses["en"])

        return {
            "response": response_text,
            "citations": [],
            "sources": [],
            "confidence": 0.0,
            "citations_valid": True,
            "language": language,
            "generated_at": datetime.now().isoformat(),
            "model": self.model,
            "is_error": True
        }