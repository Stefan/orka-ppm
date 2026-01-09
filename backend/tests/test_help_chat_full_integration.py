#!/usr/bin/env python3
"""
Full System Integration Tests for AI Help Chat
Tests the complete integration between frontend, backend, database, and AI services.
This test suite validates the entire help chat system working together.

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
import httpx

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from fastapi import status

# Import application components
from main import app
from config.database import supabase
from services.help_rag_agent import HelpRAGAgent
from services.context_analyzer import ContextAnalyzer
from services.scope_validator import ScopeValidator
from services.analytics_tracker import AnalyticsTracker


class TestFullSystemIntegration:
    """Full system integration tests"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_auth_user(self):
        """Mock authenticated user"""
        return {
            "id": "test-user-123",
            "email": "test@example.com",
            "role": "user",
            "permissions": ["read", "write"]
        }
    
    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI API response"""
        return {
            "choices": [
                {
                    "message": {
                        "content": "To create a new project in the PPM system, follow these steps:\n\n1. Navigate to the Projects section using the sidebar menu\n2. Click the 'New Project' button in the top right corner\n3. Fill in the required project details:\n   - Project Name\n   - Description\n   - Initial Budget\n   - Start Date\n4. Click 'Create Project' to save\n\nThe system will automatically set up the project structure and notify relevant team members."
                    }
                }
            ],
            "usage": {
                "prompt_tokens": 150,
                "completion_tokens": 120,
                "total_tokens": 270
            }
        }

    @pytest.mark.asyncio
    async def test_complete_system_workflow(self, client, mock_auth_user, mock_openai_response):
        """
        Test complete system workflow from frontend request to database storage
        Requirements: All requirements integration
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            with patch('openai.ChatCompletion.acreate', return_value=mock_openai_response):
                with patch('config.database.supabase') as mock_supabase:
                    # Mock database operations
                    mock_supabase.table.return_value.insert.return_value.execute.return_value = {
                        "data": [{"id": "session-123"}]
                    }
                    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = {
                        "data": [
                            {
                                "id": "content-1",
                                "title": "Project Creation Guide",
                                "content": "Guide for creating projects",
                                "content_type": "guide",
                                "tags": ["projects", "creation"]
                            }
                        ]
                    }
                    
                    # Step 1: Get help context
                    context_response = client.get(
                        "/ai/help/context?page_route=/projects",
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    assert context_response.status_code == 200
                    context_data = context_response.json()
                    
                    # Step 2: Submit help query
                    query_request = {
                        "query": "How do I create a new project?",
                        "context": {
                            "route": "/projects",
                            "pageTitle": "Projects",
                            "userRole": "user",
                            "currentProject": None,
                            "relevantData": {
                                "hasExistingProjects": False,
                                "userPermissions": ["create_project"]
                            }
                        },
                        "language": "en",
                        "includeProactiveTips": True,
                        "includeVisualGuides": True
                    }
                    
                    query_response = client.post(
                        "/ai/help/query",
                        json=query_request,
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    assert query_response.status_code == 200
                    query_data = query_response.json()
                    
                    # Verify response structure and content
                    assert "response" in query_data
                    assert "sessionId" in query_data
                    assert "sources" in query_data
                    assert "confidence" in query_data
                    assert "responseTimeMs" in query_data
                    
                    # Verify content quality
                    response_text = query_data["response"]
                    assert "project" in response_text.lower()
                    assert "create" in response_text.lower()
                    assert len(response_text) > 50  # Substantial response
                    
                    # Verify confidence score
                    assert query_data["confidence"] > 0.7
                    
                    # Verify session creation
                    session_id = query_data["sessionId"]
                    assert session_id is not None
                    
                    # Step 3: Test proactive tips
                    tips_response = client.get(
                        "/ai/help/tips?context=/projects",
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    assert tips_response.status_code == 200
                    tips_data = tips_response.json()
                    assert "tips" in tips_data
                    
                    # Step 4: Submit feedback
                    feedback_request = {
                        "messageId": "msg-123",
                        "rating": 5,
                        "feedbackText": "Very helpful and detailed explanation!",
                        "feedbackType": "helpful"
                    }
                    
                    feedback_response = client.post(
                        "/ai/help/feedback",
                        json=feedback_request,
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    assert feedback_response.status_code == 200
                    feedback_data = feedback_response.json()
                    assert feedback_data["success"] is True
                    
                    # Verify database interactions
                    assert mock_supabase.table.called
                    # Should have called for session creation, message storage, and feedback

    @pytest.mark.asyncio
    async def test_multi_language_system_integration(self, client, mock_auth_user):
        """
        Test multi-language functionality across the entire system
        Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
        """
        languages = [
            {
                "code": "en",
                "query": "How do I manage project budgets?",
                "expected_keywords": ["budget", "manage", "project"],
                "mock_response": "To manage project budgets, navigate to the Financial section and set up budget tracking for each project."
            },
            {
                "code": "de", 
                "query": "Wie verwalte ich Projektbudgets?",
                "expected_keywords": ["Budget", "verwalten", "Projekt"],
                "mock_response": "Um Projektbudgets zu verwalten, navigieren Sie zum Finanzbereich und richten Sie die Budgetverfolgung für jedes Projekt ein."
            },
            {
                "code": "fr",
                "query": "Comment gérer les budgets de projet?",
                "expected_keywords": ["budget", "gérer", "projet"],
                "mock_response": "Pour gérer les budgets de projet, naviguez vers la section Financière et configurez le suivi budgétaire pour chaque projet."
            }
        ]
        
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            for lang_data in languages:
                with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                    with patch('services.help_rag_agent.HelpRAGAgent.translate_response') as mock_translate:
                        # Mock RAG response
                        mock_rag.return_value = {
                            "response": lang_data["mock_response"],
                            "sources": [
                                {
                                    "id": f"guide-{lang_data['code']}",
                                    "title": "Budget Management Guide",
                                    "type": "guide",
                                    "relevance": 0.9
                                }
                            ],
                            "confidence": 0.92,
                            "response_time_ms": 180
                        }
                        
                        # Mock translation service
                        mock_translate.return_value = {
                            "translated_content": lang_data["mock_response"],
                            "source_language": "en",
                            "target_language": lang_data["code"],
                            "confidence": 0.95
                        }
                        
                        query_request = {
                            "query": lang_data["query"],
                            "context": {
                                "route": "/financials",
                                "pageTitle": "Financials",
                                "userRole": "user"
                            },
                            "language": lang_data["code"]
                        }
                        
                        response = client.post(
                            "/ai/help/query",
                            json=query_request,
                            headers={"Authorization": "Bearer test-token"}
                        )
                        
                        assert response.status_code == 200
                        data = response.json()
                        
                        # Verify language-appropriate response
                        response_text = data["response"].lower()
                        for keyword in lang_data["expected_keywords"]:
                            assert keyword.lower() in response_text
                        
                        # Verify high confidence
                        assert data["confidence"] > 0.8

    @pytest.mark.asyncio
    async def test_scope_validation_system_integration(self, client, mock_auth_user):
        """
        Test scope validation across the entire system
        Requirements: 2.2, 10.1, 10.2, 10.3, 10.4, 10.5
        """
        test_cases = [
            {
                "query": "How do I use Microsoft Project?",
                "expected_rejection": True,
                "rejection_reason": "competitor_tool",
                "expected_response_contains": ["ppm platform", "our features"]
            },
            {
                "query": "What's the weather like today?",
                "expected_rejection": True,
                "rejection_reason": "off_topic",
                "expected_response_contains": ["ppm platform", "project management"]
            },
            {
                "query": "Tell me about Cora methodology",
                "expected_rejection": True,
                "rejection_reason": "cora_reference",
                "expected_response_contains": ["ppm platform", "our methodology"]
            },
            {
                "query": "How do I create a project in our PPM system?",
                "expected_rejection": False,
                "rejection_reason": None,
                "expected_response_contains": ["project", "create", "navigate"]
            }
        ]
        
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            for test_case in test_cases:
                with patch('services.scope_validator.ScopeValidator.validate_scope') as mock_validator:
                    with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                        
                        if test_case["expected_rejection"]:
                            # Mock scope validation rejection
                            mock_validator.return_value = {
                                "is_valid": False,
                                "reason": test_case["rejection_reason"],
                                "redirect_message": "I can only help with PPM platform features. Let me know what you'd like to learn about our project management capabilities."
                            }
                            
                            mock_rag.return_value = {
                                "response": "I can only help with PPM platform features. Let me know what you'd like to learn about our project management capabilities.",
                                "sources": [],
                                "confidence": 1.0,
                                "response_time_ms": 50
                            }
                        else:
                            # Mock scope validation acceptance
                            mock_validator.return_value = {
                                "is_valid": True,
                                "reason": None,
                                "redirect_message": None
                            }
                            
                            mock_rag.return_value = {
                                "response": "To create a project, navigate to the Projects section and click 'New Project'.",
                                "sources": [
                                    {
                                        "id": "guide-1",
                                        "title": "Project Creation",
                                        "type": "guide",
                                        "relevance": 0.95
                                    }
                                ],
                                "confidence": 0.9,
                                "response_time_ms": 150
                            }
                        
                        query_request = {
                            "query": test_case["query"],
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
                            headers={"Authorization": "Bearer test-token"}
                        )
                        
                        assert response.status_code == 200
                        data = response.json()
                        
                        # Verify response content
                        response_text = data["response"].lower()
                        for expected_phrase in test_case["expected_response_contains"]:
                            assert expected_phrase.lower() in response_text
                        
                        # Verify confidence score
                        if test_case["expected_rejection"]:
                            assert data["confidence"] == 1.0  # High confidence in rejection
                        else:
                            assert data["confidence"] > 0.8  # High confidence in valid response

    @pytest.mark.asyncio
    async def test_analytics_and_privacy_integration(self, client, mock_auth_user):
        """
        Test analytics tracking and privacy compliance across the system
        Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            with patch('services.analytics_tracker.AnalyticsTracker.track_help_event') as mock_analytics:
                with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                    with patch('config.database.supabase') as mock_supabase:
                        
                        # Mock successful tracking
                        mock_analytics.return_value = True
                        
                        # Mock RAG response
                        mock_rag.return_value = {
                            "response": "Dashboard shows project status, budget information, and recent activities.",
                            "sources": [],
                            "confidence": 0.9,
                            "response_time_ms": 120
                        }
                        
                        # Mock database operations
                        mock_supabase.table.return_value.insert.return_value.execute.return_value = {
                            "data": [{"id": "analytics-123"}]
                        }
                        
                        query_request = {
                            "query": "What information is shown on the dashboard?",
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
                            headers={"Authorization": "Bearer test-token"}
                        )
                        
                        assert response.status_code == 200
                        
                        # Verify analytics tracking was called
                        assert mock_analytics.called
                        
                        # Verify analytics data privacy
                        call_args = mock_analytics.call_args
                        if call_args:
                            analytics_data = call_args[0][1] if len(call_args[0]) > 1 else {}
                            
                            # Should not contain personal identifiers
                            analytics_str = str(analytics_data)
                            assert mock_auth_user["email"] not in analytics_str
                            assert mock_auth_user["id"] not in analytics_str or "hashed" in analytics_str.lower()
                            
                            # Should contain anonymous usage data
                            assert "query_category" in analytics_str or "event_type" in analytics_str

    @pytest.mark.asyncio
    async def test_performance_optimization_integration(self, client, mock_auth_user):
        """
        Test performance optimization features across the system
        Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                
                # Mock response with timing
                mock_rag.return_value = {
                    "response": "Budget alerts help you monitor spending and stay within project limits.",
                    "sources": [],
                    "confidence": 0.9,
                    "response_time_ms": 150
                }
                
                query_request = {
                    "query": "How do budget alerts work?",
                    "context": {
                        "route": "/financials",
                        "pageTitle": "Financials",
                        "userRole": "user"
                    },
                    "language": "en"
                }
                
                # First request
                start_time = datetime.now()
                response1 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": "Bearer test-token"}
                )
                first_request_time = (datetime.now() - start_time).total_seconds()
                
                assert response1.status_code == 200
                data1 = response1.json()
                
                # Verify response time is tracked
                assert "responseTimeMs" in data1
                assert data1["responseTimeMs"] >= 0
                
                # Second identical request (should potentially use caching)
                start_time = datetime.now()
                response2 = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": "Bearer test-token"}
                )
                second_request_time = (datetime.now() - start_time).total_seconds()
                
                assert response2.status_code == 200
                data2 = response2.json()
                
                # Verify consistent responses
                assert data1["response"] == data2["response"]
                
                # Verify performance monitoring
                assert data2["responseTimeMs"] >= 0

    @pytest.mark.asyncio
    async def test_error_recovery_integration(self, client, mock_auth_user):
        """
        Test error recovery and fallback mechanisms across the system
        Requirements: 9.3, 9.4, 9.5
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            
            # Test scenario 1: AI service failure with fallback
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                mock_rag.side_effect = Exception("OpenAI service temporarily unavailable")
                
                with patch('services.help_rag_agent.HelpRAGAgent.get_fallback_response') as mock_fallback:
                    mock_fallback.return_value = {
                        "response": "I'm currently experiencing some issues. Here are some basic navigation tips: Use the sidebar menu to access different sections.",
                        "sources": [],
                        "confidence": 0.3,
                        "response_time_ms": 50,
                        "is_fallback": True
                    }
                    
                    query_request = {
                        "query": "How do I navigate the system?",
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
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    # Should return fallback response, not error
                    assert response.status_code == 200
                    data = response.json()
                    
                    # Verify fallback response characteristics
                    assert "experiencing some issues" in data["response"].lower()
                    assert data["confidence"] < 0.5
                    assert data.get("is_fallback") is True
            
            # Test scenario 2: Database connection issues
            with patch('config.database.supabase') as mock_supabase:
                mock_supabase.table.side_effect = Exception("Database connection failed")
                
                with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                    mock_rag.return_value = {
                        "response": "Basic help response without database context.",
                        "sources": [],
                        "confidence": 0.6,
                        "response_time_ms": 100
                    }
                    
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
                        headers={"Authorization": "Bearer test-token"}
                    )
                    
                    # Should still return a response
                    assert response.status_code == 200
                    data = response.json()
                    assert "response" in data
                    assert data["confidence"] > 0

    @pytest.mark.asyncio
    async def test_accessibility_integration(self, client, mock_auth_user):
        """
        Test accessibility features integration across the system
        Requirements: 1.1, 1.2, 1.3
        """
        with patch('auth.dependencies.get_current_user', return_value=mock_auth_user):
            with patch('services.help_rag_agent.HelpRAGAgent.process_help_query') as mock_rag:
                
                # Mock response with accessibility metadata
                mock_rag.return_value = {
                    "response": "# Project Creation Guide\n\nTo create a project:\n\n1. Navigate to Projects\n2. Click New Project\n3. Fill in details\n\n**Important:** Ensure all required fields are completed.",
                    "sources": [
                        {
                            "id": "guide-1",
                            "title": "Project Creation Guide",
                            "type": "guide",
                            "relevance": 0.95
                        }
                    ],
                    "confidence": 0.9,
                    "response_time_ms": 150,
                    "accessibility_metadata": {
                        "has_headings": True,
                        "has_lists": True,
                        "has_emphasis": True,
                        "reading_level": "intermediate",
                        "estimated_reading_time_seconds": 30
                    }
                }
                
                query_request = {
                    "query": "How do I create a project?",
                    "context": {
                        "route": "/projects",
                        "pageTitle": "Projects",
                        "userRole": "user"
                    },
                    "language": "en",
                    "accessibility_preferences": {
                        "screen_reader": True,
                        "high_contrast": False,
                        "reduced_motion": False
                    }
                }
                
                response = client.post(
                    "/ai/help/query",
                    json=query_request,
                    headers={"Authorization": "Bearer test-token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify structured content for accessibility
                response_text = data["response"]
                assert "#" in response_text  # Has headings
                assert "1." in response_text  # Has numbered lists
                assert "**" in response_text  # Has emphasis
                
                # Verify accessibility metadata
                if "accessibility_metadata" in data:
                    metadata = data["accessibility_metadata"]
                    assert metadata["has_headings"] is True
                    assert metadata["has_lists"] is True
                    assert "reading_level" in metadata


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])