"""
Document Parser Service for RAG Knowledge Base
Parses various document formats and extracts structured content
"""

import logging
import json
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class DocumentFormat(str, Enum):
    """Supported document formats"""
    MARKDOWN = "markdown"
    JSON = "json"
    PLAIN_TEXT = "plain_text"


class ParsingError(Exception):
    """Base exception for parsing errors"""
    pass


@dataclass
class ParsedDocument:
    """Structured representation of a parsed document"""
    content: str
    title: Optional[str] = None
    sections: List[Dict[str, str]] = None
    metadata: Dict[str, Any] = None
    format: DocumentFormat = DocumentFormat.PLAIN_TEXT
    
    def __post_init__(self):
        if self.sections is None:
            self.sections = []
        if self.metadata is None:
            self.metadata = {}


@dataclass
class DocumentMetadata:
    """Extracted metadata from document content"""
    title: Optional[str] = None
    category: Optional[str] = None
    keywords: List[str] = None
    detected_features: List[str] = None
    
    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []
        if self.detected_features is None:
            self.detected_features = []


class DocumentParser:
    """
    Service for parsing various document formats into structured text.
    
    Supports:
    - Markdown documents with headings and structure
    - JSON structured documentation
    - Plain text documents
    - Automatic metadata extraction
    """
    
    # Feature category keywords for auto-detection
    CATEGORY_KEYWORDS = {
        "dashboard": ["dashboard", "overview", "project tracking", "summary view"],
        "resource_management": ["resource", "allocation", "capacity", "workload", "assignment"],
        "financial_tracking": ["budget", "cost", "financial", "expense", "forecast"],
        "risk_management": ["risk", "mitigation", "threat", "issue"],
        "monte_carlo": ["monte carlo", "simulation", "probability", "scenario analysis"],
        "pmr": ["pmr", "project management report", "status report"],
        "change_management": ["change request", "change order", "modification"],
        "schedule_management": ["schedule", "timeline", "gantt", "milestone", "dependency"],
        "ai_features": ["ai", "artificial intelligence", "machine learning", "prediction"],
        "collaboration": ["collaboration", "real-time", "comments", "sharing"],
        "audit_trails": ["audit", "history", "log", "compliance", "tracking"],
        "user_management": ["user", "role", "permission", "rbac", "access control"],
        "general": ["help", "guide", "tutorial", "getting started"]
    }
    
    def __init__(self):
        """Initialize the document parser"""
        logger.info("DocumentParser initialized")
    
    def parse(self, content: str, format: DocumentFormat = DocumentFormat.PLAIN_TEXT) -> ParsedDocument:
        """
        Parse document content based on format.
        
        Args:
            content: Raw document content
            format: Document format type
            
        Returns:
            ParsedDocument with structured content
            
        Raises:
            ParsingError: If parsing fails
        """
        if not content or not content.strip():
            raise ParsingError("Document content cannot be empty")
        
        try:
            if format == DocumentFormat.MARKDOWN:
                return self.parse_markdown(content)
            elif format == DocumentFormat.JSON:
                return self.parse_json(content)
            else:
                return self.parse_plain_text(content)
        except Exception as e:
            logger.error(f"Failed to parse document: {e}")
            raise ParsingError(f"Document parsing failed: {str(e)}") from e
    
    def parse_markdown(self, content: str) -> ParsedDocument:
        """
        Extract text and structure from Markdown.
        
        Parses markdown to extract:
        - Title (from first H1 heading)
        - Sections (organized by headings)
        - Clean text content
        
        Args:
            content: Markdown content
            
        Returns:
            ParsedDocument with extracted structure
        """
        if not content or not content.strip():
            raise ParsingError("Markdown content cannot be empty")
        
        logger.debug(f"Parsing markdown document (length={len(content)})")
        
        # Extract title from first H1 heading
        title = None
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()
        
        # Extract sections by headings
        sections = []
        
        # Split by headings (H1-H6)
        heading_pattern = r'^(#{1,6})\s+(.+)$'
        lines = content.split('\n')
        
        current_section = None
        current_content = []
        
        for line in lines:
            heading_match = re.match(heading_pattern, line)
            
            if heading_match:
                # Save previous section if exists
                if current_section:
                    sections.append({
                        "heading": current_section,
                        "content": '\n'.join(current_content).strip()
                    })
                
                # Start new section
                level = len(heading_match.group(1))
                heading_text = heading_match.group(2).strip()
                current_section = heading_text
                current_content = []
            else:
                current_content.append(line)
        
        # Add last section
        if current_section:
            sections.append({
                "heading": current_section,
                "content": '\n'.join(current_content).strip()
            })
        
        # Clean markdown syntax from content
        clean_content = self._clean_markdown(content)
        
        return ParsedDocument(
            content=clean_content,
            title=title,
            sections=sections,
            format=DocumentFormat.MARKDOWN,
            metadata={"original_length": len(content)}
        )
    
    def parse_json(self, content: str) -> ParsedDocument:
        """
        Extract structured information from JSON documentation.
        
        Expected JSON structure:
        {
            "title": "Document Title",
            "content": "Main content",
            "sections": [{"heading": "...", "content": "..."}],
            "metadata": {...}
        }
        
        Args:
            content: JSON string content
            
        Returns:
            ParsedDocument with extracted structure
        """
        if not content or not content.strip():
            raise ParsingError("JSON content cannot be empty")
        
        logger.debug(f"Parsing JSON document (length={len(content)})")
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ParsingError(f"Invalid JSON format: {str(e)}") from e

        # Ensure data is a dictionary
        if not isinstance(data, dict):
            raise ParsingError(f"JSON document must be an object, got {type(data).__name__}")

        # Extract fields
        title = data.get("title")
        main_content = data.get("content", "")
        sections = data.get("sections", [])
        metadata = data.get("metadata", {})
        
        # If no main content, concatenate section contents
        if not main_content and sections:
            main_content = "\n\n".join(
                f"{s.get('heading', '')}\n{s.get('content', '')}"
                for s in sections
            )
        
        if not main_content:
            raise ParsingError("JSON document must contain 'content' or 'sections'")
        
        return ParsedDocument(
            content=main_content.strip(),
            title=title,
            sections=sections,
            format=DocumentFormat.JSON,
            metadata=metadata
        )
    
    def parse_plain_text(self, content: str) -> ParsedDocument:
        """
        Parse plain text document.
        
        Args:
            content: Plain text content
            
        Returns:
            ParsedDocument with basic structure
        """
        if not content or not content.strip():
            raise ParsingError("Plain text content cannot be empty")
        
        logger.debug(f"Parsing plain text document (length={len(content)})")
        
        # Try to extract title from first line if it looks like a title
        lines = content.strip().split('\n')
        title = None
        
        if lines:
            first_line = lines[0].strip()
            # Consider first line as title if it's short and doesn't end with punctuation
            if len(first_line) < 100 and not first_line.endswith(('.', '!', '?')):
                title = first_line
        
        return ParsedDocument(
            content=content.strip(),
            title=title,
            format=DocumentFormat.PLAIN_TEXT,
            metadata={"original_length": len(content)}
        )
    
    def extract_metadata(self, content: str, title: Optional[str] = None) -> DocumentMetadata:
        """
        Auto-detect category and keywords from content.
        
        Uses keyword matching to identify:
        - Feature category
        - Relevant keywords
        - Detected features
        
        Args:
            content: Document content to analyze
            title: Optional document title
            
        Returns:
            DocumentMetadata with detected information
        """
        if not content:
            return DocumentMetadata()
        
        logger.debug("Extracting metadata from content")
        
        # Combine title and content for analysis
        text_to_analyze = f"{title or ''} {content}".lower()
        
        # Detect category based on keyword matching
        category_scores = {}
        
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            score = sum(1 for keyword in keywords if keyword.lower() in text_to_analyze)
            if score > 0:
                category_scores[category] = score
        
        # Select category with highest score
        detected_category = None
        if category_scores:
            detected_category = max(category_scores, key=category_scores.get)
        
        # Extract keywords (words that appear frequently)
        keywords = self._extract_keywords(content)
        
        # Detect mentioned features
        detected_features = []
        for category, category_keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in category_keywords:
                if keyword.lower() in text_to_analyze:
                    detected_features.append(keyword)
        
        # Remove duplicates and limit
        detected_features = list(set(detected_features))[:10]
        
        return DocumentMetadata(
            title=title,
            category=detected_category,
            keywords=keywords[:15],  # Limit to top 15 keywords
            detected_features=detected_features
        )
    
    def _clean_markdown(self, content: str) -> str:
        """
        Remove markdown syntax to get clean text.
        
        Args:
            content: Markdown content
            
        Returns:
            Clean text without markdown syntax
        """
        # Remove code blocks
        text = re.sub(r'```[\s\S]*?```', '', content)
        text = re.sub(r'`[^`]+`', '', text)
        
        # Remove links but keep text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        
        # Remove images
        text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
        
        # Remove bold/italic
        text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^\*]+)\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # Remove headings markers
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        
        # Remove horizontal rules
        text = re.sub(r'^[-*_]{3,}$', '', text, flags=re.MULTILINE)
        
        # Remove list markers
        text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
        
        # Clean up extra whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()
    
    def _extract_keywords(self, content: str, max_keywords: int = 15) -> List[str]:
        """
        Extract important keywords from content.
        
        Args:
            content: Text content
            max_keywords: Maximum number of keywords to return
            
        Returns:
            List of extracted keywords
        """
        # Simple keyword extraction based on word frequency
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        }
        
        # Extract words (alphanumeric sequences)
        words = re.findall(r'\b[a-z]{3,}\b', content.lower())
        
        # Filter stop words and count frequency
        word_freq = {}
        for word in words:
            if word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Sort by frequency and return top keywords
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        keywords = [word for word, freq in sorted_words[:max_keywords]]
        
        return keywords
