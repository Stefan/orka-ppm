// Tests for Comments Service
// Phase 3: Collaborative comments functionality

import * as fc from 'fast-check'
import {
  fetchComments,
  fetchCommentCount,
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  formatRelativeTime,
  extractMentions,
  getCommentSummary,
  ExtendedComment,
  CreateCommentInput
} from '@/lib/comments-service'

describe('Comments Service', () => {
  describe('fetchComments', () => {
    it('should fetch all comments without filter', async () => {
      const comments = await fetchComments()
      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBeGreaterThan(0)
    })

    it('should filter comments by project ID', async () => {
      const comments = await fetchComments({ project_id: 'proj-001' })
      expect(comments.every(c => c.project_id === 'proj-001')).toBe(true)
    })

    it('should sort by newest first by default', async () => {
      const comments = await fetchComments()
      for (let i = 1; i < comments.length; i++) {
        const prev = new Date(comments[i - 1].created_at).getTime()
        const curr = new Date(comments[i].created_at).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    })

    it('should sort by oldest first when specified', async () => {
      const comments = await fetchComments({ sort_by: 'oldest' })
      for (let i = 1; i < comments.length; i++) {
        const prev = new Date(comments[i - 1].created_at).getTime()
        const curr = new Date(comments[i].created_at).getTime()
        expect(prev).toBeLessThanOrEqual(curr)
      }
    })

    it('should respect limit parameter', async () => {
      const comments = await fetchComments({ limit: 2 })
      expect(comments.length).toBeLessThanOrEqual(2)
    })
  })

  describe('fetchCommentCount', () => {
    it('should return count for a project', async () => {
      const count = await fetchCommentCount('proj-001')
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 for non-existent project', async () => {
      const count = await fetchCommentCount('non-existent-project')
      expect(count).toBe(0)
    })
  })

  describe('createComment', () => {
    it('should create a new comment', async () => {
      const input: CreateCommentInput = {
        project_id: 'proj-001',
        content: 'Test comment'
      }

      const comment = await createComment(input)

      expect(comment.id).toBeDefined()
      expect(comment.project_id).toBe(input.project_id)
      expect(comment.content).toBe(input.content)
      expect(comment.created_at).toBeDefined()
    })

    it('should extract and store mentions', async () => {
      const input: CreateCommentInput = {
        project_id: 'proj-001',
        content: 'Hey @alice and @bob, please review',
        mentions: ['alice', 'bob']
      }

      const comment = await createComment(input)

      expect(comment.mentions).toContain('alice')
      expect(comment.mentions).toContain('bob')
    })
  })

  describe('updateComment', () => {
    it('should update comment content', async () => {
      // First create a comment
      const created = await createComment({
        project_id: 'proj-001',
        content: 'Original content'
      })

      // Then update it
      const updated = await updateComment(created.id, {
        content: 'Updated content'
      })

      expect(updated.content).toBe('Updated content')
      expect(updated.is_edited).toBe(true)
    })

    it('should throw error for non-existent comment', async () => {
      await expect(
        updateComment('non-existent-id', { content: 'Test' })
      ).rejects.toThrow('Comment not found')
    })
  })

  describe('deleteComment', () => {
    it('should delete a comment', async () => {
      // First create a comment
      const created = await createComment({
        project_id: 'proj-001',
        content: 'To be deleted'
      })

      // Delete it
      await expect(deleteComment(created.id)).resolves.not.toThrow()

      // Verify it's gone
      const comments = await fetchComments()
      const found = comments.find(c => c.id === created.id)
      expect(found).toBeUndefined()
    })

    it('should throw error for non-existent comment', async () => {
      await expect(deleteComment('non-existent-id')).rejects.toThrow('Comment not found')
    })
  })

  describe('addReaction', () => {
    it('should add a reaction to a comment', async () => {
      // Create a comment first
      const comment = await createComment({
        project_id: 'proj-001',
        content: 'React to me'
      })

      // Add reaction
      const updated = await addReaction(comment.id, 'like')

      expect(updated.reactions).toBeDefined()
      expect(updated.reactions?.some(r => r.type === 'like')).toBe(true)
    })

    it('should toggle reaction when same type added twice', async () => {
      const comment = await createComment({
        project_id: 'proj-001',
        content: 'Toggle reaction test'
      })

      // Add reaction
      await addReaction(comment.id, 'helpful')
      
      // Add same reaction again (toggle)
      const toggled = await addReaction(comment.id, 'helpful')

      // Should be removed (toggled off)
      const hasReaction = toggled.reactions?.some(
        r => r.type === 'helpful' && r.user_id === 'current-user'
      )
      expect(hasReaction).toBeFalsy()
    })
  })

  describe('formatRelativeTime', () => {
    it('should format recent times as "just now"', () => {
      const now = new Date().toISOString()
      expect(formatRelativeTime(now)).toBe('just now')
    })

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
    })

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
    })

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
    })
  })

  describe('extractMentions', () => {
    it('should extract single mention', () => {
      const mentions = extractMentions('Hey @alice, check this')
      expect(mentions).toEqual(['alice'])
    })

    it('should extract multiple mentions', () => {
      const mentions = extractMentions('@alice @bob @charlie please review')
      expect(mentions).toEqual(['alice', 'bob', 'charlie'])
    })

    it('should return empty array for no mentions', () => {
      const mentions = extractMentions('No mentions here')
      expect(mentions).toEqual([])
    })

    it('should handle mention at start of text', () => {
      const mentions = extractMentions('@admin This is urgent')
      expect(mentions).toContain('admin')
    })
  })

  describe('getCommentSummary', () => {
    it('should return summary for a project', async () => {
      const summary = await getCommentSummary('proj-001')

      expect(summary).toHaveProperty('total')
      expect(summary).toHaveProperty('recent')
      expect(summary).toHaveProperty('hasImportant')
      expect(summary).toHaveProperty('lastActivity')

      expect(typeof summary.total).toBe('number')
      expect(typeof summary.recent).toBe('number')
      expect(typeof summary.hasImportant).toBe('boolean')
    })

    it('should return zeros for project without comments', async () => {
      const summary = await getCommentSummary('project-without-comments')

      expect(summary.total).toBe(0)
      expect(summary.recent).toBe(0)
      expect(summary.lastActivity).toBeNull()
    })
  })

  describe('Property-based tests', () => {
    it('fetchComments should always return an array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            project_id: fc.option(fc.string(), { nil: undefined }),
            limit: fc.option(fc.nat({ max: 100 }), { nil: undefined })
          }),
          async (filter) => {
            const comments = await fetchComments(filter)
            expect(Array.isArray(comments)).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('extractMentions should return array with valid usernames', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const mentions = extractMentions(text)
          
          // Should always return an array
          expect(Array.isArray(mentions)).toBe(true)
          
          // Each mention should be a valid username (alphanumeric)
          mentions.forEach(mention => {
            expect(mention).toMatch(/^\w+$/)
          })
        }),
        { numRuns: 50 }
      )
    })

    it('formatRelativeTime should handle any valid date', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          (date) => {
            const result = formatRelativeTime(date.toISOString())
            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('comment count should be non-negative', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (projectId) => {
          const count = await fetchCommentCount(projectId)
          expect(count).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 10 }
      )
    })

    it('created comment should have required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            project_id: fc.string({ minLength: 1 }),
            content: fc.string({ minLength: 1 })
          }),
          async (input) => {
            const comment = await createComment(input as CreateCommentInput)
            
            expect(comment).toHaveProperty('id')
            expect(comment).toHaveProperty('project_id')
            expect(comment).toHaveProperty('content')
            expect(comment).toHaveProperty('user_id')
            expect(comment).toHaveProperty('created_at')
            expect(comment).toHaveProperty('updated_at')
            expect(comment).toHaveProperty('author_name')
            expect(comment).toHaveProperty('reply_count')
            expect(comment).toHaveProperty('is_edited')
            
            expect(comment.project_id).toBe(input.project_id)
            expect(comment.content).toBe(input.content)
            expect(comment.is_edited).toBe(false)
            expect(comment.reply_count).toBe(0)
          }
        ),
        { numRuns: 10 }
      )
    })

    // Property 18: Comment Data Completeness (Validates: Requirements 14.2)
    it('Property 18: every comment has required fields and valid types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            project_id: fc.option(fc.string(), { nil: undefined }),
            sort_by: fc.option(fc.constantFrom('newest', 'oldest'), { nil: undefined }),
            limit: fc.option(fc.nat({ max: 50 }), { nil: undefined })
          }),
          async (filter) => {
            const comments = await fetchComments(filter)
            for (const c of comments) {
              expect(typeof c.id).toBe('string')
              expect(typeof c.project_id).toBe('string')
              expect(typeof c.user_id).toBe('string')
              expect(typeof c.content).toBe('string')
              expect(Array.isArray(c.mentions)).toBe(true)
              expect(typeof c.created_at).toBe('string')
              expect(typeof c.updated_at).toBe('string')
              expect(typeof c.author_name).toBe('string')
              expect(typeof c.reply_count).toBe('number')
              expect(c.reply_count).toBeGreaterThanOrEqual(0)
              expect(typeof c.is_edited).toBe('boolean')
            }
          }
        ),
        { numRuns: 15 }
      )
    })

    // Property 19: Comment Chronological Ordering (Validates: Requirements 14.5)
    it('Property 19: sort_by newest returns non-ascending created_at; sort_by oldest returns non-descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            project_id: fc.option(fc.string(), { nil: undefined }),
            sort_by: fc.constantFrom('newest', 'oldest')
          }),
          async (filter) => {
            const comments = await fetchComments({ ...filter, limit: 50 })
            for (let i = 1; i < comments.length; i++) {
              const prev = new Date(comments[i - 1].created_at).getTime()
              const curr = new Date(comments[i].created_at).getTime()
              if (filter.sort_by === 'newest') {
                expect(prev).toBeGreaterThanOrEqual(curr)
              } else {
                expect(prev).toBeLessThanOrEqual(curr)
              }
            }
          }
        ),
        { numRuns: 15 }
      )
    })
  })
})
