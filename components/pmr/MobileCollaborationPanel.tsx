'use client'

import React, { useState, useCallback } from 'react'
import {
  Users,
  MessageSquare,
  X,
  Send,
  MoreVertical,
  Circle,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

import type { ActiveUser } from '@/hooks/useRealtimePMR'
import type { Comment, Conflict } from '@/components/pmr/types'

export interface MobileCollaborationPanelProps {
  activeUsers: ActiveUser[]
  comments: Comment[]
  conflicts: Conflict[]
  onAddComment: (content: string, sectionId?: string) => void
  onResolveComment: (commentId: string) => void
  onResolveConflict: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual') => void
  onClose: () => void
  currentSectionId?: string
  className?: string
}

const MobileCollaborationPanel: React.FC<MobileCollaborationPanelProps> = ({
  activeUsers,
  comments,
  conflicts,
  onAddComment,
  onResolveComment,
  onResolveConflict,
  onClose,
  currentSectionId,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'comments' | 'conflicts'>('users')
  const [commentText, setCommentText] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)

  // Filter comments for current section
  const sectionComments = currentSectionId
    ? comments.filter(c => c.section_id === currentSectionId)
    : comments

  // Filter unresolved comments
  const unresolvedComments = sectionComments.filter(c => !c.resolved)

  // Handle comment submission
  const handleSubmitComment = useCallback(() => {
    if (commentText.trim()) {
      onAddComment(commentText, currentSectionId)
      setCommentText('')
      setShowCommentInput(false)
    }
  }, [commentText, currentSectionId, onAddComment])

  // Get user status color
  const getUserStatusColor = (lastActivity: string) => {
    const lastActivityTime = new Date(lastActivity).getTime()
    const now = Date.now()
    const diff = now - lastActivityTime

    if (diff < 60000) return 'bg-green-500' // Active (< 1 min)
    if (diff < 300000) return 'bg-yellow-500' // Idle (< 5 min)
    return 'bg-gray-400' // Away
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Collaboration</h2>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-md"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-14 z-10">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Team</span>
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
              {activeUsers.length}
            </span>
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
          <div className="flex items-center justify-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Comments</span>
            {unresolvedComments.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
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
          <div className="flex items-center justify-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>Conflicts</span>
            {conflicts.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-full">
                {conflicts.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Users Tab */}
        {activeTab === 'users' && (
          <div className="p-4 space-y-3">
            {activeUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg"
              >
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getUserStatusColor(user.lastActivity)}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {user.name}
                  </h4>
                  {user.email && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user.email}</p>
                  )}
                </div>

                <button className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            ))}

            {activeUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">No active users</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Other team members will appear here when they join
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sectionComments.map(comment => (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg ${
                    comment.resolved ? 'bg-gray-50 dark:bg-slate-800/50' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                        {comment.user_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-slate-100">
                        {comment.user_name}
                      </span>
                    </div>
                    {comment.resolved ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <button
                        onClick={() => onResolveComment(comment.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                      >
                        Resolve
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">{comment.content}</p>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                    <span>{new Date(comment.created_at).toLocaleString()}</span>
                    {comment.resolved && comment.resolved_at && (
                      <span className="text-green-600 dark:text-green-400">
                        Resolved {new Date(comment.resolved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {sectionComments.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">No comments yet</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Start a conversation with your team
                  </p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="border-t border-gray-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
              {showCommentInput ? (
                <div className="space-y-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim()}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                      <span>Send</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCommentInput(false)
                        setCommentText('')
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCommentInput(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-400 bg-blue-50 rounded-md hover:bg-blue-100 dark:bg-blue-900/30"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Add Comment</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div className="p-4 space-y-3">
            {conflicts.map(conflict => (
              <div
                key={conflict.id}
                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <div className="flex items-start space-x-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 mb-1">
                      Editing Conflict
                    </h4>
                    <p className="text-xs text-red-700 mb-2">
                      Multiple users edited the same section simultaneously
                    </p>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      Conflicting users: {conflict.conflicting_users.join(', ')}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => onResolveConflict(conflict.id, 'merge')}
                    className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/30 rounded-md hover:bg-blue-200"
                  >
                    Merge Changes
                  </button>
                  <button
                    onClick={() => onResolveConflict(conflict.id, 'overwrite')}
                    className="w-full px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 dark:bg-orange-900/30 rounded-md hover:bg-orange-200"
                  >
                    Use My Version
                  </button>
                  <button
                    onClick={() => onResolveConflict(conflict.id, 'manual')}
                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
                  >
                    Resolve Manually
                  </button>
                </div>
              </div>
            ))}

            {conflicts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle className="h-12 w-12 text-green-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">No conflicts</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  All changes are synchronized
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileCollaborationPanel
