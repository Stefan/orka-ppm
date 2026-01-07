#!/usr/bin/env node

/**
 * Comprehensive Syntax and Build Validation Script
 * Catches common issues before starting the development server
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.blue}🔍 ${message}${colors.reset}`);
  log('='.repeat(50), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Track all issues found
let issues = [];
let warnings = [];

/**
 * Check for common JSX syntax issues
 */
function checkJSXSyntax(filePath, content) {
  const fileName = path.basename(filePath);
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for common JSX issues
    const checks = [
      {
        pattern: /\}\)\}\)/g,
        message: 'Potential extra closing braces - check map() function closures',
        type: 'error'
      },
      {
        pattern: /\}\)mport/g,
        message: 'Corrupted comment or malformed JSX',
        type: 'error'
      },
      {
        pattern: /\{\s*\/\*.*\*\/\s*\}/g,
        message: 'Comment inside JSX braces - should be {/* comment */}',
        type: 'warning'
      },
      {
        pattern: /\)\s*\}\s*\)/g,
        message: 'Potential mismatched parentheses in JSX',
        type: 'error'
      },
      {
        pattern: /className=\{[^}]*\n/g,
        message: 'Unclosed className attribute',
        type: 'error'
      },
      {
        pattern: /\$\{.*\}/g,
        message: 'Template literal syntax in JSX - use {`template`} instead',
        type: 'warning'
      },
      {
        pattern: /\s{3,}\}/g,
        message: 'Excessive whitespace before closing brace (3+ spaces)',
        type: 'warning'
      }
    ];
    
    checks.forEach(check => {
      if (check.pattern.test(line)) {
        const issue = `${fileName}:${lineNum} - ${check.message}`;
        if (check.type === 'error') {
          issues.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    });
  });
}

/**
 * Check for balanced braces and parentheses
 */
function checkBalancedBraces(filePath, content) {
  const fileName = path.basename(filePath);
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inString = false;
  let inComment = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = content[i - 1];
    const nextChar = content[i + 1];
    
    // Handle string literals
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }
    
    // Skip if inside string
    if (inString) continue;
    
    // Handle comments
    if (char === '/' && nextChar === '*') {
      inComment = true;
      continue;
    }
    if (char === '*' && nextChar === '/' && inComment) {
      inComment = false;
      continue;
    }
    if (inComment) continue;
    
    // Count braces, parentheses, and brackets
    switch (char) {
      case '{': braceCount++; break;
      case '}': braceCount--; break;
      case '(': parenCount++; break;
      case ')': parenCount--; break;
      case '[': bracketCount++; break;
      case ']': bracketCount--; break;
    }
  }
  
  if (braceCount !== 0) {
    issues.push(`${fileName} - Unbalanced braces: ${braceCount > 0 ? 'missing' : 'extra'} ${Math.abs(braceCount)} closing brace(s)`);
  }
  if (parenCount !== 0) {
    issues.push(`${fileName} - Unbalanced parentheses: ${parenCount > 0 ? 'missing' : 'extra'} ${Math.abs(parenCount)} closing parenthesis(es)`);
  }
  if (bracketCount !== 0) {
    issues.push(`${fileName} - Unbalanced brackets: ${bracketCount > 0 ? 'missing' : 'extra'} ${Math.abs(bracketCount)} closing bracket(s)`);
  }
}

/**
 * Check for import/export issues
 */
function checkImports(filePath, content) {
  const fileName = path.basename(filePath);
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for common import issues
    if (line.includes('import') && !line.trim().startsWith('//')) {
      if (!line.includes('from') && !line.includes('import(')) {
        issues.push(`${fileName}:${lineNum} - Malformed import statement`);
      }
      if (line.includes('import') && line.includes('{') && !line.includes('}')) {
        issues.push(`${fileName}:${lineNum} - Unclosed import braces`);
      }
    }
  });
}

/**
 * Scan all TypeScript/JavaScript files
 */
