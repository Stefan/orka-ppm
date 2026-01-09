"""
Unit Tests for HelpRAGAgent

This module contains unit tests for the HelpRAGAgent class, focusing on:
- Query processing with various contexts
- Scope validation functionality
- Translation capabilities
- Proactive tip generation
- Context-aware response generation

Requirements Validated: 2.1, 2.2, 2.5
"""

import pytest
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import uuid

# Import test setup
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.help_rag_agent import (
    HelpRAGAgent, PageContext, HelpResponse, UserBehavior, 
    ProactiveTip, TranslatedContent
)
from services.scope_validator import ScopeValidator, ScopeValidationResult

# Configure pytest for async tests
pytestmark = pytest.mark.asyncio


class TestHelpRAGAgent:
    """Test HelpRAGAgent functionality"""
    
    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase client"""
        mock_client = Mock()
        mock_client.table.return_value.select.return_value.execute.return_value.data = []
        mock_client.table.return_value.insert.return_value.execute.return_value = Mock()
        mock_client.table.return_value.upsert.return_value.execute.return_value = Mock()
        mock_client.rpc.return_value.execute.return_value.data = []
        return mock_client
    
    @pytest.fixture
    def mock_openai_client(self):
        """Mock OpenAI client"""
        mock_client = Mock()
        
        # Mock chat completion response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "This is a helpful PPM response about project management."
        mock_response.usage.prompt_tokens = 100
        mock_response.usage.completion_tokens = 50
        mock_client.chat.completions.create.return_value = mock_response
        
        # Mock embedding response
        mock_embedding_response = Mock()
        mock_embedding_response.data = [Mock()]
        mock_embedding_response.data[0].embedding = [0.1] * 1536  # Standard embedding size
        mock_client.embeddings.create.return_value = mock_embedding_response
        
        return mock_client
    
    @pytest.fixture
    def help_rag_agent(self, mock_supabase, mock_openai_client):
        """Create HelpRAGAgent instance with mocked dependencies"""
        with patch('services.help_rag_agent.OpenAI', return_value=mock_openai_client):
            agent = HelpRAGAgent(mock_supabase, "test-api-key")
            agent.openai_client = mock_openai_client
            return agent
    
    @pytest.fixture
    def sample_page_context(self):
        """Sample page context for testing"""
        return PageContext(
            route="/dashboard",
            page_title="Project Dashboard",
            user_role="project_manager",
            current_project="test-project-123",
            current_portfolio="test-portfolio-456",
            relevant_data={"project_count": 5, "budget_total": 100000}
        )
    
    @pytest.fixture
    def sample_user_behavior(self):
        """Sample user behavior for testing"""
        return UserBehavior(
            recent_pages=["/dashboard", "/projects", "/resources"],
            time_on_page=120,
            frequent_queries=["how to create project", "budget tracking"],
            user_level="intermediate"
        )

    # Test query processing with various contexts
    async def test_process_help_query_dashboard_context(self, help_rag_agent, sample_page_context, mock_supabase):
        """Test query processing with dashboard context"""
        # Mock the search_help_content method
        with patch.object(help_rag_agent, '_search_help_content') as mock_search:
            mock_search.return_value = [
                {
                    'content_type': 'guide',
                    'content_id': 'dashboard-guide-1',
                    'content_text': 'Dashboard shows project overview and key metrics',
                    'similarity_score': 0.9,
                    'metadata': {'title': 'Dashboard Guide', 'tags': ['dashboard', 'overview']}
                }
            ]
            
            # Mock contextual data retrieval
            with patch.object(help_rag_agent, '_get_contextual_ppm_data') as mock_context:
                mock_context.return_value = {
                    'recent_projects': [{'name': 'Test Project', 'status': 'active'}],
                    'portfolio_count': 3
                }
                
                # Mock operation logging
                with patch.object(help_rag_agent, 'log_operation') as mock_log:
                    mock_log.return_value = "test-operation-id"
                    
                    # Mock session storage
                    with patch.object(help_rag_agent, '_store_help_session') as mock_store:
                        mock_store.return_value = None
                        
                        query = "How do I view my project dashboard?"
                        user_id = "test-user-123"
                        
                        result = await help_rag_agent.process_help_query(
                            query, sample_page_context, user_id
                        )
                        
                        # Assertions
                        assert isinstance(result, HelpResponse)
                        assert result.response is not None
                        assert len(result.sources) > 0
                        assert result.confidence > 0
                        assert result.session_id.startswith("help_")
                        assert result.response_time_ms >= 0  # Allow 0 for mocked tests
                        
                        # Verify mocks were called
                        mock_search.assert_called_once_with(query, limit=5)
                        mock_context.assert_called_once_with(sample_page_context, user_id)
                        mock_log.assert_called_once()
                        mock_store.assert_called_once()

    async def test_process_help_query_project_context(self, help_rag_agent, mock_supabase):
        """Test query processing with project-specific context"""
        project_context = PageContext(
            route="/projects/123",
            page_title="Project Details",
            user_role="project_manager",
            current_project="project-123"
        )
        
        with patch.object(help_rag_agent, '_search_help_content') as mock_search:
            mock_search.return_value = [
                {
                    'content_type': 'feature_doc',
                    'content_id': 'project-management-1',
                    'content_text': 'Project management features include task tracking and resource allocation',
                    'similarity_score': 0.85,
                    'metadata': {'title': 'Project Management', 'tags': ['projects', 'management']}
                }
            ]
            
            with patch.object(help_rag_agent, '_get_contextual_ppm_data') as mock_context:
                mock_context.return_value = {
                    'project_name': 'Test Project',
                    'project_status': 'active',
                    'project_budget': 50000
                }
                
                with patch.object(help_rag_agent, 'log_operation') as mock_log:
                    mock_log.return_value = "test-operation-id"
                    
                    with patch.object(help_rag_agent, '_store_help_session') as mock_store:
                        mock_store.return_value = None
                        
                        query = "How do I manage project resources?"
                        user_id = "test-user-456"
                        
                        result = await help_rag_agent.process_help_query(
                            query, project_context, user_id
                        )
                        
                        # Assertions
                        assert isinstance(result, HelpResponse)
                        assert "project" in result.response.lower()
                        assert len(result.sources) > 0
                        assert result.sources[0]['type'] == 'feature_doc'
                        assert result.confidence > 0

    async def test_process_help_query_out_of_scope(self, help_rag_agent, sample_page_context):
        """Test query processing with out-of-scope query"""
        # Mock the scope validation to return false
        with patch.object(help_rag_agent, '_is_ppm_domain_query') as mock_scope:
            mock_scope.return_value = False
            
            with patch.object(help_rag_agent, '_generate_scope_redirect_response') as mock_redirect:
                mock_redirect.return_value = HelpResponse(
                    response="I can only help with PPM platform features.",
                    sources=[],
                    confidence=1.0,
                    session_id="redirect_123",
                    response_time_ms=50
                )
                
                query = "What's the weather like today?"
                user_id = "test-user-789"
                
                result = await help_rag_agent.process_help_query(
                    query, sample_page_context, user_id
                )
                
                # Assertions
                assert isinstance(result, HelpResponse)
                assert "PPM platform" in result.response
                assert len(result.sources) == 0
                assert result.confidence == 1.0
                assert result.session_id.startswith("redirect_")
                
                # Verify scope check was called
                mock_scope.assert_called_once_with(query)
                mock_redirect.assert_called_once()

    async def test_process_help_query_with_translation(self, help_rag_agent, sample_page_context):
        """Test query processing with German translation"""
        with patch.object(help_rag_agent, '_search_help_content') as mock_search:
            mock_search.return_value = [
                {
                    'content_type': 'guide',
                    'content_id': 'test-guide',
                    'content_text': 'Test guide content',
                    'similarity_score': 0.8,
                    'metadata': {'title': 'Test Guide'}
                }
            ]
            
            with patch.object(help_rag_agent, '_get_contextual_ppm_data') as mock_context:
                mock_context.return_value = {}
                
                # Mock translation service
                with patch('services.translation_service.TranslationService') as mock_translation_service:
                    mock_service_instance = Mock()
                    mock_translation_service.return_value = mock_service_instance
                    
                    mock_translation_response = Mock()
                    mock_translation_response.translated_content = "Dies ist eine hilfreiche PPM-Antwort über Projektmanagement."
                    mock_service_instance.translate_content.return_value = mock_translation_response
                    
                    with patch.object(help_rag_agent, 'log_operation') as mock_log:
                        mock_log.return_value = "test-operation-id"
                        
                        with patch.object(help_rag_agent, '_store_help_session') as mock_store:
                            mock_store.return_value = None
                            
                            query = "How do I create a new project in the PPM system?"
                            user_id = "test-user-de"
                            
                            result = await help_rag_agent.process_help_query(
                                query, sample_page_context, user_id, language='de'
                            )
                            
                            # Assertions
                            assert isinstance(result, HelpResponse)
                            assert "PPM" in result.response
                            assert result.confidence > 0
                            
                            # Verify the query was processed (not redirected)
                            assert not result.session_id.startswith("redirect_")

    # Test scope validation functionality
    def test_is_ppm_domain_query_valid_queries(self, help_rag_agent):
        """Test PPM domain validation for valid queries"""
        valid_queries = [
            "How do I create a new project?",
            "What is the budget allocation for resources?",
            "How to track project milestones?",
            "Where can I find the risk assessment tools?",
            "How do I run a Monte Carlo simulation?",
            "What are the portfolio optimization features?",
            "How to manage resource utilization?",
            "Where is the dashboard navigation menu?"
        ]
        
        for query in valid_queries:
            result = help_rag_agent._is_ppm_domain_query(query)
            assert result is True, f"Query should be valid: {query}"

    def test_is_ppm_domain_query_invalid_queries(self, help_rag_agent):
        """Test PPM domain validation for invalid queries"""
        invalid_queries = [
            "What's the weather like today?",
            "Tell me about sports news",
            "How do I cook pasta?",
            "What are the latest movies?",
            "Give me travel advice",
            "What's happening in politics?",
            "Tell me about competitor tools like Microsoft Project",
            "How do I use Asana instead?",
            "What about personal life advice?"
        ]
        
        for query in invalid_queries:
            result = help_rag_agent._is_ppm_domain_query(query)
            assert result is False, f"Query should be invalid: {query}"

    def test_is_ppm_domain_query_edge_cases(self, help_rag_agent):
        """Test PPM domain validation for edge cases"""
        edge_cases = [
            ("How to navigate the menu?", True),  # Platform query
            ("What is project management?", True),  # PPM keyword
            ("Help me with the dashboard", True),  # Platform help
            ("Where is the button?", True),  # UI help
            ("Tell me about alternative tools", False),  # External tools
            ("What other software can I use?", False),  # Competitor inquiry
        ]
        
        for query, expected in edge_cases:
            result = help_rag_agent._is_ppm_domain_query(query)
            assert result == expected, f"Query '{query}' should return {expected}"

    async def test_generate_scope_redirect_response(self, help_rag_agent):
        """Test scope redirect response generation"""
        query = "What's the weather today?"
        
        # Test English redirect
        result = await help_rag_agent._generate_scope_redirect_response(query, 'en')
        
        assert isinstance(result, HelpResponse)
        assert "PPM platform" in result.response
        assert result.confidence == 1.0
        assert len(result.suggested_actions) > 0
        assert result.suggested_actions[0]['id'] == 'explore_features'
        
        # Test German redirect
        result_de = await help_rag_agent._generate_scope_redirect_response(query, 'de')
        
        assert isinstance(result_de, HelpResponse)
        assert "PPM-Plattform" in result_de.response
        assert result_de.confidence == 1.0
        
        # Test French redirect
        result_fr = await help_rag_agent._generate_scope_redirect_response(query, 'fr')
        
        assert isinstance(result_fr, HelpResponse)
        assert "plateforme PPM" in result_fr.response
        assert result_fr.confidence == 1.0

    # Test proactive tip generation
    async def test_generate_proactive_tips_beginner_user(self, help_rag_agent, sample_page_context):
        """Test proactive tip generation for beginner users"""
        beginner_behavior = UserBehavior(
            recent_pages=["/dashboard"],
            time_on_page=60,
            frequent_queries=[],
            user_level="beginner"
        )
        
        with patch.object(help_rag_agent, '_generate_welcome_tips') as mock_welcome:
            mock_welcome.return_value = [
                ProactiveTip(
                    tip_id="welcome_dashboard",
                    tip_type="welcome",
                    title="Welcome to Your PPM Dashboard",
                    content="Your dashboard provides an overview of all your projects.",
                    priority="high",
                    trigger_context=["dashboard", "first_visit"],
                    show_once=True
                )
            ]
            
            with patch.object(help_rag_agent, '_generate_context_tips') as mock_context:
                mock_context.return_value = []
                
                with patch.object(help_rag_agent, '_generate_optimization_tips') as mock_optimization:
                    mock_optimization.return_value = []
                    
                    with patch.object(help_rag_agent, '_generate_feature_discovery_tips') as mock_discovery:
                        mock_discovery.return_value = []
                        
                        tips = await help_rag_agent.generate_proactive_tips(
                            sample_page_context, beginner_behavior
                        )
                        
                        # Assertions
                        assert len(tips) > 0
                        assert tips[0].tip_type == "welcome"
                        assert tips[0].priority == "high"
                        assert tips[0].show_once is True
                        
                        # Verify welcome tips were generated for beginners
                        mock_welcome.assert_called_once_with(sample_page_context)

    async def test_generate_proactive_tips_long_time_on_page(self, help_rag_agent, sample_page_context):
        """Test proactive tip generation for users spending long time on page"""
        long_time_behavior = UserBehavior(
            recent_pages=["/projects/123"],
            time_on_page=400,  # More than 5 minutes
            frequent_queries=["project status"],
            user_level="intermediate"
        )
        
        project_context = PageContext(
            route="/projects/123",
            page_title="Project Details",
            user_role="project_manager"
        )
        
        with patch.object(help_rag_agent, '_generate_welcome_tips') as mock_welcome:
            mock_welcome.return_value = []
            
            with patch.object(help_rag_agent, '_generate_context_tips') as mock_context:
                mock_context.return_value = [
                    ProactiveTip(
                        tip_id="project_efficiency",
                        tip_type="efficiency",
                        title="Project Management Tip",
                        content="Looking for something specific? Try using the search function.",
                        priority="medium",
                        trigger_context=["project_page", "long_time"]
                    )
                ]
                
                with patch.object(help_rag_agent, '_generate_optimization_tips') as mock_optimization:
                    mock_optimization.return_value = []
                    
                    with patch.object(help_rag_agent, '_generate_feature_discovery_tips') as mock_discovery:
                        mock_discovery.return_value = []
                        
                        tips = await help_rag_agent.generate_proactive_tips(
                            project_context, long_time_behavior
                        )
                        
                        # Assertions
                        assert len(tips) > 0
                        assert tips[0].tip_type == "efficiency"
                        assert tips[0].priority == "medium"
                        assert "search function" in tips[0].content

    async def test_generate_proactive_tips_financial_context(self, help_rag_agent):
        """Test proactive tip generation for financial context"""
        financial_context = PageContext(
            route="/financials",
            page_title="Financial Reports",
            user_role="financial_manager"
        )
        
        behavior = UserBehavior(
            recent_pages=["/financials"],
            time_on_page=120,
            frequent_queries=["budget tracking"],
            user_level="intermediate"
        )
        
        with patch.object(help_rag_agent, '_generate_welcome_tips') as mock_welcome:
            mock_welcome.return_value = []
            
            with patch.object(help_rag_agent, '_generate_context_tips') as mock_context:
                mock_context.return_value = []
                
                with patch.object(help_rag_agent, '_generate_optimization_tips') as mock_optimization:
                    mock_optimization.return_value = [
                        ProactiveTip(
                            tip_id="budget_optimization",
                            tip_type="optimization",
                            title="Budget Optimization",
                            content="Consider running a What-If scenario to explore different budget allocations.",
                            priority="medium",
                            trigger_context=["financials", "budget_review"]
                        )
                    ]
                    
                    with patch.object(help_rag_agent, '_generate_feature_discovery_tips') as mock_discovery:
                        mock_discovery.return_value = []
                        
                        tips = await help_rag_agent.generate_proactive_tips(
                            financial_context, behavior
                        )
                        
                        # Assertions
                        assert len(tips) > 0
                        assert tips[0].tip_type == "optimization"
                        assert "What-If scenario" in tips[0].content

    # Test translation functionality
    async def test_translate_response_german(self, help_rag_agent, mock_openai_client):
        """Test response translation to German"""
        # Mock German translation response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Dies ist eine hilfreiche PPM-Antwort über Projektmanagement."
        mock_openai_client.chat.completions.create.return_value = mock_response
        
        content = "This is a helpful PPM response about project management."
        
        result = await help_rag_agent.translate_response(content, 'de')
        
        # Assertions
        assert isinstance(result, TranslatedContent)
        assert result.target_language == 'de'
        assert result.confidence > 0
        assert result.translation_time_ms >= 0
        assert "PPM" in result.content
        
        # Verify OpenAI was called with correct parameters
        mock_openai_client.chat.completions.create.assert_called_once()
        call_args = mock_openai_client.chat.completions.create.call_args
        assert call_args[1]['model'] == help_rag_agent.translation_model
        assert "German" in call_args[1]['messages'][1]['content']

    async def test_translate_response_french(self, help_rag_agent, mock_openai_client):
        """Test response translation to French"""
        # Mock French translation response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Ceci est une réponse PPM utile sur la gestion de projet."
        mock_openai_client.chat.completions.create.return_value = mock_response
        
        content = "This is a helpful PPM response about project management."
        
        result = await help_rag_agent.translate_response(content, 'fr')
        
        # Assertions
        assert isinstance(result, TranslatedContent)
        assert result.target_language == 'fr'
        assert result.confidence > 0
        assert "PPM" in result.content

    async def test_translate_response_error_handling(self, help_rag_agent, mock_openai_client):
        """Test translation error handling"""
        # Mock OpenAI error
        mock_openai_client.chat.completions.create.side_effect = Exception("Translation API error")
        
        content = "This is a test content."
        
        result = await help_rag_agent.translate_response(content, 'de')
        
        # Assertions - should return original content as fallback
        assert isinstance(result, TranslatedContent)
        assert result.content == content  # Original content returned
        assert result.target_language == 'de'
        assert result.confidence == 0.0  # Zero confidence due to error
        assert result.translation_time_ms == 0

    # Test contextual data retrieval
    async def test_get_contextual_ppm_data_dashboard(self, help_rag_agent, mock_supabase):
        """Test contextual data retrieval for dashboard"""
        dashboard_context = PageContext(
            route="/dashboard",
            page_title="Dashboard",
            user_role="project_manager"
        )
        
        # Mock database responses
        mock_supabase.table.return_value.select.return_value.limit.return_value.execute.return_value.data = [
            {"name": "Project A", "status": "active", "priority": "high"},
            {"name": "Project B", "status": "planning", "priority": "medium"}
        ]
        
        with patch.object(help_rag_agent, '_get_dashboard_context') as mock_dashboard:
            mock_dashboard.return_value = {
                "recent_projects": [{"name": "Project A", "status": "active"}],
                "portfolio_count": 3
            }
            
            result = await help_rag_agent._get_contextual_ppm_data(dashboard_context, "test-user")
            
            # Assertions
            assert "recent_projects" in result
            assert "portfolio_count" in result
            assert result["user_role"] == "project_manager"
            assert result["page_context"]["route"] == "/dashboard"
            
            mock_dashboard.assert_called_once_with("test-user")

    async def test_get_contextual_ppm_data_project(self, help_rag_agent, mock_supabase):
        """Test contextual data retrieval for project page"""
        project_context = PageContext(
            route="/projects/123",
            page_title="Project Details",
            user_role="project_manager",
            current_project="project-123"
        )
        
        with patch.object(help_rag_agent, '_get_project_context') as mock_project:
            mock_project.return_value = {
                "project_name": "Test Project",
                "project_status": "active",
                "project_budget": 50000
            }
            
            result = await help_rag_agent._get_contextual_ppm_data(project_context, "test-user")
            
            # Assertions
            assert "project_name" in result
            assert "project_status" in result
            assert "project_budget" in result
            assert result["user_role"] == "project_manager"
            
            mock_project.assert_called_once_with("project-123")

    # Test error handling
    async def test_process_help_query_error_handling(self, help_rag_agent, sample_page_context):
        """Test error handling in query processing"""
        # Mock search to raise an exception
        with patch.object(help_rag_agent, '_search_help_content') as mock_search:
            mock_search.side_effect = Exception("Search service unavailable")
            
            with patch.object(help_rag_agent, 'log_operation') as mock_log:
                mock_log.return_value = "error-operation-id"
                
                query = "How do I create a project?"
                user_id = "test-user"
                
                # Should raise the exception
                with pytest.raises(Exception) as exc_info:
                    await help_rag_agent.process_help_query(query, sample_page_context, user_id)
                
                assert "Search service unavailable" in str(exc_info.value)
                
                # Verify error was logged
                mock_log.assert_called_once()
                log_call_args = mock_log.call_args[1]
                assert log_call_args['success'] is False
                assert "Search service unavailable" in log_call_args['error_message']

    async def test_generate_proactive_tips_error_handling(self, help_rag_agent, sample_page_context, sample_user_behavior):
        """Test error handling in proactive tip generation"""
        # Mock welcome tips to raise an exception
        with patch.object(help_rag_agent, '_generate_welcome_tips') as mock_welcome:
            mock_welcome.side_effect = Exception("Tip generation failed")
            
            # Should not raise exception, but return empty list
            tips = await help_rag_agent.generate_proactive_tips(sample_page_context, sample_user_behavior)
            
            # Assertions
            assert isinstance(tips, list)
            assert len(tips) == 0  # Empty due to error

    # Test confidence calculation
    def test_calculate_help_confidence_high_similarity(self, help_rag_agent, sample_page_context):
        """Test confidence calculation with high similarity content"""
        similar_content = [
            {'similarity_score': 0.9},
            {'similarity_score': 0.85},
            {'similarity_score': 0.8}
        ]
        
        response = "This is a detailed response about project management features in the dashboard."
        
        confidence = help_rag_agent._calculate_help_confidence(similar_content, response, sample_page_context)
        
        # Should have reasonable confidence due to high similarity scores
        assert confidence > 0.5
        assert confidence <= 1.0

    def test_calculate_help_confidence_low_similarity(self, help_rag_agent, sample_page_context):
        """Test confidence calculation with low similarity content"""
        similar_content = [
            {'similarity_score': 0.3},
            {'similarity_score': 0.2}
        ]
        
        response = "Brief response."
        
        confidence = help_rag_agent._calculate_help_confidence(similar_content, response, sample_page_context)
        
        # Should have lower confidence due to low similarity scores
        assert confidence < 0.7
        assert confidence >= 0.0

    def test_calculate_help_confidence_no_content(self, help_rag_agent, sample_page_context):
        """Test confidence calculation with no similar content"""
        similar_content = []
        response = "Generic response without specific content."
        
        confidence = help_rag_agent._calculate_help_confidence(similar_content, response, sample_page_context)
        
        # Should have low confidence without similar content
        assert confidence < 0.5
        assert confidence >= 0.0


class TestHelpRAGAgentIntegration:
    """Integration tests for HelpRAGAgent with real-like scenarios"""
    
    @pytest.fixture
    def mock_supabase_integration(self):
        """Mock Supabase client for integration tests"""
        mock_client = Mock()
        mock_client.table.return_value.select.return_value.execute.return_value.data = []
        mock_client.table.return_value.insert.return_value.execute.return_value = Mock()
        mock_client.table.return_value.upsert.return_value.execute.return_value = Mock()
        mock_client.rpc.return_value.execute.return_value.data = []
        return mock_client
    
    @pytest.fixture
    def mock_openai_client_integration(self):
        """Mock OpenAI client for integration tests"""
        mock_client = Mock()
        
        # Mock chat completion response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "This is a helpful PPM response about project management."
        mock_response.usage.prompt_tokens = 100
        mock_response.usage.completion_tokens = 50
        mock_client.chat.completions.create.return_value = mock_response
        
        # Mock embedding response
        mock_embedding_response = Mock()
        mock_embedding_response.data = [Mock()]
        mock_embedding_response.data[0].embedding = [0.1] * 1536  # Standard embedding size
        mock_client.embeddings.create.return_value = mock_embedding_response
        
        return mock_client
    
    @pytest.fixture
    def integration_agent(self, mock_supabase_integration, mock_openai_client_integration):
        """Create agent for integration testing"""
        with patch('services.help_rag_agent.OpenAI', return_value=mock_openai_client_integration):
            agent = HelpRAGAgent(mock_supabase_integration, "test-api-key")
            agent.openai_client = mock_openai_client_integration
            return agent
    
    async def test_full_query_processing_workflow(self, integration_agent, mock_supabase_integration):
        """Test complete query processing workflow"""
        context = PageContext(
            route="/projects",
            page_title="Projects",
            user_role="project_manager"
        )
        
        # Mock all dependencies
        with patch.object(integration_agent, '_search_help_content') as mock_search:
            mock_search.return_value = [
                {
                    'content_type': 'guide',
                    'content_id': 'project-guide',
                    'content_text': 'Complete guide to project management',
                    'similarity_score': 0.9,
                    'metadata': {'title': 'Project Guide'}
                }
            ]
            
            with patch.object(integration_agent, '_get_contextual_ppm_data') as mock_context:
                mock_context.return_value = {'project_count': 5}
                
                with patch.object(integration_agent, 'log_operation') as mock_log:
                    mock_log.return_value = "operation-123"
                    
                    with patch.object(integration_agent, '_store_help_session') as mock_store:
                        mock_store.return_value = None
                        
                        query = "How do I create a new project with proper resource allocation?"
                        user_id = "integration-user"
                        
                        result = await integration_agent.process_help_query(query, context, user_id)
                        
                        # Comprehensive assertions
                        assert isinstance(result, HelpResponse)
                        assert result.response is not None
                        assert len(result.response) > 0
                        assert len(result.sources) > 0
                        assert result.sources[0]['type'] == 'guide'
                        assert result.confidence > 0
                        assert result.session_id.startswith("help_")
                        assert result.response_time_ms >= 0  # Allow 0 for mocked tests
                        assert len(result.suggested_actions) > 0
                        
                        # Verify all workflow steps were executed
                        mock_search.assert_called_once()
                        mock_context.assert_called_once()
                        mock_log.assert_called_once()
                        mock_store.assert_called_once()

    async def test_multilingual_workflow(self, integration_agent):
        """Test multilingual query processing workflow"""
        context = PageContext(
            route="/dashboard",
            page_title="Dashboard",
            user_role="user"
        )
        
        with patch.object(integration_agent, '_search_help_content') as mock_search:
            mock_search.return_value = [
                {
                    'content_type': 'faq',
                    'content_id': 'dashboard-faq',
                    'content_text': 'Dashboard frequently asked questions',
                    'similarity_score': 0.8,
                    'metadata': {'title': 'Dashboard FAQ'}
                }
            ]
            
            with patch.object(integration_agent, '_get_contextual_ppm_data') as mock_context:
                mock_context.return_value = {}
                
                # Mock translation service
                with patch('services.translation_service.TranslationService') as mock_translation_service:
                    mock_service = Mock()
                    mock_translation_service.return_value = mock_service
                    
                    mock_translation_response = Mock()
                    mock_translation_response.translated_content = "Réponse traduite en français"
                    mock_service.translate_content.return_value = mock_translation_response
                    
                    with patch.object(integration_agent, 'log_operation') as mock_log:
                        mock_log.return_value = "translation-operation"
                        
                        with patch.object(integration_agent, '_store_help_session') as mock_store:
                            mock_store.return_value = None
                            
                            query = "How do I use the project dashboard?"
                            user_id = "french-user"
                            
                            result = await integration_agent.process_help_query(
                                query, context, user_id, language='fr'
                            )
                            
                            # Assertions
                            assert isinstance(result, HelpResponse)
                            assert "PPM" in result.response or "project" in result.response.lower()
                            assert result.confidence > 0
                            
                            # Verify the query was processed (not redirected)
                            assert not result.session_id.startswith("redirect_")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])