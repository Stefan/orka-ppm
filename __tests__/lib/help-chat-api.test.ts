/**
 * Unit tests for Help Chat API functions
 */

import { sendHelpQuery, submitFeedback, getProactiveTips, handleApiError, HelpChatError } from '../../lib/help-chat-api';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Help Chat API', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('sendHelpQuery', () => {
    it('sends help query successfully', async () => {
      const mockResponse = {
        query_id: 'query-123',
        session_id: 'session-123',
        response: 'This is a helpful response',
        citations: [],
        sources: [],
        confidence: 0.85,
        language: 'en',
        processed_at: '2024-01-01T00:00:00Z',
        cache_hit: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        query: 'How do I create a project?',
        context: {
          user_id: 'user-123',
          role: 'user',
          current_page: '/dashboard',
        },
        language: 'en',
      };

      const result = await sendHelpQuery(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ai/help/query',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const request = {
        query: 'Test query',
        context: {
          user_id: 'user-123',
          role: 'user',
          current_page: '/dashboard',
        },
      };

      await expect(sendHelpQuery(request)).rejects.toThrow('Help query failed: Internal Server Error');
    });
  });

  describe('submitFeedback', () => {
    it('submits feedback successfully', async () => {
      const mockResponse = {
        message: 'Feedback submitted successfully',
        feedback_id: 'feedback-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        message_id: 'msg-123',
        rating: 5,
        feedback_type: 'helpful',
      };

      const result = await submitFeedback(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ai/help/feedback',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProactiveTips', () => {
    it('fetches proactive tips with parameters', async () => {
      const mockResponse = {
        tips: [
          {
            id: 'tip-1',
            title: 'Quick Project Creation',
            content: 'Use the quick create button...',
            category: 'projects',
            priority: 'high',
            relevant_pages: ['/dashboard'],
            conditions: { user_role: 'user' },
          }
        ],
        total_count: 1,
        personalized: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getProactiveTips(
        '/dashboard',
        'Dashboard',
        'user',
        'project-123',
        'portfolio-456',
        ['/projects', '/dashboard'],
        300,
        ['create project', 'manage tasks'],
        'intermediate',
        5
      );

      const expectedUrl = 'http://localhost:8000/api/ai/help/tips?' +
        'page_route=%2Fdashboard&' +
        'page_title=Dashboard&' +
        'user_role=user&' +
        'current_project=project-123&' +
        'current_portfolio=portfolio-456&' +
        'recent_pages=%2Fprojects%2C%2Fdashboard&' +
        'time_on_page=300&' +
        'frequent_queries=create+project%2Cmanage+tasks&' +
        'user_level=intermediate&' +
        'session_count=5';

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('handleApiError', () => {
    it('handles network errors', () => {
      const error = new Error('Network error');
      const result = handleApiError(error);

      expect(result).toBeInstanceOf(HelpChatError);
      expect(result.message).toBe('Network error occurred');
    });

    it('handles HTTP 404 errors', () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      };

      const result = handleApiError(error);

      expect(result).toBeInstanceOf(HelpChatError);
      expect(result.message).toBe('The requested resource was not found.');
      expect(result.statusCode).toBe(404);
    });

    it('handles HTTP 429 rate limit errors', () => {
      const error = {
        response: {
          status: 429,
        }
      };

      const result = handleApiError(error);

      expect(result).toBeInstanceOf(HelpChatError);
      expect(result.message).toBe('Rate limit exceeded. Please try again later.');
      expect(result.statusCode).toBe(429);
    });

    it('handles existing HelpChatError instances', () => {
      const originalError = new HelpChatError('Custom error', 400);
      const result = handleApiError(originalError);

      expect(result).toBe(originalError);
    });
  });

  describe('language preference functions', () => {
    it('gets user language preference', async () => {
      const mockResponse = { language: 'de' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await import('../../lib/help-chat-api').then(m => m.getUserLanguagePreference('user-123'));

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ai/help/language/preference',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'user-123',
          },
        }
      );

      expect(result).toBe('de');
    });

    it('falls back to English when preference not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await import('../../lib/help-chat-api').then(m => m.getUserLanguagePreference('user-123'));

      expect(result).toBe('en');
    });

    it('sets user language preference', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const setPreference = await import('../../lib/help-chat-api').then(m => m.setUserLanguagePreference);

      await setPreference('user-123', 'fr');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ai/help/language/preference',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'user-123',
          },
          body: JSON.stringify({ language: 'fr' }),
        }
      );
    });
  });

  describe('translation functions', () => {
    it('translates text successfully', async () => {
      const mockResponse = { translated_text: 'Hola mundo' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const translateText = await import('../../lib/help-chat-api').then(m => m.translateText);

      const result = await translateText('Hello world', 'es', 'en');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/ai/help/translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: 'Hello world',
            target_language: 'es',
            source_language: 'en'
          }),
        }
      );

      expect(result).toBe('Hola mundo');
    });

    it('detects query language', async () => {
      const mockResponse = { detected_language: 'es' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const detectQueryLanguage = await import('../../lib/help-chat-api').then(m => m.detectQueryLanguage);

      const result = await detectQueryLanguage('Hola mundo');

      expect(result).toBe('es');
    });

    it('falls back to English for language detection failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const detectQueryLanguage = await import('../../lib/help-chat-api').then(m => m.detectQueryLanguage);

      const result = await detectQueryLanguage('Some text');

      expect(result).toBe('en');
    });
  });
});