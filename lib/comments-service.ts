// Comments Service for Costbook
// Phase 3: Collaborative comments functionality

import { Comment } from '@/types/costbook'

/**
 * Extended comment interface with additional fields
 */
export interface ExtendedComment extends Comment {
  /** Author name for display */
  author_name: string
  /** Author avatar URL */
  author_avatar?: string
  /** Number of replies */
  reply_count: number
  /** Whether comment has been edited */
  is_edited: boolean
  /** Parent comment ID for threading */
  parent_id?: string
  /** Reactions on the comment */
  reactions?: CommentReaction[]
}

/**
 * Comment reaction
 */
export interface CommentReaction {
  type: 'like' | 'helpful' | 'important'
  user_id: string
  created_at: string
}

/**
 * Comment creation input
 */
export interface CreateCommentInput {
  project_id: string
  content: string
  mentions?: string[]
  parent_id?: string
}

/**
 * Comment update input
 */
export interface UpdateCommentInput {
  content: string
  mentions?: string[]
}

/**
 * Comments filter options
 */
export interface CommentsFilter {
  project_id?: string
  user_id?: string
  parent_id?: string | null
  sort_by?: 'newest' | 'oldest' | 'most_reactions'
  limit?: number
  offset?: number
}

// Mock data storage (in-memory for development)
let mockComments: ExtendedComment[] = [
  {
    id: 'comment-1',
    project_id: 'proj-001',
    user_id: 'user-1',
    content: 'Budget review completed. All expenses are within expected range for Q1.',
    mentions: [],
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: 'Sarah Johnson',
    author_avatar: undefined,
    reply_count: 1,
    is_edited: false,
    reactions: [
      { type: 'helpful', user_id: 'user-2', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'comment-2',
    project_id: 'proj-001',
    user_id: 'user-2',
    content: 'Thanks for the update! Should we schedule a follow-up meeting to discuss the vendor contracts?',
    mentions: ['user-1'],
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: 'Michael Chen',
    author_avatar: undefined,
    reply_count: 0,
    is_edited: false,
    parent_id: 'comment-1'
  },
  {
    id: 'comment-3',
    project_id: 'proj-001',
    user_id: 'user-3',
    content: 'Important: We need to review the cost overrun in the infrastructure category. Please prioritize.',
    mentions: ['user-1', 'user-2'],
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    author_name: 'Emily Davis',
    author_avatar: undefined,
    reply_count: 0,
    is_edited: false,
    reactions: [
      { type: 'important', user_id: 'user-1', created_at: new Date().toISOString() },
      { type: 'important', user_id: 'user-2', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'comment-4',
    project_id: 'proj-002',
    user_id: 'user-1',
    content: 'This project is on track. Great work team!',
    mentions: [],
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: 'Sarah Johnson',
    author_avatar: undefined,
    reply_count: 0,
    is_edited: false,
    reactions: [
      { type: 'like', user_id: 'user-2', created_at: new Date().toISOString() },
      { type: 'like', user_id: 'user-3', created_at: new Date().toISOString() }
    ]
  },
  {
    id: 'comment-5',
    project_id: 'proj-003',
    user_id: 'user-2',
    content: 'Warning: Vendor ABC has delayed delivery by 2 weeks. This will impact our timeline.',
    mentions: ['user-1'],
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    author_name: 'Michael Chen',
    author_avatar: undefined,
    reply_count: 0,
    is_edited: false,
    reactions: []
  }
]

// Mock current user
const CURRENT_USER = {
  id: 'current-user',
  name: 'Current User'
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Fetch comments for a project
 */
export async function fetchComments(
  filter: CommentsFilter = {}
): Promise<ExtendedComment[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  let filtered = [...mockComments]
  
  if (filter.project_id) {
    filtered = filtered.filter(c => c.project_id === filter.project_id)
  }
  
  if (filter.user_id) {
    filtered = filtered.filter(c => c.user_id === filter.user_id)
  }
  
  if (filter.parent_id !== undefined) {
    filtered = filtered.filter(c => c.parent_id === filter.parent_id)
  }
  
  // Sort
  switch (filter.sort_by) {
    case 'oldest':
      filtered.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      break
    case 'most_reactions':
      filtered.sort((a, b) => 
        (b.reactions?.length || 0) - (a.reactions?.length || 0)
      )
      break
    case 'newest':
    default:
      filtered.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
  }
  
  // Pagination
  if (filter.offset) {
    filtered = filtered.slice(filter.offset)
  }
  if (filter.limit) {
    filtered = filtered.slice(0, filter.limit)
  }
  
  return filtered
}

/**
 * Fetch comment count for a project
 */
export async function fetchCommentCount(projectId: string): Promise<number> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return mockComments.filter(c => c.project_id === projectId).length
}

/**
 * Fetch comments count for multiple projects
 */
export async function fetchCommentsCountBatch(
  projectIds: string[]
): Promise<Map<string, number>> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const counts = new Map<string, number>()
  
  for (const projectId of projectIds) {
    const count = mockComments.filter(c => c.project_id === projectId).length
    counts.set(projectId, count)
  }
  
  return counts
}

/**
 * Create a new comment
 */
export async function createComment(
  input: CreateCommentInput
): Promise<ExtendedComment> {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  const now = new Date().toISOString()
  
  const newComment: ExtendedComment = {
    id: generateId(),
    project_id: input.project_id,
    user_id: CURRENT_USER.id,
    content: input.content,
    mentions: input.mentions || [],
    created_at: now,
    updated_at: now,
    author_name: CURRENT_USER.name,
    author_avatar: undefined,
    reply_count: 0,
    is_edited: false,
    parent_id: input.parent_id,
    reactions: []
  }
  
  mockComments.unshift(newComment)
  
  // Update parent reply count if this is a reply
  if (input.parent_id) {
    const parent = mockComments.find(c => c.id === input.parent_id)
    if (parent) {
      parent.reply_count++
    }
  }
  
  return newComment
}

/**
 * Update an existing comment
 */
export async function updateComment(
  commentId: string,
  input: UpdateCommentInput
): Promise<ExtendedComment> {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  const index = mockComments.findIndex(c => c.id === commentId)
  
  if (index === -1) {
    throw new Error('Comment not found')
  }
  
  const comment = mockComments[index]
  
  // Check ownership (in real app would be server-side)
  if (comment.user_id !== CURRENT_USER.id) {
    throw new Error('Cannot edit comment from another user')
  }
  
  const updatedComment: ExtendedComment = {
    ...comment,
    content: input.content,
    mentions: input.mentions || comment.mentions,
    updated_at: new Date().toISOString(),
    is_edited: true
  }
  
  mockComments[index] = updatedComment
  
  return updatedComment
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  const index = mockComments.findIndex(c => c.id === commentId)
  
  if (index === -1) {
    throw new Error('Comment not found')
  }
  
  const comment = mockComments[index]
  
  // Check ownership
  if (comment.user_id !== CURRENT_USER.id) {
    throw new Error('Cannot delete comment from another user')
  }
  
  // Update parent reply count if this is a reply
  if (comment.parent_id) {
    const parent = mockComments.find(c => c.id === comment.parent_id)
    if (parent) {
      parent.reply_count = Math.max(0, parent.reply_count - 1)
    }
  }
  
  // Also delete all replies
  mockComments = mockComments.filter(c => 
    c.id !== commentId && c.parent_id !== commentId
  )
}

/**
 * Add a reaction to a comment
 */
export async function addReaction(
  commentId: string,
  reactionType: CommentReaction['type']
): Promise<ExtendedComment> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const comment = mockComments.find(c => c.id === commentId)
  
  if (!comment) {
    throw new Error('Comment not found')
  }
  
  // Check if user already reacted with same type
  const existingReaction = comment.reactions?.find(
    r => r.user_id === CURRENT_USER.id && r.type === reactionType
  )
  
  if (existingReaction) {
    // Remove reaction (toggle)
    comment.reactions = comment.reactions?.filter(
      r => !(r.user_id === CURRENT_USER.id && r.type === reactionType)
    )
  } else {
    // Add reaction
    if (!comment.reactions) {
      comment.reactions = []
    }
    comment.reactions.push({
      type: reactionType,
      user_id: CURRENT_USER.id,
      created_at: new Date().toISOString()
    })
  }
  
  return comment
}

/**
 * Remove a reaction from a comment
 */
export async function removeReaction(
  commentId: string,
  reactionType: CommentReaction['type']
): Promise<ExtendedComment> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const comment = mockComments.find(c => c.id === commentId)
  
  if (!comment) {
    throw new Error('Comment not found')
  }
  
  comment.reactions = comment.reactions?.filter(
    r => !(r.user_id === CURRENT_USER.id && r.type === reactionType)
  )
  
  return comment
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  
  return date.toLocaleDateString()
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = text.match(mentionRegex)
  return matches ? matches.map(m => m.slice(1)) : []
}

/**
 * Get comment summary for a project
 */
export async function getCommentSummary(projectId: string): Promise<{
  total: number
  recent: number
  hasImportant: boolean
  lastActivity: string | null
}> {
  const comments = await fetchComments({ project_id: projectId })
  
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  const recent = comments.filter(c => 
    new Date(c.created_at) > dayAgo
  ).length
  
  const hasImportant = comments.some(c => 
    c.reactions?.some(r => r.type === 'important')
  )
  
  const lastActivity = comments.length > 0 ? comments[0].created_at : null
  
  return {
    total: comments.length,
    recent,
    hasImportant,
    lastActivity
  }
}

export default fetchComments
