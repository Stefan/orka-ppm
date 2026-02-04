#!/usr/bin/env node

/**
 * Health check: ensure optional dependencies are installed when referenced in code.
 * Fails early if code imports a package that is not in package.json,
 * avoiding "Module not found" at build time.
 *
 * Optional packages list: add any package that is optionally used (dynamic import or try/require)
 * so that when it appears in source, we require it to be installed.
 * (@sentry/nextjs omitted: not compatible with Next 16; code uses try/catch in next.config and no-op sentry.client.config.)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

const OPTIONAL_PACKAGES = [];

// Only check app/components/lib/instrumentation; next.config often uses optional require() in try/catch
const SOURCE_DIRS = ['app', 'components', 'lib', 'instrumentation.ts'];

function getAllFiles(dir, ext, files = []) {
  if (!fs.existsSync(dir)) return files;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (ext.test(path.basename(dir))) files.push(dir);
    return files;
  }
  fs.readdirSync(dir).forEach((child) => {
    const childPath = path.join(dir, child);
    if (fs.statSync(childPath).isDirectory() && child !== 'node_modules' && child !== '.next') {
      getAllFiles(childPath, ext, files);
    } else if (ext.test(child)) {
      files.push(childPath);
    }
  });
  return files;
}

function getInstalledDeps() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  return deps;
}

function main() {
  const installed = getInstalledDeps();
  const errors = [];

  const ext = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
  const files = [];
  SOURCE_DIRS.forEach((d) => {
    const full = path.join(ROOT, d);
    if (d.endsWith('.ts') || d.endsWith('.js')) {
      if (fs.existsSync(full)) files.push(full);
    } else {
      getAllFiles(full, ext, files);
    }
  });

  for (const pkg of OPTIONAL_PACKAGES) {
    const used = files.some((file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        return pkg.pattern.test(content);
      } catch {
        return false;
      }
    });
    if (used && !installed.has(pkg.name)) {
      errors.push(
        `Code references "${pkg.name}" but it is not in package.json. Either add the dependency or remove the import.`
      );
    }
  }

  if (errors.length > 0) {
    console.error('Optional dependency check failed:\n');
    errors.forEach((e) => console.error('  -', e));
    console.error('\nRun: npm install ' + OPTIONAL_PACKAGES.filter((p) => !installed.has(p.name)).map((p) => p.name).join(' ') + '\nOr remove/guard the corresponding imports in the codebase.');
    process.exit(1);
  }
  console.log('Optional dependency check passed.');
}

main();
