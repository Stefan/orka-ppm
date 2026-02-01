// Comments Service for Costbook
// Phase 3: Collaborative comments functionality
// Uses Supabase costbook_comments table when available and user is authenticated; falls back to mock.

import { Comment } from '@/types/costbook'

/** DB row shape for costbook_comments (Supabase) */
interface CostbookCommentRow {
  id: string
  project_id: string
  user_id: string
  content: string
  mentions: string[] | unknown
  parent_id: string | null
  created_at: string
  updated_at: string
}

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

// Mock current user (used when Supabase is unavailable or user not authenticated)
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
 * Map Supabase costbook_comments row to ExtendedComment.
 * Author name is placeholder when no profile join; reactions not stored in DB.
 */
function rowToExtendedComment(row: CostbookCommentRow, replyCount = 0): ExtendedComment {
  const mentions = Array.isArray(row.mentions) ? row.mentions : []
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    content: row.content,
    mentions,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_name: 'User',
    author_avatar: undefined,
    reply_count: replyCount,
    is_edited: row.updated_at !== row.created_at,
    parent_id: row.parent_id ?? undefined,
    reactions: []
  }
}

/**
 * Get Supabase client and current user id for comments. Returns null if not authenticated.
 */
async function getSupabaseAuth(): Promise<{ supabase: Awaited<ReturnType<typeof import('@/lib/api/supabase')['supabase']>>; userId: string } | null> {
  try {
    const { supabase } = await import('@/lib/api/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return null
    return { supabase, userId: session.user.id }
  } catch {
    return null
  }
}

/**
 * Fetch comments for a project
 */
export async function fetchComments(
  filter: CommentsFilter = {}
): Promise<ExtendedComment[]> {
  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      let query = auth.supabase
        .from('costbook_comments')
        .select('id, project_id, user_id, content, mentions, parent_id, created_at, updated_at')
      if (filter.project_id) query = query.eq('project_id', filter.project_id)
      if (filter.user_id) query = query.eq('user_id', filter.user_id)
      if (filter.parent_id !== undefined) {
        query = filter.parent_id == null ? query.is('parent_id', null) : query.eq('parent_id', filter.parent_id)
      }
      const order = filter.sort_by === 'oldest' ? { ascending: true } : { ascending: false }
      query = query.order('created_at', order)
      if (filter.offset) query = query.range(filter.offset, filter.offset + (filter.limit ?? 100) - 1)
      else if (filter.limit) query = query.limit(filter.limit)
      const { data: rows, error } = await query
      if (error) throw error
      const comments = (rows as CostbookCommentRow[] | null) ?? []
      const replyCounts = new Map<string, number>()
      if (comments.length > 0) {
        const ids = comments.map(c => c.id)
        const { data: replyRows } = await auth.supabase
          .from('costbook_comments')
          .select('parent_id')
          .in('parent_id', ids)
        for (const r of (replyRows as { parent_id: string }[] | null) ?? []) {
          if (r?.parent_id) replyCounts.set(r.parent_id, (replyCounts.get(r.parent_id) ?? 0) + 1)
        }
      }
      return comments.map(row => rowToExtendedComment(row, replyCounts.get(row.id) ?? 0))
    } catch {
      // Fall through to mock
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200))
  let filtered = [...mockComments]
  if (filter.project_id) filtered = filtered.filter(c => c.project_id === filter.project_id)
  if (filter.user_id) filtered = filtered.filter(c => c.user_id === filter.user_id)
  if (filter.parent_id !== undefined) filtered = filtered.filter(c => c.parent_id === filter.parent_id)
  switch (filter.sort_by) {
    case 'oldest':
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      break
    case 'most_reactions':
      filtered.sort((a, b) => (b.reactions?.length || 0) - (a.reactions?.length || 0))
      break
    default:
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  if (filter.offset) filtered = filtered.slice(filter.offset)
  if (filter.limit) filtered = filtered.slice(0, filter.limit)
  return filtered
}

/**
 * Fetch comment count for a project
 */
