"""
Property-Based Tests for Document Parser
Feature: ai-help-chat-knowledge-base
Tests Properties 4 and 5 from the design document
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List, Dict
import json
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.document_parser import (
    DocumentParser,
    DocumentFormat,
    ParsedDocument,
    DocumentMetadata,
    ParsingError
)


# Test data strategies
@st.composite
def markdown_document_strategy(draw):
    """Generate valid markdown documents"""
    # Generate title
    title = draw(st.text(min_size=5, max_size=100, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
    )))
    assume(title.strip())
    
    # Generate sections
    num_sections = draw(st.integers(min_value=1, max_value=5))
    sections = []
    
    content_parts = [f"# {title}\n\n"]
    
    for i in range(num_sections):
        section_title = draw(st.text(min_size=5, max_size=50, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
        )))
        assume(section_title.strip())
        
        section_content = draw(st.text(min_size=20, max_size=500, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
        )))
        assume(section_content.strip())
        
        content_parts.append(f"## {section_title}\n\n{section_content}\n\n")
    
    markdown_content = ''.join(content_parts)
    
    return markdown_content


@st.composite
def json_document_strategy(draw):
    """Generate valid JSON documents"""
    title = draw(st.text(min_size=5, max_size=100, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
    )))
    assume(title.strip())
    
    content = draw(st.text(min_size=50, max_size=1000, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
    )))
    assume(content.strip())
    
    # Generate sections
    num_sections = draw(st.integers(min_value=0, max_value=3))
    sections = []
    
    for i in range(num_sections):
        section_heading = draw(st.text(min_size=5, max_size=50, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
        )))
        section_content = draw(st.text(min_size=20, max_size=200, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
        )))
        
        if section_heading.strip() and section_content.strip():
            sections.append({
                "heading": section_heading.strip(),
                "content": section_content.strip()
            })
    
    doc = {
        "title": title.strip(),
        "content": content.strip(),
        "sections": sections,
        "metadata": {
            "version": "1.0",
            "author": "test"
        }
    }
    
    return json.dumps(doc)


@st.composite
def plain_text_document_strategy(draw):
    """Generate valid plain text documents"""
    # Generate title line
    title = draw(st.text(min_size=5, max_size=100, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')
    )))
    assume(title.strip())
    
    # Generate paragraphs
    num_paragraphs = draw(st.integers(min_value=1, max_value=5))
    paragraphs = []
    
    for i in range(num_paragraphs):
        paragraph = draw(st.text(min_size=50, max_size=300, alphabet=st.characters(
            whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
        )))
        if paragraph.strip():
            paragraphs.append(paragraph.strip())
    
    content = f"{title}\n\n" + "\n\n".join(paragraphs)
    
    return content


# Fixtures
@pytest.fixture(scope="module")
def parser():
    """Create document parser instance"""
    return DocumentParser()


@pytest.mark.property_test
class TestMultiFormatParsing:
    """
    Property 5: Multi-Format Parsing
    Validates: Requirements 2.1
    
    For any valid document in supported formats (Markdown, plain text, JSON), 
    the Ingestion_Service must successfully parse and extract text content.
    """
    
    @settings(max_examples=100, deadline=10000)
    @given(markdown_content=markdown_document_strategy())
    def test_markdown_parsing_succeeds(self, parser, markdown_content):
        """
        Test that valid markdown documents are successfully parsed.
        
        Property: For any valid markdown document, parse_markdown() must
        return a ParsedDocument without raising exceptions.
        """
        # Parse markdown
        result = parser.parse_markdown(markdown_content)
        
        # Verify result is ParsedDocument
        assert isinstance(result, ParsedDocument), \
            "Result must be a ParsedDocument instance"
        
        # Verify content is extracted
        assert result.content, \
            "Parsed document must have content"
        
        assert len(result.content.strip()) > 0, \
            "Content must not be empty"
        
        # Verify format is set correctly
        assert result.format == DocumentFormat.MARKDOWN, \
            "Format must be MARKDOWN"
    
    @settings(max_examples=100, deadline=10000)
    @given(json_content=json_document_strategy())
    def test_json_parsing_succeeds(self, parser, json_content):
        """
        Test that valid JSON documents are successfully parsed.
        
        Property: For any valid JSON document, parse_json() must
        return a ParsedDocument without raising exceptions.
        """
        # Parse JSON
        result = parser.parse_json(json_content)
        
        # Verify result is ParsedDocument
        assert isinstance(result, ParsedDocument), \
            "Result must be a ParsedDocument instance"
        
        # Verify content is extracted
        assert result.content, \
            "Parsed document must have content"
        
        assert len(result.content.strip()) > 0, \
            "Content must not be empty"
        
        # Verify format is set correctly
        assert result.format == DocumentFormat.JSON, \
            "Format must be JSON"
    
    @settings(max_examples=100, deadline=10000)
    @given(plain_text=plain_text_document_strategy())
    def test_plain_text_parsing_succeeds(self, parser, plain_text):
        """
        Test that valid plain text documents are successfully parsed.
        
        Property: For any valid plain text document, parse_plain_text() must
        return a ParsedDocument without raising exceptions.
        """
        # Parse plain text
        result = parser.parse_plain_text(plain_text)
        
        # Verify result is ParsedDocument
        assert isinstance(result, ParsedDocument), \
            "Result must be a ParsedDocument instance"
        
        # Verify content is extracted
        assert result.content, \
            "Parsed document must have content"
        
        assert len(result.content.strip()) > 0, \
            "Content must not be empty"
        
        # Verify format is set correctly
        assert result.format == DocumentFormat.PLAIN_TEXT, \
            "Format must be PLAIN_TEXT"
    
    @settings(max_examples=100, deadline=10000)
    @given(markdown_content=markdown_document_strategy())
    def test_markdown_title_extraction(self, parser, markdown_content):
        """
        Test that markdown titles are correctly extracted.
        
        Property: For any markdown document with an H1 heading,
        the title must be extracted and stored.
        """
        # Parse markdown
        result = parser.parse_markdown(markdown_content)
        
        # If document starts with H1, title should be extracted
        if markdown_content.strip().startswith('# '):
            assert result.title is not None, \
                "Title must be extracted from H1 heading"
            
            assert len(result.title) > 0, \
                "Extracted title must not be empty"
    
    @settings(max_examples=50, deadline=10000)
    @given(markdown_content=markdown_document_strategy())
    def test_markdown_sections_extraction(self, parser, markdown_content):
        """
        Test that markdown sections are correctly extracted.
        
        Property: For any markdown document with headings,
        sections must be extracted and organized.
        """
        # Parse markdown
        result = parser.parse_markdown(markdown_content)
        
        # Verify sections is a list
        assert isinstance(result.sections, list), \
            "Sections must be a list"
        
        # If document has headings, sections should be extracted
        heading_count = markdown_content.count('\n#')
        if heading_count > 0:
            assert len(result.sections) > 0, \
                "Sections must be extracted when headings exist"
            
            # Verify section structure
            for section in result.sections:
                assert isinstance(section, dict), \
                    "Each section must be a dictionary"
                
                assert "heading" in section, \
                    "Section must have 'heading' field"
                
                assert "content" in section, \
                    "Section must have 'content' field"
    
    @settings(max_examples=50, deadline=10000)
    @given(json_content=json_document_strategy())
    def test_json_structure_preservation(self, parser, json_content):
        """
        Test that JSON document structure is preserved.
        
        Property: For any JSON document with title and sections,
        the parsed result must preserve this structure.
        """
        # Parse JSON
        result = parser.parse_json(json_content)
        
        # Parse original to compare
        original = json.loads(json_content)
        
        # Verify title is preserved
        if "title" in original:
            assert result.title == original["title"], \
                "Title must be preserved from JSON"
        
        # Verify sections are preserved
        if "sections" in original and original["sections"]:
            assert len(result.sections) == len(original["sections"]), \
                "Number of sections must match"
    
    @settings(max_examples=30, deadline=10000)
    @given(content=st.one_of(
        markdown_document_strategy(),
        json_document_strategy(),
        plain_text_document_strategy()
    ))
    def test_parsed_content_not_empty(self, parser, content):
        """
        Test that parsed content is never empty for valid input.
        
        Property: For any valid document content, the parsed result
        must have non-empty content field.
        """
        # Determine format
        if content.strip().startswith('{'):
            format_type = DocumentFormat.JSON
        elif '#' in content:
            format_type = DocumentFormat.MARKDOWN
        else:
            format_type = DocumentFormat.PLAIN_TEXT
        
        # Parse
        result = parser.parse(content, format_type)
        
        # Verify content is not empty
        assert result.content, \
            "Parsed content must not be None"
        
        assert len(result.content.strip()) > 0, \
            "Parsed content must not be empty string"
        
        # Verify content is reasonable length
        assert len(result.content) >= 10, \
            "Parsed content must have reasonable length"


@pytest.mark.property_test
class TestParsingErrorHandling:
    """
    Additional property tests for error handling.
    """
    
    @settings(max_examples=20, deadline=5000)
    @given(invalid_content=st.one_of(st.just(""), st.just("   "), st.just("\n\n")))
    def test_empty_content_raises_error(self, parser, invalid_content):
        """
        Test that empty content raises appropriate error.
        
        Property: For any empty or whitespace-only content,
        parsing must raise ParsingError.
        """
        with pytest.raises(ParsingError, match="content cannot be empty"):
            parser.parse_markdown(invalid_content)
        
        with pytest.raises(ParsingError, match="content cannot be empty"):
            parser.parse_json(invalid_content)
        
        with pytest.raises(ParsingError, match="content cannot be empty"):
            parser.parse_plain_text(invalid_content)
    
    @settings(max_examples=20, deadline=5000)
    @given(invalid_json=st.text(min_size=1, max_size=100).filter(
        lambda x: x.strip() and not x.strip().startswith('{')
    ))
    def test_invalid_json_raises_error(self, parser, invalid_json):
        """
        Test that invalid JSON or valid JSON that's not an object raises appropriate error.

        Property: For any string that's not valid JSON or valid JSON that's not an object,
        parse_json() must raise ParsingError.
        """
        with pytest.raises(ParsingError, match="(Invalid JSON format|JSON document must be an object)"):
            parser.parse_json(invalid_json)
    
    @settings(max_examples=20, deadline=5000)
    @given(json_without_content=st.just('{"title": "Test", "metadata": {}}'))
    def test_json_without_content_raises_error(self, parser, json_without_content):
        """
        Test that JSON without content field raises error.
        
        Property: For any JSON document without 'content' or 'sections',
        parse_json() must raise ParsingError.
        """
        with pytest.raises(ParsingError, match="must contain 'content' or 'sections'"):
            parser.parse_json(json_without_content)


@pytest.mark.property_test
class TestMetadataExtraction:
    """
    Property tests for metadata extraction functionality.
    """
    
    @settings(max_examples=50, deadline=10000)
    @given(content=st.text(min_size=100, max_size=1000, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs', 'Po')
    )))
    def test_metadata_extraction_succeeds(self, parser, content):
        """
        Test that metadata extraction always succeeds for valid content.
        
        Property: For any non-empty content, extract_metadata() must
        return a DocumentMetadata object without raising exceptions.
        """
        assume(content.strip())
        
        # Extract metadata
        metadata = parser.extract_metadata(content)
        
        # Verify result type
        assert isinstance(metadata, DocumentMetadata), \
            "Result must be DocumentMetadata instance"
        
        # Verify fields exist
        assert hasattr(metadata, 'category'), \
            "Metadata must have category field"
        
        assert hasattr(metadata, 'keywords'), \
            "Metadata must have keywords field"
        
        assert hasattr(metadata, 'detected_features'), \
            "Metadata must have detected_features field"
    
    @settings(max_examples=50, deadline=10000)
    @given(
        content=st.text(min_size=100, max_size=500),
        title=st.text(min_size=5, max_size=100)
    )
    def test_metadata_with_title(self, parser, content, title):
        """
        Test that metadata extraction handles title parameter.
        
        Property: For any content and title, extract_metadata() must
        incorporate the title in analysis.
        """
        assume(content.strip() and title.strip())
        
        # Extract metadata with title
        metadata = parser.extract_metadata(content, title)
        
        # Verify title is stored
        assert metadata.title == title, \
            "Title must be stored in metadata"
    
    @settings(max_examples=30, deadline=10000)
    @given(content=st.text(min_size=50, max_size=500))
    def test_keywords_are_list(self, parser, content):
        """
        Test that extracted keywords are always a list.
        
        Property: For any content, extracted keywords must be a list
        (possibly empty).
        """
        assume(content.strip())
        
        metadata = parser.extract_metadata(content)
        
        assert isinstance(metadata.keywords, list), \
            "Keywords must be a list"
        
        # Verify all keywords are strings
        for keyword in metadata.keywords:
            assert isinstance(keyword, str), \
                "Each keyword must be a string"
    
    @settings(max_examples=30, deadline=10000)
    @given(content=st.text(min_size=50, max_size=500))
    def test_detected_features_are_list(self, parser, content):
        """
        Test that detected features are always a list.
        
        Property: For any content, detected features must be a list
        (possibly empty).
        """
        assume(content.strip())
        
        metadata = parser.extract_metadata(content)
        
        assert isinstance(metadata.detected_features, list), \
            "Detected features must be a list"
        
        # Verify all features are strings
        for feature in metadata.detected_features:
            assert isinstance(feature, str), \
                "Each feature must be a string"
