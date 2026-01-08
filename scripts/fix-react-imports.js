#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript React files
function findTsxFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Fix React imports in a file
function fixReactImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file has React import
    const reactImportRegex = /import\s+React,?\s*\{([^}]*)\}\s+from\s+['"]react['"]/;
    const reactOnlyImportRegex = /import\s+React\s+from\s+['"]react['"]/;
    const namedImportsRegex = /import\s+\{([^}]*)\}\s+from\s+['"]react['"]/;
    
    // Check if React is actually used in the file (not just in types)
    const usesReact = content.includes('React.') || 
                     content.includes('<React.') ||
                     content.includes('React.Component') ||
                     content.includes('React.createElement');
    
    if (reactImportRegex.test(content)) {
      const match = content.match(reactImportRegex);
      const namedImports = match[1].trim();
      
      if (!usesReact && namedImports) {
        // Replace with just named imports
        content = content.replace(reactImportRegex, `import { ${namedImports} } from 'react'`);
        modified = true;
        console.log(`Fixed React import in: ${filePath}`);
      }
    } else if (reactOnlyImportRegex.test(content) && !usesReact) {
      // Remove React-only import if React is not used
      content = content.replace(reactOnlyImportRegex, '');
      modified = true;
      console.log(`Removed unused React import in: ${filePath}`);
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    
    return modified;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing React imports...');

const appDir = path.join(process.cwd(), 'app');
const componentDir = path.join(process.cwd(), 'components');

const files = [
  ...findTsxFiles(appDir),
  ...findTsxFiles(componentDir)
];

let fixedCount = 0;

for (const file of files) {
  if (fixReactImports(file)) {
    fixedCount++;
  }
}

console.log(`✅ Fixed React imports in ${fixedCount} files`);

// Try to build to check for other issues
console.log('🔍 Checking for remaining TypeScript errors...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful!');
} catch (error) {
  console.log('❌ Build still has errors. Manual fixes may be needed.');
}