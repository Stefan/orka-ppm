'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
// Import only the extensions we actually use instead of full StarterKit
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Code from '@tiptap/extension-code'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Blockquote from '@tiptap/extension-blockquote'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Undo,
  Redo,
  Save,
  AlertCircle,
  CheckCircle,
  Users,
  MessageSquare,
  Sparkles,
  Eye,
  Edit3,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react'

import type { 
  PMRReport, 
  PMRSection, 
  CollaborationSession,
  CursorPosition,
  AISuggestion,
  Conflict
} from './types'

export interface PMREditorProps {
  report: PMRReport
  onSave: (report: PMRReport) => void
  onSectionUpdate: (sectionId: string, content: any) => void
  onRequestAISuggestion: (sectionId: string, context: string) => Promise<AISuggestion[]>
  collaborationSession?: CollaborationSession
  onCollaborationEvent?: (event: any) => void
  isReadOnly?: boolean
  className?: string
}

interface EditorToolbarProps {
  editor: Editor | null
  onSave: () => void
  isSaving: boolean
  hasUnsavedChanges: boolean
  characterCount: number
  wordCount: number
}

interface SectionEditorProps {
  section: PMRSection
  editor: Editor | null
  isExpanded: boolean
  onToggle: () => void
  onSave: () => void
  onRequestSuggestions: () => void
  aiSuggestions: AISuggestion[]
  isLoadingSuggestions: boolean
  collaborators: CursorPosition[]
  conflicts: Conflict[]
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onSave,
  isSaving,
  hasUnsavedChanges,
  characterCount,
  wordCount
}) => {
  if (!editor) return null

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    icon: Icon, 
    title 
  }: { 
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    icon: React.ElementType
    title: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-md transition-colors ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  )

  return (
    <div className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-1">
          {/* Text Formatting */}
          <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-slate-700 pr-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              icon={Bold}
              title="Bold (Ctrl+B)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              icon={Italic}
              title="Italic (Ctrl+I)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              icon={Code}
              title="Code"
            />
          </div>

          {/* Headings */}
          <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-slate-700 px-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              icon={Heading1}
              title="Heading 1"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              icon={Heading2}
              title="Heading 2"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              icon={Heading3}
              title="Heading 3"
            />
          </div>

          {/* Lists */}
          <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-slate-700 px-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              icon={List}
              title="Bullet List"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              icon={ListOrdered}
              title="Numbered List"
            />
          </div>

          {/* Other */}
          <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-slate-700 px-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              icon={Quote}
              title="Quote"
            />
          </div>

          {/* History */}
          <div className="flex items-center space-x-1 px-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              icon={Undo}
              title="Undo (Ctrl+Z)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              icon={Redo}
              title="Redo (Ctrl+Shift+Z)"
            />
          </div>
        </div>

        {/* Right Side - Stats and Save */}
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {wordCount} words · {characterCount} characters
          </div>
          
          {hasUnsavedChanges && (
            <div className="flex items-center space-x-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-3 w-3" />
              <span>Unsaved changes</span>
            </div>
          )}

          <button
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  editor,
  isExpanded,
  onToggle,
  onSave,
  onRequestSuggestions,
  aiSuggestions,
  isLoadingSuggestions,
  collaborators,
  conflicts
}) => {
  const hasConflicts = conflicts.length > 0
  const activeCollaborators = collaborators.filter(c => c.section_id === section.section_id)

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
      {/* Section Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3 flex-1">
          <button className="text-gray-400 hover:text-gray-600 dark:text-slate-400">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-medium text-gray-900 dark:text-slate-100">{section.title}</h3>
              
              {section.ai_generated && (
                <span className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  <span>AI Generated</span>
                </span>
              )}
              
              {section.confidence_score !== undefined && (
                <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-full">
                  {Math.round(section.confidence_score * 100)}% confidence
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-slate-400">
              <span>Last modified: {new Date(section.last_modified).toLocaleString()}</span>
              <span>By: {section.modified_by}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Collaboration Indicators */}
          {activeCollaborators.length > 0 && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400">{activeCollaborators.length}</span>
            </div>
          )}

          {/* Conflict Indicator */}
          {hasConflicts && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400">Conflict</span>
            </div>
          )}
        </div>
      </div>

      {/* Section Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-slate-700">
          {/* Conflicts Warning */}
          {hasConflicts && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-900">Editing Conflict Detected</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Multiple users have made conflicting changes to this section. Please review and resolve conflicts.
                  </p>
                  <div className="mt-2 space-y-1">
                    {conflicts.map(conflict => (
                      <div key={conflict.id} className="text-xs text-red-600 dark:text-red-400">
                        Conflict with {conflict.conflicting_users.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Collaborators */}
          {activeCollaborators.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-900">
                  Currently editing: {activeCollaborators.map(c => c.user_name).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="p-4">
            <div className="prose max-w-none">
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="p-4 bg-purple-50 border-t border-purple-200">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h4 className="text-sm font-medium text-purple-900">AI Suggestions</h4>
              </div>
              <div className="space-y-2">
                {aiSuggestions.map(suggestion => (
                  <div key={suggestion.id} className="bg-white dark:bg-slate-800 p-3 rounded-md border border-purple-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100">{suggestion.title}</h5>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{suggestion.description}</p>
                        {suggestion.preview && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded text-xs text-gray-700 dark:text-slate-300">
                            {suggestion.preview}
                          </div>
                        )}
                      </div>
                      <span className="ml-2 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Actions */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <button
              onClick={onRequestSuggestions}
              disabled={isLoadingSuggestions}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 rounded-md hover:bg-purple-200 disabled:opacity-50 transition-colors"
            >
              {isLoadingSuggestions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading suggestions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Get AI Suggestions</span>
                </>
              )}
            </button>

            <button
              onClick={onSave}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-md hover:bg-blue-200 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Save Section</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const PMREditor: React.FC<PMREditorProps> = ({
  report,
  onSave,
  onSectionUpdate,
  onRequestAISuggestion,
  collaborationSession,
  onCollaborationEvent,
  isReadOnly = false,
  className = ''
}) => {
  const [currentSection, setCurrentSection] = useState<string | null>(
    report.sections.length > 0 ? report.sections[0]!.section_id : null
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(report.sections.slice(0, 1).map(s => s.section_id))
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion[]>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  // Get current section data
  const currentSectionData = useMemo(() => {
    return report.sections.find(s => s.section_id === currentSection)
  }, [report.sections, currentSection])

  // Initialize editor for current section
  const editor = useEditor({
    extensions: [
      // Core extensions (required)
      Document,
      Paragraph,
      Text,
      // Formatting extensions
      Bold,
      Italic,
      Code,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      // List extensions
      BulletList,
      OrderedList,
      ListItem,
      Blockquote,
      // History (undo/redo)
      History,
      // Additional features
      Placeholder.configure({
        placeholder: 'Start writing your report section...',
      }),
      CharacterCount,
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: currentSectionData?.content || '',
    editable: !isReadOnly && viewMode === 'edit',
    onUpdate: ({ editor }) => {
      setHasUnsavedChanges(true)
      if (currentSection) {
        onSectionUpdate(currentSection, editor.getJSON())
      }
    },
  })

  // Update editor content when section changes
  useEffect(() => {
    if (editor && currentSectionData) {
      editor.commands.setContent(currentSectionData.content || '')
      setHasUnsavedChanges(false)
    }
  }, [currentSection, currentSectionData, editor])

  // Handle section toggle
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
    setCurrentSection(sectionId)
  }, [])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return

    setIsSaving(true)
    try {
      await onSave(report)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save report:', error)
    } finally {
      setIsSaving(false)
    }
  }, [hasUnsavedChanges, isSaving, onSave, report])

  // Handle AI suggestions request
  const handleRequestSuggestions = useCallback(async (sectionId: string) => {
    if (loadingSuggestions.has(sectionId)) return

    setLoadingSuggestions(prev => new Set(prev).add(sectionId))
    try {
      const section = report.sections.find(s => s.section_id === sectionId)
      if (!section) return

      const suggestions = await onRequestAISuggestion(
        sectionId,
        JSON.stringify(section.content)
      )
      setAiSuggestions(prev => ({ ...prev, [sectionId]: suggestions }))
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
    } finally {
      setLoadingSuggestions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sectionId)
        return newSet
      })
    }
  }, [loadingSuggestions, report.sections, onRequestAISuggestion])

  // Get collaboration data for sections
  const getSectionCollaborators = useCallback((sectionId: string): CursorPosition[] => {
    if (!collaborationSession) return []
    // This would be populated from real-time collaboration data
    return []
  }, [collaborationSession])

  const getSectionConflicts = useCallback((sectionId: string): Conflict[] => {
    if (!collaborationSession) return []
    return collaborationSession.conflicts.filter(c => c.section_id === sectionId)
  }, [collaborationSession])

  // Character and word count
  const characterCount = editor?.storage.characterCount.characters() || 0
  const wordCount = editor?.storage.characterCount.words() || 0

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-slate-800/50 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{report.title}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {report.report_month} {report.report_year} · Version {report.version}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-slate-700 rounded-md p-1">
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center space-x-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
                }`}
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center space-x-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
                }`}
              >
                <Eye className="h-4 w-4" />
                <span>Preview</span>
              </button>
            </div>

            {/* Collaboration Status */}
            {collaborationSession && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-900">
                  {collaborationSession.participants.length} collaborators
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode === 'edit' && (
        <EditorToolbar
          editor={editor}
          onSave={handleSave}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          characterCount={characterCount}
          wordCount={wordCount}
        />
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {report.sections.map(section => (
            <SectionEditor
              key={section.section_id}
              section={section}
              editor={currentSection === section.section_id ? editor : null}
              isExpanded={expandedSections.has(section.section_id)}
              onToggle={() => toggleSection(section.section_id)}
              onSave={handleSave}
              onRequestSuggestions={() => handleRequestSuggestions(section.section_id)}
              aiSuggestions={aiSuggestions[section.section_id] || []}
              isLoadingSuggestions={loadingSuggestions.has(section.section_id)}
              collaborators={getSectionCollaborators(section.section_id)}
              conflicts={getSectionConflicts(section.section_id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PMREditor