function scanFiles() {
  logHeader('Scanning Files for Syntax Issues');
  
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  const excludeDirs = ['node_modules', '.next', 'dist', 'build'];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !excludeDirs.includes(item)) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          checkJSXSyntax(fullPath, content);
          checkBalancedBraces(fullPath, content);
          checkImports(fullPath, content);
        } catch (error) {
          issues.push(`${item} - Failed to read file: ${error.message}`);
        }
      }
    }
  }
  
  scanDirectory(process.cwd());
  
  if (issues.length === 0 && warnings.length === 0) {
    logSuccess('No syntax issues found');
  } else {
    if (issues.length > 0) {
      log(`\nFound ${issues.length} syntax error(s):`, 'red');
      issues.forEach(issue => logError(issue));
    }
    if (warnings.length > 0) {
      log(`\nFound ${warnings.length} warning(s):`, 'yellow');
      warnings.forEach(warning => logWarning(warning));
    }
  }
}

/**
 * Run TypeScript compiler check
 */
function runTypeCheck() {
  logHeader('Running TypeScript Compilation Check');
  
  try {
    execSync('npx tsc --noEmit --skipLibCheck', { 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    logSuccess('TypeScript compilation check passed');
  } catch (error) {
    logError('TypeScript compilation errors found:');
    console.log(error.stdout?.toString() || error.message);
    issues.push('TypeScript compilation failed');
  }
}

/**
 * Run ESLint check
 */
function runLintCheck() {
  logHeader('Running ESLint Check');
  
  try {
    execSync('npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0', { 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    logSuccess('ESLint check passed');
  } catch (error) {
    logError('ESLint errors found:');
    console.log(error.stdout?.toString() || error.message);
    warnings.push('ESLint warnings/errors found');
  }
}

/**
 * Check Next.js configuration
 */
function checkNextConfig() {
  logHeader('Checking Next.js Configuration');
  
  const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
  let configFound = false;
  
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      configFound = true;
      try {
        const content = fs.readFileSync(configFile, 'utf8');
        if (content.includes('module.exports') || content.includes('export default')) {
          logSuccess(`Valid Next.js config found: ${configFile}`);
        } else {
          warnings.push(`${configFile} may have invalid export format`);
        }
      } catch (error) {
        issues.push(`Failed to read ${configFile}: ${error.message}`);
      }
      break;
    }
  }
  
  if (!configFound) {
    logWarning('No Next.js config file found (using defaults)');
  }
}

/**
 * Check package.json dependencies
 */
function checkDependencies() {
  logHeader('Checking Dependencies');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check for required Next.js dependencies
    const requiredDeps = ['next', 'react', 'react-dom'];
    const missingDeps = requiredDeps.filter(dep => 
      !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );
    
    if (missingDeps.length > 0) {
      issues.push(`Missing required dependencies: ${missingDeps.join(', ')}`);
    } else {
      logSuccess('All required dependencies found');
    }
    
    // Check for TypeScript setup
    if (packageJson.devDependencies?.typescript) {
      logSuccess('TypeScript setup detected');
    } else {
      logWarning('TypeScript not found in devDependencies');
    }
    
  } catch (error) {
    issues.push(`Failed to read package.json: ${error.message}`);
  }
}

/**
 * Main execution
 */
function main() {
  log(`${colors.bold}${colors.cyan}🚀 Pre-Development Validation${colors.reset}`);
  log('Checking for common issues before starting the development server...\n');
  
  // Reset counters
  issues = [];
  warnings = [];
  
  // Run all checks
  checkDependencies();
  checkNextConfig();
  scanFiles();
  runTypeCheck();
  runLintCheck();
  
  // Summary
  logHeader('Validation Summary');
  
  if (issues.length === 0) {
    logSuccess(`All checks passed! ${warnings.length > 0 ? `(${warnings.length} warnings)` : ''}`);
    log('\n🎉 Ready to start development server!', 'green');
    process.exit(0);
  } else {
    logError(`Found ${issues.length} error(s) and ${warnings.length} warning(s)`);
    log('\n🛠️  Please fix the errors above before starting the development server.', 'red');
    process.exit(1);
  }
}

// Run the validation
main();