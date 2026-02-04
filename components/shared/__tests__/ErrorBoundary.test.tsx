/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

jest.mock('@/lib/monitoring/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}))
jest.mock('@/lib/i18n/loader', () => ({
  loadTranslations: jest.fn().mockResolvedValue({})
}))

const Throw = () => {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <span>Child content</span>
      </ErrorBoundary>
    )
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    let result: ReturnType<typeof render>
    act(() => {
      result = render(
        <ErrorBoundary>
          <Throw />
        </ErrorBoundary>
      )
    })
    expect(result!.container.textContent).toMatch(/Test error|error|Something went wrong|went wrong/i)
    consoleSpy.mockRestore()
  })

  it('calls onError when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const onError = jest.fn()
    act(() => {
      render(
        <ErrorBoundary onError={onError}>
          <Throw />
        </ErrorBoundary>
      )
    })
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object))
    expect(onError.mock.calls[0][0].message).toBe('Test error')
    consoleSpy.mockRestore()
  })

  it('renders custom fallback when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    act(() => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <Throw />
        </ErrorBoundary>
      )
    })
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })
})
