#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the Next.js build output to identify large dependencies and duplicates
 */

const fs = require('fs');
const path = require('path');

console.log('📦 Bundle Analysis Report\n');
console.log('=' .repeat(80));

// Read build manifest
const buildManifestPath = path.join(process.cwd(), '.next/build-manifest.json');
const appBuildManifestPath = path.join(process.cwd(), '.next/app-build-manifest.json');

if (fs.existsSync(buildManifestPath)) {
  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
  
  console.log('\n📄 Pages and their chunks:');
  console.log('-'.repeat(80));
  
  Object.entries(buildManifest.pages).forEach(([page, chunks]) => {
    console.log(`\n${page}:`);
    chunks.forEach(chunk => {
      const chunkPath = path.join(process.cwd(), '.next', chunk);
      if (fs.existsSync(chunkPath)) {
        const stats = fs.statSync(chunkPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  - ${chunk} (${sizeKB} KB)`);
      }
    });
  });
}

// Analyze static chunks
const staticPath = path.join(process.cwd(), '.next/static/chunks');
if (fs.existsSync(staticPath)) {
  console.log('\n\n📊 Largest Static Chunks:');
  console.log('-'.repeat(80));
  
  const chunks = [];
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.js')) {
        chunks.push({
          name: path.relative(staticPath, filePath),
          size: stat.size,
          sizeKB: (stat.size / 1024).toFixed(2)
        });
      }
    });
  }
  
  walkDir(staticPath);
  
  // Sort by size descending
  chunks.sort((a, b) => b.size - a.size);
  
  // Show top 20 largest chunks
  console.log('\nTop 20 Largest Chunks:');
  chunks.slice(0, 20).forEach((chunk, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. ${chunk.name.padEnd(60)} ${chunk.sizeKB.padStart(10)} KB`);
  });
  
  // Calculate total size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`\nTotal JavaScript Size: ${totalSizeMB} MB`);
}

// Analyze package.json dependencies
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  console.log('\n\n📦 Dependencies Analysis:');
  console.log('-'.repeat(80));
  
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  
  console.log(`\nProduction Dependencies: ${Object.keys(deps).length}`);
  console.log(`Development Dependencies: ${Object.keys(devDeps).length}`);
  
  // Check for potentially heavy packages
  const heavyPackages = [
    'moment',
    'lodash',
    'date-fns',
    'axios',
    'jquery',
    '@material-ui/core',
    'antd',
    'chart.js',
    'd3'
  ];
  
  const foundHeavy = [];
  Object.keys(deps).forEach(dep => {
    if (heavyPackages.some(heavy => dep.includes(heavy))) {
      foundHeavy.push(dep);
    }
  });
  
  if (foundHeavy.length > 0) {
    console.log('\n⚠️  Potentially Heavy Dependencies Found:');
    foundHeavy.forEach(dep => {
      console.log(`  - ${dep}`);
    });
  }
  
  // List all production dependencies
  console.log('\n📋 All Production Dependencies:');
  Object.keys(deps).sort().forEach(dep => {
    console.log(`  - ${dep}: ${deps[dep]}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Analysis complete!');
console.log('\n💡 Recommendations:');
console.log('  1. Review the largest chunks and consider code splitting');
console.log('  2. Check for duplicate dependencies across chunks');
console.log('  3. Consider lazy loading heavy components');
console.log('  4. Use dynamic imports for route-specific code');
console.log('  5. Review and remove unused dependencies');
console.log('\n📊 For visual analysis, open: .next/analyze/client.html\n');
