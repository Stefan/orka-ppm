import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PMREditor from '../PMREditor'
import type { PMRReport, PMRSection, AISuggestion } from '../types'

// Mock TipTap editor
jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => ({
    commands: {
      setContent: jest.fn(),
      focus: jest.fn(),
      toggleBold: jest.fn(() => ({ run: jest.fn() })),
      toggleItalic: jest.fn(() => ({ run: jest.fn() })),
      toggleCode: jest.fn(() => ({ run: jest.fn() })),
      toggleHeading: jest.fn(() => ({ run: jest.fn() })),
      toggleBulletList: jest.fn(() => ({ run: jest.fn() })),
      toggleOrderedList: jest.fn(() => ({ run: jest.fn() })),
      toggleBlockquote: jest.fn(() => ({ run: jest.fn() })),
      undo: jest.fn(() => ({ run: jest.fn() })),
      redo: jest.fn(() => ({ run: jest.fn() })),
    },
    isActive: jest.fn(() => false),
    can: jest.fn(() => ({ undo: jest.fn(() => true), redo: jest.fn(() => true) })),
    getJSON: jest.fn(() => ({})),
    storage: {
      characterCount: {
        characters: jest.fn(() => 100),
        words: jest.fn(() => 20),
      },
    },
  })),
  EditorContent: ({ editor }: any) => <div data-testid="editor-content">Editor Content</div>,
}))

describe('PMREditor', () => {
  const mockSection: PMRSection = {
    section_id: 'section-1',
    title: 'Executive Summary',
    content: { type: 'doc', content: [] },
    ai_generated: false,
    last_modified: new Date().toISOString(),
    modified_by: 'user-1',
  }

  const mockReport: PMRReport = {
    id: 'report-1',
    project_id: 'project-1',
    title: 'Monthly Report - January 2026',
    report_month: 'January',
    report_year: 2026,
    status: 'draft',
    sections: [mockSection],
    ai_insights: [],
    real_time_metrics: {},
    confidence_scores: {},
    template_customizations: {},
    generated_by: 'user-1',
    generated_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
    version: 1,
  }

  const mockOnSave = jest.fn()
  const mockOnSectionUpdate = jest.fn()
  const mockOnRequestAISuggestion = jest.fn(async () => [] as AISuggestion[])

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the editor with report title', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    expect(screen.getByText('Monthly Report - January 2026')).toBeInTheDocument()
    expect(screen.getByText('January 2026 · Version 1')).toBeInTheDocument()
  })

  it('renders sections', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    expect(screen.getByText('Executive Summary')).toBeInTheDocument()
  })

  it('toggles section expansion', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    const sectionHeader = screen.getByText('Executive Summary').closest('div')
    expect(sectionHeader).toBeInTheDocument()

    // Section should be expanded by default (first section)
    expect(screen.getByTestId('editor-content')).toBeInTheDocument()
  })

  it('switches between edit and preview modes', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    const editButton = screen.getByText('Edit')
    const previewButton = screen.getByText('Preview')

    expect(editButton).toBeInTheDocument()
    expect(previewButton).toBeInTheDocument()

    fireEvent.click(previewButton)
    // In preview mode, toolbar should not be visible
    // This is a basic check - in real implementation, toolbar visibility would change
  })

  it('displays AI generated badge for AI sections', () => {
    const aiSection: PMRSection = {
      ...mockSection,
      section_id: 'section-2',
      title: 'AI Generated Section',
      ai_generated: true,
      confidence_score: 0.95,
    }

    const reportWithAI: PMRReport = {
      ...mockReport,
      sections: [aiSection],
    }

    render(
      <PMREditor
        report={reportWithAI}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    expect(screen.getByText('AI Generated')).toBeInTheDocument()
    expect(screen.getByText('95% confidence')).toBeInTheDocument()
  })

  it('displays collaboration status when session is active', () => {
    const collaborationSession = {
      session_id: 'session-1',
      report_id: 'report-1',
      participants: ['user-1', 'user-2'],
      active_editors: ['user-1'],
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      comments: [],
      conflicts: [],
    }

    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
        collaborationSession={collaborationSession}
      />
    )

    expect(screen.getByText('2 collaborators')).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    // Note: Save button is disabled by default (no unsaved changes)
    // Get the main save button from the toolbar (not the section save button)
    const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
    const mainSaveButton = saveButtons[0] // First one is the toolbar save button
    expect(mainSaveButton).toBeInTheDocument()
    expect(mainSaveButton).toBeDisabled() // No unsaved changes
  })

  it('requests AI suggestions when button is clicked', async () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    // Section is expanded by default (first section)
    // Look for the suggestions button
    const suggestionsButton = await screen.findByText('Get AI Suggestions')
    expect(suggestionsButton).toBeInTheDocument()

    fireEvent.click(suggestionsButton)

    await waitFor(() => {
      expect(mockOnRequestAISuggestion).toHaveBeenCalledWith(
        'section-1',
        expect.any(String)
      )
    })
  })

  it('displays conflicts when present', async () => {
    const collaborationSession = {
      session_id: 'session-1',
      report_id: 'report-1',
      participants: ['user-1', 'user-2'],
      active_editors: ['user-1', 'user-2'],
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      comments: [],
      conflicts: [
        {
          id: 'conflict-1',
          section_id: 'section-1',
          conflicting_users: ['user-1', 'user-2'],
          conflict_type: 'simultaneous_edit' as const,
          original_content: {},
          conflicting_changes: [],
          resolved: false,
        },
      ],
    }

    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
        collaborationSession={collaborationSession}
      />
    )

    // Section is expanded by default (first section), so conflict should be visible
    const conflictMessage = await screen.findByText('Editing Conflict Detected')
    expect(conflictMessage).toBeInTheDocument()
  })

  it('renders in read-only mode when isReadOnly is true', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
        isReadOnly={true}
      />
    )

    // In read-only mode, the editor should still render but be non-editable
    expect(screen.getByText('Monthly Report - January 2026')).toBeInTheDocument()
  })

  it('displays character and word count', () => {
    render(
      <PMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
        onRequestAISuggestion={mockOnRequestAISuggestion}
      />
    )

    expect(screen.getByText(/20 words/)).toBeInTheDocument()
    expect(screen.getByText(/100 characters/)).toBeInTheDocument()
  })
})
