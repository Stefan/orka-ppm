/**
 * k6 dashboard journey: 10–20 VUs, ~5 min.
 * GET health, GET /api/projects (optional AUTH_TOKEN), GET health again.
 * SLO: p95 < 2s, error rate < 5%.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  vus: 10,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
  };

  const healthRes = http.get(`${BASE_URL}/api/health`, { headers });
  check(healthRes, { 'health 200': (r) => r.status === 200 });

  const projectsRes = http.get(`${BASE_URL}/api/projects`, { headers });
  check(projectsRes, { 'projects 2xx': (r) => r.status >= 200 && r.status < 300 });

  sleep(0.5);

  const healthRes2 = http.get(`${BASE_URL}/api/health`, { headers });
  check(healthRes2, { 'health again 200': (r) => r.status === 200 });

  sleep(0.5);
}
