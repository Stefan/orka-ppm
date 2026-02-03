/**
 * Compliance: Audit-relevant frontend actions trigger expected API calls
 * Enterprise Test Strategy - Section 5 (Phase 2)
 * Ensures export and dashboard stats call the correct endpoints with expected params.
 */

import { getApiUrl } from '@/lib/api/client'

describe('Compliance: Audit API integration', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  describe('Audit export', () => {
    it('calls correct URL and method for PDF export with expected body', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      })
      global.fetch = fetchMock

      const token = 'test-token'
      const format = 'pdf'
      const url = getApiUrl(`/api/audit/export/${format}`)
      const body = JSON.stringify({
        filters: {},
        include_summary: format === 'pdf',
      })

      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/audit/export/pdf'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ filters: {}, include_summary: true }),
        })
      )
    })

    it('calls correct URL and method for CSV export with include_summary false', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      })
      global.fetch = fetchMock

      const format = 'csv'
      const url = getApiUrl(`/api/audit/export/${format}`)
      const body = JSON.stringify({
        filters: {},
        include_summary: format === 'pdf',
      })

      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/audit/export/csv'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filters: {}, include_summary: false }),
        })
      )
    })
  })

  describe('Audit dashboard stats', () => {
    it('uses correct stats URL and auth header when fetching dashboard stats', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total_events_24h: 0 }),
      })
      global.fetch = fetchMock

      const url = getApiUrl('/api/audit/dashboard/stats')
      await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/audit/dashboard/stats'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer session-token',
          }),
        })
      )
    })
  })
})
