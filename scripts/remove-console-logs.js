#!/usr/bin/env node

/**
 * Remove console.log statements from production builds
 * This script is run as part of the build process
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const EXCLUDED_LOGS = ['error', 'warn', 'info'];
const DRY_RUN = process.argv.includes('--dry-run');

async function removeConsoleLogs() {
  console.log('🧹 Removing console.log statements from production build...\n');
  
  // Find all TypeScript and JavaScript files
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    ignore: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'scripts/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}'
    ]
  });
  
  let totalRemoved = 0;
  let filesModified = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileRemoved = 0;
    
    // Remove console.log statements (but keep error, warn, info)
    const consoleLogRegex = /console\.log\([^)]*\);?\s*/g;
    const matches = content.match(consoleLogRegex) || [];
    
    for (const match of matches) {
      // Check if it's an excluded log type
      const isExcluded = EXCLUDED_LOGS.some(type => 
        match.includes(`console.${type}`)
      );
      
      if (!isExcluded) {
        content = content.replace(match, '');
        fileRemoved++;
        totalRemoved++;
      }
    }
    
    // Write back if changed
    if (content !== originalContent) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      filesModified++;
      console.log(`✓ ${file}: Removed ${fileRemoved} console.log statement(s)`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Console logs removed: ${totalRemoved}`);
  
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN: No files were actually modified`);
    console.log(`   Run without --dry-run to apply changes`);
  } else {
    console.log(`\n✅ Console logs removed successfully!`);
  }
}

removeConsoleLogs().catch(err => {
  console.error('❌ Error removing console logs:', err);
  process.exit(1);
});
