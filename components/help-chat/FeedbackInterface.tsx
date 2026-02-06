'use client'

import { useState, useCallback } from 'react'
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Bug, 
  Lightbulb,
  X,
  Send,
  Star,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { cn } from '../../lib/design-system'
import type { ChatMessage, HelpFeedbackRequest } from '../../types/help-chat'

interface FeedbackInterfaceProps {
  message: ChatMessage
  onSubmitFeedback: (messageId: string, feedback: HelpFeedbackRequest) => Promise<void>
  onClose: () => void
  className?: string
}

interface FeedbackFormData {
  rating: 1 | 2 | 3 | 4 | 5
  feedbackType: 'helpful' | 'not_helpful' | 'incorrect' | 'suggestion'
  feedbackText: string
  reportType?: 'bug' | 'feature_request'
  reportTitle?: string
  reportDescription?: string
}

/**
 * Feedback interface component for help chat messages
 * Integrates with existing feedback system for bug reports and feature requests
 */
export function FeedbackInterface({ 
  message, 
  onSubmitFeedback, 
  onClose, 
  className 
}: FeedbackInterfaceProps) {
  const [step, setStep] = useState<'rating' | 'details' | 'report' | 'success'>('rating')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FeedbackFormData>({
    rating: 3,
    feedbackType: 'helpful',
    feedbackText: '',
    reportTitle: '',
    reportDescription: ''
  })

  // Handle rating selection
  const handleRatingSelect = useCallback((rating: 1 | 2 | 3 | 4 | 5) => {
    setFormData(prev => ({ ...prev, rating }))
    
    // Auto-determine feedback type based on rating
    const feedbackType = rating >= 4 ? 'helpful' : rating >= 3 ? 'suggestion' : 'not_helpful'
    setFormData(prev => ({ ...prev, feedbackType }))
    
    // Move to details step for ratings 3 and below, or if user wants to provide more feedback
    if (rating <= 3) {
      setStep('details')
    } else {
      // For high ratings, allow quick submission or detailed feedback
      setStep('details')
    }
  }, [])

  // Handle feedback type selection
  const handleFeedbackTypeSelect = useCallback((feedbackType: FeedbackFormData['feedbackType']) => {
    setFormData(prev => ({ ...prev, feedbackType }))
  }, [])

  // Handle text input changes
  const handleTextChange = useCallback((field: keyof FeedbackFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Handle report type selection
  const handleReportTypeSelect = useCallback((reportType: 'bug' | 'feature_request') => {
    setFormData(prev => ({ ...prev, reportType }))
    setStep('report')
  }, [])

  // Submit feedback to help chat system
  const handleSubmitFeedback = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const feedback: HelpFeedbackRequest = {
        messageId: message.id,
        rating: formData.rating,
        feedbackText: formData.feedbackText,
        feedbackType: formData.feedbackType
      }

      await onSubmitFeedback(message.id, feedback)
      setStep('success')
    } catch (err) {
      console.error('Error submitting feedback:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }, [message.id, formData, onSubmitFeedback])

  // Submit report to main feedback system
  const handleSubmitReport = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // First submit the help chat feedback
      await handleSubmitFeedback()

      // Then submit to main feedback system if user wants to report bug/feature
      if (formData.reportType && formData.reportTitle && formData.reportDescription) {
        const reportEndpoint = formData.reportType === 'bug' ? '/feedback/bugs' : '/feedback/features'
        const reportData = formData.reportType === 'bug' 
          ? {
              title: formData.reportTitle,
              description: formData.reportDescription,
              steps_to_reproduce: `Related to help chat response: "${message.content.substring(0, 100)}..."`,
              expected_behavior: 'Expected accurate help response',
              actual_behavior: formData.feedbackText,
              priority: formData.rating <= 2 ? 'high' : 'medium',
              severity: formData.rating <= 2 ? 'major' : 'minor',
              category: 'functionality'
            }
          : {
              title: formData.reportTitle,
              description: formData.reportDescription,
              priority: formData.rating <= 2 ? 'high' : 'medium',
              tags: ['help-chat', 'ai-assistant']
            }

        const response = await fetch(`/api${reportEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportData)
        })

        if (!response.ok) {
          throw new Error('Failed to submit report to feedback system')
        }
      }

      setStep('success')
    } catch (err) {
      console.error('Error submitting report:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, message.content, handleSubmitFeedback])

  // Render rating step
  const renderRatingStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
          How helpful was this response?
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Your feedback helps us improve the AI assistant
        </p>
      </div>

      <div className="flex justify-center space-x-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => handleRatingSelect(rating as 1 | 2 | 3 | 4 | 5)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              formData.rating === rating
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-slate-500 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50'
            )}

          >
            <Star 
              className={cn(
                'h-6 w-6',
                formData.rating >= rating ? 'fill-current' : ''
              )} 
            />
          </button>
        ))}
      </div>

      <div className="flex justify-center space-x-2 text-xs text-gray-500 dark:text-slate-400">
        <span>Not helpful</span>
        <span className="flex-1 text-center">Somewhat helpful</span>
        <span>Very helpful</span>
      </div>
    </div>
  )

  // Render details step
  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
          Tell us more (optional)
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Help us understand how to improve
        </p>
      </div>

      {/* Feedback type selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          What type of feedback is this?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'helpful', label: 'Helpful', icon: ThumbsUp },
            { value: 'not_helpful', label: 'Not helpful', icon: ThumbsDown },
            { value: 'incorrect', label: 'Incorrect', icon: AlertCircle },
            { value: 'suggestion', label: 'Suggestion', icon: Lightbulb }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleFeedbackTypeSelect(value as FeedbackFormData['feedbackType'])}
              className={cn(
                'flex items-center space-x-2 p-3 rounded-lg border text-sm transition-colors',
                formData.feedbackType === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-700 dark:text-slate-300'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback text */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Additional comments
        </label>
        <textarea
          value={formData.feedbackText}
          onChange={(e) => handleTextChange('feedbackText', e.target.value)}
          placeholder="What could be improved? What was missing or incorrect?"
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
        />
      </div>

      {/* Report options for negative feedback */}
      {(formData.rating <= 3 || formData.feedbackType === 'incorrect' || formData.feedbackType === 'not_helpful') && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Would you like to report this issue?
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => handleReportTypeSelect('bug')}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 text-sm"
            >
              <Bug className="h-4 w-4 text-red-500 dark:text-red-400" />
              <span>Report Bug</span>
            </button>
            <button
              onClick={() => handleReportTypeSelect('feature_request')}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 text-sm"
            >
              <Lightbulb className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <span>Suggest Feature</span>
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmitFeedback}
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Submit Feedback</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  // Render report step
  const renderReportStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
          {formData.reportType === 'bug' ? 'Report Bug' : 'Suggest Feature'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          This will be submitted to our main feedback system
        </p>
      </div>

      {/* Report title */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {formData.reportType === 'bug' ? 'Bug Title' : 'Feature Title'} *
        </label>
        <input
          type="text"
          value={formData.reportTitle}
          onChange={(e) => handleTextChange('reportTitle', e.target.value)}
          placeholder={formData.reportType === 'bug' 
            ? 'Brief description of the bug' 
            : 'Brief description of the feature request'
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      {/* Report description */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Detailed Description *
        </label>
        <textarea
          value={formData.reportDescription}
          onChange={(e) => handleTextChange('reportDescription', e.target.value)}
          placeholder={formData.reportType === 'bug'
            ? 'Describe what went wrong and what you expected to happen'
            : 'Explain the feature in detail and why it would be valuable'
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={4}
          required
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setStep('details')}
          className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmitReport}
          disabled={isSubmitting || !formData.reportTitle || !formData.reportDescription}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Submit Report</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  // Render success step
  const renderSuccessStep = () => (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
          Thank you for your feedback!
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Your feedback helps us improve the AI assistant.
          {formData.reportType && (
            <span className="block mt-2">
              Your {formData.reportType === 'bug' ? 'bug report' : 'feature request'} has been submitted to our team.
            </span>
          )}
        </p>
      </div>
      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Close
      </button>
    </div>
  )

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-6 max-w-md mx-auto',
      className
    )}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-slate-100">Feedback</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      {step === 'rating' && renderRatingStep()}
      {step === 'details' && renderDetailsStep()}
      {step === 'report' && renderReportStep()}
      {step === 'success' && renderSuccessStep()}
    </div>
  )
}

export default FeedbackInterface