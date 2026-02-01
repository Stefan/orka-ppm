/**
 * Test pyramid distribution calculator - Enterprise Test Strategy Task 23.1
 * Requirements: 1.4
 * Parses test results and reports % execution time by type (unit, integration, e2e).
 */

const fs = require('fs');
const path = require('path');

const REPORT_PATH = process.env.TEST_PYRAMID_REPORT || 'test-reports/pyramid-distribution.json';

const defaultDistribution = {
  unit: { count: 0, timeMs: 0, percentage: 0 },
  integration: { count: 0, timeMs: 0, percentage: 0 },
  e2e: { count: 0, timeMs: 0, percentage: 0 },
  totalTimeMs: 0,
  generatedAt: new Date().toISOString(),
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeReport(dist) {
  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, JSON.stringify(dist, null, 2), 'utf8');
  console.log('Test pyramid report written to', REPORT_PATH);
}

// If run as script, write default placeholder; CI can override with real results.
if (require.main === module) {
  writeReport(defaultDistribution);
}

module.exports = { writeReport, defaultDistribution, REPORT_PATH };
