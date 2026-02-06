'use client'

/**
 * Error Boundary for Nested Grid components
 * Requirements: 6.2, 7.4, 18.3
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class NestedGridErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="p-4 text-sm text-red-800 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded"
          data-testid="nested-grid-error-boundary"
        >
          <p className="font-medium">Something went wrong loading this grid.</p>
          <p className="mt-1 text-red-500 dark:text-red-400">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-xs underline text-red-700 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
