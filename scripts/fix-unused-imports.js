#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

// Fix unused imports in a file
function fixUnusedImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Handle React hooks imports
    const reactHooksRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]react['"]/;
    const reactMatch = content.match(reactHooksRegex);
    
    if (reactMatch) {
      const imports = reactMatch[1].split(',').map(imp => imp.trim());
      const usedImports = [];
      
      for (const imp of imports) {
        const importRegex = new RegExp(`\\b${imp}\\b`, 'g');
        const matches = content.match(importRegex);
        
        if (matches && matches.length > 1) {
          usedImports.push(imp);
        }
      }
      
      if (usedImports.length !== imports.length && usedImports.length > 0) {
        const newImport = `import { ${usedImports.join(', ')} } from 'react'`;
        content = content.replace(reactHooksRegex, newImport);
        modified = true;
        console.log(`Fixed React hooks imports in: ${filePath}`);
        console.log(`  Removed: ${imports.filter(imp => !usedImports.includes(imp)).join(', ')}`);
      }
    }
    
    // Handle lucide-react imports
    const lucideImportRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]lucide-react['"]/;
    const match = content.match(lucideImportRegex);
    
    if (match) {
      const imports = match[1].split(',').map(imp => imp.trim());
      const usedImports = [];
      
      for (const imp of imports) {
        // Check if the import is actually used in the file
        const importRegex = new RegExp(`\\b${imp}\\b`, 'g');
        const matches = content.match(importRegex);
        
        // If it appears more than once (once in import, once+ in usage)
        if (matches && matches.length > 1) {
          usedImports.push(imp);
        }
      }
      
      if (usedImports.length !== imports.length) {
        if (usedImports.length > 0) {
          const newImport = `import { ${usedImports.join(', ')} } from 'lucide-react'`;
          content = content.replace(lucideImportRegex, newImport);
        } else {
          // Remove the entire import if no icons are used
          content = content.replace(lucideImportRegex, '');
        }
        modified = true;
        console.log(`Fixed lucide-react imports in: ${filePath}`);
        console.log(`  Removed: ${imports.filter(imp => !usedImports.includes(imp)).join(', ')}`);
      }
    }
    
    // Handle other common unused imports (recharts, etc.)
    const rechartsImportRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]recharts['"]/;
    const rechartsMatch = content.match(rechartsImportRegex);
    
    if (rechartsMatch) {
      const imports = rechartsMatch[1].split(',').map(imp => imp.trim());
      const usedImports = [];
      
      for (const imp of imports) {
        const importRegex = new RegExp(`\\b${imp}\\b`, 'g');
        const matches = content.match(importRegex);
        
        if (matches && matches.length > 1) {
          usedImports.push(imp);
        }
      }
      
      if (usedImports.length !== imports.length) {
        if (usedImports.length > 0) {
          const newImport = `import { ${usedImports.join(', ')} } from 'recharts'`;
          content = content.replace(rechartsImportRegex, newImport);
        } else {
          content = content.replace(rechartsImportRegex, '');
        }
        modified = true;
        console.log(`Fixed recharts imports in: ${filePath}`);
      }
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
console.log('🔧 Fixing unused imports...');

const appDir = path.join(process.cwd(), 'app');
const componentDir = path.join(process.cwd(), 'components');

const files = [
  ...findTsxFiles(appDir),
  ...findTsxFiles(componentDir)
];

let fixedCount = 0;

for (const file of files) {
  if (fixUnusedImports(file)) {
    fixedCount++;
  }
}

console.log(`✅ Fixed unused imports in ${fixedCount} files`);