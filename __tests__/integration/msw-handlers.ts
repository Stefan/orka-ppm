/**
 * Mock Service Worker (MSW) API handlers for frontend integration tests
 * Enterprise Test Strategy - Task 3.2
 * Requirements: 6.2
 */

import { rest } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const handlers = [
  rest.get(`${API_BASE}/health`, (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'ok' }));
  }),
  rest.get(`${API_BASE}/projects/`, (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: '1', name: 'Test Project', status: 'active', budget: 100000 },
      ])
    );
  }),
  rest.get(`${API_BASE}/api/features`, (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { name: 'costbook_phase1', enabled: true, organization_id: null },
      ])
    );
  }),
];

export default handlers;
