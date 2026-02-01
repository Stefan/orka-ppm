/**
 * TypeScript types for Help Chat with RAG support
 */

export interface Citation {
  number: number;
  type: 'reference' | 'source';
}

export interface Source {
  id: number;
  title: string;
  category?: string;
  content_preview: string;
  url?: string;
  similarity_score?: number;
}

export interface ChatMessage {
  id: string;
  query: string;
  response: string;
  citations: Citation[];
  sources: Source[];
  confidence: number;
  language: string;
  timestamp: string;
  cache_hit?: boolean;
  is_fallback?: boolean;
  error_message?: string;
}

export interface ChatQueryRequest {
  query: string;
  session_id?: string;
  context: {
    user_id: string;
    role: string;
    current_page: string;
    current_project?: string;
    current_portfolio?: string;
  };
  language?: string;
  include_proactive_tips?: boolean;
}

export interface ChatResponse {
  query_id: string;
  session_id: string;
  response: string;
  citations: Citation[];
  sources: Source[];
  confidence: number;
  language: string;
  processed_at: string;
  cache_hit: boolean;
  is_fallback?: boolean;
  error_message?: string;
  conversation_context?: number;
  performance_metrics?: {
    total_queries: number;
    cache_hit_rate: number;
    average_response_time_ms: number;
    error_rate: number;
  };
}

export interface FeedbackRequest {
  message_id: string;
  rating?: number; // 1-5
  feedback_text?: string;
  feedback_type?: 'helpful' | 'unhelpful' | 'incorrect' | 'offensive' | 'other';
}

export interface FeedbackResponse {
  message: string;
  feedback_id: string;
}

export interface ProactiveTip {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  relevant_pages: string[];
  conditions: {
    user_role?: string;
    time_on_page?: number;
    recent_actions?: string[];
  };
}

export interface ProactiveTipsResponse {
  tips: ProactiveTip[];
  total_count: number;
  personalized: boolean;
}

export interface HelpContextRequest {
  page_route: string;
  page_title?: string;
  user_role?: string;
  current_project?: string;
  current_portfolio?: string;
}

export interface HelpContextResponse {
  context: {
    page_description: string;
    available_actions: string[];
    related_features: string[];
    common_questions: string[];
  };
  suggestions: {
    quick_actions: Array<{
      id: string;
      label: string;
      description: string;
      action: string;
    }>;
    related_pages: Array<{
      route: string;
      title: string;
      relevance: number;
    }>;
  };
}