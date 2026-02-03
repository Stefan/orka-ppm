#!/usr/bin/env node

/**
 * Print coverage summary by directory (lib, app, components, hooks).
 * Run after: npm run test:coverage
 * Reads coverage/coverage-final.json (Jest) or coverage/lcov.info.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COV_JSON = path.join(ROOT, 'coverage', 'coverage-final.json');
const COV_LCOV = path.join(ROOT, 'coverage', 'lcov.info');

const DIRS = ['lib', 'app', 'components', 'hooks'];

function fromLcov() {
  if (!fs.existsSync(COV_LCOV)) return null;
  const raw = fs.readFileSync(COV_LCOV, 'utf8');
  const files = {};
  let current = null;
  raw.split('\n').forEach((line) => {
    if (line.startsWith('SF:')) {
      current = path.relative(ROOT, line.slice(3).trim());
      if (!files[current]) files[current] = { statements: 0, covered: 0, branches: 0, branchHits: 0 };
    } else if (current && line.startsWith('LF:')) {
      files[current].statements = parseInt(line.slice(3), 10) || 0;
    } else if (current && line.startsWith('LH:')) {
      files[current].covered = parseInt(line.slice(3), 10) || 0;
    } else if (current && line.startsWith('BRF:')) {
      files[current].branches = parseInt(line.slice(4), 10) || 0;
    } else if (current && line.startsWith('BRH:')) {
      files[current].branchHits = parseInt(line.slice(4), 10) || 0;
    }
  });
  return files;
}

function fromJson() {
  if (!fs.existsSync(COV_JSON)) return null;
  const cov = JSON.parse(fs.readFileSync(COV_JSON, 'utf8'));
  const files = {};
  for (const [file, data] of Object.entries(cov)) {
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('..')) continue;
    let statements = 0;
    let covered = 0;
    let branches = 0;
    let branchHits = 0;
    if (data.s) {
      for (const v of Object.values(data.s)) { statements++; if (v > 0) covered++; }
    }
    if (data.b) {
      for (const branchSet of Object.values(data.b)) {
        for (const v of branchSet) { branches++; if (v > 0) branchHits++; }
      }
    }
    files[rel] = { statements, covered, branches, branchHits };
  }
  return files;
}

function aggregateByDir(files) {
  const byDir = {};
  for (const [file, data] of Object.entries(files)) {
    const top = file.split(path.sep)[0];
    if (!DIRS.includes(top)) continue;
    if (!byDir[top]) byDir[top] = { statements: 0, covered: 0, branches: 0, branchHits: 0 };
    byDir[top].statements += data.statements;
    byDir[top].covered += data.covered;
    byDir[top].branches += (data.branches !== undefined ? data.branches : data.statements);
    byDir[top].branchHits += (data.branchHits !== undefined ? data.branchHits : data.covered);
  }
  return byDir;
}

function main() {
  let files = fromJson();
  if (!files) files = fromLcov();
  if (!files || Object.keys(files).length === 0) {
    console.log('No coverage data found. Run: npm run test:coverage');
    process.exit(1);
  }
  const byDir = aggregateByDir(files);
  console.log('\nCoverage by directory (target 80%):\n');
  for (const dir of DIRS) {
    const d = byDir[dir];
    if (!d) {
      console.log(`  ${dir}: (no data)`);
      continue;
    }
    const linePct = d.statements ? ((d.covered / d.statements) * 100).toFixed(1) : '0';
    const branchPct = d.branches ? ((d.branchHits / d.branches) * 100).toFixed(1) : '0';
    const status = parseFloat(linePct) >= 80 ? '\u2713' : '-';
    console.log(`  ${dir}:  lines ${linePct}%  branches ${branchPct}%  ${status}`);
  }
  console.log('');
}

main();
