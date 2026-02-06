/**
 * Tests for context capture and formatting (Tasks 2.2, 2.3, 2.4).
 * Property 2: Context Capture and Formatting. Property 3: Context Update Without Remount.
 */

import { getPageContextFromPath, PageContextFromPath } from '../contextFromPath'

describe('getPageContextFromPath', () => {
  describe('Context capture and formatting (2.2)', () => {
    it('returns route, pageTitle and userRole for any pathname', () => {
      const ctx = getPageContextFromPath('/dashboards', 'user')
      expect(ctx).toHaveProperty('route', '/dashboards')
      expect(ctx).toHaveProperty('pageTitle')
      expect(ctx).toHaveProperty('userRole', 'user')
    })

    it('formats context for financials route', () => {
      const ctx = getPageContextFromPath('/financials', 'admin')
      expect(ctx.route).toBe('/financials')
      expect(ctx.pageTitle).toBe('Financials')
      expect(ctx.userRole).toBe('admin')
    })

    it('formats context for project detail route', () => {
      const ctx = getPageContextFromPath('/projects/abc-123', 'user')
      expect(ctx.route).toBe('/projects/abc-123')
      expect(ctx.pageTitle).toBe('Project: abc-123')
      expect(ctx.userRole).toBe('user')
    })

    it('defaults empty pathname to dashboard', () => {
      const ctx = getPageContextFromPath('', 'viewer')
      expect(ctx.route).toBe('/')
      expect(ctx.pageTitle).toBe('Dashboard')
      expect(ctx.userRole).toBe('viewer')
    })

    it('defaults missing userRole to "user"', () => {
      const ctx = getPageContextFromPath('/reports', '')
      expect(ctx.userRole).toBe('user')
    })
  })

  describe('Context update without remount (2.3)', () => {
    it('same pathname and role yields same context', () => {
      const a = getPageContextFromPath('/risks', 'admin')
      const b = getPageContextFromPath('/risks', 'admin')
      expect(a).toEqual(b)
    })

    it('different pathname yields different context', () => {
      const a = getPageContextFromPath('/dashboards', 'user')
      const b = getPageContextFromPath('/financials', 'user')
      expect(a.route).not.toBe(b.route)
      expect(a.pageTitle).not.toBe(b.pageTitle)
    })

    it('different role yields same route but different userRole', () => {
      const a = getPageContextFromPath('/admin', 'user')
      const b = getPageContextFromPath('/admin', 'admin')
      expect(a.route).toBe(b.route)
      expect(a.pageTitle).toBe(b.pageTitle)
      expect(a.userRole).not.toBe(b.userRole)
    })
  })

  describe('Unit tests for ChatContext (2.4)', () => {
    it('URL path extraction for known segments', () => {
      const routes: Array<[string, string]> = [
        ['/dashboards', 'Dashboards'],
        ['/projects', 'Projects'],
        ['/resources', 'Resources'],
        ['/risks', 'Risks'],
        ['/financials', 'Financials'],
        ['/reports', 'Reports'],
        ['/scenarios', 'Scenarios'],
        ['/monte-carlo', 'Monte Carlo'],
        ['/changes', 'Changes'],
        ['/admin', 'Administration'],
      ]
      routes.forEach(([pathname, expectedTitle]) => {
        const ctx = getPageContextFromPath(pathname, 'user')
        expect(ctx.route).toBe(pathname)
        expect(ctx.pageTitle).toBe(expectedTitle)
      })
    })

    it('role is passed through', () => {
      expect(getPageContextFromPath('/projects', 'viewer').userRole).toBe('viewer')
      expect(getPageContextFromPath('/projects', 'admin').userRole).toBe('admin')
    })

    it('context shape is stable for API request', () => {
      const ctx: PageContextFromPath = getPageContextFromPath('/financials/costbook', 'admin')
      const apiContext = {
        route: ctx.route,
        pageTitle: ctx.pageTitle,
        userRole: ctx.userRole,
      }
      expect(apiContext).toEqual({
        route: '/financials/costbook',
        pageTitle: 'Financials',
        userRole: 'admin',
      })
    })
  })
})
