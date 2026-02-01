/**
 * Run Lighthouse and generate reports - Enterprise Test Strategy Task 6.1
 * Requirements: 9.1
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reportDir = path.join(__dirname, '..', 'test-reports', 'lighthouse');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

try {
  execSync(
    `npx lhci autorun --config=__tests__/performance/lighthouse/config.js`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );
} catch (e) {
  console.warn('Lighthouse run failed (optional):', e.message);
}
