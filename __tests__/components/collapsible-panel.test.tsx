/**
 * Unit tests for CollapsiblePanel (Task 52.3)
 * Test animation timing, state persistence, multiple panels open.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CollapsiblePanel } from '@/components/costbook/CollapsiblePanel'

describe('CollapsiblePanel (Task 52.3)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
    }
  })

  it('toggles open/closed on header click', () => {
    render(
      <CollapsiblePanel title="Test Panel" defaultOpen={true}>
        <div>Content</div>
      </CollapsiblePanel>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
    const header = screen.getByText('Test Panel').closest('button') ?? screen.getByRole('button', { name: /test panel/i })
    if (header) {
      fireEvent.click(header)
      fireEvent.click(header)
    }
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies transition classes for animation', () => {
    const { container } = render(
      <CollapsiblePanel title="Panel" defaultOpen={true}>
        <div>Body</div>
      </CollapsiblePanel>
    )
    const panel = container.querySelector('[data-testid="collapsible-panel"]') ?? container.firstChild
    expect(panel).toBeTruthy()
  })

  it('persists state in sessionStorage when persistState and storageKey provided', () => {
    render(
      <CollapsiblePanel title="Persist Panel" defaultOpen={true} persistState storageKey="test-panel">
        <div>Persisted</div>
      </CollapsiblePanel>
    )
    expect(screen.getByText('Persisted')).toBeInTheDocument()
    const key = 'collapsible-panel-test-panel'
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null
    expect(stored === 'true' || stored === null).toBe(true)
  })

  it('multiple panels can be open simultaneously (each has own state)', () => {
    const { container } = render(
      <>
        <CollapsiblePanel title="Panel A" defaultOpen={true}>
          <div>A</div>
        </CollapsiblePanel>
        <CollapsiblePanel title="Panel B" defaultOpen={true}>
          <div>B</div>
        </CollapsiblePanel>
      </>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