export async function fetchCommentCount(projectId: string): Promise<number> {
  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      const { count, error } = await auth.supabase
        .from('costbook_comments')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
      if (!error) return count ?? 0
    } catch {
      // fall through to mock
    }
  }
  await new Promise(resolve => setTimeout(resolve, 100))
  return mockComments.filter(c => c.project_id === projectId).length
}

/**
 * Fetch comments count for multiple projects
 */
export async function fetchCommentsCountBatch(
  projectIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (projectIds.length === 0) return counts

  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      const { data, error } = await auth.supabase
        .from('costbook_comments')
        .select('project_id')
        .in('project_id', projectIds)
      if (!error && data) {
        for (const pid of projectIds) counts.set(pid, 0)
        for (const row of data as { project_id: string }[]) {
          counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1)
        }
        return counts
      }
    } catch {
      // fall through to mock
    }
  }
  await new Promise(resolve => setTimeout(resolve, 100))
  for (const projectId of projectIds) {
    counts.set(projectId, mockComments.filter(c => c.project_id === projectId).length)
  }
  return counts
}

/**
 * Create a new comment
 */
export async function createComment(
  input: CreateCommentInput
): Promise<ExtendedComment> {
  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      const { data: row, error } = await auth.supabase
        .from('costbook_comments')
        .insert({
          project_id: input.project_id,
          user_id: auth.userId,
          content: input.content,
          mentions: input.mentions ?? [],
          parent_id: input.parent_id ?? null
        })
        .select('id, project_id, user_id, content, mentions, parent_id, created_at, updated_at')
        .single()
      if (!error && row) return rowToExtendedComment(row as CostbookCommentRow, 0)
    } catch {
      // fall through to mock
    }
  }

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
  if (input.parent_id) {
    const parent = mockComments.find(c => c.id === input.parent_id)
    if (parent) parent.reply_count++
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
  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      const { data: row, error } = await auth.supabase
        .from('costbook_comments')
        .update({
          content: input.content,
          mentions: input.mentions ?? []
        })
        .eq('id', commentId)
        .eq('user_id', auth.userId)
        .select('id, project_id, user_id, content, mentions, parent_id, created_at, updated_at')
        .single()
      if (!error && row) return rowToExtendedComment(row as CostbookCommentRow, 0)
      if (error?.code === 'PGRST116') throw new Error('Comment not found')
    } catch (e) {
      if (e instanceof Error && e.message === 'Comment not found') throw e
      // fall through to mock
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200))
  const index = mockComments.findIndex(c => c.id === commentId)
  if (index === -1) throw new Error('Comment not found')
  const comment = mockComments[index]
  if (comment.user_id !== CURRENT_USER.id) throw new Error('Cannot edit comment from another user')
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
  const auth = await getSupabaseAuth()
  if (auth) {
    try {
      const { error } = await auth.supabase
        .from('costbook_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', auth.userId)
      if (!error) return
      if (error?.code === 'PGRST116') throw new Error('Comment not found')
    } catch (e) {
      if (e instanceof Error && e.message === 'Comment not found') throw e
      // fall through to mock
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200))
  const index = mockComments.findIndex(c => c.id === commentId)
  if (index === -1) throw new Error('Comment not found')
  const comment = mockComments[index]
  if (comment.user_id !== CURRENT_USER.id) throw new Error('Cannot delete comment from another user')
  if (comment.parent_id) {
    const parent = mockComments.find(c => c.id === comment.parent_id)
    if (parent) parent.reply_count = Math.max(0, parent.reply_count - 1)
  }
  mockComments = mockComments.filter(c => c.id !== commentId && c.parent_id !== commentId)
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
 * Extract mentions from text (@username)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = text.match(mentionRegex)
  return matches ? matches.map(m => m.slice(1)) : []
}

/**
 * Task 46.4: Notify mentioned users (Phase 3).
 * Stub: in a full implementation would send in-app or email notifications.
 */
export async function notifyMentionedUsers(
  _commentId: string,
  _mentionedUserIds: string[],
  _authorId: string,
  _projectId: string,
  _contentSnippet: string
): Promise<void> {
  if (_mentionedUserIds.length === 0) return
  // Stub: would call backend / notifications service to create notifications for each user
  await new Promise(resolve => setTimeout(resolve, 50))
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
