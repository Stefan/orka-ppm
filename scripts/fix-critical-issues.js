#!/usr/bin/env node

/**
 * Fix Critical Issues Script
 * Automatically fixes the most common and critical issues found by validation
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.blue}🔧 ${message}${colors.reset}`);
  log('='.repeat(50), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

let fixesApplied = 0;

/**
 * Fix React import issues
 */
function fixReactImports(filePath, content) {
  const fileName = path.basename(filePath);
  let modified = false;
  let newContent = content;
  
  // Check if file uses JSX but doesn't import React
  const hasJSX = /<[A-Z]/.test(content) || /<\/[A-Z]/.test(content) || /className=/.test(content);
  const hasReactImport = /import\s+React/.test(content);
  const isClientComponent = content.includes("'use client'");
  
  if (hasJSX && !hasReactImport && (isClientComponent || fileName.endsWith('.tsx'))) {
    // Add React import at the top
    if (content.startsWith("'use client'")) {
      newContent = content.replace(
        "'use client'\n\n",
        "'use client'\n\nimport React from 'react'\n"
      );
    } else {
      newContent = `import React from 'react'\n${content}`;
    }
    modified = true;
    log(`Fixed React import in ${fileName}`, 'green');
    fixesApplied++;
  }
  
  // Fix duplicate React imports
  const reactImportMatches = content.match(/import.*React.*from\s+['"]react['"]/g);
  if (reactImportMatches && reactImportMatches.length > 1) {
    // Keep only the first comprehensive import
    const lines = newContent.split('\n');
    const reactImportLines = [];
    const otherLines = [];
    
    lines.forEach(line => {
      if (/import.*React.*from\s+['"]react['"]/.test(line)) {
        if (reactImportLines.length === 0) {
          // Keep the most comprehensive import
          if (line.includes('useState') || line.includes('useEffect') || line.includes('{')) {
            reactImportLines.push(line);
          } else {
            reactImportLines.push(line);
          }
        }
      } else {
        otherLines.push(line);
      }
    });
    
    if (reactImportLines.length > 0) {
      newContent = [...reactImportLines, ...otherLines].join('\n');
      modified = true;
      log(`Fixed duplicate React imports in ${fileName}`, 'green');
      fixesApplied++;
    }
  }
  
  return { content: newContent, modified };
}

/**
 * Fix common JSX syntax issues
 */
function fixJSXSyntax(filePath, content) {
  const fileName = path.basename(filePath);
  let modified = false;
  let newContent = content;
  
  // Fix extra closing braces in map functions
  const extraBracePattern = /\}\)\}\)/g;
  if (extraBracePattern.test(content)) {
    newContent = newContent.replace(extraBracePattern, '})}');
    modified = true;
    log(`Fixed extra closing braces in ${fileName}`, 'green');
    fixesApplied++;
  }
  
  // Fix corrupted comments
  const corruptedCommentPattern = /\}\)mport\s+([^*]*)\s*\*\/\}/g;
  if (corruptedCommentPattern.test(content)) {
    newContent = newContent.replace(corruptedCommentPattern, '{/* Import $1 */}');
    modified = true;
    log(`Fixed corrupted comments in ${fileName}`, 'green');
    fixesApplied++;
  }
  
  return { content: newContent, modified };
}

/**
 * Fix import/export issues
 */
function fixImportExports(filePath, content) {
  const fileName = path.basename(filePath);
  let modified = false;
  let newContent = content;
  
  // Fix type imports from @supabase/supabase-js
  const supabaseTypePattern = /import\s*\{\s*(Session|User|AuthError)\s*\}\s*from\s*['"]@supabase\/supabase-js['"]/g;
  if (supabaseTypePattern.test(content)) {
    newContent = newContent.replace(supabaseTypePattern, 'import type { $1 } from \'@supabase/supabase-js\'');
    modified = true;
    log(`Fixed Supabase type imports in ${fileName}`, 'green');
    fixesApplied++;
  }
  
  return { content: newContent, modified };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let currentContent = content;
    let fileModified = false;
    
    // Apply fixes
    const reactFix = fixReactImports(filePath, currentContent);
    if (reactFix.modified) {
      currentContent = reactFix.content;
      fileModified = true;
    }
    
    const jsxFix = fixJSXSyntax(filePath, currentContent);
    if (jsxFix.modified) {
      currentContent = jsxFix.content;
      fileModified = true;
    }
    
    const importFix = fixImportExports(filePath, currentContent);
    if (importFix.modified) {
      currentContent = importFix.content;
      fileModified = true;
    }
    
    // Write back if modified
    if (fileModified) {
      fs.writeFileSync(filePath, currentContent, 'utf8');
      log(`Updated ${path.basename(filePath)}`, 'green');
    }
    
  } catch (error) {
    logError(`Failed to process ${filePath}: ${error.message}`);
  }
}

/**
 * Scan and fix files
 */
function scanAndFix() {
  logHeader('Scanning and Fixing Critical Issues');
  
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  const excludeDirs = ['node_modules', '.next', 'dist', 'build', 'scripts'];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !excludeDirs.includes(item)) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        processFile(fullPath);
      }
    }
  }
  
  scanDirectory(process.cwd());
  
  if (fixesApplied === 0) {
    log('No critical issues found to fix', 'green');
  } else {
    log(`Applied ${fixesApplied} fixes`, 'green');
  }
}

/**
 * Main execution
 */
function main() {
  log(`${colors.bold}${colors.blue}🔧 Critical Issues Auto-Fix${colors.reset}`);
  log('Automatically fixing the most common validation issues...\n');
  
  fixesApplied = 0;
  scanAndFix();
  
  logHeader('Fix Summary');
  if (fixesApplied > 0) {
    logSuccess(`Successfully applied ${fixesApplied} fixes!`);
    log('\n🎉 Run validation again to see the improvements!', 'green');
  } else {
    log('No critical issues found that could be auto-fixed.', 'yellow');
  }
}

// Run the fixer
main();