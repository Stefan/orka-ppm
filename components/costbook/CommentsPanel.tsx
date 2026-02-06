'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  ThumbsUp,
  AlertTriangle,
  HelpCircle,
  Reply,
  MessageSquare,
  Loader2,
  User
} from 'lucide-react'
import {
  ExtendedComment,
  CommentReaction,
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  formatRelativeTime,
  extractMentions
} from '@/lib/comments-service'

export interface CommentsPanelProps {
  /** Project ID to fetch comments for */
  projectId: string
  /** Project name for display */
  projectName?: string
  /** Whether panel is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** On comment count change */
  onCommentCountChange?: (count: number) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Comments panel component
 * Displays and manages comments for a project
 */
export function CommentsPanel({
  projectId,
  projectName,
  isOpen,
  onClose,
  onCommentCountChange,
  className = ''
}: CommentsPanelProps) {
  const [comments, setComments] = useState<ExtendedComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Fetch comments
  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchComments({ 
        project_id: projectId,
        parent_id: null // Only top-level comments
      })
      setComments(data)
      onCommentCountChange?.(data.length)
    } catch (err) {
      setError('Failed to load comments')
      console.error('Error loading comments:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, onCommentCountChange])
  
  useEffect(() => {
    if (isOpen) {
      loadComments()
    }
  }, [isOpen, loadComments])
  
  // Handle submit new comment
  const handleSubmit = async () => {
    if (!newComment.trim()) return
    
    try {
      setSubmitting(true)
      setError(null)
      
      const mentions = extractMentions(newComment)
      
      await createComment({
        project_id: projectId,
        content: newComment.trim(),
        mentions,
        parent_id: replyingTo || undefined
      })
      
      setNewComment('')
      setReplyingTo(null)
      await loadComments()
    } catch (err) {
      setError('Failed to post comment')
      console.error('Error creating comment:', err)
    } finally {
      setSubmitting(false)
    }
  }
  
  // Handle edit comment
  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return
    
    try {
      setSubmitting(true)
      setError(null)
      
      const mentions = extractMentions(editContent)
      
      await updateComment(commentId, {
        content: editContent.trim(),
        mentions
      })
      
      setEditingComment(null)
      setEditContent('')
      await loadComments()
    } catch (err) {
      setError('Failed to update comment')
      console.error('Error updating comment:', err)
    } finally {
      setSubmitting(false)
    }
  }
  
  // Handle delete comment
  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    
    try {
      setError(null)
      await deleteComment(commentId)
      await loadComments()
    } catch (err) {
      setError('Failed to delete comment')
      console.error('Error deleting comment:', err)
    }
  }
  
  // Handle reaction
  const handleReaction = async (commentId: string, type: CommentReaction['type']) => {
    try {
      await addReaction(commentId, type)
      await loadComments()
    } catch (err) {
      console.error('Error adding reaction:', err)
    }
  }
  
  // Start editing a comment
  const startEditing = (comment: ExtendedComment) => {
    setEditingComment(comment.id)
    setEditContent(comment.content)
  }
  
  // Start replying to a comment
  const startReply = (commentId: string) => {
    setReplyingTo(commentId)
    inputRef.current?.focus()
  }
  
  if (!isOpen) return null
  
  return (
    <div 
      className={`
        fixed inset-y-0 right-0 w-full max-w-md
        bg-white dark:bg-slate-800 shadow-xl border-l border-gray-200 dark:border-slate-700
        flex flex-col z-50
        animate-in slide-in-from-right duration-200
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-slate-100">Comments</h2>
          {projectName && (
            <p className="text-sm text-gray-500 dark:text-slate-400">{projectName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}
      
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-gray-400 dark:text-slate-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isEditing={editingComment === comment.id}
              editContent={editContent}
              onEditChange={setEditContent}
              onSaveEdit={() => handleEdit(comment.id)}
              onCancelEdit={() => {
                setEditingComment(null)
                setEditContent('')
              }}
              onStartEdit={() => startEditing(comment)}
              onDelete={() => handleDelete(comment.id)}
              onReaction={handleReaction}
              onReply={() => startReply(comment.id)}
              submitting={submitting}
            />
          ))
        )}
      </div>
      
      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <span className="text-sm text-blue-600 dark:text-blue-400">
            Replying to comment...
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment... Use @username to mention"
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit()
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Press ⌘+Enter to send
        </p>
      </div>
    </div>
  )
}

/**
 * Individual comment item component
 */
interface CommentItemProps {
  comment: ExtendedComment
  isEditing: boolean
  editContent: string
  onEditChange: (content: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onStartEdit: () => void
  onDelete: () => void
  onReaction: (commentId: string, type: CommentReaction['type']) => void
  onReply: () => void
  submitting: boolean
}

function CommentItem({
  comment,
  isEditing,
  editContent,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onReaction,
  onReply,
  submitting
}: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const reactionCounts = {
    like: comment.reactions?.filter(r => r.type === 'like').length || 0,
    helpful: comment.reactions?.filter(r => r.type === 'helpful').length || 0,
    important: comment.reactions?.filter(r => r.type === 'important').length || 0
  }
  
  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            {comment.author_avatar ? (
              <img 
                src={comment.author_avatar} 
                alt={comment.author_name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <User className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {comment.author_name}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <span>{formatRelativeTime(comment.created_at)}</span>
              {comment.is_edited && <span>(edited)</span>}
            </div>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={() => {
                  onStartEdit()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              disabled={submitting}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
          {comment.content}
        </p>
      )}
      
      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-200 dark:border-slate-700">
          {/* Reactions */}
          <button
            onClick={() => onReaction(comment.id, 'like')}
            className={`flex items-center gap-1 text-xs transition-colors ${
              reactionCounts.like > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500 hover:text-blue-600'
            }`}
          >
            <ThumbsUp className="w-3 h-3" />
            {reactionCounts.like > 0 && <span>{reactionCounts.like}</span>}
          </button>
          
          <button
            onClick={() => onReaction(comment.id, 'helpful')}
            className={`flex items-center gap-1 text-xs transition-colors ${
              reactionCounts.helpful > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500 hover:text-green-600'
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            {reactionCounts.helpful > 0 && <span>{reactionCounts.helpful}</span>}
          </button>
          
          <button
            onClick={() => onReaction(comment.id, 'important')}
            className={`flex items-center gap-1 text-xs transition-colors ${
              reactionCounts.important > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-slate-500 hover:text-orange-600'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {reactionCounts.important > 0 && <span>{reactionCounts.important}</span>}
          </button>
          
          <button
            onClick={onReply}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors ml-auto"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
        </div>
      )}
      
      {/* Reply count */}
      {comment.reply_count > 0 && (
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
        </div>
      )}
    </div>
  )
}

export default CommentsPanel
