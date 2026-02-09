#!/usr/bin/env node
/**
 * Bump build number in package.json (version stays manual).
 * Usage: node scripts/bump-patch-version.js
 * Exits 0 and prints new build number on success; exits 1 on error.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const next = (pkg.buildNumber ?? 0) + 1;
pkg.buildNumber = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(String(next));
