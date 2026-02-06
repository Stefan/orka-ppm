'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
// Import only the extensions we actually use instead of full StarterKit
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Menu,
  X,
  Save,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  MoreVertical,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

import { useMobilePMR } from '@/hooks/useMobilePMR'
import { useTouchGestures } from '@/hooks/useTouchGestures'
import type { PMRReport, PMRSection } from './types'

export interface MobilePMREditorProps {
  report: PMRReport
  onSave: (report: PMRReport) => void
  onSectionUpdate: (sectionId: string, content: any) => void
  className?: string
}

const MobilePMREditor: React.FC<MobilePMREditorProps> = ({
  report,
  onSave,
  onSectionUpdate,
  className = ''
}) => {
  const { state, actions, isOnline, lastSaveTime } = useMobilePMR({
    reportId: report.id,
    enableOfflineEditing: true,
    enableTouchGestures: true
  })

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSyncStatus, setShowSyncStatus] = useState(false)

  const currentSection = report.sections[currentSectionIndex]

  // Initialize editor
  const editor = useEditor({
    extensions: [
      // Core extensions (required)
      Document,
      Paragraph,
      Text,
      // Formatting extensions (minimal for mobile)
      Bold,
      Italic,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      // List extensions
      BulletList,
      OrderedList,
      ListItem,
      // History (undo/redo)
      History,
      // Placeholder
      Placeholder.configure({
        placeholder: 'Tap to start editing...',
      }),
    ],
    content: currentSection?.content || '',
    editable: true,
    onUpdate: ({ editor }) => {
      if (currentSection) {
        const content = editor.getJSON()
        onSectionUpdate(currentSection.section_id, content)
        
        // Save offline if not connected
        if (!isOnline) {
          actions.saveOffline(currentSection.section_id, content)
        }
      }
    },
  })

  // Update editor content when section changes
  useEffect(() => {
    if (editor && currentSection) {
      editor.commands.setContent(currentSection.content || '')
    }
  }, [currentSectionIndex, currentSection, editor])

  // Touch gestures for navigation
  const { elementRef } = useTouchGestures({
    onSwipe: (direction) => {
      if (direction === 'left' && currentSectionIndex < report.sections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1)
      } else if (direction === 'right' && currentSectionIndex > 0) {
        setCurrentSectionIndex(prev => prev - 1)
      } else if (direction === 'down' && window.scrollY === 0) {
        // Pull to refresh
        actions.syncOfflineChanges()
        setShowSyncStatus(true)
        setTimeout(() => setShowSyncStatus(false), 2000)
      }
    },
    onLongPress: () => {
      setShowMenu(true)
    }
  }, {
    swipeThreshold: 50,
    longPressDuration: 500,
    hapticFeedback: true
  })

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(report)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }, [onSave, report])

  // Navigate sections
  const goToPreviousSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1)
    }
  }, [currentSectionIndex])

  const goToNextSection = useCallback(() => {
    if (currentSectionIndex < report.sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1)
    }
  }, [currentSectionIndex, report.sections.length])

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    actions.setViewMode(state.viewMode === 'compact' ? 'expanded' : 'compact')
  }, [actions, state.viewMode])

  return (
    <div 
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`flex flex-col h-full bg-gray-50 dark:bg-slate-800/50 ${className}`}
    >
      {/* Mobile Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md"
          >
            {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex-1 mx-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
              {report.title}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-slate-400">
              <span>{currentSectionIndex + 1} / {report.sections.length}</span>
              {!isOnline && (
                <span className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {state.pendingChanges > 0 && (
              <button
                onClick={() => actions.syncOfflineChanges()}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md"
                disabled={!isOnline}
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving || !isOnline}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {showSyncStatus && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2 text-sm text-blue-900">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Syncing changes...</span>
            </div>
          </div>
        )}

        {/* Offline Mode Banner */}
        {!isOnline && (
          <div className="px-3 py-2 bg-orange-50 border-t border-orange-200">
            <div className="flex items-center space-x-2 text-sm text-orange-900">
              <WifiOff className="h-4 w-4" />
              <span>Working offline - changes will sync when connected</span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu Drawer */}
      {showMenu && (
        <div className="absolute top-14 left-0 right-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-lg z-10">
          <div className="p-4 space-y-3">
            <button
              onClick={() => {
                actions.togglePanel('insights')
                setShowMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 rounded-md"
            >
              <Sparkles className="h-5 w-5" />
              <span>AI Insights</span>
            </button>

            <button
              onClick={() => {
                actions.togglePanel('collaboration')
                setShowMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 rounded-md"
            >
              <Users className="h-5 w-5" />
              <span>Collaboration</span>
            </button>

            <button
              onClick={() => {
                toggleViewMode()
                setShowMenu(false)
              }}
              className="w-full flex items-center space-x-3 p-3 text-left text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 rounded-md"
            >
              {state.viewMode === 'compact' ? (
                <Maximize2 className="h-5 w-5" />
              ) : (
                <Minimize2 className="h-5 w-5" />
              )}
              <span>{state.viewMode === 'compact' ? 'Expanded View' : 'Compact View'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Section Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 py-2">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousSection}
            disabled={currentSectionIndex === 0}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 mx-3 text-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
              {currentSection?.title}
            </h3>
            {currentSection?.ai_generated && (
              <span className="inline-flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400 mt-1">
                <Sparkles className="h-3 w-3" />
                <span>AI Generated</span>
              </span>
            )}
          </div>

          <button
            onClick={goToNextSection}
            disabled={currentSectionIndex === report.sections.length - 1}
            className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Section Progress Dots */}
        <div className="flex justify-center space-x-1 mt-2">
          {report.sections.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSectionIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSectionIndex
                  ? 'w-6 bg-blue-600'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${state.viewMode === 'compact' ? 'p-4' : 'p-6'}`}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-h-[400px]">
            <div className={`prose max-w-none ${state.viewMode === 'compact' ? 'p-4' : 'p-6'}`}>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Section Metadata */}
          {currentSection && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Last modified: {new Date(currentSection.last_modified).toLocaleString()}</span>
                {currentSection.confidence_score && (
                  <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-full">
                    {Math.round(currentSection.confidence_score * 100)}% confidence
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Footer - Quick Actions */}
      {!state.keyboardVisible && (
        <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-3 safe-area-bottom">
          <div className="flex items-center justify-around">
            <button
              onClick={() => actions.togglePanel('insights')}
              className={`flex flex-col items-center space-y-1 p-2 rounded-md ${
                state.activePanel === 'insights'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-slate-400'
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-xs">Insights</span>
            </button>

            <button
              onClick={() => actions.togglePanel('collaboration')}
              className={`flex flex-col items-center space-y-1 p-2 rounded-md ${
                state.activePanel === 'collaboration'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-slate-400'
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs">Team</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !isOnline}
              className="flex flex-col items-center space-y-1 p-2 rounded-md text-blue-600 dark:text-blue-400 disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              <span className="text-xs">Save</span>
            </button>

            <button
              className="flex flex-col items-center space-y-1 p-2 rounded-md text-gray-600 dark:text-slate-400"
            >
              <MoreVertical className="h-5 w-5" />
              <span className="text-xs">More</span>
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="fixed bottom-20 right-4 z-30">
        {isOnline ? (
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-700 text-white rounded-full shadow-lg text-xs">
            <Wifi className="h-4 w-4" />
            <span>Online</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 px-3 py-2 bg-orange-800 text-white rounded-full shadow-lg text-xs">
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default MobilePMREditor
