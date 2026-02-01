/**
 * Unit tests for HelpChat component with RAG support
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpChat } from '../../components/HelpChat';

// Mock the API functions
jest.mock('../../lib/help-chat-api', () => ({
  sendHelpQuery: jest.fn(),
  submitFeedback: jest.fn(),
}));

import { sendHelpQuery, submitFeedback } from '../../lib/help-chat-api';

const mockSendHelpQuery = sendHelpQuery as jest.MockedFunction<typeof sendHelpQuery>;
const mockSubmitFeedback = submitFeedback as jest.MockedFunction<typeof submitFeedback>;

describe('HelpChat Component', () => {
  const defaultProps = {
    userId: 'user-123',
    userRole: 'user',
    currentPage: '/dashboard',
    language: 'en',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders help chat interface', () => {
    render(<HelpChat {...defaultProps} />);

    expect(screen.getByText('Help Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('displays welcome message when no messages', () => {
    render(<HelpChat {...defaultProps} />);

    expect(screen.getByText(/ask me anything/i)).toBeInTheDocument();
  });

  it('handles query submission', async () => {
    const mockResponse = {
      query_id: 'query-123',
      session_id: 'session-123',
      response: 'This is a helpful response',
      citations: [{ number: 1, type: 'reference' }],
      sources: [{
        id: 1,
        title: 'Test Document',
        content_preview: 'Preview text...',
        category: 'testing'
      }],
      confidence: 0.85,
      language: 'en',
      processed_at: new Date().toISOString(),
      cache_hit: false,
    };

    mockSendHelpQuery.mockResolvedValue(mockResponse);

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'How do I create a project?');
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('This is a helpful response')).toBeInTheDocument();
    });

    // Check that API was called
    expect(mockSendHelpQuery).toHaveBeenCalledWith({
      query: 'How do I create a project?',
      session_id: expect.stringContaining('session_'),
      context: {
        user_id: 'user-123',
        role: 'user',
        current_page: '/dashboard',
      },
      language: 'en',
    });
  });

  it('displays citations when present', async () => {
    const mockResponse = {
      query_id: 'query-123',
      session_id: 'session-123',
      response: 'This is a response with citations',
      citations: [
        { number: 1, type: 'reference' },
        { number: 2, type: 'reference' }
      ],
      sources: [],
      confidence: 0.9,
      language: 'en',
      processed_at: new Date().toISOString(),
      cache_hit: false,
    };

    mockSendHelpQuery.mockResolvedValue(mockResponse);

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Sources:')).toBeInTheDocument();
      expect(screen.getByText('[1]')).toBeInTheDocument();
      expect(screen.getByText('[2]')).toBeInTheDocument();
    });
  });

  it('displays sources when present', async () => {
    const mockResponse = {
      query_id: 'query-123',
      session_id: 'session-123',
      response: 'This is a response with sources',
      citations: [],
      sources: [{
        id: 1,
        title: 'Test Document',
        content_preview: 'This is preview text from the document...',
        category: 'testing'
      }],
      confidence: 0.8,
      language: 'en',
      processed_at: new Date().toISOString(),
      cache_hit: false,
    };

    mockSendHelpQuery.mockResolvedValue(mockResponse);

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Referenced Documents:')).toBeInTheDocument();
      expect(screen.getByText('Test Document')).toBeInTheDocument();
      expect(screen.getByText('Category: testing')).toBeInTheDocument();
    });
  });

  it('shows confidence score', async () => {
    const mockResponse = {
      query_id: 'query-123',
      session_id: 'session-123',
      response: 'High confidence response',
      citations: [],
      sources: [],
      confidence: 0.95,
      language: 'en',
      processed_at: new Date().toISOString(),
      cache_hit: false,
    };

    mockSendHelpQuery.mockResolvedValue(mockResponse);

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
    });
  });

  it('handles feedback submission', async () => {
    const mockResponse = {
      query_id: 'query-123',
      session_id: 'session-123',
      response: 'Response for feedback test',
      citations: [],
      sources: [],
      confidence: 0.7,
      language: 'en',
      processed_at: new Date().toISOString(),
      cache_hit: false,
    };

    mockSendHelpQuery.mockResolvedValue(mockResponse);
    mockSubmitFeedback.mockResolvedValue({
      message: 'Feedback submitted',
      feedback_id: 'feedback-123'
    });

    render(<HelpChat {...defaultProps} />);

    // Submit a query first
    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    // Wait for response and feedback buttons
    await waitFor(() => {
      expect(screen.getByText('👍 Helpful')).toBeInTheDocument();
    });

    // Click helpful feedback
    const helpfulButton = screen.getByText('👍 Helpful');
    fireEvent.click(helpfulButton);

    // Check that feedback API was called
    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith({
        message_id: 'query-123',
        rating: 5,
        feedback_text: '',
        feedback_type: 'helpful'
      });
    });

    // Button should be highlighted
    expect(helpfulButton).toHaveClass('bg-green-100');
  });

  it('handles API errors gracefully', async () => {
    mockSendHelpQuery.mockRejectedValue(new Error('API Error'));

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/encountered an error/i)).toBeInTheDocument();
    });
  });

  it('disables input during loading', async () => {
    const slowResponse = new Promise(resolve => {
      setTimeout(() => resolve({
        query_id: 'query-123',
        session_id: 'session-123',
        response: 'Slow response',
        citations: [],
        sources: [],
        confidence: 0.8,
        language: 'en',
        processed_at: new Date().toISOString(),
        cache_hit: false,
      }), 100);
    });

    mockSendHelpQuery.mockReturnValue(slowResponse);

    render(<HelpChat {...defaultProps} />);

    const input = screen.getByPlaceholderText('Ask a question...');
    const submitButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Test query');
    fireEvent.click(submitButton);

    // Input should be disabled during loading
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Sending...');

    // Wait for completion
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Send');
    });

    expect(input).not.toBeDisabled();
    expect(submitButton).not.toBeDisabled();
  });

  it('handles close button', () => {
    const mockOnClose = jest.fn();
    render(<HelpChat {...defaultProps} onClose={mockOnClose} />);

    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});