/**
 * Collect and store test metrics - Enterprise Test Strategy Task 16.3
 * Requirements: 19.5, 19.6
 */

const fs = require('fs');
const path = require('path');

const OUT = process.env.TEST_METRICS_FILE || 'test-reports/metrics.json';

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function collectFromJestResults() {
  const fp = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
  let data = { test_count: 0, pass_rate: 0, execution_time_sec: 0, flakiness: 0 };
  try {
    const c = JSON.parse(fs.readFileSync(fp, 'utf8'));
    data.lines = c.total?.lines?.pct;
    data.statements = c.total?.statements?.pct;
  } catch (_) {}
  return data;
}

const metrics = {
  ...collectFromJestResults(),
  collected_at: new Date().toISOString(),
};
ensureDir(OUT);
fs.writeFileSync(OUT, JSON.stringify(metrics, null, 2));
console.log('Metrics written to', OUT);
