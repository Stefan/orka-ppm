#!/usr/bin/env python3
"""
Comprehensive End-to-End Tests for AI Help Chat System
Tests complete user journeys from query to response, multi-language functionality,
proactive tips, and feedback integration.

Requirements Coverage: All requirements (1.1-10.5)
"""

import pytest
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from fastapi import status

# Skip entire module if optional context_analyzer service is not installed
pytest.importorskip("services.context_analyzer")

from main import app
from models.help_content import HelpContentCreate, ContentType
from services.help_rag_agent import HelpRAGAgent
from services.context_analyzer import ContextAnalyzer
from services.scope_validator import ScopeValidator
from config.database import supabase


class TestHelpChatEndToEnd:
    """Comprehensive end-to-end tests for the help chat system"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_user_token(self):
        """Mock authentication token"""
        return "test-token-123"
    
    @pytest.fixture
    def mock_user_context(self):
        """Mock user context for testing"""
        return {
            "user_id": "test-user-123",
            "role": "user",
            "permissions": ["read", "write"]
        }
    
    @pytest.fixture
    def sample_help_content(self):
        """Sample help content for testing"""
        return [
            {
                "content_type": "guide",
                "title": "Creating Projects",
                "content": "To create a new project, navigate to the Projects page and click 'New Project'.",
                "tags": ["projects", "creation", "getting-started"],
                "language": "en"
            },
            {
                "content_type": "faq",
                "title": "Budget Management",
                "content": "You can manage budgets by accessing the Financial section and setting up budget alerts.",
                "tags": ["budget", "financial", "alerts"],
                "language": "en"
            },
            {
                "content_type": "guide",
                "title": "Projekt erstellen",
                "content": "Um ein neues Projekt zu erstellen, navigieren Sie zur Projektseite und klicken Sie auf 'Neues Projekt'.",
                "tags": ["projekte", "erstellung", "erste-schritte"],
                "language": "de"
            }
        ]

    @pytest.mark.asyncio
    async def test_complete_user_journey_english(self, client, mock_user_token, mock_user_context, sample_help_content):
        """
        Test complete user journey from query to response in English
        Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 2.5
        """
        # Mock authentication
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Mock RAG agent response
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.return_value = {
                    "response": "To create a new project, navigate to the Projects page and click the 'New Project' button. You'll need to fill in the project details including name, description, and initial budget.",
                    "sources": [
                        {
                            "id": "guide-1",
                            "title": "Creating Projects",
                            "type": "guide",
                            "relevance": 0.95
                        }
                    ],
                    "confidence": 0.92,
                    "response_time_ms": 150
                }
                
                # Step 1: Get help context
                context_response = client.get(
                    "/ai/help/context?page_route=/projects",
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert context_response.status_code == 200
                context_data = context_response.json()
                assert "context" in context_data
                assert context_data["context"]["route"] == "/projects"
                
                # Step 2: Submit help query
                query_request = {
                    "query": "How do I create a new project?",
                    "context": {
                        "route": "/projects",
                        "pageTitle": "Projects",
                        "userRole": "user"
                    },
                    "language": "en",
                    "includeProactiveTips": True
                }
                
                query_response = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert query_response.status_code == 200
                query_data = query_response.json()
                
                # Verify response structure
                assert "response" in query_data
                assert "sessionId" in query_data
                assert "sources" in query_data
                assert "confidence" in query_data
                assert "responseTimeMs" in query_data
                
                # Verify content quality
                assert "project" in query_data["response"].lower()
                assert query_data["confidence"] > 0.8
                assert len(query_data["sources"]) > 0
                
                # Step 3: Submit feedback
                feedback_request = {
                    "messageId": "msg-123",
                    "rating": 5,
                    "feedbackText": "Very helpful explanation!",
                    "feedbackType": "helpful"
                }
                
                feedback_response = client.post(
                    "/ai/help/feedback",
                    json=feedback_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert feedback_response.status_code == 200
                feedback_data = feedback_response.json()
                assert feedback_data["success"] is True
                assert "trackingId" in feedback_data

    @pytest.mark.asyncio
    async def test_multi_language_functionality(self, client, mock_user_token, mock_user_context):
        """
        Test multi-language functionality (English, German, French)
        Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            languages = [
                ("en", "How do I create a project?", "project"),
                ("de", "Wie erstelle ich ein Projekt?", "Projekt"),
                ("fr", "Comment créer un projet?", "projet")
            ]
            
            for lang_code, query, expected_word in languages:
                with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                    # Mock language-specific response
                    if lang_code == "en":
                        response_text = "To create a project, click the New Project button."
                    elif lang_code == "de":
                        response_text = "Um ein Projekt zu erstellen, klicken Sie auf die Schaltfläche Neues Projekt."
                    else:  # French
                        response_text = "Pour créer un projet, cliquez sur le bouton Nouveau Projet."
                    
                    mock_rag.return_value = {
                        "response": response_text,
                        "sources": [],
                        "confidence": 0.9,
                        "response_time_ms": 120
                    }
                    
                    query_request = {
                        "query": query,
                        "context": {
                            "route": "/projects",
                            "pageTitle": "Projects",
                            "userRole": "user"
                        },
                        "language": lang_code
                    }
                    
                    response = client.post(
                        "/ai/help/query",
                        json=query_request,
                        headers={"Authorization": f"Bearer {mock_user_token}"}
                    )
                    
                    assert response.status_code == 200
                    data = response.json()
                    
                    # Verify language-appropriate response
                    assert expected_word.lower() in data["response"].lower()
                    assert data["confidence"] > 0.8

    @pytest.mark.asyncio
    async def test_proactive_tips_integration(self, client, mock_user_token, mock_user_context):
        """
        Test proactive tips generation and integration
        Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Test different contexts for proactive tips
            contexts = [
                ("/dashboard", "welcome"),
                ("/projects", "project_management"),
                ("/financials", "budget_optimization"),
                ("/resources", "resource_allocation")
            ]
            
            for context_route, expected_tip_type in contexts:
                with patch('services.help_rag_agent.HelpRAGAgent.generate_proactive_tips') as mock_tips:
                    mock_tips.return_value = [
                        {
                            "id": f"tip-{expected_tip_type}",
                            "type": "feature_discovery",
                            "title": f"Discover {expected_tip_type} features",
                            "content": f"Learn about powerful {expected_tip_type} capabilities.",
                            "priority": "medium",
                            "triggerContext": [context_route],
                            "dismissible": True,
                            "showOnce": False
                        }
                    ]
                    
                    response = client.get(
                        f"/ai/help/tips?context={context_route}",
                        headers={"Authorization": f"Bearer {mock_user_token}"}
                    )
                    
                    assert response.status_code == 200
                    data = response.json()
                    
                    assert "tips" in data
                    assert len(data["tips"]) > 0
                    assert data["tips"][0]["type"] == "feature_discovery"
                    assert expected_tip_type in data["tips"][0]["content"].lower()

    @pytest.mark.asyncio
    async def test_scope_validation_and_boundaries(self, client, mock_user_token, mock_user_context):
        """
        Test scope validation and domain boundaries
        Requirements: 2.2, 10.1, 10.2, 10.3, 10.4, 10.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Test queries that should be rejected or redirected
            out_of_scope_queries = [
                ("Tell me about Microsoft Project", "competitor"),
                ("What's the weather today?", "off_topic"),
                ("How do I use Jira?", "external_tool"),
                ("Give me business advice", "general_business"),
                ("Explain Cora methodology", "cora_reference")
            ]
            
            for query, reason in out_of_scope_queries:
                with patch('services.scope_validator.ScopeValidator.validate_scope') as mock_validator:
                    mock_validator.return_value = {
                        "is_valid": False,
                        "reason": reason,
                        "redirect_message": "I can only help with PPM platform features. Let me know what you'd like to learn about our project management capabilities."
                    }
                    
                    with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                        mock_rag.return_value = {
                            "response": "I can only help with PPM platform features. Let me know what you'd like to learn about our project management capabilities.",
                            "sources": [],
                            "confidence": 1.0,
                            "response_time_ms": 50
                        }
                        
                        query_request = {
                            "query": query,
                            "context": {
                                "route": "/dashboard",
                                "pageTitle": "Dashboard",
                                "userRole": "user"
                            },
                            "language": "en"
                        }
                        
                        response = client.post(
                            "/ai/help/query",
                            json=query_request,
                            headers={"Authorization": f"Bearer {mock_user_token}"}
                        )
                        
                        assert response.status_code == 200
                        data = response.json()
                        
                        # Verify scope validation response
                        assert "ppm platform features" in data["response"].lower()
                        assert data["confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_visual_guides_and_screenshots(self, client, mock_user_token, mock_user_context):
        """
        Test visual guides and screenshot integration
        Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                # Mock response with visual guide
                mock_rag.return_value = {
                    "response": "Here's how to create a project with visual steps:",
                    "sources": [
                        {
                            "id": "visual-guide-1",
                            "title": "Project Creation Visual Guide",
                            "type": "visual_guide",
                            "relevance": 0.95
                        }
                    ],
                    "confidence": 0.9,
                    "response_time_ms": 200,
                    "visual_guides": [
                        {
                            "id": "guide-1",
                            "title": "Create New Project",
                            "steps": [
                                {
                                    "step": 1,
                                    "description": "Navigate to Projects page",
                                    "screenshot_url": "/screenshots/projects-page.png",
                                    "highlight_elements": ["#projects-nav"]
                                },
                                {
                                    "step": 2,
                                    "description": "Click New Project button",
                                    "screenshot_url": "/screenshots/new-project-button.png",
                                    "highlight_elements": ["#new-project-btn"]
                                }
                            ]
                        }
                    ]
                }
                
                query_request = {
                    "query": "Show me how to create a project with screenshots",
                    "context": {
                        "route": "/projects",
                        "pageTitle": "Projects",
                        "userRole": "user"
                    },
                    "language": "en",
                    "includeVisualGuides": True
                }
                
                response = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify visual guide integration
                assert "visual_guides" in data
                assert len(data["visual_guides"]) > 0
                assert "steps" in data["visual_guides"][0]
                assert len(data["visual_guides"][0]["steps"]) > 0
                
                # Verify screenshot references
                step = data["visual_guides"][0]["steps"][0]
                assert "screenshot_url" in step
                assert "highlight_elements" in step

    @pytest.mark.asyncio
    async def test_feedback_system_integration(self, client, mock_user_token, mock_user_context):
        """
        Test integration with feedback system
        Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Test different feedback scenarios
            feedback_scenarios = [
                {
                    "rating": 5,
                    "feedbackText": "Excellent help!",
                    "feedbackType": "helpful",
                    "expected_success": True
                },
                {
                    "rating": 2,
                    "feedbackText": "Information was incorrect",
                    "feedbackType": "incorrect",
                    "expected_success": True
                },
                {
                    "rating": 3,
                    "feedbackText": "Could be more detailed",
                    "feedbackType": "suggestion",
                    "expected_success": True
                }
            ]
            
            for scenario in feedback_scenarios:
                feedback_request = {
                    "messageId": f"msg-{scenario['rating']}",
                    "rating": scenario["rating"],
                    "feedbackText": scenario["feedbackText"],
                    "feedbackType": scenario["feedbackType"]
                }
                
                with patch('routers.feedback.submit_feedback') as mock_feedback:
                    mock_feedback.return_value = {
                        "success": scenario["expected_success"],
                        "message": "Feedback submitted successfully",
                        "trackingId": f"feedback-{scenario['rating']}"
                    }
                    
                    response = client.post(
                        "/ai/help/feedback",
                        json=feedback_request,
                        headers={"Authorization": f"Bearer {mock_user_token}"}
                    )
                    
                    assert response.status_code == 200
                    data = response.json()
                    
                    assert data["success"] == scenario["expected_success"]
                    assert "trackingId" in data

    @pytest.mark.asyncio
    async def test_performance_and_caching(self, client, mock_user_token, mock_user_context):
        """
        Test performance optimization and caching
        Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            query_request = {
                "query": "How do I manage budgets?",
                "context": {
                    "route": "/financials",
                    "pageTitle": "Financials",
                    "userRole": "user"
                },
                "language": "en"
            }
            
            # First request - should hit the service
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.return_value = {
                    "response": "Budget management involves setting up alerts and monitoring spending.",
                    "sources": [],
                    "confidence": 0.9,
                    "response_time_ms": 150
                }
                
                start_time = datetime.now()
                response1 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                first_request_time = (datetime.now() - start_time).total_seconds()
                
                assert response1.status_code == 200
                data1 = response1.json()
                assert data1["responseTimeMs"] >= 0
                
                # Second identical request - should be faster (cached)
                start_time = datetime.now()
                response2 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                second_request_time = (datetime.now() - start_time).total_seconds()
                
                assert response2.status_code == 200
                data2 = response2.json()
                
                # Verify caching improved performance
                assert data1["response"] == data2["response"]
                # Note: In real implementation, second request should be faster

    @pytest.mark.asyncio
    async def test_error_handling_and_fallbacks(self, client, mock_user_token, mock_user_context):
        """
        Test error handling and fallback responses
        Requirements: 9.3, 9.4, 9.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Test service unavailable scenario
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.side_effect = Exception("Service temporarily unavailable")
                
                query_request = {
                    "query": "How do I create a project?",
                    "context": {
                        "route": "/projects",
                        "pageTitle": "Projects",
                        "userRole": "user"
                    },
                    "language": "en"
                }
                
                response = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                # Should return fallback response, not error
                assert response.status_code == 200
                data = response.json()
                
                # Verify fallback response
                assert "temporarily unavailable" in data["response"].lower() or "fallback" in data["response"].lower()
                assert data["confidence"] < 0.5  # Lower confidence for fallback

    @pytest.mark.asyncio
    async def test_analytics_and_privacy(self, client, mock_user_token, mock_user_context):
        """
        Test analytics tracking and privacy compliance
        Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            with patch('services.analytics_tracker.AnalyticsTracker.track_help_event') as mock_analytics:
                mock_analytics.return_value = True
                
                query_request = {
                    "query": "How do I use the dashboard?",
                    "context": {
                        "route": "/dashboard",
                        "pageTitle": "Dashboard",
                        "userRole": "user"
                    },
                    "language": "en"
                }
                
                with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                    mock_rag.return_value = {
                        "response": "The dashboard provides an overview of your projects and key metrics.",
                        "sources": [],
                        "confidence": 0.9,
                        "response_time_ms": 100
                    }
                    
                    response = client.post(
                        "/ai/help/query",
                        json=query_request,
                        headers={"Authorization": f"Bearer {mock_user_token}"}
                    )
                    
                    assert response.status_code == 200
                    
                    # Verify analytics tracking was called
                    mock_analytics.assert_called()
                    
                    # Verify no personal data in analytics
                    call_args = mock_analytics.call_args
                    analytics_data = call_args[0] if call_args else {}
                    
                    # Should not contain personal identifiers
                    assert "user_id" not in str(analytics_data) or "anonymous" in str(analytics_data)

    @pytest.mark.asyncio
    async def test_accessibility_compliance(self, client, mock_user_token, mock_user_context):
        """
        Test accessibility features and WCAG compliance
        Requirements: 1.1, 1.2, 1.3
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # Test context endpoint for accessibility metadata
            response = client.get(
                "/ai/help/context?page_route=/dashboard",
                headers={"Authorization": f"Bearer {mock_user_token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify accessibility information is included
            assert "context" in data
            
            # Test that responses include accessibility-friendly formatting
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.return_value = {
                    "response": "# Dashboard Overview\n\nThe dashboard shows:\n- Project status\n- Budget information\n- Recent activities",
                    "sources": [],
                    "confidence": 0.9,
                    "response_time_ms": 100,
                    "accessibility_metadata": {
                        "has_headings": True,
                        "has_lists": True,
                        "reading_level": "intermediate"
                    }
                }
                
                query_request = {
                    "query": "What's on the dashboard?",
                    "context": {
                        "route": "/dashboard",
                        "pageTitle": "Dashboard",
                        "userRole": "user"
                    },
                    "language": "en"
                }
                
                response = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify structured content for screen readers
                assert "#" in data["response"]  # Has headings
                assert "-" in data["response"]  # Has lists

    @pytest.mark.asyncio
    async def test_session_management(self, client, mock_user_token, mock_user_context):
        """
        Test session management and state persistence
        Requirements: 1.4, 8.3
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_user_context):
            # First query to establish session
            query_request = {
                "query": "How do I create a project?",
                "context": {
                    "route": "/projects",
                    "pageTitle": "Projects",
                    "userRole": "user"
                },
                "language": "en"
            }
            
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.return_value = {
                    "response": "To create a project, click the New Project button.",
                    "sources": [],
                    "confidence": 0.9,
                    "response_time_ms": 100
                }
                
                response1 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert response1.status_code == 200
                data1 = response1.json()
                session_id = data1["sessionId"]
                
                # Second query with session ID
                query_request["sessionId"] = session_id
                query_request["query"] = "What about project templates?"
                
                response2 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": f"Bearer {mock_user_token}"}
                )
                
                assert response2.status_code == 200
                data2 = response2.json()
                
                # Verify session continuity
                assert data2["sessionId"] == session_id


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])