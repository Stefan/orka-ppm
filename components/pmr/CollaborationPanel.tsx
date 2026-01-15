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
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600" />
          Collaboration
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <Users className="h-4 w-4" />
            <span>Users</span>
            {activeUsers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                {activeUsers.length}
              </span>
            )}
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <MessageSquare className="h-4 w-4" />
            <span>Comments</span>
            {unresolvedComments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-600 rounded-full">
                {unresolvedComments.length}
              </span>
            )}
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'conflicts'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <AlertTriangle className="h-4 w-4" />
            <span>Conflicts</span>
            {unresolvedConflicts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
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
                  className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-500">(You)</span>
                      )}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    )}
                    <p className="text-xs text-gray-400 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      Active {formatTimestamp(user.lastActivity)}
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
                <p className="text-sm text-gray-500">No other users online</p>
              </div>
            )}
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Add Comment Form */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <input
                type="text"
                placeholder="Section ID (e.g., executive-summary)"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Add a comment..."
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitComment()
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newCommentContent.trim() || !selectedSection}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Send className="h-4 w-4" />
                <span>Send Comment</span>
              </button>
            </div>

            {/* Comments List */}
            {unresolvedComments.length > 0 ? (
              <div className="space-y-3">
                {unresolvedComments.map(comment => (
                  <div 
                    key={comment.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {comment.user_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {comment.section_id && `on ${comment.section_id}`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(comment.created_at)}
                        </span>
                        {comment.user_id === currentUserId && (
                          <button
                            onClick={() => onResolveComment(comment.id)}
                            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                            title="Resolve comment"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No comments yet</p>
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
                  className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">
                          {conflict.conflict_type === 'simultaneous_edit' && 'Simultaneous Edit Conflict'}
                          {conflict.conflict_type === 'version_mismatch' && 'Version Mismatch'}
                          {conflict.conflict_type === 'permission_conflict' && 'Permission Conflict'}
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          Section: {conflict.section_id}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {conflict.conflicting_users.length} users made conflicting changes
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedConflict(
                        expandedConflict === conflict.id ? null : conflict.id
                      )}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {expandedConflict === conflict.id && (
                    <div className="space-y-3 pt-3 border-t border-red-200">
                      {/* Show conflicting changes */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-red-900">Conflicting Changes:</p>
                        {conflict.conflicting_changes.map((change, idx) => (
                          <div key={idx} className="bg-white rounded p-2 text-xs">
                            <p className="font-medium text-gray-900">User: {change.user_id}</p>
                            <p className="text-gray-600 mt-1">
                              {formatTimestamp(change.timestamp)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Resolution options */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-red-900">Resolve Conflict:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'overwrite')}
                            className="px-3 py-2 bg-white text-red-700 border border-red-300 rounded hover:bg-red-50 text-xs font-medium"
                          >
                            Use Latest
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.id, 'merge')}
                            className="px-3 py-2 bg-white text-red-700 border border-red-300 rounded hover:bg-red-50 text-xs font-medium"
                          >
                            Merge Changes
                          </button>
                        </div>
                        <button
                          onClick={() => handleResolveConflict(conflict.id, 'manual')}
                          className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                        >
                          Resolve Manually
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No conflicts detected</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Users className="h-3 w-3 mr-1" />
              {activeUsers.length} online
            </span>
            <span className="flex items-center">
              <MessageSquare className="h-3 w-3 mr-1" />
              {unresolvedComments.length} comments
            </span>
          </div>
          {unresolvedConflicts.length > 0 && (
            <span className="flex items-center text-red-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {unresolvedConflicts.length} conflicts
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
