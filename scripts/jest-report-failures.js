#!/usr/bin/env node
/**
 * Reads jest-results.json (from jest --json --outputFile=jest-results.json)
 * and prints failed test file + test name, one per line.
 * Usage: jest --ci --json --outputFile=jest-results.json; node scripts/jest-report-failures.js
 */

const fs = require('fs');
const path = require('path');

const resultsPath = path.join(process.cwd(), 'jest-results.json');
if (!fs.existsSync(resultsPath)) {
  console.error('Run Jest with --json --outputFile=jest-results.json first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
let count = 0;
results.testResults.forEach((suite) => {
  const assertionResults = suite.assertionResults || suite.testResults || [];
  const failing = assertionResults.filter((t) => t.status === 'failed');
  if (failing.length === 0) return;
  failing.forEach((test) => {
    count++;
    console.log(`${suite.name}\t${test.fullName || test.title || test.name || '?'}`);
  });
});
if (count === 0) {
  console.log('No failed tests.');
} else {
  console.error(`\nTotal: ${count} failed test(s).`);
}
