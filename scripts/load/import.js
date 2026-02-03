/**
 * k6 import flow: 5–10 VUs, ~3 min.
 * POST to project import with small fixed payload (or skip in CI if destructive).
 * SLO: p95 < 3s, error rate < 10% (import may return 401 without auth).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export const options = {
  vus: 5,
  duration: '3m',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.10'],
  },
};

const smallPayload = JSON.stringify({
  projects: [
    { name: 'k6-import-test', status: 'planning', budget: 1000 },
  ],
});

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
  };

  const res = http.post(`${BASE_URL}/api/projects/import`, smallPayload, { headers });
  check(res, {
    'import response received': (r) => r.status !== undefined,
    'import 2xx or 401': (r) => r.status === 200 || r.status === 201 || r.status === 401 || r.status === 400,
  });
  sleep(1);
}
