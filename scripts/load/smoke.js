/**
 * k6 smoke test: 1–2 VUs, ~1 min, sanity check (health, optional GET).
 * Target: BASE_URL (default http://localhost:3000 for Next.js).
 * SLO: p95 < 2s, error rate < 5%.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 2,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
  });
  sleep(0.5);
}
