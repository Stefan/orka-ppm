/**
 * Help Chat API client with RAG support
 * Uses same-origin /api/ai/help/* so production (Vercel) proxies to backend via Next.js API routes.
 */

import { ChatQueryRequest, ChatResponse, FeedbackRequest, FeedbackResponse, ProactiveTipsResponse, HelpContextResponse } from './types/help-chat';

/** Same-origin in browser (Vercel/localhost:3000); Next.js API routes proxy to backend. */
const API_BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001');

export async function sendHelpQuery(request: ChatQueryRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Help query failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as ChatResponse;
}

export async function submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Feedback submission failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as FeedbackResponse;
}

export async function getProactiveTips(
  pageRoute: string,
  pageTitle = '',
  userRole = 'user',
  currentProject?: string,
  currentPortfolio?: string,
  recentPages: string[] = [],
  timeOnPage = 0,
  frequentQueries: string[] = [],
  userLevel = 'intermediate',
  sessionCount = 1
): Promise<ProactiveTipsResponse> {
  const params = new URLSearchParams({
    page_route: pageRoute,
    page_title: pageTitle,
    user_role: userRole,
    recent_pages: recentPages.join(','),
    time_on_page: timeOnPage.toString(),
    frequent_queries: frequentQueries.join(','),
    user_level: userLevel,
    session_count: sessionCount.toString(),
  });

  if (currentProject) params.set('current_project', currentProject);
  if (currentPortfolio) params.set('current_portfolio', currentPortfolio);

  const response = await fetch(`${API_BASE_URL}/api/ai/help/tips?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Proactive tips request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as ProactiveTipsResponse;
}

export async function getHelpContext(
  pageRoute: string,
  pageTitle = '',
  userRole = 'user',
  currentProject?: string,
  currentPortfolio?: string
): Promise<HelpContextResponse> {
  const params = new URLSearchParams({
    page_route: pageRoute,
    page_title: pageTitle,
    user_role: userRole,
  });

  if (currentProject) params.set('current_project', currentProject);
  if (currentPortfolio) params.set('current_portfolio', currentPortfolio);

  const response = await fetch(`${API_BASE_URL}/api/ai/help/context?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Help context request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as HelpContextResponse;
}

export async function getSupportedLanguages(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/languages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Languages request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.languages || [];
}

export async function getUserLanguagePreference(userId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/language/preference`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': userId,
    },
  });

  if (!response.ok) {
    // Return default language if preference not found
    return 'en';
  }

  const data = await response.json();
  return data.language || 'en';
}

export async function setUserLanguagePreference(userId: string, language: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/language/preference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': userId,
    },
    body: JSON.stringify({ language }),
  });

  if (!response.ok) {
    throw new Error(`Language preference update failed: ${response.statusText}`);
  }
}

export async function detectQueryLanguage(text: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/ai/help/language/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    // Fallback to English detection
    return 'en';
  }

  const data = await response.json();
  return data.detected_language || 'en';
}

export async function translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
  const requestBody: any = {
    text,
    target_language: targetLanguage,
  };

  if (sourceLanguage) {
    requestBody.source_language = sourceLanguage;
  }

  const response = await fetch(`${API_BASE_URL}/api/ai/help/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.translated_text || text;
}

// Error handling utilities
export class HelpChatError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'HelpChatError';
  }
}

export function handleApiError(error: any): HelpChatError {
  if (error instanceof HelpChatError) {
    return error;
  }

  if (error.response) {
    const statusCode = error.response.status;
    let message = 'An unexpected error occurred';

    switch (statusCode) {
      case 400:
        message = 'Invalid request. Please check your input.';
        break;
      case 401:
        message = 'Authentication required. Please log in.';
        break;
      case 403:
        message = 'Access denied. You may not have permission for this action.';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 429:
        message = 'Rate limit exceeded. Please try again later.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      default:
        message = error.response.data?.message || message;
    }

    return new HelpChatError(message, statusCode);
  }

  return new HelpChatError(error.message || 'Network error occurred');
}