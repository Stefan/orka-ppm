/**
 * CollaborationPanel Component
 * 
 * Displays real-time collaboration features including:
 * - Active user presence
 * - Live editing indicators
 * - Comment system
 * - Conflict resolution interface
 */

'use client'

import React, { useState, useMemo } from 'react'
import { 
  Users, 
  MessageSquare, 
  AlertTriangle,
  CheckCircle,
  X,
  Send,
  MoreVertical,
  Clock,
  Eye,
  Edit3
} from 'lucide-react'
import { useTranslations } from '../../lib/i18n/context'
import type { Comment, Conflict } from './types'
import type { ActiveUser } from '../../hooks/useRealtimePMR'

export interface CollaborationPanelProps {
  activeUsers: ActiveUser[]
  comments: Comment[]
  conflicts: Conflict[]
  currentUserId: string
  onAddComment: (sectionId: string, content: string, position?: { x: number; y: number }) => void
  onResolveComment: (commentId: string) => void
  onResolveConflict: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual', selectedContent?: any) => void
  className?: string
}

export default function CollaborationPanel({
  activeUsers,
  comments,
  conflicts,
  currentUserId,
  onAddComment,
  onResolveComment,
  onResolveConflict,
  className = ''
}: CollaborationPanelProps) {
  const { t } = useTranslations()
  const [activeTab, setActiveTab] = useState<'users' | 'comments' | 'conflicts'>('users')
  const [newCommentContent, setNewCommentContent] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null)

  // Filter unresolved comments and conflicts
  const unresolvedComments = useMemo(() => 
    comments.filter(c => !c.resolved),
    [comments]
  )

  const unresolvedConflicts = useMemo(() => 
    conflicts.filter(c => !c.resolved),
    [conflicts]
  )

  // Handle comment submission
  const handleSubmitComment = () => {
    if (!newCommentContent.trim() || !selectedSection) return
    
    onAddComment(selectedSection, newCommentContent.trim())
    setNewCommentContent('')
  }

  // Handle conflict resolution
  const handleResolveConflict = (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual') => {
    const conflict = conflicts.find(c => c.id === conflictId)
    if (!conflict) return

    if (resolution === 'overwrite') {
      // Use the latest change
      const latestChange = conflict.conflicting_changes[conflict.conflicting_changes.length - 1]
      onResolveConflict(conflictId, resolution, latestChange.content)
    } else {
      onResolveConflict(conflictId, resolution)
    }
    
    setExpandedConflict(null)
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return t('pmr.collaboration.time.justNow')
    if (diffMins < 60) return t('pmr.collaboration.time.minutesAgo', { minutes: diffMins })
    if (diffMins < 1440) return t('pmr.collaboration.time.hoursAgo', { hours: Math.floor(diffMins / 60) })
    return date.toLocaleDateString()
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          {t('pmr.collaboration.title')}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{t('pmr.collaboration.tabs.users')}</span>
            {activeUsers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                {activeUsers.length}
              </span>
            )}
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <MessageSquare className="h-4 w-4" />
            <span>{t('pmr.collaboration.tabs.comments')}</span>
            {unresolvedComments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full">
                {unresolvedComments.length}
              </span>
            )}
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'conflicts'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('pmr.collaboration.tabs.conflicts')}</span>
            {unresolvedConflicts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-full">
                {unresolvedConflicts.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {activeUsers.length > 0 ? (
              activeUsers.map(user => (
                <div 
                  key={user.id} 
                  className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">{t('pmr.collaboration.users.you')}</span>
                      )}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('pmr.collaboration.users.active', { time: formatTimestamp(user.lastActivity) })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-slate-400">{t('pmr.collaboration.users.noUsers')}</p>
              </div>
            )}
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Add Comment Form */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
              <input
                type="text"
                placeholder={t('pmr.collaboration.comments.sectionPlaceholder')}
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder={t('pmr.collaboration.comments.addPlaceholder')}
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitComment()
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newCommentContent.trim() || !selectedSection}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Send className="h-4 w-4" />
                <span>{t('pmr.collaboration.comments.sendComment')}</span>
              </button>
            </div>

            {/* Comments List */}
            {unresolvedComments.length > 0 ? (
              <div className="space-y-3">
                {unresolvedComments.map(comment => (
                  <div 
                    key={comment.id}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {comment.user_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {comment.section_id && t('pmr.collaboration.comments.on', { section: comment.section_id })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {formatTimestamp(comment.created_at)}
                        </span>
                        {comment.user_id === currentUserId && (
                          <button
                            onClick={() => onResolveComment(comment.id)}
                            className="p-1 text-gray-400 dark:text-slate-500 hover:text-green-600 transition-colors"
                            title={t('pmr.collaboration.comments.resolveComment')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-slate-400">{t('pmr.collaboration.comments.noComments')}</p>
              </div>
            )}
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            {unresolvedConflicts.length > 0 ? (
              unresolvedConflicts.map(conflict => (
                <div 
                  key={conflict.id}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">
                          {conflict.conflict_type === 'simultaneous_edit' && t('pmr.collaboration.conflicts.types.simultaneousEdit')}
                          {conflict.conflict_type === 'version_mismatch' && t('pmr.collaboration.conflicts.types.versionMismatch')}
                          {conflict.conflict_type === 'permission_conflict' && t('pmr.collaboration.conflicts.types.permissionConflict')}
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          {t('pmr.collaboration.conflicts.section', { section: conflict.section_id })}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {t('pmr.collaboration.conflicts.usersConflicting', { count: conflict.conflicting_users.length })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedConflict(
                        expandedConflict === conflict.id ? null : conflict.id
                      )}
                      className="p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {expandedConflict === conflict.id && (
                    <div className="space-y-3 pt-3 border-t border-red-200 dark:border-red-800">
                      {/* Show conflicting changes */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-red-900">{t('pmr.collaboration.conflicts.conflictingChanges')}</p>
                        {conflict.conflicting_changes.map((change, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 rounded p-2 text-xs">
                            <p className="font-medium text-gray-900 dark:text-slate-100">{t('pmr.collaboration.conflicts.user', { userId: change.user_id })}</p>
                            <p className="text-gray-600 dark:text-slate-400 mt-1">
                              {formatTimestamp(change.timestamp)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Resolution options */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-red-900">{t('pmr.collaboration.conflicts.resolve')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'overwrite')}
                            className="px-3 py-2 bg-white dark:bg-slate-800 text-red-700 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 text-xs font-medium"
                          >
                            {t('pmr.collaboration.conflicts.useLatest')}
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'merge')}
                            className="px-3 py-2 bg-white dark:bg-slate-800 text-red-700 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 text-xs font-medium"
                          >
                            {t('pmr.collaboration.conflicts.mergeChanges')}
                          </button>
                        </div>
                        <button
                          onClick={() => handleResolveConflict(conflict.id, 'manual')}
                          className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                        >
                          {t('pmr.collaboration.conflicts.resolveManually')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-slate-400">{t('pmr.collaboration.conflicts.noConflicts')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Users className="h-3 w-3 mr-1" />
              {t('pmr.collaboration.footer.online', { count: activeUsers.length })}
            </span>
            <span className="flex items-center">
              <MessageSquare className="h-3 w-3 mr-1" />
              {t('pmr.collaboration.footer.comments', { count: unresolvedComments.length })}
            </span>
          </div>
          {unresolvedConflicts.length > 0 && (
            <span className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {t('pmr.collaboration.footer.conflicts', { count: unresolvedConflicts.length })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
