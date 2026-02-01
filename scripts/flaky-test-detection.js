/**
 * Flaky test detection - Enterprise Test Strategy Task 17.1
 * Requirements: 20.1, 20.2
 * Tracks pass/fail over runs; flags tests with >2% flakiness.
 */

const fs = require('fs');
const path = require('path');

const FLAKINESS_THRESHOLD = 0.02;
const RESULTS_FILE = process.env.FLAKY_RESULTS_FILE || 'test-reports/flaky-results.json';

function loadResults() {
  try {
    const data = fs.readFileSync(RESULTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { runs: [], byTest: {} };
  }
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function recordRun(testId, passed) {
  const results = loadResults();
  results.runs = results.runs.slice(-100);
  results.runs.push({ testId, passed, ts: new Date().toISOString() });
  results.byTest[testId] = results.byTest[testId] || { passes: 0, total: 0 };
  results.byTest[testId].total += 1;
  if (passed) results.byTest[testId].passes += 1;
  ensureDir(RESULTS_FILE);
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function getFlakyTests() {
  const results = loadResults();
  const flaky = [];
  for (const [id, stats] of Object.entries(results.byTest)) {
    if (stats.total < 5) continue;
    const rate = stats.passes / stats.total;
    const flakiness = 1 - rate;
    if (flakiness > FLAKINESS_THRESHOLD) flaky.push({ id, flakiness: (flakiness * 100).toFixed(2), ...stats });
  }
  return flaky;
}

if (require.main === module) {
  const flaky = getFlakyTests();
  console.log(JSON.stringify(flaky, null, 2));
  if (flaky.length > 0) process.exitCode = 1;
}

module.exports = { recordRun, getFlakyTests, FLAKINESS_THRESHOLD };
